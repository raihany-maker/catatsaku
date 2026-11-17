/* Pengaturan & Log Aktivitas: tema, keamanan & PIN, parameter keuangan, kategori, alokasi, integrasi Google, log (hanya baca). */
(function () {
  window.Pages = window.Pages || {};
  const e = U.esc;
  const TAB = [['umum', 'Umum & Tampilan'], ['keamanan', 'Keamanan & PIN'], ['keuangan', 'Parameter Keuangan'], ['kategori', 'Kategori'], ['integrasi', 'Integrasi Google'], ['log', 'Log Aktivitas']];
  let log = { items: null, total: 0, hal: 1, cari: '', memuat: false, galat: '' };

  function simpanSetel(nilai, pesan) {
    Store.mutasi({
      action: 'pengaturanSimpan', data: { nilai },
      optimis: db => { const lama = db.pengaturan; db.pengaturan = Object.assign({}, lama, nilai); return d => { d.pengaturan = lama; }; },
      terapkan: (db, r) => { db.pengaturan = r.pengaturan; }
    }).then(() => { if (nilai.sesi_menit) App.setSesiMenit(nilai.sesi_menit); })
      .catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Pengaturan tidak tersimpan'); });
    if (pesan !== false) UI.toast(pesan || 'Pengaturan disimpan');
  }
  const baris = (judul, sub, kanan) => `<div class="setting-row"><div class="grow"><div class="t">${judul}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>${kanan}</div>`;
  const saklar = (kunci, nilai, label) => `<label class="switch"><input type="checkbox" data-saklar="${kunci}" ${nilai === 'Ya' ? 'checked' : ''} aria-label="${e(label)}"><span></span></label>`;

  const P = {
    judul: 'Pengaturan',
    render(p) {
      const tab = TAB.some(t => t[0] === p.tab) ? p.tab : 'umum';
      const db = Store.db;
      return `
        <div class="page-head">
          <div><div class="crumb"><span class="live-dot" style="width:6px;height:6px"></span> Modul administrasi · Asia/Makassar</div><h1 class="page-title">Pengaturan &amp; Log Aktivitas</h1>
            <p class="page-sub">Preferensi tampilan, kebijakan keamanan, parameter keuangan, integrasi Google Workspace, dan jejak audit.</p></div>
          <div class="card tight row" style="gap:10px"><span class="live-dot" style="background:var(--ok);box-shadow:0 0 0 4px var(--ok-soft)"></span><div><div class="eyebrow" style="color:var(--text)">Status sistem</div><div class="muted" style="font-size:12px">v${e(db.meta.versi || '1.0.0')} · WITA aktif</div></div></div>
        </div>
        <div class="tabbar" role="tablist">${TAB.map(([k, l]) => `<a class="chip ${tab === k ? 'active' : ''}" role="tab" aria-selected="${tab === k}" href="#/pengaturan?tab=${k}">${l}${k === 'log' && log.total ? ` <span class="count">${log.total}</span>` : ''}</a>`).join('')}</div>
        <div data-isi>${P['tab_' + tab](db)}</div>`;
    },

    tab_umum(db) {
      const m = App.tema.mode(), set = db.pengaturan;
      const kartu = (k, l, pv, sub) => `<button type="button" class="theme-card ${m === k ? 'active' : ''}" data-tema="${k}" aria-pressed="${m === k}"><div class="row-between"><b>${l}</b>${m === k ? UI.ic('check-circle', 'ic-sm t-accent') : ''}</div><div class="pv ${pv}"></div><div class="muted" style="font-size:12px">${sub}</div></button>`;
      return `<div class="g g-2">
        <section class="card"><div class="row-between"><div class="row">${UI.ic('palette')}<div><h2 class="card-title">Tema antarmuka</h2><p class="card-sub">Berlaku instan untuk seluruh halaman & grafik</p></div></div><span class="badge accent">${App.tema.gelap() ? 'Warm Ember' : 'Warm Cream'}</span></div>
          <div class="theme-cards mt-16">${kartu('gelap', 'Gelap', 'd', 'Warm Ember')}${kartu('terang', 'Terang', 'l', 'Warm Cream')}${kartu('sistem', 'Ikuti sistem', 's', 'Otomatis OS')}</div>
          <p class="faint mt-12 row" style="font-size:12.5px;gap:6px">${UI.ic('info', 'ic-xs')} Ekspor PDF/Excel & email selalu memakai tampilan terang agar nyaman dicetak.</p></section>
        <section class="card"><div class="row">${UI.ic('globe')}<div><h2 class="card-title">Preferensi regional & profil</h2><p class="card-sub">Standar data lokal aplikasi</p></div></div>
          <div class="field mt-16"><label class="label" for="nm">Nama tampilan</label><div class="row"><input class="input" id="nm" maxlength="40" value="${e(set.nama_pengguna)}"><button class="btn btn-secondary" type="button" data-simpan-nama>Simpan</button></div></div>
          <div class="mt-16">${baris('Zona waktu operasional', 'Asia/Makassar (WITA, UTC+08:00)', UI.badge(UI.ic('lock', 'ic-xs') + ' Terkunci di appsscript.json'))}
          ${baris('Mata uang', 'Rupiah Indonesia (IDR – Rp), bilangan bulat', UI.badge(UI.ic('lock', 'ic-xs') + ' Tetap'))}
          ${baris('Format tanggal', 'DD MMM YYYY (cth. ' + U.tgl(U.hariIni()) + ')', UI.badge('Standar', 'ok'))}</div></section></div>`;
    },

    tab_keamanan(db) {
      const set = db.pengaturan, nama = set.nama_pengguna || 'Pemilik';
      return `<div class="g g-2">
        <section class="card"><div class="row-between"><div class="row">${UI.ic('shield')}<div><h2 class="card-title">Keamanan akses & pemilik</h2><p class="card-sub">Pengguna tunggal · sesi mandiri</p></div></div><span class="badge warn">${UI.ic('shield', 'ic-xs')} 5× salah → kunci 15 mnt</span></div>
          <div class="panel row mt-16"><span class="avatar" style="width:48px;height:48px;background:var(--accent-bg);color:var(--on-accent);border:0">${e(U.inisial(nama))}</span><div class="grow"><b>${e(nama)}</b> <span class="live-dot" style="display:inline-block;background:var(--ok);box-shadow:none;width:7px;height:7px"></span><div class="muted" style="font-size:12.5px">Pemilik tunggal · ${e(db.meta.email || '')}</div></div></div>
          <div class="mt-16">${baris('Sesi habis otomatis', 'Kunci aplikasi setelah tidak aktif', `<select class="select" data-sesi style="width:auto;min-height:40px;padding:6px 40px 6px 14px;font-size:14px">${[5, 10, 15, 30, 60].map(n => `<option value="${n}" ${String(n) === String(set.sesi_menit) ? 'selected' : ''}>${n} menit</option>`).join('')}</select>`)}
          ${baris('Kunci sekarang', 'Tampilkan layar PIN tanpa keluar', `<button class="btn btn-secondary btn-sm" type="button" data-kunci>${UI.ic('lock', 'ic-sm')} Kunci</button>`)}</div>
          <div class="note mt-16">${UI.ic('info', 'ic-sm')}<span>Hash PIN (SHA-256 iteratif + salt) disimpan di <b>Script Properties</b>, bukan di sheet. Lupa PIN → jalankan <span class="code">resetPin()</span> di editor Apps Script.</span></div></section>
        <section class="card"><div class="row">${UI.ic('key')}<div><h2 class="card-title">Ganti PIN</h2><p class="card-sub">Semua perangkat lain akan diminta PIN lagi</p></div></div>
          <form data-pin class="mt-16" novalidate>
            <div class="field"><label class="label" for="pl">PIN lama</label><input class="input pin-input" id="pl" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></div>
            <div class="g g-2 mt-16"><div class="field"><label class="label" for="pb">PIN baru</label><input class="input pin-input" id="pb" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div>
            <div class="field"><label class="label" for="pu">Ulangi PIN baru</label><input class="input pin-input" id="pu" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div></div>
            <p class="hint mt-8">6 digit angka, bukan berurutan (123456) atau sama semua.</p>
            <div class="err mt-12 hidden" data-err role="alert"></div>
            <button class="btn btn-primary mt-16" type="submit">${UI.ic('check', 'ic-sm')} Simpan PIN baru</button></form></section></div>`;
    },

    tab_keuangan(db) {
      const set = db.pengaturan, ambang = String(set.ambang_anggaran_hampir);
      const alok = db.alokasi || [], tot = alok.reduce((s, a) => s + a.Persen, 0);
      const ix = Calc.idx(db);
      return `<div class="g g-2">
        <section class="card"><div class="row">${UI.ic('landmark')}<div><h2 class="card-title">Parameter keuangan</h2><p class="card-sub">Ambang anggaran & kontrol kas</p></div></div>
          <div class="panel mt-16"><div class="row-between"><b>Ambang peringatan dini anggaran</b><span class="badge accent">${e(ambang)}%</span></div><p class="muted mt-8" style="font-size:13px">Status "hampir habis" & notifikasi saat realisasi kategori mencapai persentase ini.</p>
            <div class="seg block mt-12" role="group" aria-label="Ambang">${['70', '80', '90'].map(v => `<button type="button" data-ambang="${v}" class="${ambang === v ? 'active' : ''}">${v}%</button>`).join('')}</div></div>
          <div class="mt-12">${baris('Izinkan saldo minus', 'Catat transaksi walau saldo dompet tidak mencukupi', saklar('izinkan_saldo_minus', set.izinkan_saldo_minus, 'Izinkan saldo minus'))}</div></section>
        <section class="card"><div class="row">${UI.ic('mail')}<div><h2 class="card-title">Notifikasi email</h2><p class="card-sub">Satu email per kejadian (hemat kuota Gmail)</p></div></div>
          <div class="field mt-16"><label class="label" for="em">Email notifikasi</label><div class="row"><input class="input" id="em" type="email" value="${e(set.email_notifikasi)}" placeholder="nama@gmail.com"><button class="btn btn-secondary" type="button" data-simpan-email>Simpan</button></div></div>
          <div class="mt-16">${baris('Pengingat tagihan', 'H-n sebelum jatuh tempo (trigger 06:00 WITA)', saklar('pengingat_tagihan', set.pengingat_tagihan, 'Pengingat tagihan'))}
          ${baris('Peringatan anggaran', 'Saat hampir habis / terlampaui', saklar('peringatan_anggaran', set.peringatan_anggaran, 'Peringatan anggaran'))}
          ${baris('Ringkasan bulanan', 'Setiap tanggal 1 pukul 08:00 WITA', saklar('ringkasan_bulanan', set.ringkasan_bulanan, 'Ringkasan bulanan'))}</div></section>
        <section class="card" style="grid-column:1/-1"><div class="row-between"><div class="row">${UI.ic('split')}<div><h2 class="card-title">Alokasi pemasukan</h2><p class="card-sub">Rencana pembagian persen setiap pemasukan ke pos/dompet (mis. 50/30/20)</p></div></div><button class="btn btn-secondary btn-sm" type="button" data-alokasi>${UI.ic('pencil', 'ic-sm')} Atur alokasi</button></div>
          ${alok.length ? `<div class="g g-3 mt-16" style="gap:10px">${alok.map(a => `<div class="mini-stat"><div class="row-between"><b>${e(a.Pos)}</b><span class="badge accent">${a.Persen}%</span></div><div class="l mt-8">${e((ix.dompet.get(a.Dompet_ID) || {}).Nama || '?')}</div></div>`).join('')}</div>
            <p class="muted mt-12" style="font-size:13px">Total ${tot}%${tot < 100 ? ` · ${100 - tot}% bebas` : ''}. Saran alokasi tampil setiap kali Anda mencatat pemasukan.</p>` : '<p class="muted mt-16" style="font-size:14px">Belum diatur. Contoh: Kebutuhan 50% → BCA, Keinginan 30% → GoPay, Tabungan 20% → Tabungan.</p>'}</section></div>`;
    },

    tab_kategori(db) {
      const grup = j => db.kategori.filter(k => k.Jenis === j).sort((a, b) => (a.Aktif === b.Aktif ? a.Nama.localeCompare(b.Nama) : a.Aktif === 'Ya' ? -1 : 1));
      const daftar = j => grup(j).map(k => `<div class="item" style="${k.Aktif !== 'Ya' ? 'opacity:.55' : ''}">${UI.tileKat(k, 'sm')}<div class="meta"><div class="ttl" style="font-size:14.5px">${e(k.Nama)}</div><div class="sub">${k.Aktif === 'Ya' ? 'Aktif' : 'Nonaktif'}</div></div>
        <label class="switch"><input type="checkbox" data-kat-aktif="${k.ID}" ${k.Aktif === 'Ya' ? 'checked' : ''} aria-label="Aktifkan ${e(k.Nama)}"><span></span></label><button class="icon-btn" type="button" data-kat-ubah="${k.ID}" aria-label="Ubah ${e(k.Nama)}">${UI.ic('pencil', 'ic-sm')}</button></div>`).join('');
      return `<div class="row-between"><p class="muted">Kategori nonaktif disembunyikan dari form, riwayat tetap utuh.</p><button class="btn btn-primary" type="button" data-kat-baru>${UI.ic('plus', 'ic-sm')} Kategori baru</button></div>
        <div class="g g-2 mt-16"><section class="card"><h2 class="card-title row">${UI.ic('arrow-up-right', 'ic-sm t-accent')} Pengeluaran</h2><div class="list mt-12">${daftar('Keluar')}</div></section>
        <section class="card"><h2 class="card-title row">${UI.ic('arrow-down-left', 'ic-sm t-ok')} Pemasukan</h2><div class="list mt-12">${daftar('Masuk')}</div></section></div>`;
    },

    tab_integrasi(db) {
      const m = db.meta || {}, trig = m.trigger || [];
      const ada = n => trig.indexOf(n) >= 0;
      const link = (ikon, judul, sub, url) => `<a class="setting-row" href="${e(url || '#')}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><div class="row grow"><span class="tile sm c-${ikon === 'sheet' ? 'hijau' : 'amber'}">${UI.ic(ikon, 'ic-sm')}</span><div><div class="t">${judul}</div><div class="s">${sub}</div></div></div>${url ? UI.badge('Terhubung', 'ok', true) : UI.badge('Belum ada', 'warn')}</a>`;
      const jadwal = (n, l, w) => `<div class="mini-stat" style="text-align:center">${UI.ic(ada(n) ? 'check-circle' : 'alert-circle', 'ic-sm ' + (ada(n) ? 't-ok' : 't-warn'))}<div class="v" style="font-size:13.5px;margin-top:8px">${l}</div><div class="l">${w}</div></div>`;
      return `<div class="g g-2">
        <section class="card"><div class="row">${UI.ic('database')}<div><h2 class="card-title">Integrasi Google Workspace</h2><p class="card-sub">Penyimpanan cloud mandiri tanpa perantara</p></div></div>
          <div class="mt-16">${link('sheet', 'Database Google Sheets', 'Catatsaku — Database · disinkronkan ' + (Store.waktuSync ? U.relatif(Store.waktuSync).toLowerCase() : ''), m.spreadsheetUrl)}
          ${link('folder', 'Folder Drive aplikasi', 'Struk · Backup · Laporan', m.folderUrl)}
          ${link('folder', 'Folder Backup', m.backupTerakhir ? 'Backup terakhir ' + U.tglJam(m.backupTerakhir) + ' WITA' : 'Belum ada backup', m.folderBackupUrl)}
          ${link('folder', 'Folder Laporan', 'Hasil ekspor Excel & PDF', m.folderLaporanUrl)}</div></section>
        <section class="card"><div class="row">${UI.ic('clock')}<div><h2 class="card-title">Jadwal trigger otomatis</h2><p class="card-sub">Berjalan di server Google (WITA)</p></div></div>
          <div class="g g-2 mt-16" style="gap:10px">${jadwal('tugasHarian', 'Draf & pengingat', 'Harian 06:00')}${jadwal('tugasMingguan', 'Backup mingguan', 'Minggu 02:00')}${jadwal('tugasBulanan', 'Ringkasan bulanan', 'Tgl 1 · 08:00')}${jadwal('jagaHangat', 'Jaga cache hangat', 'Tiap 10 menit')}</div>
          ${trig.length < 3 ? `<div class="note warn mt-12">${UI.ic('alert-triangle', 'ic-sm')}<span>Trigger belum lengkap. Jalankan <span class="code">pasangTrigger()</span> di editor Apps Script.</span></div>` : ''}
          <button class="btn btn-primary btn-block btn-lg mt-16" type="button" data-backup>${UI.ic('cloud-upload', 'ic-sm')} Backup sekarang ke Google Drive</button>
          <button class="btn btn-secondary btn-block mt-12" type="button" data-segar>${UI.ic('refresh', 'ic-sm')} Segarkan data dari Sheets</button>
          <p class="faint mt-12" style="font-size:12.5px">Gunakan "Segarkan" bila Anda mengedit spreadsheet secara langsung. Backup menyimpan 12 salinan terbaru.</p></section></div>`;
    },

    tab_log() {
      const badgeAksi = a => { const t = { CREATE: 'ok', UPDATE: 'info', CONFIRM: 'warn', SOFT_DELETE: 'danger', DELETE: 'danger', RESTORE: 'accent', LOGIN_GAGAL: 'danger', AKTIVASI_GAGAL: 'danger' }[a] || ''; return UI.badge(e(a), t); };
      const ringkas = o => {
        if (!o.Nilai_Baru && !o.Nilai_Lama) return '<span class="faint">—</span>';
        try {
          const b = o.Nilai_Baru ? JSON.parse(o.Nilai_Baru) : {}, l = o.Nilai_Lama ? JSON.parse(o.Nilai_Lama) : {};
          if (Array.isArray(b)) return e(b.map(x => (x && typeof x === 'object' ? Object.values(x).slice(0, 4).join(' · ') : String(x))).join(' | ').slice(0, 160));
          if (o.Aksi === 'UPDATE' && o.Nilai_Lama) {
            const beda = Object.keys(b).filter(k => !/Diubah_Pada|Dibuat_Pada/.test(k) && JSON.stringify(b[k]) !== JSON.stringify(l[k])).slice(0, 3);
            return beda.map(k => `${e(k)}: <s class="faint">${e(String(l[k]).slice(0, 30))}</s> → <b>${e(String(b[k]).slice(0, 30))}</b>`).join('<br>') || 'tanpa perubahan nilai';
          }
          return e(JSON.stringify(b).slice(0, 140));
        } catch (x) { return e(String(o.Nilai_Baru).slice(0, 140)); }
      };
      let isi;
      if (log.galat) isi = UI.kosong('alert-triangle', 'Gagal memuat log', e(log.galat), '<button class="btn btn-secondary btn-sm mt-8" type="button" data-log-ulang>Coba lagi</button>');
      else if (!log.items) isi = UI.skeleton(6, 44);
      else if (!log.items.length) isi = UI.kosong('scroll', 'Belum ada log', '');
      else isi = `<div class="table-wrap"><table class="table cards"><thead><tr><th>Waktu (WITA)</th><th>Aksi</th><th>Entitas</th><th>ID referensi</th><th>Detail</th></tr></thead><tbody>
        ${log.items.map(o => `<tr><td data-l="Waktu" class="num" style="white-space:nowrap">${U.tglJam(o.Waktu)}</td><td data-l="Aksi">${badgeAksi(o.Aksi)}</td><td data-l="Entitas">${e(o.Entitas)}</td><td data-l="ID"><span class="code t-accent">${e(o.ID_Entitas)}</span></td><td data-l="Detail" style="font-size:12.5px;max-width:420px">${ringkas(o)}</td></tr>`).join('')}</tbody></table></div>`;
      const halMaks = Math.max(1, Math.ceil(log.total / 25));
      return `<section class="card"><div class="row-between" style="flex-wrap:wrap"><div class="row">${UI.ic('scroll')}<div><h2 class="card-title">Audit trail mandiri</h2><p class="card-sub">Setiap tambah/ubah/hapus tercatat · hanya baca${log.total ? ' · ' + log.total + ' entri' : ''}</p></div></div>
          <label class="input-icon" style="flex:0 1 300px"><span class="sr-only">Cari log</span>${UI.ic('search')}<input class="input" type="search" data-log-cari value="${e(log.cari)}" placeholder="Cari aksi, entitas, ID…" style="min-height:42px;border-radius:999px;font-size:14px"></label></div>
        <div class="mt-16">${isi}</div>
        ${log.items && log.total > 25 ? `<div class="row-between mt-16"><span class="muted" style="font-size:13.5px">Halaman ${log.hal} dari ${halMaks}</span><div class="row"><button class="btn btn-secondary btn-sm" type="button" data-log-hal="-1" ${log.hal <= 1 ? 'disabled' : ''}>${UI.ic('chevron-left', 'ic-sm')} Sebelumnya</button><button class="btn btn-secondary btn-sm" type="button" data-log-hal="1" ${log.hal >= halMaks ? 'disabled' : ''}>Berikutnya ${UI.ic('chevron-right', 'ic-sm')}</button></div></div>` : ''}</section>`;
    },

    async muatLog(el) {
      if (log.memuat) return;
      log.memuat = true; log.galat = '';
      try {
        const r = await Api.post('logList', { hal: log.hal, per: 25, cari: log.cari });
        log.items = r.items; log.total = r.total;
      } catch (err) { log.galat = err.message; }
      log.memuat = false;
      const isi = el.isConnected && el.querySelector('[data-isi]');
      if (isi && App.params.tab === 'log') { isi.innerHTML = P.tab_log(); P.pasangLog(el); }
    },
    pasangLog(el) {
      const c = el.querySelector('[data-log-cari]');
      if (c) c.addEventListener('input', U.debounce(() => { log.cari = c.value; log.hal = 1; P.muatLog(el); }, 350));
    },

    formKategori(k) {
      const s = k ? Object.assign({}, k) : { Nama: '', Jenis: 'Keluar', Ikon: 'tag', Warna: 'oranye', Aktif: 'Ya' };
      UI.drawer({
        label: k ? 'Ubah kategori' : 'Kategori baru', judul: k ? 'Ubah Kategori' : 'Kategori Baru', sub: 'Ikon & warna selalu disertai nama (aksesibel).',
        isi: `<div class="field"><label class="label" for="k-nama">Nama kategori</label><input class="input" id="k-nama" maxlength="40" value="${e(s.Nama)}" placeholder="cth: Kopi & Jajan"></div>
          <div class="field"><span class="label">Jenis</span><div class="seg block" role="group" aria-label="Jenis kategori">${['Keluar', 'Masuk'].map(j => `<button type="button" data-j="${j}" class="${s.Jenis === j ? 'active' : ''}">${j === 'Keluar' ? 'Pengeluaran' : 'Pemasukan'}</button>`).join('')}</div>${k ? '<span class="hint">Jenis tidak bisa diubah bila kategori sudah dipakai transaksi.</span>' : ''}</div>
          <div class="field"><span class="label">Ikon</span><div class="icon-grid" role="radiogroup" aria-label="Ikon">${window.IKON_KATEGORI.map(i => `<button type="button" data-ikon="${i}" class="${s.Ikon === i ? 'active' : ''}" role="radio" aria-checked="${s.Ikon === i}" aria-label="${i}">${UI.ic(i, 'ic-sm')}</button>`).join('')}</div></div>
          <div class="field"><span class="label">Warna</span><div class="swatches" role="radiogroup" aria-label="Warna">${['oranye', 'amber', 'hijau', 'biru', 'mawar', 'abu'].map(c => `<button type="button" class="swatch c-${c} ${s.Warna === c ? 'active' : ''}" data-warna="${c}" role="radio" aria-checked="${s.Warna === c}" aria-label="${c}">${s.Warna === c ? UI.ic('check', 'ic-sm') : ''}</button>`).join('')}</div></div>
          <div class="panel row mt-16" data-pv>${UI.tileKat(s)}<b>${e(s.Nama || 'Pratinjau')}</b></div>
          <div class="err mt-16 hidden" data-err role="alert"></div>`,
        kaki: `<button class="btn btn-ghost" type="button" data-tutup>Batal</button><button class="btn btn-primary" type="button" data-ok>${UI.ic('check', 'ic-sm')} Simpan Kategori</button>`,
        onBuka: (el, tutup) => {
          const pv = () => { el.querySelector('[data-pv]').innerHTML = UI.tileKat(s) + `<b>${e(el.querySelector('#k-nama').value || 'Pratinjau')}</b>`; };
          el.querySelector('#k-nama').oninput = pv;
          const pilih = (attr, key) => el.querySelectorAll(`[data-${attr}]`).forEach(b => b.onclick = () => {
            s[key] = b.dataset[attr];
            el.querySelectorAll(`[data-${attr}]`).forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-checked', on); if (attr === 'warna') x.innerHTML = on ? UI.ic('check', 'ic-sm') : ''; });
            pv();
          });
          pilih('ikon', 'Ikon'); pilih('warna', 'Warna'); pilih('j', 'Jenis');
          el.querySelector('[data-ok]').onclick = () => {
            s.Nama = el.querySelector('#k-nama').value.trim();
            if (!s.Nama) return Aksi.tampilGalat(el, 'Nama kategori wajib diisi.');
            if (Store.db.kategori.some(x => x.ID !== s.ID && x.Jenis === s.Jenis && x.Nama.toLowerCase() === s.Nama.toLowerCase())) return Aksi.tampilGalat(el, 'Kategori dengan nama itu sudah ada.');
            P.simpanKategori(s, k);
            tutup();
          };
        }
      });
    },
    simpanKategori(s, k) {
      const rec = Object.assign({ ID: U.tmpId() }, k || {}, s);
      Store.mutasi({
        action: 'kategoriSimpan', data: { ID: k ? k.ID : undefined, Nama: s.Nama, Jenis: s.Jenis, Ikon: s.Ikon, Warna: s.Warna, Aktif: s.Aktif },
        optimis: db => Store.put(db, 'kategori', rec), terapkan: (db, r) => Store.pasangServer(db, 'kategori', r.kategori, rec.ID)
      }).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Kategori tidak tersimpan'); });
    },

    formAlokasi() {
      const db = Store.db;
      let items = (db.alokasi || []).map(a => ({ Pos: a.Pos, Persen: a.Persen, Dompet_ID: a.Dompet_ID }));
      if (!items.length) items = [{ Pos: 'Kebutuhan', Persen: 50, Dompet_ID: '' }, { Pos: 'Keinginan', Persen: 30, Dompet_ID: '' }, { Pos: 'Tabungan', Persen: 20, Dompet_ID: '' }];
      UI.drawer({
        label: 'Atur alokasi', judul: 'Alokasi Pemasukan', sub: 'Total maksimal 100%.',
        isi: '<div data-rows></div><button class="btn btn-secondary btn-sm mt-12" type="button" data-tambah>' + UI.ic('plus', 'ic-sm') + ' Tambah pos</button><div class="panel mt-16 row-between"><span class="muted">Total</span><b data-tot class="num"></b></div><div class="err mt-16 hidden" data-err role="alert"></div>',
        kaki: `<button class="btn btn-ghost" type="button" data-tutup>Batal</button><button class="btn btn-primary" type="button" data-ok>${UI.ic('check', 'ic-sm')} Simpan Alokasi</button>`,
        onBuka: (el, tutup) => {
          const gambar = () => {
            el.querySelector('[data-rows]').innerHTML = items.map((it, i) => `<div class="panel mt-8" data-i="${i}"><div class="row"><input class="input" data-k="Pos" value="${e(it.Pos)}" placeholder="Nama pos" maxlength="40"><input class="input num" data-k="Persen" type="number" min="1" max="100" value="${it.Persen}" style="width:96px" aria-label="Persen"><button class="icon-btn" type="button" data-hapus="${i}" aria-label="Hapus pos">${UI.ic('trash', 'ic-sm')}</button></div>
              <select class="select mt-8" data-k="Dompet_ID" aria-label="Dompet tujuan"><option value="">Pilih dompet…</option>${Aksi.opsiDompet(it.Dompet_ID)}</select></div>`).join('');
            el.querySelector('[data-tot]').textContent = items.reduce((s, x) => s + (Number(x.Persen) || 0), 0) + '%';
          };
          gambar();
          el.addEventListener('input', ev => { const r = ev.target.closest('[data-i]'); if (!r || !ev.target.dataset.k) return; const it = items[Number(r.dataset.i)]; it[ev.target.dataset.k] = ev.target.dataset.k === 'Persen' ? Number(ev.target.value) : ev.target.value; el.querySelector('[data-tot]').textContent = items.reduce((s, x) => s + (Number(x.Persen) || 0), 0) + '%'; });
          el.addEventListener('change', ev => { const r = ev.target.closest('[data-i]'); if (r && ev.target.dataset.k === 'Dompet_ID') items[Number(r.dataset.i)].Dompet_ID = ev.target.value; });
          el.addEventListener('click', ev => {
            const h = ev.target.closest('[data-hapus]');
            if (h) { items.splice(Number(h.dataset.hapus), 1); gambar(); }
            if (ev.target.closest('[data-tambah]') && items.length < 10) { items.push({ Pos: '', Persen: 10, Dompet_ID: '' }); gambar(); }
          });
          el.querySelector('[data-ok]').onclick = () => {
            const tot = items.reduce((s, x) => s + (Number(x.Persen) || 0), 0);
            if (items.some(x => !x.Pos.trim() || !x.Dompet_ID || !(x.Persen >= 1))) return Aksi.tampilGalat(el, 'Lengkapi nama, persen (≥1), dan dompet tiap pos.');
            if (tot > 100) return Aksi.tampilGalat(el, `Total ${tot}% melebihi 100%.`);
            Store.mutasi({
              action: 'alokasiSimpan', data: { items },
              optimis: d => { const lama = d.alokasi; d.alokasi = items.map((x, i) => Object.assign({ ID: 'ALK-' + (i + 1) }, x)); return d2 => { d2.alokasi = lama; }; },
              terapkan: (d, r) => { d.alokasi = r.alokasi; }
            }).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Alokasi tidak tersimpan'); });
            UI.toast('Alokasi pemasukan disimpan');
            tutup();
          };
        }
      });
    },

    pasang(el, p) {
      const tab = TAB.some(t => t[0] === p.tab) ? p.tab : 'umum';
      if (tab === 'log') { log.items = null; P.muatLog(el); }
      el.addEventListener('click', async ev => {
        const db = Store.db, q = s => ev.target.closest(s);
        const tm = q('[data-tema]');
        if (tm) return App.tema.terapkan(tm.dataset.tema, true);
        if (q('[data-simpan-nama]')) { const v = el.querySelector('#nm').value.trim(); if (!v) return UI.toast('Nama tidak boleh kosong', { tipe: 'error' }); return simpanSetel({ nama_pengguna: v }); }
        if (q('[data-simpan-email]')) { const v = el.querySelector('#em').value.trim(); if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return UI.toast('Format email tidak valid', { tipe: 'error' }); return simpanSetel({ email_notifikasi: v }); }
        const am = q('[data-ambang]');
        if (am) return simpanSetel({ ambang_anggaran_hampir: am.dataset.ambang }, 'Ambang anggaran ' + am.dataset.ambang + '%');
        if (q('[data-kunci]')) return App.kunci('Aplikasi dikunci.');
        if (q('[data-alokasi]')) return P.formAlokasi();
        if (q('[data-kat-baru]')) return P.formKategori(null);
        const ku = q('[data-kat-ubah]');
        if (ku) return P.formKategori(db.kategori.find(k => k.ID === ku.dataset.katUbah));
        if (q('[data-backup]')) {
          const b = q('[data-backup]');
          try { const r = await UI.sibuk(b, () => Api.post('backupSekarang', {}, { timeout: 120000 }), 'Membuat salinan…'); UI.toast('Backup tersimpan di Drive', { sub: r.backup.nama }); Store.ubah(d => { d.meta = Object.assign({}, d.meta, { backupTerakhir: r.backup.waktu }); }); }
          catch (err) { if (err.code !== 'AUTH') UI.galat(err, 'Backup gagal'); }
          return;
        }
        if (q('[data-segar]')) return App.segarkan();
        if (q('[data-log-ulang]')) return P.muatLog(el);
        const lh = q('[data-log-hal]');
        if (lh) { log.hal += Number(lh.dataset.logHal); log.items = null; el.querySelector('[data-isi]').innerHTML = P.tab_log(); P.pasangLog(el); return P.muatLog(el); }
      });
      el.addEventListener('change', ev => {
        const s = ev.target.closest('[data-saklar]');
        if (s) return simpanSetel({ [s.dataset.saklar]: s.checked ? 'Ya' : 'Tidak' });
        const ka = ev.target.closest('[data-kat-aktif]');
        if (ka) { const k = Store.db.kategori.find(x => x.ID === ka.dataset.katAktif); return P.simpanKategori(Object.assign({}, k, { Aktif: ka.checked ? 'Ya' : 'Tidak' }), k); }
        if (ev.target.matches('[data-sesi]')) return simpanSetel({ sesi_menit: ev.target.value }, 'Sesi habis setelah ' + ev.target.value + ' menit tidak aktif');
      });
      const f = el.querySelector('[data-pin]');
      if (f) {
        f.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 6); }));
        f.addEventListener('submit', async ev => {
          ev.preventDefault();
          const lama = f.querySelector('#pl').value, baru = f.querySelector('#pb').value, ulang = f.querySelector('#pu').value, err = f.querySelector('[data-err]');
          const gagal = m => { err.innerHTML = UI.ic('alert-circle', 'ic-sm') + ' ' + e(m); err.classList.remove('hidden'); };
          err.classList.add('hidden');
          if (!/^\d{6}$/.test(lama)) return gagal('Masukkan PIN lama (6 digit).');
          if (!/^\d{6}$/.test(baru)) return gagal('PIN baru harus 6 digit angka.');
          if (/^(\d)\1{5}$/.test(baru) || '0123456789'.indexOf(baru) >= 0 || '9876543210'.indexOf(baru) >= 0) return gagal('PIN baru tidak boleh berurutan atau sama semua.');
          if (baru !== ulang) return gagal('Konfirmasi PIN baru tidak cocok.');
          try {
            const r = await UI.sibuk(f.querySelector('[type=submit]'), () => Api.post('pinGanti', { lama, baru }), 'Menyimpan…');
            Api.setToken(r.token);
            f.reset();
            UI.toast('PIN berhasil diganti', { sub: 'Perangkat lain perlu memasukkan PIN baru.' });
          } catch (x) { if (x.code === 'LOCKED') { App.kunci(x.message); } else if (x.code !== 'AUTH') gagal(x.message); }
        });
      }
      P.pasangLog(el);
    }
  };

  window.Pages.pengaturan = P;
})();
