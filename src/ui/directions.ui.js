// ==========================================================================
// TripWeave — Directions Drawer, Top Search & Highway Corridor UI Controller
// ==========================================================================

import { state } from '../state.js';
import { geocodePlace, calculateOSRMRoute, fetchRouteCorridorAmenities } from '../services/routing.service.js';
import { renderRoutePolyline, getSavedUserLocation, highlightSearchPlace, clearSearchPlaceMarker } from '../services/map.service.js';
import { navigationEngine, calculateMeters, formatDistance } from '../services/guidance.service.js';
import { fetchPlacePhoto } from '../services/photo.service.js';
import { searchPlacesIndia, CURATED_INDIAN_DESTINATIONS } from '../services/search.service.js';

const POPULAR_DESTINATIONS = CURATED_INDIAN_DESTINATIONS;


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

  // Google Maps Style Place & Monument Preview Card Elements
  const placePreviewCard = document.getElementById('map-place-preview-card');
  const placePreviewImgBox = document.getElementById('place-preview-img-box');
  const placePreviewImg = document.getElementById('place-preview-image');
  const placePreviewBadge = document.getElementById('place-preview-badge');
  const placePreviewInlineBadge = document.getElementById('place-preview-inline-badge');
  const placePreviewName = document.getElementById('place-preview-name');
  const placePreviewDesc = document.getElementById('place-preview-desc');
  const btnClosePlacePreview = document.getElementById('btn-close-place-preview');
  const btnPlaceDirections = document.getElementById('btn-place-get-directions');
  const btnPlaceAddItinerary = document.getElementById('btn-place-add-itinerary');

  let activePreviewPlace = null;

  async function showPlacePreview(placeName, lat, lng, type = 'destination', distanceText = '') {
    if (!placePreviewCard) return;

    activePreviewPlace = { name: placeName, lat, lng, type };

    const badgeLabel = type === 'monument' ? 'Historic Monument' : type === 'temple' ? 'Sacred Shrine' : type === 'nature' ? 'Scenic Nature' : 'Travel Destination';
    if (placePreviewName) placePreviewName.textContent = placeName;
    if (placePreviewBadge) placePreviewBadge.textContent = badgeLabel;
    if (placePreviewInlineBadge) placePreviewInlineBadge.textContent = badgeLabel;

    // Drop Google Maps search pin & zoom into area
    highlightSearchPlace(lat, lng, placeName);
    placePreviewCard.classList.remove('hidden');

    // Hide colliding FAB buttons (Locate Me, Map Layers) while place search card is visible
    const screenMap = document.getElementById('screen-map');
    if (screenMap) screenMap.classList.add('place-preview-active');
    document.body.classList.add('place-preview-active');

    // Fetch ONLY authentic, real photography
    try {
      const photo = await fetchPlacePhoto(placeName);
      if (photo && photo.fullUrl && activePreviewPlace && activePreviewPlace.name === placeName) {
        // Authentic photo confirmed
        placePreviewCard.classList.remove('no-photo');
        if (placePreviewImgBox) placePreviewImgBox.classList.remove('hidden');
        if (placePreviewImg) {
          placePreviewImg.src = photo.fullUrl || photo.thumbUrl;
          placePreviewImg.alt = `${placeName} view`;
        }
        if (placePreviewDesc) {
          const prefix = distanceText ? `${distanceText} • ` : '';
          placePreviewDesc.textContent = `${prefix}${photo.description || 'Verified location in India.'}`;
        }
      } else if (activePreviewPlace && activePreviewPlace.name === placeName) {
        // No authentic photo: remove image container completely; DO NOT apply random photos!
        placePreviewCard.classList.add('no-photo');
        if (placePreviewImgBox) placePreviewImgBox.classList.add('hidden');
        if (placePreviewImg) placePreviewImg.src = '';
        if (placePreviewDesc) {
          placePreviewDesc.textContent = distanceText ? `${distanceText} • ${placeName}, India` : `${placeName}, India`;
        }
      }
    } catch (e) {
      placePreviewCard.classList.add('no-photo');
      if (placePreviewImgBox) placePreviewImgBox.classList.add('hidden');
      if (placePreviewImg) placePreviewImg.src = '';
    }
  }

  function hidePlacePreview() {
    if (placePreviewCard) {
      placePreviewCard.classList.add('hidden');
      placePreviewCard.classList.remove('no-photo');
    }
    if (placePreviewImgBox) placePreviewImgBox.classList.remove('hidden');
    if (placePreviewImg) placePreviewImg.src = '';
    clearSearchPlaceMarker();
    activePreviewPlace = null;
    const screenMap = document.getElementById('screen-map');
    if (screenMap) screenMap.classList.remove('place-preview-active');
    document.body.classList.remove('place-preview-active');
  }

  if (btnClosePlacePreview) {
    btnClosePlacePreview.onclick = () => hidePlacePreview();
  }

  if (btnPlaceDirections) {
    btnPlaceDirections.onclick = () => {
      if (!activePreviewPlace) return;
      const target = activePreviewPlace.name;
      hidePlacePreview();
      openDirections('Current Location', target);
      // Automatically calculate route for instantaneous response!
      setTimeout(() => {
        if (btnCalc && !btnCalc.disabled) {
          btnCalc.click();
        }
      }, 80);
    };
  }

  if (btnPlaceAddItinerary) {
    btnPlaceAddItinerary.onclick = () => {
      if (!activePreviewPlace) return;
      const target = activePreviewPlace;
      if (typeof onAddAmenityStop === 'function') {
        onAddAmenityStop({
          name: target.name,
          lat: target.lat,
          lng: target.lng,
          category: target.type === 'monument' ? 'sight' : 'city'
        });
      } else {
        state.addStop({
          id: `stop_${Date.now()}`,
          name: target.name,
          lat: target.lat,
          lng: target.lng,
          type: target.type
        });
      }
      hidePlacePreview();
      if (typeof onToast === 'function') {
        onToast(`Added "${target.name}" to trip stops`);
      }
    };
  }

  // Interactive Tap on Map (Real-Time Discovery & Instant Directions response)
  async function onMapTapped(lat, lng) {
    if (document.body.classList.contains('navigation-in-progress')) return;

    // Check distance from user location
    const userLoc = state.userLocation || getSavedUserLocation();
    let distText = '';
    if (userLoc && typeof userLoc.lat === 'number' && typeof userLoc.lng === 'number') {
      const meters = calculateMeters(userLoc.lat, userLoc.lng, lat, lng);
      distText = `${formatDistance(meters)} away`;
    }

    try {
      // 1. Check if tapped near (~4.5km) an iconic curated monument or world destination
      const curatedMatch = CURATED_INDIAN_DESTINATIONS.find(dest => {
        const d = calculateMeters(dest.lat, dest.lng, lat, lng);
        return d <= 4500;
      });

      if (curatedMatch) {
        showPlacePreview(curatedMatch.name, curatedMatch.lat, curatedMatch.lng, curatedMatch.type || 'monument', distText);
        if (typeof onToast === 'function') onToast(`Selected ${curatedMatch.name}`);
        return;
      }

      // 2. Query OSM reverse geocoder
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&accept-language=en`);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        
        // Strictly verify if this location is a recognized monument, tourism destination, historic landmark, or scenic spot
        const isMonument = Boolean(addr.attraction || addr.tourism || addr.historic || addr.heritage || addr.monument || addr.castle || addr.fort || addr.ruins || addr.archaeological_site);
        const isSacred = Boolean(addr.place_of_worship || addr.temple || addr.church || addr.mosque || addr.shrine);
        const isNature = Boolean(addr.natural || addr.viewpoint || addr.waterfall || addr.beach || (addr.leisure && (addr.leisure === 'park' || addr.leisure === 'nature_reserve')));
        const isCityHub = Boolean(data.type === 'city' || data.type === 'town' || addr.city);

        // DO NOT mark random residential colonies, houses, alleys, dirt roads or arbitrary coordinates
        if (!isMonument && !isSacred && !isNature && !isCityHub) {
          hidePlacePreview();
          return;
        }

        const title = data.name || addr.attraction || addr.historic || addr.tourism || addr.viewpoint || addr.monument || addr.city || addr.town;
        if (!title) {
          hidePlacePreview();
          return;
        }

        const locality = [
          addr.suburb || addr.neighbourhood,
          addr.city || addr.town || addr.state_district || addr.state,
          addr.country
        ].filter(Boolean).slice(0, 2).join(', ');

        const placeType = isMonument ? 'monument' : isSacred ? 'temple' : isNature ? 'nature' : 'destination';
        showPlacePreview(title, lat, lng, placeType, distText);
        if (placePreviewDesc) {
          placePreviewDesc.textContent = distText ? `${distText} • ${locality || 'World Travel Landmark'}` : (locality || 'World Travel Landmark');
        }
        if (typeof onToast === 'function') onToast(`Selected ${title}`);
      }
    } catch (e) {
      // Ignore network errors on accidental taps
    }
  }

  window.__onMapClicked = (lat, lng) => {
    if (searchDropdown && !searchDropdown.classList.contains('hidden')) {
      searchDropdown.classList.add('hidden');
      return;
    }
    onMapTapped(lat, lng);
  };


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

    hidePlacePreview();

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

    const screenMap = document.getElementById('screen-map');
    if (screenMap) screenMap.classList.add('directions-active-hud');
    document.body.classList.add('directions-active-hud');

    if (!defaultDest && destInput) {
      destInput.focus();
    } else if (origInput) {
      origInput.focus();
    }
  }

  function closeDirections() {
    if (dirBox) dirBox.classList.add('hidden');
    if (searchBar) searchBar.classList.remove('hidden');
    if (searchWrap) searchWrap.classList.remove('directions-active');
    if (searchDropdown) searchDropdown.classList.add('hidden');

    const screenMap = document.getElementById('screen-map');
    if (screenMap) screenMap.classList.remove('directions-active-hud');
    document.body.classList.remove('directions-active-hud');
  }

  function cancelDirectionsSelection() {
    if (destInput) destInput.value = '';
    closeDirections();
    if (typeof onToast === 'function') onToast('Route selection cancelled');
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

  if (btnClose) {
    btnClose.onclick = () => closeDirections();
  }

  // Transport Mode Selector Pills
  const modePills = document.querySelectorAll('.dir-mode-pill');
  modePills.forEach(btn => {
    btn.onclick = () => {
      modePills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-mode') || 'driving';
      if (typeof onToast === 'function') {
        onToast(`Switched mode: ${mode === 'moto' ? 'Two-Wheeler (Motorcycle)' : 'Standard Driving'}`);
      }
      if (origInput && destInput && origInput.value.trim() && destInput.value.trim() && btnCalc) {
        btnCalc.click();
      }
    };
  });


  // Keyboard shortcut to close directions
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dirBox && !dirBox.classList.contains('hidden')) {
        closeDirections();
      }
      hidePlacePreview();
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

  // 1. Search Bar Input & High-Precision Suggestions Autocomplete
  let searchDebounceTimer = null;
  if (searchInput && searchDropdown) {
    searchInput.onfocus = () => {
      document.body.classList.add('search-focused');
      const screenMap = document.getElementById('screen-map');
      if (screenMap) screenMap.classList.add('search-focused');
    };

    searchInput.onblur = () => {
      setTimeout(() => {
        document.body.classList.remove('search-focused');
        const screenMap = document.getElementById('screen-map');
        if (screenMap) screenMap.classList.remove('search-focused');
      }, 250);
    };

    searchInput.oninput = () => {
      clearTimeout(searchDebounceTimer);
      const query = searchInput.value.trim();

      if (query.length < 2) {
        searchDropdown.classList.add('hidden');
        searchDropdown.innerHTML = '';
        return;
      }

      // Show immediate loading indicator with animated dots
      searchDropdown.innerHTML = `
        <div class="search-dropdown-loading">
          <div class="search-loading-dots"><span></span><span></span><span></span></div>
          <span>Searching monuments & destinations worldwide...</span>
        </div>
      `;
      searchDropdown.classList.remove('hidden');

      searchDebounceTimer = setTimeout(async () => {
        const userLoc = state.userLocation || getSavedUserLocation();
        const matches = await searchPlacesIndia(query, userLoc);

        if (searchInput.value.trim().toLowerCase() !== query.toLowerCase()) {
          return; // Ignore stale async responses if user typed more
        }

        if (matches && matches.length > 0) {
          // Fetch authentic monument / destination photos only (null if no genuine photo exists)
          const itemsWithPhotos = await Promise.all(matches.map(async (m) => {
            let thumbUrl = null;
            try {
              const photo = await fetchPlacePhoto(m.name);
              if (photo && photo.thumbUrl) thumbUrl = photo.thumbUrl;
            } catch (err) {}
            return {
              ...m,
              thumbUrl
            };
          }));

          searchDropdown.innerHTML = itemsWithPhotos.map(item => `
            <div class="search-dropdown-item" data-name="${item.name}" data-lat="${item.lat}" data-lng="${item.lng}" data-type="${item.type || 'destination'}" data-dist="${item.distText || ''}">
              ${item.thumbUrl ? `
                <img class="search-item-thumb" src="${item.thumbUrl}" alt="${item.name}" loading="lazy" />
              ` : `
                <div class="search-item-icon-avatar ${item.type || 'destination'}">
                  <svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    ${item.type === 'monument'
                      ? '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h6M9 14h6M9 18h6"/>'
                      : item.type === 'temple'
                      ? '<path d="M12 2L2 9h20L12 2zM4 9v12h16V9M12 13v8"/>'
                      : item.type === 'nature'
                      ? '<path d="M8 18L12 12l4 6M3 20l6-9 6 9M18 20l3-5-3-5"/>'
                      : '<path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/>'
                    }
                  </svg>
                </div>
              `}
              <div class="search-item-text">
                <div class="search-item-header-row">
                  <span class="search-item-name">${item.name}</span>
                  ${item.distText ? `<span class="search-item-dist-badge">${item.distText}</span>` : ''}
                </div>
                <div class="search-item-sub">${item.subtitle || 'India'}</div>
              </div>
              <svg class="icon-xs search-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          `).join('');

          searchDropdown.classList.remove('hidden');

          searchDropdown.querySelectorAll('.search-dropdown-item').forEach(itemEl => {
            const selectItem = (e) => {
              if (e) {
                e.preventDefault();
                e.stopPropagation();
              }
              const name = itemEl.getAttribute('data-name');
              const lat = parseFloat(itemEl.getAttribute('data-lat'));
              const lng = parseFloat(itemEl.getAttribute('data-lng'));
              const type = itemEl.getAttribute('data-type');
              const distText = itemEl.getAttribute('data-dist') || '';
              searchInput.value = name;
              searchDropdown.classList.add('hidden');
              showPlacePreview(name, lat, lng, type, distText);
            };

            itemEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
            itemEl.addEventListener('mousedown', (e) => { e.stopPropagation(); });
            itemEl.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
            itemEl.addEventListener('click', selectItem);
          });
        } else {
          searchDropdown.innerHTML = `
            <div style="padding: 14px; text-align: center; font-size: 12.5px; color: var(--on-surface-variant);">
              No destinations found for "${query}". Try searching a city, landmark or temple.
            </div>
          `;
          searchDropdown.classList.remove('hidden');
        }
      }, 200);
    };

    searchInput.onkeydown = async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = searchInput.value.trim();
        if (!val) return;

        searchDropdown.classList.add('hidden');
        clearTimeout(searchDebounceTimer);

        if (typeof onToast === 'function') onToast(`Locating ${val}...`);
        const userLoc = state.userLocation || getSavedUserLocation();
        const results = await searchPlacesIndia(val, userLoc);
        if (results && results.length > 0) {
          const top = results[0];
          searchInput.value = top.name;
          showPlacePreview(top.name, top.lat, top.lng, top.type, top.distText);
        } else {
          openDirections('Current Location', val);
        }
      }
    };

    // Isolate search dropdown from Leaflet map touches & clicks
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick'].forEach(evtType => {
      searchDropdown.addEventListener(evtType, (e) => {
        e.stopPropagation();
      }, evtType === 'touchstart' ? { passive: true } : false);
    });

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
