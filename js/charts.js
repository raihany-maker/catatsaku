/* Pembungkus Chart.js: warna mengikuti token tema, tooltip Rupiah + %, klik → drill-down. */
(function () {
  const daftar = new Map();
  const kurangGerak = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const siap = new Promise(res => { const cek = () => (window.Chart ? res() : setTimeout(cek, 40)); cek(); });

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function rgba(hex, a) {
    const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function warna() {
    return {
      masuk: css('--chart-in'), keluar: css('--chart-out'), grid: css('--chart-grid'), tick: css('--chart-tick'),
      teks: css('--text'), muted: css('--muted'), aksen: css('--accent'), surface: css('--surface-solid'), border: css('--border-2'),
      gelap: document.documentElement.dataset.theme !== 'light',
      kat: { oranye: css('--cat-oranye'), amber: css('--cat-amber'), hijau: css('--cat-hijau'), biru: css('--cat-biru'), mawar: css('--cat-mawar'), abu: css('--cat-abu') }
    };
  }
  function gradasi(hex, redup) {
    return ctx => {
      const { chart } = ctx, a = chart.chartArea;
      if (!a) return hex;
      const g = chart.ctx.createLinearGradient(0, a.bottom, 0, a.top);
      g.addColorStop(0, rgba(hex, redup ? 0.12 : 0.35));
      g.addColorStop(1, rgba(hex, redup ? 0.3 : 1));
      return g;
    };
  }
  // Efek pendar lembut pada batang (hanya tema gelap)
  const pendar = {
    id: 'pendar',
    beforeDatasetDraw(chart, args) {
      const ds = chart.data.datasets[args.index];
      if (!ds.pendar || !warna().gelap) return;
      chart.ctx.save();
      chart.ctx.shadowColor = rgba(ds.pendar, 0.55);
      chart.ctx.shadowBlur = 16;
      chart.ctx.shadowOffsetY = 0;
    },
    afterDatasetDraw(chart, args) { if (chart.data.datasets[args.index].pendar && warna().gelap) chart.ctx.restore(); }
  };

  function dasar(w) {
    return {
      responsive: true, maintainAspectRatio: false, animation: kurangGerak() ? false : { duration: 450 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: w.surface, titleColor: w.teks, bodyColor: w.teks, borderColor: w.border, borderWidth: 1,
          padding: 12, cornerRadius: 12, boxPadding: 6, usePointStyle: true,
          titleFont: { family: 'Plus Jakarta Sans', weight: '700', size: 13 }, bodyFont: { family: 'Inter', size: 13 }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: w.tick, font: { family: 'Inter', size: 12 } } },
        y: { grid: { color: w.grid }, border: { display: false }, ticks: { color: w.tick, font: { family: 'Inter', size: 11 }, callback: v => U.sumbuRp(v), maxTicksLimit: 6 }, beginAtZero: true }
      }
    };
  }

  function buat(canvas, cfg) {
    if (!canvas) return null;
    const lama = daftar.get(canvas);
    if (lama) lama.destroy();
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    const c = new Chart(canvas, cfg);
    daftar.set(canvas, c);
    return c;
  }
  function klik(onKlik) {
    return (ev, el) => { if (onKlik && el && el.length) onKlik(el[0].index, el[0].datasetIndex); };
  }

  const Charts = {
    siap, warna, rgba,
    hancurkanSemua() { daftar.forEach(c => c.destroy()); daftar.clear(); },

    /** Batang berkelompok Pemasukan vs Pengeluaran. sorot[i]=false → batang diredupkan (di luar periode). */
    batang(canvas, o) {
      const w = warna(), d = dasar(w);
      const sorot = o.sorot || o.labels.map(() => true);
      d.onClick = klik(o.onKlik);
      const rp = (v, x) => (o.sembunyi ? 'Rp ••••••' : U.rp(v, x));
      if (o.sembunyi) d.scales.y.ticks.callback = () => '••••';
      d.plugins.tooltip.callbacks = {
        label: c => ` ${c.dataset.label}: ${rp(c.raw)}`,
        afterBody: items => {
          const m = items.find(i => i.datasetIndex === 0), k = items.find(i => i.datasetIndex === 1);
          if (!m || !k) return '';
          const pc = m.raw ? Math.round((m.raw - k.raw) / m.raw * 100) : null;
          return pc === null ? '' : `Bersih: ${rp(m.raw - k.raw, { tanda: true })} (${pc}% dari pemasukan)`;
        }
      };
      return buat(canvas, {
        type: 'bar', plugins: [pendar],
        data: {
          labels: o.labels,
          datasets: [
            { label: 'Pemasukan', data: o.masuk, backgroundColor: c => (sorot[c.dataIndex] ? gradasi(w.masuk)(c) : rgba(w.masuk, 0.22)), borderRadius: 8, borderSkipped: 'start', maxBarThickness: 26, categoryPercentage: 0.62, barPercentage: 0.9, pendar: w.masuk },
            { label: 'Pengeluaran', data: o.keluar, backgroundColor: c => (sorot[c.dataIndex] ? gradasi(w.keluar)(c) : rgba(w.keluar, 0.22)), borderRadius: 8, borderSkipped: 'start', maxBarThickness: 26, categoryPercentage: 0.62, barPercentage: 0.9, pendar: w.keluar }
          ]
        },
        options: d
      });
    },

    /** Tren multi-bulan + garis rata-rata pengeluaran (B1). */
    tren(canvas, o) {
      const w = warna(), d = dasar(w);
      d.onClick = klik(o.onKlik);
      d.plugins.tooltip.callbacks = { label: c => ` ${c.dataset.label}: ${U.rp(c.raw)}` };
      const rata = o.keluar.length ? Math.round(o.keluar.reduce((a, b) => a + b, 0) / o.keluar.length) : 0;
      return buat(canvas, {
        type: 'bar', plugins: [pendar],
        data: {
          labels: o.labels,
          datasets: [
            { label: 'Pemasukan', data: o.masuk, backgroundColor: gradasi(w.masuk), borderRadius: 8, borderSkipped: 'start', maxBarThickness: 24, pendar: w.masuk, order: 2 },
            { label: 'Pengeluaran', data: o.keluar, backgroundColor: gradasi(w.keluar), borderRadius: 8, borderSkipped: 'start', maxBarThickness: 24, pendar: w.keluar, order: 2 },
            { type: 'line', label: 'Rata-rata pengeluaran', data: o.labels.map(() => rata), borderColor: w.muted, borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0, order: 1 }
          ]
        },
        options: d
      });
    },

    /** Garis/area (riwayat saldo, B2). */
    garis(canvas, o) {
      const w = warna(), d = dasar(w);
      d.onClick = klik(o.onKlik);
      d.interaction = { mode: 'index', intersect: false };
      d.scales.y.beginAtZero = false;
      d.scales.x.ticks.maxTicksLimit = 7;
      d.scales.x.ticks.autoSkip = true;
      d.plugins.tooltip.callbacks = { title: i => U.tglHari(o.tanggal[i[0].dataIndex]), label: c => ` Total saldo: ${U.rp(c.raw)}` };
      return buat(canvas, {
        type: 'line',
        data: {
          labels: o.labels,
          datasets: [{
            data: o.data, borderColor: w.aksen, borderWidth: 2.5, tension: 0.35, fill: true,
            backgroundColor: c => { const a = c.chart.chartArea; if (!a) return 'transparent'; const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, rgba(w.aksen, 0.32)); g.addColorStop(1, rgba(w.aksen, 0)); return g; },
            pointRadius: c => (c.dataIndex === o.data.length - 1 ? 5 : 0), pointBackgroundColor: w.aksen, pointBorderColor: w.surface, pointBorderWidth: 2, pointHoverRadius: 6
          }]
        },
        options: d
      });
    },

    /** Donat (sebaran dompet, B4). */
    donat(canvas, o) {
      const w = warna();
      const total = o.data.reduce((a, b) => a + Math.max(0, b), 0);
      return buat(canvas, {
        type: 'doughnut',
        data: { labels: o.labels, datasets: [{ data: o.data.map(v => Math.max(0, v)), backgroundColor: o.warna.map(k => w.kat[k] || w.aksen), borderColor: w.surface, borderWidth: 3, hoverOffset: 6 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '72%', animation: kurangGerak() ? false : { duration: 450 },
          onClick: klik(o.onKlik),
          plugins: {
            legend: { display: false },
            tooltip: Object.assign(dasar(w).plugins.tooltip, { callbacks: { label: c => ` ${c.label}: ${U.rp(c.raw)} (${U.persen(total ? c.raw / total * 100 : 0, 1)})` } })
          }
        }
      });
    },

    /** Garis persen (tingkat tabungan, B5). */
    persen(canvas, o) {
      const w = warna(), d = dasar(w);
      d.scales.y.ticks.callback = v => v + '%';
      d.plugins.tooltip.callbacks = { label: c => ` Tingkat tabungan: ${c.raw === null ? '– (tanpa pemasukan)' : U.persen(c.raw, 1)}` };
      return buat(canvas, {
        type: 'line',
        data: { labels: o.labels, datasets: [{ data: o.data, borderColor: w.masuk, backgroundColor: rgba(w.masuk, 0.15), fill: true, tension: 0.3, borderWidth: 2.5, spanGaps: true, pointRadius: 4, pointBackgroundColor: w.masuk, pointBorderColor: w.surface, pointBorderWidth: 2 }] },
        options: d
      });
    }
  };

  window.Charts = Charts;
})();
