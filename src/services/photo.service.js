// ==========================================================================
// TripWeave — Authentic Place & Monument Photo Service
// Strictly authentic photography: Verified monuments & genuine Wikipedia records.
// Zero random/unrelated images — returns null when no verified photo exists.
// ==========================================================================

const PHOTO_CACHE_KEY = 'tripweave_authentic_photo_cache_v3';
const memoryCache = new Map();

// Load persistent cache from localStorage and actively wipe outdated/fallback caches
try {
  localStorage.removeItem('tripweave_photo_cache_v1');
  localStorage.removeItem('tripweave_authentic_photo_cache_v2');
  localStorage.removeItem('tripweave_place_photos');
  const stored = localStorage.getItem(PHOTO_CACHE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    Object.entries(parsed).forEach(([k, v]) => {
      // Safeguard: Ensure no unauthentic/random fallback images are kept in cache
      if (v && v.thumbUrl && v.thumbUrl.includes('photo-1469854523086')) return;
      memoryCache.set(k, v);
    });
  }
} catch (e) {}

function saveToPersistentCache(key, data) {
  memoryCache.set(key, data);
  try {
    const obj = {};
    const entries = Array.from(memoryCache.entries()).slice(-80);
    entries.forEach(([k, v]) => { obj[k] = v; });
    localStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(obj));
  } catch (e) {}
}

/**
 * Curated, verified high-resolution photography for renowned Indian monuments,
 * historic landmarks, and premier travel destinations.
 */
export const VERIFIED_PLACE_PHOTOS = {
  'taj mahal': {
    thumbUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
    title: 'Taj Mahal',
    description: '17th-century white marble mausoleum and UNESCO World Heritage Site in Agra.',
    source: 'verified'
  },
  'india gate': {
    thumbUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=1200&q=80',
    title: 'India Gate',
    description: 'National war memorial archway commemorating Indian soldiers in New Delhi.',
    source: 'verified'
  },
  'qutub minar': {
    thumbUrl: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80',
    title: 'Qutub Minar',
    description: '73-metre minaret of red sandstone built in 1192 in Mehrauli, Delhi.',
    source: 'verified'
  },
  'red fort': {
    thumbUrl: 'https://images.unsplash.com/photo-1598324789736-4861f89564a0?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1598324789736-4861f89564a0?auto=format&fit=crop&w=1200&q=80',
    title: 'Red Fort',
    description: 'Historic Mughal fortress in Old Delhi constructed in red sandstone.',
    source: 'verified'
  },
  'gateway of india': {
    thumbUrl: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80',
    title: 'Gateway of India',
    description: 'Colonial basalt arch monument erected in 1924 overlooking Mumbai harbour.',
    source: 'verified'
  },
  'hawa mahal': {
    thumbUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=80',
    title: 'Hawa Mahal',
    description: 'Palace of Winds built of red and pink sandstone in Jaipur.',
    source: 'verified'
  },
  'mysore palace': {
    thumbUrl: 'https://images.unsplash.com/photo-1600100397608-f010f443a532?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1600100397608-f010f443a532?auto=format&fit=crop&w=1200&q=80',
    title: 'Mysore Palace',
    description: 'Historical Indo-Saracenic royal palace of the Wadiyar dynasty in Mysuru.',
    source: 'verified'
  },
  'charminar': {
    thumbUrl: 'https://images.unsplash.com/photo-1605007493699-ce65834f8a00?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1605007493699-ce65834f8a00?auto=format&fit=crop&w=1200&q=80',
    title: 'Charminar',
    description: '16th-century landmark mosque with four grand minarets in Hyderabad.',
    source: 'verified'
  },
  'golden temple': {
    thumbUrl: 'https://images.unsplash.com/photo-1514222134-b57cbb8ce073?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1514222134-b57cbb8ce073?auto=format&fit=crop&w=1200&q=80',
    title: 'Golden Temple (Harmandir Sahib)',
    description: 'Preeminent spiritual shrine of Sikhism in Amritsar, Punjab.',
    source: 'verified'
  },
  'ooty': {
    thumbUrl: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1200&q=80',
    title: 'Ooty (Udhagamandalam)',
    description: 'Queen of Hill Stations in the Nilgiris with tea gardens and mountain lakes.',
    source: 'verified'
  },
  'goa': {
    thumbUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80',
    title: 'Goa Coastline',
    description: 'Arabian Sea coastline celebrated for white sand beaches and historic forts.',
    source: 'verified'
  },
  'coorg': {
    thumbUrl: 'https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?auto=format&fit=crop&w=1200&q=80',
    title: 'Coorg (Madikeri)',
    description: 'Western Ghats hill district with coffee plantations, forests, and waterfalls.',
    source: 'verified'
  },
  'munnar': {
    thumbUrl: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80',
    title: 'Munnar',
    description: 'Picturesque hill station in Kerala famous for rolling green tea estates.',
    source: 'verified'
  },
  'manali': {
    thumbUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
    title: 'Manali',
    description: 'Himalayan mountain resort in Himachal Pradesh with pine forests and snow peaks.',
    source: 'verified'
  },
  'jaipur': {
    thumbUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=80',
    title: 'Jaipur (Pink City)',
    description: 'Historic royal capital of Rajasthan known for amber palaces and city architecture.',
    source: 'verified'
  },
  'udaipur': {
    thumbUrl: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=1200&q=80',
    title: 'Udaipur (City of Lakes)',
    description: 'Romantic historic destination surrounded by Lake Pichola and the City Palace.',
    source: 'verified'
  },
  // Iconic World Monuments & Premier Global Travel Destinations
  'eiffel tower': {
    thumbUrl: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=1200&q=80',
    title: 'Eiffel Tower',
    description: 'World-famous 19th-century wrought-iron lattice tower on the Champ de Mars in Paris, France.',
    source: 'verified'
  },
  'colosseum': {
    thumbUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
    title: 'Colosseum',
    description: 'Ancient Roman amphitheatre and UNESCO World Heritage Wonder of the World in Rome, Italy.',
    source: 'verified'
  },
  'statue of liberty': {
    thumbUrl: 'https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?auto=format&fit=crop&w=1200&q=80',
    title: 'Statue of Liberty',
    description: 'Colossal neoclassical sculpture on Liberty Island in New York Harbor, United States.',
    source: 'verified'
  },
  'great wall of china': {
    thumbUrl: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1200&q=80',
    title: 'Great Wall of China',
    description: 'Ancient defensive fortification traversing northern China and UNESCO World Wonder.',
    source: 'verified'
  },
  'pyramids of giza': {
    thumbUrl: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?auto=format&fit=crop&w=1200&q=80',
    title: 'Pyramids of Giza',
    description: 'Ancient wonder of the world including the Great Pyramid and Sphinx in Giza, Egypt.',
    source: 'verified'
  },
  'machu picchu': {
    thumbUrl: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1200&q=80',
    title: 'Machu Picchu',
    description: '15th-century Inca citadel perched on a mountain ridge in the Cusco Region of Peru.',
    source: 'verified'
  },
  'petra': {
    thumbUrl: 'https://images.unsplash.com/photo-1579606032834-deffd4252656?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1579606032834-deffd4252656?auto=format&fit=crop&w=1200&q=80',
    title: 'Petra (Rose City)',
    description: 'Historic Nabataean city famous for rock-cut architecture and water conduit systems in Jordan.',
    source: 'verified'
  },
  'big ben': {
    thumbUrl: 'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?auto=format&fit=crop&w=1200&q=80',
    title: 'Big Ben & Westminster',
    description: 'Elizabeth Tower and Palace of Westminster along the River Thames in London, UK.',
    source: 'verified'
  },
  'christ the redeemer': {
    thumbUrl: 'https://images.unsplash.com/photo-1598977123118-4e30ba3c4f5b?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1598977123118-4e30ba3c4f5b?auto=format&fit=crop&w=1200&q=80',
    title: 'Christ the Redeemer',
    description: 'Art Deco statue of Jesus Christ atop Mount Corcovado overlooking Rio de Janeiro, Brazil.',
    source: 'verified'
  },
  'sydney opera house': {
    thumbUrl: 'https://images.unsplash.com/photo-1523059623039-a9ed027e7fad?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1523059623039-a9ed027e7fad?auto=format&fit=crop&w=1200&q=80',
    title: 'Sydney Opera House',
    description: 'Multi-venue performing arts centre and architectural marvel on Sydney Harbour, Australia.',
    source: 'verified'
  },
  'burj khalifa': {
    thumbUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
    title: 'Burj Khalifa',
    description: 'World tallest megatall skyscraper standing at 828 metres in Downtown Dubai, UAE.',
    source: 'verified'
  },
  'sagrada familia': {
    thumbUrl: 'https://images.unsplash.com/photo-1583779457094-0cef987b7c25?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1583779457094-0cef987b7c25?auto=format&fit=crop&w=1200&q=80',
    title: 'Sagrada Família',
    description: 'Antoni Gaudí extraordinary modernist basílica and UNESCO World Heritage Site in Barcelona, Spain.',
    source: 'verified'
  },
  'acropolis': {
    thumbUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=1200&q=80',
    title: 'Acropolis of Athens',
    description: 'Ancient citadel containing the Parthenon and monuments of classical Greek civilization in Athens.',
    source: 'verified'
  },
  'louvre': {
    thumbUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1200&q=80',
    title: 'Louvre Museum',
    description: 'National art museum and iconic glass pyramid located on the Right Bank of Paris, France.',
    source: 'verified'
  },
  'grand canyon': {
    thumbUrl: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?auto=format&fit=crop&w=1200&q=80',
    title: 'Grand Canyon National Park',
    description: 'Steep-sided canyon carved by the Colorado River in Arizona, United States.',
    source: 'verified'
  },
  'mount fuji': {
    thumbUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
    title: 'Mount Fuji',
    description: 'Sacred active stratovolcano and highest peak in Japan, renowned for its symmetrical snow cone.',
    source: 'verified'
  },
  'niagara falls': {
    thumbUrl: 'https://images.unsplash.com/photo-1533094602577-199e35114234?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1533094602577-199e35114234?auto=format&fit=crop&w=1200&q=80',
    title: 'Niagara Falls',
    description: 'Group of three massive waterfalls spanning the international border between Canada and the US.',
    source: 'verified'
  },
  'santorini': {
    thumbUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80',
    title: 'Santorini (Thira)',
    description: 'Cycladic island in the Aegean Sea celebrated for whitewashed villages and volcanic sunsets.',
    source: 'verified'
  },
  'venice': {
    thumbUrl: 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=400&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=1200&q=80',
    title: 'Venice (Grand Canal)',
    description: 'Historic city built on more than 100 small islands in a lagoon in the Adriatic Sea, Italy.',
    source: 'verified'
  }
};

/**
 * Normalizes query string for Wikipedia lookup (e.g., "Ooty, Tamil Nadu" -> "Ooty")
 */
function cleanQueryTerm(placeName) {
  if (!placeName) return '';
  return placeName
    .split(',')[0]
    .replace(/\(.*?\)/g, '')
    .trim();
}

/**
 * Fetches an authentic, verified photo for a place or monument.
 * Returns { thumbUrl, fullUrl, title, description, source } or NULL if no genuine photo exists.
 * STRICTURE: NEVER returns a random or generic placeholder image.
 */
export async function fetchPlacePhoto(placeName) {
  if (!placeName) return null;
  const cleanTerm = cleanQueryTerm(placeName);
  if (!cleanTerm || cleanTerm.length < 2) return null;

  const cacheKey = cleanTerm.toLowerCase();

  // 1. Check in-memory / localStorage cache
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey); // Can be null if previously confirmed absent
  }

  // 2. Check verified curated list
  for (const [key, photoObj] of Object.entries(VERIFIED_PLACE_PHOTOS)) {
    if (cacheKey.includes(key) || key.includes(cacheKey)) {
      saveToPersistentCache(cacheKey, photoObj);
      return photoObj;
    }
  }

  // 3. Query Wikipedia REST API for authentic encyclopedic photography
  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTerm.replace(/\s+/g, '_'))}`;
    const res = await fetch(wikiUrl, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      // Only accept if Wikipedia returned a standard page with an actual image
      if (data.type === 'standard' && data.thumbnail && data.thumbnail.source) {
        const titleMatch = data.title && (
          data.title.toLowerCase().includes(cacheKey) ||
          cacheKey.includes(data.title.toLowerCase())
        );

        if (titleMatch) {
          const result = {
            thumbUrl: data.thumbnail.source,
            fullUrl: data.originalimage ? data.originalimage.source : data.thumbnail.source,
            title: data.title || cleanTerm,
            description: data.extract ? (data.extract.slice(0, 140) + '...') : `${cleanTerm}, India`,
            photographer: 'Wikimedia Commons',
            source: 'wikimedia'
          };
          saveToPersistentCache(cacheKey, result);
          return result;
        }
      }
    }
  } catch (e) {
    // Network or timeout notice
  }

  // 4. Strict: No authentic photo found -> return NULL. Do NOT apply random pictures.
  saveToPersistentCache(cacheKey, null);
  return null;
}
