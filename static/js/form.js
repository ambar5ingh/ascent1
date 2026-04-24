/* ═══════════════════════════════════════════════════════
   ASCENT — Form.js
   Multi-step form logic, city cascading, validation
═══════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const TOTAL_SECTIONS = 7;
  let currentSection = 0;

  // ── City data ──────────────────────────────────────────
  let citiesData = [];

  async function loadCities() {
    try {
      const res = await axios.get('/api/cities');
      citiesData = res.data;
      populateStates();
    } catch (e) {
      console.error('Could not load cities', e);
    }
  }

  function populateStates() {
    const states = [...new Set(citiesData.map(c => c.state))].sort();
    const sel = document.getElementById('stateSelect');
    states.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sel.appendChild(opt);
    });
  }

  document.getElementById('stateSelect').addEventListener('change', function() {
    const state = this.value;
    document.getElementById('stateHidden').value = state;
    const distSel = document.getElementById('districtSelect');
    const citySel = document.getElementById('citySelect');
    distSel.innerHTML = '<option value="">— Choose district —</option>';
    citySel.innerHTML = '<option value="">— Choose city —</option>';
    document.getElementById('climateDisplay').value = '';
    document.getElementById('climateHidden').value = '';
    if (!state) return;
    const districts = [...new Set(
      citiesData.filter(c => c.state === state).map(c => c.district)
    )].sort();
    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      distSel.appendChild(opt);
    });
  });

  document.getElementById('districtSelect').addEventListener('change', function() {
    const state = document.getElementById('stateSelect').value;
    const district = this.value;
    document.getElementById('districtHidden').value = district;
    const citySel = document.getElementById('citySelect');
    citySel.innerHTML = '<option value="">— Choose city —</option>';
    document.getElementById('climateDisplay').value = '';
    document.getElementById('climateHidden').value = '';
    if (!district) return;
    const cities = citiesData
      .filter(c => c.state === state && c.district === district)
      .sort((a, b) => a.city.localeCompare(b.city));
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.city; opt.textContent = c.city;
      opt.dataset.climate = c.climate;
      citySel.appendChild(opt);
    });
  });

  document.getElementById('citySelect').addEventListener('change', function() {
    const opt = this.options[this.selectedIndex];
    const climate = opt.dataset.climate || '';
    document.getElementById('climateDisplay').value = climate;
    document.getElementById('climateHidden').value = climate;
    updateSummary();
  });

  // ── Subsection tabs ────────────────────────────────────
  document.querySelectorAll('.sub-tab').forEach(btn => {
    btn.addEventListener('click', function() {
      const parent = this.closest('.form-section');
      parent.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
      parent.querySelectorAll('.sub-panel').forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      const sub = this.dataset.sub;
      const panel = document.getElementById('sub-' + sub);
      if (panel) panel.classList.add('active');
    });
  });

  // ── Slider display ─────────────────────────────────────
  document.querySelector('[name="renewable_pct"]').addEventListener('input', function() {
    document.getElementById('renewableVal').textContent = this.value + '%';
    updateSliderFill(this);
  });
  document.querySelector('[name="ev_pct"]').addEventListener('input', function() {
    document.getElementById('evVal').textContent = this.value + '%';
    updateSliderFill(this);
  });

  function updateSliderFill(slider) {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background = `linear-gradient(90deg, var(--teal) ${pct}%, #e2e8f0 ${pct}%)`;
  }

  // init slider fills
  document.querySelectorAll('.range-slider').forEach(updateSliderFill);

  // ── Progress & Navigation ──────────────────────────────
  function buildDots() {
    const container = document.getElementById('navDots');
    container.innerHTML = '';
    for (let i = 0; i < TOTAL_SECTIONS; i++) {
      const dot = document.createElement('div');
      dot.className = 'nav-dot' + (i === currentSection ? ' active' : '') + (i < currentSection ? ' done' : '');
      dot.addEventListener('click', () => goTo(i));
      container.appendChild(dot);
    }
  }

  function goTo(idx) {
    if (idx < 0 || idx >= TOTAL_SECTIONS) return;
    document.querySelectorAll('.form-section').forEach((s, i) => {
      s.classList.toggle('active', i === idx);
    });
    document.querySelectorAll('.ps').forEach((p, i) => {
      p.classList.toggle('active', i === idx);
      p.classList.toggle('done', i < idx);
    });
    currentSection = idx;
    document.getElementById('prevBtn').disabled = idx === 0;
    document.getElementById('nextBtn').style.display = idx === TOTAL_SECTIONS - 1 ? 'none' : '';
    const fill = ((idx) / (TOTAL_SECTIONS - 1)) * 100;
    document.getElementById('progressFill').style.width = fill + '%';
    buildDots();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateSummary();
  }

  document.getElementById('prevBtn').addEventListener('click', () => goTo(currentSection - 1));
  document.getElementById('nextBtn').addEventListener('click', () => goTo(currentSection + 1));

  // Allow clicking progress section labels
  document.querySelectorAll('.ps').forEach((p, i) => {
    p.addEventListener('click', () => goTo(i));
  });

  // ── Live summary update ────────────────────────────────
  function updateSummary() {
    const city = document.getElementById('citySelect').value || '—';
    const state = document.getElementById('stateSelect').value || '—';
    const pop = document.querySelector('[name="population"]').value;
    const yr = document.querySelector('[name="target_year"]').value;
    document.getElementById('ss-city').textContent = city;
    document.getElementById('ss-state').textContent = state;
    document.getElementById('ss-pop').textContent = pop ? Number(pop).toLocaleString('en-IN') : '—';
    document.getElementById('ss-yr').textContent = yr || '2050';
    document.getElementById('rhCity') && (document.getElementById('rhCity').textContent = city !== '—' ? `${city}, ${state}` : '');
  }

  document.querySelector('[name="population"]').addEventListener('input', updateSummary);
  document.querySelector('[name="target_year"]').addEventListener('input', updateSummary);

  // ── Form submission ────────────────────────────────────
  document.getElementById('ascentForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const city = document.getElementById('citySelect').value;
    const state = document.getElementById('stateSelect').value;
    const pop = document.querySelector('[name="population"]').value;
    if (!city || !state || !pop) {
      alert('Please fill in City, State, and Population before calculating.');
      goTo(0);
      return;
    }

    const btn = document.getElementById('calculateBtn');
    btn.querySelector('.btn-text').classList.add('hidden');
    btn.querySelector('.btn-loading').classList.remove('hidden');
    btn.disabled = true;

    // Collect all form data
    const fd = new FormData(this);
    const data = {};
    fd.forEach((v, k) => {
      data[k] = v;
    });

    // Convert percentage fields to decimals
    const pctFields = {
      'sw_food_frac_pct': 'sw_food_frac',
      'sw_lfm_pct':       'sw_lfm',
      'sw_inc_pct':       'sw_inc',
      'sw_gas_collection_pct': 'sw_gas_collection',
      'ww_aer_pct':       'ww_aer',
      'ww_uasb_pct':      'ww_uasb',
      'ww_sep_pct':       'ww_sep',
      'ww_open_pct':      'ww_open',
      'target_pct_input': 'target_pct',
    };
    Object.entries(pctFields).forEach(([src, dst]) => {
      if (data[src] !== undefined && data[src] !== '') {
        data[dst] = parseFloat(data[src]) / 100;
      }
    });

    // Growth rate percent to decimal
    if (data.growth_rate) data.growth_rate = parseFloat(data.growth_rate) / 100;

    // Store payload for results page
    sessionStorage.setItem('ascentPayload', JSON.stringify(data));

    // Navigate to results
    window.location.href = '/results';
  });

  // ── Init ──────────────────────────────────────────────
  buildDots();
  goTo(0);
  loadCities();

})();
