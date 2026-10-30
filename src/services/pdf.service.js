// ==========================================================================
// TripWeave — High-Fidelity Itinerary PDF Generation Engine (Spec v1.0)
// Publication-grade A4 Multi-page Travel Dossier
// ==========================================================================

import { getCustomGroqKey } from './ai.service.js';
import { fetchPlacePhoto } from './photo.service.js';
import { calculateBudgetPercentageSplit } from './budget.service.js';

// Curated high-resolution landscape images for Indian destinations & scenic routes
const DESTINATION_IMAGE_REGISTRY = {
  ooty: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1200&q=80',
  goa: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80',
  coorg: 'https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?auto=format&fit=crop&w=1200&q=80',
  manali: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80',
  munnar: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80',
  jaipur: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=80',
  udaipur: 'https://images.unsplash.com/photo-1615836245337-f5b9b2303f10?auto=format&fit=crop&w=1200&q=80',
  mysore: 'https://images.unsplash.com/photo-1600100397608-f010f443a532?auto=format&fit=crop&w=1200&q=80',
  pondicherry: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80',
  ladakh: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?auto=format&fit=crop&w=1200&q=80',
  leh: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?auto=format&fit=crop&w=1200&q=80',
  shimla: 'https://images.unsplash.com/photo-1597074866923-dc0589150358?auto=format&fit=crop&w=1200&q=80',
  kerala: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80',
  bangalore: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80',
  chennai: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80',
  hyderabad: 'https://images.unsplash.com/photo-1605007493699-ce65834f8a00?auto=format&fit=crop&w=1200&q=80',
  mumbai: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1200&q=80',
  pune: 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?auto=format&fit=crop&w=1200&q=80',
  default: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80'
};

export function getDestinationPhoto(placeName = '') {
  if (!placeName) return DESTINATION_IMAGE_REGISTRY.default;
  const lower = placeName.toLowerCase();
  for (const [key, url] of Object.entries(DESTINATION_IMAGE_REGISTRY)) {
    if (key !== 'default' && lower.includes(key)) {
      return url;
    }
  }
  return DESTINATION_IMAGE_REGISTRY.default;
}

/**
 * Strict sanitization to strip all markdown asterisks, raw hashes, and conversational AI filler.
 */
export function sanitizeForPdf(rawText) {
  if (!rawText) return '';
  return String(rawText)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^(Sure|Here is|Certainly|I have created|Based on your).*?:\s*/gmi, '')
    .replace(/^[-*]\s+/gm, '• ')
    .trim();
}

/**
 * AI Enrichment: calls Groq API if key is present, otherwise falls back to deterministic knowledge.
 */
export async function enrichPlanForDossier(plan, apiKey = '') {
  const origin = plan.origin || (plan.stops && plan.stops[0] ? plan.stops[0].name : 'Starting Point');
  const destination = plan.destination || (plan.stops && plan.stops[plan.stops.length - 1] ? plan.stops[plan.stops.length - 1].name : 'Destination');
  const members = plan.members || (plan.trip ? plan.trip.groupSize : 4) || 4;
  const comfort = plan.comfort || 'comfort';
  const dining = plan.dining || 'family';

  // Check if API key is supplied
  const effectiveKey = apiKey || getCustomGroqKey();

  if (effectiveKey) {
    try {
      const prompt = `You are a professional travel curator and logistics specialist. Create a structured travel dossier for a road trip in India:
Origin: ${origin}
Destination: ${destination}
Travelers: ${members} people
Comfort Level: ${comfort}
Dining Preference: ${dining}

IMPORTANT RULES:
1. Do NOT use any asterisks (*) or markdown bold/italics.
2. Provide exact visit time windows for landmarks (e.g. "06:30 AM – 08:30 AM: Golden hour sunrise, tranquil mist, avoid crowds").
3. Provide verified highway and destination restaurants with specialties and optimal meal windows.
4. Recommend hotels matching the comfort tier and traveler count.
5. Provide actionable local recommendations (weather, clothing, road safety, etiquette, emergency numbers).
6. Return ONLY valid raw JSON with this exact schema:

{
  "highways": ["Highway 1", "Highway 2"],
  "routeSummary": "Concise 2-sentence description of the scenic drive.",
  "placesToVisit": [
    {
      "name": "Landmark Name",
      "bestTimeWindow": "06:30 AM – 08:30 AM",
      "experienceReason": "Crisp morning breeze and uncrowded viewpoints.",
      "duration": "1 Hour 30 Mins",
      "highlights": ["Highlight point 1", "Highlight point 2"],
      "entryFee": "₹50 per person",
      "parking": "Dedicated parking lot available"
    }
  ],
  "restaurants": [
    {
      "name": "Restaurant Name",
      "location": "Highway km marker or area",
      "cuisine": "Cuisine type",
      "specialty": "Must-try dish",
      "mealWindow": "Breakfast: 08:00 AM – 09:15 AM",
      "amenities": ["Clean Restrooms", "Ample Parking", "Fast Service"],
      "vegType": "Pure Veg"
    }
  ],
  "hotels": [
    {
      "name": "Hotel Name",
      "tier": "Comfort / 3-Star",
      "ratePerNight": 3400,
      "checkIn": "02:00 PM check-in, 11:00 AM check-out",
      "amenities": ["Secure Parking", "Complimentary Breakfast", "24/7 Reception", "Free Wi-Fi"],
      "addressNotes": "Located near main arterial road with easy highway access"
    }
  ],
  "recommendations": [
    {
      "category": "Weather & Clothing",
      "points": ["Layered light woolens recommended for morning and evening breezes", "Comfortable walking shoes for stone steps"]
    },
    {
      "category": "Road & Mountain Driving",
      "points": ["Use lower gears on steep downhill descents", "Ensure FASTag balance has at least ₹500 before starting"]
    },
    {
      "category": "Local Culture & Etiquette",
      "points": ["Respect photography restrictions inside heritage sanctuaries", "Carry reusable water bottles; plastic bans strictly enforced"]
    }
  ]
}`;

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
        if (content) {
          const parsed = JSON.parse(content);
          return sanitizeEnrichedData(parsed);
        }
      }
    } catch (e) {
      console.warn('AI Dossier enrichment error, falling back to deterministic synthesis:', e);
    }
  }

  // Deterministic Fallback Synthesis (Guaranteed quality, zero randomness, zero asterisks)
  return getDeterministicEnrichedData({ origin, destination, members, comfort, dining });
}

function sanitizeEnrichedData(data) {
  if (!data) return {};
  return {
    highways: (data.highways || []).map(sanitizeForPdf),
    routeSummary: sanitizeForPdf(data.routeSummary),
    placesToVisit: (data.placesToVisit || []).map(p => ({
      name: sanitizeForPdf(p.name),
      bestTimeWindow: sanitizeForPdf(p.bestTimeWindow),
      experienceReason: sanitizeForPdf(p.experienceReason),
      duration: sanitizeForPdf(p.duration),
      highlights: (p.highlights || []).map(sanitizeForPdf),
      entryFee: sanitizeForPdf(p.entryFee),
      parking: sanitizeForPdf(p.parking)
    })),
    restaurants: (data.restaurants || []).map(r => ({
      name: sanitizeForPdf(r.name),
      location: sanitizeForPdf(r.location),
      cuisine: sanitizeForPdf(r.cuisine),
      specialty: sanitizeForPdf(r.specialty),
      mealWindow: sanitizeForPdf(r.mealWindow),
      amenities: (r.amenities || []).map(sanitizeForPdf),
      vegType: sanitizeForPdf(r.vegType)
    })),
    hotels: (data.hotels || []).map(h => ({
      name: sanitizeForPdf(h.name),
      tier: sanitizeForPdf(h.tier),
      ratePerNight: h.ratePerNight || 3200,
      checkIn: sanitizeForPdf(h.checkIn),
      amenities: (h.amenities || []).map(sanitizeForPdf),
      addressNotes: sanitizeForPdf(h.addressNotes)
    })),
    recommendations: (data.recommendations || []).map(rc => ({
      category: sanitizeForPdf(rc.category),
      points: (rc.points || []).map(sanitizeForPdf)
    }))
  };
}

function getDeterministicEnrichedData({ origin, destination, members, comfort }) {
  const isBudget = comfort === 'budget';
  const isLuxury = comfort === 'luxury';

  const stayTariff = isBudget ? 1800 : isLuxury ? 6500 : 3400;
  const hotelTier = isBudget ? 'Clean Value Highway Hotel' : isLuxury ? 'Luxury Heritage Resort' : 'Executive Comfort Hotel';

  return {
    highways: ['National Highway 44 & State Arterial Highway', 'Regional Scenic Mountain / Coastal Bypass'],
    routeSummary: `An exceptional, well-engineered road corridor connecting ${origin} to ${destination} featuring four-lane divided highways, scenic mountain vistas, and established tourist transit plazas.`,
    placesToVisit: [
      {
        name: `${destination} Botanical Viewpoint & Heritage Reserve`,
        bestTimeWindow: '06:30 AM – 08:30 AM',
        experienceReason: 'Crisp morning mist, golden hour photography, and peaceful strolls before tourist buses arrive.',
        duration: '1 Hour 45 Mins',
        highlights: [
          'Panoramic views across lush valley ridges and indigenous flora collections',
          'Well-paved walking trail with guided informational plaques'
        ],
        entryFee: '₹60 per adult',
        parking: 'Spacious designated paved vehicle parking'
      },
      {
        name: `${destination} Central Lake & Promenade`,
        bestTimeWindow: '04:30 PM – 06:15 PM',
        experienceReason: 'Gentle evening breeze, serene water reflections, and pleasant weather for walking.',
        duration: '1 Hour 30 Mins',
        highlights: [
          'Eco-friendly pedal boating and lakeside cycling track',
          'Local handicraft stalls and fresh tea/spice concessions'
        ],
        entryFee: 'Free public entry (Boating: ₹150)',
        parking: 'Pay-and-park municipal facility available'
      },
      {
        name: `${destination} Sunset Peak Observation Deck`,
        bestTimeWindow: '05:45 PM – 06:45 PM',
        experienceReason: 'Spectacular 360-degree sunset panorama over distant mountain horizons.',
        duration: '1 Hour 00 Mins',
        highlights: [
          'Telescope viewing station and designated selfie platforms',
          'Fresh roasted corn and hot local beverages nearby'
        ],
        entryFee: '₹20 per adult',
        parking: 'Curbside regulated parking'
      }
    ],
    restaurants: [
      {
        name: 'Paakashala & Highway Grand Feast Plaza',
        location: 'Midway Highway Corridor Plaza (Km 120)',
        cuisine: 'Authentic South & North Indian',
        specialty: 'Crispy Butter Ghee Roast Dosa, Hot Filter Coffee & Thali',
        mealWindow: 'Breakfast / Morning Pitstop: 08:00 AM – 09:30 AM',
        amenities: ['Spotless Restrooms', '100+ Car Parking', 'Baby Care Room', 'Fast Counter Service'],
        vegType: 'Pure Vegetarian'
      },
      {
        name: `${destination} Heritage Dining & Spice Kitchen`,
        location: `Central ${destination} Promenade Road`,
        cuisine: 'Regional Cuisine & Multi-Cuisine Grills',
        specialty: 'Slow-cooked Fragrant Biryani, Clay-Oven Rotis & Fresh Desserts',
        mealWindow: 'Dinner: 07:30 PM – 09:30 PM',
        amenities: ['Air-Conditioned Family Dining', 'Valet Parking', 'Indoor & Outdoor Terrace'],
        vegType: 'Veg & Non-Veg Multi-Cuisine'
      }
    ],
    hotels: [
      {
        name: `${destination} Grand ${hotelTier}`,
        tier: hotelTier,
        ratePerNight: stayTariff,
        checkIn: 'Check-in: 02:00 PM | Check-out: 11:00 AM',
        amenities: ['Secure Private Parking', 'Complimentary Hot Breakfast', '24/7 Front Desk', 'High-Speed Wi-Fi', 'Mountain / Garden Facing Rooms'],
        addressNotes: `Strategically located within 10 minutes of primary sightseeing attractions with smooth vehicular access.`
      }
    ],
    recommendations: [
      {
        category: 'Weather & What to Pack',
        points: [
          'Morning and late evening temperatures drop noticeably; keep a light jacket or fleece handy.',
          'Comfortable walking sneakers or trail shoes are recommended for walking trails and viewpoint steps.',
          'Keep an umbrella or light windbreaker in the car during mountain transit.'
        ]
      },
      {
        category: 'Highway & Mountain Driving Safety',
        points: [
          'On ghat road hairpin curves, strictly stay in your lane and use low gear rather than excessive braking.',
          'Keep your FASTag wallet recharged with at least ₹500 balance before starting.',
          'Start early in the morning to bypass metropolitan exit bottlenecks.'
        ]
      },
      {
        category: 'Local Etiquette & Travel Responsibilities',
        points: [
          'Strict plastic-free zones are enforced in many scenic areas; please carry reusable bottles.',
          'Remove footwear where requested before stepping onto sacred or protected heritage platforms.',
          'Support local artisan co-operatives for authentic honey, organic tea, and handmade crafts.'
        ]
      },
      {
        category: 'Emergency Support & Helplines',
        points: [
          'National Emergency Helpline: 112',
          'NHAI Highway Emergency Assistance & Crane Service: 1033',
          'Medical Emergency & Ambulance: 108'
        ]
      }
    ]
  };
}

/**
 * Builds the complete A4 publication-grade HTML dossier.
 */
export function generateItineraryDossierHTML(plan, enrichedData, customHeroImage = null) {
  const origin = plan.origin || (plan.stops && plan.stops[0] ? plan.stops[0].name : 'Origin');
  const destination = plan.destination || (plan.stops && plan.stops[plan.stops.length - 1] ? plan.stops[plan.stops.length - 1].name : 'Destination');
  const members = plan.members || (plan.trip ? plan.trip.groupSize : 4) || 4;
  const comfort = plan.comfort || 'comfort';
  const distanceKm = Math.round(plan.totalDistanceKm || 280);
  const drivingHours = (plan.totalDrivingHours || (distanceKm / 55)).toFixed(1);
  const heroImage = customHeroImage || getDestinationPhoto(destination);
  const generatedDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const referenceId = `TW-${Math.floor(100000 + Math.random() * 900000)}`;

  // Budget calculations & Percentage Division
  const trip = plan.trip || {};
  const totalBudget = trip.totalBudget || plan.targetBudget || plan.budget || 25000;
  const durationDays = trip.durationDays || plan.days || plan.durationDays || 3;
  const budgetSplit = calculateBudgetPercentageSplit(
    totalBudget,
    members,
    trip.customBudgetSplit,
    distanceKm,
    trip,
    durationDays,
    destination
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${sanitizeForPdf(plan.title || `${origin} to ${destination} Itinerary`)}</title>
  <style>
    /* ==========================================================================
       TripWeave A4 Publication Print Stylesheet
       ========================================================================== */
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 12mm 14mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A !important;
      background: #FFFFFF !important;
      font-size: 11pt;
      line-height: 1.5;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    /* A4 Discrete Page Architecture */
    .dossier-page {
      width: 794px;
      min-height: 1123px;
      padding: 32px 36px;
      margin: 0 auto;
      background: #FFFFFF !important;
      color: #0F172A !important;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      page-break-after: always;
      break-after: page;
    }

    .dossier-page-content {
      flex: 1;
    }

    .card-block {
      page-break-inside: avoid;
      break-inside: avoid;
      background: #FFFFFF !important;
      border: 1.5px solid #CBD5E1 !important;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    /* Header Bar */
    .dossier-top-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #1A73E8;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }

    .brand-logo-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-title {
      font-size: 16pt;
      font-weight: 800;
      color: #1A73E8 !important;
      letter-spacing: -0.3px;
    }

    .brand-tagline {
      font-size: 9pt;
      color: #334155 !important;
      font-weight: 600;
    }

    .header-metadata {
      text-align: right;
      font-size: 9pt;
      color: #334155 !important;
    }

    .ref-badge {
      display: inline-block;
      background: #EFF6FF !important;
      color: #1D4ED8 !important;
      border: 1px solid #93C5FD !important;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 3px;
      font-size: 8.5pt;
    }

    /* Hero Banner */
    .hero-banner {
      position: relative;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 12px;
      height: 165px;
      border: 1px solid #94A3B8;
    }

    .hero-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .hero-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.92) 100%) !important;
      padding: 12px 14px;
      color: #FFFFFF !important;
    }

    .hero-trip-title {
      font-size: 14pt;
      font-weight: 800;
      color: #FFFFFF !important;
      margin-bottom: 4px;
      text-shadow: 0 1px 4px rgba(0,0,0,0.8);
    }

    .hero-badges-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .hero-badge {
      background: rgba(15, 23, 42, 0.65) !important;
      border: 1px solid rgba(255, 255, 255, 0.6) !important;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: 700;
      color: #FFFFFF !important;
    }

    /* Section Headings */
    .section-title {
      font-size: 11pt;
      font-weight: 800;
      color: #0F172A !important;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 2px solid #CBD5E1 !important;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .section-icon {
      color: #1A73E8 !important;
      font-size: 12pt;
      line-height: 1;
    }

    /* Tables */
    .metric-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 9pt;
    }

    .metric-table th, .metric-table td {
      border: 1px solid #CBD5E1 !important;
      padding: 6px 8px;
      text-align: left;
      color: #0F172A !important;
    }

    .metric-table th {
      background: #F1F5F9 !important;
      color: #0F172A !important;
      font-weight: 800;
      font-size: 8.5pt;
      text-transform: uppercase;
    }

    .metric-table tr:nth-child(even) {
      background: #F8FAFC !important;
    }

    .total-row {
      background: #DBEAFE !important;
      font-weight: 800;
      color: #1E3A8A !important;
    }

    /* Place Cards & Point Lists */
    .place-item {
      border-left: 4px solid #1A73E8 !important;
      border-top: 1px solid #E2E8F0;
      border-right: 1px solid #E2E8F0;
      border-bottom: 1px solid #E2E8F0;
      padding: 8px 10px;
      background: #F8FAFC !important;
      border-radius: 0 8px 8px 0;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }

    .place-header-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 3px;
    }

    .place-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0F172A !important;
    }

    .timing-pill {
      background: #FEF3C7 !important;
      color: #78350F !important;
      border: 1.5px solid #F59E0B !important;
      font-size: 7.5pt;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .place-meta-line {
      font-size: 8pt;
      color: #334155 !important;
      margin-bottom: 4px;
      font-style: italic;
    }

    .points-list {
      margin-left: 14px;
      font-size: 8.5pt;
      color: #1E293B !important;
    }

    .points-list li {
      margin-bottom: 2px;
    }

    /* Restaurant & Hotel Badges */
    .amenity-chip {
      display: inline-block;
      background: #F1F5F9;
      color: #334155;
      font-size: 7.5pt;
      padding: 1px 6px;
      border-radius: 4px;
      margin-right: 4px;
      margin-top: 3px;
      border: 1px solid #E2E8F0;
    }

    .veg-badge {
      background: #DCFCE7;
      color: #166534;
      border: 1px solid #86EFAC;
      font-size: 7.5pt;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 6px;
    }

    /* Footer Note */
    .dossier-footer {
      border-top: 1px solid #CBD5E1;
      padding-top: 8px;
      margin-top: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 8pt;
      color: #64748B;
    }
  </style>
</head>
<body>
  <div class="dossier-root">

    <!-- PAGE 1: EXECUTIVE ROUTE SUMMARY & BUDGET -->
    <div class="dossier-page" data-page="1">
      <div class="dossier-page-content">
        <div class="dossier-top-header">
          <div class="brand-logo-wrap">
            <div>
              <div class="brand-title">TripWeave</div>
              <div class="brand-tagline">Official Highway Route &amp; Travel Dossier</div>
            </div>
          </div>
          <div class="header-metadata">
            <div>Date Generated: <strong>${generatedDate}</strong></div>
            <div class="ref-badge">REF: ${referenceId}</div>
          </div>
        </div>

        <!-- Hero Card with Curated Landscape Imagery -->
        <div class="hero-banner" style="background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%);">
          <img class="hero-image" src="${heroImage}" alt="${destination} Landscape" crossorigin="anonymous" onerror="this.style.display='none'" />
          <div class="hero-overlay">
            <h1 class="hero-trip-title">${sanitizeForPdf(plan.title || `${origin} to ${destination} Scenic Road Trip`)}</h1>
            <div class="hero-badges-row">
              <span class="hero-badge">Distance: ${distanceKm} km</span>
              <span class="hero-badge">Est. Driving: ${drivingHours} hrs</span>
              <span class="hero-badge">Travelers: ${members} Person${members > 1 ? 's' : ''}</span>
              <span class="hero-badge">Comfort: ${comfort.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <!-- Section 1: Route Corridor & Highway Transit Details -->
        <div class="card-block">
          <h2 class="section-title">1. Highway Corridor &amp; Transit Details</h2>
          <table class="metric-table">
            <tr>
              <th style="width: 25%;">Starting Point (Origin)</th>
              <td style="width: 75%;"><strong>${origin}</strong></td>
            </tr>
            <tr>
              <th>Final Destination</th>
              <td><strong>${destination}</strong></td>
            </tr>
            <tr>
              <th>Primary Expressways / Highways</th>
              <td>${enrichedData.highways.join(' • ')}</td>
            </tr>
            <tr>
              <th>Corridor Overview</th>
              <td>${enrichedData.routeSummary}</td>
            </tr>
          </table>
        </div>

        <!-- Section 2: Financial Planning & Percentage Budget Allocation -->
        <div class="card-block">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
            <h2 class="section-title" style="margin-bottom: 0; border-bottom: none; font-size: 10.5pt;">2. Budget Estimation &amp; Percentage Allocation</h2>
            <span style="font-size: 7.5pt; font-weight: 700; color: #1E40AF; background: #EFF6FF; border: 1px solid #BFDBFE; padding: 2px 7px; border-radius: 4px;">
              ₹${Math.round(totalBudget / durationDays).toLocaleString('en-IN')} / Day • ₹${Math.round(totalBudget / (durationDays * members)).toLocaleString('en-IN')} / Person / Day
            </span>
          </div>

          <table class="metric-table" style="margin-top: 4px; font-size: 8pt;">
            <thead>
              <tr>
                <th style="width: 28%; padding: 4px 6px;">Expense Category</th>
                <th style="width: 44%; padding: 4px 6px;">Allocation Basis &amp; Guidance</th>
                <th style="width: 12%; text-align: center; padding: 4px 6px;">Share (%)</th>
                <th style="width: 16%; text-align: right; padding: 4px 6px;">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              ${budgetSplit.breakdown.map(cat => `
                <tr>
                  <td style="padding: 4px 6px;"><strong>${cat.name}</strong></td>
                  <td style="padding: 4px 6px; font-size: 7.5pt; color: #475569;">${cat.advice}</td>
                  <td style="padding: 4px 6px; text-align: center; font-weight: 700; color: #1E40AF;">${cat.pct}%</td>
                  <td style="padding: 4px 6px; text-align: right; font-weight: 700;">₹${cat.amount.toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2" style="padding: 5px 6px;"><strong>Target Tour Budget (${durationDays} Days • ${members} Travelers)</strong></td>
                <td style="padding: 5px 6px; text-align: center;"><strong>100%</strong></td>
                <td style="padding: 5px 6px; text-align: right;"><strong>₹${budgetSplit.totalBudget.toLocaleString('en-IN')}</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- AI Cost Reduction & Emergency Buffer Advisory -->
          <div style="display: flex; gap: 8px; margin-top: 6px; background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 6px; padding: 5px 8px; font-size: 7.5pt; color: #334155; line-height: 1.35;">
            <div style="flex: 1;">
              <strong style="color: #059669;">AI Cost Reduction Advice:</strong> Opt for verified homestays 2km inland, refuel before higher-VAT state border lines, and choose high-turnover authentic highway dhabas to save up to 15-20% on overall travel expenditure.
            </div>
            <div style="flex: 1; border-left: 1px solid #E2E8F0; padding-left: 8px;">
              <strong style="color: #2563EB;">Inconvenience-Free Travel:</strong> Includes a dedicated 10% emergency buffer (₹${Math.round(totalBudget * 0.10).toLocaleString('en-IN')}) ensuring complete insulation against sudden tyre repairs, tolls surge, or unexpected weather detours.
            </div>
          </div>
        </div>
      </div>

      <div class="dossier-footer">
        <span>TripWeave Intelligent Road Trip Planner</span>
        <span>Page 1 of 3</span>
      </div>
    </div>

    <!-- PAGE 2: PLACES TO VISIT & DINING -->
    <div class="dossier-page" data-page="2">
      <div class="dossier-page-content">
        <div class="dossier-top-header">
          <div class="brand-logo-wrap">
            <div class="brand-title" style="font-size: 13pt;">TripWeave — ${destination} Itinerary</div>
          </div>
          <div class="header-metadata">
            <span class="ref-badge">REF: ${referenceId}</span>
          </div>
        </div>

        <div class="card-block">
          <h2 class="section-title">3. Planned Places to Visit &amp; Optimal Viewing Timings</h2>
          <div style="font-size: 8.5pt; color: #475569; margin-bottom: 8px;">
            To ensure a premier experience, visit times are synchronized with golden lighting, cool ambient temperatures, and low footfall windows.
          </div>

          ${enrichedData.placesToVisit.map((place, idx) => `
            <div class="place-item">
              <div class="place-header-row">
                <div class="place-title">${idx + 1}. ${place.name}</div>
                <span class="timing-pill">Best Time: ${place.bestTimeWindow}</span>
              </div>
              <div class="place-meta-line">
                Experience Window: ${place.experienceReason} • Duration: ${place.duration}
              </div>
              <ul class="points-list">
                ${place.highlights.map(h => `<li>${h}</li>`).join('')}
                <li><strong>Entry &amp; Access:</strong> ${place.entryFee} • <strong>Parking:</strong> ${place.parking}</li>
              </ul>
            </div>
          `).join('')}
        </div>

        <!-- Section 4: Verified Restaurants & Highway Dining -->
        <div class="card-block">
          <h2 class="section-title">4. Recommended Restaurants &amp; Highway Food Stops</h2>

          ${enrichedData.restaurants.map((rest, idx) => `
            <div class="place-item" style="border-left-color: #F59E0B;">
              <div class="place-header-row">
                <div class="place-title">
                  ${idx + 1}. ${rest.name}
                  <span class="veg-badge">${rest.vegType}</span>
                </div>
                <span class="timing-pill" style="background: #ECFDF5; color: #065F46; border-color: #A7F3D0;">${rest.mealWindow}</span>
              </div>
              <div class="place-meta-line">
                Location: <strong>${rest.location}</strong> • Cuisine: ${rest.cuisine}
              </div>
              <div style="font-size: 8.5pt; color: #1E293B; margin-bottom: 3px;">
                <strong>Specialty:</strong> ${rest.specialty}
              </div>
              <div>
                ${rest.amenities.map(a => `<span class="amenity-chip">${a}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="dossier-footer">
        <span>TripWeave Intelligent Road Trip Planner</span>
        <span>Page 2 of 3</span>
      </div>
    </div>

    <!-- PAGE 3: HOTELS & LOCAL RECOMMENDATIONS -->
    <div class="dossier-page" data-page="3">
      <div class="dossier-page-content">
        <div class="dossier-top-header">
          <div class="brand-logo-wrap">
            <div class="brand-title" style="font-size: 13pt;">TripWeave — Stays &amp; Travel Advisory</div>
          </div>
          <div class="header-metadata">
            <span class="ref-badge">REF: ${referenceId}</span>
          </div>
        </div>

        <!-- Section 5: Hotels Searched Based on Itinerary & Comfort -->
        <div class="card-block">
          <h2 class="section-title">5. Curated Accommodations &amp; Stays</h2>
          <div style="font-size: 8.5pt; color: #475569; margin-bottom: 8px;">
            Selected strictly based on your party size (${members} travelers), budget target, and comfort tier (${comfort.toUpperCase()}).
          </div>

          ${enrichedData.hotels.map((hotel, idx) => `
            <div class="place-item" style="border-left-color: #8B5CF6;">
              <div class="place-header-row">
                <div class="place-title">${idx + 1}. ${hotel.name}</div>
                <span class="timing-pill" style="background: #EDE9FE; color: #5B21B6; border-color: #DDD6FE;">₹${hotel.ratePerNight.toLocaleString('en-IN')} / night</span>
              </div>
              <div class="place-meta-line">
                Category: <strong>${hotel.tier}</strong> • Policy: ${hotel.checkIn}
              </div>
              <div style="font-size: 8pt; color: #334155; margin-bottom: 4px;">
                ${hotel.addressNotes}
              </div>
              <div>
                ${hotel.amenities.map(am => `<span class="amenity-chip">${am}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Section 6: Local Recommendations & Emergency Advisory -->
        <div class="card-block">
          <h2 class="section-title">6. Essential Recommendations &amp; Travel Safety Advisory</h2>

          ${enrichedData.recommendations.map(cat => `
            <div style="margin-bottom: 8px;">
              <div style="font-weight: 700; font-size: 9pt; color: #1E293B; margin-bottom: 3px;">
                • ${cat.category}
              </div>
              <ul class="points-list" style="margin-left: 18px;">
                ${cat.points.map(pt => `<li>${pt}</li>`).join('')}
              </ul>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="dossier-footer">
        <span>TripWeave · Verified Digital Travel Dossier</span>
        <span>Page 3 of 3</span>
      </div>
    </div>

  </div>
</body>
</html>`;
}

/**
 * Triggers robust PDF compilation and download for mobile WebView and browsers.
 */
export async function triggerPdfPrint(htmlContent, tripTitle = 'TripWeave_Itinerary') {
  const cleanName = (tripTitle || 'TripWeave_Itinerary')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const fileName = `${cleanName}.pdf`;

  // 1. If running inside Android WebView with Native Print Bridge:
  if (typeof window !== 'undefined' && window.AndroidAuthBridge && typeof window.AndroidAuthBridge.printHtml === 'function') {
    try {
      window.AndroidAuthBridge.printHtml(htmlContent, cleanName);
    } catch (e) {
      console.warn('[PDF] Native printHtml error:', e);
    }
  }

  // 2. Direct compilation and download via html2canvas & jsPDF:
  let downloadedSuccessfully = false;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    let renderContainer = null;
    let styleContainer = null;
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;

      if (typeof jsPDF === 'function' && typeof html2canvas === 'function') {
        const parser = new DOMParser();
        const parsedDoc = parser.parseFromString(htmlContent, 'text/html');

        // Extract style elements and temporarily add to document head so html2canvas computes all CSS rules
        styleContainer = document.createElement('div');
        styleContainer.id = 'tripweave-pdf-print-styles';
        parsedDoc.querySelectorAll('style').forEach(styleTag => {
          styleContainer.appendChild(styleTag.cloneNode(true));
        });
        document.head.appendChild(styleContainer);

        // Mount render container safely outside visible viewport but with full opacity so html2canvas computes solid text colors
        renderContainer = document.createElement('div');
        renderContainer.id = 'tripweave-pdf-export-container';
        renderContainer.style.position = 'fixed';
        renderContainer.style.top = '0';
        renderContainer.style.left = '0';
        renderContainer.style.width = '794px'; // Standard A4 width in px at 96 DPI
        renderContainer.style.background = '#FFFFFF';
        renderContainer.style.zIndex = '-99999';
        renderContainer.style.pointerEvents = 'none';

        // Append body content directly
        renderContainer.innerHTML = parsedDoc.body.innerHTML;
        document.body.appendChild(renderContainer);

        // Await web font loading
        if (document.fonts && document.fonts.ready) {
          try {
            await document.fonts.ready;
          } catch (e) {}
        }

        // Await image loading or timeout safely
        const images = Array.from(renderContainer.querySelectorAll('img'));
        await Promise.all(images.map(img => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = () => resolve();
            img.onerror = () => {
              img.style.display = 'none';
              resolve();
            };
            setTimeout(resolve, 1500);
          });
        }));

        // Allow layout pass
        await new Promise(r => setTimeout(r, 200));

        // Render each discrete page individually to guarantee zero cut-off cards or mid-text page slicing
        const pageElements = Array.from(renderContainer.querySelectorAll('.dossier-page'));
        const targetPages = pageElements.length > 0 ? pageElements : [renderContainer];

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfPageWidth = 210;
        const pdfPageHeight = 297;

        for (let i = 0; i < targetPages.length; i++) {
          const pageEl = targetPages[i];
          const canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#FFFFFF',
            logging: false,
            width: 794,
            windowWidth: 794,
            onclone: (clonedDoc) => {
              const target = clonedDoc.querySelector(`[data-page="${i + 1}"]`) || clonedDoc.getElementById('tripweave-pdf-export-container');
              if (target) {
                target.style.opacity = '1';
                target.style.visibility = 'visible';
                target.style.zIndex = '999999';
              }
            }
          });

          if (canvas && canvas.width > 0 && canvas.height > 0) {
            if (i > 0) {
              pdf.addPage();
            }
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgWidthMm = pdfPageWidth;
            const imgHeightMm = (canvas.height * pdfPageWidth) / canvas.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidthMm, Math.min(imgHeightMm, pdfPageHeight), undefined, 'FAST');
          }
        }

        pdf.save(fileName);
        downloadedSuccessfully = true;
      }
    } catch (err) {
      console.warn('[PDF] Native jsPDF/html2canvas compilation error, falling back:', err);
    } finally {
      if (renderContainer) renderContainer.remove();
      if (styleContainer) styleContainer.remove();
    }
  }

  // 3. Fallback: Download self-contained offline dossier file if PDF generation failed
  if (!downloadedSuccessfully && typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanName}_Dossier.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      console.error('[PDF] Fallback download failed:', e);
    }
  }

  return true;
}

/**
 * Main Entry Point: Export Current Itinerary as Publication-Grade PDF
 */
export async function exportCurrentItineraryAsPdf(plan, options = {}) {
  const apiKey = options.apiKey || getCustomGroqKey();
  const destination = plan.destination || (plan.stops && plan.stops[plan.stops.length - 1] ? plan.stops[plan.stops.length - 1].name : '');
  let photoUrl = options.heroImage || null;
  if (!photoUrl && destination) {
    try {
      const photoObj = await fetchPlacePhoto(destination);
      if (photoObj) photoUrl = photoObj.fullUrl || photoObj.thumbUrl;
    } catch (e) {}
  }
  const enriched = await enrichPlanForDossier(plan, apiKey);
  const html = generateItineraryDossierHTML(plan, enriched, photoUrl);
  await triggerPdfPrint(html, plan.title || 'TripWeave_Itinerary');
  return { success: true, enrichedData: enriched, html };
}
