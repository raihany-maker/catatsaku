/* Layar kunci: masukkan PIN, buat PIN pertama (kode aktivasi), status terkunci + hitung mundur. */
(function () {
  const e = U.esc;
  let el = null, pin = '', sibuk = false, timer = 0, status = null;

  const Auth = {
    async tampil(pesan) {
      el = document.getElementById('lock');
      el.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      Api.hangatkan();
      pin = '';
      Auth.render('memuat');
      try {
        status = await Api.status();
      } catch (err) {
        status = null;
        Auth.render('galat', err.message);
        return;
      }
      if (!status.siap) return Auth.render('galat', 'Database belum disiapkan. Jalankan setupAppEnvironment() di editor Apps Script.');
      if (status.terkunci) return Auth.render('terkunci');
      if (!status.adaPin) return Auth.render('buat');
      Auth.render('pin', pesan);
    },
    tutup() {
      clearInterval(timer);
      if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
      document.body.style.overflow = '';
      document.removeEventListener('keydown', Auth._ketik);
    },

    kerangka(isi) {
      return `<div class="lock-top"><a class="brand" href="#/dashboard" aria-label="Catatsaku"><img class="brand-mark" src="img/logo.svg" alt="" width="34" height="34"><span class="nm">Catatsaku</span></a>
        <div class="row"><button class="icon-btn outlined" type="button" data-tema aria-label="Ganti tema">${UI.ic(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun')}</button></div></div>
        <div class="lock-main">${isi}</div>
        <div class="app-foot" style="border:0;padding-bottom:22px"><div class="wrap"><span>Catatsaku © ${new Date().getFullYear()} — Sistem Tata Kelola Finansial Personal · Asia/Makassar (WITA)</span></div></div>`;
    },

    render(mode, info) {
      clearInterval(timer);
      document.removeEventListener('keydown', Auth._ketik);
      let isi = '';
      if (mode === 'memuat') {
        isi = `<div class="lock-card"><div class="shield">${UI.ic('shield')}</div><div class="skel" style="height:22px;width:60%;margin:0 auto"></div></div>`;
      } else if (mode === 'galat') {
        isi = `<div class="lock-card card"><div class="shield">${UI.ic('alert-triangle')}</div><h1 style="font-size:24px">Tidak dapat terhubung</h1>
          <p class="muted mt-8">${e(info || '')}</p><button class="btn btn-primary mt-24" data-ulang type="button">${UI.ic('refresh', 'ic-sm')} Coba lagi</button></div>`;
      } else if (mode === 'pin') {
        isi = `<div class="lock-card card glow" style="padding:36px 28px">
          <div class="shield">${UI.ic('shield')}</div>
          <h1 style="font-size:30px">Masukkan PIN</h1>
          <p class="muted mt-8">${e(info || 'Aplikasi pribadi — masukkan 6 digit PIN Anda')}</p>
          <div class="pin-dots" aria-live="polite" aria-label="PIN terisi 0 dari 6">${'<i></i>'.repeat(6)}</div>
          <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" type="button" data-k="${n}" aria-label="${n}">${n}</button>`).join('')}
            <span class="key ghost" aria-hidden="true"></span><button class="key" type="button" data-k="0" aria-label="0">0</button>
            <button class="key" type="button" data-hapus aria-label="Hapus satu digit">${UI.ic('backspace')}</button></div>
          <div class="mt-24" data-sisa>${status && status.sisa < 5 ? `<span class="badge warn lg">${UI.ic('alert-triangle', 'ic-xs')} Sisa percobaan: ${status.sisa} dari 5</span>` : ''}</div>
          <button class="btn btn-ghost btn-sm mt-12" type="button" data-lupa>Lupa PIN?</button>
          <p class="faint row mt-12" style="justify-content:center;gap:6px;font-size:12.5px">${UI.ic('clock', 'ic-xs')} Terkunci otomatis setelah ${e(App.sesiMenit())} menit tidak aktif</p></div>`;
      } else if (mode === 'terkunci') {
        isi = `<div class="lock-card card" style="padding:32px 28px;text-align:left">
          <span class="badge danger lg"><i class="bd"></i>STATUS: TERKUNCI</span>
          <div class="row mt-16" style="align-items:flex-start"><span class="tile lg c-mawar">${UI.ic('lock')}</span>
          <div><h2 style="font-size:22px">Aplikasi dikunci sementara</h2><p class="muted mt-8">Terlalu banyak percobaan PIN salah berturut-turut. Demi perlindungan saldo, akses ditutup sementara.</p></div></div>
          <div class="panel inset mt-24" style="text-align:center"><div class="eyebrow">Waktu tunggu tersisa</div><div class="countdown mt-12" data-cd>--:--</div>
          <div class="progress warn mt-16"><span data-cdbar style="width:100%"></span></div></div>
          <button class="btn btn-secondary btn-block mt-16" type="button" disabled>${UI.ic('clock', 'ic-sm')} Coba lagi nanti</button></div>`;
      } else if (mode === 'buat') {
        isi = `<div class="lock-card wide card glow" style="padding:30px 28px">
          <div class="row-between"><div class="row"><span class="tile c-oranye">${UI.ic('shield')}</span><h1 style="font-size:24px">Buat PIN Baru</h1></div><span class="badge">Setup</span></div>
          <p class="muted mt-12">Langkah pertama: masukkan <b>kode aktivasi</b> dari log editor Apps Script (hasil <span class="code">setupAppEnvironment()</span>), lalu tentukan 6 digit PIN.</p>
          <form data-buat novalidate>
            <div class="field mt-16"><label class="label" for="kode">Kode aktivasi</label><input class="input" id="kode" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="8 karakter" required></div>
            <div class="g g-2 mt-16"><div class="field"><label class="label" for="pin1">PIN baru</label><input class="input pin-input" id="pin1" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required></div>
            <div class="field"><label class="label" for="pin2">Ulangi PIN</label><input class="input pin-input" id="pin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required></div></div>
            <ul class="rules" data-aturan><li data-r="6">${UI.ic('check-circle', 'ic-sm')} Tepat 6 digit angka (0–9)</li><li data-r="urut">${UI.ic('check-circle', 'ic-sm')} Bukan angka berurutan / sama semua</li><li data-r="sama">${UI.ic('check-circle', 'ic-sm')} Konfirmasi PIN cocok</li></ul>
            <div class="err mt-12 hidden" data-err></div>
            <button class="btn btn-primary btn-block btn-lg mt-24" type="submit">${UI.ic('check', 'ic-sm')} Simpan PIN</button>
          </form></div>`;
      }
      el.innerHTML = Auth.kerangka(isi);
      el.querySelector('[data-tema]').onclick = () => { App.tema.alih(); Auth.render(mode, info); };
      const ulang = el.querySelector('[data-ulang]');
      if (ulang) ulang.onclick = () => Auth.tampil();
      if (mode === 'pin') Auth.pasangPin();
      if (mode === 'terkunci') Auth.hitungMundur();
      if (mode === 'buat') Auth.pasangBuat();
    },

    pasangPin() {
      pin = '';
      el.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => Auth.tekan(b.dataset.k)));
      el.querySelector('[data-hapus]').onclick = () => Auth.tekan('del');
      el.querySelector('[data-lupa]').onclick = () => UI.modal({
        kelas: 'sm', judul: 'Lupa PIN?', label: 'Lupa PIN',
        isi: `<p class="muted">Demi keamanan, PIN hanya bisa direset oleh pemilik dari editor Apps Script:</p>
          <ol class="mt-12" style="padding-left:20px;line-height:1.8"><li>Buka proyek Apps Script Catatsaku.</li><li>Pilih fungsi <span class="code">resetPin</span> → klik ▶ Run.</li>
          <li>Salin <b>kode aktivasi</b> dari Execution log.</li><li>Muat ulang halaman ini → <b>Buat PIN Baru</b>.</li></ol>`,
        kaki: '<button class="btn btn-primary" data-tutup type="button">Mengerti</button>'
      });
      document.addEventListener('keydown', Auth._ketik);
    },
    _ketik(ev) {
      if (document.querySelector('.ov')) return;
      if (/^\d$/.test(ev.key)) Auth.tekan(ev.key);
      else if (ev.key === 'Backspace') Auth.tekan('del');
    },
    tekan(k) {
      if (sibuk) return;
      const tombol = el.querySelector(k === 'del' ? '[data-hapus]' : `[data-k="${k}"]`);
      if (tombol) { tombol.classList.add('press'); setTimeout(() => tombol.classList.remove('press'), 120); }
      if (k === 'del') pin = pin.slice(0, -1);
      else if (pin.length < 6) pin += k;
      Auth.titik();
      if (pin.length === 6) Auth.kirim();
    },
    titik(salah) {
      const d = el.querySelector('.pin-dots');
      if (!d) return;
      d.querySelectorAll('i').forEach((i, n) => i.classList.toggle('on', n < pin.length));
      d.setAttribute('aria-label', `PIN terisi ${pin.length} dari 6`);
      if (salah) { d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }
    },
    async kirim() {
      sibuk = true;
      el.querySelectorAll('.key').forEach(k => { k.disabled = true; });
      try {
        const r = await Api.post('login', { pin });
        Api.setToken(r.token);
        App.setSesiMenit(r.sesiMenit);
        sibuk = false;
        Auth.tutup();
        App.masuk();
      } catch (err) {
        sibuk = false;
        pin = '';
        if (err.code === 'LOCKED') { status = { terkunci: true, kunciSampai: err.data.kunciSampai, sisa: 0 }; return Auth.render('terkunci'); }
        Auth.titik(true);
        el.querySelectorAll('.key').forEach(k => { k.disabled = false; });
        const s = el.querySelector('[data-sisa]');
        if (s) s.innerHTML = `<span class="badge ${err.code === 'PIN_SALAH' ? 'warn' : 'danger'} lg">${UI.ic('alert-triangle', 'ic-xs')} ${e(err.message)}</span>`;
      }
    },
    hitungMundur() {
      const sampai = status.kunciSampai, total = 15 * 60e3;
      const tik = () => {
        const sisa = Math.max(0, sampai - Date.now());
        const cd = el.querySelector('[data-cd]'), bar = el.querySelector('[data-cdbar]');
        if (cd) cd.textContent = String(Math.floor(sisa / 60e3)).padStart(2, '0') + ' : ' + String(Math.floor(sisa / 1000) % 60).padStart(2, '0');
        if (bar) bar.style.width = (sisa / total * 100) + '%';
        if (!sisa) { clearInterval(timer); Auth.tampil(); }
      };
      tik();
      timer = setInterval(tik, 1000);
    },
    pasangBuat() {
      const f = el.querySelector('[data-buat]'), p1 = f.querySelector('#pin1'), p2 = f.querySelector('#pin2'), err = f.querySelector('[data-err]');
      const cek = () => {
        const a = p1.value, ok6 = /^\d{6}$/.test(a), urut = ok6 && !/^(\d)\1{5}$/.test(a) && '0123456789'.indexOf(a) < 0 && '9876543210'.indexOf(a) < 0;
        const sama = ok6 && a === p2.value;
        f.querySelector('[data-r="6"]').classList.toggle('ok', ok6);
        f.querySelector('[data-r="urut"]').classList.toggle('ok', urut);
        f.querySelector('[data-r="sama"]').classList.toggle('ok', sama);
        return ok6 && urut && sama;
      };
      [p1, p2].forEach(i => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 6); cek(); }));
      f.addEventListener('submit', async ev => {
        ev.preventDefault();
        err.classList.add('hidden');
        if (!cek()) { err.textContent = 'Periksa kembali syarat PIN di atas.'; err.classList.remove('hidden'); return; }
        const btn = f.querySelector('[type=submit]');
        try {
          const r = await UI.sibuk(btn, () => Api.post('buatPin', { kode: f.querySelector('#kode').value, pin: p1.value }), 'Menyimpan…');
          Api.setToken(r.token);
          App.setSesiMenit(r.sesiMenit);
          Auth.tutup();
          UI.toast('PIN berhasil dibuat', { sub: 'Simpan PIN Anda baik-baik.' });
          App.masuk();
        } catch (x) {
          if (x.code === 'LOCKED') { status = { terkunci: true, kunciSampai: x.data.kunciSampai }; return Auth.render('terkunci'); }
          err.innerHTML = UI.ic('alert-circle', 'ic-sm') + ' ' + e(x.message);
          err.classList.remove('hidden');
        }
      });
    }
  };

  window.Auth = Auth;
})();
