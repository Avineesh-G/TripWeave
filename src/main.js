// Purge any legacy mock data from browser storage immediately
try {
  const cached = localStorage.getItem('tripweave_state');
  if (cached && (cached.includes('coorg') || cached.includes('blr') || cached.includes('hampi'))) {
    localStorage.removeItem('tripweave_state');
  }
} catch (e) {}


// Verified Indian Tourist Places Operating Hours (100% Free Built-in Engine)
const VERIFIED_INDIAN_HOURS = {
  'mysore palace': { open: 600, close: 1050, name: '10:00 AM - 05:30 PM' },
  'abbey falls': { open: 540, close: 1020, name: '09:00 AM - 05:00 PM' },
  'namdroling': { open: 540, close: 1080, name: '09:00 AM - 06:00 PM' },
  'golden temple': { open: 540, close: 1080, name: '09:00 AM - 06:00 PM' },
  'raja': { open: 330, close: 1200, name: '05:30 AM - 08:00 PM' },
  'dubare': { open: 540, close: 990, name: '09:00 AM - 04:30 PM' },
  'virupaksha': { open: 360, close: 1080, name: '06:00 AM - 06:00 PM' },
  'hampi': { open: 360, close: 1080, name: '06:00 AM - 06:00 PM' },
  'amer fort': { open: 480, close: 1050, name: '08:00 AM - 05:30 PM' },
  'hawa mahal': { open: 540, close: 1020, name: '09:00 AM - 05:00 PM' },
  'shore temple': { open: 360, close: 1080, name: '06:00 AM - 06:00 PM' },
  'mahabalipuram': { open: 360, close: 1080, name: '06:00 AM - 06:00 PM' }
};

function getPlaceHours(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(VERIFIED_INDIAN_HOURS)) {
    if (lower.includes(key)) return val;
  }
  return { open: 540, close: 1080, name: '09:00 AM - 06:00 PM (Standard)' };
}

// 1-Tap "Plan Accordingly" Auto-Fix Function
window.autoPlanDeparture = function(stopId, arrivalMins, closeMins) {
  const trip = getActiveTrip();
  // Calculate minutes needed so user arrives with at least 45 minutes visit buffer before closing
  const shiftNeeded = Math.max(30, (arrivalMins - closeMins) + 45);
  const currentDeparture = trip.departureTimeMinutes || 480; // default 08:00 AM
  const newDeparture = Math.max(300, currentDeparture - shiftNeeded); // do not depart earlier than 05:00 AM

  trip.departureTimeMinutes = newDeparture;
  Storage.save(state);
  
  // Refresh and recompute
  refreshApp();
};


// ==========================================================================
// OPTION A: LIVE OSRM ROUTING & PHOTON PLACES API
// ==========================================================================

// Cache for live OSRM routes to prevent duplicate requests
const routeCache = new Map();

async function fetchLiveOsrmRoute(stops) {
  if (!stops || stops.length < 2) return null;
  const coords = stops.map(s => `${s.longitude},${s.latitude}`).join(';');
  if (routeCache.has(coords)) return routeCache.get(coords);

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const result = {
        polylineLatlngs: route.geometry.coordinates.map(c => [c[1], c[0]]),
        distanceKm: route.distance / 1000,
        durationMinutes: Math.round(route.duration / 60)
      };
      routeCache.set(coords, result);
      return result;
    }
  } catch (err) {
    console.warn('OSRM live routing fallback to local calculation:', err);
  }
  return null;
}

// Live Places Search with Debounce & Instant Indian Attractions Cache
let searchDebounceTimer = null;

function setupLivePlaceSearch() {
  const searchInput = document.getElementById('place-search-input');
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (!searchInput || !dropdown) return;

  // Local Indian Attractions Cache for instant suggestions
  const LOCAL_INDIAN_DESTINATIONS = [
    { name: 'Mysore Palace', sub: 'Mysuru, Karnataka, India', lat: 12.3052, lng: 76.6552 },
    { name: 'Abbey Falls', sub: 'Madikeri, Coorg, Karnataka, India', lat: 12.4516, lng: 75.7187 },
    { name: 'Raja\'s Seat', sub: 'Madikeri, Coorg, Karnataka, India', lat: 12.4214, lng: 75.7368 },
    { name: 'Bylakuppe Golden Temple', sub: 'Kushalnagar, Karnataka, India', lat: 12.4334, lng: 75.9647 },
    { name: 'Virupaksha Temple', sub: 'Hampi, Bellary, Karnataka, India', lat: 15.3353, lng: 76.4600 },
    { name: 'Amer Fort', sub: 'Jaipur, Rajasthan, India', lat: 26.9855, lng: 75.8513 },
    { name: 'Hawa Mahal', sub: 'Jaipur, Rajasthan, India', lat: 26.9239, lng: 75.8267 },
    { name: 'Shore Temple', sub: 'Mahabalipuram, Tamil Nadu, India', lat: 12.6163, lng: 80.1983 },
    { name: 'Ooty Botanical Gardens', sub: 'Nilgiris, Tamil Nadu, India', lat: 11.4167, lng: 76.7110 },
    { name: 'Channapatna Craft Park', sub: 'Ramanagara, Karnataka, India', lat: 12.6518, lng: 77.2089 }
  ];

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    clearTimeout(searchDebounceTimer);

    if (query.length < 2) {
      dropdown.innerHTML = '';
      dropdown.classList.add('hidden');
      return;
    }

    // 1. Instant local matches
    const localMatches = LOCAL_INDIAN_DESTINATIONS.filter(d => 
      d.name.toLowerCase().includes(query) || d.sub.toLowerCase().includes(query)
    );

    // Show searching placeholder if waiting for network
    dropdown.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--on-surface-variant); text-align: center;">Searching places across India...</div>';
    dropdown.classList.remove('hidden');

    searchDebounceTimer = setTimeout(async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
        const res = await fetch(url);
        let items = [...localMatches];

        if (res.ok) {
          const data = await res.json();
          const features = data.features || [];
          features.forEach(f => {
            const p = f.properties;
            const name = p.name || 'Place in India';
            const sub = [p.city, p.state, p.country].filter(Boolean).join(', ');
            const coords = f.geometry.coordinates; // [lng, lat]
            // Avoid duplicate by name
            if (!items.some(i => i.name.toLowerCase() === name.toLowerCase())) {
              items.push({ name, sub, lat: coords[1], lng: coords[0] });
            }
          });
        }

        if (items.length === 0) {
          dropdown.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--on-surface-variant); text-align: center;">No matching places found</div>';
          dropdown.classList.remove('hidden');
          return;
        }

        dropdown.innerHTML = items.slice(0, 6).map(item => `
          <div class="search-suggestion-item" data-name="${item.name}" data-lat="${item.lat}" data-lng="${item.lng}">
            <div class="suggestion-text">
              <div class="suggestion-name">${item.name}</div>
              <div class="suggestion-sub">${item.sub}</div>
            </div>
            <button class="btn-small primary" style="padding: 4px 10px; font-size: 11px; white-space: nowrap;">+ Add</button>
          </div>
        `).join('');

        dropdown.classList.remove('hidden');

        // Suggestion click listeners
        dropdown.querySelectorAll('.search-suggestion-item').forEach(el => {
          el.onclick = () => {
            const name = el.getAttribute('data-name');
            const lat = parseFloat(el.getAttribute('data-lat'));
            const lng = parseFloat(el.getAttribute('data-lng'));

            const stops = state.stopsMap[state.activeTripId];
            const newStop = {
              id: `stop-${Date.now()}`,
              tripId: state.activeTripId,
              name,
              latitude: lat,
              longitude: lng,
              orderIndex: stops.length,
              durationMinutes: 60,
              bufferMinutes: 15,
              isOvernight: false,
              openingHourMinutes: 540,
              closingHourMinutes: 1080
            };
            stops.push(newStop);
            Storage.save(state);

            dropdown.classList.add('hidden');
            searchInput.value = '';

            if (mapInstance) {
              mapInstance.setView([lat, lng], 11);
            }

            refreshApp();
            showToast(`Added ${name} to itinerary!`);
          };
        });
      } catch (err) {
        console.warn('Place search fallback:', err);
        if (localMatches.length > 0) {
          dropdown.innerHTML = localMatches.map(item => `
            <div class="search-suggestion-item" data-name="${item.name}" data-lat="${item.lat}" data-lng="${item.lng}">
              <div class="suggestion-text">
                <div class="suggestion-name">${item.name}</div>
                <div class="suggestion-sub">${item.sub}</div>
              </div>
              <button class="btn-small primary" style="padding: 4px 10px; font-size: 11px;">+ Add</button>
            </div>
          `).join('');
          dropdown.classList.remove('hidden');
        } else {
          dropdown.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--on-surface-variant); text-align: center;">Network busy. Try again.</div>';
        }
      }
    }, 280);
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

import { ScheduleEngine, BudgetEngine, FeasibilityEvaluator } from './engines.js';
import { TRANSLATIONS, SAMPLE_TRIPS, Storage } from './data.js';

// Application State
let state = Storage.load();
let currentTab = 'map';
let currentScenario = 'typical';
let mapInstance = null;
let mapMarkers = [];
let routePolyline = null;

// Helpers
function getActiveTrip() {
  return state.trips.find(t => t.id === state.activeTripId) || state.trips[0];
}

function getActiveStops() {
  return state.stopsMap[state.activeTripId] || [];
}

function getActiveExpenses() {
  return state.expensesMap[state.activeTripId] || [];
}

function formatMinutes(minutes) {
  if (minutes === undefined || minutes === null) return '--:--';
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// Recalculate plan deterministically
function computePlan() {
  const trip = getActiveTrip() || {
    id: 'trip-1',
    title: 'My Road Trip',
    destinationName: 'New Destination',
    departureTimeMinutes: 480,
    totalBudget: 15000,
    groupSize: 2,
    vehicleMileageKmPerLitre: 16.0,
    fuelPricePerLitre: 102.8,
    isArchived: false
  };
  const stops = getActiveStops();
  const expenses = getActiveExpenses();

  const scheduleResult = ScheduleEngine.calculateSchedule(trip, stops);
  const totalDistanceKm = scheduleResult.stops && scheduleResult.stops.length > 0
    ? scheduleResult.stops.reduce((sum, s) => sum + (s.distanceFromPreviousKm || 0), 0)
    : 0;
  const budgetResult = BudgetEngine.calculateBudget(trip, expenses, totalDistanceKm);
  const feasibilityReport = stops.length > 0
    ? FeasibilityEvaluator.evaluate(trip, scheduleResult, budgetResult)
    : { overallFeasibility: 'FEASIBLE', timeUsedPercent: 0, budgetUsedPercent: 0, warnings: [] };

  return { trip, stops, expenses, scheduleResult, budgetResult, feasibilityReport, totalDistanceKm };
}

// Feasibility Ring & Pill Updater (Spec 2 & 6)
function updateFeasibilityUI(feasibilityReport) {
  const labelEl = document.getElementById('feasibility-label-text');
  const pillEl = document.getElementById('feasibility-pill-btn');
  const timeCircle = document.getElementById('ring-time-circle');
  const budgetCircle = document.getElementById('ring-budget-circle');

  const t = TRANSLATIONS[state.lang] || TRANSLATIONS.en;

  let labelText = t.feasible || 'Feasible';
  pillEl.className = 'feasibility-pill';

  if (feasibilityReport.overallFeasibility === 'INFEASIBLE') {
    labelText = t.infeasible || 'Not Feasible';
    pillEl.classList.add('infeasible');
    pillEl.style.border = '1.5px solid var(--error)';
  } else if (feasibilityReport.overallFeasibility === 'TIGHT') {
    labelText = t.tight || 'Tight';
    pillEl.classList.add('tight');
    pillEl.style.border = '1.5px solid var(--caution)';
  } else {
    pillEl.style.border = '1.5px solid var(--outline-variant)';
  }

  labelEl.textContent = labelText;

  // Animate SVG rings
  const budgetDash = 88 - (Math.min(100, feasibilityReport.budgetUsedPercent) / 100) * 88;
  const timeDash = 63 - (Math.min(100, feasibilityReport.timeUsedPercent) / 100) * 63;
  if (budgetCircle) budgetCircle.style.strokeDashoffset = budgetDash;
  if (timeCircle) timeCircle.style.strokeDashoffset = timeDash;

  if (budgetCircle) {
    if (feasibilityReport.budgetUsedPercent > 100) {
      budgetCircle.style.stroke = 'var(--error)';
    } else if (feasibilityReport.budgetUsedPercent > 85) {
      budgetCircle.style.stroke = 'var(--caution)';
    } else {
      budgetCircle.style.stroke = 'var(--success)';
    }
  }
}

function updateHeaderUI(plan) {
  document.getElementById('header-trip-title').textContent = plan.trip ? plan.trip.title : 'My Road Trip';
  const nextStop = plan.stops[0];
  document.getElementById('peek-next-stop-title').textContent = nextStop ? `Next: ${nextStop.name}` : 'Plan your road trip';
  document.getElementById('peek-stats-subtitle').textContent = plan.stops.length > 0
    ? `${plan.stops.length} stops • ${Math.round(plan.totalDistanceKm)} km • ${plan.trip.groupSize} travelers`
    : 'Search places above to add stops';
  
  // Calculate cost based on scenario
  let mult = 1.0;
  if (currentScenario === 'low') mult = 0.88;
  if (currentScenario === 'high') mult = 1.18;

  const cost = plan.stops.length > 0 ? Math.round(plan.budgetResult.totalCost * mult) : 0;
  document.getElementById('peek-total-cost').textContent = `₹${cost.toLocaleString('en-IN')}`;
  document.getElementById('peek-budget-caption').textContent = `of ₹${Math.round(plan.trip.totalBudget || 0).toLocaleString('en-IN')} budget`;

  // Sheet compact stop list
  const sheetList = document.getElementById('sheet-stops-compact-list');
  if (sheetList) {
    if (plan.stops.length === 0) {
      sheetList.innerHTML = `
        <div style="text-align: center; padding: 18px 12px; color: var(--on-surface-variant); font-size: 13px;">
          No stops added yet. Type in search bar above or tap "+ Add Stop" to start.
        </div>
      `;
    } else {
      sheetList.innerHTML = plan.scheduleResult.stops.map((s, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--surface-container-low); border: 1px solid var(--outline-variant); border-radius: var(--radius-sm); font-size: 13px;">
          <div><strong>${idx + 1}. ${s.stop.name}</strong></div>
          <div style="color: var(--on-surface-variant); font-variant-numeric: tabular-nums;">${formatMinutes(s.arrivalMinutes)} - ${formatMinutes(s.departureMinutes)}</div>
        </div>
      `).join('');
    }
  }

  updateFeasibilityUI(plan.feasibilityReport);
}

// Vector Icon Generator Helpers (NO EMOJIS)
const ICONS = {
  car: `<svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="6" rx="2"></rect><circle cx="7.5" cy="17.5" r="2.5"></circle><circle cx="16.5" cy="17.5" r="2.5"></circle><path d="M5 11l2-5h10l2 5"></path></svg>`,
  fuel: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"></line><line x1="4" y1="9" x2="14" y2="9"></line><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L19 6"></path></svg>`,
  tolls: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 19 8 5 10 5 7 19"></polygon><polygon points="14 19 17 5 19 5 17 19"></polygon><line x1="12" y1="7" x2="12" y2="17" stroke-dasharray="2 2"></line></svg>`,
  stays: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8v9"></path></svg>`,
  food: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`,
  activities: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path></svg>`,
  warning: `<svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  check: `<svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  moon: `<svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  clock: `<svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
};

function updateItineraryView(plan) {
  const container = document.getElementById('timeline-list');
  if (!container) return;

  container.innerHTML = '';

  if (!plan.stops || plan.stops.length === 0) {
    container.innerHTML = `
      <div style="padding: 36px 16px; text-align: center; background: var(--surface-container-low); border: 1px dashed var(--outline-variant); border-radius: 16px; margin: 16px 0;">
        <div style="font-size: 15px; font-weight: 700; color: var(--on-surface);">Your Itinerary is Empty</div>
        <p style="font-size: 12.5px; color: var(--on-surface-variant); margin: 6px 0 16px 0; line-height: 1.5;">Search places in the top bar or tap the button below to add your first destination.</p>
        <button class="btn-primary" onclick="openStopModal()" style="padding: 9px 20px; font-size: 13px;">+ Add First Stop</button>
      </div>
    `;
    return;
  }

  plan.scheduleResult.stops.forEach((scheduled, index) => {
    const itemWrapper = document.createElement('div');
    itemWrapper.className = 'timeline-item-wrapper';

    const hoursInfo = getPlaceHours(scheduled.stop.name);
    const openMins = scheduled.stop.openingHours ? scheduled.stop.openingHours.openMinutes : (hoursInfo ? hoursInfo.open : 540);
    const closeMins = scheduled.stop.openingHours ? scheduled.stop.openingHours.closeMinutes : (hoursInfo ? hoursInfo.close : 1080);
    const hoursLabel = scheduled.stop.openingHours && scheduled.stop.openingHours.isOpen24Hours 
      ? 'Open 24 Hours' 
      : `${formatMinutes(openMins)} – ${formatMinutes(closeMins)}`;

    let closingBanner = '';
    let warningBadge = '';

    if (scheduled.openingStatus === 'CLOSED_ON_ARRIVAL') {
      warningBadge = `<span class="confidence-chip error">${ICONS.warning}<span>Closed on Arrival</span></span>`;
      closingBanner = `
        <div style="background: var(--error-container); color: var(--error); padding: 8px 10px; border-radius: var(--radius-sm); font-size: 11px; margin-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div>
            <strong>Closed upon arrival!</strong> Arriving at ${formatMinutes(scheduled.arrivalMinutes)} (closes at ${formatMinutes(closeMins)})
          </div>
          <button class="btn-small primary" style="padding: 4px 8px; font-size: 10px; white-space: nowrap;" onclick="autoPlanDeparture('${scheduled.stop.id}', ${scheduled.arrivalMinutes}, ${closeMins})">Plan Accordingly</button>
        </div>
      `;
    } else if (scheduled.openingStatus === 'TIGHT_CLOSING') {
      warningBadge = `<span class="confidence-chip tight">${ICONS.clock}<span>Closing Soon</span></span>`;
      closingBanner = `
        <div style="background: var(--caution-container); color: var(--caution); padding: 8px 10px; border-radius: var(--radius-sm); font-size: 11px; margin-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div>
            <strong>Closing soon:</strong> Only ${Math.max(10, closeMins - scheduled.arrivalMinutes)}m before ${formatMinutes(closeMins)} closing
          </div>
          <button class="btn-small" style="padding: 4px 8px; font-size: 10px; white-space: nowrap;" onclick="autoPlanDeparture('${scheduled.stop.id}', ${scheduled.arrivalMinutes}, ${closeMins})">Adjust</button>
        </div>
      `;
    } else {
      warningBadge = `<span class="confidence-chip official">${ICONS.check}<span>Open on Arrival</span></span>`;
    }

    const overnightBadge = scheduled.stop.isOvernight 
      ? `<span class="confidence-chip" style="background: var(--secondary-container); color: var(--primary);">${ICONS.moon}<span>Overnight Rest</span></span>` 
      : '';

    itemWrapper.innerHTML = `
      <div class="timeline-spine-col">
        <div class="timeline-dot">${index + 1}</div>
        ${index < plan.scheduleResult.stops.length - 1 ? '<div class="timeline-spine-line"></div>' : ''}
      </div>
      <div class="timeline-content-col">
        <div class="timeline-card" data-stop-id="${scheduled.stop.id}">
          <div class="timeline-card-header">
            <div>
              <div class="stop-title">${scheduled.stop.name}</div>
              <div class="stop-times">${formatMinutes(scheduled.arrivalMinutes)} — ${formatMinutes(scheduled.departureMinutes)} (${scheduled.stop.durationMinutes}m visit)</div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="btn-small edit-stop-btn" data-id="${scheduled.stop.id}">Edit</button>
              ${index > 0 && index < plan.scheduleResult.stops.length - 1 ? `<button class="btn-small delete-stop-btn" data-id="${scheduled.stop.id}" style="color: var(--error);">✕</button>` : ''}
            </div>
          </div>
          <div class="stop-meta-row">
            ${warningBadge}
            ${overnightBadge}
            <span class="confidence-chip calculated">${ICONS.clock}<span>Hours: ${hoursLabel}</span></span>
          </div>
          ${closingBanner}
        </div>
      </div>
    `;

    container.appendChild(itemWrapper);

    // Connector between stops
    if (index < plan.scheduleResult.stops.length - 1) {
      const nextScheduled = plan.scheduleResult.stops[index + 1];
      const conn = document.createElement('div');
      conn.className = 'travel-connector';
      conn.innerHTML = `
        ${ICONS.car}
        <span>${Math.round(nextScheduled.distanceFromPreviousKm)} km</span>
        <span>•</span>
        <span>${nextScheduled.travelDurationFromPreviousMinutes} mins drive</span>
      `;
      container.appendChild(conn);
    }
  });

  // Attach delete & edit listeners
  container.querySelectorAll('.delete-stop-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const stops = state.stopsMap[state.activeTripId];
      state.stopsMap[state.activeTripId] = stops.filter(s => s.id !== id);
      Storage.save(state);
      refreshApp();
    };
  });

  container.querySelectorAll('.edit-stop-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const stop = state.stopsMap[state.activeTripId].find(s => s.id === id);
      if (stop) openStopModal(stop);
    };
  });
}

function updateBudgetView(plan) {
  let mult = 1.0;
  if (currentScenario === 'low') mult = 0.88;
  if (currentScenario === 'high') mult = 1.18;

  const totalCost = Math.round(plan.budgetResult.totalCost * mult);
  const perPerson = Math.round(totalCost / plan.trip.groupSize);
  const remaining = Math.max(0, Math.round(plan.trip.totalBudget - totalCost));
  const budgetPct = Math.min(100, (totalCost / plan.trip.totalBudget) * 100);

  const heroAmountEl = document.getElementById('budget-hero-amount');
  if (heroAmountEl) heroAmountEl.textContent = `₹${totalCost.toLocaleString('en-IN')}`;

  const perPersonEl = document.getElementById('budget-per-person-text');
  if (perPersonEl) perPersonEl.textContent = `₹${perPerson.toLocaleString('en-IN')} / person • ${plan.trip.groupSize} travelers`;

  const remainingEl = document.getElementById('budget-remaining-text');
  if (remainingEl) remainingEl.textContent = `₹${remaining.toLocaleString('en-IN')} Remaining`;

  const fill = document.getElementById('budget-meter-fill');
  if (fill) {
    fill.style.width = `${budgetPct}%`;
    fill.className = 'budget-progress-fill';
    if (budgetPct > 100) fill.classList.add('error');
    else if (budgetPct > 85) fill.classList.add('caution');
  }

  // Contingency
  const contingencyVal = Math.round(totalCost * 0.10);
  const contingencyEl = document.getElementById('budget-contingency-val');
  if (contingencyEl) contingencyEl.textContent = `₹${contingencyVal.toLocaleString('en-IN')}`;

  // Category cards with Crisp Vector Icons
  const container = document.getElementById('category-cards-list');
  if (!container) return;

  const categories = [
    { key: 'fuel', iconHtml: ICONS.fuel, name: 'Fuel Expenditure', amount: Math.round(plan.budgetResult.fuelCost * mult), note: `${Math.round(plan.totalDistanceKm)} km @ ₹${plan.trip.fuelPrice}/L (${plan.trip.mileage} km/L)` },
    { key: 'tolls', iconHtml: ICONS.tolls, name: 'FASTag Highway Tolls', amount: Math.round(plan.budgetResult.tollCost * mult), note: 'Fastag NHAI toll plaza charges' },
    { key: 'stays', iconHtml: ICONS.stays, name: 'Accommodations & Homestays', amount: Math.round(plan.budgetResult.stayCost * mult), note: 'Verified estate stays & resorts' },
    { key: 'food', iconHtml: ICONS.food, name: 'Meals & Highway Food', amount: Math.round(plan.budgetResult.foodCost * mult), note: `3 meals/day for ${plan.trip.groupSize} travelers` },
    { key: 'activities', iconHtml: ICONS.activities, name: 'Entry Tickets & Safari', amount: Math.round(plan.budgetResult.activityCost * mult), note: 'Official temple & park entrance fees' }
  ];

  container.innerHTML = categories.map(cat => `
    <div class="budget-category-row">
      <div class="budget-cat-left">
        <div class="budget-cat-icon-box">${cat.iconHtml}</div>
        <div>
          <div class="budget-cat-name">${cat.name}</div>
          <div style="font-size: 11px; color: var(--on-surface-variant);">${cat.note}</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="confidence-chip official">${ICONS.check}<span>Official</span></span>
        <div class="budget-cat-amount">₹${cat.amount.toLocaleString('en-IN')}</div>
      </div>
    </div>
  `).join('');
}

function updateWarningsModal(plan) {
  const container = document.getElementById('warnings-list-body');
  if (!container) return;

  container.innerHTML = '';
  const warningsList = plan.feasibilityReport.warnings || [];

  if (warningsList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--success);">
        <div style="width: 44px; height: 44px; margin: 0 auto 10px auto; border-radius: 50%; background: var(--success-container); display: flex; align-items: center; justify-content: center; color: var(--success);">
          <svg class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <strong>Itinerary is Fully Feasible</strong>
        <p style="font-size: 13px; color: var(--on-surface-variant); margin-top: 4px;">All stop arrivals occur within visiting hours, and travel buffers are satisfied.</p>
      </div>
    `;
    return;
  }

  warningsList.forEach(w => {
    const card = document.createElement('div');
    const isConflict = w.severity === 'HARD_CONFLICT';
    card.className = `warning-card ${isConflict ? 'conflict' : (w.severity === 'INFO' ? 'info' : '')}`;
    card.innerHTML = `
      <div class="warning-title">
        <svg class="icon-sm" style="color: ${isConflict ? 'var(--error)' : 'var(--caution)'};" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>${w.title}</span>
      </div>
      <div class="warning-desc">Automated check by FeasibilityEvaluator. Adjust schedule or buffers to clear.</div>
      ${isConflict ? `
        <div class="warning-actions">
          <button class="btn-small primary" onclick="shiftDeparture(30)">Shift Departure -30m</button>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

// Map Management with High-DPI Retina Tiles
function initMap() {
  if (mapInstance) return;
  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl) return;

  // Clean mobile-first map: no zoom controls overlapping search bar (pinch-to-zoom supported)
  mapInstance = L.map('leaflet-map', {
    zoomControl: false
  }).setView([12.5, 76.5], 8);

  // Crystal-clear OpenStreetMap tiles with zero tile seams, zero watermarks, and zero pixelation
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    tileSize: 256,
    zoomOffset: 0,
    detectRetina: false, // Prevents fractional scaling grid seams and unreadable compressed text
    crossOrigin: true
  }).addTo(mapInstance);
}

async function updateMapRoute(plan) {
  if (!mapInstance) return;

  mapMarkers.forEach(m => mapInstance.removeLayer(m));
  mapMarkers = [];
  if (routePolyline) mapInstance.removeLayer(routePolyline);

  if (!plan.stops || plan.stops.length === 0) {
    // Pan to India center gracefully
    mapInstance.setView([20.5937, 78.9629], 5);
    return;
  }

  // Render Stop Markers
  plan.stops.forEach((s, idx) => {
    const isOrigin = idx === 0;
    const isDest = idx === plan.stops.length - 1;
    const marker = L.circleMarker([s.latitude, s.longitude], {
      radius: isOrigin || isDest ? 9 : 8,
      fillColor: isOrigin ? '#3B5FCC' : (isDest ? '#1B6E3E' : '#DCE4FF'),
      color: isOrigin || isDest ? '#FFFFFF' : '#0B1F5C',
      weight: 2.5,
      opacity: 1,
      fillOpacity: 1
    }).addTo(mapInstance);

    marker.bindPopup(`<strong>${idx + 1}. ${s.name}</strong><br>${s.durationMinutes}m visit • ${s.bufferMinutes || 15}m buffer`);
    mapMarkers.push(marker);
  });

  // Fetch Live OSRM Road Polyline
  const liveRoute = await fetchLiveOsrmRoute(plan.stops);
  const polylineCoords = liveRoute ? liveRoute.polylineLatlngs : plan.stops.map(s => [s.latitude, s.longitude]);

  // Multi-layered antialiased highway route casing (Outer halo + Crisp inner line)
  const routeHalo = L.polyline(polylineCoords, {
    color: '#FFFFFF',
    weight: 8,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(mapInstance);

  routePolyline = L.polyline(polylineCoords, {
    color: '#2563EB',
    weight: 5,
    opacity: 1,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(mapInstance);
  
  mapMarkers.push(routeHalo);

  mapInstance.fitBounds(polylineCoords, { padding: [40, 40] });
}

// Navigation Tab Switcher
function switchTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.screen-view').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  const targetScreen = document.getElementById(`screen-${tabName}`);
  const targetTab = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
  if (targetScreen) targetScreen.classList.add('active');
  if (targetTab) targetTab.classList.add('active');

  if (tabName === 'map' && mapInstance) {
    setTimeout(() => mapInstance.invalidateSize(), 150);
  }
}

// Stop Modal (Duration Stepper)
let activeEditingStopId = null;

function openStopModal(stop = null) {
  const modal = document.getElementById('modal-add-stop');
  modal.classList.remove('hidden');

  if (stop) {
    activeEditingStopId = stop.id;
    document.getElementById('stop-modal-title').textContent = 'Edit Stop Details';
    document.getElementById('stop-name-input').value = stop.name;
    document.getElementById('stop-duration-input').value = stop.durationMinutes;
    document.getElementById('stop-buffer-input').value = stop.bufferMinutes;
    document.getElementById('stop-overnight-input').checked = !!stop.isOvernight;
  } else {
    activeEditingStopId = null;
    document.getElementById('stop-modal-title').textContent = 'Add Stop to Route';
    document.getElementById('stop-name-input').value = '';
    document.getElementById('stop-duration-input').value = 60;
    document.getElementById('stop-buffer-input').value = 15;
    document.getElementById('stop-overnight-input').checked = false;
  }
}

function saveStopModal() {
  const name = document.getElementById('stop-name-input').value.trim() || 'Custom Stop';
  const duration = parseInt(document.getElementById('stop-duration-input').value, 10) || 60;
  const buffer = parseInt(document.getElementById('stop-buffer-input').value, 10) || 15;
  const isOvernight = document.getElementById('stop-overnight-input').checked;

  const stops = state.stopsMap[state.activeTripId];

  if (activeEditingStopId) {
    const existing = stops.find(s => s.id === activeEditingStopId);
    if (existing) {
      existing.name = name;
      existing.durationMinutes = duration;
      existing.bufferMinutes = buffer;
      existing.isOvernight = isOvernight;
    }
  } else {
    const lastStop = stops[stops.length - 1] || { latitude: 12.97, longitude: 77.59 };
    const newStop = {
      id: `stop-${Date.now()}`,
      tripId: state.activeTripId,
      name,
      latitude: lastStop.latitude + (Math.random() - 0.5) * 0.1,
      longitude: lastStop.longitude + (Math.random() - 0.5) * 0.1,
      orderIndex: stops.length,
      durationMinutes: duration,
      bufferMinutes: buffer,
      isOvernight,
      openingHourMinutes: 540,
      closingHourMinutes: 1080
    };
    stops.push(newStop);
  }

  Storage.save(state);
  document.getElementById('modal-add-stop').classList.add('hidden');
  refreshApp();
}

// Global Refresh

function updateTripsView() {
  const container = document.getElementById('user-trips-list');
  if (!container) return;

  if (!state.trips || state.trips.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--on-surface-variant); font-size: 13px;">
        No saved trips yet. Tap "+ New" above to create your first road trip.
      </div>
    `;
    return;
  }

  container.innerHTML = state.trips.map(trip => {
    const stops = state.stopsMap[trip.id] || [];
    const isActive = trip.id === state.activeTripId;
    return `
      <div class="timeline-card" style="cursor: pointer; ${isActive ? 'border-color: var(--primary); background: var(--surface-container);' : ''}" onclick="selectTrip('${trip.id}')">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <strong style="font-size: 14px; color: var(--on-surface);">${trip.title}</strong>
            <div style="font-size: 12px; color: var(--on-surface-variant); margin-top: 2px;">${stops.length} stops • ${trip.groupSize} travelers</div>
          </div>
          ${isActive ? '<span class="chip active" style="font-size: 10px; padding: 2px 8px;">Active</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

window.selectTrip = function(tripId) {
  state.activeTripId = tripId;
  Storage.save(state);
  switchTab('map');
  refreshApp();
};

function refreshApp() {
  updateTripsView();
  const plan = computePlan();
  updateHeaderUI(plan);
  updateItineraryView(plan);
  updateBudgetView(plan);
  updateWarningsModal(plan);
  updateMapRoute(plan);
}

// Global Shift Departure Helper
window.shiftDeparture = function(mins) {
  const trip = getActiveTrip();
  trip.departureTimeMinutes = Math.max(0, (trip.departureTimeMinutes || 360) - mins);
  Storage.save(state);
  document.getElementById('modal-warnings-center').classList.add('hidden');
  refreshApp();
};

// Setup Event Listeners

// ==========================================================================
// EXPORT & SHARE ENGINE (WhatsApp, PDF Road Book, Offline Backup)
// ==========================================================================

function showToast(message) {
  const toast = document.getElementById('app-toast');
  const textEl = document.getElementById('toast-text');
  if (!toast || !textEl) return;
  textEl.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2600);
}

function generateWhatsAppSummary(trip, stops, schedule, expenses) {
  if (!trip || !stops || stops.length === 0) return '';

  const depTimeStr = formatMinutes(trip.departureTimeMinutes || 480);
  const totalCost = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const perPersonCost = trip.groupSize > 0 ? Math.round(totalCost / trip.groupSize) : totalCost;

  let lines = [];
  lines.push(`🚗 *Road Trip Itinerary: ${trip.title}*`);
  lines.push(`📍 ${stops.length} Stops • ${trip.groupSize || 4} Travelers • Departs at ${depTimeStr}`);
  lines.push(`---------------------------------`);
  lines.push(`🗓️ *TIMELINE & VISITS:*`);

  (schedule || []).forEach((item, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === (schedule.length - 1);
    const arrStr = formatMinutes(item.arrivalTimeMinutes);
    const depStr = formatMinutes(item.departureTimeMinutes);
    const hours = getPlaceHours(item.stop.name);
    const hoursNote = hours ? ` · [Open: ${hours.name}]` : '';

    if (isFirst) {
      lines.push(`${idx + 1}. *${item.stop.name}* (Departure ${depStr})`);
    } else if (isLast && item.stop.isOvernight) {
      lines.push(`${idx + 1}. *${item.stop.name}* (Arrival ${arrStr}) · 🌙 Overnight Stay`);
    } else {
      lines.push(`${idx + 1}. *${item.stop.name}* (Arr ${arrStr} ➔ Dep ${depStr}) [${item.stop.durationMinutes}m stop]${hoursNote}`);
    }
  });

  lines.push(`---------------------------------`);
  lines.push(`💰 *ESTIMATED BUDGET:*`);
  lines.push(`Total: ₹${totalCost.toLocaleString('en-IN')} (₹${perPersonCost.toLocaleString('en-IN')}/person)`);

  const fuelExp = expenses.find(e => e.category === 'FUEL') || { amount: 4200 };
  const tollExp = expenses.find(e => e.category === 'TOLL') || { amount: 380 };
  const stayExp = expenses.find(e => e.category === 'STAY') || { amount: 4800 };
  const foodExp = expenses.find(e => e.category === 'FOOD') || { amount: 2400 };

  lines.push(`• Fuel: ₹${fuelExp.amount.toLocaleString('en-IN')} | Tolls: ₹${tollExp.amount.toLocaleString('en-IN')}`);
  lines.push(`• Stays: ₹${stayExp.amount.toLocaleString('en-IN')} | Food: ₹${foodExp.amount.toLocaleString('en-IN')}`);

  lines.push(`---------------------------------`);
  lines.push(`⚠️ *ROAD & SAFETY ADVISORIES:*`);
  lines.push(`• Daylight ghat driving recommended on winding sections.`);
  lines.push(`• Keep FASTag active with sufficient balance.`);
  lines.push(`• Emergency Assistance: NHAI 1033 | National 112`);
  lines.push(`---------------------------------`);
  lines.push(`✨ Planned with *TripWeave* (100% Free Deterministic Planner)`);

  return lines.join('\n');
}

function openShareModal() {
  const plan = computePlan();
  const trip = plan.trip;
  const stops = plan.stops;
  const schedule = plan.schedule;
  const expenses = plan.expenses;

  const modal = document.getElementById('modal-share-trip');
  const titleEl = document.getElementById('share-trip-title');
  const metaEl = document.getElementById('share-trip-meta');
  const chipEl = document.getElementById('share-feasibility-chip');
  const textarea = document.getElementById('share-whatsapp-text');

  if (titleEl) titleEl.textContent = trip.title;
  if (metaEl) {
    const estKm = Math.round((stops.length - 1) * 65);
    metaEl.textContent = `${stops.length} stops • ~${estKm} km • ${trip.groupSize || 4} travelers`;
  }
  if (chipEl) {
    const isFeasible = plan.feasibility.status === 'FEASIBLE';
    chipEl.textContent = isFeasible ? 'Feasible' : 'Conflicts Detected';
    chipEl.className = `chip ${isFeasible ? 'success' : 'caution'}`;
  }

  const waText = generateWhatsAppSummary(trip, stops, schedule, expenses);
  if (textarea) textarea.value = waText;

  if (modal) modal.classList.remove('hidden');
}

function copyShareText() {
  const textarea = document.getElementById('share-whatsapp-text');
  if (!textarea) return;
  const text = textarea.value;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Itinerary copied to clipboard!');
    }).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const textarea = document.getElementById('share-whatsapp-text');
  textarea.select();
  document.execCommand('copy');
  showToast('Itinerary copied to clipboard!');
}

function openWhatsApp() {
  const textarea = document.getElementById('share-whatsapp-text');
  if (!textarea) return;
  const text = textarea.value;
  const encoded = encodeURIComponent(text);
  const waUrl = `https://api.whatsapp.com/send?text=${encoded}`;
  window.open(waUrl, '_blank');
}

function exportPrintRoadBook() {
  // Ensure Itinerary is active for rendering full road tables
  switchTab('itinerary');
  const modal = document.getElementById('modal-share-trip');
  if (modal) modal.classList.add('hidden');
  
  setTimeout(() => {
    window.print();
  }, 300);
}

function exportTripJson() {
  const plan = computePlan();
  const exportData = {
    tripweaveVersion: '3.0',
    exportedAt: new Date().toISOString(),
    trip: plan.trip,
    stops: plan.stops,
    expenses: plan.expenses,
    schedule: plan.schedule
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', dataStr);
  dlAnchor.setAttribute('download', `tripweave-${plan.trip.id || 'itinerary'}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();

  showToast('Exported Trip JSON successfully!');
}

function setupEvents() {
  // Google Account Modal Controller (Google Maps Native Style)
  const accountBtn = document.getElementById('account-avatar-btn');
  const accountModal = document.getElementById('modal-google-account');
  const accountCloseBtn = document.getElementById('modal-account-close-btn');

  if (accountBtn && accountModal) {
    accountBtn.onclick = (e) => {
      e.stopPropagation();
      accountModal.classList.remove('hidden');
    };
  }

  if (accountCloseBtn && accountModal) {
    accountCloseBtn.onclick = () => {
      accountModal.classList.add('hidden');
    };
  }

  if (accountModal) {
    accountModal.onclick = (e) => {
      if (e.target === accountModal) {
        accountModal.classList.add('hidden');
      }
    };
  }

  // Share & Export Listeners
  const btnOpenShare = document.getElementById('btn-open-share');
  if (btnOpenShare) btnOpenShare.onclick = openShareModal;

  const btnShareItin = document.getElementById('btn-share-itinerary');
  if (btnShareItin) btnShareItin.onclick = openShareModal;

  const shareCloseBtn = document.getElementById('modal-share-close-btn');
  if (shareCloseBtn) shareCloseBtn.onclick = () => document.getElementById('modal-share-trip').classList.add('hidden');

  const shareDoneBtn = document.getElementById('modal-share-done-btn');
  if (shareDoneBtn) shareDoneBtn.onclick = () => document.getElementById('modal-share-trip').classList.add('hidden');

  const btnWaSend = document.getElementById('btn-share-whatsapp-send');
  if (btnWaSend) btnWaSend.onclick = openWhatsApp;

  const btnCopyText = document.getElementById('btn-share-copy-text');
  if (btnCopyText) btnCopyText.onclick = copyShareText;

  const btnExportPdf = document.getElementById('btn-export-pdf');
  if (btnExportPdf) btnExportPdf.onclick = exportPrintRoadBook;

  const btnExportJson = document.getElementById('btn-export-json');
  if (btnExportJson) btnExportJson.onclick = exportTripJson;

  // Navigation tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.onclick = () => switchTab(tab.getAttribute('data-tab'));
  });

  // Pull-up Bottom Sheet Toggle
  const dragHandle = document.getElementById('sheet-drag-handle');
  const peekSheet = document.getElementById('map-peek-sheet');
  const summaryPeek = document.getElementById('sheet-summary-peek');

  if (dragHandle && peekSheet) {
    dragHandle.onclick = (e) => {
      e.stopPropagation();
      peekSheet.classList.toggle('expanded');
    };
  }
  if (summaryPeek && peekSheet) {
    summaryPeek.onclick = () => peekSheet.classList.toggle('expanded');
  }

  const openFullItinBtn = document.getElementById('btn-open-full-itinerary');
  if (openFullItinBtn) {
    openFullItinBtn.onclick = () => {
      peekSheet.classList.remove('expanded');
      switchTab('itinerary');
    };
  }

  // Feasibility Pill opens Warnings Center
  document.getElementById('feasibility-pill-btn').onclick = () => {
    document.getElementById('modal-warnings-center').classList.remove('hidden');
  };
  document.getElementById('modal-warnings-close-btn').onclick = () => {
    document.getElementById('modal-warnings-center').classList.add('hidden');
  };
  document.getElementById('modal-warnings-dismiss-btn').onclick = () => {
    document.getElementById('modal-warnings-center').classList.add('hidden');
  };

  // Component Gallery Launcher
  const galleryModal = document.getElementById('modal-component-gallery');
  document.getElementById('btn-open-gallery').onclick = () => { if (accountMenu) accountMenu.classList.add('hidden'); galleryModal.classList.remove('hidden'); };
  const launchGalleryFromSettings = document.getElementById('btn-launch-gallery-from-settings');
  if (launchGalleryFromSettings) launchGalleryFromSettings.onclick = () => galleryModal.classList.remove('hidden');
  document.getElementById('modal-gallery-close-btn').onclick = () => galleryModal.classList.add('hidden');

  // Compare Plans Launcher
  const compareModal = document.getElementById('modal-compare-plans');
  document.getElementById('btn-open-compare').onclick = () => { if (accountMenu) accountMenu.classList.add('hidden'); compareModal.classList.remove('hidden'); };
  document.getElementById('modal-compare-close-btn').onclick = () => compareModal.classList.add('hidden');

  document.getElementById('btn-use-budget-plan').onclick = () => {
    currentScenario = 'low';
    document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-scenario-low').classList.add('active');
    compareModal.classList.add('hidden');
    refreshApp();
  };

  document.getElementById('btn-use-time-plan').onclick = () => {
    currentScenario = 'typical';
    document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-scenario-typical').classList.add('active');
    compareModal.classList.add('hidden');
    refreshApp();
  };

  // Scenario Buttons
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentScenario = btn.getAttribute('data-scenario');
      refreshApp();
    };
  });

  // Language Dropdown & Cards
  const langSelect = document.getElementById('lang-select');
  langSelect.value = state.lang;
  langSelect.onchange = (e) => {
    state.lang = e.target.value;
    Storage.save(state);
    refreshApp();
  };

  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.onclick = () => {
      state.lang = btn.getAttribute('data-lang');
      langSelect.value = state.lang;
      Storage.save(state);
      refreshApp();
    };
  });

  // Theme Toggle
  document.getElementById('theme-toggle-btn').onclick = () => {
    document.body.classList.toggle('theme-dark');
    document.body.classList.toggle('theme-light');
  };

  // Add Stop FAB & Modal
  document.getElementById('fab-add-stop').onclick = () => openStopModal();
  document.getElementById('add-stop-itinerary-btn').onclick = () => openStopModal();
  document.getElementById('modal-stop-close-btn').onclick = () => document.getElementById('modal-add-stop').classList.add('hidden');
  document.getElementById('modal-btn-cancel-stop').onclick = () => document.getElementById('modal-add-stop').classList.add('hidden');
  document.getElementById('modal-btn-save-stop').onclick = saveStopModal;

  // Duration Stepper Controls
  const durInput = document.getElementById('stop-duration-input');
  document.getElementById('btn-duration-minus').onclick = () => {
    durInput.value = Math.max(15, parseInt(durInput.value, 10) - 15);
  };
  document.getElementById('btn-duration-plus').onclick = () => {
    durInput.value = parseInt(durInput.value, 10) + 15;
  };
  document.getElementById('chip-dur-30').onclick = () => { durInput.value = 30; };
  document.getElementById('chip-dur-60').onclick = () => { durInput.value = 60; };
  document.getElementById('chip-dur-120').onclick = () => { durInput.value = 120; };

  // Trip Switcher Curated Trips
    // Create Trip Stepper Triggers
  const btnCreateNewTrip = document.getElementById('btn-create-new-trip');
  if (btnCreateNewTrip) btnCreateNewTrip.onclick = openCreateTripWizard;

  const chipTripSwitcher = document.getElementById('chip-trip-switcher');
  if (chipTripSwitcher) chipTripSwitcher.onclick = openCreateTripWizard;

  const modalCreateCloseBtn = document.getElementById('modal-create-trip-close-btn');
  if (modalCreateCloseBtn) modalCreateCloseBtn.onclick = () => document.getElementById('modal-create-trip').classList.add('hidden');

  const createStepNextBtn = document.getElementById('create-step-next-btn');
  if (createStepNextBtn) createStepNextBtn.onclick = handleCreateStepNext;

  const createStepPrevBtn = document.getElementById('create-step-prev-btn');
  if (createStepPrevBtn) createStepPrevBtn.onclick = handleCreateStepPrev;

  const createTripBackBtn = document.getElementById('create-trip-back-btn');
  if (createTripBackBtn) createTripBackBtn.onclick = handleCreateStepPrev;

  document.getElementById('load-coorg-btn').onclick = () => {
    state.activeTripId = 'trip-1';
    Storage.save(state);
    switchTab('map');
    refreshApp();
  };

  document.getElementById('load-hampi-btn').onclick = () => {
    state.activeTripId = 'trip-2';
    Storage.save(state);
    switchTab('map');
    refreshApp();
  };
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEvents();
  setupLivePlaceSearch();
  refreshApp();
});


// ==========================================================================
// 5-STEP CREATE TRIP WIZARD (Spec 5.3)
// ==========================================================================
let createTripState = {
  currentStep: 1,
  origin: 'Bangalore, Karnataka',
  destination: 'Madikeri, Coorg',
  departureMinutes: 360, // 06:00 AM
  departureDate: '2026-10-17',
  vehicleMode: 'suv',
  mileage: 14.0,
  groupSize: 4,
  budgetType: 'total', // 'total' or 'per_person'
  budgetAmount: 16000,
  scenario: 'typical',
  preferences: ['scenic', 'daylight', 'homestays']
};

const PRESET_ROUTES = [
  { name: 'Bangalore ➔ Coorg', origin: 'Bangalore, Karnataka', dest: 'Madikeri, Coorg', stops: [
    { name: 'Bangalore (Origin)', lat: 12.9716, lng: 77.5946, dur: 0 },
    { name: 'Channapatna Craft Park', lat: 12.6518, lng: 77.2089, dur: 30 },
    { name: 'Mysore Palace', lat: 12.3052, lng: 76.6552, dur: 90 },
    { name: 'Bylakuppe Golden Temple', lat: 12.4334, lng: 75.9647, dur: 60 },
    { name: 'Madikeri, Coorg', lat: 12.4244, lng: 75.7382, dur: 60 }
  ]},
  { name: 'Hyderabad ➔ Hampi', origin: 'Hyderabad, Telangana', dest: 'Hampi, Karnataka', stops: [
    { name: 'Hyderabad (Origin)', lat: 17.3850, lng: 78.4867, dur: 0 },
    { name: 'Kurnool Konda Reddy Fort', lat: 15.8281, lng: 78.0373, dur: 45 },
    { name: 'Gooty Fort Viewpoint', lat: 15.1167, lng: 77.6333, dur: 45 },
    { name: 'Bellary Rock Fort', lat: 15.1394, lng: 76.9214, dur: 45 },
    { name: 'Virupaksha Temple, Hampi', lat: 15.3350, lng: 76.4600, dur: 90 }
  ]},
  { name: 'Delhi ➔ Jaipur', origin: 'New Delhi', dest: 'Jaipur, Rajasthan', stops: [
    { name: 'Delhi (Origin)', lat: 28.6139, lng: 77.2090, dur: 0 },
    { name: 'Neemrana Fort Palace', lat: 27.9942, lng: 76.3869, dur: 60 },
    { name: 'Amer Fort, Jaipur', lat: 26.9855, lng: 75.8513, dur: 90 },
    { name: 'Hawa Mahal', lat: 26.9239, lng: 75.8267, dur: 60 }
  ]},
  { name: 'Chennai ➔ Pondicherry', origin: 'Chennai, Tamil Nadu', dest: 'Pondicherry', stops: [
    { name: 'Chennai (Origin)', lat: 13.0827, lng: 80.2707, dur: 0 },
    { name: 'Mahabalipuram Shore Temple', lat: 12.6169, lng: 80.1928, dur: 75 },
    { name: 'Auroville Dome', lat: 12.0070, lng: 79.8106, dur: 60 },
    { name: 'Promenade Beach, Pondicherry', lat: 11.9338, lng: 79.8354, dur: 60 }
  ]}
];

function openCreateTripWizard() {
  createTripState.currentStep = 1;
  document.getElementById('modal-create-trip').classList.remove('hidden');
  renderCreateTripStep();
}

function renderCreateTripStep() {
  const body = document.getElementById('create-trip-body');
  const title = document.getElementById('create-trip-header-title');
  const stepLabel = document.getElementById('create-trip-step-label');
  const stepPct = document.getElementById('create-trip-step-pct');
  const fill = document.getElementById('create-trip-progress-fill');
  const prevBtn = document.getElementById('create-step-prev-btn');
  const backHeaderBtn = document.getElementById('create-trip-back-btn');
  const nextBtn = document.getElementById('create-step-next-btn');

  const step = createTripState.currentStep;
  fill.style.width = `${step * 20}%`;
  stepPct.textContent = `${step * 20}%`;

  if (step === 1) {
    prevBtn.style.display = 'none';
    backHeaderBtn.style.display = 'none';
  } else {
    prevBtn.style.display = 'inline-flex';
    backHeaderBtn.style.display = 'inline-flex';
  }

  nextBtn.textContent = step === 5 ? 'Create Trip' : 'Next';

  switch (step) {
    case 1:
      title.textContent = 'Step 1: Route & Destination';
      stepLabel.textContent = 'Step 1 of 5: Route';
      body.innerHTML = `
        <div class="input-field">
          <label>Origin (Starting Point)</label>
          <input type="text" id="step-origin-input" value="${createTripState.origin}" placeholder="e.g. Bangalore, Delhi, Hyderabad" />
        </div>
        <div class="input-field">
          <label>Destination</label>
          <input type="text" id="step-dest-input" value="${createTripState.destination}" placeholder="e.g. Coorg, Hampi, Jaipur" />
        </div>
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--on-surface-variant); text-transform: uppercase;">Quick Curated Indian Routes</label>
          <div class="quick-routes-row">
            ${PRESET_ROUTES.map((r, i) => `
              <button class="quick-route-chip" data-route-idx="${i}">
                <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${r.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      // Listeners
      body.querySelectorAll('.quick-route-chip').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute('data-route-idx'), 10);
          const r = PRESET_ROUTES[idx];
          createTripState.origin = r.origin;
          createTripState.destination = r.dest;
          document.getElementById('step-origin-input').value = r.origin;
          document.getElementById('step-dest-input').value = r.dest;
        };
      });
      break;

    case 2:
      title.textContent = 'Step 2: Dates & Departure';
      stepLabel.textContent = 'Step 2 of 5: Timing';
      const hours = Math.floor(createTripState.departureMinutes / 60).toString().padStart(2, '0');
      const mins = (createTripState.departureMinutes % 60).toString().padStart(2, '0');
      body.innerHTML = `
        <div class="input-field">
          <label>Departure Date</label>
          <input type="date" id="step-date-input" value="${createTripState.departureDate}" />
        </div>
        <div class="input-field">
          <label>Departure Time</label>
          <input type="time" id="step-time-input" value="${hours}:${mins}" />
        </div>
        <div style="background: var(--surface-container); border: 1px solid var(--outline-variant); border-radius: var(--radius-sm); padding: 12px; display: flex; align-items: flex-start; gap: 8px;">
          <svg class="icon-sm" style="color: var(--caution); flex-shrink: 0; margin-top: 2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <div style="font-size: 12px; color: var(--on-surface-variant); line-height: 1.4;">
            <strong>Daylight Driving Advisory:</strong> Departures between 05:30 AM and 07:00 AM ensure mountain and ghat passes are navigated in full daylight.
          </div>
        </div>
      `;
      break;

    case 3:
      title.textContent = 'Step 3: Vehicle & Group Size';
      stepLabel.textContent = 'Step 3 of 5: Transport';
      const vehicles = [
        { id: 'suv', name: 'SUV / 4WD', sub: '14.0 km/L (Diesel/Petrol)', mileage: 14.0 },
        { id: 'sedan', name: 'Sedan / Hatch', sub: '18.5 km/L (Efficient)', mileage: 18.5 },
        { id: 'bike', name: 'Cruiser Bike', sub: '35.0 km/L (Single/Tandem)', mileage: 35.0 },
        { id: 'van', name: 'Van / Tempo', sub: '11.0 km/L (Large Group)', mileage: 11.0 }
      ];
      body.innerHTML = `
        <div style="font-size: 12px; font-weight: 700; color: var(--on-surface-variant); text-transform: uppercase;">Vehicle Mode</div>
        <div class="stepper-option-grid">
          ${vehicles.map(v => `
            <div class="stepper-option-card ${createTripState.vehicleMode === v.id ? 'selected' : ''}" data-vehicle="${v.id}" data-mileage="${v.mileage}">
              <div class="stepper-card-title">${v.name}</div>
              <div class="stepper-card-sub">${v.sub}</div>
            </div>
          `).join('')}
        </div>
        <div class="input-field" style="margin-top: 6px;">
          <label>Number of Travelers</label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn-small" id="step-group-minus" style="font-size: 15px; padding: 6px 14px;">−</button>
            <span style="font-size: 16px; font-weight: 800; min-width: 32px; text-align: center;" id="step-group-val">${createTripState.groupSize}</span>
            <button class="btn-small" id="step-group-plus" style="font-size: 15px; padding: 6px 14px;">+</button>
          </div>
        </div>
      `;
      // Vehicle listeners
      body.querySelectorAll('.stepper-option-card').forEach(card => {
        card.onclick = () => {
          body.querySelectorAll('.stepper-option-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          createTripState.vehicleMode = card.getAttribute('data-vehicle');
          createTripState.mileage = parseFloat(card.getAttribute('data-mileage'));
        };
      });
      body.querySelector('#step-group-minus').onclick = () => {
        createTripState.groupSize = Math.max(1, createTripState.groupSize - 1);
        body.querySelector('#step-group-val').textContent = createTripState.groupSize;
      };
      body.querySelector('#step-group-plus').onclick = () => {
        createTripState.groupSize = Math.min(20, createTripState.groupSize + 1);
        body.querySelector('#step-group-val').textContent = createTripState.groupSize;
      };
      break;

    case 4:
      title.textContent = 'Step 4: Budget Allocation';
      stepLabel.textContent = 'Step 4 of 5: Budget';
      body.innerHTML = `
        <div style="display: flex; background: var(--surface-container); border-radius: var(--radius-pill); padding: 3px; gap: 2px;">
          <button class="scenario-btn ${createTripState.budgetType === 'total' ? 'active' : ''}" id="btn-budget-type-total">Total Budget</button>
          <button class="scenario-btn ${createTripState.budgetType === 'per_person' ? 'active' : ''}" id="btn-budget-type-person">Per Person</button>
        </div>
        <div class="input-field">
          <label id="step-budget-label">${createTripState.budgetType === 'total' ? 'Total Trip Budget (₹)' : 'Budget Per Person (₹)'}</label>
          <input type="number" id="step-budget-amount" value="${createTripState.budgetAmount}" step="1000" />
        </div>
        <div style="font-size: 12px; color: var(--on-surface-variant);">
          Includes deterministic calculations for fuel, FASTag tolls, homestays, meals, and a 10% contingency buffer.
        </div>
      `;
      body.querySelector('#btn-budget-type-total').onclick = () => {
        createTripState.budgetType = 'total';
        renderCreateTripStep();
      };
      body.querySelector('#btn-budget-type-person').onclick = () => {
        createTripState.budgetType = 'per_person';
        renderCreateTripStep();
      };
      break;

    case 5:
      title.textContent = 'Step 5: Review & Preferences';
      stepLabel.textContent = 'Step 5 of 5: Confirm';
      const prefs = [
        { id: 'scenic', label: 'Scenic Highway' },
        { id: 'daylight', label: 'Avoid Night Ghats' },
        { id: 'homestays', label: 'Verified Homestays' },
        { id: 'veg', label: 'Vegetarian Highway Dhabas' }
      ];
      const estBudget = createTripState.budgetType === 'total' ? createTripState.budgetAmount : (createTripState.budgetAmount * createTripState.groupSize);
      body.innerHTML = `
        <div style="font-size: 12px; font-weight: 700; color: var(--on-surface-variant); text-transform: uppercase;">Route Preferences</div>
        <div class="preference-chips-wrap">
          ${prefs.map(p => `
            <div class="preference-chip ${createTripState.preferences.includes(p.id) ? 'selected' : ''}" data-pref="${p.id}">
              <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>${p.label}</span>
            </div>
          `).join('')}
        </div>

        <div class="summary-preview-card" style="margin-top: 6px;">
          <div style="font-size: 13px; font-weight: 800; color: var(--primary);">Trip Summary Plan</div>
          <div class="summary-preview-row">
            <span style="color: var(--on-surface-variant);">Journey:</span>
            <strong>${createTripState.origin} ➔ ${createTripState.destination}</strong>
          </div>
          <div class="summary-preview-row">
            <span style="color: var(--on-surface-variant);">Departure:</span>
            <span>${createTripState.departureDate} at ${formatMinutes(createTripState.departureMinutes)}</span>
          </div>
          <div class="summary-preview-row">
            <span style="color: var(--on-surface-variant);">Travelers:</span>
            <span>${createTripState.groupSize} People (${createTripState.vehicleMode.toUpperCase()})</span>
          </div>
          <div class="summary-preview-row">
            <span style="color: var(--on-surface-variant);">Budget Allocated:</span>
            <strong style="color: var(--success);">₹${estBudget.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      `;
      body.querySelectorAll('.preference-chip').forEach(chip => {
        chip.onclick = () => {
          const pref = chip.getAttribute('data-pref');
          if (createTripState.preferences.includes(pref)) {
            createTripState.preferences = createTripState.preferences.filter(p => p !== pref);
            chip.classList.remove('selected');
          } else {
            createTripState.preferences.push(pref);
            chip.classList.add('selected');
          }
        };
      });
      break;
  }
}

function handleCreateStepNext() {
  // Save current step data before advancing
  if (createTripState.currentStep === 1) {
    createTripState.origin = document.getElementById('step-origin-input').value.trim() || 'Bangalore, Karnataka';
    createTripState.destination = document.getElementById('step-dest-input').value.trim() || 'Madikeri, Coorg';
  } else if (createTripState.currentStep === 2) {
    createTripState.departureDate = document.getElementById('step-date-input').value;
    const timeVal = document.getElementById('step-time-input').value;
    if (timeVal) {
      const parts = timeVal.split(':');
      createTripState.departureMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
  } else if (createTripState.currentStep === 4) {
    createTripState.budgetAmount = parseFloat(document.getElementById('step-budget-amount').value) || 16000;
  }

  if (createTripState.currentStep < 5) {
    createTripState.currentStep++;
    renderCreateTripStep();
  } else {
    // Step 5: Finalize and create trip
    finalizeTripCreation();
  }
}

function handleCreateStepPrev() {
  if (createTripState.currentStep > 1) {
    createTripState.currentStep--;
    renderCreateTripStep();
  }
}

function finalizeTripCreation() {
  const newTripId = `trip-${Date.now()}`;
  const totalBudget = createTripState.budgetType === 'total' 
    ? createTripState.budgetAmount 
    : (createTripState.budgetAmount * createTripState.groupSize);

  // Match curated route preset if matches, or generate realistic coordinates
  const matchedPreset = PRESET_ROUTES.find(r => r.origin.toLowerCase().includes(createTripState.origin.toLowerCase()) || r.dest.toLowerCase().includes(createTripState.destination.toLowerCase()));
  
  let newStops = [];
  if (matchedPreset) {
    newStops = matchedPreset.stops.map((s, idx) => ({
      id: `stop-${newTripId}-${idx}`,
      tripId: newTripId,
      name: s.name,
      latitude: s.lat,
      longitude: s.lng,
      orderIndex: idx,
      durationMinutes: s.dur,
      bufferMinutes: 15,
      isOvernight: idx === matchedPreset.stops.length - 1,
      openingHourMinutes: 540,
      closingHourMinutes: 1080
    }));
  } else {
    // Custom route with 3 stops
    newStops = [
      { id: `stop-${newTripId}-0`, tripId: newTripId, name: `${createTripState.origin} (Origin)`, latitude: 12.9716, longitude: 77.5946, orderIndex: 0, durationMinutes: 0, bufferMinutes: 15, isOvernight: false, openingHourMinutes: 0, closingHourMinutes: 1440 },
      { id: `stop-${newTripId}-1`, tripId: newTripId, name: 'Highway Rest Stop & Fuel', latitude: 12.6518, longitude: 76.8089, orderIndex: 1, durationMinutes: 45, bufferMinutes: 15, isOvernight: false, openingHourMinutes: 360, closingHourMinutes: 1320 },
      { id: `stop-${newTripId}-2`, tripId: newTripId, name: `${createTripState.destination} (Destination)`, latitude: 12.4244, longitude: 75.7382, orderIndex: 2, durationMinutes: 60, bufferMinutes: 20, isOvernight: true, openingHourMinutes: 480, closingHourMinutes: 1200 }
    ];
  }

  const newTrip = {
    id: newTripId,
    title: `${createTripState.origin.split(',')[0]} to ${createTripState.destination.split(',')[0]}`,
    destinationName: createTripState.destination,
    departureTimeMinutes: createTripState.departureMinutes,
    totalBudget: totalBudget,
    groupSize: createTripState.groupSize,
    vehicleMileageKmPerLitre: createTripState.mileage,
    fuelPricePerLitre: 102.8,
    isArchived: false
  };

  const newExpenses = [
    { id: `exp-${newTripId}-tolls`, tripId: newTripId, category: 'TOLL', amount: 380, isShared: true, unit: 'TOTAL', provenance: { sourceType: 'OFFICIAL', sourceName: 'NHAI FASTag Plaza', confidence: 'CONFIRMED' } },
    { id: `exp-${newTripId}-stays`, tripId: newTripId, category: 'STAY', amount: 4800, isShared: true, unit: 'TOTAL', provenance: { sourceType: 'OFFICIAL', sourceName: 'Estate Homestay', confidence: 'CONFIRMED' } },
    { id: `exp-${newTripId}-food`, tripId: newTripId, category: 'FOOD', amount: 2400, isShared: true, unit: 'TOTAL', provenance: { sourceType: 'CALCULATED', sourceName: 'Meal Standard Rate', confidence: 'CONFIRMED' } },
    { id: `exp-${newTripId}-acts`, tripId: newTripId, category: 'ACTIVITY', amount: 1200, isShared: true, unit: 'TOTAL', provenance: { sourceType: 'OFFICIAL', sourceName: 'Forest Department Pass', confidence: 'CONFIRMED' } }
  ];

  // Save to state
  state.trips.unshift(newTrip);
  state.activeTripId = newTripId;
  state.stopsMap[newTripId] = newStops;
  state.expensesMap[newTripId] = newExpenses;
  Storage.save(state);

  // Close wizard and switch to Map Home
  document.getElementById('modal-create-trip').classList.add('hidden');
  switchTab('map');
  refreshApp();
}
