/* ═══════════════════════════════════════════════════════
   ASCENT — Results.js
   Load, render KPIs, charts, and tables
═══════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const PLOTLY_LAYOUT_BASE = {
    font: { family: 'DM Sans, sans-serif', size: 11, color: '#64748b' },
    paper_bgcolor: 'transparent',
    plot_bgcolor:  'transparent',
    margin: { l: 48, r: 16, t: 44, b: 44 },
    hoverlabel: { font: { family: 'DM Sans, sans-serif', size: 11 }, bgcolor: '#1a2744', font_color: '#fff' },
    legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1, font: { size: 10 } },
    xaxis: { gridcolor: '#f0f4f8', linecolor: '#e2e8f0', zeroline: false },
    yaxis: { gridcolor: '#f0f4f8', linecolor: '#e2e8f0', zeroline: false },
  };

  // ── Loading steps animation ────────────────────────────
  const steps = ['ls1','ls2','ls3','ls4'];
  let stepIdx = 0;
  const stepInterval = setInterval(() => {
    if (stepIdx > 0) document.getElementById(steps[stepIdx-1]).classList.remove('active');
    if (stepIdx > 0) document.getElementById(steps[stepIdx-1]).classList.add('done');
    if (stepIdx < steps.length) {
      document.getElementById(steps[stepIdx]).classList.add('active');
      stepIdx++;
    }
  }, 700);

  // ── Get stored payload ─────────────────────────────────
  let payload = null;
  try {
    const raw = sessionStorage.getItem('ascentPayload');
    if (raw) payload = JSON.parse(raw);
  } catch(e) { console.error(e); }

  if (!payload) {
    showError('No form data found. Please go back and complete the questionnaire.');
    return;
  }

  // ── Call API ───────────────────────────────────────────
  async function calculate() {
    try {
      const res = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Server error: ' + res.status);
      const data = await res.json();
      clearInterval(stepInterval);
      renderDashboard(data);
    } catch (err) {
      clearInterval(stepInterval);
      showError('Calculation failed: ' + err.message);
    }
  }

  function showError(msg) {
    document.getElementById('loadingOverlay').style.display = 'none';
    const banner = document.getElementById('errorBanner');
    document.getElementById('errorMsg').textContent = msg;
    banner.classList.remove('hidden');
  }

  // ── Render ─────────────────────────────────────────────
  function renderDashboard(data) {
    const { kpis, charts, milestones, sector_detail, budget } = data;

    // Hide loading
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('dashboard').classList.remove('hidden');

    // City banner
    const city  = payload.city  || payload.district || 'City';
    const state = payload.state || '';
    const climate = payload.climate || '';
    document.getElementById('rhCity').textContent = `${city}, ${state}`;
    document.getElementById('cbCity').textContent = city;
    document.getElementById('cbMeta').textContent =
      [state, climate, `Base Year: ${kpis.base_year}`, `Target: ${kpis.target_year}`].filter(Boolean).join(' · ');

    const tagsEl = document.getElementById('cbTags');
    [[climate,'teal'], [state,'navy'], [`${kpis.target_year} Target`,'amber']].forEach(([t,c]) => {
      if (!t) return;
      const sp = document.createElement('span');
      sp.className = `cb-tag ${c}`; sp.textContent = t;
      tagsEl.appendChild(sp);
    });

    // KPIs
    document.getElementById('kpiBase').textContent = kpis.base_total_mt;
    document.getElementById('kpiPC').textContent   = kpis.per_capita;
    document.getElementById('kpiBAU').textContent  = kpis.bau_end_mt;
    document.getElementById('kpiHA').textContent   = kpis.ha_end_mt;
    document.getElementById('kpiInv').textContent  = kpis.total_inv.toLocaleString('en-IN', {maximumFractionDigits: 1});

    // Animate KPIs
    document.querySelectorAll('.kpi-card').forEach((card, i) => {
      card.style.animationDelay = (i * 0.08) + 's';
      card.style.animation = 'fadeUp 0.5s ease forwards';
      card.style.opacity = '0';
    });

    // Charts
    renderChart('chartTrajectory', charts.trajectory, { height: 380 });
    renderChart('chartPie',        charts.pie,        { height: 300 });
    renderChart('chartBar',        charts.bar_group,  { height: 300 });
    renderChart('chartBudget',     charts.budget,     { height: 300 });
    renderChart('chartSubsector',  charts.subsector,  { height: 300 });

    // Tables
    renderMilestones(milestones);
    renderSectorDetail(sector_detail, kpis.base_total_mt);
    renderBudget(budget);

    // Download buttons
    document.getElementById('dlExcel').addEventListener('click', () => downloadReport('excel'));
    document.getElementById('dlCSV').addEventListener('click',   () => downloadReport('csv'));
  }

  function renderChart(elId, chartData, extra = {}) {
    if (!chartData || !chartData.data) return;
    const layout = Object.assign({}, PLOTLY_LAYOUT_BASE, chartData.layout || {}, {
      paper_bgcolor: 'transparent',
      plot_bgcolor:  'transparent',
    });
    if (extra.height) layout.height = extra.height;
    Plotly.newPlot(elId, chartData.data, layout, { responsive: true, displayModeBar: false });
  }

  function renderMilestones(milestones) {
    const tbody = document.getElementById('milestoneBody');
    tbody.innerHTML = '';
    milestones.forEach(m => {
      const tr = document.createElement('tr');
      const statusClass = m.status === 'On Track' ? 'on-track' : 'gap';
      tr.innerHTML = `
        <td><strong>${m.year}</strong></td>
        <td>${m.bau}</td>
        <td>${m.ep}</td>
        <td>${m.ha}</td>
        <td>${m.target}</td>
        <td>${m.required_pct}</td>
        <td>${m.achieved_pct}</td>
        <td><span class="status-badge ${statusClass}">${m.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderSectorDetail(details) {
    const tbody = document.getElementById('sectorBody');
    tbody.innerHTML = '';
    details.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.sector}</td>
        <td>${d.emissions.toLocaleString('en-IN')}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="height:6px;width:${Math.min(parseFloat(d.share),100) * 1.2}px;background:var(--teal);border-radius:3px;opacity:0.7"></div>
            ${d.share}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderBudget(rows) {
    const tbody = document.getElementById('budgetBody');
    tbody.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      if (r.Sector === 'TOTAL') tr.className = 'total-row';
      tr.innerHTML = `
        <td><strong>${r.Sector}</strong></td>
        <td>${r['BAU (t CO2e)'].toLocaleString ? r['BAU (t CO2e)'].toLocaleString('en-IN') : r['BAU (t CO2e)']}</td>
        <td>${r['Reduction %']}</td>
        <td>${r['GHG Reduced (t CO2e)'].toLocaleString ? r['GHG Reduced (t CO2e)'].toLocaleString('en-IN') : r['GHG Reduced (t CO2e)']}</td>
        <td>${r['Investment (Crore)']}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── Downloads ──────────────────────────────────────────
  async function downloadReport(type) {
    try {
      const res = await fetch(`/api/download/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const city = (payload.city || 'city').replace(/\s+/g, '_');
      a.download = type === 'excel' ? `ASCENT_${city}.xlsx` : `ASCENT_${city}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Download failed: ' + e.message);
    }
  }

  // ── Start ──────────────────────────────────────────────
  calculate();

})();
