/* Riwayat Transaksi (F-05): cari, filter (tanggal, kategori, jenis, dompet, status), ubah, hapus, urungkan, ekspor CSV. */
(function () {
  window.Pages = window.Pages || {};
  const e = U.esc;
  const PER_HAL = 40;
  let f = {}, batas = PER_HAL;

  function dariParams(p) {
    return { q: p.q || '', dari: p.dari || '', sampai: p.sampai || '', jenis: p.jenis || '', kat: p.kat || '', dompet: p.dompet || '', status: p.status || '' };
  }
  function keUrl() {
    const q = U.qs(f);
    history.replaceState(null, '', '#/riwayat' + (q ? '?' + q : ''));
  }
  function saring(db) {
    const ix = Calc.idx(db), q = f.q.trim().toLowerCase(), qAngka = q.replace(/\D/g, '');
    return db.trx.filter(t => {
      const d = t.Tanggal.slice(0, 10);
      if (f.dari && d < f.dari) return false;
      if (f.sampai && d > f.sampai) return false;
      if (f.jenis && t.Jenis !== f.jenis) return false;
      if (f.kat && t.Kategori_ID !== f.kat) return false;
      if (f.dompet && t.Dompet_Asal_ID !== f.dompet && t.Dompet_Tujuan_ID !== f.dompet) return false;
      if (f.status && t.Status !== f.status) return false;
      if (q) {
        const k = ix.kategori.get(t.Kategori_ID), a = ix.dompet.get(t.Dompet_Asal_ID), b = ix.dompet.get(t.Dompet_Tujuan_ID);
        const teks = [t.Catatan, t.ID_Transaksi, k && k.Nama, a && a.Nama, b && b.Nama, t.Jenis].join(' ').toLowerCase();
        if (teks.indexOf(q) < 0 && !(qAngka && String(t.Nominal).indexOf(qAngka) >= 0)) return false;
      }
      return true;
    }).sort((a, b) => (a.Tanggal < b.Tanggal ? 1 : a.Tanggal > b.Tanggal ? -1 : (a.Dibuat_Pada < b.Dibuat_Pada ? 1 : -1)));
  }

  const R = {
    judul: 'Riwayat',
    render(p) {
      f = dariParams(p);
      batas = PER_HAL;
      const db = Store.db, opsi = (arr, sel) => arr.map(([v, l]) => `<option value="${e(v)}" ${v === sel ? 'selected' : ''}>${e(l)}</option>`).join('');
      const kats = db.kategori.slice().sort((a, b) => a.Jenis.localeCompare(b.Jenis) || a.Nama.localeCompare(b.Nama));
      return `
        <div class="page-head">
          <div><div class="crumb">Buku kas <span>›</span> Riwayat transaksi</div><h1 class="page-title">Riwayat Transaksi</h1>
            <p class="page-sub">Log mutasi buku kas dengan pencarian & filter. Klik transaksi untuk mengubah.</p></div>
          <div class="page-actions"><button class="btn btn-secondary" type="button" data-csv>${UI.ic('download', 'ic-sm')} Ekspor CSV</button>
            <button class="btn btn-primary" type="button" data-catat>${UI.ic('plus', 'ic-sm')} Catat Transaksi</button></div>
        </div>
        <div data-ringkas></div>
        <section class="card tight mt-24" aria-label="Filter">
          <div class="filterbar">
            <label class="input-icon"><span class="sr-only">Cari</span>${UI.ic('search')}<input class="input" type="search" data-f="q" placeholder="Cari catatan, kategori, dompet, nominal…" value="${e(f.q)}" ${p.fokus ? 'autofocus' : ''}></label>
            <select class="select" data-periode aria-label="Periode">${opsi([['', 'Semua waktu'], ['bulan-ini', 'Bulan ini'], ['bulan-lalu', 'Bulan lalu'], ['3-bulan', '3 bulan terakhir'], ['tahun-ini', 'Tahun ini'], ['khusus', f.dari ? `${U.tglPendek(f.dari)} – ${U.tglPendek(f.sampai || U.hariIni())}` : 'Rentang khusus…']], f.dari ? 'khusus' : '')}</select>
            <select class="select" data-f="jenis" aria-label="Jenis">${opsi([['', 'Jenis: Semua'], ['Masuk', 'Pemasukan'], ['Keluar', 'Pengeluaran'], ['Transfer', 'Transfer']], f.jenis)}</select>
            <select class="select" data-f="kat" aria-label="Kategori"><option value="">Kategori: Semua</option>${kats.map(k => `<option value="${k.ID}" ${k.ID === f.kat ? 'selected' : ''}>${e(k.Nama)} (${k.Jenis})</option>`).join('')}</select>
            <select class="select" data-f="dompet" aria-label="Dompet"><option value="">Dompet: Semua</option>${db.dompet.map(w => `<option value="${w.ID}" ${w.ID === f.dompet ? 'selected' : ''}>${e(w.Nama)}</option>`).join('')}</select>
            <select class="select" data-f="status" aria-label="Status">${opsi([['', 'Status: Semua'], ['Tercatat', 'Tercatat'], ['Menunggu Konfirmasi', 'Menunggu Konfirmasi'], ['Dihapus', 'Dihapus']], f.status)}</select>
          </div>
          <div data-aktif></div>
        </section>
        <div data-hasil class="mt-16"></div>`;
    },

    hasil() {
      const db = Store.db, ix = Calc.idx(db), rows = saring(db);
      let masuk = 0, keluar = 0;
      rows.forEach(t => { if (t.Status !== Calc.OK) return; if (t.Jenis === 'Masuk') masuk += t.Nominal; else if (t.Jenis === 'Keluar') keluar += t.Nominal; });
      const ringkas = `<div class="g g-4">
        <div class="card tight"><div class="row-between"><span class="eyebrow">Pemasukan</span><span class="t-ok">${UI.ic('arrow-down-left', 'ic-sm')}</span></div><div class="kpi-value md num">${U.rp(masuk)}</div></div>
        <div class="card tight"><div class="row-between"><span class="eyebrow">Pengeluaran</span><span class="t-accent">${UI.ic('arrow-up-right', 'ic-sm')}</span></div><div class="kpi-value md num">${U.rp(keluar)}</div></div>
        <div class="card tight"><div class="row-between"><span class="eyebrow">Arus kas bersih</span></div><div class="kpi-value md num ${masuk - keluar >= 0 ? 't-ok' : 't-danger'}">${U.rp(masuk - keluar, { tanda: true })}</div></div>
        <div class="card tight note" style="background:var(--surface)">${UI.ic('info', 'ic-sm t-accent')}<span>Transfer & kontribusi tabungan tidak dihitung sebagai pemasukan atau pengeluaran. Hanya status <b>Tercatat</b> yang dijumlah.</span></div></div>`;

      const label = { q: 'Cari', jenis: 'Jenis', kat: 'Kategori', dompet: 'Dompet', status: 'Status' };
      const nilai = (k, v) => k === 'kat' ? (ix.kategori.get(v) || {}).Nama || v : k === 'dompet' ? (ix.dompet.get(v) || {}).Nama || v : v;
      const tags = Object.keys(label).filter(k => f[k]).map(k => `<span class="ftag">${label[k]}: ${e(nilai(k, f[k]))}<button type="button" data-x="${k}" aria-label="Hapus filter ${label[k]}">${UI.ic('x', 'ic-xs')}</button></span>`);
      if (f.dari || f.sampai) tags.push(`<span class="ftag">Periode: ${U.tglPendek(f.dari || '2000-01-01')} – ${U.tglPendek(f.sampai || U.hariIni())}<button type="button" data-x="periode" aria-label="Hapus filter periode">${UI.ic('x', 'ic-xs')}</button></span>`);
      const aktif = tags.length ? `<div class="row-between mt-12" style="flex-wrap:wrap"><div class="wrap-gap" style="align-items:center"><span class="faint" style="font-size:12.5px">Filter aktif:</span>${tags.join('')}</div><button class="btn btn-ghost btn-sm" type="button" data-reset>${UI.ic('refresh', 'ic-xs')} Reset filter</button></div>` : '';

      let list = '';
      if (!rows.length) {
        list = `<div class="card">${UI.kosong('search', db.trx.length ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi', db.trx.length ? 'Ubah kata kunci atau filter.' : 'Mulai catat pemasukan & pengeluaran Anda.', `<button class="btn btn-primary btn-sm mt-8" type="button" data-catat2>${UI.ic('plus', 'ic-sm')} Catat transaksi</button>`)}</div>`;
      } else {
        const tampil = rows.slice(0, batas);
        const grup = [];
        tampil.forEach(t => { const d = t.Tanggal.slice(0, 10); const g = grup[grup.length - 1]; if (g && g.d === d) g.t.push(t); else grup.push({ d, t: [t] }); });
        list = grup.map(g => {
          const net = g.t.reduce((s, t) => s + (t.Status !== Calc.OK ? 0 : t.Jenis === 'Masuk' ? t.Nominal : t.Jenis === 'Keluar' ? -t.Nominal : 0), 0);
          return `<div class="day-head"><div class="d"><span class="live-dot" style="${g.d === U.hariIni() ? '' : 'background:var(--faint);box-shadow:none'}"></span>${U.labelHari(g.d)} <span class="faint" style="font:500 12.5px var(--font-body)">${g.t.length} transaksi</span></div>
            <div class="net">Net: <b class="num ${net >= 0 ? 't-ok' : ''}">${U.rp(net, { tanda: true })}</b></div></div>
            <div class="ledger-card list">${g.t.map(t => R.item(t, ix)).join('')}</div>`;
        }).join('');
        list += `<div class="row-between mt-24" style="flex-wrap:wrap"><span class="muted" style="font-size:14px">Menampilkan <b>${tampil.length}</b> dari <b>${rows.length}</b> transaksi</span>
          ${rows.length > batas ? `<button class="btn btn-secondary" type="button" data-lagi>${UI.ic('chevron-down', 'ic-sm')} Muat lebih banyak</button>` : ''}</div>`;
      }
      return { ringkas, aktif, list };
    },

    item(t, ix) {
      const k = ix.kategori.get(t.Kategori_ID), a = ix.dompet.get(t.Dompet_Asal_ID), b = ix.dompet.get(t.Dompet_Tujuan_ID);
      const tf = t.Jenis === 'Transfer';
      const judul = t.Catatan || (tf ? `${(a || {}).Nama || '?'} → ${(b || {}).Nama || '?'}` : (k ? k.Nama : t.Jenis));
      const dompet = tf ? `${e((a || {}).Nama || '?')} → ${e((b || {}).Nama || '?')}` : e(((t.Jenis === 'Masuk' ? b : a) || {}).Nama || '?');
      const kelas = t.Jenis === 'Masuk' ? 'in' : t.Jenis === 'Keluar' ? 'out' : 'tr';
      const nilai = t.Jenis === 'Masuk' ? U.rp(t.Nominal, { tanda: true }) : t.Jenis === 'Keluar' ? U.rp(-t.Nominal) : U.rp(t.Nominal);
      const hapus = t.Status === 'Dihapus', draf = t.Status === Calc.DRAF, tmp = String(t.ID_Transaksi).startsWith('tmp-');
      const jenisBadge = tf ? UI.badge(t.Sumber === 'Kontribusi' ? 'Kontribusi target' : 'Transfer netral', t.Sumber === 'Kontribusi' ? 'ok' : 'info') : UI.badge(t.Jenis === 'Masuk' ? 'Masuk' : 'Keluar', t.Jenis === 'Masuk' ? 'ok' : 'accent');
      return `<div class="item clickable ${hapus ? 'deleted' : ''} ${tmp ? 'pending-sync' : ''}" data-trx="${e(t.ID_Transaksi)}" role="button" tabindex="0">
        ${UI.tileTrx(t, ix)}
        <div class="meta"><div class="ttl">${e(judul)}</div>
          <div class="sub"><span class="num">${t.Tanggal.slice(11, 16)}</span><span class="sep"></span><span class="code hide-m">${tmp ? 'menyinkronkan…' : e(t.ID_Transaksi)}</span><span class="sep hide-m"></span>${!tf && k ? `<b>${e(k.Nama)}</b><span class="sep"></span>` : ''}<span>${dompet}</span></div>
          <div class="wrap-gap mt-8">${jenisBadge}${UI.statusTrx(t)}${t.URL_Struk ? `<a class="badge" href="${e(t.URL_Struk)}" target="_blank" rel="noopener" data-stop>${UI.ic('paperclip', 'ic-xs')} Struk</a>` : ''}</div></div>
        <div class="amt ${kelas}">${nilai}
          ${draf ? `<small><button class="btn btn-primary btn-xs" type="button" data-bayar>${UI.ic('check', 'ic-xs')} Konfirmasi</button></small>`
            : hapus ? `<small><button class="btn btn-secondary btn-xs" type="button" data-pulih>${UI.ic('undo', 'ic-xs')} Pulihkan</button></small>` : `<small>${tf ? 'Mutasi internal' : dompet}</small>`}</div>
      </div>`;
    },

    gambarHasil(el) {
      const h = R.hasil();
      el.querySelector('[data-ringkas]').innerHTML = h.ringkas;
      el.querySelector('[data-aktif]').innerHTML = h.aktif;
      el.querySelector('[data-hasil]').innerHTML = h.list;
    },
    perbarui(view) {
      if (!view.querySelector('[data-hasil]')) return false;
      R.gambarHasil(view);
      return true;
    },

    pasang(el, p) {
      R.gambarHasil(el);
      if (p && p.fokus) setTimeout(() => el.querySelector('[data-f="q"]').focus(), 30);
      const ubah = () => { batas = PER_HAL; keUrl(); R.gambarHasil(el); };
      const cari = U.debounce(v => { f.q = v; ubah(); }, 160);
      el.querySelector('[data-f="q"]').addEventListener('input', ev => cari(ev.target.value));
      el.querySelectorAll('select[data-f]').forEach(s => s.onchange = () => { f[s.dataset.f] = s.value; ubah(); });
      el.querySelector('[data-periode]').onchange = ev => {
        const v = ev.target.value;
        if (v === 'khusus') {
          UI.modal({
            kelas: 'sm', judul: 'Rentang tanggal', label: 'Rentang tanggal',
            isi: `<div class="g g-2"><div class="field"><label class="label" for="r-dari">Dari</label><input class="input" type="date" id="r-dari" value="${f.dari || U.hariIni().slice(0, 8) + '01'}"></div><div class="field"><label class="label" for="r-sampai">Sampai</label><input class="input" type="date" id="r-sampai" value="${f.sampai || U.hariIni()}"></div></div>`,
            kaki: '<button class="btn btn-secondary" data-tutup type="button">Batal</button><button class="btn btn-primary" data-ok type="button">Terapkan</button>',
            onBuka: (m, tutup) => { m.querySelector('[data-ok]').onclick = () => { f.dari = m.querySelector('#r-dari').value; f.sampai = m.querySelector('#r-sampai').value; tutup(); keUrl(); App.rute(); }; }
          });
          return;
        }
        if (!v) { f.dari = ''; f.sampai = ''; } else { const p = Calc.periode(v); f.dari = p.dari; f.sampai = p.sampai; }
        ubah();
      };
      el.querySelector('[data-catat]').onclick = () => App.catat();
      el.querySelector('[data-csv]').onclick = () => R.csv();
      el.addEventListener('click', ev => {
        if (ev.target.closest('[data-stop]')) return;
        const x = ev.target.closest('[data-x]');
        if (x) { if (x.dataset.x === 'periode') { f.dari = ''; f.sampai = ''; } else f[x.dataset.x] = ''; keUrl(); return App.rute(); }
        if (ev.target.closest('[data-reset]')) { f = dariParams({}); keUrl(); return App.rute(); }
        if (ev.target.closest('[data-lagi]')) { batas += PER_HAL * 2; return R.gambarHasil(el); }
        if (ev.target.closest('[data-catat2]')) return App.catat();
        const row = ev.target.closest('[data-trx]');
        if (!row) return;
        const t = Calc.idx(Store.db).trx.get(row.dataset.trx);
        if (!t) return;
        if (ev.target.closest('[data-pulih]')) return Aksi.pulihkan(t, Calc.OK);
        if (ev.target.closest('[data-bayar]') || t.Status === Calc.DRAF) {
          const [gid, periode] = String(t.Ref_ID).split('@'), g = Calc.idx(Store.db).tagihan.get(gid);
          if (g && ev.target.closest('[data-bayar]')) return Aksi.bayarTagihan(g, periode, t);
        }
        if (t.Status === 'Dihapus') return UI.toast('Transaksi ini sudah dihapus', { tipe: 'info', sub: 'Pulihkan dulu untuk mengubahnya.', aksi: { label: 'Pulihkan', fn: () => Aksi.pulihkan(t, Calc.OK) } });
        App.catat({ trx: t });
      });
      el.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.matches('[data-trx]')) ev.target.click(); });
    },

    csv() {
      const db = Store.db, ix = Calc.idx(db), rows = saring(db);
      const nm = id => ((ix.dompet.get(id) || {}).Nama || '');
      const q = v => '"' + String(v === undefined ? '' : v).replace(/"/g, '""') + '"';
      const isi = [['Tanggal', 'Jenis', 'Kategori', 'Dari', 'Ke', 'Nominal', 'Catatan', 'Status', 'Sumber', 'ID']]
        .concat(rows.map(t => [t.Tanggal.replace('T', ' '), t.Jenis, (ix.kategori.get(t.Kategori_ID) || {}).Nama || '', nm(t.Dompet_Asal_ID), nm(t.Dompet_Tujuan_ID), t.Nominal, t.Catatan, t.Status, t.Sumber, t.ID_Transaksi]))
        .map(r => r.map(q).join(',')).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + isi], { type: 'text/csv;charset=utf-8' }));
      a.download = 'catatsaku-riwayat-' + U.hariIni() + '.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      UI.toast(`${rows.length} transaksi diekspor ke CSV`);
    }
  };

  window.Pages.riwayat = R;
})();
