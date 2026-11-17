/**
 * Lapisan komunikasi ke Google Apps Script (REST JSON).
 * - POST wajib Content-Type text/plain (menghindari CORS preflight yang ditolak GAS).
 * - Token sesi dikirim di body (bukan URL).
 * - Baca identik yang sedang berjalan digabung (dedupe) + "epoch tulis" agar tidak
 *   menumpang baca lama setelah ada simpan.
 * - Perf.table() / Perf.summary() di console untuk mengukur waktu server vs jaringan.
 */
(function () {
  const CFG = window.CATATSAKU_CONFIG || {};
  const BACA = /^(bootstrap|sync|logList|status)$/;

  class ApiError extends Error {
    constructor(msg, code, data) { super(msg); this.code = code || 'ERR'; this.data = data || {}; }
  }

  const Perf = {
    rows: [],
    log(r) { this.rows.push(r); if (this.rows.length > 200) this.rows.shift(); },
    table() { console.table(this.rows.slice(-30)); },
    summary() {
      const g = {};
      this.rows.forEach(r => { const x = g[r.aksi] = g[r.aksi] || { n: 0, total: 0, server: 0 }; x.n++; x.total += r.total; x.server += r.server || 0; });
      console.table(Object.keys(g).map(k => ({ aksi: k, n: g[k].n, rata_total_ms: Math.round(g[k].total / g[k].n), rata_server_ms: Math.round(g[k].server / g[k].n) })));
    }
  };

  const inflight = {};
  let epochTulis = 0;

  const Api = {
    ApiError,
    url: CFG.GAS_URL || '',
    token: U.bacaLokal('cs_token') || '',
    onAuthLost: null,

    siap() { return /^https?:\/\//.test(this.url) && !/GANTI_DENGAN/.test(this.url); },
    setToken(t) { this.token = t || ''; if (t) U.simpanLokal('cs_token', t); else U.hapusLokal('cs_token'); },

    async post(action, data, opt) {
      opt = opt || {};
      const baca = BACA.test(action);
      if (!baca) epochTulis++;
      const kunci = baca ? epochTulis + '|' + action + '|' + JSON.stringify(data || {}) : null;
      if (kunci && inflight[kunci]) return inflight[kunci];
      const p = this._kirim(action, data, opt);
      if (kunci) { inflight[kunci] = p; p.then(() => delete inflight[kunci], () => delete inflight[kunci]); }
      return p;
    },

    async _kirim(action, data, opt) {
      if (!this.siap()) throw new ApiError('URL backend belum diisi di js/config.js', 'CONFIG');
      const t0 = performance.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opt.timeout || 60000);
      let res, json;
      try {
        res = await fetch(this.url, {
          method: 'POST', redirect: 'follow', signal: ctrl.signal,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, token: this.token, data: data || {} })
        });
        json = await res.json();
      } catch (e) {
        throw new ApiError(e.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Koneksi ke server bermasalah. Periksa internet Anda.', 'NET');
      } finally {
        clearTimeout(timer);
      }
      const total = Math.round(performance.now() - t0);
      Perf.log({ aksi: action, total, server: json && json.ms, jaringan: json && json.ms ? total - json.ms : null, cache: !!(json && json.cached), ok: !!(json && json.success) });
      if (!json || !json.success) {
        const code = (json && json.code) || 'ERR';
        if (code === 'AUTH' && this.onAuthLost) this.onAuthLost(json.message);
        throw new ApiError((json && json.message) || 'Terjadi kesalahan.', code, json);
      }
      return json;
    },

    /** Status publik (PIN sudah dibuat? sedang terkunci?) */
    status() { return this.post('status', {}); },

    /** Pemanasan cache server (tanpa data). Maks. 1×/4 menit per tab. */
    hangatkan() {
      if (!this.siap()) return;
      try {
        const last = Number(sessionStorage.getItem('cs_warm') || 0);
        if (Date.now() - last < 240000) return;
        sessionStorage.setItem('cs_warm', String(Date.now()));
      } catch (e) { /* abaikan */ }
      fetch(this.url + '?w=1', { mode: 'no-cors' }).catch(() => {});
    }
  };

  window.Api = Api;
  window.Perf = Perf;
})();
