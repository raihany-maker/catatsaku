/**
 * Store — satu sumber data di browser.
 *  1) Snapshot dari server disimpan di localStorage → buka aplikasi langsung tampil (SWR).
 *  2) Semua simpan bersifat OPTIMISTIS: UI berubah seketika, permintaan masuk antrean
 *     berurutan, hasil server (otoritatif) menggantikan data sementara. Bila server menolak,
 *     perubahan dibatalkan tepat sasaran (undo per rekaman) lalu disinkronkan ulang.
 *  3) Versi data (rev) dipakai untuk sinkron murah: server hanya mengirim data bila berubah.
 */
(function () {
  const KUNCI_LOKAL = 'cs_snap_v1';
  const KEY = { trx: 'ID_Transaksi', kontribusi: 'ID_Kontribusi' };
  const keyOf = kind => KEY[kind] || 'ID';

  const Store = {
    db: null,
    pending: 0,
    perluSync: false,
    terakhirSync: 0,
    waktuSync: '',
    idMap: {},
    _antre: Promise.resolve(),
    _dengar: new Set(),
    _jadwal: 0,

    // ---------------------------------------------------------------- event
    on(fn) { this._dengar.add(fn); return () => this._dengar.delete(fn); },
    emit() {
      if (this._jadwal) return;
      this._jadwal = requestAnimationFrame(() => { this._jadwal = 0; this._dengar.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); });
    },

    // ---------------------------------------------------------------- snapshot
    terima(snap) {
      const cols = snap.trx.cols;
      const trx = snap.trx.rows.map(r => { const o = {}; for (let i = 0; i < cols.length; i++) o[cols[i]] = r[i]; return o; });
      this.db = {
        rev: snap.rev, dibuat: snap.dibuat, trx,
        dompet: snap.dompet || [], kategori: snap.kategori || [], anggaran: snap.anggaran || [], target: snap.target || [],
        kontribusi: snap.kontribusi || [], tagihan: snap.tagihan || [], alokasi: snap.alokasi || [],
        pengaturan: snap.pengaturan || {}, meta: snap.meta || {}, cols
      };
      this.simpanLokal();
      this.emit();
    },
    keSnap() {
      const db = this.db, bukanTmp = o => !String(o.ID || o.ID_Kontribusi || '').startsWith('tmp-');
      const cols = db.cols;
      return {
        rev: db.rev, dibuat: db.dibuat,
        trx: { cols, rows: db.trx.filter(t => !String(t.ID_Transaksi).startsWith('tmp-')).map(t => cols.map(c => t[c])) },
        dompet: db.dompet.filter(bukanTmp), kategori: db.kategori.filter(bukanTmp), anggaran: db.anggaran.filter(bukanTmp),
        target: db.target.filter(bukanTmp), kontribusi: db.kontribusi.filter(bukanTmp), tagihan: db.tagihan.filter(bukanTmp),
        alokasi: db.alokasi, pengaturan: db.pengaturan, meta: db.meta
      };
    },
    simpanLokal: U.debounce(function () { if (Store.db) U.simpanLokal(KUNCI_LOKAL, Store.keSnap()); }, 700),
    muatLokal() {
      const s = U.bacaLokal(KUNCI_LOKAL, true);
      if (s && s.trx && s.trx.cols) { this.terima(s); return true; }
      return false;
    },
    hapusLokal() { U.hapusLokal(KUNCI_LOKAL); this.db = null; },

    // ---------------------------------------------------------------- server
    async bootstrap(segar) {
      const res = await Api.post('bootstrap', { segar: !!segar });
      this.terima(res.snap);
      this.terakhirSync = Date.now();
      this.waktuSync = U.sekarang().iso;
      return res;
    },
    /** Sinkron murah: tidak ada data dikirim bila versi sama. */
    async sync(paksa) {
      if (this.pending) { this.perluSync = true; return; }
      if (!paksa && Date.now() - this.terakhirSync < 20000) return;
      this.terakhirSync = Date.now();
      const res = await Api.post('sync', { rev: this.db ? this.db.rev : '' });
      this.perluSync = false;
      this.waktuSync = U.sekarang().iso;
      if (!res.unchanged && res.snap) this.terima(res.snap); else this.emit();
    },

    // ---------------------------------------------------------------- ubah lokal (immutable)
    ubah(fn) {
      const db = Object.assign({}, this.db);
      fn(db);
      this.db = db;
      this.simpanLokal();
      this.emit();
    },
    /** Pasang/ganti satu rekaman. Mengembalikan fungsi undo yang tepat sasaran. */
    put(db, kind, rec) {
      const k = keyOf(kind), arr = db[kind].slice(), i = arr.findIndex(o => o[k] === rec[k]);
      const prev = i >= 0 ? arr[i] : null;
      if (i >= 0) arr[i] = rec; else arr.push(rec);
      db[kind] = arr;
      return d => { const a = d[kind].slice(), j = a.findIndex(o => o[k] === rec[k]); if (prev) { if (j >= 0) a[j] = prev; else a.push(prev); } else if (j >= 0) a.splice(j, 1); d[kind] = a; };
    },
    buang(db, kind, id) {
      const k = keyOf(kind), arr = db[kind].slice(), i = arr.findIndex(o => o[k] === id);
      if (i < 0) return () => {};
      const prev = arr.splice(i, 1)[0];
      db[kind] = arr;
      return d => { d[kind] = d[kind].concat([prev]); };
    },
    /** Hasil server menggantikan rekaman sementara (tmp-…). */
    pasangServer(db, kind, rec, tmpId) {
      const k = keyOf(kind);
      if (tmpId && tmpId !== rec[k]) { this.idMap[tmpId] = rec[k]; db[kind] = db[kind].filter(o => o[k] !== tmpId); }
      this.put(db, kind, rec);
    },
    gantiTmp(data) {
      const s = JSON.stringify(data || {});
      return /tmp-/.test(s) ? JSON.parse(s.replace(/tmp-[a-z0-9]+/g, m => this.idMap[m] || m)) : data;
    },

    // ---------------------------------------------------------------- mutasi optimistis
    /**
     * o = { action, data, optimis(db) → [undo...], terapkan(db, res), sunyi }
     * Mengembalikan Promise hasil server (reject bila ditolak).
     */
    mutasi(o) {
      let undo = [];
      if (o.optimis) this.ubah(db => { undo = [].concat(o.optimis(db) || []); });
      this.pending++;
      App.statusSinkron();
      const tugas = this._antre.then(async () => {
        try {
          const res = await Api.post(o.action, this.gantiTmp(o.data));
          this.ubah(db => {
            if (o.terapkan) o.terapkan(db, res);
            if (res.rev) {
              if (res.prev === db.rev || res.prev === res.rev) db.rev = res.rev;
              else this.perluSync = true;
            }
          });
          return res;
        } catch (e) {
          if (undo.length) this.ubah(db => undo.slice().reverse().forEach(u => u(db)));
          if (e.code !== 'AUTH') this.perluSync = true;
          throw e;
        } finally {
          this.pending--;
          App.statusSinkron();
          if (!this.pending && this.perluSync) setTimeout(() => this.sync(true).catch(() => {}), 50);
        }
      });
      this._antre = tugas.catch(() => {});
      return tugas;
    }
  };

  window.Store = Store;
})();
