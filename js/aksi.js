/* Aksi bersama lintas halaman: hapus/urungkan transaksi, konfirmasi bayar tagihan, kontribusi target. */
(function () {
  const e = U.esc;

  function opsiDompet(sel, kecuali) {
    const per = Calc.saldoSemua(Store.db).per;
    return Calc.dompetAktif(Store.db).filter(w => w.ID !== kecuali)
      .map(w => `<option value="${w.ID}" ${w.ID === sel ? 'selected' : ''}>${e(w.Nama)} · ${U.rp(per[w.ID] || 0)}</option>`).join('');
  }
  function fieldNominal(id, nilai, cepat) {
    return `<div class="money-box"><div class="money"><span class="cur">Rp</span><input id="${id}" inputmode="numeric" autocomplete="off" placeholder="0" value="${nilai ? U.angka(nilai) : ''}"></div>
      <div class="terbilang" data-tb>${U.terbilang(nilai)}</div>
      ${cepat ? `<div class="quick">${cepat.map(v => `<button type="button" data-plus="${v}">+${v >= 1e6 ? v / 1e6 + 'jt' : v / 1000 + 'rb'}</button>`).join('')}</div>` : ''}</div>`;
  }
  function pasangNominal(el, id, cb) {
    const inp = el.querySelector('#' + id), tb = inp.closest('.money-box').querySelector('[data-tb]');
    const set = v => { v = Math.max(0, Math.round(v)); inp.value = v ? U.angka(v) : ''; tb.textContent = U.terbilang(v); cb(v); };
    inp.addEventListener('input', () => set(U.parseNominal(inp.value)));
    inp.closest('.money-box').querySelectorAll('[data-plus]').forEach(b => b.onclick = () => set(U.parseNominal(inp.value) + Number(b.dataset.plus)));
    return set;
  }
  function tampilGalat(el, pesan) {
    const b = el.querySelector('[data-err]');
    b.innerHTML = UI.ic('alert-circle', 'ic-sm') + ' ' + e(pesan);
    b.classList.remove('hidden');
  }

  const Aksi = {
    opsiDompet, fieldNominal, pasangNominal, tampilGalat,

    /** Hapus (soft delete) dengan konfirmasi + toast Urungkan. */
    async hapusTrx(t, langsung) {
      if (!t) return false;
      if (!langsung) {
        const kon = t.Sumber === 'Kontribusi';
        const ok = await UI.konfirmasi({
          judul: kon ? 'Hapus kontribusi target?' : 'Hapus transaksi?', bahaya: true, ok: 'Hapus',
          pesan: `${e(t.Catatan || t.Jenis)} · <b>${U.rp(t.Nominal)}</b><br>Transaksi ditandai <b>Dihapus</b> dan tidak dihitung lagi di saldo & laporan. Anda bisa mengurungkannya.`
        });
        if (!ok) return false;
      }
      const sebelum = t.Status;
      const rec = Object.assign({}, t, { Status: 'Dihapus', Diubah_Pada: U.sekarang().iso });
      Store.mutasi({
        action: 'trxHapus', data: { id: t.ID_Transaksi },
        optimis: db => Store.put(db, 'trx', rec),
        terapkan: (db, res) => { Store.put(db, 'trx', res.trx); if (res.tagihan) Store.put(db, 'tagihan', res.tagihan); }
      }).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Gagal menghapus'); });
      UI.toast('Transaksi dihapus', { sub: `${U.rp(t.Nominal)} tidak lagi dihitung`, aksi: { label: 'Urungkan', fn: () => Aksi.pulihkan(rec, sebelum) } });
      return true;
    },
    pulihkan(t, status) {
      const id = Store.idMap[t.ID_Transaksi] || t.ID_Transaksi;
      const rec = Object.assign({}, t, { ID_Transaksi: id, Status: status || Calc.OK });
      Store.mutasi({
        action: 'trxPulihkan', data: { id, status: rec.Status },
        optimis: db => Store.put(db, 'trx', rec),
        terapkan: (db, res) => { Store.put(db, 'trx', res.trx); if (res.tagihan) Store.put(db, 'tagihan', res.tagihan); }
      }).then(() => UI.toast('Transaksi dipulihkan')).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Gagal memulihkan'); });
    },

    /** Konfirmasi bayar tagihan: draf → Tercatat (nominal, tanggal, dompet bisa disesuaikan). */
    bayarTagihan(g, periode, draf) {
      const ix = Calc.idx(Store.db), kat = ix.kategori.get(g.Kategori_ID) || {}, masuk = kat.Jenis === 'Masuk';
      const s = { nominal: draf ? draf.Nominal : g.Nominal_Perkiraan, dompet: (draf && (draf.Dompet_Asal_ID || draf.Dompet_Tujuan_ID)) || g.Dompet_ID, tanggal: U.sekarang().iso, catatan: (draf && draf.Catatan) || g.Nama, struk: null };
      const jatuh = Calc.jatuhTempo(g, periode);
      UI.drawer({
        label: 'Konfirmasi pembayaran', judul: masuk ? 'Konfirmasi Penerimaan' : 'Konfirmasi Pembayaran',
        sub: 'Validasi draf sebelum dimasukkan ke buku kas.',
        isi: `<div class="panel row">${UI.tileKat(kat)}<div class="grow"><b>${e(g.Nama)}</b><div class="muted" style="font-size:13px">${e(kat.Nama || '')} · jatuh tempo ${U.tgl(jatuh)}</div></div>
            ${U.hariIni() > jatuh ? UI.badge('Terlewat', 'danger') : UI.badge(draf ? 'Draf' : 'Terjadwal', 'warn')}</div>
          <div class="note warn mt-16">${UI.ic('shield', 'ic-sm')}<span><b>Keamanan saldo:</b> konfirmasi akan membuat 1 transaksi ${masuk ? 'pemasukan' : 'pengeluaran'} berstatus <b>Tercatat</b> dan langsung ${masuk ? 'menambah' : 'mengurangi'} saldo dompet.</span></div>
          <div class="field mt-16"><label class="label" for="bt-nom">Nominal realisasi</label>${fieldNominal('bt-nom', s.nominal)}<span class="hint">Sesuaikan dengan struk bila ada selisih tarif atau denda.</span></div>
          <div class="field"><label class="label" for="bt-dompet">${masuk ? 'Dompet penerima' : 'Dompet pembayar'}</label><select class="select" id="bt-dompet">${opsiDompet(s.dompet)}</select></div>
          <div class="field"><label class="label" for="bt-tgl">Waktu transaksi nyata <small>WITA</small></label><input class="input" type="datetime-local" id="bt-tgl" value="${s.tanggal}"></div>
          <div class="field"><label class="label" for="bt-cat">Nomor referensi &amp; catatan</label><input class="input" id="bt-cat" maxlength="300" value="${e(s.catatan)}"></div>
          <label class="panel row mt-16" style="border-style:dashed;cursor:pointer"><span class="tile sm c-oranye">${UI.ic('camera', 'ic-sm')}</span><span class="grow"><b>Bukti pembayaran</b> <span class="muted">(opsional)</span><br><span class="muted" style="font-size:12.5px" data-si>JPG/PNG/PDF maks. 5 MB</span></span><input type="file" id="bt-struk" class="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf"></label>
          <div class="err mt-16 hidden" data-err role="alert"></div>`,
        kaki: `<button class="btn btn-ghost" type="button" data-tutup>Batal</button><button class="btn btn-primary" type="button" data-ok>${UI.ic('check-circle', 'ic-sm')} Konfirmasi &amp; Catat Kas</button>`,
        onBuka: (el, tutup) => {
          pasangNominal(el, 'bt-nom', v => { s.nominal = v; });
          el.querySelector('#bt-struk').onchange = async ev => {
            try { s.struk = await Pages._catat.bacaStruk(ev.target.files[0]); el.querySelector('[data-si]').textContent = ev.target.files[0].name + ' · siap diunggah'; }
            catch (x) { s.struk = null; el.querySelector('[data-si]').textContent = x.message; }
          };
          el.querySelector('[data-ok]').onclick = () => {
            s.dompet = el.querySelector('#bt-dompet').value; s.tanggal = el.querySelector('#bt-tgl').value; s.catatan = el.querySelector('#bt-cat').value.trim();
            if (!s.nominal) return tampilGalat(el, 'Nominal harus lebih dari 0.');
            if (!s.dompet) return tampilGalat(el, 'Pilih dompet.');
            if (!/T\d{2}:\d{2}$/.test(s.tanggal)) return tampilGalat(el, 'Waktu transaksi wajib diisi.');
            const per = Calc.saldoSemua(Store.db).per;
            if (!masuk && Store.db.pengaturan.izinkan_saldo_minus !== 'Ya' && (per[s.dompet] || 0) - s.nominal < 0) return tampilGalat(el, `Saldo ${ix.dompet.get(s.dompet).Nama} tidak cukup (${U.rp(per[s.dompet] || 0)}).`);
            const now = U.sekarang().iso, key = g.ID + '@' + periode;
            const rec = Object.assign({}, draf || { ID_Transaksi: U.tmpId(), Sumber: masuk ? 'Berulang' : 'Tagihan', Ref_ID: key, URL_Struk: '', Dibuat_Pada: now, Kategori_ID: g.Kategori_ID }, {
              Jenis: masuk ? 'Masuk' : 'Keluar', Tanggal: s.tanggal, Nominal: s.nominal, Catatan: s.catatan || g.Nama, Status: Calc.OK, Diubah_Pada: now,
              Dompet_Asal_ID: masuk ? '' : s.dompet, Dompet_Tujuan_ID: masuk ? s.dompet : ''
            });
            const gBaru = Object.assign({}, g, { Periode_Terakhir_Dibayar: (g.Periode_Terakhir_Dibayar || '') < periode ? periode : g.Periode_Terakhir_Dibayar });
            Store.mutasi({
              action: 'tagihanBayar', data: { tagihan: g.ID, periode, Nominal: s.nominal, Tanggal: s.tanggal, Dompet_ID: s.dompet, Catatan: s.catatan, struk: s.struk || undefined },
              optimis: db => [Store.put(db, 'trx', rec), Store.put(db, 'tagihan', gBaru)],
              terapkan: (db, res) => { Store.pasangServer(db, 'trx', res.trx, rec.ID_Transaksi); Store.put(db, 'tagihan', res.tagihan); }
            }).then(res => { if (res.peringatan) UI.toast('Tercatat dengan catatan', { tipe: 'warn', sub: res.peringatan }); })
              .catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Konfirmasi gagal'); });
            UI.toast(`${g.Nama} ${masuk ? 'diterima' : 'dibayar'} ${U.rp(s.nominal)}`, { sub: 'Status: Tercatat · saldo diperbarui' });
            tutup();
          };
        }
      });
    },

    /** Catat / ubah kontribusi target (Setor/Tarik) → 1 Kontribusi + 1 Transfer di server. */
    kontribusi(o) {
      const db = Store.db, ix = Calc.idx(db);
      const aktif = db.target.filter(t => t.Status === 'Aktif');
      if (!aktif.length) return UI.toast('Belum ada target aktif', { tipe: 'info', sub: 'Buat target tabungan terlebih dahulu.' });
      const k = o.k || null;
      const s = {
        target: (k && k.Target_ID) || (o.target && o.target.ID) || aktif[0].ID, jenis: (k && k.Jenis) || o.jenis || 'Setor',
        nominal: (k && k.Nominal) || 0, tanggal: (k && k.Tanggal) || U.sekarang().iso, catatan: (k && k.Catatan) || ''
      };
      const tabOf = id => (ix.target.get(id) || {}).Dompet_Tabungan_ID;
      s.dompet = k ? (k.Jenis === 'Setor' ? k.Dompet_Asal_ID : k.Dompet_Tujuan_ID) : ((Calc.dompetAktif(db).find(w => w.ID !== tabOf(s.target) && w.Tipe !== 'Tabungan') || {}).ID || '');
      UI.drawer({
        label: 'Catat kontribusi target', judul: k ? 'Ubah Kontribusi' : 'Catat Kontribusi Target', sub: 'Setor atau tarik saldo tabungan target secara terstruktur.',
        isi: `<div class="seg block lg ok" role="group" aria-label="Jenis kontribusi"><button type="button" data-j="Setor" class="${s.jenis === 'Setor' ? 'active' : ''}">${UI.ic('plus', 'ic-sm')} Setor</button><button type="button" data-j="Tarik" class="${s.jenis === 'Tarik' ? 'active' : ''}">${UI.ic('minus', 'ic-sm')} Tarik</button></div>
          <div class="field mt-16"><label class="label" for="kt-target">Target tabungan</label><select class="select" id="kt-target">${aktif.map(t => { const i = Calc.target(db, t); return `<option value="${t.ID}" ${t.ID === s.target ? 'selected' : ''}>${e(t.Nama)} (${U.rpPendek(i.terkumpul)} / ${U.rpPendek(t.Nominal_Target)})</option>`; }).join('')}</select></div>
          <div class="field"><label class="label" for="kt-nom" data-lbl>Nominal ${s.jenis === 'Setor' ? 'setoran' : 'penarikan'}</label>${fieldNominal('kt-nom', s.nominal, [100000, 250000, 500000, 1000000])}</div>
          <div class="field"><label class="label" for="kt-dompet" data-lbld>${s.jenis === 'Setor' ? 'Dompet sumber dana' : 'Dompet penerima'}</label><select class="select" id="kt-dompet"></select></div>
          <div class="field"><label class="label" for="kt-tgl">Tanggal transaksi <small>WITA</small></label><input class="input" type="datetime-local" id="kt-tgl" value="${s.tanggal}"></div>
          <div class="field"><label class="label" for="kt-cat">Catatan tambahan</label><input class="input" id="kt-cat" maxlength="300" placeholder="cth: Alokasi rutin bulanan" value="${e(s.catatan)}"></div>
          <div class="note info mt-16">${UI.ic('info', 'ic-sm')}<span>Dicatat sebagai <b>transfer antar-dompet</b>, bukan pengeluaran konsumtif. Total kekayaan tetap, dana berpindah ke dompet tabungan target.</span></div>
          <div class="err mt-16 hidden" data-err role="alert"></div>`,
        kaki: `<button class="btn btn-ghost" type="button" data-tutup>Batal</button><button class="btn btn-primary" type="button" data-ok>${UI.ic('check', 'ic-sm')} <span data-oklbl>Simpan Kontribusi</span></button>`,
        onBuka: (el, tutup) => {
          const selD = el.querySelector('#kt-dompet');
          const isiDompet = () => { selD.innerHTML = opsiDompet(s.dompet, tabOf(s.target)); s.dompet = selD.value; };
          const label = () => {
            el.querySelector('[data-lbl]').textContent = 'Nominal ' + (s.jenis === 'Setor' ? 'setoran' : 'penarikan');
            el.querySelector('[data-lbld]').textContent = s.jenis === 'Setor' ? 'Dompet sumber dana' : 'Dompet penerima';
            el.querySelector('[data-oklbl]').textContent = `Simpan Kontribusi (${s.jenis === 'Setor' ? '+' : '−'} ${U.rp(s.nominal)})`;
          };
          isiDompet(); label();
          pasangNominal(el, 'kt-nom', v => { s.nominal = v; label(); });
          el.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { s.jenis = b.dataset.j; el.querySelectorAll('[data-j]').forEach(x => x.classList.toggle('active', x === b)); label(); });
          el.querySelector('#kt-target').onchange = ev => { s.target = ev.target.value; isiDompet(); };
          selD.onchange = () => { s.dompet = selD.value; };
          el.querySelector('[data-ok]').onclick = () => {
            s.tanggal = el.querySelector('#kt-tgl').value; s.catatan = el.querySelector('#kt-cat').value.trim();
            const tg = ix.target.get(s.target), tab = tg.Dompet_Tabungan_ID, info = Calc.target(Store.db, tg);
            if (!s.nominal) return tampilGalat(el, 'Nominal harus lebih dari 0.');
            if (!s.dompet) return tampilGalat(el, 'Pilih dompet.');
            if (!/T\d{2}:\d{2}$/.test(s.tanggal)) return tampilGalat(el, 'Tanggal wajib diisi.');
            const sebelum = k && k.Target_ID === s.target ? (k.Jenis === 'Tarik' ? -k.Nominal : k.Nominal) : 0;
            if (s.jenis === 'Tarik' && s.nominal > info.terkumpul - sebelum) return tampilGalat(el, `Penarikan melebihi dana terkumpul (${U.rp(info.terkumpul - sebelum)}).`);
            const per = Calc.saldoSemua(Store.db).per, asal = s.jenis === 'Setor' ? s.dompet : tab;
            if (Store.db.pengaturan.izinkan_saldo_minus !== 'Ya' && !k && (per[asal] || 0) - s.nominal < 0) return tampilGalat(el, `Saldo ${ix.dompet.get(asal).Nama} tidak cukup (${U.rp(per[asal] || 0)}).`);
            const now = U.sekarang().iso;
            const idK = k ? k.ID_Kontribusi : U.tmpId(), idT = k ? k.ID_Transaksi_Terkait : U.tmpId();
            const tujuan = s.jenis === 'Setor' ? tab : s.dompet;
            const catatan = s.catatan || (s.jenis === 'Setor' ? 'Setor ke ' : 'Tarik dari ') + tg.Nama;
            const recK = { ID_Kontribusi: idK, Tanggal: s.tanggal, Target_ID: s.target, Jenis: s.jenis, Dompet_Asal_ID: asal, Dompet_Tujuan_ID: tujuan, Nominal: s.nominal, Catatan: catatan, ID_Transaksi_Terkait: idT, Dibuat_Pada: k ? k.Dibuat_Pada : now };
            const lamaT = ix.trx.get(idT) || {};
            const recT = Object.assign({}, lamaT, { ID_Transaksi: idT, Tanggal: s.tanggal, Jenis: 'Transfer', Kategori_ID: '', Dompet_Asal_ID: asal, Dompet_Tujuan_ID: tujuan, Nominal: s.nominal, Catatan: catatan, Sumber: 'Kontribusi', Ref_ID: idK, Status: Calc.OK, Dibuat_Pada: lamaT.Dibuat_Pada || now, Diubah_Pada: now, URL_Struk: lamaT.URL_Struk || '' });
            Store.mutasi({
              action: 'kontribusiSimpan', data: { ID_Kontribusi: k ? k.ID_Kontribusi : undefined, Target_ID: s.target, Jenis: s.jenis, Dompet_ID: s.dompet, Nominal: s.nominal, Tanggal: s.tanggal, Catatan: s.catatan },
              optimis: db => [Store.put(db, 'kontribusi', recK), Store.put(db, 'trx', recT)],
              terapkan: (db, res) => { Store.pasangServer(db, 'trx', res.trx, idT); Store.pasangServer(db, 'kontribusi', res.kontribusi, idK); }
            }).catch(err => { if (err.code !== 'AUTH') UI.galat(err, 'Kontribusi tidak tersimpan'); });
            UI.toast(`${s.jenis === 'Setor' ? 'Setoran' : 'Penarikan'} ${U.rp(s.nominal)} dicatat`, { sub: `${tg.Nama} · ${U.persen((info.terkumpul - sebelum + (s.jenis === 'Setor' ? s.nominal : -s.nominal)) / tg.Nominal_Target * 100, 1)} tercapai` });
            tutup();
          };
        }
      });
    }
  };

  window.Aksi = Aksi;
})();
