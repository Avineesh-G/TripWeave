import re

with open('src/main.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Remove Leaflet imports
js = re.sub(r"import L from ['\"]leaflet['\"];?\r?\n?", "", js)
js = re.sub(r"import ['\"]leaflet/dist/leaflet\.css['\"];?\r?\n?", "", js)

# 2. Replace initMap and renderPlacesAroundSearchArea
old_init_section_start = "// Map Management with High-DPI Retina Tiles & Dynamic Place Pins"
old_init_section_end = "function setupCategoryChips() {"

idx_start = js.find(old_init_section_start)
idx_end = js.find(old_init_section_end)

if idx_start != -1 and idx_end != -1:
    new_init_section = """// Google Maps Management: Vector WebGL Hardware-Accelerated 60/120 FPS
const GOOGLE_MAPS_CLEAN_STYLES = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E8F5E9' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#2E7D32' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ lightness: 100 }, { visibility: 'simplified' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FCD34D' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#F59E0B' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#DBEAFE' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1E40AF' }] }
];

function initMap() {
  if (mapInstance) return;
  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl) return;

  if (typeof google === 'undefined' || !google.maps || !google.maps.Map) {
    console.warn('Google Maps API loading, will retry in 150ms...');
    setTimeout(initMap, 150);
    return;
  }

  // Official Clean Google Maps with India-centric defaults
  mapInstance = new google.maps.Map(mapEl, {
    center: { lat: 20.5937, lng: 78.9629 },
    zoom: 5,
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'greedy',
    clickableIcons: true,
    styles: GOOGLE_MAPS_CLEAN_STYLES
  });

  mapInstance.addListener('click', async (e) => {
    if (e.latLng) {
      await handleMapPlaceSelection(e.latLng.lat(), e.latLng.lng());
    }
  });

  mapInstance.addListener('idle', () => {
    renderPlacesAroundSearchArea(currentCategoryFilter);
  });

  window.addEventListener('resize', () => {
    if (mapInstance && typeof google !== 'undefined' && google.maps) {
      google.maps.event.trigger(mapInstance, 'resize');
    }
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (mapInstance && typeof google !== 'undefined' && google.maps) {
        google.maps.event.trigger(mapInstance, 'resize');
      }
    }, 200);
  });

  setTimeout(() => {
    if (mapInstance && typeof google !== 'undefined' && google.maps) {
      google.maps.event.trigger(mapInstance, 'resize');
      renderPlacesAroundSearchArea('all');
    }
  }, 100);
}

function renderPlacesAroundSearchArea(catFilter = 'all') {
  if (!mapInstance || typeof google === 'undefined' || !google.maps) return;
  currentCategoryFilter = catFilter;

  // Clear previous explore markers
  nearbyExploreMarkers.forEach(m => {
    try { m.setMap(null); } catch (e) {}
  });
  nearbyExploreMarkers = [];

  const centerLatLng = mapInstance.getCenter();
  if (!centerLatLng) return;
  const centerLat = centerLatLng.lat();
  const centerLng = centerLatLng.lng();

  // Find matching hub within 250km
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
    const pinSvg = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
        <defs>
          <filter id="pSh" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
          </filter>
        </defs>
        <path d="M15 2 C7.8 2 2 7.8 2 15 C2 24.5 15 36 15 36 C15 36 28 24.5 28 15 C28 7.8 22.2 2 15 2 Z" fill="${pinColor}" stroke="#FFFFFF" stroke-width="2" filter="url(#pSh)"/>
        <circle cx="15" cy="14" r="4.5" fill="#FFFFFF"/>
      </svg>
    `);

    const marker = new google.maps.Marker({
      position: { lat: place.lat, lng: place.lng },
      map: mapInstance,
      title: place.name,
      icon: {
        url: pinSvg,
        scaledSize: new google.maps.Size(26, 33),
        anchor: new google.maps.Point(13, 33)
      },
      zIndex: 500
    });

    marker.addListener('click', () => {
      handleMapPlaceSelection(place.lat, place.lng, place.name);
    });

    nearbyExploreMarkers.push(marker);
  });
}

"""
    js = js[:idx_start] + new_init_section + js[idx_end:]
    print('Replaced initMap and renderPlacesAroundSearchArea successfully.')

# 4. Replace updateMapRoute
old_route_start = "async function updateMapRoute(plan) {"
old_route_end = "// Navigation Tab Switcher"

r_start = js.find(old_route_start)
r_end = js.find(old_route_end)

if r_start != -1 and r_end != -1:
    new_route_code = """async function updateMapRoute(plan) {
  if (!mapInstance || typeof google === 'undefined' || !google.maps) return;

  mapMarkers.forEach(m => {
    try { m.setMap(null); } catch (e) {}
  });
  mapMarkers = [];
  if (routePolyline) { routePolyline.setMap(null); routePolyline = null; }
  if (routeHalo) { routeHalo.setMap(null); routeHalo = null; }

  if (!plan.stops || plan.stops.length === 0) {
    mapInstance.panTo({ lat: 20.5937, lng: 78.9629 });
    mapInstance.setZoom(5);
    return;
  }

  const bounds = new google.maps.LatLngBounds();

  // Render Stop Markers
  plan.stops.forEach((s, idx) => {
    const isOrigin = idx === 0;
    const isDest = idx === plan.stops.length - 1;
    const pos = { lat: s.latitude, lng: s.longitude };
    bounds.extend(pos);

    const fillColor = isOrigin ? '#3B5FCC' : (isDest ? '#1B6E3E' : '#2563EB');
    const marker = new google.maps.Marker({
      position: pos,
      map: mapInstance,
      title: `${idx + 1}. ${s.name}`,
      label: {
        text: String(idx + 1),
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: '11px'
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: fillColor,
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2.5
      },
      zIndex: 1000 + idx
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `<div style="padding:4px;font-family:sans-serif;font-size:12px;"><strong>${idx + 1}. ${s.name}</strong><br>${s.durationMinutes}m visit • ${s.bufferMinutes || 15}m buffer</div>`
    });

    marker.addListener('click', () => {
      infoWindow.open(mapInstance, marker);
    });

    mapMarkers.push(marker);
  });

  // Fetch Live OSRM Road Polyline
  const liveRoute = await fetchLiveOsrmRoute(plan.stops);
  const polylineCoords = (liveRoute && liveRoute.polylineLatlngs && liveRoute.polylineLatlngs.length > 0)
    ? liveRoute.polylineLatlngs.map(pt => ({ lat: pt[0], lng: pt[1] }))
    : plan.stops.map(s => ({ lat: s.latitude, lng: s.longitude }));

  polylineCoords.forEach(c => bounds.extend(c));

  routeHalo = new google.maps.Polyline({
    path: polylineCoords,
    geodesic: true,
    strokeColor: '#FFFFFF',
    strokeOpacity: 0.9,
    strokeWeight: 8,
    map: mapInstance,
    zIndex: 100
  });

  routePolyline = new google.maps.Polyline({
    path: polylineCoords,
    geodesic: true,
    strokeColor: '#2563EB',
    strokeOpacity: 1.0,
    strokeWeight: 5,
    map: mapInstance,
    zIndex: 101
  });

  mapInstance.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
}

"""
    js = js[:r_start] + new_route_code + js[r_end:]
    print('Replaced updateMapRoute successfully.')

# 5. Replace renderGoogleLocationDot
loc_start = "function renderGoogleLocationDot(lat, lng, accuracy = 25) {"
loc_end = "function acquireUserLocation("

l_start = js.find(loc_start)
l_end = js.find(loc_end)

if l_start != -1 and l_end != -1:
    new_loc_code = """function renderGoogleLocationDot(lat, lng, accuracy = 25) {
  if (!mapInstance || typeof google === 'undefined' || !google.maps) return;

  if (userMarker) {
    try { userMarker.setMap(null); } catch (e) {}
    userMarker = null;
  }
  if (userAccuracyCircle) {
    try { userAccuracyCircle.setMap(null); } catch (e) {}
    userAccuracyCircle = null;
  }

  // Google Maps Official Accuracy Circle:
  // Subtle, mathematically bounded, never blows up or covers the screen
  const safeRadius = Math.min(Math.max(accuracy, 15), 350);
  userAccuracyCircle = new google.maps.Circle({
    center: { lat, lng },
    radius: safeRadius,
    map: mapInstance,
    fillColor: '#4285F4',
    fillOpacity: 0.12,
    strokeColor: '#1A73E8',
    strokeOpacity: 0.45,
    strokeWeight: 1,
    clickable: false,
    zIndex: 1400
  });

  // Official Google Maps Blue Location Dot (Retina Vector)
  userMarker = new google.maps.Marker({
    position: { lat, lng },
    map: mapInstance,
    title: 'Your Current Location',
    zIndex: 1500,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#1A73E8',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3
    }
  });
}

"""
    js = js[:l_start] + new_loc_code + js[l_end:]
    print('Replaced renderGoogleLocationDot successfully.')

# 6. Replace switchGoogleMapLayer
old_switch_start = "window.switchGoogleMapLayer = function(type) {"
old_switch_end = "// ==========================================================================\n// FAMOUS PLACES"

s_start = js.find(old_switch_start)
s_end = js.find(old_switch_end)

if s_start != -1 and s_end != -1:
    new_switch_code = """window.switchGoogleMapLayer = function(type) {
  if (!mapInstance || typeof google === 'undefined' || !google.maps) return;
  const mapType = type === 'satellite'
    ? google.maps.MapTypeId.HYBRID
    : (type === 'terrain' ? google.maps.MapTypeId.TERRAIN : google.maps.MapTypeId.ROADMAP);
  mapInstance.setMapTypeId(mapType);
  showToast(`Switched to Google Maps ${type.charAt(0).toUpperCase() + type.slice(1)}`);
};

"""
    js = js[:s_start] + new_switch_code + js[s_end:]
    print('Replaced switchGoogleMapLayer successfully.')

# 7. Replace handleMapPlaceSelection top pin placement
sel_start = "async function handleMapPlaceSelection(lat, lng, explicitName = null) {"
sel_mid = "const sheet = document.getElementById('selected-place-sheet');"

sm_start = js.find(sel_start)
sm_end = js.find(sel_mid)

if sm_start != -1 and sm_end != -1:
    new_sel_top = """async function handleMapPlaceSelection(lat, lng, explicitName = null) {
  if (!mapInstance || typeof google === 'undefined' || !google.maps) return;

  if (selectedPlaceMarker) {
    try { selectedPlaceMarker.setMap(null); } catch (e) {}
    selectedPlaceMarker = null;
  }

  const redPinSvg = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
      <defs>
        <filter id="drpSh" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M17 2 C8.7 2 2 8.7 2 17 C2 27.5 17 40 17 40 C17 40 32 27.5 32 17 C32 8.7 25.3 2 17 2 Z" fill="#E53935" stroke="#FFFFFF" stroke-width="2" filter="url(#drpSh)"/>
      <circle cx="17" cy="16" r="5" fill="#FFFFFF"/>
    </svg>
  `);

  selectedPlaceMarker = new google.maps.Marker({
    position: { lat, lng },
    map: mapInstance,
    title: explicitName || 'Selected Location',
    animation: google.maps.Animation.DROP,
    icon: {
      url: redPinSvg,
      scaledSize: new google.maps.Size(30, 38),
      anchor: new google.maps.Point(15, 38)
    },
    zIndex: 2000
  });

  mapInstance.panTo({ lat, lng });

  """
    js = js[:sm_start] + new_sel_top + js[sm_end:]
    print('Replaced handleMapPlaceSelection top pin successfully.')

# 8. Replace invalidateSize references
js = js.replace("mapInstance.invalidateSize({ debounceMoveend: true });", "if (typeof google !== 'undefined' && google.maps) google.maps.event.trigger(mapInstance, 'resize');")
js = js.replace("mapInstance.invalidateSize();", "if (typeof google !== 'undefined' && google.maps) google.maps.event.trigger(mapInstance, 'resize');")
js = js.replace("mapInstance.invalidateSize(true);", "if (typeof google !== 'undefined' && google.maps) google.maps.event.trigger(mapInstance, 'resize');")

# 9. Replace flyTo
js = js.replace("mapInstance.flyTo([lat, lng], 15, {\n        animate: true,\n        duration: 1.0\n      });", "mapInstance.panTo({ lat, lng }); mapInstance.setZoom(15);")
js = js.replace("mapInstance.flyTo([userLocation.lat, userLocation.lng], 16, { animate: true, duration: 0.8 });", "mapInstance.panTo({ lat: userLocation.lat, lng: userLocation.lng }); mapInstance.setZoom(16);")

# 10. Replace card.onclick inside renderNearbyPlaces
card_old_pan = """      if (mapInstance && !isNaN(cLat) && !isNaN(cLng)) {
        mapInstance.panTo([cLat, cLng], { animate: true, duration: 0.6 });
        if (selectedPlaceMarker) mapInstance.removeLayer(selectedPlaceMarker);
        selectedPlaceMarker = L.marker([cLat, cLng], {
          icon: L.divIcon({
            className: 'selected-pin-wrapper',
            html: `
              <div class="selected-pin-marker">
                <svg viewBox="0 0 24 24" fill="#E53935" stroke="#FFFFFF" stroke-width="1.2">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.8" fill="#FFFFFF"/>
                </svg>
              </div>
            `,
            iconSize: [36, 42],
            iconAnchor: [18, 42]
          }),
          zIndexOffset: 1200
        }).addTo(mapInstance);
      }"""

card_new_pan = """      if (mapInstance && !isNaN(cLat) && !isNaN(cLng)) {
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
      }"""

js = js.replace(card_old_pan, card_new_pan)

with open('src/main.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('ALL GOOGLE MAPS UPGRADES APPLIED TO src/main.js SUCCESSFULLY!')
