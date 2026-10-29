# TripWeave — High-Fidelity Itinerary PDF Generation Plan

**Document Version:** 1.0  
**Target Module:** `src/services/pdf.service.js` & `src/ui/modals.ui.js`  
**Status:** Pending Review

---

## 1. Executive Summary

TripWeave requires a structured, publication-grade PDF itinerary export engine. When a user creates an itinerary and has their API key configured, tapping **Export as PDF** will generate an elegant, multi-page travel dossier.

### Key Objectives
* **Zero Markdown Artifacts:** No raw asterisks (`**bold**`), hashtags (`###`), or chat preambles. Clean, semantic HTML/typography only.
* **Strict Box Containment:** Every card, table, and list item is constrained with strict width, padding, word-breaking, and page-break rules so no text or borders ever spill outside page margins.
* **Point-by-Point Structured Presentation:** Information organized in bordered cards, structured bullet points, and clean key-value grids.
* **Visual Enrichment:** High-resolution place and attraction photography, route badges, and vector icons.
* **Deterministic & Grounded:** AI generates structured JSON strictly matching the user’s route, destination, preferences, and verified stops—zero randomness or hallucinations.

---

## 2. Document Sections & Structure

The PDF will be formatted as a standard **A4 Portrait** dossier with a consistent design system (indigo accent `#1A73E8`, charcoal text `#1E293B`, and light border `#E2E8F0`).

### Page 1: Trip Overview & Executive Summary
1. **Dossier Header & Brand Identity:**
   * TripWeave logo & title: *"Official Travel Itinerary & Route Dossier"*
   * Itinerary Title (e.g., *"Bangalore to Ooty Scenic Mountain Drive"*)
   * Generation timestamp and unique Trip Reference ID.
2. **Hero Cover Card & Destination Photo:**
   * Curated high-resolution landscape photo of the destination.
   * Quick badges: Total Distance (km), Estimated Driving Time, Total Travel Days, Party Size.
3. **Route Metrics & Budget Table:**
   * **Origin:** Starting location name & coordinates.
   * **Destination:** Final destination name & coordinates.
   * **Major Transit Highway:** Expressways & national highways (e.g., NH 44, Mysore Expressway).
   * **Expense Breakdown Grid:**
     * Estimated Fuel Cost (calculated from distance and mileage).
     * Estimated Fastag Tolls.
     * Planned Stay & Accommodation.
     * Planned Dining & Meals.
     * **Total Estimated Budget.**

---

### Page 2: Scheduled Sightseeing & Attractions (Places to Visit)
* **Organized in chronological order (Day-by-Day or Stop-by-Stop).**
* For every landmark or attraction:
  * **Landmark Name & Category:** (e.g., *Botanical Garden — Nature & Sightseeing*).
  * **Ideal Visit Window:** Explicit time of day for the best experience:
    * *Example:* `06:30 AM – 08:30 AM: Golden hour lighting, crisp mountain air, avoid peak tour bus crowds.`
    * *Example:* `04:30 PM – 06:15 PM: Sunset viewing point, moderate foot traffic.`
  * **Recommended Duration:** (e.g., *1 Hour 45 Minutes*).
  * **Visitor Highlights (in clean bullet points):**
    * Key photo spots and viewpoints.
    * Entry ticket details (approximate pricing per adult).
    * Parking availability & walking requirements.
  * **Thumbnail Photo:** Clean image of the landmark aligned beside the details.

---

### Page 3: Dining & Highway Restaurants
* **Curated selection of verified dining stops along the highway corridor and at the destination.**
* For every restaurant:
  * **Restaurant Name & Location:** (e.g., *Paakashala — Mandya Highway Plaza*).
  * **Cuisine & Specialties:** (e.g., *South Indian Veg, Filter Coffee, Thatte Idli*).
  * **Optimal Meal Timing:** (e.g., *Ideal for Breakfast / Morning Pitstop between 08:00 AM – 09:30 AM*).
  * **Key Amenities:** Restrooms, ample parking, family seating, UPI payment accepted.
  * **Hygiene & Rating Badge:** Cleanliness rating & vegetarian/non-vegetarian availability.

---

### Page 4: Accommodations & Curated Stays
* **Matched directly against user inputs in the itinerary (party size, budget tier, comfort level):**
* For each recommended accommodation:
  * **Hotel / Resort Name:** (e.g., *Sterling Ooty Fern Hill*).
  * **Category & Comfort Tier:** Budget / Comfort / Premium Luxury.
  * **Matched Pricing:** Estimated room tariff per night based on selected party size.
  * **Check-in / Check-out Timings:** Standard policy (e.g., *Check-in: 02:00 PM | Check-out: 11:00 AM*).
  * **Verified Amenities:** Parking, in-house restaurant, hot water, Wi-Fi, mountain view.
  * **Booking / Contact Guidance:** Direct address and landmark navigation notes.

---

### Page 5: Local Recommendations, Etiquette & Travel Advisory
* **Points-based guidance tailored to the destination:**
  * **Seasonal Weather & Clothing:** What to wear, rain gear requirements, temperature range.
  * **Route Conditions & Road Advisory:** Ghat road hairpin curves, night driving restrictions, toll plaza tips.
  * **Local Culture & Etiquette:** Temple dress codes, photography permissions, plastic-free zones.
  * **Emergency Helpline Card:**
    * National Emergency Services: `112`
    * Highway Patrol & Assistance: `1033`
    * Medical / Ambulance: `108`

---

## 3. Strict Formatting & Quality Engineering

To guarantee zero mistakes and publication-grade output:

### A. Markdown Sanitization Pipeline (`sanitizeForPdf()`)
Before any text is inserted into the PDF template, it passes through an automated filter:
```javascript
function sanitizeForPdf(rawText) {
  if (!rawText) return '';
  return rawText
    // Remove markdown bold / italics asterisks
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    // Remove markdown headers
    .replace(/^#+\s+/gm, '')
    // Remove conversational AI artifacts ("Sure!", "Here is your plan...")
    .replace(/^(Sure|Here is|Certainly|I have created).*?:/gmi, '')
    // Clean bullet symbols to consistent dots
    .replace(/^[-*]\s+/gm, '• ')
    .trim();
}
```

### B. Box-Containment & Overflow Prevention
* **CSS Grid & Flexbox Limits:** All cells have fixed percentages with `overflow: hidden; text-overflow: ellipsis;` and `word-break: break-word;`.
* **Page-Break Rules:**
  ```css
  @media print {
    .pdf-card { page-break-inside: avoid; break-inside: avoid; }
    .pdf-page { page-break-after: always; break-after: page; }
    body { margin: 0; padding: 0; }
  }
  ```
* **Print Geometry:** Standard A4 boundaries (`210mm x 297mm`) with `12mm` safe-printable margins on all 4 sides.

### C. Zero Randomness (Deterministic AI Schema)
* Prompt uses `temperature: 0.1` and `response_format: { type: "json_object" }`.
* The AI is strictly instructed to return structured JSON adhering to the exact TypeScript interface:
  ```typescript
  interface PdfItineraryData {
    tripTitle: string;
    route: { origin: string; destination: string; totalKm: number; drivingHours: number; highways: string[] };
    bestVisitTimings: { landmark: string; bestTime: string; reason: string; duration: string; highlights: string[] }[];
    restaurants: { name: string; location: string; specialty: string; mealWindow: string; perks: string[] }[];
    hotels: { name: string; tier: string; ratePerNight: number; checkIn: string; amenities: string[] }[];
    recommendations: { category: string; items: string[] }[];
  }
  ```

---

## 4. API Key Verification & Workflow

```
[User clicks 'Export as PDF']
          │
          ▼
Is API Key set in Settings?
     ├── NO  ──► Opens API Key Modal: "Enter your free API key in Settings to generate the full dossier"
     │           (With quick fallback: Instant Basic PDF without AI enrichment)
     │
     └── YES ──► 1. Show elegant loading overlay ("Synthesizing High-Detail PDF Dossier...")
                 2. Call Groq AI with JSON Schema constraint
                 3. Fetch curated location photography (Unsplash Travel API / Wikimedia CDN)
                 4. Render high-res printable DOM template
                 5. Trigger instant Native PDF Download / Print dialog
                 6. Hide loading overlay & display success notification
```

---

## 5. Technical Implementation Steps

1. **Step 1: Service Creation (`src/services/pdf.service.js`)**
   * Implements `generateItineraryPdf(plan, apiKey)`.
   * Houses the HTML print template generator with embedded inline styles, fonts, and borders.
2. **Step 2: AI Itinerary Enrichment Prompt**
   * Extends `src/services/ai.service.js` with `enrichPlanForDossier(plan)`.
   * Fetches the 6 required modules (timings, restaurants, stays, tips) in structured JSON.
3. **Step 3: Location Photo Service**
   * Lightweight helper that pulls high-quality royalty-free landscape imagery matching the destination name and stops.
4. **Step 4: UI Trigger in Modal (`src/ui/modals.ui.js`)**
   * Replaces the simple `window.print()` in `#btn-export-pdf` with the full dossier generation flow and loading progress indicators.

---

## 6. Verification & Review Checklist
- [ ] Are all 6 sections (route, origin-destination, visit timings, restaurants, hotels, tips) present?
- [ ] Are all asterisks (`*`) and AI conversational artifacts completely removed?
- [ ] Does text wrap gracefully without overflowing table borders or page edges?
- [ ] Do images load crisply without breaking layout?
- [ ] Does the API key check gracefully guide unconfigured users?
