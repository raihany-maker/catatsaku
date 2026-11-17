/* Cangkang aplikasi: tema, header & navigasi, router hash, alur masuk/kunci, sesi idle, sinkronisasi. */
(function () {
  const e = U.esc;
  const NAV = [
    ['dashboard', 'Dashboard', 'layout-grid'], ['riwayat', 'Riwayat', 'list'], ['dompet', 'Dompet', 'wallet'],
    ['anggaran', 'Anggaran', 'pie-chart'], ['target', 'Target', 'target'], ['laporan', 'Laporan', 'bar-chart'], ['tagihan', 'Tagihan', 'receipt']
  ];
  const $ = s => document.querySelector(s);
  let lepas = null, timerIdle = 0, aktifTerakhir = Number(U.bacaLokal('cs_aktif') || 0);

  const App = {
    halaman: 'dashboard', params: {}, siapData: false,

    // ------------------------------------------------------------ tema
    tema: {
      mode() { return U.bacaLokal('cs_tema') || 'sistem'; },
      gelap(m) { m = m || App.tema.mode(); return m === 'gelap' || (m === 'sistem' && !window.matchMedia('(prefers-color-scheme: light)').matches); },
      terapkan(m, simpanServer) {
        U.simpanLokal('cs_tema', m);
        const html = document.documentElement;
        html.classList.add('tema-transisi');
        html.dataset.theme = App.tema.gelap(m) ? 'dark' : 'light';
        document.querySelector('meta[name=theme-color]').content = App.tema.gelap(m) ? '#140D0A' : '#FAF6F2';
        setTimeout(() => html.classList.remove('tema-transisi'), 260);
        App.header();
        if (Store.db) App.render();
        if (simpanServer && Store.db && Store.db.pengaturan.tema !== m) {
          Store.mutasi({ action: 'pengaturanSimpan', data: { nilai: { tema: m } }, optimis: db => { db.pengaturan = Object.assign({}, db.pengaturan, { tema: m }); }, terapkan: (db, r) => { db.pengaturan = r.pengaturan; } }).catch(() => {});
        }
      },
      alih() { App.tema.terapkan(App.tema.gelap() ? 'terang' : 'gelap', true); }
    },

    // ------------------------------------------------------------ periode global (Dashboard & Laporan)
    periodeState: U.bacaLokal('cs_periode', true) || { key: 'bulan-ini' },
    periode() { return Calc.periode(App.periodeState.key, App.periodeState); },
    setPeriode(key, khusus) {
      App.periodeState = Object.assign({ key }, khusus || {});
      U.simpanLokal('cs_periode', App.periodeState);
      App.render();
    },
    pilihPeriode(anchor) {
      const items = Calc.PERIODE.map(([k, n]) => ({ label: n, ikon: App.periodeState.key === k ? 'check' : 'calendar', fn: () => (k === 'khusus' ? App.rentangKhusus() : App.setPeriode(k)) }));
      UI.menu(anchor, [{ head: 'Periode' }].concat(items));
    },
    rentangKhusus() {
      const p = App.periode();
      UI.modal({
        kelas: 'sm', judul: 'Rentang khusus', label: 'Rentang khusus',
        isi: `<div class="g g-2"><div class="field"><label class="label" for="rk-dari">Dari</label><input class="input" type="date" id="rk-dari" value="${p.dari}"></div>
          <div class="field"><label class="label" for="rk-sampai">Sampai</label><input class="input" type="date" id="rk-sampai" value="${p.key === 'khusus' ? p.sampai : U.hariIni()}"></div></div>`,
        kaki: '<button class="btn btn-secondary" data-tutup type="button">Batal</button><button class="btn btn-primary" data-ok type="button">Terapkan</button>',
        onBuka: (el, tutup) => { el.querySelector('[data-ok]').onclick = () => { const d = el.querySelector('#rk-dari').value, s = el.querySelector('#rk-sampai').value; if (d && s) { tutup(); App.setPeriode('khusus', { dari: d, sampai: s }); } }; }
      });
    },

    // ------------------------------------------------------------ pengaturan turunan
    ambang() { return Number((Store.db && Store.db.pengaturan.ambang_anggaran_hampir) || 80); },
    sesiMenit() { return Number(U.bacaLokal('cs_sesi') || (Store.db && Store.db.pengaturan.sesi_menit) || 15); },
    setSesiMenit(m) { if (m) U.simpanLokal('cs_sesi', String(m)); },

    // ------------------------------------------------------------ mulai
    start() {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(() => { if (App.tema.mode() === 'sistem') App.tema.terapkan('sistem'); });
      Api.onAuthLost = msg => App.kunci(msg);
      window.addEventListener('hashchange', () => App.rute());
      Store.on(() => { if (App.siapData) App.render(); App.header(); });
      App.pasangIdle();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !Api.token) return;
        if (App.cekIdle()) return;
        if (Store.db) Store.sync().catch(() => {});
      });
      $('#boot').classList.add('out');
      setTimeout(() => $('#boot').remove(), 250);

      if (!Api.siap()) return App.belumKonfigurasi();
      const sesiMasihAda = Api.token && Date.now() - aktifTerakhir < App.sesiMenit() * 60e3;
      if (sesiMasihAda && Store.muatLokal()) {
        App.masuk();
      } else {
        Api.setToken('');
        Auth.tampil();
      }
    },

    belumKonfigurasi() {
      document.getElementById('lock').classList.remove('hidden');
      document.getElementById('lock').innerHTML = `<div class="lock-main"><div class="lock-card wide card"><div class="shield">${UI.ic('sliders')}</div>
        <h1 style="font-size:24px;text-align:center">URL backend belum diisi</h1>
        <p class="muted mt-12">Buka berkas <span class="code">js/config.js</span> lalu isi <span class="code">GAS_URL</span> dengan URL Web App Apps Script (berakhiran <span class="code">/exec</span>). Lihat PANDUAN-INSTALASI.md.</p></div></div>`;
    },

    /** Setelah PIN benar (atau sesi masih berlaku). */
    async masuk() {
      App.sentuh();
      $('#header').classList.remove('hidden');
      $('#foot').classList.remove('hidden');
      $('#bnav').classList.remove('hidden');
      App.siapData = true;
      if (Store.db || Store.muatLokal()) {
        App.rute();
        Store.sync(true).catch(err => { if (err.code !== 'AUTH') UI.toast('Mode luring', { tipe: 'warn', sub: 'Menampilkan data tersimpan. ' + err.message }); });
      } else {
        App.rute();
        try { await Store.bootstrap(); } catch (err) { if (err.code !== 'AUTH') { $('#view').innerHTML = UI.kosong('alert-triangle', 'Gagal memuat data', e(err.message), '<button class="btn btn-primary mt-12" onclick="location.reload()">Muat ulang</button>'); } }
      }
      // Pilihan tema di perangkat ini diutamakan; tema server hanya dipakai bila belum pernah memilih.
      const t = Store.db && Store.db.pengaturan.tema;
      if (t && !U.bacaLokal('cs_tema')) App.tema.terapkan(t);
    },

    kunci(pesan) {
      if (!document.getElementById('lock').classList.contains('hidden')) return;
      Api.setToken('');
      document.querySelectorAll('.ov, .pop').forEach(x => x.remove());
      Auth.tampil(pesan || 'Sesi berakhir. Masukkan PIN untuk melanjutkan.');
    },

    async keluar() {
      const ok = await UI.konfirmasi({ judul: 'Keluar dari Catatsaku?', pesan: 'Sesi diakhiri dan data tersimpan di perangkat ini dihapus. Data di Google Sheets tetap aman.', ok: 'Keluar', bahaya: true });
      if (!ok) return;
      Api.post('logout', {}).catch(() => {});
      Api.setToken('');
      Store.hapusLokal();
      App.siapData = false;
      $('#view').innerHTML = '';
      ['#header', '#foot', '#bnav'].forEach(s => $(s).classList.add('hidden'));
      Auth.tampil('Anda sudah keluar.');
    },

    // ------------------------------------------------------------ sesi idle (klien; server juga memeriksa)
    sentuh() { aktifTerakhir = Date.now(); U.simpanLokal('cs_aktif', String(aktifTerakhir)); },
    pasangIdle() {
      let t = 0;
      const aktif = () => { if (Date.now() - t > 5000 && Api.token) { t = Date.now(); App.sentuh(); } };
      ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, aktif, { passive: true }));
      clearInterval(timerIdle);
      timerIdle = setInterval(() => App.cekIdle(), 20000);
    },
    cekIdle() {
      if (!Api.token || !document.getElementById('lock').classList.contains('hidden')) return false;
      const lokal = Number(U.bacaLokal('cs_aktif') || aktifTerakhir);
      if (Date.now() - Math.max(lokal, aktifTerakhir) > App.sesiMenit() * 60e3) { App.kunci('Sesi berakhir karena tidak aktif. Masukkan PIN.'); return true; }
      return false;
    },

    // ------------------------------------------------------------ router
    go(hash) { if (location.hash === hash) App.rute(); else location.hash = hash; },
    rute() {
      const h = location.hash.replace(/^#\/?/, '');
      const [nama, q] = h.split('?');
      const baru = Pages[nama] && nama[0] !== '_' ? nama : 'dashboard';
      const ganti = baru !== App.halaman;
      App.halaman = baru;
      App.params = U.parseQs(q);
      App.header();
      App.render(true);
      if (ganti) window.scrollTo(0, 0);
    },
    render(rute) {
      const view = $('#view');
      if (!App.siapData) return;
      const p = Pages[App.halaman];
      if (!Store.db) { view.innerHTML = `<div class="page-head"><div class="skel" style="height:40px;width:300px"></div></div><div class="g g-dash"><div>${UI.skeleton(2, 220)}</div><div>${UI.skeleton(4, 90)}</div></div>`; return; }
      if (!rute && view.firstElementChild && p.perbarui && p.perbarui(view.firstElementChild, App.params)) return;
      const y = window.scrollY;
      Charts.hancurkanSemua();
      if (lepas) { try { lepas(); } catch (x) { /* abaikan */ } lepas = null; }
      // Elemen halaman selalu baru → listener lama ikut terbuang (tidak menumpuk).
      const root = document.createElement('div');
      root.className = 'pg';
      root.innerHTML = p.render(App.params);
      view.replaceChildren(root);
      lepas = p.pasang ? p.pasang(root, App.params) || null : null;
      document.title = (p.judul ? p.judul + ' · ' : '') + 'Catatsaku';
      if (!rute) window.scrollTo(0, y);
    },

    // ------------------------------------------------------------ header & navigasi
    header() {
      const db = Store.db, nama = (db && db.pengaturan.nama_pengguna) || 'Pemilik';
      const n = db ? App.notifikasi() : { jumlah: 0 };
      const lainnyaAktif = App.halaman === 'pengaturan';
      $('#header').innerHTML = `<div class="wrap">
        <a class="brand" href="#/dashboard" aria-label="Catatsaku — Dashboard"><img class="brand-mark" src="img/logo.svg" alt="" width="34" height="34"><span class="nm">Catatsaku</span></a>
        <nav class="nav-pills" aria-label="Menu utama">${NAV.map(([k, l]) => `<a class="nav-pill ${App.halaman === k ? 'active' : ''}" href="#/${k}" ${App.halaman === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}
          <button class="nav-pill ${lainnyaAktif ? 'active' : ''}" type="button" data-lainnya aria-haspopup="menu">Lainnya ${UI.ic('chevron-down', 'ic-xs')}</button></nav>
        <div class="header-actions">
          <span class="badge accent ${Store.pending ? '' : 'hidden'}" data-sync title="Menyimpan ke server"><span class="spinner" style="width:12px;height:12px"></span><span class="hide-m">Menyimpan…</span></span>
          <button class="icon-btn" type="button" data-cari aria-label="Cari transaksi">${UI.ic('search')}</button>
          <button class="icon-btn outlined" type="button" data-tema aria-label="Ganti tema (sekarang ${App.tema.gelap() ? 'gelap' : 'terang'})">${UI.ic(App.tema.gelap() ? 'moon' : 'sun')}</button>
          <button class="icon-btn" type="button" data-notif aria-label="Notifikasi${n.jumlah ? ', ' + n.jumlah + ' baru' : ''}">${UI.ic('bell')}${n.jumlah ? `<span class="dot">${n.jumlah > 9 ? '9+' : n.jumlah}</span>` : ''}</button>
          <span class="sep-v hide-m"></span>
          <button class="avatar" type="button" data-profil aria-label="Menu akun">${e(U.inisial(nama))}</button>
        </div></div>`;
      const h = $('#header');
      h.querySelector('[data-tema]').onclick = () => App.tema.alih();
      h.querySelector('[data-cari]').onclick = () => { App.go('#/riwayat?fokus=1'); };
      h.querySelector('[data-notif]').onclick = ev => App.menuNotif(ev.currentTarget);
      h.querySelector('[data-profil]').onclick = ev => App.menuAkun(ev.currentTarget);
      h.querySelector('[data-lainnya]').onclick = ev => App.menuLainnya(ev.currentTarget);
      App.navBawah();
    },
    navBawah() {
      const a = k => (App.halaman === k ? 'active' : '');
      const lainnya = ['dompet', 'anggaran', 'target', 'tagihan', 'pengaturan'].indexOf(App.halaman) >= 0;
      $('#bnav').innerHTML = `<div class="in">
        <a class="bn-item ${a('dashboard')}" href="#/dashboard">${UI.ic('layout-grid')}Beranda</a>
        <a class="bn-item ${a('riwayat')}" href="#/riwayat">${UI.ic('list')}Riwayat</a>
        <button class="bn-fab" type="button" data-catat aria-label="Catat transaksi">${UI.ic('plus')}</button>
        <a class="bn-item ${a('laporan')}" href="#/laporan">${UI.ic('bar-chart')}Laporan</a>
        <button class="bn-item ${lainnya ? 'active' : ''}" type="button" data-lainnya>${UI.ic('sliders')}Lainnya</button></div>`;
      $('#bnav').querySelector('[data-catat]').onclick = () => App.catat();
      $('#bnav').querySelector('[data-lainnya]').onclick = ev => App.menuLainnya(ev.currentTarget, true);
    },
    menuLainnya(anchor, lengkap) {
      const it = [];
      if (lengkap) {
        it.push({ ikon: 'wallet', label: 'Dompet', fn: () => App.go('#/dompet') }, { ikon: 'pie-chart', label: 'Anggaran', fn: () => App.go('#/anggaran') },
          { ikon: 'target', label: 'Target Tabungan', fn: () => App.go('#/target') }, { ikon: 'receipt', label: 'Tagihan', kanan: App.notifikasi().draf.length ? UI.badge(App.notifikasi().draf.length, 'warn') : '', fn: () => App.go('#/tagihan') }, { sep: 1 });
      }
      it.push({ ikon: 'sliders', label: 'Pengaturan', fn: () => App.go('#/pengaturan') }, { ikon: 'scroll', label: 'Log Aktivitas', fn: () => App.go('#/pengaturan?tab=log') },
        { ikon: 'refresh', label: 'Segarkan data dari Sheets', fn: () => App.segarkan() }, { sep: 1 }, { ikon: 'logout', label: 'Keluar', bahaya: true, fn: () => App.keluar() });
      UI.menu(anchor, it);
    },
    menuAkun(anchor) {
      const db = Store.db || { pengaturan: {}, meta: {} };
      UI.menu(anchor, [
        { html: `<span class="avatar" style="width:36px;height:36px">${e(U.inisial(db.pengaturan.nama_pengguna))}</span><span class="grow"><b>${e(db.pengaturan.nama_pengguna || 'Pemilik')}</b><br><span class="muted" style="font-size:12.5px">Pemilik · ${e(db.meta.email || '')}</span></span>`, fn: () => App.go('#/pengaturan') },
        { sep: 1 },
        { ikon: App.tema.gelap() ? 'sun' : 'moon', label: App.tema.gelap() ? 'Tema terang' : 'Tema gelap', fn: () => App.tema.alih() },
        { ikon: 'key', label: 'Ganti PIN', fn: () => App.go('#/pengaturan?tab=keamanan') },
        { ikon: 'lock', label: 'Kunci sekarang', fn: () => App.kunci('Aplikasi dikunci.') },
        { sep: 1 }, { ikon: 'logout', label: 'Keluar', bahaya: true, fn: () => App.keluar() }
      ]);
    },
    notifikasi() {
      const db = Store.db;
      if (!db) return { draf: [], anggaran: [], telat: [], jumlah: 0 };
      const draf = db.trx.filter(t => t.Status === Calc.DRAF);
      const anggaran = Calc.anggaran(db, U.hariIni().slice(0, 7), App.ambang()).filter(x => x.status !== 'aman');
      const telat = db.tagihan.filter(g => g.Status === 'Aktif').map(g => ({ g, s: Calc.tagihan(db, g) })).filter(x => x.s.status === 'Terlewat' && !x.s.draf);
      return { draf, anggaran, telat, jumlah: draf.length + anggaran.filter(x => x.status === 'lewat').length + telat.length };
    },
    menuNotif(anchor) {
      const n = App.notifikasi(), ix = Calc.idx(Store.db), it = [{ head: 'Notifikasi' }];
      n.draf.slice(0, 5).forEach(t => it.push({ html: `<span class="tile sm c-amber">${UI.ic('receipt', 'ic-sm')}</span><span class="meta"><b>${e(t.Catatan || 'Tagihan')}</b><br><span class="s">Menunggu konfirmasi · ${U.rp(t.Nominal)} · ${U.tglPendek(t.Tanggal)}</span></span>`, kelas: 'notif', fn: () => App.go('#/tagihan') }));
      n.telat.forEach(x => it.push({ html: `<span class="tile sm c-mawar">${UI.ic('alert-circle', 'ic-sm')}</span><span class="meta"><b>${e(x.g.Nama)}</b><br><span class="s">Terlewat · jatuh tempo ${U.tglPendek(x.s.jatuh)}</span></span>`, kelas: 'notif', fn: () => App.go('#/tagihan') }));
      n.anggaran.forEach(x => it.push({ html: `<span class="tile sm c-${x.status === 'lewat' ? 'mawar' : 'amber'}">${UI.ic('pie-chart', 'ic-sm')}</span><span class="meta"><b>${e(x.kat.Nama)}</b><br><span class="s">Anggaran ${x.status === 'lewat' ? 'terlampaui' : 'hampir habis'} · ${U.persen(x.persen)}</span></span>`, kelas: 'notif', fn: () => App.go('#/anggaran') }));
      if (it.length === 1) it.push({ html: `<span class="muted" style="padding:6px 0">Semua beres — tidak ada yang perlu ditindaklanjuti.</span>`, kelas: 'notif' });
      void ix;
      UI.menu(anchor, it);
    },
    statusSinkron() {
      const b = document.querySelector('[data-sync]');
      if (b) b.classList.toggle('hidden', !Store.pending);
    },
    async segarkan() {
      UI.toast('Menyegarkan data…', { tipe: 'info', ms: 1500 });
      try { await Store.bootstrap(true); UI.toast('Data terbaru dimuat dari Google Sheets'); } catch (err) { UI.galat(err, 'Gagal menyegarkan'); }
    },

    /** Buka form catat (Masuk/Keluar/Transfer) atau ubah transaksi. */
    catat(o) { Pages._catat.buka(o || {}); }
  };

  window.App = App;
  window.Pages = window.Pages || {};
  document.addEventListener('DOMContentLoaded', () => App.start());
})();
