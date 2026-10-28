// ==========================================================================
// TripWeave — Directions Drawer, Top Search & Highway Corridor UI Controller
// ==========================================================================

import { state } from '../state.js';
import { geocodePlace, calculateOSRMRoute, fetchRouteCorridorAmenities } from '../services/routing.service.js';
import { renderRoutePolyline, getSavedUserLocation } from '../services/map.service.js';
import { navigationEngine } from '../services/guidance.service.js';

const POPULAR_DESTINATIONS = [
  { name: 'Bangalore, Karnataka', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad, Telangana', lat: 17.3850, lng: 78.4867 },
  { name: 'Hampi, Karnataka', lat: 15.3350, lng: 76.4600 },
  { name: 'Coorg (Madikeri), Karnataka', lat: 12.4244, lng: 75.7382 },
  { name: 'Ooty, Tamil Nadu', lat: 11.4102, lng: 76.6950 },
  { name: 'Goa (Panaji)', lat: 15.4909, lng: 73.8278 },
  { name: 'Mysore, Karnataka', lat: 12.2958, lng: 76.6394 },
  { name: 'Munnar, Kerala', lat: 10.0889, lng: 77.0595 },
  { name: 'Wayanad, Kerala', lat: 11.6854, lng: 76.1320 },
  { name: 'Jaipur, Rajasthan', lat: 26.9124, lng: 75.7873 },
  { name: 'Udaipur, Rajasthan', lat: 24.5854, lng: 73.7125 },
  { name: 'Mumbai, Maharashtra', lat: 19.0760, lng: 72.8777 },
  { name: 'Pune, Maharashtra', lat: 18.5204, lng: 73.8567 },
  { name: 'Pondicherry', lat: 11.9416, lng: 79.8083 },
  { name: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  { name: 'Agra, Uttar Pradesh', lat: 27.1767, lng: 78.0081 },
  { name: 'Manali, Himachal Pradesh', lat: 32.2396, lng: 77.1887 }
];

export function setupDirectionsUI({ onRouteComputed = null, onAddAmenityStop = null, onToast = null }) {
  const dirBox = document.getElementById('map-directions-box');
  const searchWrap = document.getElementById('top-search-wrap');
  const searchBar = document.getElementById('map-search-bar') || document.querySelector('.map-search-bar');
  const btnToggleDir = document.getElementById('btn-toggle-directions');
  const btnBack = document.getElementById('btn-back-directions');
  const btnClose = document.getElementById('btn-close-directions');
  const btnSwap = document.getElementById('btn-swap-locations') || document.getElementById('btn-swap-directions');
  const btnUseLocation = document.getElementById('btn-use-my-location');
  const origInput = document.getElementById('dir-input-origin');
  const destInput = document.getElementById('dir-input-dest');
  const btnCalc = document.getElementById('btn-calculate-route') || document.getElementById('btn-calc-highway-route');

  const searchInput = document.getElementById('place-search-input');
  const searchDropdown = document.getElementById('search-suggestions-dropdown');

  const tray = document.getElementById('corridor-amenities-tray');
  const trayList = document.getElementById('corridor-amenities-list');
  const trayTabs = document.querySelectorAll('.corridor-tab');

  // Turn-by-Turn HUD Elements
  const navHudTop = document.getElementById('nav-hud-top');
  const navHudBottom = document.getElementById('nav-hud-bottom');
  const btnNavExit = document.getElementById('btn-nav-exit');
  const btnNavPrev = document.getElementById('btn-nav-prev-step');
  const btnNavNext = document.getElementById('btn-nav-next-step');
  const btnNavVoice = document.getElementById('btn-nav-voice');
  const btnNavSimulate = document.getElementById('btn-nav-simulate');
  const btnNavSimulateLabel = document.getElementById('btn-nav-simulate-label');
  const btnNavRecenter = document.getElementById('btn-nav-recenter');
  const navManeuverIcon = document.getElementById('nav-maneuver-icon');
  const navManeuverDist = document.getElementById('nav-maneuver-dist');
  const navManeuverInst = document.getElementById('nav-maneuver-instruction');
  const navManeuverStreet = document.getElementById('nav-maneuver-street');
  const navEta = document.getElementById('nav-bottom-eta');
  const navSub = document.getElementById('nav-bottom-sub');
  const navSpeedBadge = document.getElementById('nav-speed-badge');

  function openDirections(defaultOrigin = '', defaultDest = '') {
    if (!dirBox) return;

    // Automatically default origin to Current Location if empty
    if (defaultOrigin) {
      origInput.value = defaultOrigin;
    } else if (!origInput.value) {
      origInput.value = 'Current Location';
    }

    if (defaultDest) {
      destInput.value = defaultDest;
    }

    // Merge directly into top search spot: hide regular search bar, reveal route box
    if (searchBar) searchBar.classList.add('hidden');
    if (searchWrap) searchWrap.classList.add('directions-active');
    dirBox.classList.remove('hidden');

    if (!defaultDest && destInput) {
      destInput.focus();
    } else if (origInput) {
      origInput.focus();
    }

    // Toggle bottom card action to show cancel option while selecting directions
    const defaultActions = document.getElementById('trip-card-empty-actions-default');
    const selectingActions = document.getElementById('trip-card-empty-actions-selecting');
    if (defaultActions && selectingActions) {
      defaultActions.classList.add('hidden');
      selectingActions.classList.remove('hidden');
    }
  }

  function closeDirections() {
    if (dirBox) dirBox.classList.add('hidden');
    if (searchBar) searchBar.classList.remove('hidden');
    if (searchWrap) searchWrap.classList.remove('directions-active');
    if (searchDropdown) searchDropdown.classList.add('hidden');

    // Restore default buttons on bottom card
    const defaultActions = document.getElementById('trip-card-empty-actions-default');
    const selectingActions = document.getElementById('trip-card-empty-actions-selecting');
    if (defaultActions && selectingActions) {
      defaultActions.classList.remove('hidden');
      selectingActions.classList.add('hidden');
    }
  }

  function cancelDirectionsSelection() {
    if (destInput) destInput.value = '';
    closeDirections();
    if (typeof onToast === 'function') onToast('Route selection cancelled');
  }

  const btnCancelDirBox = document.getElementById('btn-cancel-directions-box');
  const btnCancelSelecting = document.getElementById('btn-cancel-selecting-route');
  if (btnCancelDirBox) {
    btnCancelDirBox.onclick = cancelDirectionsSelection;
  }
  if (btnCancelSelecting) {
    btnCancelSelecting.onclick = cancelDirectionsSelection;
  }

  function toggleDirections() {
    if (!dirBox) return;
    if (dirBox.classList.contains('hidden')) {
      openDirections();
    } else {
      closeDirections();
    }
  }

  if (btnToggleDir) {
    btnToggleDir.onclick = () => toggleDirections();
  }

  if (btnBack) {
    btnBack.onclick = () => closeDirections();
  }

  if (btnClose) {
    btnClose.onclick = () => closeDirections();
  }

  // Keyboard shortcut to close directions
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dirBox && !dirBox.classList.contains('hidden')) {
      closeDirections();
    }
  });

  if (btnSwap) {
    btnSwap.onclick = () => {
      const tmp = origInput.value;
      origInput.value = destInput.value;
      destInput.value = tmp;
    };
  }

  if (btnUseLocation) {
    btnUseLocation.onclick = () => {
      origInput.value = 'Current Location';
      if (typeof onToast === 'function') onToast('Using current GPS location as starting point');
    };
  }

  // 1. Search Bar Input & Dropdown Autocomplete
  let searchDebounceTimer = null;
  if (searchInput && searchDropdown) {
    searchInput.oninput = () => {
      clearTimeout(searchDebounceTimer);
      const query = searchInput.value.trim().toLowerCase();

      if (query.length < 2) {
        searchDropdown.classList.add('hidden');
        searchDropdown.innerHTML = '';
        return;
      }

      searchDebounceTimer = setTimeout(async () => {
        const matches = POPULAR_DESTINATIONS.filter(p => p.name.toLowerCase().includes(query)).slice(0, 5);

        if (matches.length > 0) {
          searchDropdown.innerHTML = matches.map(m => `
            <div class="search-dropdown-item" data-name="${m.name}" data-lat="${m.lat}" data-lng="${m.lng}">
              <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span>${m.name}</span>
            </div>
          `).join('');
          searchDropdown.classList.remove('hidden');

          searchDropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
            item.onclick = () => {
              const name = item.getAttribute('data-name');
              searchInput.value = name;
              searchDropdown.classList.add('hidden');
              openDirections('Current Location', name);
            };
          });
        } else {
          searchDropdown.classList.add('hidden');
        }
      }, 250);
    };

    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = searchInput.value.trim();
        if (val) {
          searchDropdown.classList.add('hidden');
          openDirections('Current Location', val);
        }
      }
    };

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.map-search-bar') && !e.target.closest('#search-suggestions-dropdown')) {
        searchDropdown.classList.add('hidden');
      }
    });
  }

  // 2. Compute Highway Route
  if (btnCalc) {
    btnCalc.onclick = async () => {
      const origVal = origInput.value.trim();
      const destVal = destInput.value.trim();

      if (!origVal || !destVal) {
        if (typeof onToast === 'function') onToast('Please enter both Starting Point and Destination');
        return;
      }

      const origBtnText = btnCalc.innerHTML;
      btnCalc.disabled = true;
      btnCalc.innerHTML = '<span>Calculating Route...</span>';

      if (typeof onToast === 'function') onToast(`Computing highway route to ${destVal}...`);

      let origCoords = null;
      if (origVal.toLowerCase() === 'current location') {
        const currentLoc = state.userLocation || getSavedUserLocation();
        if (currentLoc && typeof currentLoc.lat === 'number' && typeof currentLoc.lng === 'number') {
          origCoords = [currentLoc.lat, currentLoc.lng];
        } else {
          btnCalc.disabled = false;
          btnCalc.innerHTML = origBtnText;
          if (typeof onToast === 'function') onToast('Acquiring high-accuracy GPS... Please wait or enter your city.');
          return;
        }
      } else {
        const geo = await geocodePlace(origVal);
        if (geo) origCoords = [geo.lat, geo.lng];
      }

      const destGeo = await geocodePlace(destVal);
      if (!destGeo || !origCoords) {
        btnCalc.disabled = false;
        btnCalc.innerHTML = origBtnText;
        if (typeof onToast === 'function') onToast('Could not find places. Please check the spelling.');
        return;
      }

      try {
        const route = await calculateOSRMRoute(origCoords, [destGeo.lat, destGeo.lng]);
        if (route && route.polylineLatlngs) {
          state.activeRoute = route;
          renderRoutePolyline(route.polylineLatlngs);
          closeDirections();

          // 1. Immediately notify orchestrator with route stops so "Where are you traveling?" card hides INSTANTLY!
          if (typeof onRouteComputed === 'function') {
            onRouteComputed(origVal, destGeo.name, origCoords, [destGeo.lat, destGeo.lng], route, []);
          }

          if (typeof onToast === 'function') {
            onToast(`Found Route: ${Math.round(route.distanceKm)} km (${Math.round(route.durationMinutes / 60)} hrs drive)`);
          }

          // 2. Asynchronously fetch highway corridor stops and render horizontally when ready
          fetchRouteCorridorAmenities(route.polylineLatlngs).then(amenities => {
            state.corridorAmenities = amenities;
            renderCorridorAmenities('all');
          }).catch(err => {
            console.warn('Error fetching corridor amenities:', err);
          });
        } else {
          if (typeof onToast === 'function') onToast('No driving route found between these locations.');
        }
      } catch (err) {
        console.error('Routing error:', err);
        if (typeof onToast === 'function') onToast('Routing calculation error. Please try again.');
      } finally {
        btnCalc.disabled = false;
        btnCalc.innerHTML = origBtnText;
      }
    };
  }

  // 3. Render Highway Corridor Tray
  const btnCloseCorridorTray = document.getElementById('btn-close-corridor-tray');
  if (btnCloseCorridorTray) {
    btnCloseCorridorTray.onclick = () => {
      if (tray) tray.classList.add('hidden');
    };
  }

  function renderCorridorAmenities(category = 'all') {
    if (!tray || !trayList) return;
    const amenities = state.corridorAmenities || [];
    if (amenities.length === 0) {
      tray.classList.add('hidden');
      return;
    }

    tray.classList.remove('hidden');
    let filtered = amenities;
    if (category && category !== 'all') {
      filtered = amenities.filter(a => a.category === category);
    }

    trayList.innerHTML = filtered.map(item => `
      <div class="corridor-amenity-card">
        <div class="corridor-card-top">
          <div class="corridor-card-name">${item.name}</div>
          <span class="corridor-card-badge ${item.category}">${item.badgeText}</span>
        </div>
        <div class="corridor-card-desc">${item.description}</div>
        <div class="corridor-card-dist">${item.distText}</div>
        <div class="corridor-card-actions">
          <button class="btn-add-corridor-stop" data-id="${item.id}" type="button">+ Add Stop</button>
          <a href="${item.mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-view-corridor-map">Maps</a>
        </div>
      </div>
    `).join('');

    trayList.querySelectorAll('.btn-add-corridor-stop').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-id');
        const amenity = amenities.find(a => a.id === id);
        if (amenity && typeof onAddAmenityStop === 'function') {
          onAddAmenityStop(amenity);
        }
      };
    });
  }

  trayTabs.forEach(tab => {
    tab.onclick = () => {
      trayTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderCorridorAmenities(tab.getAttribute('data-ctab'));
    };
  });

  // 4. Turn-by-Turn HUD Handlers & Fullscreen Driving Mode
  function startTurnByTurn() {
    const route = state.activeRoute;
    if (!route || !route.polylineLatlngs || route.polylineLatlngs.length < 2) {
      if (typeof onToast === 'function') onToast('Please calculate a route first.');
      return;
    }

    document.body.classList.add('navigation-in-progress');

    // 1. Hide corridor amenities tray
    if (tray) tray.classList.add('hidden');

    // 2. Hide bottom trip sheet
    const peekSheet = document.getElementById('map-peek-sheet');
    if (peekSheet) peekSheet.classList.add('hidden');

    // 3. Hide bottom navigation bar
    const appNav = document.querySelector('.app-nav');
    if (appNav) appNav.classList.add('hidden');

    // 4. Hide top search bar
    if (searchWrap) searchWrap.classList.add('hidden');

    // 5. Reveal Turn-by-Turn HUD
    if (navHudTop) navHudTop.classList.remove('hidden');
    if (navHudBottom) navHudBottom.classList.remove('hidden');

    const trip = state.getActiveTrip();
    const destName = trip ? trip.destination : 'Destination';

    // Hook up Guidance Engine callbacks
    navigationEngine.onManeuverUpdate = (m) => {
      if (navManeuverDist) navManeuverDist.textContent = m.distanceText;
      if (navManeuverInst) navManeuverInst.textContent = m.instruction;
      if (navManeuverStreet) navManeuverStreet.textContent = m.streetName || 'Highway Corridor';
      if (navManeuverIcon && m.iconSvg) navManeuverIcon.innerHTML = m.iconSvg;
    };

    navigationEngine.onStatsUpdate = (s) => {
      if (navEta) navEta.textContent = s.etaText;
      if (navSub) navSub.textContent = `${s.remainingDistanceText} • ${s.arrivalClockText}`;
      if (navSpeedBadge) navSpeedBadge.textContent = `${s.speedKmh} km/h`;

      if (btnNavSimulateLabel) {
        btnNavSimulateLabel.textContent = s.isSimulating ? 'Pause Drive' : 'Simulate Drive';
      }
      if (btnNavSimulate) {
        btnNavSimulate.classList.toggle('active', s.isSimulating);
      }

      const voiceActiveSvg = btnNavVoice?.querySelector('.voice-active-svg');
      const voiceMutedSvg = btnNavVoice?.querySelector('.voice-muted-svg');
      if (voiceActiveSvg && voiceMutedSvg) {
        voiceActiveSvg.classList.toggle('hidden', s.isVoiceMuted);
        voiceMutedSvg.classList.toggle('hidden', !s.isVoiceMuted);
      }
    };

    navigationEngine.onArrival = () => {
      if (typeof onToast === 'function') onToast('Arrived at your destination!');
    };

    // Launch Navigation Engine
    navigationEngine.start(route, destName);

    if (typeof onToast === 'function') onToast('Turn-by-turn navigation active');
  }

  function exitTurnByTurn() {
    navigationEngine.stop();
    document.body.classList.remove('navigation-in-progress');

    // Hide Turn-by-Turn HUD
    if (navHudTop) navHudTop.classList.add('hidden');
    if (navHudBottom) navHudBottom.classList.add('hidden');

    // Restore bottom trip sheet
    const peekSheet = document.getElementById('map-peek-sheet');
    if (peekSheet) peekSheet.classList.remove('hidden');

    // Restore bottom navigation bar
    const appNav = document.querySelector('.app-nav');
    if (appNav) appNav.classList.remove('hidden');

    // Restore top search bar
    if (searchWrap) searchWrap.classList.remove('hidden');

    // Restore corridor tray if amenities were found
    if (state.corridorAmenities && state.corridorAmenities.length > 0 && tray) {
      tray.classList.remove('hidden');
    }

    // Restore route view bounds
    if (state.activeRoute && state.activeRoute.polylineLatlngs) {
      renderRoutePolyline(state.activeRoute.polylineLatlngs, { fitBounds: true });
    }

    if (typeof onToast === 'function') onToast('Navigation ended');
  }

  // HUD Control Button Wiring
  if (btnNavExit) btnNavExit.onclick = exitTurnByTurn;
  if (btnNavPrev) btnNavPrev.onclick = () => navigationEngine.stepPrev();
  if (btnNavNext) btnNavNext.onclick = () => navigationEngine.stepNext();
  if (btnNavVoice) btnNavVoice.onclick = () => navigationEngine.toggleVoiceMute();
  if (btnNavSimulate) btnNavSimulate.onclick = () => navigationEngine.toggleSimulation();
  if (btnNavRecenter) {
    btnNavRecenter.onclick = () => {
      if (navigationEngine.polyline && navigationEngine.polyline[navigationEngine.currentPolylineIndex]) {
        const pt = navigationEngine.polyline[navigationEngine.currentPolylineIndex];
        navigationEngine.centerCamera(pt[0], pt[1], true);
      }
    };
  }

  return {
    openDirections,
    closeDirections,
    toggleDirections,
    renderCorridorAmenities,
    startTurnByTurn,
    exitTurnByTurn
  };
}
