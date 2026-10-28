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
    maxZoom: conf.maxZoom,
    tileSize: conf.tileSize || 256,
    zoomOffset: conf.zoomOffset !== undefined ? conf.zoomOffset : 0,
    detectRetina: false,
    attribution: conf.attribution,
    crossOrigin: true,
    keepBuffer: 8,
    updateWhenIdle: false,
    updateWhenZooming: true
  });

  layer.on('tileerror', function(error, tile) {
    if (tile && !tile._fallbackApplied && error.coords) {
      tile._fallbackApplied = true;
      tile.src = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${error.coords.z}/${error.coords.x}/${error.coords.y}@2x.png`;
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
    fadeAnimation: false,
    zoomAnimation: true,
    maxZoom: 20
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

  mapInstance.on('click', (e) => {
    if (typeof window.__onMapClicked === 'function') {
      window.__onMapClicked(e.latlng.lat, e.latlng.lng);
    }
  });

  // Ensure dimensions are verified after layout passes
  setTimeout(resizeMap, 50);
  setTimeout(resizeMap, 200);
  setTimeout(resizeMap, 500);

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

  const pulseIcon = L.divIcon({
    className: 'google-location-dot-container',
    html: `
      <div class="google-location-halo"></div>
      <div class="google-location-white-border"></div>
      <div class="google-location-blue-core"></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
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

export function renderRoutePolyline(latlngs, options = {}) {
  if (!mapInstance) return;
  if (routePolylineLayer) {
    mapInstance.removeLayer(routePolylineLayer);
    routePolylineLayer = null;
  }
  if (!latlngs || latlngs.length < 2) return;

  routePolylineLayer = L.polyline(latlngs, {
    color: options.color || '#2563EB',
    weight: options.weight || 6,
    opacity: options.opacity || 0.85,
    lineJoin: 'round',
    lineCap: 'round'
  }).addTo(mapInstance);

  if (options.fitBounds !== false) {
    mapInstance.fitBounds(routePolylineLayer.getBounds(), { padding: [40, 40] });
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
