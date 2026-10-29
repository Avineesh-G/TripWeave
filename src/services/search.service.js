// ==========================================================================
// TripWeave — High-Precision Indian Places & Landmark Search Engine
// Multi-layer search pipeline:
// 1. Curated Indian destinations, heritage monuments, hill stations & temples
// 2. OpenStreetMap Nominatim with strict India scoping & address details
// 3. Komoot Photon API with GPS proximity ranking
// ==========================================================================

import { calculateHaversineKm } from './routing.service.js';
import { fetchPlacePhoto } from './photo.service.js';

export const CURATED_INDIAN_DESTINATIONS = [
  // Iconic World Wonders & Global Heritage Monuments
  { name: 'Eiffel Tower', subtitle: 'Iconic Iron Lattice Monument • Champ de Mars, Paris, France', lat: 48.8584, lng: 2.2945, type: 'monument' },
  { name: 'Colosseum', subtitle: 'Ancient Flavian Amphitheatre • Rome, Italy', lat: 41.8902, lng: 12.4922, type: 'monument' },
  { name: 'Statue of Liberty', subtitle: 'Symbol of Freedom • Liberty Island, New York, USA', lat: 40.6892, lng: -74.0445, type: 'monument' },
  { name: 'Great Wall of China', subtitle: 'Ancient World Wonder • Badaling, Beijing, China', lat: 40.4319, lng: 116.5704, type: 'monument' },
  { name: 'Pyramids of Giza', subtitle: 'Great Pyramid of Khufu • Giza Plateau, Cairo, Egypt', lat: 29.9792, lng: 31.1342, type: 'monument' },
  { name: 'Machu Picchu', subtitle: 'Incan Citadel in the Andes • Cusco Region, Peru', lat: -13.1631, lng: -72.5450, type: 'monument' },
  { name: 'Petra', subtitle: 'Ancient Nabataean Rose City • Ma\'an Governorate, Jordan', lat: 30.3285, lng: 35.4444, type: 'monument' },
  { name: 'Big Ben & Westminster', subtitle: 'Iconic Clock Tower • London, United Kingdom', lat: 51.5007, lng: -0.1246, type: 'monument' },
  { name: 'Christ the Redeemer', subtitle: 'Art Deco Jesus Statue • Rio de Janeiro, Brazil', lat: -22.9519, lng: -43.2105, type: 'monument' },
  { name: 'Sydney Opera House', subtitle: 'Architectural Masterpiece • Sydney Harbour, Australia', lat: -33.8568, lng: 151.2153, type: 'monument' },
  { name: 'Burj Khalifa', subtitle: 'World\'s Tallest Skyscraper • Downtown Dubai, UAE', lat: 25.1972, lng: 55.2744, type: 'monument' },
  { name: 'Sagrada Familia', subtitle: 'Antoni Gaudí\'s Basílica • Barcelona, Spain', lat: 41.4036, lng: 2.1744, type: 'monument' },
  { name: 'Acropolis of Athens', subtitle: 'Ancient Greek Citadel & Parthenon • Athens, Greece', lat: 37.9715, lng: 23.7257, type: 'monument' },
  { name: 'Louvre Museum', subtitle: 'World\'s Largest Art Museum • Paris, France', lat: 48.8606, lng: 2.3376, type: 'monument' },
  { name: 'Grand Canyon', subtitle: 'Massive Carved Red Rock Canyon • Arizona, USA', lat: 36.1069, lng: -112.1129, type: 'nature' },
  { name: 'Mount Fuji', subtitle: 'Sacred Snow-Capped Volcano Peak • Honshu, Japan', lat: 35.3606, lng: 138.7274, type: 'nature' },
  { name: 'Niagara Falls', subtitle: 'Legendary Horseshoe Waterfalls • Ontario & NY', lat: 43.0962, lng: -79.0377, type: 'nature' },
  { name: 'Santorini', subtitle: 'Aegean Caldera & White Cliffs • Cyclades, Greece', lat: 36.3932, lng: 25.4615, type: 'nature' },
  { name: 'Venice (Grand Canal)', subtitle: 'Historic Floating City • Veneto, Italy', lat: 45.4408, lng: 12.3155, type: 'destination' },

  // Iconic Indian Heritage Monuments & Sacred Shrines
  { name: 'Taj Mahal', subtitle: 'UNESCO World Heritage Site • Agra, Uttar Pradesh', lat: 27.1751, lng: 78.0421, type: 'monument' },
  { name: 'India Gate', subtitle: 'National War Memorial • New Delhi', lat: 28.6129, lng: 77.2295, type: 'monument' },
  { name: 'Qutub Minar', subtitle: 'UNESCO Heritage Minaret • Mehrauli, Delhi', lat: 28.5245, lng: 77.1855, type: 'monument' },
  { name: 'Red Fort', subtitle: 'Historic Mughal Fortress • Old Delhi', lat: 28.6562, lng: 77.2410, type: 'monument' },
  { name: 'Gateway of India', subtitle: 'Colonial Arch Landmark • Colaba, Mumbai', lat: 18.9220, lng: 72.8347, type: 'monument' },
  { name: 'Hawa Mahal', subtitle: 'Palace of Winds • Pink City, Jaipur', lat: 26.9239, lng: 75.8267, type: 'monument' },
  { name: 'Mysore Palace', subtitle: 'Amba Vilas Royal Residence • Mysuru, Karnataka', lat: 12.3051, lng: 76.6551, type: 'monument' },
  { name: 'Charminar', subtitle: 'Historic 16th Century Mosque • Hyderabad, Telangana', lat: 17.3616, lng: 78.4747, type: 'monument' },
  { name: 'Golden Temple', subtitle: 'Harmandir Sahib • Amritsar, Punjab', lat: 31.6200, lng: 74.8765, type: 'temple' },
  { name: 'Victoria Memorial', subtitle: 'Marble Monument & Museum • Kolkata, West Bengal', lat: 22.5448, lng: 88.3426, type: 'monument' },
  { name: 'Meenakshi Temple', subtitle: 'Historic Dravidian Temple • Madurai, Tamil Nadu', lat: 9.9195, lng: 78.1193, type: 'temple' },
  { name: 'Hampi Virupaksha Temple', subtitle: 'Vijayanagara Ruins • Ballari, Karnataka', lat: 15.3350, lng: 76.4600, type: 'monument' },
  { name: 'Konark Sun Temple', subtitle: '13th Century Chariot Temple • Puri, Odisha', lat: 19.8876, lng: 86.0945, type: 'monument' },
  { name: 'Ajanta & Ellora Caves', subtitle: 'Rock-Cut Buddhist Caves • Chhatrapati Sambhaji Nagar, MH', lat: 20.5519, lng: 75.7033, type: 'monument' },
  { name: 'Brihadeeswarar Temple', subtitle: 'Great Living Chola Temple • Thanjavur, Tamil Nadu', lat: 10.7828, lng: 79.1318, type: 'temple' },
  { name: 'Khajuraho Temples', subtitle: 'Medieval Hindu & Jain Temples • Chhatarpur, Madhya Pradesh', lat: 24.8318, lng: 79.9199, type: 'monument' },
  { name: 'Amber Palace', subtitle: 'Hilltop Rajput Fortress • Amer, Jaipur', lat: 26.9855, lng: 75.8513, type: 'monument' },
  { name: 'Golconda Fort', subtitle: 'Medieval Diamond Capital Fortress • Hyderabad, Telangana', lat: 17.3833, lng: 78.4011, type: 'monument' },

  // Hill Stations & Nature Escapes
  { name: 'Ooty (Udhagamandalam)', subtitle: 'Queen of Hill Stations • Nilgiris, Tamil Nadu', lat: 11.4102, lng: 76.6950, type: 'nature' },
  { name: 'Coorg (Madikeri)', subtitle: 'Scotland of India • Western Ghats, Karnataka', lat: 12.4244, lng: 75.7382, type: 'nature' },
  { name: 'Munnar', subtitle: 'Tea Plantations & Anamudi Peak • Idukki, Kerala', lat: 10.0889, lng: 77.0595, type: 'nature' },
  { name: 'Manali', subtitle: 'Himalayan Resort Town • Kullu Valley, Himachal Pradesh', lat: 32.2396, lng: 77.1887, type: 'nature' },
  { name: 'Shimla', subtitle: 'Colonial Summer Capital • Himachal Pradesh', lat: 31.1048, lng: 77.1734, type: 'nature' },
  { name: 'Wayanad', subtitle: 'Waterfalls & Spice Hills • Western Ghats, Kerala', lat: 11.6854, lng: 76.1320, type: 'nature' },
  { name: 'Nandi Hills', subtitle: 'Sunrise Viewpoint & Fortress • Chikkaballapur, Karnataka', lat: 13.3702, lng: 77.6835, type: 'nature' },
  { name: 'Kodaikanal', subtitle: 'Princess of Hill Stations • Dindigul, Tamil Nadu', lat: 10.2381, lng: 77.4892, type: 'nature' },
  { name: 'Mahabaleshwar', subtitle: 'Strawberry Capital & Western Ghats • Satara, Maharashtra', lat: 17.9237, lng: 73.6586, type: 'nature' },
  { name: 'Lonavala & Khandala', subtitle: 'Monsoon Ghats & Caves • Pune, Maharashtra', lat: 18.7557, lng: 73.4091, type: 'nature' },
  { name: 'Rishikesh', subtitle: 'Yoga Capital of the World • Dehradun, Uttarakhand', lat: 30.0869, lng: 78.2676, type: 'nature' },
  { name: 'Darjeeling', subtitle: 'Himalayan Railway & Tea Gardens • West Bengal', lat: 27.0410, lng: 88.2663, type: 'nature' },
  { name: 'Chikmagalur', subtitle: 'Mullayanagiri & Coffee Hills • Karnataka', lat: 13.3161, lng: 75.7720, type: 'nature' },
  { name: 'Mount Abu', subtitle: 'Dilwara Temples & Nakki Lake • Aravalli, Rajasthan', lat: 24.5926, lng: 72.7156, type: 'nature' },

  // Coastal, Beaches & Pilgrimage Hubs
  { name: 'Goa (Panaji & Beaches)', subtitle: 'Baga, Calangute & Colonial Churches • Goa', lat: 15.4909, lng: 73.8278, type: 'beach' },
  { name: 'Pondicherry (Puducherry)', subtitle: 'French Quarter & Promenade Beach', lat: 11.9416, lng: 79.8083, type: 'beach' },
  { name: 'Varkala Beach', subtitle: 'Arabian Sea Cliff Beach • Thiruvananthapuram, Kerala', lat: 8.7379, lng: 76.7163, type: 'beach' },
  { name: 'Gokarna', subtitle: 'Om Beach & Mahabaleshwar Temple • Uttara Kannada, Karnataka', lat: 14.5479, lng: 74.3188, type: 'beach' },
  { name: 'Tirupati Balaji Temple', subtitle: 'Tirumala Venkateswara Swamy • Tirupati, Andhra Pradesh', lat: 13.6833, lng: 79.3472, type: 'temple' },
  { name: 'Varanasi (Kashi Vishwanath)', subtitle: 'Holy Ganga Ghats & Temples • Uttar Pradesh', lat: 25.3176, lng: 82.9739, type: 'temple' },
  { name: 'Puri Jagannath Temple', subtitle: 'Char Dham Pilgrimage & Golden Beach • Odisha', lat: 19.8049, lng: 85.8179, type: 'temple' },
  { name: 'Rameswaram', subtitle: 'Pamban Bridge & Ramanathaswamy Temple • Tamil Nadu', lat: 9.2876, lng: 79.3129, type: 'temple' },
  { name: 'Somnath Temple', subtitle: 'First Jyotirlinga Shrine • Veraval, Gujarat', lat: 20.8880, lng: 70.4013, type: 'temple' },
  { name: 'Kedarnath Temple', subtitle: 'Holy Himalayan Jyotirlinga • Rudraprayag, Uttarakhand', lat: 30.7352, lng: 79.0669, type: 'temple' },
  { name: 'Shirdi Sai Baba Temple', subtitle: 'Pilgrimage Shrine • Ahmednagar, Maharashtra', lat: 19.7667, lng: 74.4770, type: 'temple' },

  // Major Road Trip Metros & Regional Hubs
  { name: 'Bangalore (Bengaluru)', subtitle: 'Silicon Valley of India • Karnataka', lat: 12.9716, lng: 77.5946, type: 'city' },
  { name: 'Hyderabad', subtitle: 'City of Pearls • Telangana', lat: 17.3850, lng: 78.4867, type: 'city' },
  { name: 'Mumbai', subtitle: 'Financial Capital • Maharashtra', lat: 19.0760, lng: 72.8777, type: 'city' },
  { name: 'Delhi NCR', subtitle: 'National Capital Region • India', lat: 28.6139, lng: 77.2090, type: 'city' },
  { name: 'Jaipur', subtitle: 'Pink City Capital • Rajasthan', lat: 26.9124, lng: 75.7873, type: 'city' },
  { name: 'Chennai', subtitle: 'Marina Beach & Cultural Capital • Tamil Nadu', lat: 13.0827, lng: 80.2707, type: 'city' },
  { name: 'Pune', subtitle: 'Oxford of the East • Maharashtra', lat: 18.5204, lng: 73.8567, type: 'city' },
  { name: 'Kochi (Cochin)', subtitle: 'Queen of the Arabian Sea • Kerala', lat: 9.9312, lng: 76.2673, type: 'city' },
  { name: 'Udaipur', subtitle: 'City of Lakes • Rajasthan', lat: 24.5854, lng: 73.7125, type: 'city' },
  { name: 'Agra', subtitle: 'Mughal Heritage Hub • Uttar Pradesh', lat: 27.1767, lng: 78.0081, type: 'city' },
  { name: 'Ahmedabad', subtitle: 'Sabarmati & Heritage City • Gujarat', lat: 23.0225, lng: 72.5714, type: 'city' },
  { name: 'Coimbatore', subtitle: 'Gateway to Nilgiris & Anaikatti • Tamil Nadu', lat: 11.0168, lng: 76.9558, type: 'city' },
  { name: 'Mangalore', subtitle: 'Coastal Port City & Temples • Karnataka', lat: 12.9141, lng: 74.8560, type: 'city' },
  { name: 'Madurai', subtitle: 'Temple City of Tamil Nadu', lat: 9.9252, lng: 78.1198, type: 'city' },
  { name: 'Chandigarh', subtitle: 'The City Beautiful • Punjab / Haryana', lat: 30.7333, lng: 76.7794, type: 'city' }
];

export const CURATED_GLOBAL_DESTINATIONS = CURATED_INDIAN_DESTINATIONS;

// Clean and categorize OSM result types
function resolvePlaceCategory(item) {
  const cat = (item.category || item.osm_key || '').toLowerCase();
  const type = (item.type || item.osm_value || '').toLowerCase();

  if (cat === 'historic' || type === 'monument' || type === 'fort' || type === 'castle' || type === 'archaeological_site') {
    return { type: 'monument', label: 'Historic Monument' };
  }
  if (type === 'temple' || type === 'place_of_worship' || type === 'mosque' || type === 'church') {
    return { type: 'temple', label: 'Sacred Pilgrimage Site' };
  }
  if (cat === 'natural' || type === 'peak' || type === 'volcano' || type === 'waterfall' || type === 'beach' || type === 'wood' || type === 'valley') {
    return { type: 'nature', label: 'Scenic Nature Escape' };
  }
  if (cat === 'leisure' && (type === 'park' || type === 'nature_reserve' || type === 'garden')) {
    return { type: 'nature', label: 'Park & Scenic Garden' };
  }
  if (cat === 'tourism') {
    return { type: 'attraction', label: 'Tourist Attraction' };
  }
  if (type === 'city' || type === 'town' || type === 'district') {
    return { type: 'city', label: 'City / Urban Hub' };
  }
  return { type: 'destination', label: 'Travel Destination' };
}

// Search Cache for sub-millisecond autocomplete responsiveness
const searchCache = new Map();

/**
 * High-Precision Multi-Source Search Engine for Places in India
 * @param {string} rawQuery User typed query
 * @param {object|null} userLocation Optional { lat, lng } for distance ranking
 * @returns {Promise<Array>} List of clean, geocoded candidate places
 */
export async function searchPlacesIndia(rawQuery, userLocation = null) {
  if (!rawQuery || typeof rawQuery !== 'string') return [];
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const cacheKey = `${query.toLowerCase()}_${userLocation ? userLocation.lat.toFixed(2) + ',' + userLocation.lng.toFixed(2) : 'none'}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey);
  }

  const results = [];
  const seenKeys = new Set();

  function addResult(item) {
    if (!item || !item.name || typeof item.lat !== 'number' || typeof item.lng !== 'number') return;
    const key = `${item.name.toLowerCase()}_${item.lat.toFixed(2)}_${item.lng.toFixed(2)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    let distKm = null;
    let distText = '';
    if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number') {
      distKm = Math.round(calculateHaversineKm(userLocation.lat, userLocation.lng, item.lat, item.lng));
      distText = distKm < 1 ? '<1 km away' : `${distKm.toLocaleString('en-IN')} km away`;
    }

    results.push({
      ...item,
      distKm,
      distText
    });
  }

  const qLower = query.toLowerCase();

  // 1. Fast Scan Curated Database (Highest fidelity for iconic Indian landmarks)
  CURATED_INDIAN_DESTINATIONS.forEach(dest => {
    if (dest.name.toLowerCase().includes(qLower) || (dest.subtitle && dest.subtitle.toLowerCase().includes(qLower))) {
      addResult({
        name: dest.name,
        subtitle: dest.subtitle,
        lat: dest.lat,
        lng: dest.lng,
        type: dest.type,
        categoryLabel: dest.type === 'monument' ? 'Historic Monument' : (dest.type === 'temple' ? 'Sacred Shrine' : (dest.type === 'nature' ? 'Hill Station / Nature' : 'Destination')),
        isCurated: true
      });
    }
  });

  // 2. High-Accuracy Global Nominatim Search (Monuments, Cities & Attractions Worldwide)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&q=${encodeURIComponent(query)}`;
    const nomRes = await fetch(nomUrl, {
      headers: { 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(3500)
    });

    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData)) {
        // Prioritize actual monuments, attractions, places of worship, nature and cities
        const sortedData = [...nomData].sort((a, b) => {
          const catA = resolvePlaceCategory(a);
          const catB = resolvePlaceCategory(b);
          const score = (c) => c.type === 'monument' ? 5 : (c.type === 'temple' || c.type === 'nature') ? 4 : (c.type === 'attraction' || c.type === 'city') ? 3 : 1;
          return score(catB) - score(catA);
        });

        sortedData.forEach(item => {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          if (isNaN(lat) || isNaN(lng)) return;

          const addr = item.address || {};
          const cleanName = item.name || addr.attraction || addr.historic || addr.tourism || addr.amenity || addr.city || item.display_name.split(',')[0].trim();
          
          const localityParts = [
            addr.suburb || addr.neighbourhood,
            addr.city || addr.town || addr.village || addr.county || addr.state_district,
            addr.state,
            addr.country
          ].filter(Boolean);
          
          const uniqueLocality = [...new Set(localityParts)].slice(0, 3).join(', ');
          const catInfo = resolvePlaceCategory(item);

          addResult({
            name: cleanName,
            subtitle: uniqueLocality ? `${catInfo.label} • ${uniqueLocality}` : catInfo.label,
            lat,
            lng,
            type: catInfo.type,
            categoryLabel: catInfo.label,
            isCurated: false
          });
        });
      }
    }
  } catch (err) {
    console.warn('[SearchService] Nominatim query error:', err);
  }

  // 3. Fallback to Photon Komoot API if results are still sparse (< 4)
  if (results.length < 4) {
    try {
      let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6`;
      if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number') {
        photonUrl += `&lat=${userLocation.lat}&lon=${userLocation.lng}`;
      }
      const photonRes = await fetch(photonUrl, { signal: AbortSignal.timeout(3000) });
      if (photonRes.ok) {
        const photonJson = await photonRes.json();
        if (photonJson && Array.isArray(photonJson.features)) {
          photonJson.features.forEach(feat => {
            const props = feat.properties || {};
            // Filter strictly for India
            if (props.countrycode && props.countrycode.toUpperCase() !== 'IN') return;
            if (props.country && props.country.toLowerCase() !== 'india' && !props.state) return;

            const coords = feat.geometry && feat.geometry.coordinates;
            if (!coords || coords.length < 2) return;
            const lng = coords[0];
            const lat = coords[1];

            const name = props.name || props.city || props.street || query;
            const sub = [props.city || props.district || props.county, props.state].filter(Boolean).join(', ');
            const catInfo = resolvePlaceCategory({ category: props.osm_key, type: props.osm_value });

            addResult({
              name,
              subtitle: sub ? `${catInfo.label} • ${sub}` : `${catInfo.label} • India`,
              lat,
              lng,
              type: catInfo.type,
              categoryLabel: catInfo.label,
              isCurated: false
            });
          });
        }
      }
    } catch (err) {
      console.warn('[SearchService] Photon query error:', err);
    }
  }

  // Sort & Rank: Curated & exact prefix matches first, then proximity
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase().startsWith(qLower);
    const bExact = b.name.toLowerCase().startsWith(qLower);
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    if (a.isCurated && !b.isCurated) return -1;
    if (!a.isCurated && b.isCurated) return 1;

    if (a.distKm != null && b.distKm != null) {
      return a.distKm - b.distKm;
    }
    return 0;
  });

  const finalCandidates = results.slice(0, 6);
  searchCache.set(cacheKey, finalCandidates);
  return finalCandidates;
}
