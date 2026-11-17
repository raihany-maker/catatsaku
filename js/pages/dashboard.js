/* Dashboard — Financial Overview (A1), Income vs Expenses (A2), Breakdown (A3), Anggaran (A4), Target (A5), Insight (A6), Terbaru (A7). */
(function () {
  window.Pages = window.Pages || {};
  const e = U.esc;
  const st = { tab: 'bulanan', chip: 'semua', jenis: 'semua' };
  // Sembunyikan nominal: berlaku untuk SEMUA angka Rupiah di Dashboard saja (pilihan per perangkat).
  const sembunyi = () => U.bacaLokal('cs_sembunyi_saldo') === '1';
  const rp = (v, o) => (sembunyi() ? 'Rp\u00a0••••••' : U.rp(v, o));

  function seriBulan(per) {
    let bulan = per.bulan.slice();
    while (bulan.length < 6) bulan.unshift(U.tambahBulan(bulan[0], -1));
    if (bulan.length > 12) bulan = bulan.slice(-12);
    return bulan;
  }
  function linkRiwayat(o) { return '#/riwayat?' + U.qs(o); }

  const Dash = {
    judul: 'Dashboard',
    render() {
      const db = Store.db, ix = Calc.idx(db), per = App.periode(), ambang = App.ambang();
      const r = Calc.ringkas(db, per.dari, per.sampai), p = Calc.ringkas(db, per.prev.dari, per.prev.sampai);
      const s = Calc.saldoPeriode(db, per.sampai), sLalu = Calc.saldoSemua(db, per.prev.sampai);
      const ymAng = per.sampai >= U.hariIni() && per.dari <= U.hariIni() ? U.hariIni().slice(0, 7) : per.sampai.slice(0, 7);
      const ang = Calc.anggaran(db, ymAng, ambang);
      const targets = db.target.filter(t => t.Status === 'Aktif');
      const nama = db.pengaturan.nama_pengguna || 'Pemilik';
      const sync = Store.waktuSync ? U.tglJam(Store.waktuSync) + ' WITA' : U.tglJam(db.dibuat) + ' WITA';

      // ---------------- KPI
      const kpi = `
        ${Dash.kartuSaldo(s, sLalu)}
        <a class="card tight kpi" href="${linkRiwayat({ jenis: 'Masuk', dari: per.dari, sampai: per.sampai })}" style="color:inherit;text-decoration:none">
          <div class="row-between"><span class="eyebrow">Pemasukan</span>${UI.delta(Calc.ubah(r.masuk, p.masuk))}</div>
          <div class="kpi-value md num">${rp(r.masuk)}</div><div class="kpi-sub">${e(per.nama.toLowerCase())}</div></a>
        <a class="card tight kpi" href="${linkRiwayat({ jenis: 'Keluar', dari: per.dari, sampai: per.sampai })}" style="color:inherit;text-decoration:none">
          <div class="row-between"><span class="eyebrow">Pengeluaran</span>${UI.delta(Calc.ubah(r.keluar, p.keluar), true)}</div>
          <div class="kpi-value md num">${rp(r.keluar)}</div><div class="kpi-sub">total keluar</div></a>
        <section class="card tight span-2 kpi" style="border-color:var(--accent-ring)">
          <div class="row-between"><div><span class="eyebrow">Arus kas bersih</span><div class="kpi-value md num ${r.net >= 0 ? 't-accent' : 't-danger'}" style="margin-top:8px">${rp(r.net, { tanda: true })}</div></div>
          <span class="row" style="gap:8px">${r.masuk ? `<span class="badge ${r.net >= 0 ? 'solid' : 'danger'}">${r.net >= 0 ? '▲' : '▼'} ${U.persen(Math.abs(r.net) / r.masuk * 100)} ${r.net >= 0 ? 'Surplus' : 'Defisit'}</span>` : ''}${UI.delta(Calc.ubah(r.net, p.net))}</span></div>
        </section>`;

      // ---------------- Arus kas + insight
      const arus = `
        <section class="card glow o-2" aria-labelledby="h-arus">
          <div class="card-head"><div><div class="eyebrow accent">Arus kas</div><h2 class="card-title mt-8" id="h-arus">Pemasukan vs Pengeluaran</h2></div>
            <div class="seg" role="tablist"><button type="button" role="tab" data-tab="bulanan" class="${st.tab === 'bulanan' ? 'active' : ''}" aria-selected="${st.tab === 'bulanan'}">Bulanan</button><button type="button" role="tab" data-tab="mingguan" class="${st.tab === 'mingguan' ? 'active' : ''}" aria-selected="${st.tab === 'mingguan'}">Mingguan</button></div></div>
          <div class="g" style="grid-template-columns:minmax(0,1.45fr) minmax(0,1fr)" data-arus-grid>
            <div class="panel inset" style="padding:18px">
              <div class="row-between"><div class="legend"><span style="--c:var(--chart-in)"><i></i>Pemasukan</span><span style="--c:var(--chart-out)"><i></i>Pengeluaran</span></div><span class="faint hide-m" style="font-size:12px">Klik batang → riwayat</span></div>
              <div class="chart-box mt-12"><canvas id="c-arus" aria-label="Grafik pemasukan dan pengeluaran" role="img"></canvas></div>
            </div>
            <div class="panel" data-insight>${Dash.insightHtml(db, per, ambang)}</div>
          </div>
        </section>`;

      // ---------------- Breakdown kategori
      const top = r.perKat.slice(0, 5), lain = r.perKat.slice(5).reduce((a, k) => a + k.nominal, 0);
      const seg = top.map(k => ({ id: k.id, nama: k.kat.Nama, warna: k.kat.Warna, nominal: k.nominal, persen: k.persen }));
      if (lain) seg.push({ id: '', nama: 'Lainnya', warna: 'abu', nominal: lain, persen: lain / r.keluar * 100 });
      const breakdown = `
        <section class="card" aria-labelledby="h-kat">
          <div class="card-head"><h2 class="card-title" id="h-kat">Pengeluaran per Kategori</h2><span class="eyebrow">${e(per.label)}</span></div>
          <div class="kpi-value num" style="margin-top:0">${rp(r.keluar)}</div><div class="kpi-sub">Total pengeluaran tercatat</div>
          ${r.keluar ? `<div class="segbar mt-24" role="img" aria-label="Komposisi pengeluaran">${seg.map(x => `<span class="c-${e(x.warna)}" style="flex-grow:${x.nominal}" title="${e(x.nama)} ${U.persen(x.persen)}" data-kat="${x.id}"></span>`).join('')}</div>
            <div class="legend-grid mt-24">${seg.map(x => `<button type="button" data-kat="${x.id}" class="c-${e(x.warna)}"><i class="dotc"></i><span class="nm">${e(x.nama)}</span><span class="pc">${U.persen(x.persen)}</span></button>`).join('')}</div>`
            : UI.kosong('pie-chart', 'Belum ada pengeluaran periode ini', 'Catat pengeluaran pertama Anda untuk melihat komposisinya.')}
          <div class="divider"></div><div class="right"><a class="link-more" href="#/laporan">Lihat detail ${UI.ic('arrow-right', 'ic-sm')}</a></div>
        </section>`;

      // ---------------- Anggaran
      const anggaran = `
        <section class="card" aria-labelledby="h-ang">
          <div class="card-head"><h2 class="card-title" id="h-ang">Anggaran ${ymAng === U.hariIni().slice(0, 7) ? 'Bulan Ini' : U.bulan(ymAng)}</h2><span class="eyebrow">${ang.length} kategori</span></div>
          ${ang.length ? ang.slice(0, 4).map(x => `
            <a class="item" href="#/anggaran?bulan=${ymAng}" style="display:block;color:inherit;text-decoration:none">
              <div class="row-between"><span class="row" style="gap:10px">${UI.tileKat(x.kat, 'sm')}<b style="font-size:14.5px">${e(x.kat.Nama)}</b></span>${Dash.badgeAng(x)}</div>
              <div class="mt-12">${UI.progress(x.persen, x.status)}</div>
              <div class="row-between mt-8" style="font-size:13px"><span class="muted num">${rp(x.pakai)} / ${rp(x.batas)}</span><b class="num ${x.status === 'lewat' ? 't-danger' : x.status === 'hampir' ? 't-warn' : ''}">${U.persen(x.persen)}</b></div>
            </a>`).join('') : UI.kosong('pie-chart', 'Belum ada anggaran', 'Tetapkan batas per kategori agar pengeluaran terkendali.', '<a class="btn btn-secondary btn-sm mt-8" href="#/anggaran">Atur anggaran</a>')}
          <div class="divider"></div><div class="right"><a class="link-more" href="#/anggaran">Kelola anggaran ${UI.ic('arrow-right', 'ic-sm')}</a></div>
        </section>`;

      // ---------------- Transaksi terbaru
      const kini = U.sekarang().iso;
      const terbaru = db.trx.filter(t => t.Status !== 'Dihapus' && t.Tanggal <= kini && (st.jenis === 'semua' || t.Jenis === st.jenis))
        .sort((a, b) => (a.Tanggal < b.Tanggal ? 1 : a.Tanggal > b.Tanggal ? -1 : (a.Dibuat_Pada < b.Dibuat_Pada ? 1 : -1))).slice(0, 5);
      const recent = `
        <section class="card o-6" aria-labelledby="h-baru">
          <div class="card-head"><h2 class="card-title" id="h-baru">Transaksi Terbaru</h2>
            <span class="row" style="gap:8px"><button class="chip" type="button" data-jenis-menu>${st.jenis === 'semua' ? 'Semua jenis' : st.jenis} ${UI.ic('chevron-down', 'ic-xs')}</button><a class="icon-btn outlined" href="#/riwayat" aria-label="Buka riwayat" style="width:36px;height:36px">${UI.ic('arrow-up-right', 'ic-sm')}</a></span></div>
          <div class="list">${terbaru.length ? terbaru.map(t => Dash.itemTrx(t, ix)).join('') : UI.kosong('receipt', 'Belum ada transaksi', 'Tekan <b>Catat Transaksi</b> untuk mulai.')}</div>
        </section>`;

      // ---------------- Target
      const target = `
        <section class="card o-5" aria-labelledby="h-tgt">
          <div class="card-head"><h2 class="card-title" id="h-tgt">Target Tabungan</h2><a class="link-more" href="#/target">Kelola ${UI.ic('arrow-right', 'ic-sm')}</a></div>
          ${targets.length ? targets.slice(0, 3).map(t => { const i = Calc.target(db, t); return `
            <a class="panel row mt-12" href="#/target?id=${t.ID}" style="color:inherit;text-decoration:none">${UI.ring(i.persen, 52, 5, U.persen(i.persen), i.tercapai ? 'hijau' : 'oranye')}
              <div class="grow"><b>${e(t.Nama)}</b><div class="muted num" style="font-size:13px">${rp(i.terkumpul)} / ${rp(t.Nominal_Target)}</div></div>${UI.ic('chevron-right', 'ic-sm')}</a>`; }).join('')
            : UI.kosong('target', 'Belum ada target', 'Buat target tabungan dan pantau progresnya.', '<a class="btn btn-secondary btn-sm mt-8" href="#/target?baru=1">Buat target</a>')}
        </section>`;

      // ---------------- Transfer terakhir
      const tf = db.trx.filter(t => t.Jenis === 'Transfer' && t.Status === Calc.OK).sort((a, b) => (a.Tanggal < b.Tanggal ? 1 : -1))[0];
      const transfer = tf ? `
        <section class="card tight o-7" aria-label="Transfer terakhir">
          <div class="row-between"><span class="eyebrow">${tf.Sumber === 'Kontribusi' ? 'Kontribusi terakhir' : 'Transfer terakhir'}</span><span class="muted" style="font-size:13px">${U.tgl(tf.Tanggal)}</span></div>
          <div class="panel inset route mt-12">${Dash.ujung(ix.dompet.get(tf.Dompet_Asal_ID))}
            <div class="grow"><div class="amt-mid num">${rp(tf.Nominal)}</div><div class="line"></div></div>${Dash.ujung(ix.dompet.get(tf.Dompet_Tujuan_ID), true)}</div>
        </section>` : '';

      return `
        <div class="page-head">
          <div><h1 class="page-title">${App.halaman === 'dashboard' && window.innerWidth < 761 ? 'Halo, ' + e(nama.split(' ')[0]) : 'Ringkasan Keuangan'} <span class="badge ok"><i class="bd"></i>LIVE</span></h1>
            <div class="updated"><span class="live-dot ${Store.pending ? 'sync' : ''}"></span>Terakhir diperbarui: ${sync}</div></div>
          <div class="page-actions">
            <button class="btn btn-secondary" type="button" data-periode>${UI.ic('calendar', 'ic-sm')} ${e(per.nama)} ${UI.ic('chevron-down', 'ic-xs')}</button>
            <button class="btn btn-primary" type="button" data-catat>${UI.ic('plus', 'ic-sm')} Catat Transaksi</button>
          </div>
        </div>
        ${!db.dompet.length ? `<div class="note accent" style="margin-bottom:20px">${UI.ic('sparkles', 'ic-sm')}<span><b>Selamat datang!</b> Mulai dengan menambahkan dompet (tunai, rekening bank, e-wallet, atau tabungan) beserta saldo awalnya. <a href="#/dompet?baru=1"><b>Tambah dompet →</b></a></span></div>` : ''}
        <div class="dash">
          <div class="dash-col">${arus}<div class="g g-2 o-4">${breakdown}${anggaran}</div></div>
          <div class="dash-col"><div class="g-kpi kpi-strip o-1">${kpi}</div>${recent}${target}${transfer}</div>
        </div>`;
    },

    /** Kartu Total Saldo + tombol mata (sembunyikan semua nominal di Dashboard). */
    kartuSaldo(s, sLalu) {
      const h = sembunyi(), t = (h ? 'Tampilkan' : 'Sembunyikan') + ' semua nominal di Dashboard';
      return `<section class="card glow span-2 kpi" aria-label="Total saldo">
          <div class="row-between"><span class="eyebrow">Total saldo
            <button class="icon-btn" type="button" data-sembunyi aria-pressed="${h}" aria-label="${t}" title="${t}" style="width:32px;height:32px">${UI.ic(h ? 'eye-off' : 'eye', 'ic-sm')}</button></span>
            <span class="row" style="gap:8px">${UI.delta(Calc.ubah(s.total, sLalu.total))}<a class="icon-btn" href="#/dompet" aria-label="Lihat dompet" style="width:32px;height:32px">${UI.ic('arrow-up-right', 'ic-sm')}</a></span></div>
          <div class="kpi-value xl num">${rp(s.total)}</div>
          <div class="kpi-sub num">Likuid ${rp(s.likuid)} · Tabungan ${rp(s.tabungan)}</div>
        </section>`;
    },

    badgeAng(x) {
      return x.status === 'lewat' ? UI.badge('Terlampaui', 'danger') : x.status === 'hampir' ? UI.badge('Hampir habis', 'warn') : UI.badge('Aman', 'ok');
    },
    ujung(d, kanan) {
      d = d || { Nama: '?', Tipe: '' };
      return `<div class="end" style="${kanan ? 'flex-direction:row-reverse;text-align:right' : ''}">${UI.tileDompet(d, 'sm')}<div><div class="nm">${e(d.Nama)}</div><div class="faint" style="font-size:11.5px">${e(d.Tipe)}</div></div></div>`;
    },
    itemTrx(t, ix) {
      const k = ix.kategori.get(t.Kategori_ID);
      const nama = t.Catatan || (t.Jenis === 'Transfer' ? `${(ix.dompet.get(t.Dompet_Asal_ID) || {}).Nama || '?'} → ${(ix.dompet.get(t.Dompet_Tujuan_ID) || {}).Nama || '?'}` : (k ? k.Nama : t.Jenis));
      const kelas = t.Jenis === 'Masuk' ? 'in' : t.Jenis === 'Keluar' ? 'out' : 'tr';
      const nilai = t.Jenis === 'Masuk' ? rp(t.Nominal, { tanda: true }) : t.Jenis === 'Keluar' ? rp(-t.Nominal) : rp(t.Nominal);
      return `<button type="button" class="item clickable ${String(t.ID_Transaksi).startsWith('tmp-') ? 'pending-sync' : ''}" data-trx="${e(t.ID_Transaksi)}">
        ${UI.tileTrx(t, ix)}<div class="meta"><div class="ttl">${e(nama)}</div><div class="sub"><span>${U.relatif(t.Tanggal)}</span><span class="sep"></span>${UI.statusTrx(t)}</div></div>
        <div class="amt ${kelas}">${nilai}</div></button>`;
    },

    insightHtml(db, per, ambang) {
      const semua = Calc.insights(db, per, ambang, rp);
      const chips = [['semua', 'Semua'], ['kategori', 'Kategori terbesar'], ['anggaran', 'Anggaran'], ['aruskas', 'Arus kas'], ['target', 'Target']];
      const tampil = (st.chip === 'semua' ? semua.slice(0, 3) : semua.filter(x => x.tipe === st.chip));
      return `<div class="row-between"><h3 style="font-size:17px">Insight Keuangan</h3>${UI.ic('trending-up', 'ic-sm t-accent')}</div>
        <div class="chips wrap mt-12" role="tablist" aria-label="Jenis insight">${chips.map(([k, l]) => `<button type="button" class="chip ${st.chip === k ? 'active' : ''}" style="min-height:30px;font-size:12.5px" data-chip="${k}" role="tab" aria-selected="${st.chip === k}">${l}</button>`).join('')}</div>
        <div class="mt-16">${tampil.length ? tampil.map(x => `<a class="insight c-${x.warna}" href="${x.link}" style="color:inherit;text-decoration:none"><span class="bullet"></span><span>${x.html}</span></a>`).join('')
          : '<div class="insight"><span class="bullet"></span><span class="muted">Belum ada data untuk insight ini pada periode terpilih.</span></div>'}</div>
        <p class="faint row mt-16" style="font-size:12px;gap:6px">${UI.ic('info', 'ic-xs')} Dihitung otomatis dari data Anda (tanpa AI)</p>`;
    },

    pasang(el) {
      const db = Store.db, per = App.periode();
      el.querySelector('[data-periode]').onclick = ev => App.pilihPeriode(ev.currentTarget);
      el.querySelector('[data-catat]').onclick = () => App.catat();
      el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { st.tab = b.dataset.tab; App.render(); });
      el.addEventListener('click', ev => {
        if (ev.target.closest('[data-sembunyi]')) {
          U.simpanLokal('cs_sembunyi_saldo', sembunyi() ? '0' : '1');
          App.render();
          const t = document.querySelector('#view [data-sembunyi]');
          if (t) t.focus({ preventScroll: true });
          return;
        }
        const c = ev.target.closest('[data-chip]');
        if (c) { st.chip = c.dataset.chip; el.querySelector('[data-insight]').innerHTML = Dash.insightHtml(Store.db, App.periode(), App.ambang()); return; }
        const k = ev.target.closest('[data-kat]');
        if (k) return App.go('#/riwayat?' + U.qs({ jenis: 'Keluar', kat: k.dataset.kat, dari: per.dari, sampai: per.sampai }));
        const t = ev.target.closest('[data-trx]');
        if (t) {
          const trx = Calc.idx(Store.db).trx.get(t.dataset.trx);
          if (!trx) return;
          if (trx.Status === Calc.DRAF) { const g = Calc.idx(Store.db).tagihan.get((trx.Ref_ID || '').split('@')[0]); if (g) return Aksi.bayarTagihan(g, trx.Ref_ID.split('@')[1], trx); }
          return App.catat({ trx });
        }
      });
      const jm = el.querySelector('[data-jenis-menu]');
      jm.onclick = () => UI.menu(jm, [['semua', 'Semua jenis'], ['Masuk', 'Pemasukan'], ['Keluar', 'Pengeluaran'], ['Transfer', 'Transfer']].map(([k, l]) => ({ label: l, ikon: st.jenis === k ? 'check' : 'list', fn: () => { st.jenis = k; App.render(); } })));

      Charts.siap.then(() => {
        const cv = el.querySelector('#c-arus');
        if (!cv || !cv.isConnected) return;
        if (st.tab === 'bulanan') {
          const bulan = seriBulan(per), data = Calc.bulanan(db, bulan);
          Charts.batang(cv, {
            labels: bulan.map(m => U.bulanNama(m)), masuk: data.map(d => d.masuk), keluar: data.map(d => d.keluar),
            sorot: bulan.map(m => per.bulan.indexOf(m) >= 0), sembunyi: sembunyi(),
            onKlik: (i, ds) => { const m = bulan[i]; App.go('#/riwayat?' + U.qs({ jenis: ds === 0 ? 'Masuk' : 'Keluar', dari: m + '-01', sampai: m + '-' + U.hariDalam(m) })); }
          });
        } else {
          const akhir = per.sampai > U.hariIni() ? U.hariIni() : per.sampai;
          const mg = Calc.mingguan(db, per.dari, akhir < per.dari ? per.dari : akhir);
          Charts.batang(cv, {
            labels: mg.map(w => w.label), masuk: mg.map(w => w.masuk), keluar: mg.map(w => w.keluar), sembunyi: sembunyi(),
            onKlik: (i, ds) => App.go('#/riwayat?' + U.qs({ jenis: ds === 0 ? 'Masuk' : 'Keluar', dari: mg[i].dari, sampai: mg[i].sampai }))
          });
        }
      });
    }
  };

  window.Pages.dashboard = Dash;
})();
