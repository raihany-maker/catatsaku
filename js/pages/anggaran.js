/* Anggaran Pengeluaran (F-06, A4): batas per kategori per bulan, realisasi otomatis, status aman/hampir/lewat. */
(function () {
  window.Pages = window.Pages || {};
  const e = U.esc;
  let bulan = '', saring = '';

  const A = {
    judul: 'Anggaran',
    render(p) {
      const db = Store.db, ambang = App.ambang(), kini = U.hariIni().slice(0, 7);
      if (p.bulan && /^\d{4}-\d{2}$/.test(p.bulan)) bulan = p.bulan;
      if (!bulan) bulan = kini;
      const list = Calc.anggaran(db, bulan, ambang);
      const batas = list.reduce((s, x) => s + x.batas, 0), pakai = list.reduce((s, x) => s + x.pakai, 0);
      const persen = batas ? pakai / batas * 100 : 0, sisa = batas - pakai;
      const hariSisa = bulan === kini ? U.hariDalam(bulan) - Number(U.hariIni().slice(8)) + 1 : bulan > kini ? U.hariDalam(bulan) : 0;
      const n = st => list.filter(x => x.status === st).length;
      const tampil = list.filter(x => !saring || x.status === saring);
      const tanpa = db.kategori.filter(k => k.Jenis === 'Keluar' && k.Aktif === 'Ya' && !list.some(x => x.a.Kategori_ID === k.ID));
      const label = bulan === kini ? 'Periode berjalan' : bulan < kini ? 'Periode lalu' : 'Periode mendatang';

      return `
        <div class="page-head">
          <div><div class="crumb">Perencanaan <span>/</span> Monitoring anggaran</div><h1 class="page-title">Anggaran Pengeluaran</h1>
            <p class="page-sub">Kendalikan batas pos pengeluaran bulanan dan cegah pemborosan sebelum terjadi.</p></div>
          <div class="page-actions">
            <div class="seg" role="group" aria-label="Pilih bulan"><button type="button" data-geser="-1" aria-label="Bulan sebelumnya">${UI.ic('chevron-left', 'ic-sm')}</button>
              <button type="button" class="active" style="box-shadow:none;background:transparent;color:var(--text)" data-bulan>${U.bulanPanjang(bulan)} <span class="badge ${bulan === kini ? 'ok' : ''}" style="margin-left:6px">${label}</span></button>
              <button type="button" data-geser="1" aria-label="Bulan berikutnya">${UI.ic('chevron-right', 'ic-sm')}</button></div>
            <button class="btn btn-primary" type="button" data-baru>${UI.ic('plus', 'ic-sm')} Buat Anggaran</button>
          </div>
        </div>
        <div class="g g-3">
          <div class="card"><div class="row-between"><span class="eyebrow">Total batas anggaran</span><span class="tile sm c-oranye">${UI.ic('wallet', 'ic-sm')}</span></div>
            <div class="kpi-value num">${U.rp(batas)}</div><div class="kpi-sub">Total pagu ${list.length} kategori terpantau</div><div class="progress mt-16"><span style="width:${batas ? 100 : 0}%"></span></div></div>
          <div class="card"><div class="row-between"><span class="eyebrow">Total terpakai</span>${list.length ? A.badge(Calc.statusAnggaran(persen, ambang), persen) : ''}</div>
            <div class="kpi-value num">${U.rp(pakai)}</div><div class="row-between kpi-sub"><span>Realisasi bulanan</span><b class="num">${U.persen(persen, 1)}</b></div><div class="mt-16">${UI.progress(persen, Calc.statusAnggaran(persen, ambang))}</div></div>
          <div class="card"><div class="row-between"><span class="eyebrow">Sisa anggaran</span><span class="tile sm c-hijau">${UI.ic('piggy-bank', 'ic-sm')}</span></div>
            <div class="kpi-value num ${sisa < 0 ? 't-danger' : 't-ok'}">${U.rp(sisa)}</div>
            <div class="kpi-sub">${hariSisa && sisa > 0 ? `Rata-rata aman: <b class="num">${U.rp(Math.floor(sisa / hariSisa))}</b>/hari untuk ${hariSisa} hari tersisa` : sisa < 0 ? 'Total pengeluaran melampaui seluruh pagu' : '—'}</div></div>
        </div>
        <div class="row-between mt-24" style="flex-wrap:wrap">
          <div class="chips" role="tablist" aria-label="Saring status">
            <button class="chip ${!saring ? 'active' : ''}" type="button" data-s="">Semua <span class="count">${list.length}</span></button>
            <button class="chip ${saring === 'aman' ? 'active' : ''}" type="button" data-s="aman">Aman <span class="count">${n('aman')}</span></button>
            <button class="chip ${saring === 'hampir' ? 'active' : ''}" type="button" data-s="hampir">Mendekati batas <span class="count">${n('hampir')}</span></button>
            <button class="chip ${saring === 'lewat' ? 'active' : ''}" type="button" data-s="lewat">Terlampaui <span class="count">${n('lewat')}</span></button>
          </div>
          <button class="btn btn-ghost btn-sm" type="button" data-salin>${UI.ic('history', 'ic-sm')} Salin dari ${U.bulan(U.tambahBulan(bulan, -1))}</button>
        </div>
        <div class="g g-side mt-16">
          <div class="stack">${tampil.length ? tampil.map(x => A.kartu(x, hariSisa)).join('') : `<div class="card">${UI.kosong('pie-chart', list.length ? 'Tidak ada anggaran dengan status ini' : 'Belum ada anggaran ' + U.bulan(bulan), 'Tetapkan batas per kategori, atau salin anggaran dari bulan sebelumnya.', `<div class="row mt-8"><button class="btn btn-secondary btn-sm" type="button" data-salin>Salin bulan lalu</button><button class="btn btn-primary btn-sm" type="button" data-baru>Buat anggaran</button></div>`)}</div>`}</div>
          <aside class="stack">
            <div class="card"><div class="eyebrow accent">${UI.ic('sliders', 'ic-xs')} Konfigurasi</div><h3 class="card-title mt-8">Ambang peringatan dini</h3>
              <p class="muted mt-8" style="font-size:14px">Status berubah menjadi <b class="t-warn">"Hampir habis"</b> saat realisasi mencapai <b>${ambang}%</b>, dan <b class="t-danger">"Terlampaui"</b> di atas 100%. Peringatan juga dikirim via email.</p>
              <a class="btn btn-secondary btn-sm mt-16" href="#/pengaturan?tab=keuangan">Ubah ambang</a></div>
            ${tanpa.length ? `<div class="card"><h3 class="card-title">Belum dianggarkan</h3><p class="card-sub">Kategori pengeluaran aktif tanpa batas di ${U.bulan(bulan)}.</p>
              <div class="list mt-12">${tanpa.map(k => `<div class="item">${UI.tileKat(k, 'sm')}<div class="meta"><div class="ttl" style="font-size:14px">${e(k.Nama)}</div></div><button class="btn btn-secondary btn-xs" type="button" data-atur="${k.ID}">Atur</button></div>`).join('')}</div></div>` : ''}
            <div class="note">${UI.ic('info', 'ic-sm')}<span>Realisasi dihitung otomatis dari transaksi berstatus <b>Tercatat</b>. Transfer saldo dan setoran target tabungan tidak memotong anggaran.</span></div>
          </aside>
        </div>`;
    },
    badge(st, persen) {
      const t = st === 'lewat' ? 'Terlampaui' : st === 'hampir' ? 'Mendekati batas' : 'Aman';
      return `<span class="badge ${st === 'lewat' ? 'danger' : st === 'hampir' ? 'warn' : 'ok'}"><i class="bd"></i>${t} (${U.persen(persen, persen < 100 ? 0 : 1)})</span>`;
    },
    kartu(x, hariSisa) {
      return `<article class="card ${x.status === 'lewat' ? '' : ''}" style="${x.status === 'lewat' ? 'border-color:var(--danger-soft)' : ''}">
        <div class="row-between" style="align-items:flex-start"><div class="row">${UI.tileKat(x.kat, 'lg')}<div><h2 class="head" style="font-size:18px">${e(x.kat.Nama)}</h2><div class="muted" style="font-size:13px">Pos pengeluaran ${U.bulan(x.a.Bulan)}</div></div></div>
          <div class="row" style="gap:6px">${A.badge(x.status, x.persen)}<button class="icon-btn" type="button" data-menu="${x.a.ID}" aria-label="Menu anggaran ${e(x.kat.Nama)}">${UI.ic('more-vertical', 'ic-sm')}</button></div></div>
        <div class="row-between mt-16" style="align-items:baseline"><div><span class="kpi-value md num ${x.status === 'lewat' ? 't-danger' : ''}" style="margin:0">${U.rp(x.pakai)}</span> <span class="muted num">/ ${U.rp(x.batas)}</span></div>
          <b class="head num ${x.status === 'lewat' ? 't-danger' : x.status === 'hampir' ? 't-warn' : 't-ok'}" style="font-size:20px">${U.persen(x.persen, x.persen < 100 ? 0 : 1)}</b></div>
        <div class="mt-12">${UI.progress(x.persen, x.status, true)}</div>
        <div class="row-between mt-12" style="font-size:13.5px;flex-wrap:wrap">
          ${x.sisa >= 0 ? `<span class="muted">${UI.ic(x.status === 'hampir' ? 'alert-triangle' : 'info', 'ic-xs')} Sisa pagu: <b class="num" style="color:var(--text)">${U.rp(x.sisa)}</b>${hariSisa ? ` · ${hariSisa} hari lagi` : ''}</span>${hariSisa ? `<b class="num">Aman: ${U.rp(Math.floor(x.sisa / hariSisa))}/hari</b>` : ''}`
            : `<span class="t-danger">${UI.ic('alert-circle', 'ic-xs')} Melebihi batas sebesar <b class="num">${U.rp(-x.sisa)}</b></span><a class="link-more" href="#/riwayat?${U.qs({ jenis: 'Keluar', kat: x.a.Kategori_ID, dari: x.a.Bulan + '-01', sampai: x.a.Bulan + '-' + U.hariDalam(x.a.Bulan) })}">Lihat transaksi ${UI.ic('arrow-right', 'ic-xs')}</a>`}
        </div></article>`;
    },

    form(a, katId) {
      const db = Store.db;
      const s = a ? { ID: a.ID, Bulan: a.Bulan, Kategori_ID: a.Kategori_ID, Batas: a.Batas } : { Bulan: bulan, Kategori_ID: katId || '', Batas: 0 };
      const kats = db.kategori.filter(k => k.Jenis === 'Keluar' && (k.Aktif === 'Ya' || k.ID === s.Kategori_ID));
      const saran = id => {
        if (!id) return '';
        const b = [1, 2, 3].map(i => U.tambahBulan(s.Bulan, -i));
        const tot = b.reduce((t, m) => t + (Calc.ringkas(db, m + '-01', m + '-' + U.hariDalam(m)).perKat.find(k => k.id === id) || { nominal: 0 }).nominal, 0);
        return tot ? `Rata-rata 3 bulan terakhir: <b class="num">${U.rp(Math.round(tot / 3))}</b>/bulan` : 'Belum ada riwayat pengeluaran kategori ini.';
      };
      UI.drawer({
        label: 'Atur anggaran', eyebrow: `${UI.ic('sliders', 'ic-xs')} Konfigurasi pagu`, judul: a ? 'Ubah Anggaran' : 'Atur Anggaran Kategori', sub: 'Tetapkan batas belanja per kategori per bulan.',
        isi: `<div class="field"><label class="label" for="a-kat">Kategori</label><select class="select" id="a-kat" ${a ? 'disabled' : ''}><option value="">Pilih kategori pengeluaran…</option>${kats.map(k => `<option value="${k.ID}" ${k.ID === s.Kategori_ID ? 'selected' : ''}>${e(k.Nama)}</option>`).join('')}</select></div>
          <div class="field"><label class="label" for="a-bulan">Periode bulan</label><input class="input" type="month" id="a-bulan" value="${s.Bulan}" ${a ? 'disabled' : ''}></div>
          <div class="field"><label class="label" for="a-batas">Batas anggaran bulanan</label>${Aksi.fieldNominal('a-batas', s.Batas, [100000, 250000, 500000, 1000000])}<span class="hint" data-saran>${saran(s.Kategori_ID)}</span></div>
          <div class="note mt-16">${UI.ic('info', 'ic-sm')}<span>Satu kategori hanya punya satu batas per bulan — menyimpan ulang akan memperbarui batas yang ada.</span></div>
          <div class="err mt-16 hidden" data-err role="alert"></div>`,
        kaki: `<button class="btn btn-ghost" type="button" data-tutup>Batal</button><button class="btn btn-primary" type="button" data-ok>${UI.ic('check', 'ic-sm')} Simpan Anggaran</button>`,
        onBuka: (el, tutup) => {
          Aksi.pasangNominal(el, 'a-batas', v => { s.Batas = v; });
          el.querySelector('#a-kat').onchange = ev => { s.Kategori_ID = ev.target.value; el.querySelector('[data-saran]').innerHTML = saran(s.Kategori_ID); };
          el.querySelector('#a-bulan').onchange = ev => { s.Bulan = ev.target.value; el.querySelector('[data-saran]').innerHTML = saran(s.Kategori_ID); };
          el.querySelector('[data-ok]').onclick = () => {
            if (!s.Kategori_ID) return Aksi.tampilGalat(el, 'Pilih kategori.');
            if (!/^\d{4}-\d{2}$/.test(s.Bulan)) return Aksi.tampilGalat(el, 'Pilih bulan.');
            if (!s.Batas) return Aksi.tampilGalat(el, 'Batas anggaran harus lebih dari 0.');
            const ada = Store.db.anggaran.find(x => x.Bulan === s.Bulan && x.Kategori_ID === s.Kategori_ID);
            const rec = Object.assign({ ID: (ada && ada.ID) || U.tmpId() }, { Bulan: s.Bulan, Kategori_ID: s.Kategori_ID, Batas: s.Batas });
            Store.mutasi({
              action: 'anggaranSimpan', data: { ID: rec.ID.startsWith('tmp-') ? undefined : rec.ID, Bulan: s.Bulan, Kategori_ID: s.Kategori_ID, Batas: s.Batas },
              optimis: d => Store.put(d, 'anggaran', rec), terapkan: (d, r) => Store.pasangServer(d, 'anggaran', r.anggaran, rec.ID)
            }).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Anggaran tidak tersimpan'); });
            UI.toast('Anggaran disimpan', { sub: `${(Calc.idx(Store.db).kategori.get(s.Kategori_ID) || {}).Nama} · ${U.rp(s.Batas)} / ${U.bulan(s.Bulan)}` });
            if (s.Bulan !== bulan) { bulan = s.Bulan; App.render(); }
            tutup();
          };
        }
      });
    },

    pasang(el) {
      el.addEventListener('click', async ev => {
        const g = ev.target.closest('[data-geser]');
        if (g) { bulan = U.tambahBulan(bulan, Number(g.dataset.geser)); history.replaceState(null, '', '#/anggaran?bulan=' + bulan); return App.render(); }
        if (ev.target.closest('[data-bulan]')) { bulan = U.hariIni().slice(0, 7); return App.render(); }
        if (ev.target.closest('[data-baru]')) return A.form(null);
        const at = ev.target.closest('[data-atur]');
        if (at) return A.form(null, at.dataset.atur);
        const s = ev.target.closest('[data-s]');
        if (s) { saring = s.dataset.s; return App.render(); }
        if (ev.target.closest('[data-salin]')) {
          const dari = U.tambahBulan(bulan, -1);
          const sumber = Store.db.anggaran.filter(a => a.Bulan === dari);
          if (!sumber.length) return UI.toast('Tidak ada anggaran di ' + U.bulan(dari), { tipe: 'info' });
          const ada = new Set(Store.db.anggaran.filter(a => a.Bulan === bulan).map(a => a.Kategori_ID));
          const baru = sumber.filter(a => !ada.has(a.Kategori_ID)).map(a => ({ ID: U.tmpId(), Bulan: bulan, Kategori_ID: a.Kategori_ID, Batas: a.Batas }));
          if (!baru.length) return UI.toast('Semua kategori sudah punya anggaran di ' + U.bulan(bulan), { tipe: 'info' });
          Store.mutasi({
            action: 'anggaranSalin', data: { dari, ke: bulan },
            optimis: d => baru.map(r => Store.put(d, 'anggaran', r)),
            terapkan: (d, r) => { baru.forEach(x => { d.anggaran = d.anggaran.filter(a => a.ID !== x.ID); }); r.anggaran.forEach(x => Store.put(d, 'anggaran', x)); }
          }).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Gagal menyalin'); });
          return UI.toast(`${baru.length} anggaran disalin dari ${U.bulan(dari)}`);
        }
        const m = ev.target.closest('[data-menu]');
        if (m) {
          const a = Store.db.anggaran.find(x => x.ID === m.dataset.menu), k = Calc.idx(Store.db).kategori.get(a.Kategori_ID) || {};
          UI.menu(m, [
            { ikon: 'pencil', label: 'Ubah batas', fn: () => A.form(a) },
            { ikon: 'list', label: 'Lihat transaksi', fn: () => App.go('#/riwayat?' + U.qs({ jenis: 'Keluar', kat: a.Kategori_ID, dari: a.Bulan + '-01', sampai: a.Bulan + '-' + U.hariDalam(a.Bulan) })) },
            { sep: 1 },
            { ikon: 'trash', label: 'Hapus anggaran', bahaya: true, fn: async () => {
              if (!(await UI.konfirmasi({ judul: 'Hapus anggaran?', pesan: `Batas <b>${e(k.Nama)}</b> untuk ${U.bulan(a.Bulan)} dihapus. Transaksi tidak terpengaruh.`, ok: 'Hapus', bahaya: true }))) return;
              Store.mutasi({ action: 'anggaranHapus', data: { ID: a.ID }, optimis: d => Store.buang(d, 'anggaran', a.ID) }).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Gagal menghapus'); });
              UI.toast('Anggaran dihapus');
            } }
          ]);
        }
      });
    }
  };

  window.Pages.anggaran = A;
})();
