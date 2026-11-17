/* Dompet & Sumber Dana (F-02): kartu per dompet, saldo dihitung, tambah/ubah/nonaktifkan. */
(function () {
  window.Pages = window.Pages || {};
  const e = U.esc;
  const TIPE = [['Bank', 'landmark'], ['E-Wallet', 'smartphone'], ['Tunai', 'banknote'], ['Tabungan', 'piggy-bank']];
  let filter = '', bukaNonaktif = false;

  const D = {
    judul: 'Dompet',
    render(p) {
      const db = Store.db, ix = Calc.idx(db), s = Calc.saldoSemua(db);
      if (p.tipe) filter = p.tipe;
      const aktif = Calc.dompetAktif(db), non = db.dompet.filter(w => w.Aktif !== 'Ya');
      const pct = v => (s.total > 0 ? v / s.total * 100 : 0);
      const ym = U.hariIni().slice(0, 7);
      const mutasi = {};
      ix.ok.forEach(t => {
        if (t.Tanggal.slice(0, 7) !== ym) return;
        if (t.Dompet_Tujuan_ID) (mutasi[t.Dompet_Tujuan_ID] = mutasi[t.Dompet_Tujuan_ID] || { m: 0, k: 0 }).m += t.Nominal;
        if (t.Dompet_Asal_ID) (mutasi[t.Dompet_Asal_ID] = mutasi[t.Dompet_Asal_ID] || { m: 0, k: 0 }).k += t.Nominal;
      });
      const terakhir = {};
      ix.ok.forEach(t => { [t.Dompet_Asal_ID, t.Dompet_Tujuan_ID].forEach(id => { if (id) terakhir[id] = t; }); });
      const hitung = tp => aktif.filter(w => !tp || w.Tipe === tp).length;
      const tampil = aktif.filter(w => !filter || w.Tipe === filter);

      return `
        <div class="page-head">
          <div><div class="crumb">Buku kas <span>/</span> Manajemen dompet</div><h1 class="page-title">Dompet &amp; Sumber Dana</h1>
            <p class="page-sub">Kelola rekening, e-wallet, kas tunai, dan dompet tabungan target. Saldo dihitung otomatis dari transaksi tercatat.</p></div>
          <div class="page-actions"><button class="btn btn-primary" type="button" data-baru>${UI.ic('plus', 'ic-sm')} Tambah Dompet</button></div>
        </div>
        <div class="g g-3">
          <div class="card glow"><div class="row-between"><span class="eyebrow">Total saldo kas</span><span class="tile sm c-oranye">${UI.ic('wallet', 'ic-sm')}</span></div>
            <div class="kpi-value xl num">${U.rp(s.total)}</div><div class="progress mt-16"><span style="width:100%"></span></div><div class="kpi-sub mt-8">Akumulasi ${aktif.length} dompet aktif</div></div>
          <div class="card"><div class="row-between"><span class="eyebrow">Saldo likuid</span><span class="tile sm c-amber">${UI.ic('banknote', 'ic-sm')}</span></div>
            <div class="kpi-value num">${U.rp(s.likuid)}</div><div class="mt-16">${UI.progress(pct(s.likuid), 'hampir')}</div><div class="kpi-sub mt-8"><b class="t-warn">${U.persen(pct(s.likuid), 1)}</b> dari total · siap dibelanjakan</div></div>
          <div class="card"><div class="row-between"><span class="eyebrow">Saldo tabungan</span><span class="tile sm c-hijau">${UI.ic('piggy-bank', 'ic-sm')}</span></div>
            <div class="kpi-value num">${U.rp(s.tabungan)}</div><div class="mt-16">${UI.progress(pct(s.tabungan), 'aman')}</div><div class="kpi-sub mt-8"><b class="t-ok">${U.persen(pct(s.tabungan), 1)}</b> dari total · pos target</div></div>
        </div>
        <div class="chips mt-24" role="tablist" aria-label="Saring tipe dompet">
          <button class="chip ${!filter ? 'active' : ''}" type="button" data-tp="">Semua <span class="count">${hitung('')}</span></button>
          ${TIPE.map(([t]) => `<button class="chip ${filter === t ? 'active' : ''}" type="button" data-tp="${t}">${t === 'Tabungan' ? 'Tabungan target' : t} <span class="count">${hitung(t)}</span></button>`).join('')}
        </div>
        <div class="g mt-16" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))">
          ${tampil.map(w => D.kartu(w, s.per[w.ID], mutasi[w.ID], terakhir[w.ID], db)).join('') ||
            `<div class="card" style="grid-column:1/-1">${UI.kosong('wallet', db.dompet.length ? 'Tidak ada dompet tipe ini' : 'Belum ada dompet', 'Tambahkan rekening bank, e-wallet, kas tunai, atau dompet tabungan beserta saldo awalnya.', '<button class="btn btn-primary btn-sm mt-8" type="button" data-baru>Tambah dompet</button>')}</div>`}
        </div>
        ${non.length ? `<section class="card mt-24"><button class="row-between" style="width:100%" type="button" data-non aria-expanded="${bukaNonaktif}"><span class="row">${UI.ic('archive')}<b class="head" style="font-size:17px">Dompet nonaktif &amp; arsip (${non.length})</b></span>${UI.ic(bukaNonaktif ? 'chevron-up' : 'chevron-down')}</button>
          ${bukaNonaktif ? `<div class="list mt-16">${non.map(w => `<div class="item">${UI.tileDompet(w)}<div class="meta"><div class="ttl">${e(w.Nama)}</div><div class="sub">${e(w.Tipe)} · saldo ${U.rp(s.per[w.ID])}</div></div><button class="btn btn-secondary btn-sm" type="button" data-aktifkan="${w.ID}">Aktifkan</button><button class="icon-btn" type="button" data-ubah="${w.ID}" aria-label="Ubah ${e(w.Nama)}">${UI.ic('pencil', 'ic-sm')}</button></div>`).join('')}</div>` : ''}</section>` : ''}`;
    },

    kartu(w, saldo, mut, akhir, db) {
      mut = mut || { m: 0, k: 0 };
      const tgt = db.target.filter(t => t.Dompet_Tabungan_ID === w.ID && t.Status === 'Aktif');
      const info = tgt.length ? Calc.target(db, tgt[0]) : null;
      return `<article class="card wallet-card">
        <div class="row-between"><div class="row">${UI.tileDompet(w, 'lg')}<div><h2 class="head" style="font-size:18px">${e(w.Nama)}</h2>
          <div class="wrap-gap mt-8"><span class="badge">${e(w.Tipe).toUpperCase()}</span>${tgt.length ? `<span class="badge warn">${UI.ic('lock', 'ic-xs')} Terkunci target</span>` : ''}</div></div></div>
          <button class="icon-btn" type="button" data-menu="${w.ID}" aria-label="Menu ${e(w.Nama)}">${UI.ic('more-vertical')}</button></div>
        <div class="eyebrow mt-24">Saldo saat ini</div><div class="saldo num ${saldo < 0 ? 't-danger' : ''}">${U.rp(saldo)}</div>
        ${info ? `<div class="panel mt-16"><div class="row-between" style="font-size:13px"><span class="t-accent">Progres ${e(tgt[0].Nama)}</span><b class="num">${U.persen(info.persen, 1)} (${U.rpPendek(info.terkumpul)} / ${U.rpPendek(tgt[0].Nominal_Target)})</b></div><div class="mt-8">${UI.progress(info.persen)}</div></div>` : ''}
        <div class="panel inset mt-16" style="font-size:13px">
          <div class="row-between"><span class="muted">Saldo awal</span><span class="num">${U.rp(w.Saldo_Awal)} <span class="faint">(${U.tgl(w.Tanggal_Saldo_Awal)})</span></span></div>
          <div class="row-between mt-8"><span class="muted">Mutasi terakhir</span><span class="num" style="text-align:right">${akhir ? U.tglJam(akhir.Tanggal) + (akhir.Catatan ? ' · ' + e(akhir.Catatan.slice(0, 22)) : '') : '–'}</span></div>
        </div>
        <div class="g g-2 mt-12" style="gap:10px"><div class="mini-stat"><div class="l">Masuk bulan ini</div><div class="v t-ok">${U.rp(mut.m, { tanda: true })}</div></div>
          <div class="mini-stat"><div class="l">Keluar bulan ini</div><div class="v">${mut.k ? U.rp(-mut.k) : U.rp(0)}</div></div></div>
        <div class="row-between mt-16"><a class="btn btn-secondary btn-sm" href="#/riwayat?dompet=${w.ID}">${UI.ic('list', 'ic-sm')} Lihat riwayat</a>
          ${tgt.length ? `<a class="link-more" href="#/target?id=${tgt[0].ID}">Detail target ${UI.ic('arrow-right', 'ic-sm')}</a>` : `<button class="icon-btn" type="button" data-ubah="${w.ID}" aria-label="Ubah ${e(w.Nama)}">${UI.ic('pencil', 'ic-sm')}</button>`}</div>
      </article>`;
    },

    form(w) {
      const s = w ? Object.assign({}, w) : { Nama: '', Tipe: 'Bank', Saldo_Awal: 0, Tanggal_Saldo_Awal: U.hariIni(), Aktif: 'Ya', Warna: 'oranye' };
      const dipakai = w && Store.db.trx.some(t => t.Dompet_Asal_ID === w.ID || t.Dompet_Tujuan_ID === w.ID);
      UI.drawer({
        label: w ? 'Ubah dompet' : 'Tambah dompet', judul: w ? 'Ubah Dompet' : 'Tambah Dompet Baru', sub: 'Daftarkan rekening bank, e-wallet, kas tunai, atau dompet tabungan.',
        isi: `<div class="field"><label class="label" for="d-nama">Nama dompet / akun</label><input class="input" id="d-nama" maxlength="40" placeholder="Contoh: BCA Utama" value="${e(s.Nama)}"></div>
          <div class="field"><span class="label">Tipe akun</span><div class="g g-2" style="gap:10px" role="group" aria-label="Tipe akun">${TIPE.map(([t, i]) => `<button type="button" class="pick ${s.Tipe === t ? 'active' : ''}" data-tipe="${t}" aria-pressed="${s.Tipe === t}" style="flex-direction:column;justify-content:center;min-height:76px">${UI.ic(i)}<span class="nm">${t}</span>${t === 'Tabungan' ? '<span class="sub">Pos target</span>' : ''}</button>`).join('')}</div></div>
          <div class="field"><label class="label" for="d-saldo">Saldo awal <small>IDR</small></label>${Aksi.fieldNominal('d-saldo', s.Saldo_Awal)}</div>
          <div class="field"><label class="label" for="d-tgl">Tanggal saldo awal</label><input class="input" type="date" id="d-tgl" value="${e(s.Tanggal_Saldo_Awal)}"><span class="hint">Saldo = saldo awal pada tanggal ini + seluruh transaksi tercatat sesudahnya.</span></div>
          <div class="field"><span class="label">Aksen warna ikon</span><div class="swatches" role="radiogroup" aria-label="Warna">${['oranye', 'amber', 'hijau', 'biru', 'mawar', 'abu'].map(c => `<button type="button" class="swatch c-${c} ${s.Warna === c ? 'active' : ''}" data-warna="${c}" role="radio" aria-checked="${s.Warna === c}" aria-label="${c}">${s.Warna === c ? UI.ic('check', 'ic-sm') : ''}</button>`).join('')}</div></div>
          <div class="setting-row mt-16"><div><div class="t">Dompet aktif</div><div class="s">Tampil dalam pilihan transaksi & total saldo</div></div><label class="switch"><input type="checkbox" id="d-aktif" ${s.Aktif === 'Ya' ? 'checked' : ''} aria-label="Dompet aktif"><span></span></label></div>
          ${dipakai ? `<div class="note mt-16">${UI.ic('shield', 'ic-sm')}<span>Dompet yang sudah berisi transaksi tidak bisa dihapus — cukup <b>nonaktifkan</b> agar riwayat tetap utuh.</span></div>` : ''}
          <div class="err mt-16 hidden" data-err role="alert"></div>`,
        kaki: `<button class="btn btn-ghost" type="button" data-tutup>Batal</button><button class="btn btn-primary" type="button" data-ok>${UI.ic('check', 'ic-sm')} Simpan Dompet</button>`,
        onBuka: (el, tutup) => {
          Aksi.pasangNominal(el, 'd-saldo', v => { s.Saldo_Awal = v; });
          el.querySelectorAll('[data-tipe]').forEach(b => b.onclick = () => { s.Tipe = b.dataset.tipe; el.querySelectorAll('[data-tipe]').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b); }); });
          el.querySelectorAll('[data-warna]').forEach(b => b.onclick = () => { s.Warna = b.dataset.warna; el.querySelectorAll('[data-warna]').forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-checked', on); x.innerHTML = on ? UI.ic('check', 'ic-sm') : ''; }); });
          el.querySelector('[data-ok]').onclick = () => {
            s.Nama = el.querySelector('#d-nama').value.trim(); s.Tanggal_Saldo_Awal = el.querySelector('#d-tgl').value; s.Aktif = el.querySelector('#d-aktif').checked ? 'Ya' : 'Tidak';
            if (!s.Nama) return Aksi.tampilGalat(el, 'Nama dompet wajib diisi.');
            if (Store.db.dompet.some(x => x.ID !== s.ID && x.Nama.toLowerCase() === s.Nama.toLowerCase())) return Aksi.tampilGalat(el, 'Nama dompet sudah dipakai.');
            if (!s.Tanggal_Saldo_Awal) return Aksi.tampilGalat(el, 'Tanggal saldo awal wajib diisi.');
            D.simpan(s, w);
            tutup();
          };
        }
      });
    },
    simpan(s, w) {
      const rec = Object.assign({ ID: U.tmpId(), Urutan: Store.db.dompet.length + 1 }, w || {}, s);
      Store.mutasi({
        action: 'dompetSimpan', data: { ID: w ? w.ID : undefined, Nama: s.Nama, Tipe: s.Tipe, Saldo_Awal: s.Saldo_Awal, Tanggal_Saldo_Awal: s.Tanggal_Saldo_Awal, Aktif: s.Aktif, Warna: s.Warna },
        optimis: db => Store.put(db, 'dompet', rec),
        terapkan: (db, r) => Store.pasangServer(db, 'dompet', r.dompet, rec.ID)
      }).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Dompet tidak tersimpan'); });
      UI.toast(w ? 'Dompet diperbarui' : `Dompet ${s.Nama} ditambahkan`, { sub: 'Saldo awal ' + U.rp(s.Saldo_Awal) });
    },

    pasang(el, p) {
      if (p.baru) { history.replaceState(null, '', '#/dompet'); setTimeout(() => D.form(null), 50); }
      el.addEventListener('click', ev => {
        const ix = Calc.idx(Store.db);
        if (ev.target.closest('[data-baru]')) return D.form(null);
        const tp = ev.target.closest('[data-tp]');
        if (tp) { filter = tp.dataset.tp; return App.render(); }
        if (ev.target.closest('[data-non]')) { bukaNonaktif = !bukaNonaktif; return App.render(); }
        const u = ev.target.closest('[data-ubah]');
        if (u) return D.form(ix.dompet.get(u.dataset.ubah));
        const a = ev.target.closest('[data-aktifkan]');
        if (a) { const w = ix.dompet.get(a.dataset.aktifkan); return D.simpan(Object.assign({}, w, { Aktif: 'Ya' }), w); }
        const m = ev.target.closest('[data-menu]');
        if (m) {
          const w = ix.dompet.get(m.dataset.menu);
          UI.menu(m, [
            { ikon: 'pencil', label: 'Ubah dompet', fn: () => D.form(w) },
            { ikon: 'list', label: 'Lihat riwayat', fn: () => App.go('#/riwayat?dompet=' + w.ID) },
            { ikon: 'plus', label: 'Catat transaksi dari dompet ini', fn: () => App.catat({ draf: { Dompet_Asal_ID: w.ID, Dompet_Tujuan_ID: w.ID } }) },
            { sep: 1 },
            { ikon: 'archive', label: 'Nonaktifkan', bahaya: true, fn: async () => { if (await UI.konfirmasi({ judul: 'Nonaktifkan ' + e(w.Nama) + '?', pesan: 'Dompet disembunyikan dari pilihan transaksi dan total saldo. Riwayat tetap tersimpan dan bisa diaktifkan lagi.', ok: 'Nonaktifkan', bahaya: true })) D.simpan(Object.assign({}, w, { Aktif: 'Tidak' }), w); } }
          ]);
        }
      });
    }
  };

  window.Pages.dompet = D;
})();
