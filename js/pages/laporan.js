/* Laporan & Analitik (F-11, B1–B7) + Insight Finansial Otomatis (F-12) + Ekspor Excel/PDF (F-14). */
(function () {
  window.Pages = window.Pages || {};
  const e = U.esc;
  let urut = 'nominal';

  const L = {
    judul: 'Laporan',
    render() {
      const db = Store.db, ix = Calc.idx(db), per = App.periode(), ambang = App.ambang();
      const r = Calc.ringkas(db, per.dari, per.sampai), p = Calc.ringkas(db, per.prev.dari, per.prev.sampai);
      let bulan = per.bulan.slice(); while (bulan.length < 6) bulan.unshift(U.tambahBulan(bulan[0], -1));
      const seri = Calc.bulanan(db, bulan);
      const s = Calc.saldoPeriode(db, per.sampai), dompet = Calc.dompetAktif(db).map(w => ({ w, v: s.per[w.ID] })).sort((a, b) => b.v - a.v);
      const totPos = dompet.reduce((t, x) => t + Math.max(0, x.v), 0);
      const kat = r.perKat.slice().sort((a, b) => (urut === 'nama' ? a.kat.Nama.localeCompare(b.kat.Nama) : b.nominal - a.nominal));
      const sr3 = seri.slice(-3);
      const heat = Calc.heat(db, per.dari, per.sampai);
      const tg = db.target.filter(t => t.Status !== 'Batal');
      const ins = Calc.insights(db, per, ambang);
      const ikonIns = { kategori: 'utensils', aruskas: 'trending-down', anggaran: 'alert-triangle', target: 'shield' };
      const lihat = (o, t) => `<a class="link-more" href="#/riwayat?${U.qs(Object.assign({ dari: per.dari, sampai: per.sampai }, o))}" style="font-size:13px">${t || 'Lihat transaksi'} ${UI.ic('arrow-up-right', 'ic-xs')}</a>`;
      const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const kini = U.hariIni();
      const lvl = v => (!v || !heat.max ? '' : 'l' + Math.min(4, Math.max(1, Math.ceil(v / heat.max * 4))));
      const sel = c => {
        if (!c) return '<span class="cell out" aria-hidden="true"></span>';
        const no = `<span class="d">${Number(c.tgl.slice(8))}</span>`;
        if (c.luar || c.tgl > kini) return `<span class="cell ${c.luar ? 'out' : 'fut'}" title="${U.tglHari(c.tgl)}: ${c.luar ? 'di luar periode' : 'belum terjadi'}">${no}</span>`;
        const lbl = `${U.tglHari(c.tgl)}: ${U.rp(c.v)}`;
        return `<button type="button" class="cell ${lvl(c.v)}${c.tgl === kini ? ' now' : ''}" data-heat="${c.tgl}" title="${lbl}" aria-label="${lbl}">${no}${c.v ? U.sumbuRp(c.v) : '·'}</button>`;
      };
      const labelPekan = row => { const a = row.find(Boolean).tgl, b = row.filter(Boolean).pop().tgl; return a === b ? U.tglPendek(a) : Number(a.slice(8)) + '–' + U.tglPendek(b); };

      return `
        <div class="page-head">
          <div><div class="crumb">Analitik <span>/</span> Laporan finansial</div><h1 class="page-title">Laporan &amp; Analitik Keuangan</h1>
            <p class="page-sub">Visualisasi arus kas, komposisi pengeluaran, sebaran likuiditas, dan pola pengeluaran — ${e(per.label)}.</p></div>
          <div class="page-actions"><button class="btn btn-secondary" type="button" data-xlsx>${UI.ic('sheet', 'ic-sm')} Ekspor Excel</button><button class="btn btn-primary" type="button" data-pdf>${UI.ic('file-text', 'ic-sm')} Ekspor PDF</button></div>
        </div>
        <div class="chips" role="tablist" aria-label="Periode laporan">${Calc.PERIODE.map(([k, n]) => `<button class="chip ${per.key === k ? 'active' : ''}" type="button" data-per="${k}" role="tab" aria-selected="${per.key === k}">${k === 'khusus' && per.key === 'khusus' ? e(per.label) : n}</button>`).join('')}</div>

        <div class="g g-4 mt-16">
          <div class="card tight"><div class="row-between"><span class="eyebrow row" style="gap:6px"><i class="dotc c-hijau"></i>Pemasukan</span>${UI.delta(Calc.ubah(r.masuk, p.masuk))}</div><div class="kpi-value md num">${U.rp(r.masuk)}</div><div class="kpi-sub">vs periode sebelumnya</div></div>
          <div class="card tight"><div class="row-between"><span class="eyebrow row" style="gap:6px"><i class="dotc c-oranye"></i>Pengeluaran</span>${UI.delta(Calc.ubah(r.keluar, p.keluar), true)}</div><div class="kpi-value md num">${U.rp(r.keluar)}</div><div class="kpi-sub">${r.keluar <= p.keluar ? 'lebih hemat' : 'lebih boros'} ${U.rp(Math.abs(r.keluar - p.keluar))}</div></div>
          <div class="card tight"><div class="row-between"><span class="eyebrow row" style="gap:6px"><i class="dotc c-amber"></i>Arus kas bersih</span>${r.masuk ? UI.badge(U.persen(Math.abs(r.net) / r.masuk * 100) + (r.net >= 0 ? ' surplus' : ' defisit'), r.net >= 0 ? 'ok' : 'danger') : ''}</div><div class="kpi-value md num ${r.net >= 0 ? 't-ok' : 't-danger'}">${U.rp(r.net, { tanda: true })}</div><div class="kpi-sub">pemasukan − pengeluaran</div></div>
          <div class="card tight"><div class="row-between"><span class="eyebrow row" style="gap:6px"><i class="dotc c-biru"></i>Tingkat tabungan</span><button type="button" class="muted" data-info-rate aria-label="Definisi tingkat tabungan">${UI.ic('info', 'ic-sm')}</button></div><div class="kpi-value md num">${U.persen(r.rate, 1)}</div><div class="kpi-sub">${r.rate === null ? 'tidak ada pemasukan' : 'tabungan bersih ' + U.rp(r.tabungan)}</div></div>
        </div>

        <div class="g g-2 mt-24">
          <section class="card"><div class="card-head"><div><h2 class="card-title">Tren Keuangan Multi-Bulan</h2><p class="card-sub">Arus kas bulanan (${U.bulan(bulan[0])} – ${U.bulan(bulan[bulan.length - 1])})</p></div>${lihat({})}</div>
            <div class="legend"><span style="--c:var(--chart-in)"><i></i>Pemasukan</span><span style="--c:var(--chart-out)"><i></i>Pengeluaran</span><span style="--c:var(--muted)"><i style="height:2px"></i>Rata-rata pengeluaran</span></div>
            <div class="chart-box mt-12"><canvas id="c-tren" role="img" aria-label="Tren pemasukan dan pengeluaran per bulan"></canvas></div></section>
          <section class="card"><div class="card-head"><div><h2 class="card-title">Riwayat Saldo Akumulatif</h2><p class="card-sub">Total saldo dompet aktif dari waktu ke waktu</p></div>${lihat({})}</div>
            <div class="row" style="gap:10px;align-items:baseline;flex-wrap:wrap"><span class="kpi-value md num" style="margin:0">${U.rp(s.total)}</span><span data-saldo-ubah></span></div>
            <div class="chart-box mt-12"><canvas id="c-saldo" role="img" aria-label="Grafik riwayat total saldo"></canvas></div></section>
        </div>

        <div class="g g-2 mt-24">
          <section class="card"><div class="card-head"><div><h2 class="card-title">Analisis Komposisi Pengeluaran</h2><p class="card-sub">Sebaran kategori · ${e(per.label)}</p></div>
            <div class="seg" role="group" aria-label="Urutkan"><button type="button" data-urut="nominal" class="${urut === 'nominal' ? 'active' : ''}">Nominal</button><button type="button" data-urut="nama" class="${urut === 'nama' ? 'active' : ''}">Nama</button></div></div>
            <div class="panel inset row-between"><span class="muted">Total realisasi belanja</span><b class="num">${U.rp(r.keluar)}</b></div>
            <div class="list mt-8">${kat.length ? kat.map(k => `<a class="item clickable" href="#/riwayat?${U.qs({ jenis: 'Keluar', kat: k.id, dari: per.dari, sampai: per.sampai })}" style="display:block;color:inherit;text-decoration:none">
              <div class="row-between"><span class="row" style="gap:10px"><i class="dotc c-${e(k.kat.Warna)}"></i><b style="font-size:14px">${e(k.kat.Nama)}</b></span><span class="num" style="font-size:14px"><b>${U.rp(k.nominal)}</b> <span class="muted">(${U.persen(k.persen, 1)})</span></span></div>
              <div class="progress mt-8 c-${e(k.kat.Warna)}"><span style="width:${k.persen}%"></span></div></a>`).join('') : UI.kosong('pie-chart', 'Belum ada data periode ini', '')}</div></section>
          <section class="card"><div class="card-head"><div><h2 class="card-title">Sebaran Likuiditas Dompet</h2><p class="card-sub">Alokasi saldo antar-dompet aktif</p></div><a class="link-more" href="#/dompet" style="font-size:13px">Kelola ${UI.ic('arrow-up-right', 'ic-xs')}</a></div>
            ${dompet.length ? `<div class="row" style="gap:24px;flex-wrap:wrap;align-items:center"><div style="position:relative;width:200px;height:200px;margin:auto"><canvas id="c-dompet" role="img" aria-label="Donat sebaran saldo dompet"></canvas>
              <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;pointer-events:none"><div><div class="head num" style="font-size:20px;font-weight:800">${U.rpPendek(s.total)}</div><div class="muted" style="font-size:12px">Total aset kas</div></div></div></div>
              <div class="grow" style="min-width:220px">${dompet.map(x => `<a class="row-between item" href="#/riwayat?dompet=${x.w.ID}" style="color:inherit;text-decoration:none;padding:9px 0"><span class="row" style="gap:10px;min-width:0"><i class="dotc c-${e(x.w.Warna)}"></i><span style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e(x.w.Nama)}</span></span><span class="row" style="gap:8px"><b class="num" style="font-size:14px">${U.rp(x.v)}</b><span class="badge">${U.persen(totPos ? Math.max(0, x.v) / totPos * 100 : 0, 1)}</span></span></a>`).join('')}</div></div>`
              : UI.kosong('wallet', 'Belum ada dompet', '')}</section>
        </div>

        <div class="g g-2 mt-24">
          <section class="card"><div class="card-head"><div><h2 class="card-title">Tingkat Tabungan (Saving Rate)</h2><p class="card-sub">Disiplin alokasi tabungan dibanding pemasukan</p></div>${lihat({ jenis: 'Transfer' })}</div>
            <div class="panel inset row" style="gap:10px;font-size:13.5px">${UI.ic('percent', 'ic-sm t-accent')}<span><b>Rumus:</b> (Σ Setor − Σ Tarik kontribusi) ÷ Pemasukan × 100%. Pemasukan 0 → "–".</span></div>
            <div class="g g-3 mt-12" style="gap:10px">${sr3.map((m, i) => `<div class="mini-stat" style="${i === sr3.length - 1 ? 'border-color:var(--accent-ring);background:var(--accent-soft)' : ''}"><div class="l">${U.bulanPanjang(m.bulan).split(' ')[0]}</div><div class="v" style="font-size:20px">${U.persen(m.rate, 1)}</div><div class="l">Setor ${U.rpPendek(m.tabungan)}</div></div>`).join('')}</div>
            <div class="chart-box sm mt-16"><canvas id="c-rate" role="img" aria-label="Grafik tingkat tabungan per bulan"></canvas></div></section>
          <section class="card"><div class="card-head"><div><h2 class="card-title">Progres &amp; Akumulasi Target</h2><p class="card-sub">Pencapaian dana spesifik & impian</p></div><a class="link-more" href="#/target" style="font-size:13px">Kelola ${UI.ic('arrow-up-right', 'ic-xs')}</a></div>
            ${tg.length ? tg.map(t => { const i = Calc.target(db, t); return `<a href="#/target?id=${t.ID}" class="item" style="display:block;color:inherit;text-decoration:none">
              <div class="row-between" style="font-size:14px"><span class="row" style="gap:8px">${UI.ic(i.tercapai ? 'check-circle' : 'flag', 'ic-sm ' + (i.tercapai ? 't-ok' : 't-accent'))}<b>${e(t.Nama)}</b></span><span class="num"><b>${U.rp(i.terkumpul)}</b> <span class="muted">/ ${U.rpPendek(t.Nominal_Target)}</span> ${UI.badge(i.tercapai ? '✓ Tercapai' : U.persen(i.persen, 1), i.tercapai ? 'ok' : 'accent')}</span></div>
              <div class="mt-8">${UI.progress(i.persen, i.tercapai ? 'aman' : '', true)}</div></a>`; }).join('') : UI.kosong('target', 'Belum ada target', '')}</section>
        </div>

        <section class="card mt-24"><div class="card-head"><div><h2 class="card-title">Pola Pengeluaran (Kalender Harian)</h2><p class="card-sub">Total pengeluaran per tanggal · ${U.bulanPanjang(heat.ym)}${per.bulan.length > 1 ? ' (bulan terakhir periode)' : ''}</p></div>${lihat({ jenis: 'Keluar' })}</div>
          ${heat.max ? `<div class="heat" role="table" aria-label="Kalender pengeluaran ${U.bulanPanjang(heat.ym)}"><span></span>${HARI.map(h => `<span class="hd" role="columnheader">${h.slice(0, 3)}</span>`).join('')}
            ${heat.minggu.map(row => `<span class="rl" role="rowheader">${labelPekan(row)}</span>${row.map(sel).join('')}`).join('')}</div>
            <div class="row-between mt-16" style="flex-wrap:wrap"><div class="heat-legend">Rendah ${[0, 1, 2, 3, 4].map(i => `<i style="background:var(--heat-${i})"></i>`).join('')} Tinggi (≈ ${U.rpPendek(heat.max)})${heat.ym === kini.slice(0, 7) ? '<i class="now"></i> Hari ini <i class="fut"></i> Belum terjadi' : ''}</div>
              ${heat.puncak ? `<span class="note" style="padding:8px 12px">${UI.ic('lightbulb', 'ic-sm t-warn')}<span>Pengeluaran tertinggi pada <b>${U.tglHari(heat.puncak.tgl)}</b> (${U.rp(heat.puncak.v)}).</span></span>` : ''}</div>`
            : UI.kosong('flame', 'Belum ada pengeluaran di ' + U.bulanPanjang(heat.ym), 'Peta panas muncul setelah ada transaksi pengeluaran tercatat.')}</section>

        <section class="card mt-24"><h2 class="card-title">Insight Finansial Otomatis</h2><p class="card-sub">Dihitung dari kalkulasi buku kas Anda — tanpa pemrosesan AI eksternal.</p>
          <div class="g mt-16" style="grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:14px">${ins.length ? ins.map(x => `<a class="panel" href="${x.link}" style="color:inherit;text-decoration:none;display:flex;flex-direction:column;gap:10px">
            <span class="tile sm c-${x.warna}">${UI.ic(ikonIns[x.tipe] || 'sparkles', 'ic-sm')}</span><span style="font-size:14px;line-height:1.5">${x.html}</span><span class="link-more" style="font-size:13px;margin-top:auto">Lihat ${UI.ic('arrow-right', 'ic-xs')}</span></a>`).join('') : '<p class="muted">Belum ada data untuk dianalisis.</p>'}</div></section>`;
    },

    pasang(el) {
      const db = Store.db, per = App.periode();
      el.addEventListener('click', ev => {
        const q = s => ev.target.closest(s);
        const pp = q('[data-per]');
        if (pp) return pp.dataset.per === 'khusus' ? App.rentangKhusus() : App.setPeriode(pp.dataset.per);
        const u = q('[data-urut]');
        if (u) { urut = u.dataset.urut; return App.render(); }
        if (q('[data-info-rate]')) return UI.modal({ kelas: 'sm', judul: 'Tingkat Tabungan', label: 'Definisi', isi: '<p class="muted">(Σ setor − Σ tarik kontribusi target yang tercatat) ÷ pemasukan periode × 100%. Bila pemasukan = 0 ditampilkan "–".</p>', kaki: '<button class="btn btn-primary" data-tutup type="button">Mengerti</button>' });
        const hc = q('[data-heat]');
        if (hc) return App.go('#/riwayat?' + U.qs({ jenis: 'Keluar', dari: hc.dataset.heat, sampai: hc.dataset.heat }));
        if (q('[data-xlsx]') || q('[data-pdf]')) return L.ekspor(q('[data-xlsx]') || q('[data-pdf]'), !!q('[data-pdf]'));
      });

      Charts.siap.then(() => {
        if (!el.isConnected) return;
        let bulan = per.bulan.slice(); while (bulan.length < 6) bulan.unshift(U.tambahBulan(bulan[0], -1));
        const seri = Calc.bulanan(db, bulan);
        const ctr = el.querySelector('#c-tren');
        if (ctr) Charts.tren(ctr, { labels: bulan.map(U.bulanNama), masuk: seri.map(x => x.masuk), keluar: seri.map(x => x.keluar), onKlik: (i, ds) => { const m = bulan[i]; App.go('#/riwayat?' + U.qs({ jenis: ds === 0 ? 'Masuk' : 'Keluar', dari: m + '-01', sampai: m + '-' + U.hariDalam(m) })); } });
        const hs = Calc.saldoHistori(db, per.dari, per.sampai);
        const cs = el.querySelector('#c-saldo');
        if (cs && hs.length) {
          Charts.garis(cs, { labels: hs.map(x => U.tglPendek(x.x)), tanggal: hs.map(x => x.x), data: hs.map(x => x.y), onKlik: i => App.go('#/riwayat?' + U.qs({ sampai: hs[i].x, dari: hs[i].x })) });
          const awal = hs[0].y, akhir = hs[hs.length - 1].y, b = el.querySelector('[data-saldo-ubah]');
          if (b) b.innerHTML = UI.badge(`${akhir >= awal ? '▲ +' : '▼ '}${U.rpPendek(akhir - awal).replace('−', '-')} (${U.persen(awal ? (akhir - awal) / Math.abs(awal) * 100 : 0, 1)}) sepanjang periode`, akhir >= awal ? 'ok' : 'danger');
        }
        const s = Calc.saldoPeriode(db, per.sampai), dom = Calc.dompetAktif(db).map(w => ({ w, v: s.per[w.ID] })).sort((a, b) => b.v - a.v);
        const cd = el.querySelector('#c-dompet');
        if (cd) Charts.donat(cd, { labels: dom.map(x => x.w.Nama), data: dom.map(x => x.v), warna: dom.map(x => x.w.Warna), onKlik: i => App.go('#/riwayat?dompet=' + dom[i].w.ID) });
        const cr = el.querySelector('#c-rate');
        if (cr) Charts.persen(cr, { labels: bulan.map(U.bulanNama), data: seri.map(x => (x.rate === null ? null : Math.round(x.rate * 10) / 10)) });
      });
    },

    async ekspor(btn, pdf) {
      const per = App.periode();
      try {
        const r = await UI.sibuk(btn, () => Api.post('eksporLaporan', { dari: per.dari, sampai: per.sampai }, { timeout: 180000 }), 'Menyusun laporan…');
        const b = r.berkas;
        UI.modal({
          kelas: 'sm', judul: 'Laporan siap', label: 'Laporan siap',
          sub: `${e(per.label)} · tersimpan di folder Drive "Laporan"`,
          isi: `<div class="stack" style="gap:10px">
            <a class="panel row" href="${e(pdf ? b.pdf : b.xlsx)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span class="tile c-oranye">${UI.ic(pdf ? 'file-text' : 'sheet')}</span><span class="grow"><b>${pdf ? 'Unduh PDF' : 'Unduh Excel (.xlsx)'}</b><br><span class="muted" style="font-size:12.5px">${e(b.nama)}</span></span>${UI.ic('external-link', 'ic-sm')}</a>
            <a class="panel row" href="${e(pdf ? b.xlsx : b.pdf)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span class="tile c-abu">${UI.ic(pdf ? 'sheet' : 'file-text')}</span><span class="grow"><b>${pdf ? 'Excel (.xlsx)' : 'PDF'}</b></span>${UI.ic('external-link', 'ic-sm')}</a>
            <a class="panel row" href="${e(b.sheet)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span class="tile c-hijau">${UI.ic('sheet')}</span><span class="grow"><b>Buka di Google Sheets</b></span>${UI.ic('external-link', 'ic-sm')}</a></div>
            <p class="faint mt-12" style="font-size:12.5px">Ekspor selalu memakai tampilan terang agar nyaman dicetak. Angka dihitung server dengan aturan yang sama dengan layar.</p>`,
          kaki: '<button class="btn btn-primary" data-tutup type="button">Selesai</button>'
        });
      } catch (err) { if (err.code !== 'AUTH') UI.galat(err, 'Ekspor gagal'); }
    }
  };

  window.Pages.laporan = L;
})();
