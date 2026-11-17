/* Komponen UI: ikon, lencana, progres, ring, toast, modal/drawer, konfirmasi, menu popover. */
(function () {
  const e = U.esc;
  let terbuka = 0;

  const UI = {
    ic: (n, c) => `<svg class="ic ${c || ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`,
    badge: (t, tipe, dot) => `<span class="badge ${tipe || ''}">${dot ? '<i class="bd"></i>' : ''}${t}</span>`,

    tileKat(k, uk) {
      k = k || { Warna: 'abu', Ikon: 'tag' };
      return `<span class="tile ${uk || ''} c-${e(k.Warna || 'abu')}">${UI.ic(k.Ikon || 'tag', uk === 'sm' ? 'ic-sm' : '')}</span>`;
    },
    tileDompet(d, uk) {
      d = d || { Nama: '?', Warna: 'abu' };
      const ikon = { Tunai: 'banknote', Bank: 'landmark', 'E-Wallet': 'smartphone', Tabungan: 'piggy-bank' }[d.Tipe] || 'wallet';
      return `<span class="tile ${uk || ''} c-${e(d.Warna || 'abu')}" title="${e(d.Tipe || '')}">${UI.ic(ikon, uk === 'sm' ? 'ic-sm' : '')}</span>`;
    },
    tileTrx(t, ix) {
      if (t.Jenis === 'Transfer') return `<span class="tile ${t.Sumber === 'Kontribusi' ? 'c-hijau' : 'c-abu'}">${UI.ic(t.Sumber === 'Kontribusi' ? 'piggy-bank' : 'arrow-left-right')}</span>`;
      return UI.tileKat(ix.kategori.get(t.Kategori_ID));
    },
    progress(pct, st, lg) {
      const w = Math.max(0, Math.min(100, pct || 0));
      const cls = st === 'lewat' ? 'danger' : st === 'hampir' ? 'warn' : st === 'aman' ? 'ok' : '';
      return `<div class="progress ${cls} ${lg ? 'lg' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct || 0)}"><span style="width:${w}%"></span></div>`;
    },
    ring(pct, size, tebal, label, warna) {
      size = size || 56; tebal = tebal || 6;
      const r = (size - tebal) / 2, kel = 2 * Math.PI * r, isi = Math.max(0, Math.min(100, pct || 0));
      return `<div class="ring c-${warna || 'oranye'}" style="width:${size}px;height:${size}px" role="img" aria-label="${Math.round(pct)} persen">
        <svg width="${size}" height="${size}"><circle class="trk" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${tebal}"/>
        <circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${tebal}" stroke-linecap="round" stroke-dasharray="${kel}" stroke-dashoffset="${kel * (1 - isi / 100)}"/></svg>
        <div class="lbl">${label === undefined ? U.persen(pct) : label}</div></div>`;
    },
    /** Lencana perubahan %. kebalik=true untuk pengeluaran (naik = buruk). */
    delta(pc, kebalik) {
      if (pc === null || pc === undefined || !isFinite(pc)) return '<span class="delta flat">baru</span>';
      if (Math.abs(pc) < 0.05) return '<span class="delta flat">0%</span>';
      const naik = pc > 0, baik = kebalik ? !naik : naik;
      return `<span class="delta ${baik ? 'up' : 'down'}" title="dibanding periode sebelumnya">${naik ? '▲' : '▼'} ${U.persen(Math.abs(pc), Math.abs(pc) < 10 ? 1 : 0)}</span>`;
    },
    statusTrx(t) {
      if (t.Status === 'Tercatat') return UI.badge('Tercatat', 'ok');
      if (t.Status === 'Menunggu Konfirmasi') return UI.badge('Menunggu Konfirmasi', 'warn', true);
      return UI.badge('Dihapus', 'danger');
    },
    kosong(ikon, judul, sub, aksi) {
      return `<div class="empty"><span class="tile lg c-oranye">${UI.ic(ikon)}</span><div class="t">${judul}</div>${sub ? `<div class="s">${sub}</div>` : ''}${aksi || ''}</div>`;
    },
    skeleton(n, h) { return Array.from({ length: n || 3 }, () => `<div class="skel" style="height:${h || 56}px;margin-bottom:10px"></div>`).join(''); },

    // ---------------------------------------------------------------- toast
    toast(judul, o) {
      o = o || {};
      let wrap = document.querySelector('.toasts');
      if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toasts'; wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
      const tipe = o.tipe || 'ok';
      const ikon = { ok: 'check', error: 'alert-circle', warn: 'alert-triangle', info: 'info' }[tipe];
      const el = document.createElement('div');
      el.className = 'toast ' + tipe;
      el.innerHTML = `<span class="ti">${UI.ic(ikon, 'ic-sm')}</span><div class="meta"><div class="t">${e(judul)}</div>${o.sub ? `<div class="s">${e(o.sub)}</div>` : ''}</div>
        ${o.aksi ? `<button class="act" type="button">${e(o.aksi.label)}</button>` : ''}<button class="icon-btn" type="button" aria-label="Tutup">${UI.ic('x', 'ic-sm')}</button>`;
      const tutup = () => { el.style.opacity = '0'; el.style.transition = 'opacity .15s'; setTimeout(() => el.remove(), 160); };
      if (o.aksi) el.querySelector('.act').onclick = () => { tutup(); o.aksi.fn(); };
      el.querySelector('.icon-btn').onclick = tutup;
      wrap.appendChild(el);
      while (wrap.children.length > 3) wrap.firstChild.remove();
      setTimeout(tutup, o.ms || (tipe === 'error' ? 6000 : o.aksi ? 6000 : 3200));
      return tutup;
    },
    galat(err, judul) {
      UI.toast(judul || 'Gagal disimpan', { tipe: 'error', sub: err && err.message ? err.message : String(err) });
    },

    // ---------------------------------------------------------------- modal & drawer
    _overlay(html, kelasOv, opt) {
      const fokusSebelum = document.activeElement;
      const ov = document.createElement('div');
      ov.className = 'ov ' + (kelasOv || '');
      ov.innerHTML = html;
      document.body.appendChild(ov);
      terbuka++;
      document.body.style.overflow = 'hidden';
      let sudah = false;
      const tutup = (hasil) => {
        if (sudah) return; sudah = true;
        ov.remove();
        terbuka = Math.max(0, terbuka - 1);
        if (!terbuka) document.body.style.overflow = '';
        document.removeEventListener('keydown', esc);
        if (fokusSebelum && fokusSebelum.focus) fokusSebelum.focus({ preventScroll: true });
        if (opt.onTutup) opt.onTutup(hasil);
      };
      const esc = ev => { const s = document.querySelectorAll('.ov'); if (ev.key === 'Escape' && s[s.length - 1] === ov && !document.querySelector('.pop')) tutup(); };
      document.addEventListener('keydown', esc);
      ov.addEventListener('mousedown', ev => { if (ev.target === ov && opt.tutupLuar !== false) tutup(); });
      ov.querySelectorAll('[data-tutup]').forEach(b => b.addEventListener('click', () => tutup()));
      const box = ov.firstElementChild;
      if (opt.onBuka) opt.onBuka(box, tutup);
      requestAnimationFrame(() => {
        const f = box.querySelector('[autofocus]') || (window.matchMedia('(min-width: 761px)').matches ? box.querySelector('input:not([type=hidden]):not([readonly]), select, textarea') : null) || box.querySelector('.close-x');
        if (f) f.focus({ preventScroll: true });
      });
      return { el: box, tutup };
    },
    _kepala(o) {
      return `<div class="modal-head"><div class="grow">${o.eyebrow ? `<div class="eyebrow accent" style="margin-bottom:8px">${o.eyebrow}</div>` : ''}<h2>${o.judul}</h2>${o.sub ? `<p class="card-sub">${o.sub}</p>` : ''}</div>
        <button class="close-x" type="button" data-tutup aria-label="Tutup">${UI.ic('x')}</button></div>`;
    },
    modal(o) {
      return UI._overlay(`<div class="modal ${o.kelas || ''}" role="dialog" aria-modal="true" aria-label="${e(o.label || '')}">${UI._kepala(o)}<div class="modal-body">${o.isi || ''}</div>${o.kaki ? `<div class="modal-foot">${o.kaki}</div>` : ''}</div>`, '', o);
    },
    drawer(o) {
      return UI._overlay(`<div class="drawer" role="dialog" aria-modal="true" aria-label="${e(o.label || '')}">${UI._kepala(o)}<div class="modal-body">${o.isi || ''}</div>${o.kaki ? `<div class="modal-foot">${o.kaki}</div>` : ''}</div>`, 'drawer-ov', o);
    },
    konfirmasi(o) {
      return new Promise(res => {
        let ok = false;
        UI.modal({
          kelas: 'sm', judul: o.judul, label: o.judul,
          isi: `<p class="muted">${o.pesan || ''}</p>`,
          kaki: `<button class="btn btn-secondary" type="button" data-tutup>Batal</button><button class="btn ${o.bahaya ? 'btn-danger' : 'btn-primary'}" type="button" data-ok>${o.ok || 'Ya, lanjutkan'}</button>`,
          onBuka: (el, tutup) => { el.querySelector('[data-ok]').onclick = () => { ok = true; tutup(); }; el.querySelector('[data-ok]').focus(); },
          onTutup: () => res(ok)
        });
      });
    },

    // ---------------------------------------------------------------- menu popover
    menu(anchor, items) {
      document.querySelectorAll('.pop').forEach(p => p.remove());
      const pop = document.createElement('div');
      pop.className = 'pop';
      pop.setAttribute('role', 'menu');
      pop.innerHTML = items.map((it, i) => {
        if (it.sep) return '<div class="pop-sep"></div>';
        if (it.head) return `<div class="pop-head">${e(it.head)}</div>`;
        if (it.html) return `<button type="button" role="menuitem" data-i="${i}" class="${it.kelas || ''}">${it.html}</button>`;
        return `<button type="button" role="menuitem" data-i="${i}" class="${it.bahaya ? 'danger' : ''}">${it.ikon ? UI.ic(it.ikon, 'ic-sm') : ''}<span class="grow">${e(it.label)}</span>${it.kanan || ''}</button>`;
      }).join('');
      document.body.appendChild(pop);
      const r = anchor.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
      let left = Math.min(window.innerWidth - pw - 12, Math.max(12, r.right - pw));
      let top = r.bottom + 8;
      if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 8);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
      const tutup = () => { pop.remove(); document.removeEventListener('mousedown', luar, true); document.removeEventListener('keydown', esc); };
      const luar = ev => { if (!pop.contains(ev.target) && !anchor.contains(ev.target)) tutup(); };
      const esc = ev => { if (ev.key === 'Escape') { tutup(); anchor.focus(); } };
      setTimeout(() => { document.addEventListener('mousedown', luar, true); document.addEventListener('keydown', esc); }, 0);
      pop.addEventListener('click', ev => {
        const b = ev.target.closest('[data-i]');
        if (!b) return;
        const it = items[Number(b.dataset.i)];
        tutup();
        if (it && it.fn) it.fn();
      });
      const first = pop.querySelector('button');
      if (first) first.focus({ preventScroll: true });
      return tutup;
    },

    /** Tombol → status sibuk selama promise berjalan. */
    async sibuk(btn, fn, teks) {
      const html = btn.innerHTML;
      btn.classList.add('busy'); btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span>${teks ? ' ' + teks : ''}`;
      try { return await fn(); } finally { btn.classList.remove('busy'); btn.disabled = false; btn.innerHTML = html; }
    }
  };

  window.UI = UI;
})();
