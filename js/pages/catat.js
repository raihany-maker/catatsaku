/* Form Catat / Ubah Transaksi (Masuk · Keluar · Transfer) — modal desktop, lembar penuh di ponsel. */
(function () {
  window.Pages = window.Pages || {};
  const e = U.esc;

  /** Kompres gambar struk (maks. 1600px, JPEG) agar unggah cepat. PDF dikirim apa adanya. */
  function bacaStruk(file) {
    return new Promise((res, rej) => {
      if (!file) return res(null);
      if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) return rej(new Error('Format struk harus JPG, PNG, WEBP, atau PDF.'));
      if (file.size > 5 * 1024 * 1024 && file.type === 'application/pdf') return rej(new Error('Ukuran PDF maksimal 5 MB.'));
      const r = new FileReader();
      r.onerror = () => rej(new Error('Berkas tidak bisa dibaca.'));
      if (file.type === 'application/pdf') {
        r.onload = () => res({ name: file.name, mime: file.type, b64: String(r.result).split(',')[1] });
        return r.readAsDataURL(file);
      }
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const s = Math.min(1, 1600 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res({ name: file.name.replace(/\.\w+$/, '') + '.jpg', mime: 'image/jpeg', b64: c.toDataURL('image/jpeg', 0.82).split(',')[1] });
        };
        img.onerror = () => rej(new Error('Gambar tidak valid.'));
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  const Catat = {
    bacaStruk,

    /**
     * o: { jenis, trx (ubah), draf (isi ulang setelah gagal), tanggal }
     */
    buka(o) {
      const db = Store.db;
      if (!db) return;
      const ix = Calc.idx(db);
      const t = o.trx || null;
      if (t && t.Sumber === 'Kontribusi') {
        UI.toast('Transaksi kontribusi diubah lewat halaman Target', { tipe: 'info' });
        return App.go('#/target?kontribusi=' + encodeURIComponent(t.Ref_ID));
      }
      const d = o.draf || {};
      const s = {
        jenis: (t && t.Jenis) || d.Jenis || o.jenis || 'Keluar',
        nominal: (t && t.Nominal) || d.Nominal || 0,
        kat: (t && t.Kategori_ID) || d.Kategori_ID || '',
        asal: (t && t.Dompet_Asal_ID) || d.Dompet_Asal_ID || '',
        tujuan: (t && t.Dompet_Tujuan_ID) || d.Dompet_Tujuan_ID || '',
        tanggal: (t && t.Tanggal) || d.Tanggal || o.tanggal || U.sekarang().iso,
        catatan: (t && t.Catatan) || d.Catatan || '',
        struk: null, hapusStruk: false
      };
      const dompetAktif = Calc.dompetAktif(db);
      if (!dompetAktif.length) {
        return UI.modal({ kelas: 'sm', judul: 'Belum ada dompet', label: 'Belum ada dompet', isi: '<p class="muted">Tambahkan minimal satu dompet (tunai, bank, atau e-wallet) sebelum mencatat transaksi.</p>', kaki: '<button class="btn btn-primary" data-ke type="button">Tambah dompet</button>', onBuka: (el, tutup) => { el.querySelector('[data-ke]').onclick = () => { tutup(); App.go('#/dompet?baru=1'); }; } });
      }
      if (!s.asal && !s.tujuan) { s.asal = dompetAktif[0].ID; s.tujuan = dompetAktif[0].ID; }
      if (s.jenis === 'Transfer' && s.asal === s.tujuan) s.tujuan = (dompetAktif.find(w => w.ID !== s.asal) || {}).ID || '';

      const judul = t ? `Ubah Transaksi <span class="badge accent">${e(t.ID_Transaksi.startsWith('tmp-') ? 'baru' : t.ID_Transaksi)}</span>` : '<span class="live-dot"></span> Catat Transaksi';
      const m = UI.modal({
        kelas: 'wide', label: t ? 'Ubah transaksi' : 'Catat transaksi', judul,
        sub: t ? (t.Status === Calc.DRAF ? 'Draf tagihan — belum memengaruhi saldo sampai dikonfirmasi.' : 'Perbarui catatan atau sesuaikan pos dana.') : 'Catat arus kas dalam hitungan detik.',
        isi: '<div data-form></div>',
        kaki: `${t ? `<button class="btn btn-danger" type="button" data-hapus>${UI.ic('trash', 'ic-sm')} Hapus</button><span class="spacer"></span>` : ''}
          <button class="btn btn-ghost" type="button" data-tutup>Batal</button>
          ${t ? '' : `<button class="btn btn-secondary" type="button" data-lagi>${UI.ic('refresh', 'ic-sm')} Simpan &amp; Catat Lagi</button>`}
          <button class="btn btn-primary" type="button" data-simpan>${UI.ic('check', 'ic-sm')} ${t ? 'Simpan Perubahan' : 'Simpan Transaksi'}</button>`,
        onBuka: (el, tutup) => {
          const form = el.querySelector('[data-form]');
          const gambar = () => { form.innerHTML = Catat.isi(s, t); pasang(); };
          const saldoKini = () => Calc.saldoSemua(Store.db).per;
          const segarSaldo = () => {
            const box = form.querySelector('[data-sisa]');
            if (!box) return;
            const id = s.jenis === 'Masuk' ? s.tujuan : s.asal, w = Calc.idx(Store.db).dompet.get(id);
            if (!w) { box.innerHTML = ''; return; }
            let sisa = saldoKini()[id] || 0;
            if (t && t.Status === Calc.OK) sisa -= Calc.delta(t, id);
            sisa += s.jenis === 'Masuk' ? s.nominal : -s.nominal;
            box.innerHTML = `<span class="muted">Saldo ${e(w.Nama)} setelah dicatat</span> <b class="num ${sisa < 0 ? 't-danger' : 't-ok'}">${U.rp(sisa)}</b>`;
          };
          const setNominal = v => {
            s.nominal = Math.max(0, Math.min(1e13, Math.round(v || 0)));
            const inp = form.querySelector('#nominal');
            inp.value = s.nominal ? U.angka(s.nominal) : '';
            form.querySelector('[data-terbilang]').textContent = U.terbilang(s.nominal);
            segarSaldo();
          };
          const pasang = () => {
            form.querySelectorAll('[data-jenis]').forEach(b => b.onclick = () => {
              s.jenis = b.dataset.jenis;
              const kats = Store.db.kategori.filter(k => k.Jenis === s.jenis && k.Aktif === 'Ya');
              if (s.jenis !== 'Transfer' && !kats.some(k => k.ID === s.kat)) s.kat = '';
              if (s.jenis === 'Transfer' && s.asal === s.tujuan) s.tujuan = (Calc.dompetAktif(Store.db).find(w => w.ID !== s.asal) || {}).ID || '';
              if (s.jenis === 'Masuk' && !s.tujuan) s.tujuan = s.asal;
              if (s.jenis === 'Keluar' && !s.asal) s.asal = s.tujuan;
              gambar();
            });
            const inp = form.querySelector('#nominal');
            inp.addEventListener('input', () => {
              const pos = inp.value.length - inp.selectionStart;
              setNominal(U.parseNominal(inp.value));
              const p = Math.max(0, inp.value.length - pos);
              try { inp.setSelectionRange(p, p); } catch (x) { /* abaikan */ }
            });
            form.querySelectorAll('[data-tambah]').forEach(b => b.onclick = () => setNominal(s.nominal + Number(b.dataset.tambah)));
            const rs = form.querySelector('[data-reset]'); if (rs) rs.onclick = () => setNominal(0);
            form.querySelectorAll('[data-kat]').forEach(b => b.onclick = () => { s.kat = b.dataset.kat; form.querySelectorAll('[data-kat]').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b); }); });
            form.querySelectorAll('[data-dompet]').forEach(b => b.onclick = () => {
              if (s.jenis === 'Masuk') s.tujuan = b.dataset.dompet; else s.asal = b.dataset.dompet;
              form.querySelectorAll('[data-dompet]').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b); });
              segarSaldo();
            });
            const sa = form.querySelector('#asal'), st = form.querySelector('#tujuan');
            if (sa) sa.onchange = () => { s.asal = sa.value; };
            if (st) st.onchange = () => { s.tujuan = st.value; };
            const tukar = form.querySelector('[data-tukar]');
            if (tukar) tukar.onclick = () => { const x = s.asal; s.asal = s.tujuan; s.tujuan = x; gambar(); };
            form.querySelector('#tanggal').onchange = ev => { s.tanggal = ev.target.value; };
            form.querySelector('#catatan').oninput = ev => { s.catatan = ev.target.value; };
            const file = form.querySelector('#struk');
            file.onchange = async () => {
              const info = form.querySelector('[data-struk-info]');
              try {
                s.struk = await bacaStruk(file.files[0]);
                info.innerHTML = s.struk ? `${UI.ic('paperclip', 'ic-sm')} ${e(file.files[0].name)} · siap diunggah` : '';
              } catch (x) { s.struk = null; file.value = ''; info.innerHTML = `<span class="t-danger">${e(x.message)}</span>`; }
            };
            const hs = form.querySelector('[data-hapus-struk]');
            if (hs) hs.onclick = () => { s.hapusStruk = true; hs.closest('.panel').remove(); };
            segarSaldo();
          };
          gambar();
          const simpan = lagi => {
            const err = Catat.validasi(s, t);
            const box = form.querySelector('[data-err]');
            if (err) { box.innerHTML = UI.ic('alert-circle', 'ic-sm') + ' ' + e(err); box.classList.remove('hidden'); box.scrollIntoView({ block: 'nearest' }); return; }
            Catat.simpan(s, t);
            if (lagi) {
              Object.assign(s, { nominal: 0, catatan: '', struk: null, tanggal: U.sekarang().iso });
              gambar();
              form.querySelector('#nominal').focus();
            } else tutup();
          };
          el.querySelector('[data-simpan]').onclick = () => simpan(false);
          const lg = el.querySelector('[data-lagi]'); if (lg) lg.onclick = () => simpan(true);
          const hp = el.querySelector('[data-hapus]'); if (hp) hp.onclick = async () => { if (await Aksi.hapusTrx(t)) tutup(); };
          el.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) simpan(false); });
        }
      });
      return m;
    },

    isi(s, t) {
      const db = Store.db, ix = Calc.idx(db), saldo = Calc.saldoSemua(db).per;
      const dompet = Calc.dompetAktif(db).slice();
      [s.asal, s.tujuan].forEach(id => { const w = ix.dompet.get(id); if (w && dompet.indexOf(w) < 0) dompet.push(w); });
      const kats = db.kategori.filter(k => k.Jenis === s.jenis && (k.Aktif === 'Ya' || k.ID === s.kat));
      const seg = [['Keluar', 'arrow-up-right'], ['Masuk', 'arrow-down-left'], ['Transfer', 'arrow-left-right']]
        .map(([j, i]) => `<button type="button" data-jenis="${j}" class="${s.jenis === j ? 'active' : ''}" aria-pressed="${s.jenis === j}">${UI.ic(i, 'ic-sm')} ${j}</button>`).join('');
      const pilihDompet = s.jenis === 'Masuk' ? s.tujuan : s.asal;
      const opsi = sel => dompet.map(w => `<option value="${w.ID}" ${w.ID === sel ? 'selected' : ''}>${e(w.Nama)} · ${U.rp(saldo[w.ID] || 0)}</option>`).join('');
      return `
        <div class="seg block lg" role="group" aria-label="Jenis transaksi">${seg}</div>
        ${s.jenis === 'Transfer' ? `<div class="note info mt-16">${UI.ic('info', 'ic-sm')}<span><b>Transfer netral:</b> pindah dana antar-dompet, tidak dihitung pemasukan maupun pengeluaran.</span></div>` : ''}
        <div class="money-box mt-16">
          <div class="row-between"><label class="eyebrow" for="nominal">Nominal ${s.jenis === 'Transfer' ? 'yang dipindahkan' : 'transaksi'} (wajib)</label><span class="badge accent">IDR · Rupiah</span></div>
          <div class="money mt-8"><span class="cur">Rp</span><input id="nominal" inputmode="numeric" autocomplete="off" placeholder="0" value="${s.nominal ? U.angka(s.nominal) : ''}" aria-describedby="terbilang" ${t ? '' : 'autofocus'}></div>
          <div class="terbilang" id="terbilang" data-terbilang>${U.terbilang(s.nominal)}</div>
          <div class="quick"><span class="faint" style="font-size:13px">Cepat:</span>${[10000, 50000, 100000, 500000].map(v => `<button type="button" data-tambah="${v}">+${v >= 1e6 ? v / 1e6 + 'jt' : v / 1000 + 'rb'}</button>`).join('')}
            <button type="button" data-reset class="btn-ghost" style="border-color:transparent">Reset</button></div>
        </div>
        ${s.jenis === 'Transfer' ? `
          <div class="g mt-16" style="grid-template-columns:1fr auto 1fr;align-items:end;gap:12px">
            <div class="field"><label class="label" for="asal">Dari dompet</label><select class="select" id="asal">${opsi(s.asal)}</select></div>
            <button class="btn btn-secondary btn-icon" type="button" data-tukar aria-label="Tukar dompet asal dan tujuan" style="margin-bottom:2px">${UI.ic('arrow-left-right', 'ic-sm')}</button>
            <div class="field"><label class="label" for="tujuan">Ke dompet</label><select class="select" id="tujuan">${opsi(s.tujuan)}</select></div>
          </div>` : `
          <div class="label mt-24">Pilih kategori (wajib) <small>${s.jenis === 'Masuk' ? 'Sumber pemasukan' : 'Pos pengeluaran'}</small></div>
          <div class="pick-grid mt-8" role="group" aria-label="Kategori">${kats.map(k => `<button type="button" class="pick ${k.ID === s.kat ? 'active' : ''}" aria-pressed="${k.ID === s.kat}" data-kat="${k.ID}">${UI.tileKat(k, 'sm')}<span class="nm">${e(k.Nama)}</span></button>`).join('') ||
            '<p class="muted">Belum ada kategori aktif. Tambahkan di Pengaturan → Keuangan.</p>'}</div>
          <div class="label mt-24">Sumber dana / dompet (wajib) <small>${dompet.length} akun</small></div>
          <div class="wallet-grid mt-8" role="group" aria-label="Dompet">${dompet.map(w => `<button type="button" class="pick wallet-pick ${w.ID === pilihDompet ? 'active' : ''}" aria-pressed="${w.ID === pilihDompet}" data-dompet="${w.ID}">
              <span class="row" style="gap:8px">${UI.tileDompet(w, 'sm')}<span class="badge">${e(w.Tipe)}</span></span><span class="nm">${e(w.Nama)}</span><span class="sub">${U.rp(saldo[w.ID] || 0)}</span><span class="chk">${UI.ic('check', 'ic-xs')}</span></button>`).join('')}</div>
          <div class="mt-12" style="font-size:13.5px" data-sisa></div>`}
        <div class="g g-2 mt-24">
          <div class="field"><label class="label" for="tanggal">Tanggal &amp; waktu <small>WITA</small></label><input class="input" type="datetime-local" id="tanggal" value="${e(s.tanggal)}" max="2100-12-31T23:59"></div>
          <div class="field"><label class="label" for="catatan">Catatan <small>opsional</small></label><input class="input" id="catatan" maxlength="300" placeholder="cth: Makan siang Nasi Padang" value="${e(s.catatan)}"></div>
        </div>
        ${t && t.URL_Struk && !s.hapusStruk ? `<div class="panel mt-16 row-between"><a href="${e(t.URL_Struk)}" target="_blank" rel="noopener" class="row">${UI.ic('paperclip', 'ic-sm')} Lihat struk tersimpan ${UI.ic('external-link', 'ic-xs')}</a><button class="btn btn-ghost btn-sm" type="button" data-hapus-struk>Lepas</button></div>` : ''}
        <label class="panel row mt-16" style="border-style:dashed;cursor:pointer">
          <span class="tile c-oranye">${UI.ic('camera')}</span>
          <span class="grow"><b>Lampirkan struk / bukti</b> <span class="badge">Drive</span><br><span class="muted" style="font-size:12.5px">JPG/PNG/PDF maks. 5 MB · tersimpan privat di Google Drive Anda</span><br><span style="font-size:12.5px" data-struk-info></span></span>
          <span class="btn btn-secondary btn-sm">Pilih berkas</span>
          <input type="file" id="struk" accept="image/jpeg,image/png,image/webp,application/pdf" class="sr-only">
        </label>
        <div class="err mt-16 hidden" data-err role="alert"></div>`;
    },

    /** Validasi klien (cermin aturan server) agar umpan balik instan. */
    validasi(s, t) {
      const db = Store.db, ix = Calc.idx(db);
      if (!s.nominal || s.nominal <= 0) return 'Nominal harus lebih dari 0.';
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s.tanggal)) return 'Tanggal & waktu wajib diisi.';
      if (s.jenis === 'Transfer') {
        if (!s.asal || !s.tujuan) return 'Pilih dompet asal dan tujuan.';
        if (s.asal === s.tujuan) return 'Dompet asal dan tujuan tidak boleh sama.';
      } else {
        if (!s.kat || !ix.kategori.get(s.kat)) return 'Pilih kategori.';
        if (s.jenis === 'Keluar' && !s.asal) return 'Pilih dompet.';
        if (s.jenis === 'Masuk' && !s.tujuan) return 'Pilih dompet.';
      }
      const tercatat = !t || t.Status === Calc.OK;
      if (tercatat && db.pengaturan.izinkan_saldo_minus !== 'Ya' && s.jenis !== 'Masuk') {
        const per = Calc.saldoSemua(db).per;
        let sisa = per[s.asal] || 0;
        if (t && t.Status === Calc.OK) sisa -= Calc.delta(t, s.asal);
        sisa -= s.nominal;
        if (sisa < 0 && sisa < (per[s.asal] || 0)) return `Saldo ${ix.dompet.get(s.asal).Nama} tidak cukup (sisa ${U.rp(per[s.asal] || 0)}).`;
      }
      return '';
    },

    /** Simpan optimistis — modal langsung tertutup, server memvalidasi di belakang. */
    simpan(s, t) {
      const now = U.sekarang().iso;
      const data = {
        ID_Transaksi: t ? t.ID_Transaksi : undefined, Jenis: s.jenis, Tanggal: s.tanggal, Nominal: s.nominal,
        Kategori_ID: s.jenis === 'Transfer' ? '' : s.kat,
        Dompet_Asal_ID: s.jenis === 'Masuk' ? '' : s.asal,
        Dompet_Tujuan_ID: s.jenis === 'Keluar' ? '' : s.tujuan,
        Catatan: s.catatan.trim(), struk: s.struk || undefined, hapusStruk: s.hapusStruk || undefined
      };
      const rec = Object.assign({}, t || {}, data, {
        ID_Transaksi: t ? t.ID_Transaksi : U.tmpId(), Status: t ? t.Status : Calc.OK, Sumber: t ? t.Sumber : 'Manual',
        Ref_ID: t ? t.Ref_ID : '', URL_Struk: s.hapusStruk ? '' : (t ? t.URL_Struk : ''), Dibuat_Pada: t ? t.Dibuat_Pada : now, Diubah_Pada: now
      });
      delete rec.struk; delete rec.hapusStruk;
      const ix = Calc.idx(Store.db);
      const w = ix.dompet.get(s.jenis === 'Masuk' ? s.tujuan : s.asal);
      Store.mutasi({
        action: 'trxSimpan', data,
        optimis: db => Store.put(db, 'trx', rec),
        terapkan: (db, res) => Store.pasangServer(db, 'trx', res.trx, rec.ID_Transaksi)
      }).then(res => {
        if (res.peringatan) UI.toast('Tersimpan dengan catatan', { tipe: 'warn', sub: res.peringatan, ms: 7000 });
      }).catch(err => {
        if (err.code === 'AUTH') return;
        UI.toast('Transaksi tidak tersimpan', { tipe: 'error', sub: err.message, aksi: { label: 'Buka lagi', fn: () => Catat.buka({ draf: Object.assign({}, data), trx: t }) } });
      });
      if (!t && s.jenis === 'Masuk' && (Store.db.alokasi || []).length) setTimeout(() => Catat.saranAlokasi(s.nominal, s.tujuan), 350);
      const saldo = w ? Calc.saldoSemua(Store.db).per[w.ID] : null;
      UI.toast(`Transaksi ${U.rp(s.nominal)} ${t ? 'diperbarui' : 'dicatat'}`, {
        sub: w && s.jenis !== 'Transfer' ? `Saldo ${w.Nama}: ${U.rp(saldo)}` : (s.jenis === 'Transfer' ? 'Transfer antar-dompet tercatat' : ''),
        aksi: t ? null : { label: 'Urungkan', fn: () => Aksi.hapusTrx(Store.db.trx.find(x => x.ID_Transaksi === rec.ID_Transaksi || x.ID_Transaksi === Store.idMap[rec.ID_Transaksi]), true) }
      });
    }
  };

  /** F-17: setelah mencatat pemasukan, tawarkan pembagian ke pos alokasi (transfer antar-dompet). */
  Catat.saranAlokasi = function (nominal, dompetMasuk) {
    const ix = Calc.idx(Store.db);
    const pos = Store.db.alokasi.map(a => ({ a, v: Math.floor(nominal * a.Persen / 100), w: ix.dompet.get(a.Dompet_ID) })).filter(x => x.w && x.v > 0);
    const pindah = pos.filter(x => x.w.ID !== dompetMasuk && x.w.Aktif === 'Ya');
    UI.modal({
      kelas: 'sm', label: 'Saran alokasi', eyebrow: `${UI.ic('split', 'ic-xs')} Alokasi pemasukan`, judul: 'Bagi pemasukan ' + U.rp(nominal) + '?',
      isi: `<div class="list">${pos.map(x => `<div class="item"><span class="badge accent">${x.a.Persen}%</span><div class="meta"><div class="ttl" style="font-size:14.5px">${e(x.a.Pos)}</div><div class="sub">→ ${e(x.w.Nama)}${x.w.ID === dompetMasuk ? ' (tetap di dompet ini)' : ''}</div></div><b class="num">${U.rp(x.v)}</b></div>`).join('')}</div>
        <p class="muted mt-12" style="font-size:13px">${pindah.length ? `Akan dibuat <b>${pindah.length} transfer</b> dari ${e((ix.dompet.get(dompetMasuk) || {}).Nama || '')}. Transfer tidak dihitung sebagai pengeluaran.` : 'Semua pos berada di dompet yang sama — tidak perlu transfer.'}</p>`,
      kaki: `<button class="btn btn-ghost" type="button" data-tutup>Nanti saja</button>${pindah.length ? `<button class="btn btn-primary" type="button" data-ok>${UI.ic('arrow-left-right', 'ic-sm')} Buat ${pindah.length} transfer</button>` : ''}`,
      onBuka: (el, tutup) => {
        const ok = el.querySelector('[data-ok]');
        if (!ok) return;
        ok.onclick = () => {
          const tgl = U.sekarang().iso;
          pindah.forEach(x => Catat.simpan({ jenis: 'Transfer', nominal: x.v, asal: dompetMasuk, tujuan: x.w.ID, kat: '', tanggal: tgl, catatan: 'Alokasi ' + x.a.Pos, struk: null, hapusStruk: false }, null));
          tutup();
        };
      }
    });
  };

  window.Pages._catat = Catat;
})();
