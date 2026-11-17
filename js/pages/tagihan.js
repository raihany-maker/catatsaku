/* Tagihan & Transaksi Berulang (F-10): master jadwal, antrean Menunggu Konfirmasi, Konfirmasi Bayar. */
(function () {
  window.Pages = window.Pages || {};
  const e = U.esc;
  let tab = 'semua', cari = '';

  const Tg = {
    judul: 'Tagihan',
    render() {
      const db = Store.db, ix = Calc.idx(db), ym = U.hariIni().slice(0, 7);
      const daftar = db.tagihan.map(g => ({ g, s: Calc.tagihan(db, g) }));
      const draf = db.trx.filter(t => t.Status === Calc.DRAF && /^TAG-/.test(t.Ref_ID || '')).sort((a, b) => (a.Tanggal < b.Tanggal ? -1 : 1));
      const keluar = x => (x.s.kat || {}).Jenis !== 'Masuk';
      const bulanIni = daftar.filter(x => x.g.Status === 'Aktif' && keluar(x) && (x.g.Pola === 'Bulanan' || String(x.g.Hari_Jatuh_Tempo).slice(0, 7) === ym));
      const totKewajiban = bulanIni.reduce((s, x) => s + x.g.Nominal_Perkiraan, 0);
      const lunas = db.trx.filter(t => t.Status === Calc.OK && t.Jenis === 'Keluar' && /^TAG-\d+@/.test(t.Ref_ID || '') && t.Tanggal.slice(0, 7) === ym);
      const n = { semua: daftar.length, menunggu: draf.length, lunas: daftar.filter(x => x.s.status === 'Lunas').length, nonaktif: daftar.filter(x => x.g.Status !== 'Aktif').length };
      const q = cari.toLowerCase();
      const master = daftar.filter(x => (tab === 'semua' || (tab === 'lunas' && x.s.status === 'Lunas') || (tab === 'nonaktif' && x.g.Status !== 'Aktif') || (tab === 'menunggu' && x.s.draf)) &&
        (!q || [x.g.Nama, (x.s.kat || {}).Nama, (x.s.dompet || {}).Nama].join(' ').toLowerCase().indexOf(q) >= 0));
      const tutupBanner = U.bacaLokal('cs_banner_tagihan') === '1';

      return `
        <div class="page-head">
          <div><div class="crumb">Kewajiban <span>/</span> Tagihan rutin</div><h1 class="page-title">Tagihan &amp; Transaksi Berulang</h1>
            <p class="page-sub">Kelola kewajiban berkala, pantau draf otomatis, dan konfirmasi pembayaran tepat waktu tanpa hitung ganda.</p></div>
          <div class="page-actions"><button class="btn btn-primary" type="button" data-baru>${UI.ic('plus', 'ic-sm')} Tagihan Baru</button></div>
        </div>
        <div class="g g-3">
          <div class="card"><div class="row-between"><span class="eyebrow">Total kewajiban bulan ini</span><span class="tile sm c-oranye">${UI.ic('receipt', 'ic-sm')}</span></div>
            <div class="kpi-value num">${U.rp(totKewajiban)}</div><div class="kpi-sub">${UI.ic('calendar', 'ic-xs')} ${bulanIni.length} tagihan terjadwal ${U.bulanPanjang(ym)}</div></div>
          <div class="card" style="${draf.length ? 'border-color:var(--warn-soft)' : ''}"><div class="row-between"><span class="eyebrow row" style="gap:8px">Menunggu konfirmasi ${draf.length ? UI.badge(draf.length + ' butuh aksi', 'warn') : ''}</span><span class="tile sm c-amber">${UI.ic('clock', 'ic-sm')}</span></div>
            <div class="kpi-value num t-warn">${U.rp(draf.reduce((s, t) => s + t.Nominal, 0))}</div><div class="kpi-sub">Draf siap dikonfirmasi ke buku kas</div></div>
          <div class="card"><div class="row-between"><span class="eyebrow row" style="gap:8px">Sudah dibayar ${UI.badge(lunas.length + ' selesai', 'ok')}</span><span class="tile sm c-hijau">${UI.ic('check-circle', 'ic-sm')}</span></div>
            <div class="kpi-value num t-ok">${U.rp(lunas.reduce((s, t) => s + t.Nominal, 0))}</div><div class="kpi-sub">Tercatat resmi bulan ini</div></div>
        </div>
        ${tutupBanner ? '' : `<div class="note warn mt-24" style="align-items:center">${UI.ic('info', 'ic-sm')}<span class="grow"><b>Integritas saldo:</b> draf tagihan belum mengubah saldo sampai Anda menekan <b>Konfirmasi Bayar</b>. Tagihan tidak dianggap lunas hanya karena tanggal jatuh tempo lewat.</span><button class="icon-btn" type="button" data-tutup-banner aria-label="Tutup informasi">${UI.ic('x', 'ic-sm')}</button></div>`}
        <div class="row-between mt-24" style="flex-wrap:wrap">
          <div class="chips">${[['semua', 'Semua tagihan'], ['menunggu', 'Menunggu konfirmasi'], ['lunas', 'Lunas bulan ini'], ['nonaktif', 'Nonaktif']].map(([k, l]) => `<button class="chip ${tab === k ? 'active' : ''}" type="button" data-tab="${k}">${l} <span class="count">${n[k]}</span></button>`).join('')}</div>
          <label class="input-icon" style="flex:0 1 320px"><span class="sr-only">Cari tagihan</span>${UI.ic('search')}<input class="input" type="search" data-cari placeholder="Cari nama tagihan, kategori, dompet…" value="${e(cari)}" style="min-height:44px;border-radius:999px;font-size:14.5px"></label>
        </div>
        <div class="g g-side mt-16">
          <div class="stack">
            <section aria-labelledby="h-antre"><div class="row-between"><h2 class="card-title row" id="h-antre">Antrean Menunggu Konfirmasi ${draf.length ? UI.badge(draf.length + ' draf', 'warn') : ''}</h2><span class="faint" style="font-size:12.5px">Siklus ${U.bulan(ym)}</span></div>
              <div class="stack mt-12" style="gap:12px">${draf.length ? draf.map(t => Tg.kartuDraf(t, ix)).join('') : `<div class="card tight">${UI.kosong('check-circle', 'Tidak ada draf menunggu', 'Draf dibuat otomatis H-n sebelum jatuh tempo (trigger harian 06:00 WITA).')}</div>`}</div></section>
            <section class="card" aria-labelledby="h-master"><div class="row-between"><div><h2 class="card-title" id="h-master">Daftar Master Tagihan Terjadwal</h2><p class="card-sub">Konfigurasi induk untuk penjadwalan draf otomatis.</p></div></div>
              ${master.length ? `<div class="table-wrap mt-16"><table class="table cards"><thead><tr><th>Nama &amp; frekuensi</th><th>Jadwal</th><th>Dompet</th><th class="r">Nominal est.</th><th>Status</th><th class="r">Aksi</th></tr></thead><tbody>${master.map(x => Tg.baris(x)).join('')}</tbody></table></div>`
                : UI.kosong('receipt', db.tagihan.length ? 'Tidak ada tagihan pada saringan ini' : 'Belum ada tagihan', 'Daftarkan tagihan rutin (listrik, internet, sewa) atau pemasukan berulang (gaji) agar draf dibuat otomatis.', '<button class="btn btn-primary btn-sm mt-8" type="button" data-baru>Tagihan baru</button>')}
            </section>
          </div>
          <aside class="stack">
            <div class="card"><h3 class="card-title row">${UI.ic('sparkles', 'ic-sm t-accent')} Cara kerja tagihan otomatis</h3>
              <div class="stack mt-16" style="gap:16px">${[['Jatuh tempo didekati', 'Setiap hari pukul 06:00 WITA sistem memeriksa tagihan yang masuk jendela H-n.'], ['Draf dibuat otomatis', 'Draf berstatus <b class="t-warn">Menunggu Konfirmasi</b> disiapkan tanpa memotong saldo.'], ['Anda konfirmasi', 'Sesuaikan nominal (denda/diskon), pilih dompet, lampirkan struk bila ada.'], ['Saldo terpotong resmi', 'Status berubah jadi <b class="t-ok">Tercatat</b>, saldo dompet & laporan diperbarui.']]
                .map((s, i) => `<div class="row" style="align-items:flex-start"><span class="step"><span class="n">${i + 1}</span></span><div><b>${s[0]}</b><p class="muted" style="font-size:13.5px;margin-top:2px">${s[1]}</p></div></div>`).join('')}</div></div>
            <div class="note">${UI.ic('mail', 'ic-sm')}<span>Pengingat email dikirim sekali per tagihan per periode ke alamat di Pengaturan. Kategori bertipe <b>Masuk</b> (mis. Gaji) membuat draf pemasukan berulang.</span></div>
          </aside>
        </div>`;
    },

    kartuDraf(t, ix) {
      const [gid, periode] = String(t.Ref_ID).split('@'), g = ix.tagihan.get(gid) || {}, k = ix.kategori.get(t.Kategori_ID) || {};
      const sisa = U.selisihHari(U.hariIni(), t.Tanggal.slice(0, 10)), d = ix.dompet.get(t.Dompet_Asal_ID || t.Dompet_Tujuan_ID) || {};
      return `<article class="card tight" style="border-color:${sisa < 0 ? 'var(--danger-soft)' : 'var(--warn-soft)'}">
        <div class="row-between" style="align-items:flex-start;flex-wrap:wrap;gap:12px"><div class="row" style="align-items:flex-start">${UI.tileKat(k)}
          <div><div class="row" style="gap:8px;flex-wrap:wrap"><b class="head" style="font-size:17px">${e(g.Nama || t.Catatan)}</b><span class="badge">${e(k.Nama || '')}</span></div>
          <div class="wrap-gap mt-8">${UI.badge('Menunggu Konfirmasi', 'warn', true)}${sisa < 0 ? UI.badge(`${UI.ic('clock', 'ic-xs')} Terlewat ${-sisa} hari (jatuh tempo ${U.tglPendek(t.Tanggal)})`, 'danger') : UI.badge(`${UI.ic('clock', 'ic-xs')} ${sisa === 0 ? 'Jatuh tempo hari ini' : 'Jatuh tempo ' + sisa + ' hari lagi'} (${U.tglPendek(t.Tanggal)})`, 'info')}</div></div></div>
          <div class="right"><div class="faint" style="font-size:12px">Nominal draf</div><div class="head num" style="font-size:22px;font-weight:800">${U.rp(t.Nominal)}</div></div></div>
        <div class="row-between mt-16 panel inset" style="padding:10px 14px;flex-wrap:wrap;gap:10px"><span class="muted row" style="font-size:12.5px;gap:6px">${UI.ic('wallet', 'ic-xs')} Sumber default: ${e(d.Nama || '?')}</span>
          <span class="row" style="gap:8px"><button class="btn btn-ghost btn-sm" type="button" data-hapus-draf="${e(t.ID_Transaksi)}">Hapus draf</button><button class="btn btn-primary btn-sm" type="button" data-bayar="${e(gid)}" data-periode="${e(periode)}" data-draf="${e(t.ID_Transaksi)}">Konfirmasi Bayar ${UI.ic('arrow-right', 'ic-xs')}</button></span></div>
      </article>`;
    },

    baris(x) {
      const g = x.g, s = x.s, kat = s.kat || {}, d = s.dompet || {};
      const jadwal = g.Pola === 'Sekali' ? U.tgl(g.Hari_Jatuh_Tempo) : 'Tgl ' + g.Hari_Jatuh_Tempo + ' tiap bulan';
      const badge = { Lunas: UI.badge(`Lunas (${s.bayar ? U.tglPendek(s.bayar.Tanggal) : U.bulanNama(s.periode.slice(0, 7))})`, 'ok'), Menunggu: UI.badge('Menunggu konfirmasi', 'warn'), Terlewat: UI.badge('Terlewat', 'danger'), Terjadwal: UI.badge(`Jatuh tempo ${U.tglPendek(s.jatuh)}`, 'info'), Nonaktif: UI.badge('Nonaktif', '') }[s.status];
      const aksi = s.status === 'Lunas' ? (s.bayar && s.bayar.URL_Struk ? `<a class="btn btn-ghost btn-xs" href="${e(s.bayar.URL_Struk)}" target="_blank" rel="noopener">Lihat bukti</a>` : `<a class="btn btn-ghost btn-xs" href="#/riwayat?q=${encodeURIComponent(s.bayar ? s.bayar.ID_Transaksi : g.Nama)}">Lihat</a>`)
        : g.Status === 'Aktif' ? `<button class="btn ${s.draf ? 'btn-primary' : 'btn-secondary'} btn-xs" type="button" data-bayar="${g.ID}" data-periode="${e(s.periode)}" data-draf="${s.draf ? e(s.draf.ID_Transaksi) : ''}">${s.draf ? 'Konfirmasi' : 'Bayar'}</button>` : '';
      return `<tr class="${g.Status !== 'Aktif' ? 'deleted' : ''}" style="${g.Status !== 'Aktif' ? 'opacity:.6' : ''}">
        <td data-l="Tagihan"><div class="row" style="gap:10px;text-align:left">${UI.tileKat(kat, 'sm')}<div><b>${e(g.Nama)}</b><div class="faint" style="font-size:12px">${g.Pola} · ${e(kat.Nama || '')}${kat.Jenis === 'Masuk' ? ' · pemasukan' : ''}</div></div></div></td>
        <td data-l="Jadwal">${jadwal}<div class="faint" style="font-size:12px">ingat H-${g.Pengingat_H_Min}${g.Buat_Draft_Otomatis === 'Ya' ? ' · draf otomatis' : ''}</div></td>
        <td data-l="Dompet"><span class="row" style="gap:6px;justify-content:inherit"><i class="dotc c-${e(d.Warna || 'abu')}"></i>${e(d.Nama || '?')}</span></td>
        <td data-l="Nominal" class="r num"><b>${U.rp(g.Nominal_Perkiraan)}</b></td>
        <td data-l="Status">${badge}</td>
        <td data-l="Aksi" class="r"><span class="row" style="gap:4px;justify-content:flex-end">${aksi}<button class="icon-btn" type="button" data-ubah="${g.ID}" aria-label="Ubah ${e(g.Nama)}" style="width:34px;height:34px">${UI.ic('pencil', 'ic-sm')}</button></span></td></tr>`;
    },

    form(g) {
      const db = Store.db;
      const s = g ? Object.assign({}, g) : { Nama: '', Nominal_Perkiraan: 0, Pola: 'Bulanan', Hari_Jatuh_Tempo: '', Kategori_ID: '', Dompet_ID: (Calc.dompetAktif(db)[0] || {}).ID || '', Pengingat_H_Min: 3, Buat_Draft_Otomatis: 'Ya', Status: 'Aktif' };
      const kats = db.kategori.filter(k => k.Aktif === 'Ya' || k.ID === s.Kategori_ID);
      const opsiKat = jenis => kats.filter(k => k.Jenis === jenis).map(k => `<option value="${k.ID}" ${k.ID === s.Kategori_ID ? 'selected' : ''}>${e(k.Nama)}</option>`).join('');
      UI.drawer({
        label: g ? 'Ubah tagihan' : 'Tagihan baru', judul: g ? 'Ubah Tagihan' : 'Tagihan / Transaksi Berulang Baru', sub: 'Draf dibuat otomatis H-n sebelum jatuh tempo.',
        isi: `<div class="field"><label class="label" for="g-nama">Nama tagihan</label><input class="input" id="g-nama" maxlength="60" placeholder="cth: Listrik PLN" value="${e(s.Nama)}"></div>
          <div class="field"><label class="label" for="g-nom">Nominal perkiraan</label>${Aksi.fieldNominal('g-nom', s.Nominal_Perkiraan)}</div>
          <div class="field"><span class="label">Pola</span><div class="seg block" role="group" aria-label="Pola">${['Bulanan', 'Sekali'].map(p => `<button type="button" data-pola="${p}" class="${s.Pola === p ? 'active' : ''}">${p}</button>`).join('')}</div></div>
          <div class="field" data-hari></div>
          <div class="field"><label class="label" for="g-kat">Kategori</label><select class="select" id="g-kat"><option value="">Pilih kategori…</option><optgroup label="Pengeluaran (tagihan)">${opsiKat('Keluar')}</optgroup><optgroup label="Pemasukan (berulang, mis. gaji)">${opsiKat('Masuk')}</optgroup></select></div>
          <div class="field"><label class="label" for="g-dompet">Dompet default</label><select class="select" id="g-dompet">${Aksi.opsiDompet(s.Dompet_ID)}</select></div>
          <div class="field"><label class="label" for="g-h">Pengingat (hari sebelum jatuh tempo)</label><input class="input" type="number" id="g-h" min="0" max="15" value="${Number(s.Pengingat_H_Min) || 0}"></div>
          <div class="setting-row mt-16"><div><div class="t">Buat draf otomatis</div><div class="s">Draf "Menunggu Konfirmasi" dibuat di jendela H-n</div></div><label class="switch"><input type="checkbox" id="g-draf" ${s.Buat_Draft_Otomatis === 'Ya' ? 'checked' : ''} aria-label="Buat draf otomatis"><span></span></label></div>
          <div class="setting-row"><div><div class="t">Tagihan aktif</div><div class="s">Nonaktifkan untuk menghentikan draf & pengingat</div></div><label class="switch"><input type="checkbox" id="g-aktif" ${s.Status === 'Aktif' ? 'checked' : ''} aria-label="Tagihan aktif"><span></span></label></div>
          <div class="err mt-16 hidden" data-err role="alert"></div>`,
        kaki: `<button class="btn btn-ghost" type="button" data-tutup>Batal</button><button class="btn btn-primary" type="button" data-ok>${UI.ic('check', 'ic-sm')} Simpan Tagihan</button>`,
        onBuka: (el, tutup) => {
          const hari = () => {
            el.querySelector('[data-hari]').innerHTML = s.Pola === 'Bulanan'
              ? `<label class="label" for="g-hari">Tanggal jatuh tempo (1–31)</label><input class="input" type="number" id="g-hari" min="1" max="31" value="${/^\d+$/.test(String(s.Hari_Jatuh_Tempo)) ? s.Hari_Jatuh_Tempo : ''}" placeholder="cth: 10"><span class="hint">Tanggal 29–31 menyesuaikan ke akhir bulan pendek.</span>`
              : `<label class="label" for="g-hari">Tanggal jatuh tempo</label><input class="input" type="date" id="g-hari" value="${/^\d{4}-/.test(String(s.Hari_Jatuh_Tempo)) ? s.Hari_Jatuh_Tempo : U.hariIni()}">`;
          };
          hari();
          Aksi.pasangNominal(el, 'g-nom', v => { s.Nominal_Perkiraan = v; });
          el.querySelectorAll('[data-pola]').forEach(b => b.onclick = () => { s.Pola = b.dataset.pola; s.Hari_Jatuh_Tempo = ''; el.querySelectorAll('[data-pola]').forEach(x => x.classList.toggle('active', x === b)); hari(); });
          el.querySelector('[data-ok]').onclick = () => {
            Object.assign(s, { Nama: el.querySelector('#g-nama').value.trim(), Hari_Jatuh_Tempo: el.querySelector('#g-hari').value, Kategori_ID: el.querySelector('#g-kat').value, Dompet_ID: el.querySelector('#g-dompet').value,
              Pengingat_H_Min: Number(el.querySelector('#g-h').value || 0), Buat_Draft_Otomatis: el.querySelector('#g-draf').checked ? 'Ya' : 'Tidak', Status: el.querySelector('#g-aktif').checked ? 'Aktif' : 'Nonaktif' });
            if (!s.Nama) return Aksi.tampilGalat(el, 'Nama tagihan wajib diisi.');
            if (!s.Nominal_Perkiraan) return Aksi.tampilGalat(el, 'Nominal perkiraan harus lebih dari 0.');
            if (s.Pola === 'Bulanan' && !(Number(s.Hari_Jatuh_Tempo) >= 1 && Number(s.Hari_Jatuh_Tempo) <= 31)) return Aksi.tampilGalat(el, 'Tanggal jatuh tempo 1–31.');
            if (s.Pola === 'Sekali' && !s.Hari_Jatuh_Tempo) return Aksi.tampilGalat(el, 'Pilih tanggal jatuh tempo.');
            if (!s.Kategori_ID) return Aksi.tampilGalat(el, 'Pilih kategori.');
            if (!s.Dompet_ID) return Aksi.tampilGalat(el, 'Pilih dompet.');
            if (s.Pengingat_H_Min < 0 || s.Pengingat_H_Min > 15) return Aksi.tampilGalat(el, 'Pengingat 0–15 hari.');
            const rec = Object.assign({ ID: U.tmpId(), Periode_Terakhir_Dibuat: '', Periode_Terakhir_Dibayar: '' }, g || {}, s, { Hari_Jatuh_Tempo: String(s.Hari_Jatuh_Tempo) });
            Store.mutasi({
              action: 'tagihanSimpan', data: Object.assign({}, s, { ID: g ? g.ID : undefined }),
              optimis: d => Store.put(d, 'tagihan', rec),
              terapkan: (d, r) => { Store.pasangServer(d, 'tagihan', r.tagihan, rec.ID); (r.trxBaru || []).forEach(t => Store.put(d, 'trx', t)); if (r.trxBaru && r.trxBaru.length) UI.toast(`${r.trxBaru.length} draf dibuat`, { tipe: 'info', sub: 'Tagihan sudah masuk jendela pengingat — cek antrean.' }); }
            }).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Tagihan tidak tersimpan'); });
            UI.toast(g ? 'Tagihan diperbarui' : `Tagihan ${s.Nama} dijadwalkan`);
            tutup();
          };
        }
      });
    },

    pasang(el) {
      const cariInp = el.querySelector('[data-cari]');
      cariInp.addEventListener('input', U.debounce(() => { cari = cariInp.value; const pos = cariInp.selectionStart; App.render(); const n = document.querySelector('[data-cari]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 200));
      el.addEventListener('click', async ev => {
        const db = Store.db, ix = Calc.idx(db), q = s => ev.target.closest(s);
        if (q('[data-baru]')) return Tg.form(null);
        if (q('[data-tutup-banner]')) { U.simpanLokal('cs_banner_tagihan', '1'); return App.render(); }
        const tb = q('[data-tab]');
        if (tb) { tab = tb.dataset.tab; return App.render(); }
        const u = q('[data-ubah]');
        if (u) return Tg.form(ix.tagihan.get(u.dataset.ubah));
        const b = q('[data-bayar]');
        if (b) return Aksi.bayarTagihan(ix.tagihan.get(b.dataset.bayar), b.dataset.periode, b.dataset.draf ? ix.trx.get(b.dataset.draf) : null);
        const h = q('[data-hapus-draf]');
        if (h) return Aksi.hapusTrx(ix.trx.get(h.dataset.hapusDraf));
      });
    }
  };

  window.Pages.tagihan = Tg;
})();
