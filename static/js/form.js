/* ═══════════════════════════════════════════════════════
   ASCENT — Form.js
   Multi-step form logic, city cascading, validation
═══════════════════════════════════════════════════════ */

(function () {
  'use strict';
 
  const TOTAL_SECTIONS = 7;
  const STORAGE_KEY    = 'ascentFormData';
  let currentSection   = 0;
 
  // ── City data ──────────────────────────────────────────
  let citiesData = [];
 
  async function loadCities() {
    try {
      const res = await axios.get('/api/cities');
      citiesData = res.data;
      populateStates();
      restoreFormData(); // restore after cities are loaded so dropdowns work
    } catch (e) {
      console.error('Could not load cities', e);
    }
  }
 
  function populateStates() {
    const states = [...new Set(citiesData.map(c => c.state))].sort();
    const sel    = document.getElementById('stateSelect');
    sel.innerHTML = '<option value="">— Choose a state —</option>';
    states.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sel.appendChild(opt);
    });
  }
 
  // ── Cascade: State → District → City ──────────────────
  document.getElementById('stateSelect').addEventListener('change', function () {
    const state = this.value;
    document.getElementById('stateHidden').value = state;
 
    const distSel = document.getElementById('districtSelect');
    const citySel = document.getElementById('citySelect');
    distSel.innerHTML = '<option value="">— Choose district —</option>';
    citySel.innerHTML  = '<option value="">— Choose city —</option>';
    document.getElementById('climateDisplay').value = '';
    document.getElementById('climateHidden').value  = '';
 
    if (!state) return;
 
    const districts = [...new Set(
      citiesData.filter(c => c.state === state).map(c => c.district)
    )].sort();
 
    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      distSel.appendChild(opt);
    });
 
    saveFormData();
    updateSummary();
  });
 
  document.getElementById('districtSelect').addEventListener('change', function () {
    const state    = document.getElementById('stateSelect').value;
    const district = this.value;
    document.getElementById('districtHidden').value = district;
 
    const citySel = document.getElementById('citySelect');
    citySel.innerHTML = '<option value="">— Choose city —</option>';
    document.getElementById('climateDisplay').value = '';
    document.getElementById('climateHidden').value  = '';
 
    if (!district) return;
 
    const cities = citiesData
      .filter(c => c.state === state && c.district === district)
      .sort((a, b) => a.city.localeCompare(b.city));
 
    cities.forEach(c => {
      const opt        = document.createElement('option');
      opt.value        = c.city;
      opt.textContent  = c.city;
      opt.dataset.climate = c.climate;
      citySel.appendChild(opt);
    });
 
    saveFormData();
  });
 
  document.getElementById('citySelect').addEventListener('change', function () {
    const opt     = this.options[this.selectedIndex];
    const climate = opt.dataset.climate || '';
    document.getElementById('climateDisplay').value = climate;
    document.getElementById('climateHidden').value  = climate;
    saveFormData();
    updateSummary();
  });
 
  // ── Subsection tabs (works for ALL sections) ───────────
  document.querySelectorAll('.sub-tab').forEach(btn => {
    btn.addEventListener('click', function () {
      const parentSection = this.closest('.form-section');
      parentSection.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
      parentSection.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      const subId = 'sub-' + this.dataset.sub;
      const panel = document.getElementById(subId);
      if (panel) panel.classList.add('active');
    });
  });
 
  // ── Transport Approach Toggle (lives in Section 2) ─────
  // The toggle buttons use data-trans="1" or data-trans="2"
  document.querySelectorAll('[data-trans]').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-trans]').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const opt = this.dataset.trans;
      const transOptInput = document.getElementById('transOption');
      if (transOptInput) transOptInput.value = opt;
 
      const fuelPanel = document.getElementById('trans-fuel-panel');
      const vktPanel  = document.getElementById('trans-vkt-panel');
      if (fuelPanel) fuelPanel.style.display = opt === '1' ? '' : 'none';
      if (vktPanel)  vktPanel.style.display  = opt === '2' ? '' : 'none';
      saveFormData();
    });
  });
 
  // ── Sliders ────────────────────────────────────────────
  const renewableSlider = document.querySelector('[name="renewable_pct"]');
  const evSlider        = document.querySelector('[name="ev_pct"]');
 
  if (renewableSlider) {
    renewableSlider.addEventListener('input', function () {
      document.getElementById('renewableVal').textContent = this.value + '%';
      updateSliderFill(this);
      saveFormData();
    });
    updateSliderFill(renewableSlider);
  }
 
  if (evSlider) {
    evSlider.addEventListener('input', function () {
      document.getElementById('evVal').textContent = this.value + '%';
      updateSliderFill(this);
      saveFormData();
    });
    updateSliderFill(evSlider);
  }
 
  function updateSliderFill(slider) {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background =
      `linear-gradient(90deg, var(--teal) ${pct}%, #e2e8f0 ${pct}%)`;
  }
 
  // ── Save all form inputs to sessionStorage ─────────────
  function saveFormData() {
    const form = document.getElementById('ascentForm');
    if (!form) return;
    const fd   = new FormData(form);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
    // also save the hidden/display fields not captured by FormData
    data['_state']    = document.getElementById('stateSelect').value;
    data['_district'] = document.getElementById('districtSelect').value;
    data['_climate']  = document.getElementById('climateDisplay').value;
    data['_transOpt'] = document.getElementById('transOption')?.value || '1';
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
 
  // ── Restore saved form data ────────────────────────────
  function restoreFormData() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let saved;
    try { saved = JSON.parse(raw); } catch (e) { return; }
 
    // 1. Restore state dropdown
    if (saved['_state']) {
      const stateSel = document.getElementById('stateSelect');
      stateSel.value = saved['_state'];
      stateSel.dispatchEvent(new Event('change')); // triggers district population
 
      // 2. Restore district after state cascade
      setTimeout(() => {
        if (saved['_district']) {
          const distSel = document.getElementById('districtSelect');
          distSel.value = saved['_district'];
          distSel.dispatchEvent(new Event('change')); // triggers city population
 
          // 3. Restore city after district cascade
          setTimeout(() => {
            if (saved['city']) {
              const citySel = document.getElementById('citySelect');
              citySel.value = saved['city'];
              // restore climate manually (dataset not set on restored options until change fires)
              document.getElementById('climateDisplay').value = saved['_climate'] || '';
              document.getElementById('climateHidden').value  = saved['_climate'] || '';
            }
            // restore all other plain inputs
            _restoreInputs(saved);
          }, 50);
        } else {
          _restoreInputs(saved);
        }
      }, 50);
    } else {
      _restoreInputs(saved);
    }
  }
 
  function _restoreInputs(saved) {
    const form = document.getElementById('ascentForm');
    // Restore all regular inputs/selects/textareas by name
    form.querySelectorAll('[name]').forEach(el => {
      const name = el.getAttribute('name');
      if (saved[name] === undefined) return;
      if (el.type === 'checkbox') {
        el.checked = saved[name] === 'on';
      } else if (el.type === 'radio') {
        el.checked = el.value === saved[name];
      } else {
        el.value = saved[name];
      }
    });
 
    // Restore sliders visual fill
    document.querySelectorAll('.range-slider').forEach(updateSliderFill);
 
    // Restore renewable/ev display labels
    if (saved['renewable_pct']) {
      const rv = document.getElementById('renewableVal');
      if (rv) rv.textContent = saved['renewable_pct'] + '%';
    }
    if (saved['ev_pct']) {
      const ev = document.getElementById('evVal');
      if (ev) ev.textContent = saved['ev_pct'] + '%';
    }
 
    // Restore transport option toggle
    const transOpt = saved['_transOpt'] || '1';
    const transOptInput = document.getElementById('transOption');
    if (transOptInput) transOptInput.value = transOpt;
    document.querySelectorAll('[data-trans]').forEach(b => {
      b.classList.toggle('active', b.dataset.trans === transOpt);
    });
    const fuelPanel = document.getElementById('trans-fuel-panel');
    const vktPanel  = document.getElementById('trans-vkt-panel');
    if (fuelPanel) fuelPanel.style.display = transOpt === '1' ? '' : 'none';
    if (vktPanel)  vktPanel.style.display  = transOpt === '2' ? '' : 'none';
 
    updateSummary();
  }
 
  // ── Auto-save on any input change ─────────────────────
  document.getElementById('ascentForm').addEventListener('input', saveFormData);
  document.getElementById('ascentForm').addEventListener('change', saveFormData);
 
  // ── Live summary update ────────────────────────────────
  function updateSummary() {
    const city = document.getElementById('citySelect').value || '—';
    const state = document.getElementById('stateSelect').value || '—';
    const pop   = document.querySelector('[name="population"]')?.value;
    const yr    = document.querySelector('[name="target_year"]')?.value;
 
    const ssCity  = document.getElementById('ss-city');
    const ssState = document.getElementById('ss-state');
    const ssPop   = document.getElementById('ss-pop');
    const ssYr    = document.getElementById('ss-yr');
    const rhCity  = document.getElementById('rhCity');
 
    if (ssCity)  ssCity.textContent  = city;
    if (ssState) ssState.textContent = state;
    if (ssPop)   ssPop.textContent   = pop ? Number(pop).toLocaleString('en-IN') : '—';
    if (ssYr)    ssYr.textContent    = yr || '2050';
    if (rhCity)  rhCity.textContent  = city !== '—' ? `${city}, ${state}` : '';
  }
 
  // ── Navigation dots builder ────────────────────────────
  function buildDots() {
    const container = document.getElementById('navDots');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < TOTAL_SECTIONS; i++) {
      const dot = document.createElement('div');
      dot.className = 'nav-dot'
        + (i === currentSection ? ' active' : '')
        + (i < currentSection  ? ' done'   : '');
      dot.addEventListener('click', () => goTo(i));
      container.appendChild(dot);
    }
  }
 
  // ── Go to section ──────────────────────────────────────
  function goTo(idx) {
    if (idx < 0 || idx >= TOTAL_SECTIONS) return;
 
    document.querySelectorAll('.form-section').forEach((s, i) => {
      s.classList.toggle('active', i === idx);
    });
 
    document.querySelectorAll('.ps').forEach((p, i) => {
      p.classList.toggle('active', i === idx);
      p.classList.toggle('done',   i < idx);
    });
 
    currentSection = idx;
 
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.style.display = idx === TOTAL_SECTIONS - 1 ? 'none' : '';
 
    const fill = (idx / (TOTAL_SECTIONS - 1)) * 100;
    const pf   = document.getElementById('progressFill');
    if (pf) pf.style.width = fill + '%';
 
    buildDots();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateSummary();
    saveFormData();
  }
 
  // ── Nav button wiring ──────────────────────────────────
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => goTo(currentSection - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(currentSection + 1));
 
  // Progress section label clicks
  document.querySelectorAll('.ps').forEach((p, i) => {
    p.addEventListener('click', () => goTo(i));
  });
 
  // ── Refresh / Reset button ─────────────────────────────
  // Inject a refresh button into the header badge area
  function injectRefreshButton() {
    const header = document.querySelector('.site-header');
    if (!header) return;
 
    // Remove existing refresh btn if any
    const existing = document.getElementById('refreshBtn');
    if (existing) existing.remove();
 
    const btn = document.createElement('button');
    btn.id = 'refreshBtn';
    btn.type = 'button';
    btn.title = 'Clear all inputs and start fresh';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
      Reset Form
    `;
    btn.style.cssText = `
      margin-left:12px; display:flex; align-items:center; gap:6px;
      padding:6px 14px; border-radius:8px; cursor:pointer;
      border:1.5px solid #ef4444; background:transparent;
      color:#ef4444; font-size:0.75rem; font-weight:700;
      font-family:var(--font-body); letter-spacing:0.03em;
      transition:all 0.2s;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#ef4444';
      btn.style.color = '#fff';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = '#ef4444';
    });
    btn.addEventListener('click', resetForm);
 
    // Insert before the header badge
    const badge = header.querySelector('.header-badge');
    if (badge) {
      header.insertBefore(btn, badge);
    } else {
      header.appendChild(btn);
    }
  }
 
  function resetForm() {
    if (!confirm('Clear all entered data and start fresh?')) return;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('ascentPayload');
 
    // Reset the actual form
    document.getElementById('ascentForm').reset();
 
    // Reset dropdowns
    document.getElementById('stateSelect').innerHTML  = '<option value="">— Choose a state —</option>';
    document.getElementById('districtSelect').innerHTML = '<option value="">— Choose district —</option>';
    document.getElementById('citySelect').innerHTML    = '<option value="">— Choose city —</option>';
    document.getElementById('climateDisplay').value   = '';
    document.getElementById('climateHidden').value    = '';
    document.getElementById('stateHidden').value      = '';
    document.getElementById('districtHidden').value   = '';
 
    // Re-populate states
    populateStates();
 
    // Reset sliders
    document.querySelectorAll('.range-slider').forEach(updateSliderFill);
    const rv = document.getElementById('renewableVal');
    const ev = document.getElementById('evVal');
    if (rv) rv.textContent = '40%';
    if (ev) ev.textContent = '30%';
 
    // Reset transport toggle
    const transOptInput = document.getElementById('transOption');
    if (transOptInput) transOptInput.value = '1';
    document.querySelectorAll('[data-trans]').forEach(b => {
      b.classList.toggle('active', b.dataset.trans === '1');
    });
    const fp = document.getElementById('trans-fuel-panel');
    const vp = document.getElementById('trans-vkt-panel');
    if (fp) fp.style.display = '';
    if (vp) vp.style.display = 'none';
 
    goTo(0);
    updateSummary();
  }
 
  // ── Form submission ────────────────────────────────────
  document.getElementById('ascentForm').addEventListener('submit', async function (e) {
    e.preventDefault();
 
    const city  = document.getElementById('citySelect').value;
    const state = document.getElementById('stateSelect').value;
    const pop   = document.querySelector('[name="population"]').value;
 
    if (!city || !state || !pop) {
      alert('Please fill in City, State, and Population before calculating.');
      goTo(0);
      return;
    }
 
    const btn = document.getElementById('calculateBtn');
    btn.querySelector('.btn-text').classList.add('hidden');
    btn.querySelector('.btn-loading').classList.remove('hidden');
    btn.disabled = true;
 
    const fd   = new FormData(this);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
 
    // Percent fields → decimals
    const pctFields = {
      'sw_food_frac_pct':      'sw_food_frac',
      'sw_lfm_pct':            'sw_lfm',
      'sw_inc_pct':            'sw_inc',
      'sw_gas_collection_pct': 'sw_gas_collection',
      'ww_aer_pct':            'ww_aer',
      'ww_uasb_pct':           'ww_uasb',
      'ww_sep_pct':            'ww_sep',
      'ww_open_pct':           'ww_open',
      'target_pct_input':      'target_pct',
    };
    Object.entries(pctFields).forEach(([src, dst]) => {
      if (data[src] !== undefined && data[src] !== '') {
        data[dst] = parseFloat(data[src]) / 100;
      }
    });
 
    if (data.growth_rate) data.growth_rate = parseFloat(data.growth_rate) / 100;
 
    sessionStorage.setItem('ascentPayload', JSON.stringify(data));
    window.location.href = '/results';
  });
 
  // ── Init ──────────────────────────────────────────────
  injectRefreshButton();
  buildDots();
  goTo(0);
  loadCities(); // restoreFormData() is called inside after cities load
})();
