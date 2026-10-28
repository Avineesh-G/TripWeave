// ==========================================================================
// TripWeave — Re-Engineered Modular Application Entry Point
// ==========================================================================

import { state } from './state.js';
import { ICONS } from './icons.js';
import {
  initMap,
  resizeMap,
  switchMapLayer,
  setupLocationListeners,
  renderRoutePolyline
} from './services/map.service.js';
import {
  calculateTripSchedule,
  formatMinutes
} from './services/scheduler.service.js';
import {
  calculateTripBudget,
  buildItemizedExpenses
} from './services/budget.service.js';
import {
  checkAppUpdates,
  getInstalledVersionCode,
  getInstalledVersionName
} from './services/updater.service.js';
import {
  isTermsAccepted,
  setTermsAccepted,
  loginWithGoogle,
  logoutUser,
  getCurrentUser,
  listenAuth,
  saveTripToCloud
} from './services/auth.service.js';
import { generateWhatsAppSummary, exportTripAsJSON } from './services/export.service.js';
import { getAIHistoryPlans, deleteAIHistoryPlan } from './services/ai.service.js';

import { setupNavigationUI } from './ui/navigation.ui.js';
import { setupSheetUI, updateSheetState } from './ui/sheet.ui.js';
import { setupDirectionsUI } from './ui/directions.ui.js';
import { setupTimelineUI } from './ui/timeline.ui.js';
import { setupBudgetUI } from './ui/budget.ui.js';
import {
  showToast,
  setupUpdateModal,
  showUpdateModal,
  setupShareModal,
  setupAddStopModal
} from './ui/modals.ui.js';
import { setupAuthUI } from './ui/auth.ui.js';

// Expose icons and toasts globally for inline templates
window.ICONS = ICONS;
window.showToast = showToast;

// --------------------------------------------------------------------------
// Application Core Orchestrator
// --------------------------------------------------------------------------

function computeActivePlan() {
  const trip = state.getActiveTrip() || {
    id: 'default-trip',
    title: 'My Road Trip',
    origin: 'Starting City',
    destination: 'Destination',
    departureDate: new Date().toISOString().split('T')[0],
    departureTimeMinutes: 480,
    groupSize: 4,
    vehicleModel: 'Hyundai Creta Diesel',
    vehicleMileageKmPerLitre: 16,
    fuelPricePerLitre: 102.8,
    totalBudget: 25000
  };

  const stops = state.getActiveStops();
  const expenses = state.getActiveExpenses();

  const scheduleResult = calculateTripSchedule(trip, stops);
  let totalKm = scheduleResult.stops.reduce((acc, s) => acc + (s.distanceFromPreviousKm || 0), 0);
  if (state.activeRoute && state.activeRoute.distanceKm && stops.length <= 2) {
    totalKm = Math.round(state.activeRoute.distanceKm * 10) / 10;
  }
  const budgetResult = calculateTripBudget(trip, expenses, totalKm, state.currentScenario);

  return {
    trip,
    stops,
    expenses,
    scheduleResult,
    budgetResult,
    totalDistanceKm: totalKm
  };
}

let timelineController = null;
let budgetController = null;
let sheetController = null;
let directionsController = null;
let shareModalController = null;
let addStopModalController = null;

function refreshAppUI() {
  const plan = computeActivePlan();

  // 1. Update Map floating card & peek sheet
  updateSheetState(plan);

  // 2. Update Timeline in Itinerary tab
  if (timelineController) {
    timelineController.renderTimeline(plan.scheduleResult, plan.stops);
  }

  // 3. Update Budget in Budget tab
  if (budgetController) {
    budgetController.renderBudget(plan.budgetResult, plan.trip);
  }

  // 4. Update Header Title
  const headerTripTitle = document.getElementById('header-trip-title');
  if (headerTripTitle) {
    headerTripTitle.textContent = plan.trip.title || 'TripWeave';
  }

  // 5. Update Saved Trips History list & User Trips
  renderSavedTripsHistory();
  renderUserTripsList();

  // 6. Sync Vehicle Details Card (in Itinerary Tab)
  const inMileage = document.getElementById('setting-mileage-input');
  const inFuel = document.getElementById('setting-fuel-price-input');
  const inVehicle = document.getElementById('setting-vehicle-input');
  if (inMileage && plan.trip.vehicleMileageKmPerLitre && document.activeElement !== inMileage) {
    inMileage.value = plan.trip.vehicleMileageKmPerLitre;
  }
  if (inFuel && plan.trip.fuelPricePerLitre && document.activeElement !== inFuel) {
    inFuel.value = plan.trip.fuelPricePerLitre;
  }
  if (inVehicle && plan.trip.vehicleModel && document.activeElement !== inVehicle) {
    inVehicle.value = plan.trip.vehicleModel;
  }
}

// --------------------------------------------------------------------------
// Saved AI Itineraries & User Trips
// --------------------------------------------------------------------------

function renderSavedTripsHistory() {
  const listEl = document.getElementById('history-cards-container');
  const emptyEl = document.getElementById('history-empty-state');
  const badgeEl = document.getElementById('history-count-badge');
  if (!listEl) return;

  const history = getAIHistoryPlans();
  if (badgeEl) badgeEl.textContent = String(history.length);

  if (history.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    listEl.innerHTML = '';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = history.map(item => `
    <div class="ai-history-card" style="background: var(--surface-container-low); border: 1px solid var(--outline-variant); border-radius: 16px; padding: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-weight: 800; font-size: 14px; color: var(--on-surface);">${item.origin || 'Trip'} → ${item.destination || 'Destination'}</div>
          <div style="font-size: 11.5px; color: var(--on-surface-variant); margin-top: 3px;">${item.totalDistanceKm || 0} km • ~${item.totalDrivingHours || 0} hrs drive</div>
        </div>
        <button class="btn-small" onclick="window.removeAIHistoryPlan('${item.id}')" style="color: var(--error); padding: 4px 8px; border-radius: 50%;" title="Delete">${ICONS.close}</button>
      </div>
      <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
        <span class="chip active" style="font-size: 10px; padding: 2px 8px;">${item.members || 4} Travelers</span>
        <span class="chip" style="font-size: 10px; padding: 2px 8px;">₹${(item.totalCost || 0).toLocaleString('en-IN')} Est.</span>
        <span class="chip" style="font-size: 10px; padding: 2px 8px;">${item.comfort || 'Standard'}</span>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="btn-primary" onclick="window.loadAIHistoryPlan('${item.id}')" style="flex: 1; padding: 8px 12px; font-size: 12px; font-weight: 700;">Load onto Map</button>
      </div>
    </div>
  `).join('');
}

function renderUserTripsList() {
  const container = document.getElementById('user-trips-list');
  if (!container) return;

  const trips = state.trips || [];
  if (trips.length === 0) {
    container.innerHTML = `
      <div style="padding: 32px 16px; text-align: center; color: var(--on-surface-variant); font-size: 13px;">
        No trips planned yet. Tap "+ New" above to start your journey!
      </div>
    `;
    return;
  }

  container.innerHTML = trips.map(t => {
    const isActive = t.id === state.activeTripId;
    return `
      <div class="user-trip-card" style="background: var(--surface); border: 1px solid ${isActive ? 'var(--primary)' : 'var(--outline-variant)'}; border-radius: 16px; padding: 14px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
        <div>
          <div style="font-weight: 800; font-size: 14px; color: var(--on-surface);">${t.title}</div>
          <div style="font-size: 11.5px; color: var(--on-surface-variant); margin-top: 3px;">${t.origin || 'Start'} → ${t.destination || 'End'} • ${t.groupSize || 4} travelers</div>
          <div style="font-size: 11px; color: var(--primary); font-weight: 700; margin-top: 2px;">Budget: ₹${(t.totalBudget || 25000).toLocaleString('en-IN')}</div>
        </div>
        <button class="btn-small ${isActive ? 'secondary' : 'primary'}" onclick="window.switchActiveTrip('${t.id}')">
          ${isActive ? 'Active' : 'Open'}
        </button>
      </div>
    `;
  }).join('');
}

window.switchActiveTrip = function(id) {
  state.activeTripId = id;
  refreshAppUI();
  if (window.__switchTab) window.__switchTab('map');
  showToast('Switched active trip');
};

window.removeAIHistoryPlan = function(id) {
  deleteAIHistoryPlan(id);
  renderSavedTripsHistory();
  showToast('Plan removed from history');
};

window.loadAIHistoryPlan = function(id) {
  const history = getAIHistoryPlans();
  const plan = history.find(p => p.id === id);
  if (!plan) return;

  const tripId = `trip-${Date.now()}`;
  const newTrip = {
    id: tripId,
    title: plan.title || `${plan.origin} to ${plan.destination}`,
    origin: plan.origin,
    destination: plan.destination,
    departureDate: new Date().toISOString().split('T')[0],
    departureTimeMinutes: 480,
    groupSize: plan.members || 4,
    vehicleMileageKmPerLitre: 16,
    fuelPricePerLitre: 102.5,
    totalBudget: plan.totalCost || 25000
  };

  const newExpenses = buildItemizedExpenses(tripId, {
    fuelCost: plan.fuelCost || 4200,
    tollCost: plan.tollCost || 380,
    stayCost: plan.stayCost || 4800,
    mealsCost: plan.mealsCost || 2400
  });

  state.trips = [newTrip, ...state.trips.filter(t => t.id !== tripId)];
  state.activeTripId = tripId;
  state.setStops(tripId, plan.stops || []);
  state.setExpenses(tripId, newExpenses);

  refreshAppUI();

  if (window.__switchTab) window.__switchTab('map');
  showToast(`Loaded ${newTrip.title}!`);
};

// --------------------------------------------------------------------------
// Bootstrap Initialization on DOM Ready
// --------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Theme initialization
  const savedTheme = localStorage.getItem('tripweave_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('theme-dark');
    document.body.classList.remove('theme-light');
  }

  // 0. Setup Authentication Gate & User Profile Sync
  setupAuthUI({
    onAuthenticated: (user) => {
      refreshAppUI();
    }
  });

  // 1. Initialize Map
  initMap('leaflet-map');
  setupLocationListeners((msg) => showToast(msg));

  // 2. Setup Floating Navigation Bar
  const { switchTab } = setupNavigationUI({
    onTabChanged: (tab) => {
      if (tab === 'map') resizeMap();
    }
  });
  window.__switchTab = switchTab;

  // 3. Setup Add Stop Modal
  addStopModalController = setupAddStopModal({
    onStopAdded: (newStop) => {
      const tripId = state.activeTripId || 'default-trip';
      const stops = state.getActiveStops();
      newStop.stopOrder = stops.length;
      stops.push(newStop);
      state.setStops(tripId, stops);
      refreshAppUI();
    }
  });

  // Helper: Cancel Active Route / Destination and return to initial state
  function cancelActiveRoute() {
    const tripId = state.activeTripId || 'default-trip';

    // 1. Exit turn-by-turn navigation if active
    if (directionsController && typeof directionsController.exitTurnByTurn === 'function') {
      directionsController.exitTurnByTurn();
    }

    // 2. Clear active route and corridor stops
    state.activeRoute = null;
    state.corridorAmenities = [];

    // 3. Clear route polyline on map
    renderRoutePolyline(null);

    // 4. Clear stops & reset trip destination/origin
    state.setStops(tripId, []);
    const trip = state.getActiveTrip();
    if (trip) {
      trip.title = 'My Road Trip';
      trip.origin = '';
      trip.destination = '';
    }
    state.saveToStorage();

    // 5. Hide corridor tray
    const corridorTray = document.getElementById('corridor-amenities-tray');
    if (corridorTray) corridorTray.classList.add('hidden');

    // 6. Close directions box and clear inputs
    if (directionsController && typeof directionsController.closeDirections === 'function') {
      directionsController.closeDirections();
    }
    const origInput = document.getElementById('dir-input-origin');
    const destInput = document.getElementById('dir-input-dest');
    if (origInput) origInput.value = '';
    if (destInput) destInput.value = '';

    // 7. Refresh app UI (switches sheet back to 'Where are you traveling?')
    refreshAppUI();

    showToast('Route cancelled');
  }
  window.cancelActiveRoute = cancelActiveRoute;

  // 4. Setup Floating Sheet & Enlarge/Enclose Controls
  sheetController = setupSheetUI({
    onOpenFullItinerary: () => switchTab('itinerary'),
    onStartNavigation: () => {
      if (directionsController) directionsController.startTurnByTurn();
    },
    onAddStop: () => {
      if (addStopModalController) addStopModalController.openModal();
    },
    onCancelRoute: () => {
      cancelActiveRoute();
    }
  });

  // 5. Setup Directions Drawer & Highway Corridor Tray
  directionsController = setupDirectionsUI({
    onRouteComputed: (origName, destName, origCoords, destCoords, route, amenities) => {
      const tripId = state.activeTripId || 'default-trip';
      let trip = state.getActiveTrip();
      if (!trip) {
        trip = {
          id: tripId,
          title: `${origName} to ${destName}`,
          origin: origName,
          destination: destName,
          departureDate: new Date().toISOString().split('T')[0],
          departureTimeMinutes: 480,
          groupSize: 4,
          vehicleMileageKmPerLitre: 16,
          fuelPricePerLitre: 102.5,
          totalBudget: 25000
        };
        state.trips = [trip, ...state.trips.filter(t => t.id !== tripId)];
        state.activeTripId = tripId;
      } else {
        trip.title = `${origName} to ${destName}`;
        trip.origin = origName;
        trip.destination = destName;
      }

      const stops = [
        {
          id: `stop-${Date.now()}-origin`,
          name: origName,
          latitude: origCoords[0],
          longitude: origCoords[1],
          durationMinutes: 0,
          plannedDurationMinutes: 0,
          stopOrder: 0
        },
        {
          id: `stop-${Date.now()}-dest`,
          name: destName,
          latitude: destCoords[0],
          longitude: destCoords[1],
          durationMinutes: route ? route.durationMinutes : 220,
          plannedDurationMinutes: route ? route.durationMinutes : 220,
          roadDistanceKm: route ? Math.round(route.distanceKm * 10) / 10 : 218,
          stopOrder: 1
        }
      ];

      state.setStops(tripId, stops);
      state.saveToStorage();
      refreshAppUI();
    },
    onAddAmenityStop: (amenity) => {
      const tripId = state.activeTripId || 'default-trip';
      const stops = state.getActiveStops();
      const insertIdx = Math.max(1, stops.length - 1);

      const newStop = {
        id: `stop-amenity-${Date.now()}`,
        name: amenity.name,
        latitude: amenity.latitude,
        longitude: amenity.longitude,
        durationMinutes: 45,
        plannedDurationMinutes: 45,
        stopOrder: insertIdx,
        category: amenity.category,
        mapsUrl: amenity.mapsUrl
      };

      stops.splice(insertIdx, 0, newStop);
      state.setStops(tripId, stops);
      refreshAppUI();
      showToast(`Added ${amenity.name} to itinerary!`);
    },
    onToast: (msg) => showToast(msg)
  });

  // Quick Plan buttons in Empty Card Banner
  const btnQuickRoute = document.getElementById('btn-quick-plan-route');
  if (btnQuickRoute) {
    btnQuickRoute.onclick = () => {
      if (directionsController) directionsController.openDirections();
    };
  }

  const btnQuickAI = document.getElementById('btn-quick-plan-ai');
  if (btnQuickAI) {
    btnQuickAI.onclick = () => switchTab('itinerary');
  }

  // 6. Setup Timeline UI & AI Assistant
  timelineController = setupTimelineUI({
    onStopDeleted: (stopId) => {
      const tripId = state.activeTripId || 'default-trip';
      state.removeStop(tripId, stopId);
      refreshAppUI();
      showToast('Stop removed');
    },
    onPlanGenerated: (plan) => {
      window.loadAIHistoryPlan(plan.id);
    },
    onToast: (msg) => showToast(msg)
  });

  // Add stop button in Itinerary tab header
  const btnAddItin = document.getElementById('add-stop-itinerary-btn');
  if (btnAddItin) {
    btnAddItin.onclick = () => {
      if (addStopModalController) addStopModalController.openModal();
    };
  }

  // 7. Setup Budget UI
  budgetController = setupBudgetUI({
    onScenarioChanged: () => refreshAppUI()
  });

  // 8. Setup Share Modal
  shareModalController = setupShareModal(computeActivePlan);

  const btnShareItin = document.getElementById('btn-share-itinerary');
  if (btnShareItin) {
    btnShareItin.onclick = () => {
      if (shareModalController) shareModalController.openModal();
    };
  }

  // 9. Setup Map Layer Selector FAB
  const btnLayer = document.getElementById('btn-layer-selector');
  if (btnLayer) {
    let currentLayer = 'roadmap';
    btnLayer.onclick = () => {
      if (currentLayer === 'roadmap') currentLayer = 'satellite';
      else if (currentLayer === 'satellite') currentLayer = 'terrain';
      else currentLayer = 'roadmap';
      switchMapLayer(currentLayer);
      showToast(`Switched to Google Maps ${currentLayer.charAt(0).toUpperCase() + currentLayer.slice(1)}`);
    };
  }

  // 10. Setup Trips Screen (Create New Trip)
  const btnCreateTrip = document.getElementById('btn-create-new-trip');
  if (btnCreateTrip) {
    btnCreateTrip.onclick = () => {
      const tripName = window.prompt('Enter new trip name or destination (e.g. Western Ghats Monsoon Drive):', 'South India Coastal Tour');
      if (tripName && tripName.trim()) {
        const newId = `trip-${Date.now()}`;
        const freshTrip = {
          id: newId,
          title: tripName.trim(),
          origin: 'Starting City',
          destination: tripName.trim(),
          departureDate: new Date().toISOString().split('T')[0],
          departureTimeMinutes: 480,
          groupSize: 4,
          vehicleMileageKmPerLitre: 16,
          fuelPricePerLitre: 102.5,
          totalBudget: 25000
        };
        state.trips = [freshTrip, ...state.trips];
        state.activeTripId = newId;
        state.setStops(newId, []);
        refreshAppUI();
        switchTab('map');
        showToast(`Created new trip: ${freshTrip.title}`);
      }
    };
  }

  // 11. Setup More Screen (Segmented Tabs, Groq Key, Travel Profile, Theme)
  const btnMoreHistory = document.getElementById('btn-more-tab-history');
  const btnMoreSettings = document.getElementById('btn-more-tab-settings');
  const secMoreHistory = document.getElementById('more-section-history');
  const secMoreSettings = document.getElementById('more-section-settings');

  if (btnMoreHistory && btnMoreSettings) {
    btnMoreHistory.onclick = () => {
      btnMoreHistory.classList.add('active');
      btnMoreSettings.classList.remove('active');
      if (secMoreHistory) secMoreHistory.classList.remove('hidden');
      if (secMoreSettings) secMoreSettings.classList.add('hidden');
    };
    btnMoreSettings.onclick = () => {
      btnMoreSettings.classList.add('active');
      btnMoreHistory.classList.remove('active');
      if (secMoreSettings) secMoreSettings.classList.remove('hidden');
      if (secMoreHistory) secMoreHistory.classList.add('hidden');
    };
  }

  const btnHistoryNew = document.getElementById('btn-history-plan-new');
  if (btnHistoryNew) {
    btnHistoryNew.onclick = () => switchTab('itinerary');
  }

  const btnSaveGroq = document.getElementById('btn-save-groq-key');
  const inputGroq = document.getElementById('setting-groq-key-input');
  const badgeGroq = document.getElementById('groq-status-badge');
  if (inputGroq) {
    inputGroq.value = localStorage.getItem('tripweave_groq_api_key') || '';
    if (badgeGroq && inputGroq.value) {
      badgeGroq.textContent = 'Configured';
      badgeGroq.classList.remove('unconfigured');
      badgeGroq.classList.add('configured');
    }
  }
  if (btnSaveGroq && inputGroq) {
    btnSaveGroq.onclick = () => {
      const val = inputGroq.value.trim();
      localStorage.setItem('tripweave_groq_api_key', val);
      if (badgeGroq) {
        badgeGroq.textContent = val ? 'Configured' : 'No Key Set';
        badgeGroq.classList.toggle('configured', Boolean(val));
        badgeGroq.classList.toggle('unconfigured', !val);
      }
      showToast(val ? 'Groq AI key saved!' : 'Groq key cleared');
    };
  }

  // Vehicle Details (Integrated in Itinerary interface)
  const inMileage = document.getElementById('setting-mileage-input');
  const inFuel = document.getElementById('setting-fuel-price-input');
  const inVehicle = document.getElementById('setting-vehicle-input');

  const curTrip = state.getActiveTrip();
  if (curTrip) {
    if (inMileage && curTrip.vehicleMileageKmPerLitre) inMileage.value = curTrip.vehicleMileageKmPerLitre;
    if (inFuel && curTrip.fuelPricePerLitre) inFuel.value = curTrip.fuelPricePerLitre;
    if (inVehicle && curTrip.vehicleModel) inVehicle.value = curTrip.vehicleModel;
  }

  [inMileage, inFuel, inVehicle].forEach(inp => {
    if (inp) {
      inp.onchange = () => {
        const trip = state.getActiveTrip();
        if (trip) {
          if (inMileage) trip.vehicleMileageKmPerLitre = parseFloat(inMileage.value) || 16;
          if (inFuel) trip.fuelPricePerLitre = parseFloat(inFuel.value) || 102.8;
          if (inVehicle) trip.vehicleModel = inVehicle.value.trim() || 'Hyundai Creta Diesel';
          state.saveToStorage();
          refreshAppUI();
          showToast('Vehicle details updated');
        }
      };
    }
  });

  // Theme Toggle Button in More tab
  const btnThemeToggle = document.getElementById('theme-toggle-btn');
  if (btnThemeToggle) {
    btnThemeToggle.onclick = () => {
      const isDark = document.body.classList.toggle('theme-dark');
      document.body.classList.toggle('theme-light', !isDark);
      localStorage.setItem('tripweave_theme', isDark ? 'dark' : 'light');
      showToast(`Switched to ${isDark ? 'Dark' : 'Light'} theme`);
    };
  }

  // 12. Setup OTA Update Checker & Modal
  setupUpdateModal();
  setTimeout(() => {
    checkAppUpdates(false, (remote) => showUpdateModal(remote));
  }, 2500);

  const btnCheckUpdate = document.getElementById('btn-check-update');
  if (btnCheckUpdate) {
    btnCheckUpdate.onclick = () => {
      checkAppUpdates(
        true,
        (remote) => showUpdateModal(remote),
        (name) => showToast(`You are on the latest version (TripWeave v${name})`)
      );
    };
  }

  // 13. Initial UI Render
  refreshAppUI();
});
