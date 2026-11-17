/**
 * Perhitungan keuangan murni (tanpa DOM) — mengikuti aturan baku PRD 4.4 & 6E:
 *  - Hanya transaksi berstatus Tercatat yang dihitung.
 *  - Transfer & kontribusi target bukan pemasukan/pengeluaran.
 *  - Saldo(T) = Saldo_Awal (bila T ≥ Tanggal_Saldo_Awal) + Σ transaksi Tercatat dengan Tanggal ≤ T.
 *  - Tingkat tabungan = (Σ setor − Σ tarik kontribusi) ÷ pemasukan × 100; pemasukan 0 → "–".
 * Server memvalidasi & menyimpan; modul ini menghitung tampilan dari data server.
 */
(function (root) {
  const U = root.U || (typeof require !== 'undefined' ? require('./util.js') : null);
  const OK = 'Tercatat', DRAF = 'Menunggu Konfirmasi';
  const memo = new WeakMap();

  const C = {
    OK, DRAF,

    /** Indeks ter-memo per objek db (db diganti baru setiap ada perubahan). */
    idx(db) {
      let m = memo.get(db);
      if (m) return m;
      const map = (arr, k) => { const r = new Map(); (arr || []).forEach(o => r.set(o[k || 'ID'], o)); return r; };
      const ok = db.trx.filter(t => t.Status === OK).sort((a, b) => (a.Tanggal < b.Tanggal ? -1 : a.Tanggal > b.Tanggal ? 1 : 0));
      const status = new Map(db.trx.map(t => [t.ID_Transaksi, t.Status]));
      m = {
        dompet: map(db.dompet), kategori: map(db.kategori), target: map(db.target), tagihan: map(db.tagihan),
        trx: map(db.trx, 'ID_Transaksi'), ok, status,
        kontribusiAktif: (db.kontribusi || []).filter(k => status.get(k.ID_Transaksi_Terkait) === OK)
      };
      memo.set(db, m);
      return m;
    },

    delta(t, id) { return (t.Dompet_Tujuan_ID === id ? t.Nominal : 0) - (t.Dompet_Asal_ID === id ? t.Nominal : 0); },
    dompetAktif(db) { return (db.dompet || []).filter(d => d.Aktif === 'Ya').sort((a, b) => (a.Urutan - b.Urutan) || a.Nama.localeCompare(b.Nama)); },

    /** Saldo semua dompet sampai tanggal T (ymd). T kosong → seluruh transaksi Tercatat. */
    saldoSemua(db, T) {
      const ix = C.idx(db), per = {};
      (db.dompet || []).forEach(d => { per[d.ID] = (!T || (d.Tanggal_Saldo_Awal || '') <= T) ? d.Saldo_Awal : 0; });
      for (const t of ix.ok) {
        if (T && t.Tanggal.slice(0, 10) > T) break;
        if (t.Dompet_Asal_ID && per[t.Dompet_Asal_ID] !== undefined) per[t.Dompet_Asal_ID] -= t.Nominal;
        if (t.Dompet_Tujuan_ID && per[t.Dompet_Tujuan_ID] !== undefined) per[t.Dompet_Tujuan_ID] += t.Nominal;
      }
      let total = 0, likuid = 0, tabungan = 0;
      C.dompetAktif(db).forEach(d => {
        total += per[d.ID];
        if (d.Tipe === 'Tabungan') tabungan += per[d.ID]; else likuid += per[d.ID];
      });
      return { per, total, likuid, tabungan };
    },
    /** Saldo "saat ini" untuk periode: masa depan → seluruh transaksi; masa lalu → sampai akhir periode. */
    saldoPeriode(db, sampai) { return C.saldoSemua(db, sampai >= U.hariIni() ? '' : sampai); },

    // ------------------------------------------------------------- periode
    PERIODE: [
      ['bulan-ini', 'Bulan ini'], ['bulan-lalu', 'Bulan lalu'], ['3-bulan', '3 bulan terakhir'],
      ['6-bulan', '6 bulan terakhir'], ['tahun-ini', 'Tahun ini'], ['khusus', 'Rentang khusus']
    ],
    periode(key, khusus) {
      const h = U.hariIni(), ym = h.slice(0, 7), akhir = m => m + '-' + String(U.hariDalam(m)).padStart(2, '0');
      let dari, sampai, pDari, pSampai, label;
      const blok = n => { dari = U.tambahBulan(ym, -(n - 1)) + '-01'; sampai = akhir(ym); pDari = U.tambahBulan(ym, -(2 * n - 1)) + '-01'; pSampai = akhir(U.tambahBulan(ym, -n)); };
      switch (key) {
        case 'bulan-lalu': { const m = U.tambahBulan(ym, -1); dari = m + '-01'; sampai = akhir(m); pDari = U.tambahBulan(ym, -2) + '-01'; pSampai = akhir(U.tambahBulan(ym, -2)); label = U.bulanPanjang(m); break; }
        case '3-bulan': blok(3); label = '3 bulan terakhir'; break;
        case '6-bulan': blok(6); label = '6 bulan terakhir'; break;
        case 'tahun-ini': { const y = Number(h.slice(0, 4)); dari = y + '-01-01'; sampai = y + '-12-31'; pDari = (y - 1) + '-01-01'; pSampai = (y - 1) + '-12-31'; label = 'Tahun ' + y; break; }
        case 'khusus': {
          dari = (khusus && khusus.dari) || ym + '-01'; sampai = (khusus && khusus.sampai) || h;
          if (dari > sampai) { const x = dari; dari = sampai; sampai = x; }
          const n = U.selisihHari(dari, sampai) + 1;
          pSampai = U.tambahHari(dari, -1); pDari = U.tambahHari(pSampai, -(n - 1));
          label = U.tgl(dari) + ' – ' + U.tgl(sampai); break;
        }
        default: key = 'bulan-ini'; dari = ym + '-01'; sampai = akhir(ym); pDari = U.tambahBulan(ym, -1) + '-01'; pSampai = akhir(U.tambahBulan(ym, -1)); label = U.bulanPanjang(ym);
      }
      const nama = (C.PERIODE.find(p => p[0] === key) || C.PERIODE[0])[1];
      return { key, nama, label, dari, sampai, prev: { dari: pDari, sampai: pSampai }, bulan: C.daftarBulan(dari, sampai) };
    },
    daftarBulan(dari, sampai) {
      const out = []; let m = dari.slice(0, 7);
      while (m <= sampai.slice(0, 7) && out.length < 240) { out.push(m); m = U.tambahBulan(m, 1); }
      return out;
    },

    // ------------------------------------------------------------- ringkasan
    dalam(t, dari, sampai) { const d = t.Tanggal.slice(0, 10); return d >= dari && d <= sampai; },
    ringkas(db, dari, sampai) {
      const ix = C.idx(db);
      let masuk = 0, keluar = 0;
      const kat = {};
      for (const t of ix.ok) {
        const d = t.Tanggal.slice(0, 10);
        if (d < dari) continue;
        if (d > sampai) break;
        if (t.Jenis === 'Masuk') masuk += t.Nominal;
        else if (t.Jenis === 'Keluar') { keluar += t.Nominal; kat[t.Kategori_ID] = (kat[t.Kategori_ID] || 0) + t.Nominal; }
      }
      const tabungan = C.tabunganBersih(db, dari, sampai);
      const perKat = Object.keys(kat).map(id => ({ id, kat: ix.kategori.get(id) || { Nama: '(kategori terhapus)', Warna: 'abu', Ikon: 'tag' }, nominal: kat[id], persen: keluar ? kat[id] / keluar * 100 : 0 }))
        .sort((a, b) => b.nominal - a.nominal);
      return { masuk, keluar, net: masuk - keluar, perKat, tabungan, rate: C.rate(tabungan, masuk) };
    },
    tabunganBersih(db, dari, sampai) {
      return C.idx(db).kontribusiAktif.reduce((s, k) => {
        const d = k.Tanggal.slice(0, 10);
        return d >= dari && d <= sampai ? s + (k.Jenis === 'Tarik' ? -k.Nominal : k.Nominal) : s;
      }, 0);
    },
    rate(tab, masuk) { return masuk > 0 ? tab / masuk * 100 : null; },
    /** % perubahan; null bila pembanding 0. */
    ubah(kini, lalu) { return lalu ? (kini - lalu) / Math.abs(lalu) * 100 : (kini ? null : 0); },

    bulanan(db, bulan) {
      return bulan.map(m => {
        const r = C.ringkas(db, m + '-01', m + '-' + String(U.hariDalam(m)).padStart(2, '0'));
        return { bulan: m, masuk: r.masuk, keluar: r.keluar, net: r.net, tabungan: r.tabungan, rate: r.rate };
      });
    },
    mingguan(db, dari, sampai) {
      const out = [];
      let a = dari;
      while (a <= sampai && out.length < 60) {
        let b = U.tambahHari(a, 6); if (b > sampai) b = sampai;
        const r = C.ringkas(db, a, b);
        out.push({ dari: a, sampai: b, label: a.slice(5, 7) === b.slice(5, 7) ? Number(a.slice(8)) + '–' + U.tglPendek(b) : U.tglPendek(a) + '–' + U.tglPendek(b), masuk: r.masuk, keluar: r.keluar });
        a = U.tambahHari(b, 1);
      }
      return out;
    },

    // ------------------------------------------------------------- anggaran
    statusAnggaran(persen, ambang) { return persen > 100 ? 'lewat' : persen >= ambang ? 'hampir' : 'aman'; },
    anggaran(db, ym, ambang) {
      const ix = C.idx(db), r = C.ringkas(db, ym + '-01', ym + '-' + String(U.hariDalam(ym)).padStart(2, '0'));
      const pakai = {}; r.perKat.forEach(k => { pakai[k.id] = k.nominal; });
      return (db.anggaran || []).filter(a => a.Bulan === ym).map(a => {
        const p = pakai[a.Kategori_ID] || 0, persen = a.Batas ? p / a.Batas * 100 : 0;
        return { a, kat: ix.kategori.get(a.Kategori_ID) || { Nama: a.Kategori_ID, Warna: 'abu', Ikon: 'tag' }, pakai: p, batas: a.Batas, sisa: a.Batas - p, persen, status: C.statusAnggaran(persen, ambang) };
      }).sort((x, y) => y.persen - x.persen);
    },

    // ------------------------------------------------------------- target
    target(db, t) {
      const ix = C.idx(db);
      const semua = (db.kontribusi || []).filter(k => k.Target_ID === t.ID)
        .map(k => Object.assign({}, k, { _status: ix.status.get(k.ID_Transaksi_Terkait) || OK }))
        .sort((a, b) => (a.Tanggal < b.Tanggal ? 1 : -1));
      const terkumpul = semua.filter(k => k._status === OK).reduce((s, k) => s + (k.Jenis === 'Tarik' ? -k.Nominal : k.Nominal), 0);
      const persen = t.Nominal_Target ? terkumpul / t.Nominal_Target * 100 : 0;
      const sisa = Math.max(0, t.Nominal_Target - terkumpul);
      const h = U.hariIni();
      const hariLagi = t.Tenggat ? U.selisihHari(h, t.Tenggat) : null;
      const bulanLagi = hariLagi !== null && hariLagi > 0 ? Math.max(1, Math.ceil(hariLagi / 30.4)) : null;
      return { terkumpul, persen, sisa, hariLagi, perBulan: bulanLagi && sisa ? Math.ceil(sisa / bulanLagi) : 0, riwayat: semua, tercapai: persen >= 100 };
    },
    sisaWaktu(hari) {
      if (hari === null || hari === undefined) return 'tanpa tenggat';
      if (hari < 0) return 'lewat ' + (-hari) + ' hari';
      if (hari === 0) return 'hari ini';
      if (hari < 14) return hari + ' hari lagi';
      if (hari < 70) return Math.round(hari / 7) + ' minggu lagi';
      return Math.round(hari / 30.4) + ' bulan lagi';
    },

    // ------------------------------------------------------------- tagihan
    jatuhTempo(g, periode) {
      if (g.Pola === 'Sekali') return g.Hari_Jatuh_Tempo;
      const hari = Math.min(Math.max(1, Number(g.Hari_Jatuh_Tempo) || 1), U.hariDalam(periode));
      return periode + '-' + String(hari).padStart(2, '0');
    },
    /** Status tagihan untuk periode berjalan (atau periode yang punya draf menunggu). */
    tagihan(db, g) {
      const h = U.hariIni(), ix = C.idx(db);
      const periode = g.Pola === 'Sekali' ? g.Hari_Jatuh_Tempo : h.slice(0, 7);
      const key = g.ID + '@';
      const draf = db.trx.filter(t => t.Status === DRAF && (t.Ref_ID || '').indexOf(key) === 0).sort((a, b) => (a.Ref_ID < b.Ref_ID ? -1 : 1));
      let p = periode;
      if (draf.length) p = draf[0].Ref_ID.slice(key.length);
      const jatuh = C.jatuhTempo(g, p);
      const lunas = (g.Periode_Terakhir_Dibayar || '') >= p;
      const d = draf.find(t => t.Ref_ID === key + p) || null;
      let status = 'Terjadwal';
      if (g.Status !== 'Aktif') status = 'Nonaktif';
      else if (lunas) status = 'Lunas';
      else if (d) status = h > jatuh ? 'Terlewat' : 'Menunggu';
      else if (h > jatuh) status = 'Terlewat';
      const bayar = lunas ? db.trx.find(t => t.Ref_ID === key + p && t.Status === OK) : null;
      return { periode: p, jatuh, status, draf: d, bayar, sisaHari: U.selisihHari(h, jatuh), kat: ix.kategori.get(g.Kategori_ID), dompet: ix.dompet.get(g.Dompet_ID) };
    },

    // ------------------------------------------------------------- pola pengeluaran (B7)
    // Kalender satu bulan (pekan Senin–Minggu): bulan terakhir periode yang sudah berjalan.
    // minggu[baris][kolom] = { tgl, v } | null (tanggal bulan lain); luar = di luar rentang periode.
    heat(db, dari, sampai) {
      const h = U.hariIni(), ym = (sampai < h ? sampai : h < dari ? dari : h).slice(0, 7);
      const awal = (U.hariMinggu(ym + '-01') + 6) % 7, n = U.hariDalam(ym); // Senin = 0
      const per = {};
      for (const t of C.idx(db).ok) {
        const d = t.Tanggal.slice(0, 10);
        if (t.Jenis === 'Keluar' && d.startsWith(ym) && C.dalam(t, dari, sampai)) per[d] = (per[d] || 0) + t.Nominal;
      }
      const minggu = [];
      for (let i = 0; i < Math.ceil((awal + n) / 7) * 7; i++) {
        const k = i - awal + 1, tgl = k >= 1 && k <= n ? ym + '-' + String(k).padStart(2, '0') : null;
        if (i % 7 === 0) minggu.push([]);
        minggu[minggu.length - 1].push(tgl && (tgl < dari || tgl > sampai ? { tgl, v: 0, luar: true } : { tgl, v: per[tgl] || 0 }));
      }
      let puncak = null;
      Object.keys(per).forEach(tgl => { if (!puncak || per[tgl] > puncak.v) puncak = { tgl, v: per[tgl] }; });
      return { ym, minggu, max: puncak ? puncak.v : 0, puncak };
    },

    // ------------------------------------------------------------- riwayat saldo (B2)
    saldoHistori(db, dari, sampai) {
      const ix = C.idx(db), aktif = new Set(C.dompetAktif(db).map(d => d.ID));
      const ev = [];
      C.dompetAktif(db).forEach(d => ev.push([d.Tanggal_Saldo_Awal || '0000-00-00', d.Saldo_Awal]));
      ix.ok.forEach(t => {
        let v = 0;
        if (aktif.has(t.Dompet_Tujuan_ID)) v += t.Nominal;
        if (aktif.has(t.Dompet_Asal_ID)) v -= t.Nominal;
        if (v) ev.push([t.Tanggal.slice(0, 10), v]);
      });
      ev.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      const n = U.selisihHari(dari, sampai), langkah = n > 400 ? 7 : 1, akhir = sampai > U.hariIni() ? U.hariIni() : sampai;
      const out = [];
      let i = 0, s = 0;
      for (let d = dari; d <= akhir; d = U.tambahHari(d, langkah)) {
        while (i < ev.length && ev[i][0] <= d) s += ev[i++][1];
        out.push({ x: d, y: s });
      }
      if (out.length && out[out.length - 1].x !== akhir && akhir >= dari) {
        while (i < ev.length && ev[i][0] <= akhir) s += ev[i++][1];
        out.push({ x: akhir, y: s });
      }
      return out;
    },

    // ------------------------------------------------------------- insight (aturan, tanpa AI)
    /** rp = formatter Rupiah opsional (Dashboard memakainya untuk menyamarkan nominal). */
    insights(db, per, ambang, rp) {
      rp = rp || U.rp;
      const r = C.ringkas(db, per.dari, per.sampai), p = C.ringkas(db, per.prev.dari, per.prev.sampai);
      const out = [];
      const e = U.esc;
      const q = o => '#/riwayat?' + U.qs(Object.assign({ dari: per.dari, sampai: per.sampai }, o));
      if (r.perKat.length) {
        const k = r.perKat[0];
        out.push({ tipe: 'kategori', warna: k.kat.Warna, link: q({ jenis: 'Keluar', kat: k.id }),
          html: `<b>${e(k.kat.Nama)}</b> pengeluaran terbesar: <b class="num">${rp(k.nominal)}</b> (${U.persen(k.persen)} dari total).` });
      }
      if (r.keluar || p.keluar) {
        const sel = r.keluar - p.keluar, pc = C.ubah(r.keluar, p.keluar);
        const arah = sel <= 0 ? `<b class="t-ok">turun ${pc === null ? '' : U.persen(Math.abs(pc), 1)}</b> (hemat <b class="num">${rp(-sel)}</b>)`
          : `<b class="t-danger">naik ${pc === null ? '' : U.persen(pc, 1)}</b> (+<b class="num">${rp(sel)}</b>)`;
        out.push({ tipe: 'aruskas', warna: sel <= 0 ? 'hijau' : 'mawar', link: q({ jenis: 'Keluar' }), html: `Pengeluaran ${arah} dibanding periode sebelumnya.` });
      }
      if (r.masuk || r.keluar || p.masuk || p.keluar) {
        const sel = r.net - p.net;
        out.push({ tipe: 'aruskas', warna: r.net >= 0 ? 'hijau' : 'mawar', link: q({}),
          html: `Arus kas bersih <b class="num ${r.net >= 0 ? 't-ok' : 't-danger'}">${rp(r.net, { tanda: true })}</b>, ${sel >= 0 ? 'membaik' : 'menurun'} <b class="num">${rp(Math.abs(sel))}</b> dari periode sebelumnya.` });
      }
      const ym = per.sampai >= U.hariIni() ? U.hariIni().slice(0, 7) : per.sampai.slice(0, 7);
      C.anggaran(db, ym, ambang).filter(x => x.status !== 'aman').slice(0, 3).forEach(x => {
        out.push({ tipe: 'anggaran', warna: x.status === 'lewat' ? 'mawar' : 'amber', link: '#/anggaran?bulan=' + ym,
          html: x.status === 'lewat'
            ? `Anggaran <b>${e(x.kat.Nama)}</b> <b class="t-danger">terlampaui ${U.persen(x.persen)}</b> — lebih <b class="num">${rp(-x.sisa)}</b>.`
            : `Anggaran <b>${e(x.kat.Nama)}</b> sudah <b class="t-warn">${U.persen(x.persen)}</b> — hampir habis (sisa <span class="num">${rp(x.sisa)}</span>).` });
      });
      (db.target || []).filter(t => t.Status === 'Aktif').forEach(t => {
        const i = C.target(db, t);
        out.push({ tipe: 'target', warna: i.tercapai ? 'hijau' : 'oranye', link: '#/target?id=' + t.ID,
          html: i.tercapai ? `Target <b>${e(t.Nama)}</b> <b class="t-ok">tercapai ${U.persen(i.persen, 1)}</b>. Saatnya dirayakan!`
            : `Target <b>${e(t.Nama)}</b> ${U.persen(i.persen, 1)} tercapai — kurang <b class="num">${rp(i.sisa)}</b>, ${C.sisaWaktu(i.hariLagi)}.` });
      });
      return out;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.Calc = C;
})(typeof window !== 'undefined' ? window : globalThis);
