import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { state } from '../state.js';

export const GOOGLE_TILE_PROVIDERS = {
  roadmap: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    tileSize: 256,
    zoomOffset: 0,
    attribution: 'Google Maps'
  },
  satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    tileSize: 256,
    zoomOffset: 0,
    attribution: 'Google Satellite'
  },
  terrain: {
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&scale=2',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    tileSize: 256,
    zoomOffset: 0,
    attribution: 'Google Terrain'
  }
};

let mapInstance = null;
let currentTileLayer = null;
let userLocationMarker = null;
let userAccuracyCircle = null;
let routePolylineLayer = null;
let stopMarkersLayer = null;
let watchLocationId = null;

let lastLocationToastTime = 0;
let hasShownStartupLocationToast = false;

export function getMapInstance() {
  return mapInstance;
}

export function createGoogleTileLayer(layerKey = 'roadmap') {
  const conf = GOOGLE_TILE_PROVIDERS[layerKey] || GOOGLE_TILE_PROVIDERS.roadmap;
  const layer = L.tileLayer(conf.url, {
    subdomains: conf.subdomains,
    maxZoom: conf.maxZoom || 20,
    minZoom: 4,
    noWrap: false,
    tileSize: conf.tileSize || 256,
    zoomOffset: conf.zoomOffset !== undefined ? conf.zoomOffset : 0,
    detectRetina: false,
    attribution: conf.attribution,
    crossOrigin: true,
    keepBuffer: 16,
    updateWhenIdle: false,
    updateWhenZooming: true
  });

  layer.on('tileerror', function(error, tile) {
    if (tile && !tile._fallbackApplied && error.coords) {
      tile._fallbackApplied = true;
      const sub = ['a', 'b', 'c', 'd'][Math.abs((error.coords.x + error.coords.y) % 4)];
      tile.src = `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${error.coords.z}/${error.coords.x}/${error.coords.y}@2x.png`;
    }
  });

  return layer;
}

export const LAST_USER_LOC_KEY = 'tripweave_last_user_location';

export function getSavedUserLocation() {
  // 1. Android native hardware bridge (instantaneous synchronous check)
  if (typeof window !== 'undefined' && window.AndroidLocationBridge && typeof window.AndroidLocationBridge.getDeviceLocation === 'function') {
    try {
      const nativeJson = window.AndroidLocationBridge.getDeviceLocation();
      if (nativeJson) {
        const nativeLoc = JSON.parse(nativeJson);
        if (nativeLoc && typeof nativeLoc.latitude === 'number' && typeof nativeLoc.longitude === 'number' && nativeLoc.latitude !== 0) {
          return {
            lat: nativeLoc.latitude,
            lng: nativeLoc.longitude,
            accuracy: nativeLoc.accuracy || 15,
            provider: nativeLoc.provider || 'native-hardware'
          };
        }
      }
    } catch (e) {
      console.warn('Native location bridge check:', e);
    }
  }

  // 2. Persistent localStorage
  try {
    const raw = localStorage.getItem(LAST_USER_LOC_KEY);
    if (raw) {
      const loc = JSON.parse(raw);
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' && loc.lat !== 0) {
        return loc;
      }
    }
  } catch (e) {
    console.warn('Error reading saved user location:', e);
  }

  // 3. Runtime state if populated
  if (state.userLocation && typeof state.userLocation.lat === 'number' && typeof state.userLocation.lng === 'number' && state.userLocation.lat !== 0) {
    return {
      lat: state.userLocation.lat,
      lng: state.userLocation.lng,
      accuracy: state.userLocation.accuracy || 20,
      provider: state.userLocation.provider || 'state'
    };
  }

  return null;
}

export function saveUserLocation(lat, lng, accuracy = 15, provider = 'gps') {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;
  try {
    const loc = { lat, lng, accuracy, provider, timestamp: Date.now() };
    localStorage.setItem(LAST_USER_LOC_KEY, JSON.stringify(loc));
  } catch (e) {}
}

export function initMap(containerId = 'leaflet-map') {
  if (mapInstance) return mapInstance;

  const mapEl = document.getElementById(containerId);
  if (!mapEl) return null;

  // Immediately center on user's current/saved location at zoom 15, NEVER the zoomed-out India country map (zoom 5)
  const initialLoc = getSavedUserLocation();
  let initialCenter = [12.9716, 77.5946]; // Default to urban city center if fresh install before GPS
  let initialZoom = 14;

  if (initialLoc) {
    initialCenter = [initialLoc.lat, initialLoc.lng];
    initialZoom = 15;
  } else {
    // If user has trip stops, center on the first stop
    const stops = state.getActiveStops();
    if (stops && stops.length > 0 && stops[0].latitude && stops[0].longitude) {
      initialCenter = [stops[0].latitude, stops[0].longitude];
      initialZoom = 14;
    }
  }

  mapInstance = L.map(containerId, {
    zoomControl: false,
    attributionControl: false,
    fadeAnimation: true,
    zoomAnimation: true,
    minZoom: 4,
    maxZoom: 20,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    worldCopyJump: true,
    preferCanvas: true
  }).setView(initialCenter, initialZoom);

  currentTileLayer = createGoogleTileLayer('roadmap');
  currentTileLayer.addTo(mapInstance);

  stopMarkersLayer = L.layerGroup().addTo(mapInstance);

  // If saved/native location was available, immediately render Google blue dot and mark state
  if (initialLoc) {
    renderGoogleLocationDot(initialLoc.lat, initialLoc.lng, initialLoc.accuracy || 15);
    state.setUserLocation(initialLoc.lat, initialLoc.lng, initialLoc.accuracy || 15, true, initialLoc.provider || 'saved');
    state.hasInitiallyCenteredOnUser = true;
    const locateBtn = document.getElementById('btn-locate-me');
    if (locateBtn) {
      locateBtn.classList.add('active-located');
    }
  }

  // Prevent UI overlays (search dropdown, top bar, place card) from propagating clicks/scrolls to Leaflet map
  const searchDropdown = document.getElementById('search-suggestions-dropdown');
  if (searchDropdown) {
    L.DomEvent.disableClickPropagation(searchDropdown);
    L.DomEvent.disableScrollPropagation(searchDropdown);
  }
  const topSearchWrap = document.getElementById('top-search-wrap');
  if (topSearchWrap) {
    L.DomEvent.disableClickPropagation(topSearchWrap);
  }
  const placePreviewCard = document.getElementById('map-place-preview-card');
  if (placePreviewCard) {
    L.DomEvent.disableClickPropagation(placePreviewCard);
    L.DomEvent.disableScrollPropagation(placePreviewCard);
  }

  mapInstance.on('click', (e) => {
    // If search suggestions are active, dismiss the dropdown without tapping the background map
    const activeDropdown = document.getElementById('search-suggestions-dropdown');
    if (activeDropdown && !activeDropdown.classList.contains('hidden')) {
      activeDropdown.classList.add('hidden');
      return;
    }
    if (typeof window.__onMapClicked === 'function') {
      window.__onMapClicked(e.latlng.lat, e.latlng.lng);
    }
  });

  // Ensure dimensions are verified after layout passes
  setTimeout(resizeMap, 50);
  setTimeout(resizeMap, 200);
  setTimeout(resizeMap, 500);

  // Dynamic Aspect Ratio & Device Orientation Listener
  window.addEventListener('resize', () => {
    resizeMap();
  }, { passive: true });

  window.addEventListener('orientationchange', () => {
    setTimeout(resizeMap, 100);
    setTimeout(resizeMap, 300);
  }, { passive: true });

  return mapInstance;
}

export function resizeMap() {
  if (!mapInstance) return;
  try {
    mapInstance.invalidateSize(true);
  } catch (e) {
    console.warn('Map resize error:', e);
  }
}

export function switchMapLayer(layerKey = 'roadmap') {
  if (!mapInstance) return;
  if (currentTileLayer) {
    mapInstance.removeLayer(currentTileLayer);
  }
  currentTileLayer = createGoogleTileLayer(layerKey);
  currentTileLayer.addTo(mapInstance);
}

export function renderGoogleLocationDot(lat, lng, accuracy = 15) {
  if (!mapInstance) return;

  const puckSvgHtml = `
    <div class="google-location-puck-wrapper">
      <svg class="location-puck-svg" viewBox="0 0 56 56" width="56" height="56" style="display: block; overflow: visible;">
        <defs>
          <filter id="puck-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.32)"/>
            <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="rgba(26,115,232,0.45)"/>
          </filter>
          <linearGradient id="puck-blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4285F4"/>
            <stop offset="100%" stop-color="#1A73E8"/>
          </linearGradient>
          <linearGradient id="beam-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="rgba(26,115,232,0.38)"/>
            <stop offset="100%" stop-color="rgba(26,115,232,0.0)"/>
          </linearGradient>
        </defs>
        <!-- Directional Navigation Beam (Flashlight Field of View) -->
        <path class="location-beam" d="M 28 28 L 16 6 A 24 24 0 0 1 40 6 Z" fill="url(#beam-gradient)"/>
        <!-- Dual Sonar Radar Pulse Rings -->
        <circle class="location-pulse-ring" cx="28" cy="28" r="14" fill="rgba(66, 133, 244, 0.22)"/>
        <circle class="location-pulse-ring-outer" cx="28" cy="28" r="18" fill="rgba(66, 133, 244, 0.12)"/>
        <!-- Pure White Outer Bezel with Shadow -->
        <circle cx="28" cy="28" r="9.5" fill="#FFFFFF" filter="url(#puck-shadow)"/>
        <!-- Deep Vibrant Google Blue Core -->
        <circle cx="28" cy="28" r="7" fill="url(#puck-blue)"/>
        <!-- Precision Specular Dot -->
        <circle cx="28" cy="28" r="2.2" fill="#FFFFFF" opacity="0.95"/>
      </svg>
    </div>
  `;

  const pulseIcon = L.divIcon({
    className: 'google-location-dot-container',
    html: puckSvgHtml,
    iconSize: [56, 56],
    iconAnchor: [28, 28]
  });

  if (userLocationMarker) {
    userLocationMarker.setLatLng([lat, lng]);
  } else {
    userLocationMarker = L.marker([lat, lng], {
      icon: pulseIcon,
      zIndexOffset: 2000,
      interactive: false
    }).addTo(mapInstance);
  }

  const radius = Math.min(Math.max(accuracy, 10), 120);
  if (userAccuracyCircle) {
    userAccuracyCircle.setLatLng([lat, lng]);
    userAccuracyCircle.setRadius(radius);
  } else {
    userAccuracyCircle = L.circle([lat, lng], {
      radius: radius,
      color: '#1A73E8',
      weight: 1,
      opacity: 0.25,
      fillColor: '#1A73E8',
      fillOpacity: 0.08,
      interactive: false
    }).addTo(mapInstance);
  }
}

export function clearRoutePolyline() {
  if (routePolylineLayer && mapInstance) {
    try {
      mapInstance.removeLayer(routePolylineLayer);
    } catch (e) {}
    routePolylineLayer = null;
  }
}

export function renderRoutePolyline(latlngs, options = {}) {
  if (!mapInstance) return;
  clearRoutePolyline();
  if (!latlngs || latlngs.length < 2) return;

  const group = L.layerGroup();

  // 1. Outer Deep Navy Highway Casing (Drop-shadow contrast against satellite & roadmap)
  const casingPolyline = L.polyline(latlngs, {
    color: options.casingColor || '#174EA6',
    weight: options.casingWeight || 9,
    opacity: 0.95,
    lineJoin: 'round',
    lineCap: 'round',
    interactive: false
  });
  group.addLayer(casingPolyline);

  // 2. Inner High-Luminance Google Executive Blue Core
  const corePolyline = L.polyline(latlngs, {
    color: options.color || '#4285F4',
    weight: options.weight || 5.5,
    opacity: 1.0,
    lineJoin: 'round',
    lineCap: 'round',
    interactive: true
  });
  group.addLayer(corePolyline);

  // 3. Start Endpoint: Google Maps Precision Green Origin Puck
  const startPt = latlngs[0];
  const originIconHtml = `
    <div class="route-origin-puck">
      <div class="route-origin-halo"></div>
      <div class="route-origin-core"></div>
    </div>
  `;
  const originIcon = L.divIcon({
    className: 'route-origin-marker-wrap',
    html: originIconHtml,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  const originMarker = L.marker(startPt, {
    icon: originIcon,
    zIndexOffset: 1500,
    interactive: false
  });
  group.addLayer(originMarker);

  // 4. Destination Endpoint: Iconic Google Red Teardrop Pin with Ground Shadow
  const destPt = latlngs[latlngs.length - 1];
  const destIconHtml = `
    <div class="route-dest-pin-marker">
      <svg viewBox="0 0 32 44" width="30" height="42" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.38)); display: block;">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 11.5 16 28 16 28s16-16.5 16-28C32 7.163 24.837 0 16 0z" fill="#EA4335"/>
        <circle cx="16" cy="16" r="6.5" fill="#FFFFFF"/>
        <circle cx="16" cy="16" r="3.5" fill="#C5221F"/>
      </svg>
      <div class="route-dest-shadow"></div>
    </div>
  `;
  const destIcon = L.divIcon({
    className: 'route-dest-marker-wrap',
    html: destIconHtml,
    iconSize: [30, 44],
    iconAnchor: [15, 41]
  });
  const destMarker = L.marker(destPt, {
    icon: destIcon,
    zIndexOffset: 1600,
    interactive: false
  });
  group.addLayer(destMarker);

  group.addTo(mapInstance);
  routePolylineLayer = group;

  if (options.fitBounds !== false) {
    mapInstance.fitBounds(corePolyline.getBounds(), {
      paddingTopLeft: [40, 40],
      paddingBottomRight: [40, 140],
      maxZoom: 16,
      animate: true
    });
  }
}

export function acquireUserLocation(shouldFlyTo = false, onToast = null) {
  const locateBtn = document.getElementById('btn-locate-me');
  if (locateBtn && shouldFlyTo) locateBtn.classList.add('locating');

  let toastHandled = false;

  const onLocationSuccess = async (lat, lng, accuracy = 15, isFallback = false, provider = 'gps', fromWatch = false) => {
    if (state.userLocation && state.userLocation.isRealGPS && state.userLocation.accuracy < 40 && accuracy > 100) {
      return;
    }

    if (locateBtn) {
      locateBtn.classList.remove('locating');
      locateBtn.classList.add('active-located');
    }

    saveUserLocation(lat, lng, accuracy, provider);
    state.setUserLocation(lat, lng, accuracy, !isFallback, provider);
    renderGoogleLocationDot(lat, lng, accuracy);

    // Pan to location on first location fix or when user explicitly tapped Locate Me
    if (mapInstance && (shouldFlyTo || !state.hasInitiallyCenteredOnUser)) {
      mapInstance.setView([lat, lng], 15);
      state.hasInitiallyCenteredOnUser = true;
    }

    // NEVER show notification toasts for continuous background watchPosition updates
    if (fromWatch) return;

    const now = Date.now();
    const canShowToast = shouldFlyTo && !toastHandled && (now - lastLocationToastTime > 30000);

    if (canShowToast && typeof onToast === 'function') {
      toastHandled = true;
      lastLocationToastTime = now;
      hasShownStartupLocationToast = true;
      shouldFlyTo = false;

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=${lat}&lon=${lng}&zoom=14`);
        if (res.ok) {
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.suburb;
          if (city && city !== 'Current Location') {
            onToast(`Located at ${city}`);
            return;
          }
        }
      } catch (e) {}

      onToast('GPS Location Acquired');
    }
  };

  // Check Android native hardware GPS bridge synchronously
  if (typeof window !== 'undefined' && window.AndroidLocationBridge && typeof window.AndroidLocationBridge.getDeviceLocation === 'function') {
    try {
      const nativeLocJson = window.AndroidLocationBridge.getDeviceLocation();
      if (nativeLocJson) {
        const nativeLoc = JSON.parse(nativeLocJson);
        if (nativeLoc.latitude && nativeLoc.longitude) {
          onLocationSuccess(nativeLoc.latitude, nativeLoc.longitude, nativeLoc.accuracy || 10, false, nativeLoc.provider || 'native-gps', false);
        }
      }
      if (typeof window.AndroidLocationBridge.requestLocationUpdate === 'function') {
        window.AndroidLocationBridge.requestLocationUpdate();
      }
    } catch (e) {
      console.warn('Native location bridge check:', e);
    }
  }

  if (!navigator.geolocation) {
    if (locateBtn) locateBtn.classList.remove('locating');
    if (shouldFlyTo && typeof onToast === 'function') onToast('Location services unavailable');
    return;
  }

  if (watchLocationId !== null) {
    try {
      navigator.geolocation.clearWatch(watchLocationId);
    } catch (e) {}
    watchLocationId = null;
  }

  // Use maximumAge: 300000 (5 mins) so cached position resolves immediately (<50ms) without blocking
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      onLocationSuccess(latitude, longitude, accuracy || 15, false, 'browser-gps', false);

      // Continuous real-time GPS tracking - fromWatch = true (SILENT)
      try {
        watchLocationId = navigator.geolocation.watchPosition(
          (watchPos) => {
            const wCoords = watchPos.coords;
            onLocationSuccess(wCoords.latitude, wCoords.longitude, wCoords.accuracy || 15, false, 'browser-watch', true);
          },
          (wErr) => console.warn('Location watch error:', wErr),
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 25000 }
        );
      } catch (e) {}
    },
    (err) => {
      console.warn('GPS request timed out:', err);
      if (locateBtn) locateBtn.classList.remove('locating');
      if (shouldFlyTo && typeof onToast === 'function' && (Date.now() - lastLocationToastTime > 15000)) {
        onToast('Could not acquire precise GPS');
        lastLocationToastTime = Date.now();
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

export function setupLocationListeners(onToast = null) {
  const locateBtn = document.getElementById('btn-locate-me');
  if (locateBtn) {
    locateBtn.onclick = (e) => {
      e.stopPropagation();
      locateBtn.style.transform = 'scale(0.92)';
      setTimeout(() => { locateBtn.style.transform = ''; }, 180);
      acquireUserLocation(true, onToast);
    };
  }

  // Native Android location bridge event listener
  window.onNativeLocationUpdate = (locData) => {
    if (!locData || !locData.latitude || !locData.longitude) return;
    const { latitude, longitude, accuracy, provider } = locData;
    if (state.userLocation && state.userLocation.isRealGPS && state.userLocation.accuracy < 40 && (accuracy || 20) > 100) return;
    saveUserLocation(latitude, longitude, accuracy || 20, provider || 'native');
    state.setUserLocation(latitude, longitude, accuracy || 20, true, provider || 'native');
    renderGoogleLocationDot(latitude, longitude, accuracy || 20);
    if (mapInstance && !state.hasInitiallyCenteredOnUser) {
      mapInstance.setView([latitude, longitude], 15);
      state.hasInitiallyCenteredOnUser = true;
    }
    const btn = document.getElementById('btn-locate-me');
    if (btn) {
      btn.classList.remove('locating');
      btn.classList.add('active-located');
    }
  };

  // If in native Android environment, proactively request hardware location
  if (typeof window !== 'undefined' && window.AndroidLocationBridge && typeof window.AndroidLocationBridge.requestLocationUpdate === 'function') {
    try {
      window.AndroidLocationBridge.requestLocationUpdate();
    } catch (e) {}
  }

  // Launch initial silent acquisition immediately
  acquireUserLocation(false, onToast);
}

let searchPlaceMarker = null;

export function highlightSearchPlace(lat, lng, name = '') {
  if (!mapInstance) return;

  if (searchPlaceMarker) {
    try {
      mapInstance.removeLayer(searchPlaceMarker);
    } catch (e) {}
    searchPlaceMarker = null;
  }

  if (lat == null || lng == null) return;

  const pinHtml = `
    <div class="google-maps-search-pin" style="display:flex; flex-direction:column; align-items:center;">
      <svg viewBox="0 0 32 44" width="32" height="44" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35)); display:block;">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 11.5 16 28 16 28s16-16.5 16-28C32 7.163 24.837 0 16 0z" fill="#EA4335"/>
        <circle cx="16" cy="16" r="6.5" fill="#FFFFFF"/>
        <circle cx="16" cy="16" r="3.5" fill="#C5221F"/>
      </svg>
      <div style="width: 8px; height: 3px; background: rgba(0,0,0,0.3); border-radius: 50%; margin-top: -2px; filter: blur(1px);"></div>
    </div>
  `;

  const pinIcon = L.divIcon({
    className: 'search-place-marker-wrap',
    html: pinHtml,
    iconSize: [32, 44],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42]
  });

  searchPlaceMarker = L.marker([lat, lng], {
    icon: pinIcon,
    zIndexOffset: 1600
  }).addTo(mapInstance);

  mapInstance.flyTo([lat, lng], 14, {
    animate: true,
    duration: 0.8
  });
}

export function clearSearchPlaceMarker() {
  if (searchPlaceMarker && mapInstance) {
    try {
      mapInstance.removeLayer(searchPlaceMarker);
    } catch (e) {}
    searchPlaceMarker = null;
  }
}

let turnHighlightMarker = null;

export function highlightTurnLocation(lat, lng, instruction = '') {
  if (!mapInstance || lat == null || lng == null) return;
  if (turnHighlightMarker) {
    try { mapInstance.removeLayer(turnHighlightMarker); } catch(e) {}
    turnHighlightMarker = null;
  }

  const turnIcon = L.divIcon({
    className: 'turn-highlight-marker',
    html: `
      <div class="turn-pulse-wrapper">
        <div class="turn-pulse-ring"></div>
        <div class="turn-dot-core"></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  turnHighlightMarker = L.marker([lat, lng], {
    icon: turnIcon,
    zIndexOffset: 1800
  }).addTo(mapInstance);

  mapInstance.flyTo([lat, lng], 16, { animate: true, duration: 0.8 });

  setTimeout(() => {
    if (turnHighlightMarker && mapInstance) {
      try { mapInstance.removeLayer(turnHighlightMarker); } catch(e) {}
      turnHighlightMarker = null;
    }
  }, 4500);
}

