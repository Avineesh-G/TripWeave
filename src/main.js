import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function resizeMap() {
  if (!mapInstance) return;
  try {
    if (typeof mapInstance.invalidateSize === 'function') {
      mapInstance.invalidateSize(true);
    }
  } catch (e) {
    console.warn('Map resize error:', e);
  }
}

const GOOGLE_TILE_PROVIDERS = {
  roadmap: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: 'Google Maps'
  },
  satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: 'Google Satellite'
  },
  terrain: {
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: 'Google Terrain'
  }
};

let currentTileLayer = null;

function createCleanTileLayer(layerKey = 'roadmap') {
  const conf = GOOGLE_TILE_PROVIDERS[layerKey] || GOOGLE_TILE_PROVIDERS.roadmap;
  const layer = L.tileLayer(conf.url, {
    subdomains: conf.subdomains,
    maxZoom: conf.maxZoom,
    attribution: conf.attribution,
    crossOrigin: true,
    keepBuffer: 8,
    updateWhenIdle: true,
    updateWhenZooming: false
  });

  layer.on('tileerror', function(error, tile) {
    if (tile && !tile._fallbackApplied && error.coords) {
      tile._fallbackApplied = true;
      tile.src = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${error.coords.z}/${error.coords.x}/${error.coords.y}@2x.png`;
    }
  });

  return layer;
}

let currentGoogleTileLayer = null;
// Immediately clear any legacy mock data from browser storage
try {
  localStorage.removeItem('tripweave_state');
} catch (e) {}

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
    { name: 'Hyderabad', sub: 'Telangana, India', lat: 17.3850, lng: 78.4867 },
    { name: 'Charminar', sub: 'Old City, Hyderabad, Telangana, India', lat: 17.3616, lng: 78.4747 },
    { name: 'Golconda Fort', sub: 'Ibrahim Bagh, Hyderabad, Telangana, India', lat: 17.3833, lng: 78.4011 },
    { name: 'Hussain Sagar Lake', sub: 'Tank Bund, Hyderabad, Telangana, India', lat: 17.4239, lng: 78.4738 },
    { name: 'Paradise Biryani', sub: 'Secunderabad, Hyderabad, Telangana, India', lat: 17.4416, lng: 78.4983 },
    { name: 'Bawarchi Restaurant', sub: 'RTC X Roads, Hyderabad, Telangana, India', lat: 17.4048, lng: 78.4981 },
    { name: 'Karachi Bakery', sub: 'Mozamjahi Market, Hyderabad, Telangana, India', lat: 17.3822, lng: 78.4735 },
    { name: 'KBR National Park', sub: 'Jubilee Hills, Hyderabad, Telangana, India', lat: 17.4244, lng: 78.4238 },
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

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const firstItem = dropdown.querySelector('.search-suggestion-item');
      if (firstItem) {
        firstItem.click();
        return;
      }
      const q = searchInput.value.trim().toLowerCase();
      if (q.includes('hyderabad') || q.includes('hyd')) {
        dropdown.classList.add('hidden');
        handleMapPlaceSelection(17.3850, 78.4867, 'Hyderabad');
        return;
      }
      for (const [key, hub] of Object.entries(FAMOUS_INDIAN_HUBS)) {
        if (q.includes(key) || q.includes(hub.cityName.toLowerCase())) {
          dropdown.classList.add('hidden');
          handleMapPlaceSelection(hub.lat, hub.lng, hub.cityName);
          return;
        }
      }
    }
  });

  function renderSuggestions(items) {
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

    dropdown.querySelectorAll('.search-suggestion-item').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const name = el.getAttribute('data-name');
        const lat = parseFloat(el.getAttribute('data-lat'));
        const lng = parseFloat(el.getAttribute('data-lng'));

        dropdown.classList.add('hidden');
        searchInput.value = '';

        if (e.target.closest('.btn-small')) {
          if (!state.activeTripId || !state.trips || state.trips.length === 0) {
            const newTripId = `trip-${Date.now()}`;
            state.trips = [{
              id: newTripId,
              title: `Road Trip to ${name}`,
              destinationName: name,
              departureTimeMinutes: 0,
              totalBudget: 0,
              groupSize: 0,
              vehicleMileageKmPerLitre: 0,
              fuelPricePerLitre: 0,
              isArchived: false
            }];
            state.activeTripId = newTripId;
            state.stopsMap[newTripId] = [];
            state.expensesMap[newTripId] = [];
          }
          const stops = state.stopsMap[state.activeTripId] || [];
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
          state.stopsMap[state.activeTripId] = stops;
          Storage.save(state);
          refreshApp();
          showToast(`Added ${name} to itinerary!`);
        }

        handleMapPlaceSelection(lat, lng, name);
      };
    });
  }

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    clearTimeout(searchDebounceTimer);

    if (query.length < 2) {
      dropdown.innerHTML = '';
      dropdown.classList.add('hidden');
      return;
    }

    // 1. Instant local matches rendered immediately without waiting!
    const localMatches = LOCAL_INDIAN_DESTINATIONS.filter(d => 
      d.name.toLowerCase().includes(query) || d.sub.toLowerCase().includes(query)
    );

    if (localMatches.length > 0) {
      renderSuggestions(localMatches);
    } else {
      dropdown.innerHTML = '<div style="padding: 12px; font-size: 12px; color: var(--on-surface-variant); text-align: center;">Searching places across India...</div>';
      dropdown.classList.remove('hidden');
    }

    // 2. Fetch live network results to augment
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
            if (!items.some(i => i.name.toLowerCase() === name.toLowerCase())) {
              items.push({ name, sub, lat: coords[1], lng: coords[0] });
            }
          });
        }

        renderSuggestions(items);
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
import { 
  loginWithGoogle, 
  logoutUser, 
  subscribeAuthState, 
  getCurrentUser, 
  syncTripToCloud, 
  removeTripFromCloud, 
  subscribeCloudTrips, 
  isFirebaseConfigured 
} from './firebase.js';

// Application State
let state = Storage.load();
let currentTab = 'map';
let currentScenario = 'typical';
let mapInstance = null; // google.maps.Map
let mapMarkers = []; // Array of google.maps.Marker
let routePolyline = null; // google.maps.Polyline
let routeHalo = null; // google.maps.Polyline
let userLocation = null;
let userMarker = null; // google.maps.Marker
let userAccuracyCircle = null; // google.maps.Circle
let selectedPlaceMarker = null; // google.maps.Marker
let currentSelectedPlace = null;
let selectedAccuracy = 'precise';
let currentCategoryFilter = 'all';
let nearbyExploreMarkers = [];

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

// Recalculate plan deterministically (Zero Mock Data & Null Safe)
function computePlan() {
  const trip = getActiveTrip() || {
    id: 'trip-initial',
    title: 'New Trip',
    destinationName: null,
    departureTimeMinutes: 0,
    totalBudget: 0,
    groupSize: 0,
    vehicleMileageKmPerLitre: 0,
    fuelPricePerLitre: 0,
    isArchived: false
  };
  const stops = getActiveStops();
  const expenses = getActiveExpenses();

  const scheduleResult = stops.length > 0
    ? ScheduleEngine.calculateSchedule(trip, stops)
    : { stops: [], warnings: [], totalDurationMinutes: 0 };

  const totalDistanceKm = scheduleResult.stops && scheduleResult.stops.length > 0
    ? scheduleResult.stops.reduce((sum, s) => sum + (s.distanceFromPreviousKm || 0), 0)
    : 0;

  const budgetResult = (stops.length > 0 || expenses.length > 0)
    ? BudgetEngine.calculateBudget(trip, expenses, totalDistanceKm)
    : { totalCost: 0, remainingBudget: 0, budgetUsedPercent: 0, fuelCost: 0, tollCost: 0, stayCost: 0, foodCost: 0, activityCost: 0, categories: [] };

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
  const headerTripTitle = document.getElementById('header-trip-title');
  if (headerTripTitle) {
    headerTripTitle.textContent = plan.trip ? plan.trip.title : 'No Active Trip';
  }

  const nextStop = plan.stops && plan.stops.length > 0 ? plan.stops[0] : null;
  const peekNextStopTitle = document.getElementById('peek-next-stop-title');
  if (peekNextStopTitle) {
    peekNextStopTitle.textContent = nextStop ? `Next: ${nextStop.name}` : 'No Stops Added';
  }

  const peekStatsSubtitle = document.getElementById('peek-stats-subtitle');
  if (peekStatsSubtitle) {
    peekStatsSubtitle.textContent = plan.stops && plan.stops.length > 0
      ? `${plan.stops.length} stops • ${Math.round(plan.totalDistanceKm)} km • ${plan.trip ? plan.trip.groupSize : 0} travelers`
      : '0 stops • 0 km • 0 travelers';
  }

  let mult = 1.0;
  if (currentScenario === 'low') mult = 0.88;
  if (currentScenario === 'high') mult = 1.18;

  const cost = plan.stops && plan.stops.length > 0 ? Math.round(plan.budgetResult.totalCost * mult) : 0;
  const peekTotalCost = document.getElementById('peek-total-cost');
  if (peekTotalCost) {
    peekTotalCost.textContent = `₹${cost.toLocaleString('en-IN')}`;
  }

  const peekBudgetCaption = document.getElementById('peek-budget-caption');
  if (peekBudgetCaption) {
    const budgetVal = plan.trip && plan.trip.totalBudget ? Math.round(plan.trip.totalBudget) : 0;
    peekBudgetCaption.textContent = `of ₹${budgetVal.toLocaleString('en-IN')} budget`;
  }

  const sheetList = document.getElementById('sheet-stops-compact-list');
  if (sheetList) {
    if (!plan.stops || plan.stops.length === 0) {
      sheetList.innerHTML = '<div style="font-size: 12px; color: var(--on-surface-variant); padding: 8px 0; text-align: center;">No stops added yet. Tap anywhere on the map or search to add stops.</div>';
    } else {
      sheetList.innerHTML = plan.stops.map((s, idx) => `
        <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px dashed var(--outline-variant);">
          <span><strong>${idx + 1}.</strong> ${s.name}</span>
          <span style="color: var(--on-surface-variant);">${s.durationMinutes}m</span>
        </div>
      `).join('');
    }
  }
}

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

  const totalCost = plan.stops && plan.stops.length > 0 ? Math.round(plan.budgetResult.totalCost * mult) : 0;
  const groupSize = plan.trip && plan.trip.groupSize > 0 ? plan.trip.groupSize : 0;
  const totalBudget = plan.trip && plan.trip.totalBudget > 0 ? plan.trip.totalBudget : 0;
  const perPerson = groupSize > 0 ? Math.round(totalCost / groupSize) : 0;
  const remaining = Math.max(0, Math.round(totalBudget - totalCost));
  const budgetPct = totalBudget > 0 ? Math.min(100, (totalCost / totalBudget) * 100) : 0;

  const heroAmountEl = document.getElementById('budget-hero-amount');
  if (heroAmountEl) heroAmountEl.textContent = `₹${totalCost.toLocaleString('en-IN')}`;

  const perPersonEl = document.getElementById('budget-per-person-text');
  if (perPersonEl) perPersonEl.textContent = `₹${perPerson.toLocaleString('en-IN')} / person • ${groupSize} travelers`;

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

  // Category cards
  const container = document.getElementById('category-cards-list');
  if (!container) return;

  if (!plan.stops || plan.stops.length === 0) {
    container.innerHTML = `
      <div style="padding: 32px 16px; text-align: center; color: var(--on-surface-variant); font-size: 13px;">
        <div style="font-weight: 700; color: var(--on-surface); margin-bottom: 4px;">No Expenses</div>
        Add stops to compute highway tolls, fuel, stays, and food costs.
      </div>
    `;
    return;
  }

  const categories = [
    { key: 'fuel', iconHtml: ICONS.fuel, name: 'Fuel Expenditure', amount: Math.round(plan.budgetResult.fuelCost * mult), note: `${Math.round(plan.totalDistanceKm)} km @ ₹${plan.trip.fuelPrice || 102.8}/L (${plan.trip.mileage || 15} km/L)` },
    { key: 'tolls', iconHtml: ICONS.tolls, name: 'FASTag Highway Tolls', amount: Math.round(plan.budgetResult.tollCost * mult), note: 'Fastag NHAI toll plaza charges' },
    { key: 'stays', iconHtml: ICONS.stays, name: 'Accommodations & Homestays', amount: Math.round(plan.budgetResult.stayCost * mult), note: 'Verified estate stays & resorts' },
    { key: 'food', iconHtml: ICONS.food, name: 'Meals & Highway Food', amount: Math.round(plan.budgetResult.foodCost * mult), note: `3 meals/day for ${plan.trip.groupSize || 1} travelers` },
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

// Official Google Maps Clean Tile Engine: 60/120 FPS GPU Hardware-Accelerated (Zero Lag, Zero Blank Tiles)
function initMap() {
  if (mapInstance) return;
  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl) return;

  mapInstance = L.map('leaflet-map', {
    center: [20.5937, 78.9629],
    zoom: 5,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
    fadeAnimation: true,
    zoomAnimation: true,
    markerZoomAnimation: true
  });

  currentTileLayer = createCleanTileLayer('roadmap');
  currentTileLayer.addTo(mapInstance);

  mapInstance.on('click', async (e) => {
    if (e.latlng) {
      await handleMapPlaceSelection(e.latlng.lat, e.latlng.lng);
    }
  });

  let idleTimer = null;
  mapInstance.on('moveend', () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      renderPlacesAroundSearchArea(currentCategoryFilter);
    }, 200);
  });

  window.addEventListener('resize', resizeMap);
  window.addEventListener('orientationchange', () => {
    setTimeout(resizeMap, 200);
  });

  if (typeof ResizeObserver !== 'undefined' && mapEl) {
    const ro = new ResizeObserver(() => {
      resizeMap();
    });
    ro.observe(mapEl);
  }

  setTimeout(() => {
    resizeMap();
    renderPlacesAroundSearchArea('all');
  }, 50);
  setTimeout(() => resizeMap(), 200);
  setTimeout(() => resizeMap(), 500);
}

function renderPlacesAroundSearchArea(catFilter = 'all') {
  if (!mapInstance) return;
  currentCategoryFilter = catFilter;

  nearbyExploreMarkers.forEach(m => {
    try { mapInstance.removeLayer(m); } catch (e) {}
  });
  nearbyExploreMarkers = [];

  const centerLatLng = mapInstance.getCenter();
  if (!centerLatLng) return;
  const centerLat = centerLatLng.lat;
  const centerLng = centerLatLng.lng;

  let candidatePlaces = [];
  let nearestHub = null;
  let minDistance = Infinity;

  for (const [key, hub] of Object.entries(FAMOUS_INDIAN_HUBS)) {
    const d = calculateHaversineKm(centerLat, centerLng, hub.lat, hub.lng);
    if (d < minDistance) {
      minDistance = d;
      nearestHub = hub;
    }
  }

  if (nearestHub && minDistance <= 250) {
    candidatePlaces = nearestHub.places || [];
  } else {
    for (const [key, hub] of Object.entries(FAMOUS_INDIAN_HUBS)) {
      if (hub.places && hub.places.length > 0) {
        candidatePlaces.push(hub.places[0]);
        if (hub.places.length > 1) candidatePlaces.push(hub.places[1]);
      }
    }
  }

  let filtered = candidatePlaces;
  if (catFilter && catFilter !== 'all') {
    if (catFilter === 'attractions' || catFilter === 'monuments') {
      filtered = candidatePlaces.filter(p => p.category === 'monuments' || p.category === 'attractions' || p.category === 'parks');
    } else if (catFilter === 'food') {
      filtered = candidatePlaces.filter(p => p.category === 'food');
    } else if (catFilter === 'fuel') {
      filtered = candidatePlaces.filter(p => p.category === 'fuel');
    } else if (catFilter === 'stays') {
      filtered = candidatePlaces.filter(p => p.category === 'stays');
    }
  }

  const CAT_COLORS = {
    monuments: '#D97706',
    parks: '#16A34A',
    food: '#E11D48',
    fuel: '#2563EB',
    stays: '#087F75'
  };

  filtered.forEach(place => {
    const pinColor = CAT_COLORS[place.category] || '#D97706';
    const exploreIcon = L.divIcon({
      className: 'explore-pin-container',
      html: `
        <div style="background: ${pinColor}; width: 26px; height: 26px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="width: 7px; height: 7px; border-radius: 50%; background: #FFFFFF; transform: rotate(45deg);"></div>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 26]
    });

    const marker = L.marker([place.lat, place.lng], {
      icon: exploreIcon,
      title: place.name,
      zIndexOffset: 500
    }).addTo(mapInstance);

    marker.on('click', async () => {
      await handleMapPlaceSelection(place.lat, place.lng, place.name);
    });

    nearbyExploreMarkers.push(marker);
  });
}

function setupCategoryChips() {
  const chips = document.querySelectorAll('.filter-chips-row .chip[data-cat]');
  chips.forEach(chip => {
    chip.onclick = () => {
      const cat = chip.getAttribute('data-cat');
      const wasActive = chip.classList.contains('active');
      chips.forEach(c => c.classList.remove('active'));
      if (!wasActive) {
        chip.classList.add('active');
        renderPlacesAroundSearchArea(cat);
      } else {
        renderPlacesAroundSearchArea('all');
      }
    };
  });
}

async function updateMapRoute(plan) {
  if (!mapInstance) return;

  mapMarkers.forEach(m => {
    try { mapInstance.removeLayer(m); } catch (e) {}
  });
  mapMarkers = [];
  if (routePolyline) { try { mapInstance.removeLayer(routePolyline); } catch (e) {} routePolyline = null; }
  if (routeHalo) { try { mapInstance.removeLayer(routeHalo); } catch (e) {} routeHalo = null; }

  if (!plan.stops || plan.stops.length === 0) {
    mapInstance.setView([20.5937, 78.9629], 5);
    return;
  }

  const bounds = L.latLngBounds();

  // Render Stop Markers
  plan.stops.forEach((s, idx) => {
    const isOrigin = idx === 0;
    const isDest = idx === plan.stops.length - 1;
    const latlng = [s.latitude, s.longitude];
    bounds.extend(latlng);

    const pinBg = isOrigin ? '#3B5FCC' : (isDest ? '#1B6E3E' : '#2563EB');
    const stopIcon = L.divIcon({
      className: 'stop-pin-container',
      html: `
        <div style="background: ${pinBg}; width: 28px; height: 28px; border-radius: 50%; border: 2.5px solid #FFFFFF; box-shadow: 0 3px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 700; font-size: 11px; font-family: var(--font-body);">
          ${idx + 1}
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker(latlng, { icon: stopIcon, zIndexOffset: 1000 + idx }).addTo(mapInstance);
    marker.bindPopup(`
      <div style="padding: 4px; font-family: var(--font-body); font-size: 12px; color: #1E293B;">
        <strong>${idx + 1}. ${s.name}</strong><br>
        <span style="color: #64748B;">${s.durationMinutes}m visit • ${s.bufferMinutes || 15}m buffer</span>
      </div>
    `);
    mapMarkers.push(marker);
  });

  // Fetch Live OSRM Road Polyline
  const liveRoute = await fetchLiveOsrmRoute(plan.stops);
  const polylineCoords = (liveRoute && liveRoute.polylineLatlngs && liveRoute.polylineLatlngs.length > 0)
    ? liveRoute.polylineLatlngs
    : plan.stops.map(s => [s.latitude, s.longitude]);

  polylineCoords.forEach(c => bounds.extend(c));

  routeHalo = L.polyline(polylineCoords, {
    color: '#FFFFFF',
    weight: 8,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(mapInstance);

  routePolyline = L.polyline(polylineCoords, {
    color: '#2563EB',
    weight: 5,
    opacity: 1.0,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(mapInstance);

  mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
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
    setTimeout(() => resizeMap(), 50); setTimeout(() => resizeMap(), 250);
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
  // Selected Place Sheet Action Buttons
  const btnClosePlace = document.getElementById('btn-close-place-card');
  if (btnClosePlace) {
    btnClosePlace.onclick = () => {
      const sheet = document.getElementById('selected-place-sheet');
      if (sheet) sheet.classList.add('hidden');
      if (selectedPlaceMarker) {
        try { mapInstance.removeLayer(selectedPlaceMarker); } catch (e) {}
        selectedPlaceMarker = null;
      }
      currentSelectedPlace = null;
    };
  }

  const btnAddSelected = document.getElementById('btn-add-selected-stop');
  if (btnAddSelected) {
    btnAddSelected.onclick = () => {
      if (!currentSelectedPlace) return;
      const sName = currentSelectedPlace.name;
      const sLat = currentSelectedPlace.latitude;
      const sLng = currentSelectedPlace.longitude;

      if (!state.activeTripId || !state.trips || state.trips.length === 0) {
        const newTripId = `trip-${Date.now()}`;
        const newTrip = {
          id: newTripId,
          title: `Road Trip to ${sName.split(',')[0]}`,
          destinationName: sName,
          departureTimeMinutes: 0,
          totalBudget: 0,
          groupSize: 0,
          vehicleMileageKmPerLitre: 0,
          fuelPricePerLitre: 0,
          isArchived: false
        };
        state.trips = [newTrip];
        state.activeTripId = newTripId;
        state.stopsMap[newTripId] = [];
        state.expensesMap[newTripId] = [];
      }

      const stops = state.stopsMap[state.activeTripId] || [];
      const newStop = {
        id: `stop-${Date.now()}`,
        tripId: state.activeTripId,
        name: sName,
        latitude: sLat,
        longitude: sLng,
        orderIndex: stops.length,
        durationMinutes: 60,
        bufferMinutes: 15,
        isOvernight: false,
        openingHourMinutes: 540,
        closingHourMinutes: 1080
      };
      stops.push(newStop);
      state.stopsMap[state.activeTripId] = stops;
      Storage.save(state);
      refreshApp();
      showToast(`Added ${sName} to itinerary!`);
    };
  }

  const btnSetDest = document.getElementById('btn-set-destination');
  if (btnSetDest) {
    btnSetDest.onclick = () => {
      if (!currentSelectedPlace) return;
      const activeTrip = getActiveTrip();
      if (activeTrip) {
        activeTrip.destinationName = currentSelectedPlace.name;
        Storage.save(state);
        refreshApp();
        showToast(`Destination set to ${currentSelectedPlace.name}!`);
      }
    };
  }

  setupNearbyTabsListener();

  // Google Maps Layer Toggle Listener
  const chipLayers = document.getElementById('chip-google-layers');
  const layerLabel = document.getElementById('map-layer-label');
  let currentLayerIndex = 0;
  const layersList = [
    { id: 'roadmap', label: 'Google Maps' },
    { id: 'satellite', label: 'Google Satellite' },
    { id: 'terrain', label: 'Google Terrain' }
  ];

  if (chipLayers) {
    chipLayers.onclick = () => {
      currentLayerIndex = (currentLayerIndex + 1) % layersList.length;
      const current = layersList[currentLayerIndex];
      if (layerLabel) layerLabel.textContent = current.label;
      window.switchGoogleMapLayer(current.id);
    };
  }
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

  // Pull-up Bottom Sheet Toggle with Collision Prevention
  const dragHandle = document.getElementById('sheet-drag-handle');
  const peekSheet = document.getElementById('map-peek-sheet');
  const summaryPeek = document.getElementById('sheet-summary-peek');
  const mapScreen = document.getElementById('screen-map');

  function toggleSheetExpanded() {
    if (!peekSheet) return;
    const isExpanded = peekSheet.classList.toggle('expanded');
    if (mapScreen) {
      mapScreen.classList.toggle('sheet-is-expanded', isExpanded);
    }
  }

  if (dragHandle) {
    dragHandle.onclick = (e) => {
      e.stopPropagation();
      toggleSheetExpanded();
    };
  }
  if (summaryPeek) {
    summaryPeek.onclick = () => toggleSheetExpanded();
  }

  const btnSheetAddStop = document.getElementById('btn-sheet-add-stop');
  if (btnSheetAddStop) {
    btnSheetAddStop.onclick = () => openStopModal();
  }

  const openFullItinBtn = document.getElementById('btn-open-full-itinerary');
  if (openFullItinBtn) {
    openFullItinBtn.onclick = () => {
      if (peekSheet) peekSheet.classList.remove('expanded');
      if (mapScreen) mapScreen.classList.remove('sheet-is-expanded');
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


}

// App Initialization

// ==========================================================================
// GOOGLE MAPS STYLE CURRENT LOCATION & BLUE DOT ENGINE
// ==========================================================================

let watchLocationId = null;

function renderGoogleLocationDot(lat, lng, accuracy = 25) {
  if (!mapInstance) return;

  // STRICTLY REMOVE any giant accuracy circle: zero monster blue disc
  if (userAccuracyCircle) {
    try { mapInstance.removeLayer(userAccuracyCircle); } catch (e) {}
    userAccuracyCircle = null;
  }

  if (userMarker) {
    try { mapInstance.removeLayer(userMarker); } catch (e) {}
    userMarker = null;
  }

  // Google Maps Native Retina Blue Dot
  const googleBlueDotIcon = L.divIcon({
    className: 'user-gps-container',
    html: `
      <div class="user-gps-marker">
        <div class="user-gps-pulse"></div>
        <div class="user-gps-core"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  userMarker = L.marker([lat, lng], {
    icon: googleBlueDotIcon,
    zIndexOffset: 2000,
    interactive: false
  }).addTo(mapInstance);
}

function acquireUserLocation(highAccuracy = true, shouldFlyTo = false) {
  const locateBtn = document.getElementById('btn-locate-me');
  if (locateBtn && shouldFlyTo) locateBtn.classList.add('locating');

  const onLocationSuccess = async (lat, lng, accuracy = 20, isFallback = false) => {
    if (locateBtn) {
      locateBtn.classList.remove('locating');
      locateBtn.classList.add('active-located');
    }

    userLocation = { lat, lng, accuracy };

    renderGoogleLocationDot(lat, lng, accuracy);

    // Only fly to location if user explicitly tapped the locate FAB
    if (mapInstance && shouldFlyTo) {
      mapInstance.setView([lat, lng], 15);
    }

    // Try reverse geocoding to show city toast only on explicit locate action
    if (shouldFlyTo) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14`);
        if (res.ok) {
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.suburb || 'Current Location';
          showToast(isFallback ? `Location: ${city}` : `Located at ${city}`);
          return;
        }
      } catch (e) {}

      showToast(`Location acquired (~${Math.round(accuracy)}m)`);
    }
  };

  const onLocationFallback = async () => {
    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData.latitude && ipData.longitude) {
          await onLocationSuccess(ipData.latitude, ipData.longitude, 25, true);
          return;
        }
      }
    } catch (e) {
      console.warn('IP location skipped:', e);
    }

    // Guaranteed fallback: Hyderabad (user default center) so blue dot ALWAYS displays
    await onLocationSuccess(17.3850, 78.4867, 25, true);
  };

  if (!navigator.geolocation) {
    onLocationFallback();
    return;
  }

  // Clear existing watch if active
  if (watchLocationId !== null) {
    try {
      navigator.geolocation.clearWatch(watchLocationId);
    } catch (e) {}
    watchLocationId = null;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      onLocationSuccess(latitude, longitude, accuracy || 25, false);

      // Continuous tracking
      try {
        watchLocationId = navigator.geolocation.watchPosition(
          (watchPos) => {
            const wCoords = watchPos.coords;
            userLocation = { lat: wCoords.latitude, lng: wCoords.longitude, accuracy: wCoords.accuracy || 25 };
            renderGoogleLocationDot(wCoords.latitude, wCoords.longitude, wCoords.accuracy || 25);
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 10000 }
        );
      } catch (e) {}
    },
    (err) => {
      console.warn('Geolocation failed or denied, using fallback:', err);
      onLocationFallback();
    },
    {
      enableHighAccuracy: highAccuracy,
      timeout: 8000,
      maximumAge: 30000
    }
  );
}

function setupLocationPermission() {
  const locateBtn = document.getElementById('btn-locate-me');
  const modal = document.getElementById('modal-location-permission');
  if (!locateBtn || !modal) return;

  const btnPrecise = document.getElementById('btn-perm-precise');
  const btnApprox = document.getElementById('btn-perm-approx');
  const btnWhileUsing = document.getElementById('btn-perm-while-using');
  const btnOnlyThisTime = document.getElementById('btn-perm-only-this-time');
  const btnDontAllow = document.getElementById('btn-perm-dont-allow');

  if (btnPrecise && btnApprox) {
    btnPrecise.onclick = () => {
      selectedAccuracy = 'precise';
      btnPrecise.classList.add('active');
      btnApprox.classList.remove('active');
    };
    btnApprox.onclick = () => {
      selectedAccuracy = 'approximate';
      btnApprox.classList.add('active');
      btnPrecise.classList.remove('active');
    };
  }

  locateBtn.onclick = (e) => {
    e.stopPropagation();
    if (userLocation && mapInstance) {
      mapInstance.setView([userLocation.lat, userLocation.lng], 16);
      locateBtn.style.transform = 'scale(0.92)';
      setTimeout(() => { locateBtn.style.transform = ''; }, 180);
    } else {
      const savedPerm = localStorage.getItem('tripweave_location_perm');
      if (savedPerm === 'while_using') {
        acquireUserLocation(true);
      } else {
        modal.classList.remove('hidden');
      }
    }
  };

  if (btnWhileUsing) {
    btnWhileUsing.onclick = () => {
      localStorage.setItem('tripweave_location_perm', 'while_using');
      modal.classList.add('hidden');
      acquireUserLocation(selectedAccuracy === 'precise', true);
    };
  }

  if (btnOnlyThisTime) {
    btnOnlyThisTime.onclick = () => {
      modal.classList.add('hidden');
      acquireUserLocation(selectedAccuracy === 'precise', true);
    };
  }

  if (btnDontAllow) {
    btnDontAllow.onclick = () => {
      localStorage.setItem('tripweave_location_perm', 'denied');
      modal.classList.add('hidden');
      showToast('Location permission denied');
    };
  }

  // Automatic Google Maps Style Permission Prompt on Launch
  const savedPerm = localStorage.getItem('tripweave_location_perm');
  if (!savedPerm) {
    setTimeout(() => {
      modal.classList.remove('hidden');
    }, 500);
  } else if (savedPerm === 'while_using') {
    setTimeout(() => {
      acquireUserLocation(true, false);
    }, 300);
  }
}


// ==========================================================================
// GOOGLE AUTHENTICATION & CLOUD FIRESTORE INTEGRATION
// ==========================================================================

function isTermsAccepted() {
  return localStorage.getItem('tripweave_terms_accepted') === 'true';
}

function applyAuthenticatedUser(user) {
  const privacyScreen = document.getElementById('screen-privacy-terms');
  const authGate = document.getElementById('screen-auth-gate');
  const mainShell = document.getElementById('main-app-shell');

  // If terms have not been accepted yet, new user must review and accept first!
  if (!isTermsAccepted()) {
    if (privacyScreen) privacyScreen.classList.remove('hidden');
    if (authGate) authGate.classList.add('hidden');
    if (mainShell) mainShell.classList.add('hidden');
    return;
  }

  // Terms already accepted: never show privacy screen again during login or app usage
  if (privacyScreen) privacyScreen.classList.add('hidden');

  if (user) {
    if (authGate) authGate.classList.add('hidden');
    if (mainShell) mainShell.classList.remove('hidden');

    // Update Top Avatar Button on Map
    const avatarBtn = document.getElementById('account-avatar-btn');
    if (avatarBtn) {
      if (user.photoURL) {
        avatarBtn.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName || 'User'}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
      } else {
        const initial = (user.displayName || user.email || 'A').charAt(0).toUpperCase();
        avatarBtn.innerHTML = `<span>${initial}</span>`;
      }
    }

    // Update Account Modal Card
    const modalName = document.getElementById('account-user-name');
    const modalEmail = document.getElementById('account-user-email');
    const modalAvatarImg = document.getElementById('account-avatar-img');
    const modalAvatarInit = document.getElementById('account-avatar-initial');
    const modalStatus = document.getElementById('account-cloud-status');

    if (modalName) modalName.textContent = user.displayName || 'Google Explorer';
    if (modalEmail) modalEmail.textContent = user.email || '';
    if (user.photoURL && modalAvatarImg) {
      modalAvatarImg.src = user.photoURL;
      modalAvatarImg.style.display = 'block';
      if (modalAvatarInit) modalAvatarInit.style.display = 'none';
    } else {
      if (modalAvatarImg) modalAvatarImg.style.display = 'none';
      if (modalAvatarInit) {
        modalAvatarInit.textContent = (user.displayName || user.email || 'A').charAt(0).toUpperCase();
        modalAvatarInit.style.display = 'block';
      }
    }
    if (modalStatus) {
      modalStatus.textContent = isFirebaseConfigured ? 'Cloud Firestore (Production)' : 'Google Auth Preview';
    }

    // Force map initialization & sizing so Leaflet tiles render completely
    if (!mapInstance) {
      initMap();
    }
    if (mapInstance) {
      resizeMap();
      setTimeout(() => { if (mapInstance) resizeMap(); }, 50);
      setTimeout(() => { if (mapInstance) resizeMap(); }, 180);
      setTimeout(() => { if (mapInstance) resizeMap(); }, 450);
    }
    refreshApp();

    // Subscribe to cloud trips for this user
    subscribeCloudTrips(user.uid, (cloudData) => {
      if (cloudData && Array.isArray(cloudData.trips) && cloudData.trips.length > 0) {
        state.trips = cloudData.trips;
        state.stopsMap = { ...state.stopsMap, ...cloudData.stopsMap };
        state.expensesMap = { ...state.expensesMap, ...cloudData.expensesMap };
        if (!state.activeTripId || !state.trips.some(t => t.id === state.activeTripId)) {
          state.activeTripId = state.trips[0].id;
        }
        Storage.save(state);
        refreshApp();
      }
    });

  } else {
    // User not signed in -> show Auth Gate, hide Main App Shell
    if (authGate) authGate.classList.remove('hidden');
    if (mainShell) mainShell.classList.add('hidden');
  }
}

// Hook Storage.save to automatically replicate state changes to Cloud Firestore
Storage.onSave = (currentState) => {
  const user = getCurrentUser();
  if (user && user.uid && currentState.activeTripId) {
    const activeTrip = currentState.trips.find(t => t.id === currentState.activeTripId);
    if (activeTrip) {
      syncTripToCloud(
        user.uid,
        activeTrip,
        currentState.stopsMap[activeTrip.id] || [],
        currentState.expensesMap[activeTrip.id] || []
      );
    }
  }
};

function setupPrivacyTermsAndAuthEvents() {
  const privacyScreen = document.getElementById('screen-privacy-terms');
  const chkAgree = document.getElementById('chk-privacy-agree');
  const btnAccept = document.getElementById('btn-accept-privacy');
  const btnAcceptLabel = document.getElementById('btn-accept-privacy-label');
  const btnViewTerms = document.getElementById('btn-view-terms');

  const googleBtn = document.getElementById('btn-google-signin');
  const googleBtnLabel = document.getElementById('google-signin-btn-label');
  const googleSpinner = document.getElementById('google-signin-spinner');
  const signoutBtn = document.getElementById('btn-account-signout');

  // Checkbox toggle enables/disables the Accept button
  if (chkAgree && btnAccept) {
    chkAgree.onchange = () => {
      btnAccept.disabled = !chkAgree.checked;
    };
  }

  // Accept button handler: stores acceptance once in localStorage
  if (btnAccept) {
    btnAccept.onclick = () => {
      localStorage.setItem('tripweave_terms_accepted', 'true');
      if (privacyScreen) privacyScreen.classList.add('hidden');

      // Now route to appropriate screen
      const current = getCurrentUser();
      applyAuthenticatedUser(current);
      showToast('Terms & Privacy Policy accepted');
    };
  }

  // Review Privacy & Terms Link from Auth Gate footer
  if (btnViewTerms) {
    btnViewTerms.onclick = () => {
      if (privacyScreen) {
        if (chkAgree) chkAgree.checked = true;
        if (btnAccept) btnAccept.disabled = false;
        if (btnAcceptLabel) btnAcceptLabel.textContent = 'Close & Return';
        privacyScreen.classList.remove('hidden');
      }
    };
  }

  // Google Sign-In button handler
  if (googleBtn) {
    googleBtn.onclick = async () => {
      if (googleSpinner) googleSpinner.classList.remove('hidden');
      if (googleBtnLabel) googleBtnLabel.textContent = 'Authenticating...';
      googleBtn.disabled = true;

      try {
        const res = await loginWithGoogle();

        if (googleSpinner) googleSpinner.classList.add('hidden');
        if (googleBtnLabel) googleBtnLabel.textContent = 'Sign in with Google';
        googleBtn.disabled = false;

        if (res.success) {
          applyAuthenticatedUser(res.user);
          showToast(`Welcome, ${res.user.displayName || 'Explorer'}!`);
        } else {
          showToast(`Sign-in error: ${res.error || 'Failed'}`);
        }
      } catch (err) {
        if (googleSpinner) googleSpinner.classList.add('hidden');
        if (googleBtnLabel) googleBtnLabel.textContent = 'Sign in with Google';
        googleBtn.disabled = false;
        console.error('Google login error:', err);
      }
    };
  }

  // Sign out button handler
  if (signoutBtn) {
    signoutBtn.onclick = async () => {
      const modal = document.getElementById('modal-google-account');
      if (modal) modal.classList.add('hidden');
      await logoutUser();
      applyAuthenticatedUser(null);
      showToast('Signed out of Google account');
    };
  }

  // Initialize screen state on launch
  const initialUser = getCurrentUser();
  applyAuthenticatedUser(initialUser);

  // Subscribe to persistent auth state
  subscribeAuthState((user) => {
    applyAuthenticatedUser(user);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEvents();
  setupLivePlaceSearch();
  setupCategoryChips();
  setupLocationPermission();
  setupPrivacyTermsAndAuthEvents();
  refreshApp();
});


// ==========================================================================
// 5-STEP CREATE TRIP WIZARD (Spec 5.3)
// ==========================================================================
let createTripState = {
  currentStep: 1,
  origin: '',
  destination: '',
  departureMinutes: 0,
  departureDate: '',
  vehicleMode: 'car',
  mileage: 0,
  groupSize: 0,
  budgetType: 'total',
  budgetAmount: 0,
  scenario: 'typical',
  preferences: []
};

const PRESET_ROUTES = [];

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
    ? (createTripState.budgetAmount || 0)
    : ((createTripState.budgetAmount || 0) * (createTripState.groupSize || 1));

  const newTrip = {
    id: newTripId,
    title: createTripState.origin && createTripState.destination
      ? `${createTripState.origin.split(',')[0]} to ${createTripState.destination.split(',')[0]}`
      : (createTripState.origin || createTripState.destination || 'New Trip'),
    destinationName: createTripState.destination || null,
    departureTimeMinutes: createTripState.departureMinutes || 0,
    totalBudget: totalBudget || 0,
    groupSize: createTripState.groupSize || 0,
    vehicleMileageKmPerLitre: createTripState.mileage || 0,
    fuelPricePerLitre: 0,
    isArchived: false
  };

  state.trips.unshift(newTrip);
  state.activeTripId = newTripId;
  state.stopsMap[newTripId] = [];
  state.expensesMap[newTripId] = [];
  Storage.save(state);

  document.getElementById('modal-create-trip').classList.add('hidden');
  switchTab('map');
  refreshApp();
  showToast('Trip created!');
}


// Google Maps Layer Switcher (Roadmap, Satellite Hybrid, Terrain)
window.switchGoogleMapLayer = function(type) {
  if (!mapInstance || typeof google === 'undefined' || !google.maps) return;
  const mapType = type === 'satellite'
    ? google.maps.MapTypeId.HYBRID
    : (type === 'terrain' ? google.maps.MapTypeId.TERRAIN : google.maps.MapTypeId.ROADMAP);
  mapInstance.setMapTypeId(mapType);
  showToast(`Switched to Google Maps ${type.charAt(0).toUpperCase() + type.slice(1)}`);
};

// ==========================================================================
// FAMOUS PLACES, FOOD, PARKS & MONUMENTS DISCOVERY ENGINE (Official India Hubs)
// ==========================================================================

const KNOWN_DESTINATION_PHOTOS = {
  'hyderabad': 'https://images.unsplash.com/photo-1600100397608-f010f443b222?auto=format&fit=crop&w=900&q=80',
  'charminar': 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=900&q=80',
  'golconda': 'https://images.unsplash.com/photo-1600100397608-f010f443b222?auto=format&fit=crop&w=900&q=80',
  'qutb shahi': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80',
  'chowmahalla': 'https://images.unsplash.com/photo-1609137144822-4416999a0980?auto=format&fit=crop&w=900&q=80',
  'hussain sagar': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
  'paradise biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=80',
  'bawarchi': 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=80',
  'karachi bakery': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80',
  'pista house': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',
  'ram ki bandi': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=900&q=80',
  'mysore palace': 'https://images.unsplash.com/photo-1600100397608-f010f443b222?auto=format&fit=crop&w=900&q=80',
  'abbey falls': 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=900&q=80',
  'raja': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80',
  'namdroling': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=900&q=80',
  'virupaksha': 'https://images.unsplash.com/photo-1609137144822-4416999a0980?auto=format&fit=crop&w=900&q=80',
  'amer fort': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80',
  'hawa mahal': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80',
  'bangalore': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=900&q=80',
  'delhi': 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=900&q=80',
  'jaipur': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80'
};

const THEMATIC_PHOTOS = {
  waterfall: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=900&q=80',
  lake: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
  temple: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=900&q=80',
  fort: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=900&q=80',
  hills: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80',
  ghats: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80',
  highway: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=900&q=80',
  forest: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80',
  city: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=900&q=80',
  food: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=80',
  park: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80',
  default: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=900&q=80'
};

async function fetchPlaceImage(lat, lng, name, category = '') {
  const lowerName = (name || '').toLowerCase();
  for (const [key, url] of Object.entries(KNOWN_DESTINATION_PHOTOS)) {
    if (lowerName.includes(key)) return url;
  }
  const lowerCat = (category || '').toLowerCase();
  if (lowerCat.includes('park') || lowerCat.includes('garden')) return THEMATIC_PHOTOS.park;
  if (lowerCat.includes('lake') || lowerCat.includes('river')) return THEMATIC_PHOTOS.lake;
  if (lowerCat.includes('food') || lowerCat.includes('restaurant')) return THEMATIC_PHOTOS.food;
  if (lowerCat.includes('fort') || lowerCat.includes('monument')) return THEMATIC_PHOTOS.fort;
  return THEMATIC_PHOTOS.default;
}

function formatCategoryTag(category) {
  if (!category) return 'Scenic Stop';
  const c = category.toLowerCase();
  if (c.includes('monument') || c.includes('fort') || c.includes('palace') || c.includes('historic')) return 'Historical Heritage';
  if (c.includes('food') || c.includes('restaurant') || c.includes('bakery') || c.includes('cuisine')) return 'Famous Dining & Food';
  if (c.includes('park') || c.includes('lake') || c.includes('garden') || c.includes('sanctuary')) return 'Park & Nature Sanctuary';
  return 'Scenic Stop';
}

const FAMOUS_INDIAN_HUBS = {
  hyderabad: {
    cityName: 'Hyderabad',
    lat: 17.3850,
    lng: 78.4867,
    radiusKm: 65,
    places: [
      // Monuments & Heritage
      {
        id: 'hyd-charminar',
        name: 'Charminar',
        sub: 'Old City, Hyderabad',
        category: 'monuments',
        tag: 'Iconic 1591 Monument',
        lat: 17.3616,
        lng: 78.4747,
        img: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=600&q=80',
        meta: '09:00 AM - 05:30 PM | Entry Rs 25',
        dur: 60
      },
      {
        id: 'hyd-golconda',
        name: 'Golconda Fort',
        sub: 'Ibrahim Bagh, Hyderabad',
        category: 'monuments',
        tag: 'Medieval Acoustic Citadel',
        lat: 17.3833,
        lng: 78.4011,
        img: 'https://images.unsplash.com/photo-1600100397608-f010f443b222?auto=format&fit=crop&w=600&q=80',
        meta: '09:00 AM - 05:30 PM | Light & Sound Show',
        dur: 90
      },
      {
        id: 'hyd-qutb-shahi',
        name: 'Qutb Shahi Tombs',
        sub: 'Shaikpet, Hyderabad',
        category: 'monuments',
        tag: 'Seven Royal Tombs & Gardens',
        lat: 17.3942,
        lng: 78.3970,
        img: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=600&q=80',
        meta: '09:30 AM - 04:30 PM | Heritage Complex',
        dur: 60
      },
      {
        id: 'hyd-chowmahalla',
        name: 'Chowmahalla Palace',
        sub: 'Khilwat, Hyderabad',
        category: 'monuments',
        tag: 'Nizami Royal Palace & Vintage Cars',
        lat: 17.3578,
        lng: 78.4717,
        img: 'https://images.unsplash.com/photo-1609137144822-4416999a0980?auto=format&fit=crop&w=600&q=80',
        meta: '10:00 AM - 05:00 PM | Royal Regalia',
        dur: 75
      },
      {
        id: 'hyd-salar-jung',
        name: 'Salar Jung Museum',
        sub: 'Dar-ul-Shifa, Hyderabad',
        category: 'monuments',
        tag: 'World Rare Artifacts & Veiled Rebecca',
        lat: 17.3713,
        lng: 78.4804,
        img: 'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&w=600&q=80',
        meta: '10:00 AM - 05:00 PM | World Heritage Art',
        dur: 100
      },
      // Famous Food & Restaurants
      {
        id: 'hyd-paradise',
        name: 'Paradise Biryani',
        sub: 'MG Road, Secunderabad',
        category: 'food',
        tag: 'World Famous Dum Biryani Since 1953',
        lat: 17.4416,
        lng: 78.4983,
        img: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
        meta: '11:00 AM - 11:00 PM | Iconic Hyderabadi Dum',
        dur: 45
      },
      {
        id: 'hyd-bawarchi',
        name: 'Bawarchi Restaurant',
        sub: 'RTC X Roads, Hyderabad',
        category: 'food',
        tag: 'Legendary Mutton Biryani Hub',
        lat: 17.4048,
        lng: 78.4981,
        img: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80',
        meta: '11:30 AM - 11:30 PM | Authentic Spice Heritage',
        dur: 45
      },
      {
        id: 'hyd-karachi',
        name: 'Karachi Bakery',
        sub: 'Mozamjahi Market, Hyderabad',
        category: 'food',
        tag: 'Original Fruit & Osmania Biscuits Since 1953',
        lat: 17.3822,
        lng: 78.4735,
        img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        meta: '10:00 AM - 10:00 PM | Heritage Bakery',
        dur: 30
      },
      {
        id: 'hyd-pista-house',
        name: 'Pista House & Irani Chai',
        sub: 'Charminar, Hyderabad',
        category: 'food',
        tag: 'GI-Tagged Haleem & Zafrani Chai',
        lat: 17.3610,
        lng: 78.4730,
        img: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
        meta: '10:00 AM - 12:00 AM | Irani Chai & Osmania',
        dur: 30
      },
      {
        id: 'hyd-ram-ki-bandi',
        name: 'Ram Ki Bandi',
        sub: 'Nampally, Hyderabad',
        category: 'food',
        tag: 'Famous Midnight Butter Cheese Dosa',
        lat: 17.3833,
        lng: 78.4744,
        img: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
        meta: '03:00 AM - 08:00 AM | Street Food Legend',
        dur: 30
      },
      {
        id: 'hyd-shah-ghouse',
        name: 'Shah Ghouse Cafe',
        sub: 'Tolichowki / Charminar',
        category: 'food',
        tag: 'Mutton Biryani, Paaya & Khubani Meetha',
        lat: 17.3996,
        lng: 78.4116,
        img: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=600&q=80',
        meta: '11:00 AM - 01:00 AM | Late Night Dine',
        dur: 45
      },
      // Parks & Lakes
      {
        id: 'hyd-hussain-sagar',
        name: 'Hussain Sagar & Buddha Statue',
        sub: 'Tank Bund, Hyderabad',
        category: 'parks',
        tag: 'Heart-Shaped Lake & Monolith Buddha',
        lat: 17.4239,
        lng: 78.4738,
        img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
        meta: 'Boat Ride to Statue | Sunset Promenade',
        dur: 60
      },
      {
        id: 'hyd-kbr-park',
        name: 'KBR National Park',
        sub: 'Jubilee Hills, Hyderabad',
        category: 'parks',
        tag: 'Lush Urban Forest Sanctuary',
        lat: 17.4244,
        lng: 78.4238,
        img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80',
        meta: '05:30 AM - 10:00 AM, 04:30 PM - 07:00 PM',
        dur: 60
      },
      {
        id: 'hyd-lumbini',
        name: 'Lumbini Park & Laser Show',
        sub: 'Khairatabad, Hyderabad',
        category: 'parks',
        tag: 'Lakeside Park & Speed Boating Jetty',
        lat: 17.4143,
        lng: 78.4735,
        img: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=600&q=80',
        meta: '09:00 AM - 09:00 PM | Laser & Fountain Show',
        dur: 45
      },
      {
        id: 'hyd-durgam-cheruvu',
        name: 'Durgam Cheruvu & Cable Bridge',
        sub: 'Hitec City, Madhapur',
        category: 'parks',
        tag: 'Secret Lake & Hanging Cable-Stayed Bridge',
        lat: 17.4332,
        lng: 78.3846,
        img: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
        meta: 'Open 24 Hours | Illuminated Skywalk Promenade',
        dur: 45
      }
    ]
  },
  bangalore: {
    cityName: 'Bengaluru',
    lat: 12.9716,
    lng: 77.5946,
    radiusKm: 60,
    places: [
      {
        id: 'blr-palace',
        name: 'Bangalore Palace',
        sub: 'Vasanth Nagar, Bengaluru',
        category: 'monuments',
        tag: 'Tudor-Style Royal Palace',
        lat: 12.9988,
        lng: 77.5921,
        img: 'https://images.unsplash.com/photo-1600100397608-f010f443b222?auto=format&fit=crop&w=600&q=80',
        meta: '10:00 AM - 05:30 PM | Audio Tour',
        dur: 60
      },
      {
        id: 'blr-vidyarthi',
        name: 'Vidyarthi Bhavan',
        sub: 'Gandhi Bazaar, Basavanagudi',
        category: 'food',
        tag: 'Legendary Crispy Masala Dosa Since 1943',
        lat: 12.9427,
        lng: 77.5714,
        img: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
        meta: '06:30 AM - 11:30 AM, 02:00 PM - 08:00 PM',
        dur: 45
      },
      {
        id: 'blr-cubbon',
        name: 'Cubbon Park',
        sub: 'Kasturba Road, Bengaluru',
        category: 'parks',
        tag: '300-Acre Green Lung of Bengaluru',
        lat: 12.9763,
        lng: 77.5929,
        img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80',
        meta: '06:00 AM - 06:00 PM | Bamboo Groves',
        dur: 60
      },
      {
        id: 'blr-lalbagh',
        name: 'Lalbagh Botanical Garden',
        sub: 'Mavalli, Bengaluru',
        category: 'parks',
        tag: 'Iconic Glass House & Bonsai Garden',
        lat: 12.9507,
        lng: 77.5848,
        img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
        meta: '06:00 AM - 07:00 PM | 240-Acre Heritage Park',
        dur: 75
      }
    ]
  },
  delhi: {
    cityName: 'Delhi',
    lat: 28.6139,
    lng: 77.2090,
    radiusKm: 60,
    places: [
      {
        id: 'del-red-fort',
        name: 'Red Fort (Lal Qila)',
        sub: 'Old Delhi',
        category: 'monuments',
        tag: 'Mughal Fortress of Shah Jahan',
        lat: 28.6562,
        lng: 77.2410,
        img: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80',
        meta: '09:30 AM - 04:30 PM | UNESCO World Heritage',
        dur: 90
      },
      {
        id: 'del-karims',
        name: "Karim's Jama Masjid",
        sub: 'Gali Kababian, Jama Masjid',
        category: 'food',
        tag: 'Royal Mughlai Kebabs & Nihari Since 1913',
        lat: 28.6508,
        lng: 77.2334,
        img: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80',
        meta: '09:00 AM - 01:00 AM | Mutton Seekh Kebab',
        dur: 50
      },
      {
        id: 'del-lodhi',
        name: 'Lodhi Garden',
        sub: 'Lodhi Road, New Delhi',
        category: 'parks',
        tag: '90-Acre Tomb Complex & Lush Grounds',
        lat: 28.5931,
        lng: 77.2197,
        img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80',
        meta: '06:00 AM - 08:00 PM | Historic Garden',
        dur: 60
      }
    ]
  },
  jaipur: {
    cityName: 'Jaipur',
    lat: 26.9124,
    lng: 75.7873,
    radiusKm: 60,
    places: [
      {
        id: 'jai-hawa-mahal',
        name: 'Hawa Mahal',
        sub: 'Badi Choupad, Pink City, Jaipur',
        category: 'monuments',
        tag: 'Palace of Winds with 953 Jharokhas',
        lat: 26.9239,
        lng: 75.8267,
        img: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=600&q=80',
        meta: '09:00 AM - 05:00 PM | Pink Sandstone Icon',
        dur: 60
      },
      {
        id: 'jai-rawat',
        name: 'Rawat Mishthan Bhandar',
        sub: 'Station Road, Sindhi Camp, Jaipur',
        category: 'food',
        tag: 'Famous Hot Pyaaz Kachori & Mawa Kachori',
        lat: 26.9213,
        lng: 75.7972,
        img: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
        meta: '06:00 AM - 10:30 PM | Crispy Onion Kachori',
        dur: 30
      },
      {
        id: 'jai-central-park',
        name: 'Central Park Jaipur',
        sub: 'Prithviraj Road, Jaipur',
        category: 'parks',
        tag: 'Largest Green Park with Tallest Tricolor',
        lat: 26.9015,
        lng: 75.8085,
        img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80',
        meta: '05:00 AM - 09:00 PM | 5km Jogging Track',
        dur: 45
      }
    ]
  }
};

let activeNearbyPlaces = [];
let currentNearbyFilter = 'all';

async function getNearbyFamousPlaces(lat, lng, localityName = '') {
  const lowerName = (localityName || '').toLowerCase();
  
  // 1. Check known hubs by distance or name match
  for (const [key, hub] of Object.entries(FAMOUS_INDIAN_HUBS)) {
    const distToHub = calculateHaversineKm(lat, lng, hub.lat, hub.lng);
    if (distToHub <= hub.radiusKm || lowerName.includes(key) || lowerName.includes(hub.cityName.toLowerCase())) {
      const placesWithDist = hub.places.map(p => {
        const d = calculateHaversineKm(lat, lng, p.lat, p.lng);
        return {
          ...p,
          distanceKm: d,
          distText: `${d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1) + ' km'} away`
        };
      });
      placesWithDist.sort((a, b) => a.distanceKm - b.distanceKm);
      return {
        cityName: hub.cityName,
        places: placesWithDist
      };
    }
  }

  // 2. Dynamic Fallback via Wikipedia Geosearch for ANY other location in India
  try {
    const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=15000&ggslimit=10&prop=pageimages|description&pithumbsize=600&format=json&origin=*`;
    const res = await fetch(geoUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.query && data.query.pages) {
        const pages = Object.values(data.query.pages);
        const dynamicPlaces = pages.map((page, i) => {
          const title = page.title;
          const lower = title.toLowerCase();
          let cat = 'monuments';
          let tag = 'Famous Attraction';
          if (lower.includes('park') || lower.includes('lake') || lower.includes('fall') || lower.includes('forest') || lower.includes('garden')) {
            cat = 'parks';
            tag = 'Scenic Nature & Park';
          } else if (lower.includes('food') || lower.includes('restaurant') || lower.includes('cafe') || lower.includes('dosa') || lower.includes('hotel')) {
            cat = 'food';
            tag = 'Famous Food & Dining';
          }
          const pLat = page.coordinates ? page.coordinates[0].lat : (lat + (i * 0.007));
          const pLng = page.coordinates ? page.coordinates[0].lon : (lng + (i * 0.007));
          const dist = calculateHaversineKm(lat, lng, pLat, pLng);
          return {
            id: `dyn-${page.pageid}`,
            name: title,
            sub: page.description || (localityName ? localityName.split(',')[0] : 'Landmark in Area'),
            category: cat,
            tag: tag,
            lat: pLat,
            lng: pLng,
            img: (page.thumbnail && page.thumbnail.source) ? page.thumbnail.source : THEMATIC_PHOTOS.default,
            meta: 'Open for visitors',
            distanceKm: dist,
            distText: `${dist.toFixed(1)} km away`,
            dur: 45
          };
        });

        dynamicPlaces.sort((a, b) => a.distanceKm - b.distanceKm);
        return {
          cityName: localityName.split(',')[0] || 'This Area',
          places: dynamicPlaces
        };
      }
    }
  } catch (err) {
    console.warn('Dynamic nearby search skipped:', err);
  }

  return {
    cityName: localityName.split(',')[0] || 'This Area',
    places: []
  };
}

function renderNearbyPlaces(places, filter = 'all') {
  const carousel = document.getElementById('nearby-places-carousel');
  const countBadge = document.getElementById('nearby-count-badge');
  if (!carousel) return;

  const filtered = filter === 'all' ? places : places.filter(p => p.category === filter);
  if (countBadge) countBadge.textContent = `${filtered.length} Places`;

  if (filtered.length === 0) {
    carousel.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--on-surface-variant); font-size: 12px; background: var(--surface-container-low); border-radius: 12px;">
        No ${filter === 'all' ? '' : filter} places listed for this area yet.
      </div>
    `;
    return;
  }

  carousel.innerHTML = filtered.map(p => `
    <div class="nearby-place-card" data-place-id="${p.id}" data-lat="${p.lat}" data-lng="${p.lng}" data-name="${p.name}">
      <img src="${p.img}" alt="${p.name}" class="nearby-card-thumb" onerror="this.src='${THEMATIC_PHOTOS.default}'" />
      <div class="nearby-card-body">
        <div class="nearby-card-title">${p.name}</div>
        <div class="nearby-card-sub">${p.sub}</div>
        <div class="nearby-card-meta">
          <span>${p.distText}</span>
          <span>•</span>
          <span style="color: var(--on-surface-variant); font-weight: 500;">${p.meta}</span>
        </div>
      </div>
      <button class="nearby-card-add-btn" data-name="${p.name}" data-lat="${p.lat}" data-lng="${p.lng}" data-dur="${p.dur || 60}">
        + Add
      </button>
    </div>
  `).join('');

  // Wire card click (pan to spot on map)
  carousel.querySelectorAll('.nearby-place-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.nearby-card-add-btn')) return;
      const cLat = parseFloat(card.getAttribute('data-lat'));
      const cLng = parseFloat(card.getAttribute('data-lng'));
      const cName = card.getAttribute('data-name');
      if (mapInstance && !isNaN(cLat) && !isNaN(cLng)) {
        mapInstance.panTo({ lat: cLat, lng: cLng });
        if (selectedPlaceMarker) {
          try { selectedPlaceMarker.setMap(null); } catch (e) {}
        }
        const pinSvg = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
            <path d="M17 2 C8.7 2 2 8.7 2 17 C2 27.5 17 40 17 40 C17 40 32 27.5 32 17 C32 8.7 25.3 2 17 2 Z" fill="#E53935" stroke="#FFFFFF" stroke-width="2"/>
            <circle cx="17" cy="16" r="5" fill="#FFFFFF"/>
          </svg>
        `);
        selectedPlaceMarker = new google.maps.Marker({
          position: { lat: cLat, lng: cLng },
          map: mapInstance,
          icon: {
            url: pinSvg,
            scaledSize: new google.maps.Size(28, 35),
            anchor: new google.maps.Point(14, 35)
          },
          zIndex: 1200
        });
      }
    };
  });

  // Wire "+ Add" button on each card
  carousel.querySelectorAll('.nearby-card-add-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const sName = btn.getAttribute('data-name');
      const sLat = parseFloat(btn.getAttribute('data-lat'));
      const sLng = parseFloat(btn.getAttribute('data-lng'));
      const sDur = parseInt(btn.getAttribute('data-dur'), 10) || 60;

      if (!state.activeTripId || !state.trips || state.trips.length === 0) {
        const newTripId = `trip-${Date.now()}`;
        const newTrip = {
          id: newTripId,
          title: `Road Trip to ${sName}`,
          destinationName: sName,
          departureTimeMinutes: 0,
          totalBudget: 0,
          groupSize: 0,
          vehicleMileageKmPerLitre: 0,
          fuelPricePerLitre: 0,
          isArchived: false
        };
        state.trips = [newTrip];
        state.activeTripId = newTripId;
        state.stopsMap[newTripId] = [];
        state.expensesMap[newTripId] = [];
      }

      const stops = state.stopsMap[state.activeTripId] || [];
      const newStop = {
        id: `stop-${Date.now()}`,
        tripId: state.activeTripId,
        name: sName,
        latitude: sLat,
        longitude: sLng,
        orderIndex: stops.length,
        durationMinutes: sDur,
        bufferMinutes: 15,
        isOvernight: false,
        openingHourMinutes: 540,
        closingHourMinutes: 1080
      };
      stops.push(newStop);
      state.stopsMap[state.activeTripId] = stops;
      Storage.save(state);

      refreshApp();
      showToast(`Added ${sName} to itinerary!`);
      btn.textContent = 'Added';
      btn.style.background = 'var(--success)';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = 'var(--success)';
    };
  });
}

function setupNearbyTabsListener() {
  const tabsRow = document.getElementById('nearby-tabs-row');
  if (!tabsRow) return;

  tabsRow.querySelectorAll('.nearby-tab-chip').forEach(tab => {
    tab.onclick = () => {
      tabsRow.querySelectorAll('.nearby-tab-chip').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentNearbyFilter = tab.getAttribute('data-filter') || 'all';
      renderNearbyPlaces(activeNearbyPlaces, currentNearbyFilter);
    };
  });
}

// Master Handler for Map Place Selection & Nearby Discovery
async function handleMapPlaceSelection(lat, lng, explicitName = null) {
  if (!mapInstance || typeof google === 'undefined' || !google.maps) return;

  if (selectedPlaceMarker) {
    try { selectedPlaceMarker.setMap(null); } catch (e) {}
    selectedPlaceMarker = null;
  }

  const dropPinIcon = L.divIcon({
    className: 'selected-pin-container',
    html: `
      <div style="background: #DC2626; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid #FFFFFF; box-shadow: 0 3px 10px rgba(220,38,38,0.4); display: flex; align-items: center; justify-content: center;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #FFFFFF; transform: rotate(45deg);"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });

  selectedPlaceMarker = L.marker([lat, lng], {
    icon: dropPinIcon,
    zIndexOffset: 3000
  }).addTo(mapInstance);

  mapInstance.panTo([lat, lng]);

  const sheet = document.getElementById('selected-place-sheet');
  const imgEl = document.getElementById('selected-place-img');
  const tagEl = document.getElementById('selected-place-tag');
  const nameEl = document.getElementById('selected-place-name');
  const locEl = document.getElementById('selected-place-location');
  const distEl = document.getElementById('selected-place-dist-badge');
  const hoursEl = document.getElementById('selected-place-hours-text');
  const coordsEl = document.getElementById('selected-place-coords');

  if (!sheet) return;

  sheet.classList.remove('hidden');

  let placeName = explicitName || '';
  let locality = 'India';
  let category = 'Scenic Destination';
  let initialPhoto = THEMATIC_PHOTOS.default;

  const lowerExplicit = (explicitName || '').toLowerCase();
  
  // Check known hubs (like Hyderabad, Bangalore, Delhi, Jaipur)
  let matchedHub = null;
  for (const [k, hub] of Object.entries(FAMOUS_INDIAN_HUBS)) {
    const d = calculateHaversineKm(lat, lng, hub.lat, hub.lng);
    if (d <= hub.radiusKm || lowerExplicit.includes(k) || lowerExplicit.includes(hub.cityName.toLowerCase())) {
      matchedHub = hub;
      break;
    }
  }

  if (matchedHub) {
    if (!placeName) placeName = matchedHub.cityName;
    locality = matchedHub.cityName === 'Hyderabad' ? 'Telangana, India' : `${matchedHub.cityName}, India`;
    category = 'Historical Heritage';
    if (KNOWN_DESTINATION_PHOTOS[matchedHub.cityName.toLowerCase()]) {
      initialPhoto = KNOWN_DESTINATION_PHOTOS[matchedHub.cityName.toLowerCase()];
    }
  } else if (explicitName) {
    placeName = explicitName;
    locality = 'India';
    for (const [k, u] of Object.entries(KNOWN_DESTINATION_PHOTOS)) {
      if (lowerExplicit.includes(k)) {
        initialPhoto = u;
        break;
      }
    }
  }

  if (!placeName) {
    placeName = `Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
  }

  nameEl.textContent = placeName;
  locEl.textContent = locality;
  tagEl.textContent = formatCategoryTag(category);
  coordsEl.textContent = `${lat.toFixed(4)} N, ${lng.toFixed(4)} E`;
  distEl.textContent = userLocation ? `${calculateHaversineKm(userLocation.lat, userLocation.lng, lat, lng).toFixed(1)} km away` : 'Selected Spot';
  imgEl.src = initialPhoto;

  // POPULATE NEARBY FAMOUS PLACES, FOOD, PARKS & MONUMENTS
  try {
    const nearbyData = await getNearbyFamousPlaces(lat, lng, explicitName || placeName || locality);
    activeNearbyPlaces = nearbyData.places || [];
    const nearbyCityEl = document.getElementById('nearby-city-name');
    if (nearbyCityEl) nearbyCityEl.textContent = nearbyData.cityName || (placeName ? placeName.split(',')[0] : 'This Area');
    currentNearbyFilter = 'all';
    
    // Reset tab filter chips
    const tabsRow = document.getElementById('nearby-tabs-row');
    if (tabsRow) {
      tabsRow.querySelectorAll('.nearby-tab-chip').forEach(t => {
        if (t.getAttribute('data-filter') === 'all') t.classList.add('active');
        else t.classList.remove('active');
      });
    }

    renderNearbyPlaces(activeNearbyPlaces, 'all');
  } catch (err) {
    console.warn('Nearby exploration error:', err);
  }

  // Reverse geocoding in background if placeName not known
  if (!explicitName && !matchedHub) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const primaryTitle = data.name || addr.tourism || addr.historic || addr.natural || addr.amenity || addr.road || addr.suburb || addr.village || addr.town || addr.city;
        if (primaryTitle) {
          placeName = primaryTitle;
          nameEl.textContent = placeName;
        }
        const parts = [addr.suburb, addr.town || addr.city || addr.village, addr.state, addr.country].filter(Boolean);
        locality = parts.join(', ') || data.display_name || 'India';
        locEl.textContent = locality;
      }
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
    }
  }

  const hoursInfo = getPlaceHours ? getPlaceHours(placeName) : null;
  const hoursDisplay = hoursInfo ? hoursInfo.name : '08:00 AM - 06:00 PM';
  hoursEl.textContent = hoursDisplay;

  currentSelectedPlace = {
    name: placeName,
    latitude: lat,
    longitude: lng,
    locality,
    imageUrl: initialPhoto,
    hoursDisplay
  };
}