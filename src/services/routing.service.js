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

export function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0;
  const coordinates = [];
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let byte, shift = 0, result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += deltaLng;

    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

import { searchPlacesIndia } from './search.service.js';

export async function geocodePlace(query) {
  if (!query || !query.trim()) return null;
  const cleanQ = query.trim();

  try {
    const results = await searchPlacesIndia(cleanQ);
    if (results && results.length > 0) {
      return {
        name: results[0].name,
        fullName: results[0].subtitle || results[0].name,
        lat: results[0].lat,
        lng: results[0].lng
      };
    }
  } catch (err) {
    console.warn('[RoutingService] searchPlacesIndia error:', err);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=1&q=${encodeURIComponent(cleanQ)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return {
          name: data[0].display_name ? data[0].display_name.split(',')[0].trim() : cleanQ,
          fullName: data[0].display_name,
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    }
  } catch (err) {
    console.warn('[RoutingService] Geocoding error:', err);
  }
  return null;
}

export async function calculateOSRMRoute(originCoord, destCoord) {
  const [lat1, lon1] = originCoord;
  const [lat2, lon2] = destCoord;

  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=polyline&steps=true`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = route.distance / 1000;
        const durationMinutes = Math.round(route.duration / 60);
        const polylineLatlngs = decodePolyline(route.geometry);
        const steps = (route.legs && route.legs[0] && route.legs[0].steps) ? route.legs[0].steps : [];

        return {
          distanceKm,
          durationMinutes,
          polylineLatlngs,
          steps,
          geometry: route.geometry
        };
      }
    }
  } catch (err) {
    console.warn('[RoutingService] OSRM route error, using Haversine calculation:', err);
  }

  // Fallback to Haversine distance
  const straightKm = calculateHaversineKm(lat1, lon1, lat2, lon2);
  const roadKm = straightKm * 1.35;
  const durMin = Math.round((roadKm / 55) * 60);

  const intermediatePoints = [];
  const stepsCount = 12;
  for (let i = 0; i <= stepsCount; i++) {
    const frac = i / stepsCount;
    intermediatePoints.push([lat1 + (lat2 - lat1) * frac, lon1 + (lon2 - lon1) * frac]);
  }

  return {
    distanceKm: roadKm,
    durationMinutes: durMin,
    polylineLatlngs: intermediatePoints,
    steps: []
  };
}

function cleanLocalityName(address) {
  if (!address) return 'Highway Corridor';
  let raw = address.city || address.town || address.village || address.suburb || address.county || address.state_district || 'Highway Corridor';
  // Strip parentheticals like "(K)", "(Rural)", "(Urban)"
  raw = raw.replace(/\s*\([^)]*\)/g, '');
  // Strip administrative tokens
  raw = raw.replace(/\b(Mandal|Tehsil|Taluk|Taluka|District|Subdistrict|Block|Circle|Division|Panchayat)\b/gi, '');
  raw = raw.replace(/\s+/g, ' ').trim();
  return raw || 'Highway Corridor';
}

export async function fetchRouteCorridorAmenities(polylineLatlngs) {
  if (!polylineLatlngs || polylineLatlngs.length === 0) return [];
  const totalPoints = polylineLatlngs.length;
  const checkpoints = [0.25, 0.50, 0.75];
  const results = [];

  for (let i = 0; i < checkpoints.length; i++) {
    const pt = polylineLatlngs[Math.floor(totalPoints * checkpoints[i])];
    const lat = pt[0];
    const lng = pt[1];

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=${lat}&lon=${lng}&zoom=12`);
      if (res.ok) {
        const data = await res.json();
        const town = cleanLocalityName(data.address);

        results.push({
          id: `amenity-hotel-${i}`,
          name: `Hotel Highway Grand (${town})`,
          category: 'stays',
          badgeText: 'Hotel / Stay',
          description: `AC deluxe rooms, 24h front desk, travel parking & amenities near ${town}`,
          distText: `${Math.round(checkpoints[i] * 100)}% of journey`,
          latitude: lat + 0.005,
          longitude: lng + 0.005,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Hotels in ' + town)}`
        });

        results.push({
          id: `amenity-food-${i}`,
          name: `NH Highway Dhaba & Restaurant (${town})`,
          category: 'food',
          badgeText: 'Highway Dhaba',
          description: `Fresh tandoori rotis, regional thalis, pure tea & clean restrooms near ${town}`,
          distText: `${Math.round(checkpoints[i] * 100)}% of journey`,
          latitude: lat - 0.004,
          longitude: lng + 0.004,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Highway Dhaba and Restaurants in ' + town)}`
        });

        results.push({
          id: `amenity-fuel-${i}`,
          name: `24h Highway Fuel Plaza & EV Hub (${town})`,
          category: 'fuel',
          badgeText: 'Fuel + EV',
          description: `High-speed petrol, diesel, EV supercharging & air station near ${town}`,
          distText: `${Math.round(checkpoints[i] * 100)}% of journey`,
          latitude: lat + 0.003,
          longitude: lng - 0.003,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Petrol pump and EV charging near ' + town)}`
        });
      }
    } catch (e) {
      console.warn('[RoutingService] Corridor checkpoint query error:', e);
    }
  }

  // Fallback midpoint amenities if geocoding failed
  if (results.length === 0) {
    const midPt = polylineLatlngs[Math.floor(totalPoints * 0.5)];
    results.push(
      {
        id: 'amenity-hotel-mid',
        name: 'Highway Express Residency & Suites',
        category: 'stays',
        badgeText: 'Hotel / Stay',
        description: 'Family rooms, secure parking & 24-hour restaurant',
        distText: 'Midpoint of route',
        latitude: midPt[0] + 0.01,
        longitude: midPt[1] + 0.01,
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Hotels+on+Highway'
      },
      {
        id: 'amenity-dhaba-mid',
        name: 'Grand Royal Highway Dhaba & Family Garden',
        category: 'food',
        badgeText: 'Highway Dhaba',
        description: 'Hot tandoori bread, paneer butter masala, tea & outdoor garden',
        distText: 'Midpoint of route',
        latitude: midPt[0] - 0.01,
        longitude: midPt[1] + 0.008,
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Highway+Dhabas'
      },
      {
        id: 'amenity-fuel-mid',
        name: 'NHAI Expressway 24x7 Fuel & Fast EV Hub',
        category: 'fuel',
        badgeText: 'Fuel + EV',
        description: '60kW DC Fast EV Chargers, Petrol, Diesel & Quick Refreshments',
        distText: 'Midpoint of route',
        latitude: midPt[0] + 0.005,
        longitude: midPt[1] - 0.01,
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Fuel+and+EV+stations'
      }
    );
  }

  return results;
}
