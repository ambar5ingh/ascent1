(function() {
  'use strict';

  let payload = null;
  try {
    const raw = sessionStorage.getItem('ascentPayload');
    if (raw) payload = JSON.parse(raw);
  } catch(e) { console.error(e); }

  if (!payload) {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('errorBanner').classList.remove('hidden');
    return;
  }

  // Update city name in header
  document.getElementById('rhCity').textContent = payload.city || payload.district || '';

  async function loadPageData() {
    try {
      const res = await fetch(`/api/page-data/${PAGE_SLUG}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('API error ' + res.status);
      const data = await res.json();
      document.getElementById('loadingOverlay').style.display = 'none';
      renderPage(data);
    } catch(err) {
      document.getElementById('loadingOverlay').style.display = 'none';
      document.getElementById('errorBanner').classList.remove('hidden');
      document.getElementById('errorMsg').textContent = err.message;
    }
  }

  function renderPage(data) {
    const dash = document.getElementById('dashboard');
    dash.classList.remove('hidden');
    // Each page slug renders different HTML
    const renderers = {
      'emission-profile':  renderEmissionProfile,
      'base-inventory':    renderBaseInventory,
      'bau-scenario':      renderBAU,
      'bau-district':      renderBAUDashboard,
      'target-setting':    renderTargets,
      'ep-scenario':       renderEP,
      'ha-scenario':       renderHA,
      'emission-graph':    renderEmissionGraph,
      'scenario-compare':  renderScenarioCompare,
    };
    const fn = renderers[PAGE_SLUG];
    if (fn) fn(data, dash);
    else dash.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
  }

  function makeTable(headers, rows, totalRow) {
    let html = `<div class='table-wrap'><table class='data-table'>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>`;
    rows.forEach(r => { html += `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`; });
    if (totalRow) html += `<tr class='total-row'>${totalRow.map(c=>`<td>${c}</td>`).join('')}</tr>`;
    html += '</tbody></table></div>';
    return html;
  }

  function renderEmissionProfile(data, el) {
    el.innerHTML = `
      <div class='city-banner'>
        <div class='cb-info'>
          <h1 class='cb-city'>Base Emission Profile — ${payload.district || payload.city}</h1>
          <p class='cb-meta'>Base Year: ${payload.base_year} | Total: ${data.total.toLocaleString()} tCO₂e
            | Per Capita: ${data.per_capita} tCO₂e | Per km²: ${data.per_sqkm} tCO₂e</p>
        </div>
      </div>
      <div class='charts-grid'>
        <div class='chart-card full-width'>
          <div class='chart-header'><h3 class='chart-title'>Sector Share</h3></div>
          <div id='profilePie'></div>
        </div>
      </div>
      <div class='data-section'>
        <div class='ds-header'><h3 class='ds-title'>Emission Profile Details</h3></div>
        ${makeTable(
          ['Sector','Sub-sector','Emissions (tCO₂e)','Share (%)','Per Capita','Per km²'],
          data.profile_rows.map(r => [r.sector, r.subsector,
            r.emissions_tco2e.toLocaleString(), r.share_pct + '%',
            r.per_capita, r.per_sqkm])
        )}
      </div>`;
    if (data.chart) Plotly.newPlot('profilePie', data.chart.data, data.chart.layout, {responsive:true, displayModeBar:false});
  }

  // Similar render functions for other pages...
  function renderBaseInventory(data, el) {
    el.innerHTML = `<div class='city-banner'><div class='cb-info'>
        <h1 class='cb-city'>Base Year GHG Inventory</h1></div></div>
      <div class='data-section'><div class='ds-header'><h3 class='ds-title'>Full GHG Inventory</h3></div>
        ${makeTable(['Sector','Sub-sector','CO₂e (t)','Sector Share','Total Share'],
          data.inventory_rows.map(r => [r.sector, r.subsector,
            r.co2_eq.toLocaleString(), r.sector_share+'%', r.total_share+'%']))}
      </div>`;
  }

  function renderBAU(data, el) {
    el.innerHTML = `<div class='city-banner'><div class='cb-info'>
        <h1 class='cb-city'>BAU Scenario Projections</h1></div></div>
      <div class='data-section'><div class='ds-header'><h3 class='ds-title'>Business As Usual Emissions</h3></div>
        ${makeTable(['Year','Total (Mt CO₂e)'],
          data.bau_rows.map(r => [r.year, r.total_mt]))}
      </div>`;
  }

  function renderBAUDashboard(data, el) {
    el.innerHTML = `<div class='charts-grid'>
        <div class='chart-card full-width'><div class='chart-header'>
          <h3 class='chart-title'>BAU Trajectory</h3></div>
          <div id='bauChart' style='min-height:380px'></div></div></div>`;
    if (data.trajectory_chart)
      Plotly.newPlot('bauChart', data.trajectory_chart.data, data.trajectory_chart.layout, {responsive:true, displayModeBar:false});
  }

  function renderTargets(data, el) {
    el.innerHTML = `<div class='city-banner'><div class='cb-info'>
        <h1 class='cb-city'>Target Setting</h1></div></div>
      <div class='data-section'><div class='ds-header'><h3 class='ds-title'>Milestone Tracking</h3></div>
        ${makeTable(
          ['Year','BAU (Mt)','E&P (Mt)','High Ambition (Mt)','Target (Mt)','Required %','Achieved %','Status'],
          data.milestones.map(m => [m.year, m.bau, m.ep, m.ha, m.target, m.required_pct, m.achieved_pct,
            `<span class='status-badge ${m.status==="On Track"?"on-track":"gap"}'>${m.status}</span>`])
        )}
      </div>`;
  }

  function renderEP(data, el) {
    el.innerHTML = `<div class='city-banner'><div class='cb-info'>
        <h1 class='cb-city'>Existing & Planned (E&P) Scenario</h1></div></div>`,
    '<p style="padding:24px;color:#64748b">E&P Scenario shows emissions if all currently planned policies and actions are implemented.</p>';
  }

  function renderHA(data, el) {
    el.innerHTML = `<div class='city-banner'><div class='cb-info'>
        <h1 class='cb-city'>High Ambition Scenario</h1></div></div>`,
    '<p style="padding:24px;color:#64748b">High Ambition represents maximum feasible mitigation effort across all sectors.</p>';
  }

  function renderEmissionGraph(data, el) {
    el.innerHTML = `<div class='charts-grid'>
      <div class='chart-card full-width'><div class='chart-header'>
        <h3 class='chart-title'>Emission Reduction Pathways</h3></div>
        <div id='emGraphChart' style='min-height:420px'></div></div></div>`;
    if (data.chart) Plotly.newPlot('emGraphChart', data.chart.data, data.chart.layout, {responsive:true, displayModeBar:false});
  }

  function renderScenarioCompare(data, el) {
    el.innerHTML = `<div class='charts-grid'>
        <div class='chart-card full-width'><div class='chart-header'>
          <h3 class='chart-title'>Scenario Comparison</h3></div>
          <div id='compareChart' style='min-height:350px'></div></div></div>`;
    if (data.bar_chart) Plotly.newPlot('compareChart', data.bar_chart.data, data.bar_chart.layout, {responsive:true, displayModeBar:false});
  }

  loadPageData();
})();
