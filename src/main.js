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
  buildItemizedExpenses,
  FUEL_TYPES,
  VEHICLE_MODELS,
  VEHICLE_BRANDS,
  TRANSPORT_MODES,
  recommendBestVehicleForTrip
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
import {
  getAIHistoryPlans,
  deleteAIHistoryPlan,
  getAITransportRecommendation
} from './services/ai.service.js';
import { exportCurrentItineraryAsPdf } from './services/pdf.service.js';

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
  setupAddStopModal,
  setupPdfDownloadConfirmModal
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
    origin: '',
    destination: '',
    departureDate: new Date().toISOString().split('T')[0],
    departureTimeMinutes: 480,
    groupSize: 4,
    vehicleModel: '',
    vehicleMileageKmPerLitre: 0,
    fuelPricePerLitre: 0,
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
    budgetController.renderBudget(plan.budgetResult, plan.trip, plan.totalDistanceKm || 0);
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
  if (typeof syncVehicleDetailsCard === 'function') {
    syncVehicleDetailsCard(plan.trip, plan.totalDistanceKm || 0);
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
// Multi-Fuel Vehicle & Trip Cost-Saver Engine Controllers
// --------------------------------------------------------------------------

let selectedTransportMode = 'ALL';
let selectedBrand = 'All Brands';
let searchModelQuery = '';

function filterPresetSelectOptions(mode = null) {
  if (mode !== null) selectedTransportMode = mode;
  const presetSelect = document.getElementById('vehicle-quick-preset-select');
  const matchesBadge = document.getElementById('vehicle-model-matches-badge');
  if (!presetSelect) return;

  const currentVal = presetSelect.value;
  const q = (searchModelQuery || '').trim().toLowerCase();

  const filtered = VEHICLE_MODELS.filter(v => {
    // 1. Category / Transport mode
    if (selectedTransportMode !== 'ALL' && v.transportType !== selectedTransportMode) {
      return false;
    }
    // 2. Automaker / Brand
    if (selectedBrand && selectedBrand !== 'All Brands' && v.brand !== selectedBrand) {
      return false;
    }
    // 3. Search query
    if (q) {
      const matchName = v.name.toLowerCase().includes(q);
      const matchBrand = (v.brand || '').toLowerCase().includes(q);
      const matchFuel = (v.fuelType || '').toLowerCase().includes(q);
      if (!matchName && !matchBrand && !matchFuel) return false;
    }
    return true;
  });

  if (matchesBadge) {
    matchesBadge.textContent = `${filtered.length} Model${filtered.length === 1 ? '' : 's'} Available`;
  }

  presetSelect.innerHTML = `<option value="">-- Choose from ${filtered.length} Released Models --</option>`;

  if (filtered.length === 0) {
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.disabled = true;
    emptyOpt.textContent = 'No models match active filters (try All Brands or clear search)';
    presetSelect.appendChild(emptyOpt);
    return;
  }

  // Group by Brand
  const groups = {};
  filtered.forEach(v => {
    const grp = v.brand ? `${v.brand}` : `${v.fuelType} Models`;
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(v);
  });

  Object.entries(groups).forEach(([grpName, models]) => {
    const optGroup = document.createElement('optgroup');
    optGroup.label = grpName;
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.dataset.fuel = m.fuelType;
      opt.dataset.mileage = m.mileage;
      opt.dataset.price = m.price;
      const unit = m.fuelType === 'EV' ? 'km/kWh' : (m.fuelType === 'CNG' ? 'km/kg' : 'km/L');
      opt.textContent = `${m.name} — ${m.mileage} ${unit} @ ₹${m.price}`;
      if (m.name === currentVal) opt.selected = true;
      optGroup.appendChild(opt);
    });
    presetSelect.appendChild(optGroup);
  });
}

function applyVehicle(v) {
  const trip = state.getActiveTrip();
  if (!trip) return;
  trip.vehicleModel = v.name;
  trip.fuelType = v.fuelType;
  trip.vehicleMileageKmPerLitre = v.mileage;
  trip.fuelPricePerLitre = v.price;
  state.saveToStorage();
  refreshAppUI();
  showToast(`Switched vehicle to ${v.name}`);
}

async function runAITransportRecommendation() {
  const plan = computeActivePlan();
  const trip = plan.trip;
  const dist = plan.totalDistanceKm || 0;
  const members = trip.groupSize || 2;

  const contentEl = document.getElementById('ai-transport-guide-content');
  const sourceEl = document.getElementById('ai-transport-guide-source');
  const btnAnalyze = document.getElementById('btn-analyze-transport-ai');
  const btnLabel = document.getElementById('btn-analyze-transport-ai-label');

  // Continuity check: User must enter their trip inputs (route / stops) and vehicle first
  const aiOriginInput = document.getElementById('ai-chat-origin');
  const aiDestInput = document.getElementById('ai-chat-dest');
  const origName = (trip.origin && trip.origin !== 'Starting City') ? trip.origin : (aiOriginInput?.value.trim() || '');
  const destName = (trip.destination && trip.destination !== 'Destination') ? trip.destination : (aiDestInput?.value.trim() || '');

  if (!origName || !destName) {
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="padding: 10px 12px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; color: var(--on-surface);">
          <div style="font-weight: 700; color: var(--error); margin-bottom: 3px;">Trip inputs required first:</div>
          <div>Please provide your <strong>Starting City</strong> and <strong>Destination</strong> (in the planner above or via map search) so we can analyze the route corridor before recommending vehicles.</div>
        </div>
      `;
    }
    showToast('Please enter your trip route and vehicle details first');
    if (aiOriginInput && !origName) aiOriginInput.focus();
    else if (aiDestInput && !destName) aiDestInput.focus();
    return;
  }

  if (!trip.vehicleModel) {
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="padding: 10px 12px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; color: var(--on-surface);">
          <div style="font-weight: 700; color: #d97706; margin-bottom: 3px;">Vehicle specifications needed:</div>
          <div>Please select or type your active vehicle model above first.</div>
        </div>
      `;
    }
    showToast('Please select or specify your current vehicle first');
    return;
  }

  if (btnAnalyze) btnAnalyze.disabled = true;
  if (btnLabel) btnLabel.textContent = 'Analyzing...';
  if (contentEl) {
    contentEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: var(--primary); font-weight: 600;">
        <span class="spinner" style="width: 14px; height: 14px; border: 2px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
        <span>Calling Groq AI API &amp; route telemetry for ${selectedTransportMode} guide (${origName} → ${destName})...</span>
      </div>
    `;
  }

  try {
    const effectiveDistance = dist > 0 ? dist : 350;
    const rec = await getAITransportRecommendation({
      origin: origName,
      destination: destName,
      distanceKm: effectiveDistance,
      members,
      currentTrip: trip,
      preferredMode: selectedTransportMode
    });

    if (sourceEl) {
      sourceEl.textContent = `${rec.source} • ${Math.round(rec.distanceKm)} km • ${rec.members} travelers`;
    }

    if (contentEl) {
      contentEl.innerHTML = `
        <div style="padding: 10px 12px; background: var(--surface); border: 1px solid var(--outline-variant); border-radius: 12px; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <strong style="font-size: 13px; color: var(--on-surface);">${rec.headline || 'Optimal Highway Recommendation'}</strong>
            <span class="chip-active-vehicle" style="font-size: 10.5px; padding: 2px 8px;">Est. Energy: ₹${(rec.estimatedTripCost || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="font-size: 11.5px; color: var(--primary); font-weight: 700;">
            Recommended: ${rec.recommendedVehicle} (${rec.recommendedFuel}) • ~${rec.estimatedMileage} ${rec.mileageUnit || 'km/L'}
          </div>
          <p style="margin: 0; font-size: 11.5px; color: var(--on-surface-variant); line-height: 1.45;">
            ${rec.whyBestChoice}
          </p>
          <div style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--outline-variant); display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
            <div><strong>Corridor Terrain:</strong> ${rec.terrainAnalysis}</div>
            <div style="color: #047857;"><strong>Safety &amp; Driver Guide:</strong> ${rec.safetyAdvisory}</div>
            <div style="color: #2563eb;"><strong>Efficiency Tip:</strong> ${rec.energyEfficiencyTip}</div>
          </div>
          <div style="margin-top: 6px; display: flex; gap: 8px;">
            <button type="button" class="btn-primary" id="btn-apply-ai-rec-vehicle" style="padding: 6px 14px; font-size: 11.5px; font-weight: 700; border-radius: var(--radius-pill);">
              Apply ${rec.recommendedVehicle.split(' ')[0]} ${rec.recommendedVehicle.split(' ')[1] || ''}
            </button>
          </div>
        </div>
      `;

      const btnApplyAi = document.getElementById('btn-apply-ai-rec-vehicle');
      if (btnApplyAi) {
        btnApplyAi.onclick = () => {
          const match = VEHICLE_MODELS.find(m => m.name.toLowerCase().includes(rec.recommendedVehicle.toLowerCase())) || {
            name: rec.recommendedVehicle,
            fuelType: rec.recommendedFuel || 'DIESEL',
            mileage: rec.estimatedMileage || 18,
            price: (FUEL_TYPES[rec.recommendedFuel] || FUEL_TYPES.DIESEL).defaultPrice
          };
          applyVehicle(match);
        };
      }
    }
  } catch (err) {
    if (contentEl) {
      contentEl.innerHTML = `<span style="color: var(--error);">Error generating recommendation. Please check your network or Groq API key in More tab.</span>`;
    }
  } finally {
    if (btnAnalyze) btnAnalyze.disabled = false;
    if (btnLabel) btnLabel.textContent = 'Analyze via API';
  }
}

function syncVehicleDetailsCard(trip, distanceKm = 0) {
  if (!trip) return;
  const inMileage = document.getElementById('setting-mileage-input');
  const inFuel = document.getElementById('setting-fuel-price-input');
  const inVehicle = document.getElementById('setting-vehicle-input');
  const labelMileage = document.getElementById('label-setting-mileage');
  const labelFuel = document.getElementById('label-setting-fuel-price');
  const badgeActiveFuel = document.getElementById('badge-active-fuel-type');
  const presetSelect = document.getElementById('vehicle-quick-preset-select');

  const fuelType = (trip.fuelType || 'DIESEL').toUpperCase();
  const fuelSpec = FUEL_TYPES[fuelType] || FUEL_TYPES.PETROL;

  if (badgeActiveFuel) {
    const curEff = trip.vehicleMileageKmPerLitre || fuelSpec.defaultMileage;
    badgeActiveFuel.textContent = `${fuelSpec.shortName} • ${curEff} ${fuelSpec.mileageUnit.replace(/\s+/g, '')}`;
  }

  // Highlight active fuel pill
  const pills = document.querySelectorAll('#fuel-type-pills .fuel-pill');
  pills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.fuel === fuelType);
  });

  // Highlight active transport mode chip
  const modeChips = document.querySelectorAll('#transport-mode-chips .transport-mode-chip');
  modeChips.forEach(chip => {
    const isActive = chip.dataset.mode === selectedTransportMode;
    chip.classList.toggle('active', isActive);
    chip.style.background = isActive ? 'var(--surface-container-high)' : 'var(--surface-container-low)';
    chip.style.color = isActive ? 'var(--on-surface)' : 'var(--on-surface-variant)';
  });

  const modeHint = document.getElementById('transport-mode-guide-hint');
  if (modeHint) {
    const modeName = TRANSPORT_MODES[selectedTransportMode]?.name || 'All Modes';
    modeHint.textContent = `${modeName} Active`;
  }

  if (labelMileage) labelMileage.textContent = `Efficiency (${fuelSpec.mileageUnit})`;
  if (labelFuel) labelFuel.textContent = `Fuel Price (${fuelSpec.priceUnit})`;

  if (inMileage && trip.vehicleMileageKmPerLitre && document.activeElement !== inMileage) {
    inMileage.value = trip.vehicleMileageKmPerLitre;
  }
  if (inFuel && trip.fuelPricePerLitre && document.activeElement !== inFuel) {
    inFuel.value = trip.fuelPricePerLitre;
  }
  if (inVehicle && trip.vehicleModel && document.activeElement !== inVehicle) {
    inVehicle.value = trip.vehicleModel;
  }

  if (presetSelect && trip.vehicleModel) {
    const matchingOpt = Array.from(presetSelect.options).find(opt => opt.value === trip.vehicleModel);
    if (matchingOpt) presetSelect.value = trip.vehicleModel;
  }

  // Update Best Vehicle / Cost Saver Recommendation filtered by user's transport mode wish
  const costSaverBox = document.getElementById('vehicle-cost-saver-box');
  const costSaverDesc = document.getElementById('cost-saver-desc');
  const costSaverTag = document.getElementById('cost-saver-tag');
  const btnApplyCostSaver = document.getElementById('btn-apply-cost-saver');
  const btnApplyLabel = document.getElementById('btn-apply-cost-saver-label');

  // Continuity requirement:
  // User must provide trip inputs (origin & destination or stops) and vehicle specifications first.
  // Before trip inputs are given, hide the recommendations card completely.
  const hasTripRoute = Boolean(
    (trip.origin && trip.destination && trip.origin !== 'Starting City' && trip.destination !== 'Destination') ||
    (state.activeRoute && state.activeRoute.distanceKm > 0) ||
    (state.getActiveStops() && state.getActiveStops().length >= 2) ||
    distanceKm > 0
  );

  const hasVehicleSpecs = Boolean(
    trip.vehicleModel &&
    trip.vehicleMileageKmPerLitre > 0 &&
    trip.fuelPricePerLitre > 0
  );

  if (costSaverBox) {
    if (!hasTripRoute || !hasVehicleSpecs) {
      // Keep hidden until user provides trip inputs and vehicle details
      costSaverBox.style.display = 'none';
    } else {
      costSaverBox.style.display = 'flex';
      const rec = recommendBestVehicleForTrip(distanceKm, trip, selectedTransportMode);
      const isCurrentBest = rec.bestVehicle.name === trip.vehicleModel || rec.bestVehicle.savings <= 15;

      if (!isCurrentBest && rec.bestVehicle.savings > 15) {
        costSaverTag.textContent = `Save ₹${rec.bestVehicle.savings.toLocaleString('en-IN')}`;
        costSaverDesc.innerHTML = `<strong>Top recommendation for this ${Math.round(rec.effectiveDistance)} km trip:</strong> Switching to <strong>${rec.bestVehicle.name}</strong> (${rec.bestVehicle.fuelType}) will cost only ~<strong>₹${rec.bestVehicle.tripCost.toLocaleString('en-IN')}</strong> in energy, saving <strong>₹${rec.bestVehicle.savings.toLocaleString('en-IN')}</strong> compared to your current vehicle!`;
        if (btnApplyCostSaver && btnApplyLabel) {
          btnApplyCostSaver.style.display = 'inline-flex';
          btnApplyLabel.textContent = `Switch to ${rec.bestVehicle.name}`;
          btnApplyCostSaver.onclick = () => applyVehicle(rec.bestVehicle);
        }
      } else if (rec.bestNonEv && rec.bestNonEv.name !== trip.vehicleModel && rec.bestNonEv.savings > 15) {
        costSaverTag.textContent = `Save ₹${rec.bestNonEv.savings.toLocaleString('en-IN')}`;
        costSaverDesc.innerHTML = `<strong>Alternate option:</strong> <strong>${rec.bestNonEv.name}</strong> (${rec.bestNonEv.fuelType}) will cost ~<strong>₹${rec.bestNonEv.tripCost.toLocaleString('en-IN')}</strong> for this ${Math.round(rec.effectiveDistance)} km trip.`;
        if (btnApplyCostSaver && btnApplyLabel) {
          btnApplyCostSaver.style.display = 'inline-flex';
          btnApplyLabel.textContent = `Switch to ${rec.bestNonEv.name}`;
          btnApplyCostSaver.onclick = () => applyVehicle(rec.bestNonEv);
        }
      } else {
        costSaverTag.textContent = 'Optimized';
        costSaverDesc.textContent = `Your vehicle (${trip.vehicleModel || 'Active vehicle'}) is already highly optimized for low-cost road tripping! (Estimated trip fuel/energy: ₹${rec.currentCost.toLocaleString('en-IN')}).`;
        if (btnApplyCostSaver) {
          btnApplyCostSaver.style.display = 'none';
        }
      }
    }
  }
}

function setupVehicleControls() {
  const inMileage = document.getElementById('setting-mileage-input');
  const inFuel = document.getElementById('setting-fuel-price-input');
  const inVehicle = document.getElementById('setting-vehicle-input');
  const presetSelect = document.getElementById('vehicle-quick-preset-select');
  const brandSelect = document.getElementById('vehicle-brand-filter-select');
  const searchInput = document.getElementById('vehicle-model-search-filter');
  const btnClearSearch = document.getElementById('btn-clear-vehicle-search');
  const fuelPills = document.querySelectorAll('#fuel-type-pills .fuel-pill');
  const modeChips = document.querySelectorAll('#transport-mode-chips .transport-mode-chip');
  const btnAnalyzeTransport = document.getElementById('btn-analyze-transport-ai');
  const datalist = document.getElementById('all-vehicles-datalist');

  // Populate datalist for instant autocomplete across all 160+ world models
  if (datalist && datalist.children.length === 0) {
    datalist.innerHTML = VEHICLE_MODELS.map(v => `<option value="${v.name}"></option>`).join('');
  }

  // Populate global automaker / brand filter dropdown
  if (brandSelect && brandSelect.options.length <= 1) {
    brandSelect.innerHTML = VEHICLE_BRANDS.map(b => `<option value="${b}">${b === 'All Brands' ? 'All Global Brands (40+)' : b}</option>`).join('');
    brandSelect.value = selectedBrand;
    brandSelect.onchange = () => {
      selectedBrand = brandSelect.value || 'All Brands';
      filterPresetSelectOptions();
    };
  }

  // Model quick search input & clear button
  if (searchInput) {
    searchInput.oninput = () => {
      searchModelQuery = searchInput.value || '';
      if (btnClearSearch) {
        btnClearSearch.style.display = searchModelQuery ? 'flex' : 'none';
      }
      filterPresetSelectOptions();
    };
  }

  if (btnClearSearch && searchInput) {
    btnClearSearch.onclick = () => {
      searchInput.value = '';
      searchModelQuery = '';
      btnClearSearch.style.display = 'none';
      filterPresetSelectOptions();
      searchInput.focus();
    };
  }

  // Initial population of models dropdown
  filterPresetSelectOptions();

  // Transport mode chips (User's Wish: Bike, Car, SUV, EV)
  modeChips.forEach(chip => {
    chip.onclick = () => {
      selectedTransportMode = chip.dataset.mode || 'ALL';
      filterPresetSelectOptions(selectedTransportMode);
      const plan = computeActivePlan();
      syncVehicleDetailsCard(plan.trip, plan.totalDistanceKm || 0);
      showToast(`Filtered for ${TRANSPORT_MODES[selectedTransportMode]?.name || 'all vehicles'}`);
    };
  });

  // Multi-fuel pills
  fuelPills.forEach(pill => {
    pill.onclick = () => {
      const fuelType = pill.dataset.fuel;
      const fuelSpec = FUEL_TYPES[fuelType];
      if (!fuelSpec) return;

      const trip = state.getActiveTrip();
      if (!trip) return;

      trip.fuelType = fuelType;
      trip.vehicleMileageKmPerLitre = fuelSpec.defaultMileage;
      trip.fuelPricePerLitre = fuelSpec.defaultPrice;

      // Find first default model for this fuel matching mode & brand if possible
      const defaultModel = VEHICLE_MODELS.find(v => {
        if (selectedTransportMode !== 'ALL' && v.transportType !== selectedTransportMode) return false;
        if (selectedBrand !== 'All Brands' && v.brand !== selectedBrand) return false;
        return v.fuelType === fuelType;
      }) || VEHICLE_MODELS.find(v => v.fuelType === fuelType);

      if (defaultModel) {
        trip.vehicleModel = defaultModel.name;
      }

      state.saveToStorage();
      refreshAppUI();
      showToast(`Switched to ${fuelSpec.name}`);
    };
  });

  // Vehicle model quick preset dropdown
  if (presetSelect) {
    presetSelect.onchange = () => {
      const selectedModelName = presetSelect.value;
      if (!selectedModelName) return;
      const v = VEHICLE_MODELS.find(m => m.name === selectedModelName);
      if (v) {
        applyVehicle(v);
      }
    };
  }

  // API Transport Recommendation Button
  if (btnAnalyzeTransport) {
    btnAnalyzeTransport.onclick = () => {
      runAITransportRecommendation();
    };
  }

  // Manual inputs with auto-recognition for global cars & bikes
  [inMileage, inFuel].forEach(inp => {
    if (inp) {
      inp.onchange = () => {
        const trip = state.getActiveTrip();
        if (trip) {
          if (inMileage) trip.vehicleMileageKmPerLitre = parseFloat(inMileage.value) || 16;
          if (inFuel) trip.fuelPricePerLitre = parseFloat(inFuel.value) || 102.8;
          state.saveToStorage();
          refreshAppUI();
          showToast('Vehicle specifications updated');
        }
      };
    }
  });

  if (inVehicle) {
    inVehicle.onchange = () => {
      const trip = state.getActiveTrip();
      if (!trip) return;
      const enteredName = inVehicle.value.trim();
      trip.vehicleModel = enteredName || 'Hyundai Creta 1.5 CRDi Diesel (2024)';

      // Auto-detect if user typed a known car/bike from our global database
      const matched = VEHICLE_MODELS.find(m => m.name.toLowerCase() === enteredName.toLowerCase()) ||
                      VEHICLE_MODELS.find(m => enteredName.toLowerCase().includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(enteredName.toLowerCase()));

      if (matched) {
        trip.fuelType = matched.fuelType;
        trip.vehicleMileageKmPerLitre = matched.mileage;
        trip.fuelPricePerLitre = matched.price;
        if (inMileage) inMileage.value = matched.mileage;
        if (inFuel) inFuel.value = matched.price;
      }

      state.saveToStorage();
      refreshAppUI();
      showToast('Vehicle model updated');
    };
  }
}

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
  window.__exportItineraryPdf = exportCurrentItineraryAsPdf;

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
      if (window.__switchTab) window.__switchTab('map');
    },
    onDownloadPdf: (plan) => {
      downloadPlanPdf(plan);
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

  // Itinerary Screen Sub-Section Switcher (Timeline, Vehicle, Budget)
  const itinSubButtons = document.querySelectorAll('.itinerary-seg-btn');
  const itinSections = {
    timeline: document.getElementById('itin-section-timeline'),
    vehicle: document.getElementById('itin-section-vehicle'),
    budget: document.getElementById('itin-section-budget')
  };

  function switchItinerarySection(sectionId) {
    itinSubButtons.forEach(btn => {
      const match = btn.dataset.itinSection === sectionId;
      btn.classList.toggle('active', match);
    });

    Object.entries(itinSections).forEach(([id, el]) => {
      if (el) {
        el.classList.toggle('hidden', id !== sectionId);
      }
    });

    // Refresh vehicle or budget if switching into them
    const plan = computeActivePlan();
    if (plan && sectionId === 'vehicle' && typeof syncVehicleDetailsCard === 'function') {
      syncVehicleDetailsCard(plan.trip, plan.totalDistanceKm || 0);
    } else if (plan && sectionId === 'budget' && budgetController) {
      budgetController.renderBudget(plan.budgetResult, plan.trip, plan.totalDistanceKm || 0);
    }
  }

  itinSubButtons.forEach(btn => {
    btn.onclick = () => {
      const sectionId = btn.dataset.itinSection || 'timeline';
      switchItinerarySection(sectionId);
    };
  });

  // 7. Setup Budget UI (Percentage Split & Inconvenience-Free Allocation)
  budgetController = setupBudgetUI({
    onScenarioChanged: () => refreshAppUI(),
    onBudgetUpdated: () => refreshAppUI()
  });

  // 8. Setup Share Modal
  shareModalController = setupShareModal(computeActivePlan);

  const btnShareItin = document.getElementById('btn-share-itinerary');
  if (btnShareItin) {
    btnShareItin.onclick = () => {
      if (shareModalController) shareModalController.openModal();
    };
  }

  function getExportablePlan() {
    const plan = computeActivePlan();
    if (!plan || !plan.stops || plan.stops.length === 0) {
      return null;
    }
    return {
      title: (plan.trip && plan.trip.title) ? plan.trip.title : `${plan.stops[0].name} to ${plan.stops[plan.stops.length - 1].name} Road Trip`,
      origin: plan.stops[0].name,
      destination: plan.stops[plan.stops.length - 1].name,
      stops: plan.stops,
      totalDistanceKm: plan.totalDistanceKm || 0,
      totalDrivingHours: plan.totalDurationHours || (plan.totalDistanceKm ? plan.totalDistanceKm / 55 : 0),
      members: (plan.trip && plan.trip.groupSize) ? plan.trip.groupSize : 4,
      comfort: (plan.trip && plan.trip.comfort) ? plan.trip.comfort : 'comfort',
      dining: (plan.trip && plan.trip.dining) ? plan.trip.dining : 'family',
      expenses: plan.expenses || []
    };
  }

  async function downloadPlanPdf(plan) {
    const target = plan || getExportablePlan();
    if (!target || !target.stops || target.stops.length === 0) {
      showToast('Your itinerary is empty. Please add stops before exporting.');
      return;
    }
    showToast('Compiling verified Travel Dossier PDF...');
    try {
      await exportCurrentItineraryAsPdf(target);
      showToast('Travel Dossier PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Failed to export PDF dossier.');
    }
  }

  // Tour & PDF Dossier History Modal Controller
  const modalPdfHistory = document.getElementById('modal-tour-pdf-history');
  const btnClosePdfHistory = document.getElementById('modal-pdf-history-close-btn');
  const pdfHistoryContainer = document.getElementById('pdf-history-list-container');
  const btnItineraryPdfHistory = document.getElementById('btn-itinerary-pdf-history');

  function renderPdfHistoryModal() {
    if (!pdfHistoryContainer) return;
    const history = getAIHistoryPlans();

    if (!history || history.length === 0) {
      pdfHistoryContainer.innerHTML = `
        <div style="padding: 40px 16px; text-align: center; color: var(--on-surface-variant); background: var(--surface-container-low); border: 1px dashed var(--outline-variant); border-radius: 16px;">
          <div style="display: flex; justify-content: center; margin-bottom: 10px; color: var(--on-surface-variant);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width: 36px; height: 36px;">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div style="font-weight: 800; font-size: 14.5px; color: var(--on-surface);">No Tour Dossiers Saved Yet</div>
          <p style="font-size: 12px; margin: 6px 0 0 0; line-height: 1.45;">Fill out the itinerary planner with your starting city &amp; destination to generate tour plans and download verified PDFs.</p>
        </div>
      `;
      return;
    }

    pdfHistoryContainer.innerHTML = history.map(plan => {
      const savedDate = plan.savedAt ? new Date(plan.savedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Verified Plan';
      return `
        <div class="pdf-history-item-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
            <div style="flex: 1; min-width: 0;">
              <strong class="pdf-history-title">
                ${plan.title || `${plan.origin} to ${plan.destination}`}
              </strong>
              <div class="pdf-history-sub">
                ${plan.origin} → ${plan.destination} • ${savedDate}
              </div>
            </div>
            <button class="pdf-history-delete-btn" onclick="window.removePdfHistoryItem('${plan.id}')" title="Delete from history">
              Delete
            </button>
          </div>

          <div class="pdf-history-stats-pill">
            <span class="stat-dist">${plan.totalDistanceKm || 0} km</span> •
            <span>~${plan.totalDrivingHours || 0}h drive</span> •
            <span>${(plan.stops || []).length} stops</span> •
            <span class="stat-cost">₹${(plan.totalCost || 0).toLocaleString('en-IN')}</span>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 2px;">
            <button class="btn-history-view" onclick="window.openPdfHistoryInApp('${plan.id}')">
              <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
              <span>View in App</span>
            </button>
            <button class="btn-history-download" onclick="window.downloadPdfHistoryItem('${plan.id}')">
              <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.openPdfHistoryInApp = (id) => {
    window.loadAIHistoryPlan(id);
    if (modalPdfHistory) modalPdfHistory.classList.add('hidden');
    if (window.__switchTab) window.__switchTab('map');
  };

  window.downloadPdfHistoryItem = async (id) => {
    const history = getAIHistoryPlans();
    const plan = history.find(p => p.id === id);
    if (!plan) return;
    if (modalPdfHistory) modalPdfHistory.classList.add('hidden');
    downloadPlanPdf(plan);
  };

  window.removePdfHistoryItem = (id) => {
    deleteAIHistoryPlan(id);
    renderPdfHistoryModal();
    showToast('Removed from history');
  };

  if (btnItineraryPdfHistory) {
    btnItineraryPdfHistory.onclick = () => {
      renderPdfHistoryModal();
      if (modalPdfHistory) modalPdfHistory.classList.remove('hidden');
    };
  }

  if (btnClosePdfHistory) {
    btnClosePdfHistory.onclick = () => {
      if (modalPdfHistory) modalPdfHistory.classList.add('hidden');
    };
  }

  if (modalPdfHistory) {
    modalPdfHistory.onclick = (e) => {
      if (e.target === modalPdfHistory) modalPdfHistory.classList.add('hidden');
    };
  }

  window.__exportItineraryPdf = (plan) => {
    downloadPlanPdf(plan);
  };


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
      const tripName = window.prompt('Enter new trip name or destination (e.g. Western Ghats Monsoon Drive):', '');
      if (tripName && tripName.trim()) {
        const newId = `trip-${Date.now()}`;
        const freshTrip = {
          id: newId,
          title: tripName.trim(),
          origin: '',
          destination: tripName.trim(),
          departureDate: new Date().toISOString().split('T')[0],
          departureTimeMinutes: 480,
          groupSize: 4,
          vehicleMileageKmPerLitre: 0,
          fuelPricePerLitre: 0,
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

  // Vehicle & Multi-Fuel Engine Controls (Integrated in Itinerary interface)
  setupVehicleControls();

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
    checkAppUpdates(false, (remote, isLatest) => showUpdateModal(remote, isLatest));
  }, 2500);

  const btnCheckUpdate = document.getElementById('btn-check-update');
  if (btnCheckUpdate) {
    btnCheckUpdate.onclick = () => {
      showToast('Checking for in-app updates...');
      checkAppUpdates(
        true,
        (remote, isLatest) => showUpdateModal(remote, isLatest),
        (name) => showToast(`You are on the latest version (TripWeave v${name})`)
      );
    };
  }

  // 13. Setup Vehicle Multi-Fuel Controls
  setupVehicleControls();

  // 14. Initial UI Render
  refreshAppUI();
});
