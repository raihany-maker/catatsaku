/* Target Tabungan (F-09, A5): progres otomatis dari kontribusi Setor/Tarik (transfer, tanpa hitung ganda). */
(function () {
  window.Pages = window.Pages || {};
  const e = U.esc;
  let pilih = '', saring = 'semua';

  const T = {
    judul: 'Target',
    render(p) {
      const db = Store.db, ix = Calc.idx(db), h = U.hariIni(), ym = h.slice(0, 7);
      if (p.id) pilih = p.id;
      const aktif = db.target.filter(t => t.Status === 'Aktif');
      const semua = db.target.slice().sort((a, b) => (a.Status === 'Aktif' ? 0 : 1) - (b.Status === 'Aktif' ? 0 : 1));
      if (!ix.target.get(pilih)) pilih = (aktif[0] || semua[0] || {}).ID || '';
      const tg = ix.target.get(pilih);
      const totTarget = aktif.reduce((s, t) => s + t.Nominal_Target, 0);
      const totKumpul = aktif.reduce((s, t) => s + Calc.target(db, t).terkumpul, 0);
      const bln = Calc.ringkas(db, ym + '-01', ym + '-' + U.hariDalam(ym));
      const riwayatSemua = db.kontribusi.map(k => Object.assign({}, k, { _status: ix.status.get(k.ID_Transaksi_Terkait) })).filter(k => k._status === Calc.OK)
        .sort((a, b) => (a.Tanggal < b.Tanggal ? 1 : -1)).slice(0, 6);
      const lain = semua.filter(t => t.ID !== pilih && (saring === 'semua' || (saring === 'jalan' ? t.Status === 'Aktif' && !Calc.target(db, t).tercapai : t.Status !== 'Aktif' || Calc.target(db, t).tercapai)));

      return `
        <div class="page-head">
          <div><div class="crumb">Tabungan <span>/</span> Target finansial <span>·</span> Asia/Makassar (WITA)</div><h1 class="page-title">Target Tabungan</h1>
            <p class="page-sub">Alokasikan dana masa depan di dompet tabungan terpisah — tercatat sebagai transfer, tanpa hitung ganda.</p></div>
          <div class="page-actions"><a class="btn btn-secondary" href="#/dompet?tipe=Tabungan">${UI.ic('wallet', 'ic-sm')} Kelola Dompet Tabungan</a><button class="btn btn-primary" type="button" data-baru>${UI.ic('plus', 'ic-sm')} Target Baru</button></div>
        </div>
        <div class="g g-3">
          <div class="card"><div class="row-between"><span class="eyebrow">Total target finansial</span>${UI.ic('flag', 'ic-sm muted')}</div><div class="kpi-value num">${U.rp(totTarget)}</div><div class="kpi-sub"><span class="live-dot" style="display:inline-block;margin-right:6px;width:6px;height:6px"></span>${aktif.length} target aktif berjalan</div></div>
          <div class="card"><div class="row-between"><span class="eyebrow">Total terkumpul</span>${UI.ic('piggy-bank', 'ic-sm muted')}</div><div class="kpi-value num t-accent">${U.rp(totKumpul)}</div><div class="kpi-sub"><b class="t-accent">${U.persen(totTarget ? totKumpul / totTarget * 100 : 0, 1)}</b> dari seluruh target aktif</div></div>
          <div class="card"><div class="row-between"><span class="eyebrow row" style="gap:6px">Tingkat tabungan <button type="button" data-info-rate aria-label="Definisi tingkat tabungan" class="muted">${UI.ic('info', 'ic-xs')}</button></span>${UI.ic('trending-up', 'ic-sm t-ok')}</div>
            <div class="kpi-value num t-ok">${U.persen(bln.rate, 1)}</div><div class="kpi-sub">${bln.rate === null ? 'Belum ada pemasukan bulan ini' : 'Setor − tarik ÷ pemasukan, ' + U.bulan(ym)}</div></div>
        </div>
        <div class="g g-side mt-24">
          <div class="stack">
            ${tg ? T.utama(tg, db) : `<div class="card">${UI.kosong('target', 'Belum ada target tabungan', 'Buat target (mis. Dana Darurat) dan pilih dompet bertipe Tabungan sebagai tempat dananya.', '<button class="btn btn-primary btn-sm mt-8" type="button" data-baru>Buat target pertama</button>')}</div>`}
            ${semua.length > 1 ? `<div class="row-between" style="flex-wrap:wrap"><h2 class="card-title">Daftar Target Lainnya</h2>
              <div class="chips">${[['semua', 'Semua'], ['jalan', 'Berjalan'], ['selesai', 'Selesai / arsip']].map(([k, l]) => `<button class="chip ${saring === k ? 'active' : ''}" type="button" data-s="${k}" style="min-height:32px">${l}</button>`).join('')}</div></div>
              ${lain.map(t => T.baris(t, db)).join('') || '<p class="muted">Tidak ada target pada saringan ini.</p>'}` : ''}
          </div>
          <aside class="stack">
            <div class="card glow"><h2 class="card-title">Catat Kontribusi Target</h2><p class="card-sub">Setor atau tarik saldo tabungan target secara terstruktur.</p>
              <div class="g g-2 mt-16" style="gap:10px"><button class="btn btn-ok btn-lg" type="button" data-setor ${aktif.length ? '' : 'disabled'}>${UI.ic('plus', 'ic-sm')} Setor</button><button class="btn btn-secondary btn-lg" type="button" data-tarik ${aktif.length ? '' : 'disabled'}>${UI.ic('minus', 'ic-sm')} Tarik</button></div>
              <div class="note info mt-16">${UI.ic('info', 'ic-sm')}<span>Dicatat sebagai <b>transfer antar-dompet</b>, bukan pengeluaran konsumtif. Total kekayaan tetap seimbang.</span></div></div>
            <div class="card"><div class="row-between"><span class="eyebrow">Riwayat kontribusi terakhir</span>${UI.ic('history', 'ic-sm muted')}</div>
              <div class="list mt-12">${riwayatSemua.length ? riwayatSemua.map(k => `<button type="button" class="item clickable" data-k="${e(k.ID_Kontribusi)}"><div class="meta"><div class="row" style="gap:8px">${UI.badge(k.Jenis, k.Jenis === 'Setor' ? 'ok' : 'warn')}<b style="font-size:14px">${e((ix.target.get(k.Target_ID) || {}).Nama || '?')}</b></div><div class="sub">${U.tgl(k.Tanggal)} · ${e((ix.dompet.get(k.Jenis === 'Setor' ? k.Dompet_Asal_ID : k.Dompet_Tujuan_ID) || {}).Nama || '')}</div></div><div class="amt ${k.Jenis === 'Setor' ? 'in' : ''}">${k.Jenis === 'Setor' ? '+' : '−'} ${U.rp(k.Nominal)}</div></button>`).join('') : '<p class="muted" style="font-size:14px">Belum ada kontribusi.</p>'}</div></div>
          </aside>
        </div>`;
    },

    utama(t, db) {
      const ix = Calc.idx(db), i = Calc.target(db, t), dmp = ix.dompet.get(t.Dompet_Tabungan_ID) || {};
      const aktif = t.Status === 'Aktif';
      return `<section class="card glow" aria-labelledby="h-tgt">
        <div class="row-between" style="align-items:flex-start"><div class="wrap-gap">${aktif ? (i.tercapai ? UI.badge('Tercapai 100%', 'ok') : UI.badge('Aktif', 'accent')) : UI.badge(t.Status, t.Status === 'Batal' ? 'danger' : 'ok')}<span class="badge">${UI.ic('landmark', 'ic-xs')} ${e(dmp.Nama || '?')}</span></div>
          <button class="icon-btn" type="button" data-menu="${t.ID}" aria-label="Menu target">${UI.ic('more-vertical')}</button></div>
        <h2 class="head mt-12" style="font-size:24px" id="h-tgt">${e(t.Nama)}</h2>
        <div class="panel inset mt-16 row" style="gap:28px;flex-wrap:wrap;padding:24px">
          ${UI.ring(i.persen, 132, 12, `<div><div style="font-size:26px">${U.persen(i.persen, 1)}</div><div class="muted" style="font:500 12px var(--font-body)">Tercapai</div></div>`, i.tercapai ? 'hijau' : 'oranye')}
          <div class="grow" style="min-width:220px"><div class="eyebrow">Terkumpul saat ini</div><div class="kpi-value num t-accent" style="margin-top:6px">${U.rp(i.terkumpul)}</div>
            <div class="g g-2 mt-16" style="gap:12px"><div><div class="muted" style="font-size:12.5px">Target akhir</div><b class="num">${U.rp(t.Nominal_Target)}</b></div><div><div class="muted" style="font-size:12.5px">Kekurangan</div><b class="num ${i.sisa ? 't-danger' : 't-ok'}">${U.rp(i.sisa)}</b></div></div>
            <div class="row mt-16" style="gap:8px;font-size:14px">${UI.ic('calendar', 'ic-sm t-warn')} Tenggat: <b>${t.Tenggat ? U.tgl(t.Tenggat) : 'tanpa tenggat'}</b> ${t.Tenggat ? `<span class="muted">(${Calc.sisaWaktu(i.hariLagi)})</span>` : ''}</div></div>
        </div>
        ${aktif && i.perBulan ? `<div class="note warn mt-16">${UI.ic('lightbulb', 'ic-sm')}<span>Sisihkan <b class="num">${U.rp(i.perBulan)} / bulan</b> agar target tercapai tepat waktu sebelum tenggat.</span></div>` : ''}
        ${aktif ? `<div class="row mt-16" style="flex-wrap:wrap"><button class="btn btn-primary" type="button" data-setor="${t.ID}">${UI.ic('plus', 'ic-sm')} Setor Tabungan</button><button class="btn btn-secondary" type="button" data-tarik="${t.ID}" ${i.terkumpul > 0 ? '' : 'disabled'}>${UI.ic('minus', 'ic-sm')} Tarik Dana</button>
          <span class="grow"></span><button class="btn btn-ghost btn-sm" type="button" data-ubah="${t.ID}">${UI.ic('pencil', 'ic-sm')} Ubah</button></div>` : ''}
        <div class="row-between mt-24"><span class="eyebrow">Mutasi kontribusi</span><span class="faint" style="font-size:12.5px">${i.riwayat.length} catatan</span></div>
        <div class="list mt-8">${i.riwayat.length ? i.riwayat.slice(0, 8).map(k => {
          const hapus = k._status !== Calc.OK, d = ix.dompet.get(k.Jenis === 'Setor' ? k.Dompet_Asal_ID : k.Dompet_Tujuan_ID) || {};
          return `<div class="item ${hapus ? 'deleted' : ''}"><span class="tile sm ${k.Jenis === 'Setor' ? 'c-hijau' : 'c-amber'}">${UI.ic(k.Jenis === 'Setor' ? 'arrow-down-left' : 'arrow-up-right', 'ic-sm')}</span>
            <div class="meta"><div class="ttl" style="font-size:14px">${e(k.Catatan || k.Jenis)}</div><div class="sub">${U.tgl(k.Tanggal)} · ${k.Jenis === 'Setor' ? 'dari' : 'ke'} ${e(d.Nama || '?')}${hapus ? ' · dihapus' : ''}</div></div>
            <div class="amt ${k.Jenis === 'Setor' ? 'in' : ''}">${k.Jenis === 'Setor' ? '+' : '−'} ${U.rp(k.Nominal)}</div>
            ${hapus ? `<button class="btn btn-ghost btn-xs" type="button" data-pulih="${e(k.ID_Transaksi_Terkait)}">${UI.ic('undo', 'ic-xs')}</button>` : `<button class="icon-btn" type="button" data-kmenu="${e(k.ID_Kontribusi)}" aria-label="Menu kontribusi">${UI.ic('more-vertical', 'ic-sm')}</button>`}</div>`;
        }).join('') : '<p class="muted" style="font-size:14px">Belum ada kontribusi. Mulai dengan <b>Setor Tabungan</b>.</p>'}</div>
      </section>`;
    },
    baris(t, db) {
      const i = Calc.target(db, t), dmp = Calc.idx(db).dompet.get(t.Dompet_Tabungan_ID) || {};
      return `<article class="card tight"><div class="row-between" style="flex-wrap:wrap;gap:12px">
        <button type="button" class="grow" data-pilih="${t.ID}" style="text-align:left;min-width:220px"><div class="row" style="gap:8px;flex-wrap:wrap"><b class="head" style="font-size:17px">${e(t.Nama)}</b>${i.tercapai ? UI.badge('Tercapai', 'ok') : t.Status !== 'Aktif' ? UI.badge(t.Status, '') : ''}${t.Tenggat ? `<span class="faint" style="font-size:12.5px">· ${U.bulan(t.Tenggat.slice(0, 7))}</span>` : ''}</div>
          <div class="mt-12">${UI.progress(i.persen, i.tercapai ? 'aman' : '')}</div>
          <div class="row-between mt-8" style="font-size:12.5px"><span class="muted num">${U.rp(i.terkumpul)} / ${U.rp(t.Nominal_Target)} (${U.persen(i.persen, 1)})</span><span class="muted">${e(dmp.Nama || '')}</span></div></button>
        <div class="row" style="gap:8px">${t.Status === 'Aktif' ? `<button class="btn btn-secondary btn-sm" type="button" data-setor="${t.ID}">Setor cepat</button>` : ''}<button class="btn btn-ghost btn-sm" type="button" data-ubah="${t.ID}">Ubah</button></div></div></article>`;
    },

    form(t) {
      const db = Store.db;
      const tab = db.dompet.filter(w => w.Tipe === 'Tabungan' && (w.Aktif === 'Ya' || (t && w.ID === t.Dompet_Tabungan_ID)));
      if (!tab.length) {
        return UI.modal({ kelas: 'sm', judul: 'Butuh dompet tabungan', label: 'Butuh dompet tabungan', isi: '<p class="muted">Setiap target menyimpan dananya di dompet bertipe <b>Tabungan</b> (mis. rekening tabungan terpisah). Buat dompet tabungan dulu.</p>', kaki: '<button class="btn btn-primary" data-ke type="button">Buat dompet tabungan</button>', onBuka: (el, tutup) => { el.querySelector('[data-ke]').onclick = () => { tutup(); App.go('#/dompet?baru=1'); }; } });
      }
      const s = t ? Object.assign({}, t) : { Nama: '', Nominal_Target: 0, Dompet_Tabungan_ID: tab[0].ID, Tenggat: '', Status: 'Aktif' };
      UI.drawer({
        label: t ? 'Ubah target' : 'Target baru', judul: t ? 'Ubah Target' : 'Target Tabungan Baru', sub: 'Terkumpul & persen dihitung otomatis dari kontribusi.',
        isi: `<div class="field"><label class="label" for="t-nama">Nama target</label><input class="input" id="t-nama" maxlength="60" placeholder="cth: Dana Darurat 6 Bulan" value="${e(s.Nama)}"></div>
          <div class="field"><label class="label" for="t-nom">Nominal target</label>${Aksi.fieldNominal('t-nom', s.Nominal_Target, [1000000, 5000000, 10000000])}</div>
          <div class="field"><label class="label" for="t-dompet">Dompet tabungan</label><select class="select" id="t-dompet">${tab.map(w => `<option value="${w.ID}" ${w.ID === s.Dompet_Tabungan_ID ? 'selected' : ''}>${e(w.Nama)}</option>`).join('')}</select><span class="hint">Dana target disimpan & dihitung dari dompet bertipe Tabungan ini.</span></div>
          <div class="field"><label class="label" for="t-tenggat">Tenggat <small>opsional</small></label><input class="input" type="date" id="t-tenggat" value="${e(s.Tenggat)}"></div>
          ${t ? `<div class="field"><span class="label">Status</span><div class="seg block" role="group" aria-label="Status target">${['Aktif', 'Tercapai', 'Batal'].map(x => `<button type="button" data-st="${x}" class="${s.Status === x ? 'active' : ''}">${x}</button>`).join('')}</div></div>` : ''}
          <div class="err mt-16 hidden" data-err role="alert"></div>`,
        kaki: `<button class="btn btn-ghost" type="button" data-tutup>Batal</button><button class="btn btn-primary" type="button" data-ok>${UI.ic('check', 'ic-sm')} Simpan Target</button>`,
        onBuka: (el, tutup) => {
          Aksi.pasangNominal(el, 't-nom', v => { s.Nominal_Target = v; });
          el.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { s.Status = b.dataset.st; el.querySelectorAll('[data-st]').forEach(x => x.classList.toggle('active', x === b)); });
          el.querySelector('[data-ok]').onclick = () => {
            s.Nama = el.querySelector('#t-nama').value.trim(); s.Dompet_Tabungan_ID = el.querySelector('#t-dompet').value; s.Tenggat = el.querySelector('#t-tenggat').value;
            if (!s.Nama) return Aksi.tampilGalat(el, 'Nama target wajib diisi.');
            if (!s.Nominal_Target) return Aksi.tampilGalat(el, 'Nominal target harus lebih dari 0.');
            T.simpan(s, t);
            tutup();
          };
        }
      });
    },
    simpan(s, t) {
      const rec = Object.assign({ ID: U.tmpId(), Dibuat_Pada: U.sekarang().iso }, t || {}, s);
      Store.mutasi({
        action: 'targetSimpan', data: { ID: t ? t.ID : undefined, Nama: s.Nama, Nominal_Target: s.Nominal_Target, Dompet_Tabungan_ID: s.Dompet_Tabungan_ID, Tenggat: s.Tenggat, Status: s.Status },
        optimis: db => Store.put(db, 'target', rec), terapkan: (db, r) => Store.pasangServer(db, 'target', r.target, rec.ID)
      }).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Target tidak tersimpan'); });
      pilih = rec.ID;
      UI.toast(t ? 'Target diperbarui' : `Target ${s.Nama} dibuat`, { sub: U.rp(s.Nominal_Target) });
    },

    pasang(el, p) {
      if (p.baru) { history.replaceState(null, '', '#/target'); setTimeout(() => T.form(null), 50); }
      if (p.kontribusi) {
        history.replaceState(null, '', '#/target');
        const k = Store.db.kontribusi.find(x => x.ID_Kontribusi === p.kontribusi);
        if (k) setTimeout(() => Aksi.kontribusi({ k }), 50);
      }
      el.addEventListener('click', ev => {
        const db = Store.db, ix = Calc.idx(db), q = s => ev.target.closest(s);
        if (q('[data-baru]')) return T.form(null);
        if (q('[data-info-rate]')) return UI.modal({ kelas: 'sm', judul: 'Tingkat Tabungan', label: 'Definisi tingkat tabungan', isi: '<p class="muted">Tingkat tabungan = <b>(Σ setor − Σ tarik kontribusi target)</b> ÷ <b>pemasukan</b> periode × 100%.</p><p class="muted mt-12">Bila pemasukan periode = 0, nilai ditampilkan "–". Transfer biasa antar-dompet tidak dihitung.</p>', kaki: '<button class="btn btn-primary" data-tutup type="button">Mengerti</button>' });
        const st = q('[data-setor]');
        if (st) return Aksi.kontribusi({ target: ix.target.get(st.dataset.setor) || ix.target.get(pilih), jenis: 'Setor' });
        const tr = q('[data-tarik]');
        if (tr) return Aksi.kontribusi({ target: ix.target.get(tr.dataset.tarik) || ix.target.get(pilih), jenis: 'Tarik' });
        const pl = q('[data-pilih]');
        if (pl) { pilih = pl.dataset.pilih; App.render(); return window.scrollTo({ top: 0, behavior: 'smooth' }); }
        const u = q('[data-ubah]');
        if (u) return T.form(ix.target.get(u.dataset.ubah));
        const s = q('[data-s]');
        if (s) { saring = s.dataset.s; return App.render(); }
        const kr = q('[data-k]');
        if (kr) { const k = db.kontribusi.find(x => x.ID_Kontribusi === kr.dataset.k); if (k) { pilih = k.Target_ID; App.render(); } return; }
        const pu = q('[data-pulih]');
        if (pu) { const t = ix.trx.get(pu.dataset.pulih); if (t) Aksi.pulihkan(t, Calc.OK); return; }
        const km = q('[data-kmenu]');
        if (km) {
          const k = db.kontribusi.find(x => x.ID_Kontribusi === km.dataset.kmenu), t = ix.trx.get(k.ID_Transaksi_Terkait);
          return UI.menu(km, [{ ikon: 'pencil', label: 'Ubah kontribusi', fn: () => Aksi.kontribusi({ k }) }, { sep: 1 }, { ikon: 'trash', label: 'Hapus kontribusi', bahaya: true, fn: () => Aksi.hapusTrx(t) }]);
        }
        const m = q('[data-menu]');
        if (m) {
          const t = ix.target.get(m.dataset.menu);
          const ubahStatus = sts => T.simpan(Object.assign({}, t, { Status: sts }), t);
          UI.menu(m, [
            { ikon: 'pencil', label: 'Ubah target', fn: () => T.form(t) },
            t.Status !== 'Tercapai' ? { ikon: 'check-circle', label: 'Tandai tercapai (arsip)', fn: () => ubahStatus('Tercapai') } : { ikon: 'refresh', label: 'Aktifkan lagi', fn: () => ubahStatus('Aktif') },
            t.Status === 'Batal' ? { ikon: 'refresh', label: 'Aktifkan lagi', fn: () => ubahStatus('Aktif') } : { ikon: 'x', label: 'Batalkan target', bahaya: true, fn: () => ubahStatus('Batal') }
          ]);
        }
      });
    }
  };

  window.Pages.target = T;
})();
