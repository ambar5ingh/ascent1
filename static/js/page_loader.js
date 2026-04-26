(function () {
  'use strict';
 
  const PLOTLY_CFG = { responsive: true, displayModeBar: false };
  const PLOTLY_BASE = {
    font: { family: 'DM Sans, sans-serif', size: 11, color: '#64748b' },
    paper_bgcolor: 'transparent',
    plot_bgcolor:  'transparent',
    margin: { l: 52, r: 16, t: 48, b: 44 },
    xaxis: { gridcolor: '#f0f4f8', linecolor: '#e2e8f0', zeroline: false },
    yaxis: { gridcolor: '#f0f4f8', linecolor: '#e2e8f0', zeroline: false },
    legend: { orientation: 'h', yanchor: 'bottom', y: 1.02, xanchor: 'right', x: 1 },
  };
 
  // ── Read stored payload ─────────────────────────────────────────────────
  let payload = null;
  try {
    const raw = sessionStorage.getItem('ascentPayload');
    if (raw) payload = JSON.parse(raw);
  } catch (e) { console.error(e); }
 
  if (!payload) {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('errorBanner').classList.remove('hidden');
    return;
  }
 
  // ── Update city name in header ──────────────────────────────────────────
  const city  = payload.city  || payload.district || '';
  const state = payload.state || '';
  document.getElementById('rhCity').textContent =
    city ? `${city}${state ? ', ' + state : ''}` : '—';
 
  // ── Fetch page data from API ────────────────────────────────────────────
  async function loadPage() {
    try {
      const res = await fetch(`/api/page-data/${PAGE_SLUG}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      document.getElementById('loadingOverlay').style.display = 'none';
      document.getElementById('dashboard').classList.remove('hidden');
      render(json);
    } catch (err) {
      document.getElementById('loadingOverlay').style.display = 'none';
      document.getElementById('errorBanner').classList.remove('hidden');
      document.getElementById('errorMsg').textContent =
        `Error: ${err.message}`;
      console.error(err);
    }
  }
 
  // ── Plotly render helper ────────────────────────────────────────────────
  function drawChart(elId, chartJson, extraLayout = {}) {
    if (!chartJson || !chartJson.data) return;
    const layout = Object.assign({}, PLOTLY_BASE, chartJson.layout || {}, {
      paper_bgcolor: 'transparent',
      plot_bgcolor:  'transparent',
    }, extraLayout);
    Plotly.newPlot(elId, chartJson.data, layout, PLOTLY_CFG);
  }
 
  // ── Table builder ───────────────────────────────────────────────────────
  function makeTable(headers, rows) {
    let html = `<div class="table-wrap"><table class="data-table">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>`;
    rows.forEach(r => {
      const cls = r._class ? ` class="${r._class}"` : '';
      html += `<tr${cls}>${r.cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    });
    html += '</tbody></table></div>';
    return html;
  }
 
  // ── Card strip builder ──────────────────────────────────────────────────
  function makeCards(cards) {
    return `<div class="scenario-strip">${cards.map(c =>
      `<div class="scen-card ${c.color||'navy'}">
        <div class="scen-card-label">${c.label}</div>
        <div class="scen-card-val">${c.value}</div>
        <div class="scen-card-unit">${c.unit||''}</div>
      </div>`
    ).join('')}</div>`;
  }
 
  // ── City banner builder ─────────────────────────────────────────────────
  function cityBanner(title, meta) {
    return `<div class="city-banner">
      <div class="cb-info">
        <h1 class="cb-city">${title}</h1>
        <p class="cb-meta">${meta}</p>
      </div>
    </div>`;
  }
 
  // ── Section wrapper ─────────────────────────────────────────────────────
  function dataSection(title, sub, innerHtml) {
    return `<div class="data-section">
      <div class="ds-header">
        <h3 class="ds-title">${title}</h3>
        ${sub ? `<p class="ds-sub">${sub}</p>` : ''}
      </div>
      ${innerHtml}
    </div>`;
  }
 
  function chartCard(title, sub, elId, cls = '') {
    return `<div class="chart-card ${cls}">
      <div class="chart-header">
        <h3 class="chart-title">${title}</h3>
        ${sub ? `<p class="chart-sub">${sub}</p>` : ''}
      </div>
      <div id="${elId}" style="min-height:320px"></div>
    </div>`;
  }
 
  // ═══════════════════════════════════════════════════════════════════════
  // PAGE RENDERERS
  // ═══════════════════════════════════════════════════════════════════════
 
  function render(data) {
    const el = document.getElementById('dashboard');
    const fn = {
      'emission-profile':  renderEmissionProfile,
      'base-inventory':    renderBaseInventory,
      'bau-scenario':      renderBAUScenario,
      'bau-district':      renderBAUDistrict,
      'target-setting':    renderTargetSetting,
      'ep-scenario':       renderEPScenario,
      'ha-scenario':       renderHAScenario,
      'emission-graph':    renderEmissionGraph,
      'scenario-compare':  renderScenarioCompare,
    }[PAGE_SLUG];
    if (fn) fn(data, el);
    else el.innerHTML = `<pre style="padding:24px">${JSON.stringify(data,null,2)}</pre>`;
  }
 
  // ── 1. Emission Profile ─────────────────────────────────────────────────
  function renderEmissionProfile(d, el) {
    el.innerHTML =
      cityBanner(`Base Emission Profile — ${d.city}`,
        `${d.state} · Base Year: ${d.base_year} · Total: ${d.total.toLocaleString()} tCO₂e`) +
      makeCards([
        { label: 'Total Emissions', value: (d.total/1e6).toFixed(2), unit: 'Mt CO₂e', color: 'navy' },
        { label: 'Per Capita',      value: d.per_capita,              unit: 'tCO₂e / person', color: 'teal' },
        { label: 'Per km²',         value: d.per_sqkm,                unit: 'tCO₂e / km²',   color: 'blue' },
      ]) +
      `<div class="charts-grid">
        ${chartCard('Sector Share', 'Base year', 'profPie')}
        ${chartCard('Sector Totals', 'Mt CO₂e', 'profBar')}
      </div>` +
      dataSection('Detailed Emission Profile', 'All sub-sectors ranked by emissions',
        makeTable(
          ['Sector', 'Sub-sector', 'Emissions (tCO₂e)', 'Share (%)', 'Per Capita', 'Per km²'],
          d.profile_rows.map(r => ({
            cells: [r.sector, r.subsector,
              r.emissions_tco2e.toLocaleString('en-IN'), r.share_pct + '%',
              r.per_capita, r.per_sqkm]
          }))
        )
      );
    drawChart('profPie', d.chart_pie);
    drawChart('profBar', d.chart_bar);
  }
 
  // ── 2. Base Year GHG Inventory ──────────────────────────────────────────
  function renderBaseInventory(d, el) {
    el.innerHTML =
      cityBanner(`Base Year GHG Inventory — ${d.city}`,
        `${d.state} · Base Year: ${d.base_year} · Total: ${d.total.toLocaleString()} tCO₂e`) +
      `<div class="charts-grid">
        ${chartCard('Emissions by Sector', 'Mt CO₂e', 'invBar', 'full-width')}
      </div>` +
      dataSection('Full GHG Inventory', 'Sub-sector breakdown with sector shares',
        makeTable(
          ['Sector', 'Sub-sector / Source', 'CO₂e (t)', 'Sector Share', 'Total Share'],
          d.inventory_rows.map(r => ({
            _class: r.is_subtotal ? 'subtotal-row' : '',
            cells:  [r.sector, r.subsector,
              r.co2_eq.toLocaleString('en-IN'), r.sector_share, r.total_share]
          }))
        )
      );
    drawChart('invBar', d.chart_bar);
  }
 
  // ── 3. BAU Scenario ─────────────────────────────────────────────────────
  function renderBAUScenario(d, el) {
    const years = d.years;
    el.innerHTML =
      cityBanner(`BAU Scenario — ${d.city}`,
        `Business-As-Usual projections · Base Year: ${d.base_year}`) +
      dataSection('BAU Projections by Sector', 'Mt CO₂e at each milestone year',
        makeTable(
          ['Year', 'Total (Mt CO₂e)', ...d.sectors],
          d.bau_rows.map(r => ({
            cells: [r.year, r.total_mt,
              ...d.sectors.map(s => r[s] !== undefined ? r[s] : '—')]
          }))
        )
      );
  }
 
  // ── 4. BAU District Dashboard ───────────────────────────────────────────
  function renderBAUDistrict(d, el) {
    const years = Object.keys(d.bau_totals).sort();
    el.innerHTML =
      cityBanner(`BAU Dashboard — ${d.city}`,
        `${d.state} · Base: ${d.base_year} → Target: ${d.target_year}`) +
      makeCards([
        { label: 'BAU Base Year', value: Object.values(d.bau_totals)[0], unit: 'Mt CO₂e', color: 'navy' },
        { label: 'BAU Target Year', value: Object.values(d.bau_totals).slice(-1)[0], unit: 'Mt CO₂e', color: 'amber' },
        { label: 'Per Capita (Base)', value: d.per_capita_base, unit: 'tCO₂e / person', color: 'teal' },
      ]) +
      `<div class="charts-grid">
        ${chartCard('BAU Trajectory', 'Sector growth projection', 'bauTraj', 'full-width')}
        ${chartCard('Base Year Sector Share', '', 'bauPie')}
      </div>`;
    drawChart('bauTraj', d.trajectory_chart);
    drawChart('bauPie', d.pie_chart);
  }
 
  // ── 5. Target Setting ───────────────────────────────────────────────────
  function renderTargetSetting(d, el) {
    el.innerHTML =
      cityBanner(`Target Setting — ${d.city}`,
        `${d.state} · Reduction target: ${d.target_pct.toFixed(0)}% by ${d.target_year}`) +
      makeCards([
        { label: `BAU ${d.target_year}`,    value: Object.values(d.bau).slice(-1)[0], unit: 'Mt CO₂e', color: 'navy' },
        { label: `Target ${d.target_year}`, value: Object.values(d.targets).slice(-1)[0], unit: 'Mt CO₂e', color: 'green' },
        { label: `E&P ${d.target_year}`,    value: Object.values(d.ep).slice(-1)[0], unit: 'Mt CO₂e', color: 'blue' },
        { label: `High Ambition ${d.target_year}`, value: Object.values(d.ha).slice(-1)[0], unit: 'Mt CO₂e', color: 'teal' },
      ]) +
      dataSection('Milestone Tracking', 'Progress vs. reduction pathway at key years',
        makeTable(
          ['Year', 'BAU (Mt)', 'E&P (Mt)', 'High Ambition (Mt)', 'Target (Mt)',
           'Required Reduction', 'Achieved', 'Status'],
          d.milestones.map(m => ({
            cells: [
              m.year, m.bau, m.ep, m.ha, m.target,
              m.required_pct, m.achieved_pct,
              `<span class="status-badge ${m.status === 'On Track' ? 'on-track' : 'gap'}">${m.status}</span>`,
            ]
          }))
        )
      );
  }
 
  // ── 6. E&P Scenario ─────────────────────────────────────────────────────
  function renderEPScenario(d, el) {
    const years = d.years;
    el.innerHTML =
      cityBanner(`E&P Scenario — ${d.city}`,
        'Existing & Planned policies — emissions if all planned actions are implemented') +
      makeCards(years.map((y, i) => ({
        label: `E&P ${y}`, value: d.ep[y], unit: 'Mt CO₂e',
        color: ['navy','teal','blue','green'][i % 4]
      }))) +
      `<div class="charts-grid">
        ${chartCard('E&P vs BAU Trajectory', 'Mt CO₂e', 'epChart', 'full-width')}
      </div>` +
      dataSection('E&P vs BAU by Year', '',
        makeTable(
          ['Year', 'BAU (Mt CO₂e)', 'E&P (Mt CO₂e)', 'Reduction from BAU (Mt)'],
          years.map(y => ({
            cells: [y, d.bau[y], d.ep[y],
              ((d.bau[y] || 0) - (d.ep[y] || 0)).toFixed(3)]
          }))
        )
      );
    drawChart('epChart', d.chart);
  }
 
  // ── 7. High Ambition Scenario ───────────────────────────────────────────
  function renderHAScenario(d, el) {
    const years = d.years;
    el.innerHTML =
      cityBanner(`High Ambition Scenario — ${d.city}`,
        'Maximum feasible mitigation effort across all sectors') +
      makeCards([
        ...years.map((y, i) => ({
          label: `HA ${y}`, value: d.ha[y], unit: 'Mt CO₂e',
          color: ['navy','teal','blue','green'][i % 4]
        })),
        { label: 'Total Mitigation Investment', value: `₹${d.total_inv.toLocaleString()}`, unit: 'Crore', color: 'amber' },
      ]) +
      `<div class="charts-grid">
        ${chartCard('High Ambition Trajectory', 'Mt CO₂e', 'haChart', 'full-width')}
        ${chartCard('GHG Reduction by Sector', '', 'haBudget')}
      </div>` +
      dataSection('HA vs BAU by Year', '',
        makeTable(
          ['Year', 'BAU (Mt CO₂e)', 'High Ambition (Mt CO₂e)', 'Reduction (Mt)'],
          years.map(y => ({
            cells: [y, d.bau[y], d.ha[y],
              ((d.bau[y] || 0) - (d.ha[y] || 0)).toFixed(3)]
          }))
        )
      );
    drawChart('haChart', d.chart);
    drawChart('haBudget', d.budget_chart);
  }
 
  // ── 8. Emission Reduction Graph ─────────────────────────────────────────
  function renderEmissionGraph(d, el) {
    const years = d.years;
    el.innerHTML =
      cityBanner(`Emission Reduction Graph — ${d.city}`,
        'All scenario pathways compared to BAU and target') +
      `<div class="charts-grid">
        ${chartCard('GHG Emission Reduction Pathways', 'BAU · E&P · High Ambition · Target (Mt CO₂e)',
          'emGraph', 'full-width')}
      </div>` +
      dataSection('Pathway Data Table', 'Values in Mt CO₂e',
        makeTable(
          ['Year', 'BAU', 'E&P', 'High Ambition', 'Target'],
          years.map(y => ({
            cells: [y, d.bau[y], d.ep[y], d.ha[y], d.target[y]]
          }))
        )
      );
    drawChart('emGraph', d.chart, { height: 420 });
  }
 
  // ── 9. Scenario Comparison Dashboard ───────────────────────────────────
  function renderScenarioCompare(d, el) {
    const years = d.years;
    el.innerHTML =
      cityBanner(`Scenario Comparison — ${d.city}`,
        `All scenarios · Target Year: ${years.slice(-1)[0]} · Total Investment: ₹${d.total_inv.toLocaleString()} Cr`) +
      `<div class="charts-grid">
        ${chartCard('Scenario Comparison by Year', 'Mt CO₂e', 'scBar', 'full-width')}
        ${chartCard('Trajectory Overview', '', 'scTraj', 'full-width')}
      </div>` +
      dataSection('Comparison Data', 'Mt CO₂e per scenario per milestone year',
        makeTable(
          ['Year', 'BAU', 'E&P', 'High Ambition', 'Target'],
          years.map(y => ({
            cells: [y, d.bau[y], d.ep[y], d.ha[y], d.target[y]]
          }))
        )
      ) +
      dataSection('Mitigation Budget', 'GHG reduction potential and investment by sector',
        makeTable(
          ['Sector', 'BAU at Target Year (t)', 'Reduction %', 'GHG Reduced (t)', 'Investment (₹ Cr)'],
          (d.budget || []).map(r => ({
            _class: r.Sector === 'TOTAL' ? 'total-row' : '',
            cells: [r.Sector, r['BAU (t CO2e)'] ? r['BAU (t CO2e)'].toLocaleString('en-IN') : '',
              r['Reduction %'], r['GHG Reduced (t CO2e)'] ? r['GHG Reduced (t CO2e)'].toLocaleString('en-IN') : '',
              r['Investment (Crore)']]
          }))
        )
      );
    drawChart('scBar', d.bar_chart, { height: 360 });
    drawChart('scTraj', d.trajectory, { height: 360 });
  }
 
  // ── Start ───────────────────────────────────────────────────────────────
  loadPage();
})();
