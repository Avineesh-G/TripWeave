# TripWeave

**Deterministic Road Trip Planning & Feasibility Engine for India**

TripWeave is a map-first trip planning system built specifically for multi-stop Indian road trips. Instead of simply plotting static routes, TripWeave deterministically computes whether a planned road trip is realistically achievable within time and budget limits, tracks attraction closing hours, itemizes costs with verified data provenance, and provides an instant one-tap schedule fixer.

---

## Key Highlights

- **Deterministic Feasibility Engine:** Evaluates overall trip viability into three distinct states: Feasible, Tight, or Infeasible.
- **Zero-Cost Open-Source Stack:** Powered by OpenStreetMap (OSM), OSRM routing, and Photon geocoding, with optional Google Maps SDK support.
- **Multilingual Support (4 Indian Languages):** Full native localization in English, Telugu (తెలుగు), Hindi (हिन्दी), and Tamil (தமிழ்).
- **Attraction Operating Hours & "Plan Accordingly":** Detects closed monuments upon arrival and shifts departure time with one tap to clear scheduling conflicts.
- **Transparent Provenance Budgeting:** Itemized costs labeled with verified sources (NHAI Tolls, State Fuel Rates, Homestays).
- **Export & Road Book Engine:** Generates WhatsApp-ready itineraries, printable offline Road Book PDFs with Indian highway emergency numbers (112, 1033, 108), and offline JSON backups.
- **Dual-Platform Architecture:** Android Multi-Module Jetpack Compose application co-located with a rapid Vite web testbed.

---

## Supported Languages

TripWeave supports 100% localized string resources across four languages, switchable in real-time without application restart:

| Language | Native Name | Script Coverage |
| :--- | :--- | :--- |
| **English** | English | Complete interface, navigation, and reports |
| **Telugu** | తెలుగు | Native typography via Noto Sans Telugu |
| **Hindi** | हिन्दी | Native typography via Noto Sans Devanagari |
| **Tamil** | தமிழ் | Native typography via Noto Sans Tamil |

---

## How TripWeave Works: The Core Workflow

TripWeave operates across five deterministic calculation layers:

```
[1. Route & Places] ──> [2. Operating Hours] ──> [3. Feasibility Check] ──> [4. Transparent Budget] ──> [5. Export & Road Book]
    OSRM Routing            Indian Registry          Arrival vs Closing         Fuel + Toll + Stays         WhatsApp / PDF
```

### 1. Route Planning & Geocoding
- Uses Photon (OpenStreetMap) for real-time place search across Indian states, cities, and landmarks.
- Fetches driving highway geometries from the Open Source Routing Machine (OSRM), returning road polyline coordinates, accurate distances (km), and realistic drive times based on Indian highway speeds.

### 2. Operating Hours Verification & Conflict Detection
- Integrates a built-in operating hours registry for major Indian monuments and parks (Mysore Palace, Abbey Falls, Namdroling Monastery, Virupaksha Temple, Amer Fort, Hawa Mahal, Shore Temple, etc.).
- Evaluates arrival windows against closing times and parking buffers to identify:
  - `OPEN_ON_ARRIVAL`: Arrival satisfies full planned visit and buffer.
  - `TIGHT_CLOSING`: Arrival leaves less than 30 minutes before gate closure.
  - `CLOSED_ON_ARRIVAL`: User arrives after destination gates have closed.

### 3. One-Tap "Plan Accordingly" Engine
- When an attraction closure conflict is detected, the user can tap **Plan Accordingly**.
- The algorithm calculates the exact time difference required, automatically moves the trip departure time earlier, recalculates highway transit times, and transitions the overall status back to **Feasible**.

### 4. Transparent Provenance Budgeting
- **Fuel Math:** `(Total Highway Distance / Vehicle Mileage) * State Fuel Price`.
- **Itemized Categories:** FASTag tolls (NHAI rate card), homestays/resorts, highway meals, and forest passes.
- **Scenario Analysis:** Instant calculation across **Low**, **Typical**, and **High** scenarios with per-person expense splitting.

### 5. Export & Sharing
- **WhatsApp Format:** Formats the entire road trip schedule, timings, per-person share, and ghat road daylight advisories for 1-tap messaging.
- **Printable Road Book:** Clean print layout omitting UI controls, displaying emergency contact helplines (112 National Emergency, 1033 NHAI Road Assistance, 108 Medical Ambulance).
- **Offline JSON:** Full itinerary data download for offline backup.

---

## Security & API Key Protection

TripWeave follows strict security protocols to prevent API key exposure and eliminate unexpected billing charges:

1. **Excluded from Version Control:**
   - All private keys are stored in `local.properties` (for Android) or `.env` (for web).
   - `.gitignore` strictly blocks `local.properties`, `.env`, keystore files (`*.jks`, `*.keystore`), and build artifacts from ever being committed to Git.

2. **Gradle Build Injection:**
   - The Android build reads `MAPS_API_KEY` dynamically from `local.properties` at compile time and injects it into `BuildConfig` and `AndroidManifest.xml` via manifest placeholders.
   - Source code files contain zero hardcoded secrets.

3. **Built-in Free Fallback:**
   - If no Google Cloud key is supplied, TripWeave defaults to Leaflet, OpenStreetMap, OSRM, and Photon, guaranteeing 100% free functionality without credit card or billing requirements.

---

## Repository Structure

```
TripWeave/
├── app/                      # Android Application module
│   ├── src/main/kotlin/      # MainActivity, Navigation, Compose screens
│   └── src/main/res/         # Android manifest and application assets
├── core/
│   ├── model/                # Pure Kotlin domain entities (Trip, TripStop, Expense, Provenance)
│   ├── planning/             # Pure Kotlin planning core (ScheduleEngine, BudgetEngine, FeasibilityEvaluator)
│   ├── providers/            # Place search and routing provider interfaces
│   ├── designsystem/         # "Soft Tonal" Material 3 design tokens, components, and multilingual strings
│   └── database/             # Offline Room SQLite database, DAOs, and KSP processor
├── src/                      # Co-located Web Testbed
│   ├── main.js               # Web app logic, OSRM routing, Photon search, Export engine
│   ├── engines.js            # Pure JavaScript implementation of core planning engines
│   ├── data.js               # Translations and storage abstraction
│   └── style.css             # Soft Tonal CSS design system (mobile-first 414px shell)
├── index.html                # Single-page web testbed interface
├── local.properties          # Private local SDK and API credentials (git-ignored)
└── build.gradle.kts          # Root multi-module Gradle build definition
```

---

## How to Build & Run

### 1. Web Testbed

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

Open `http://localhost:5173/` in your browser.

### 2. Android Application

#### Prerequisites
- JDK 17
- Android SDK (API 34, minSdk 26)

#### Run Core Planning Tests
```bash
./gradlew test
```

#### Build Debug APK
```bash
./gradlew :app:assembleDebug
```

The compiled APK will be located at:
`app/build/outputs/apk/debug/app-debug.apk`

---

## Technical Specifications

- **Design System:** Soft Tonal (Material You palette, primary `#3B5FCC`, light canvas `#FAFAFD`, dark secondary `#111318`).
- **Icons:** Pure SVG vector graphics across all components (zero emojis).
- **Typography:** Plus Jakarta Sans with tabular numeric figures (`tnum`).
- **Mobile Viewport:** Clean 414px mobile frame with zero clipping and floating island navigation bar.
- **Licensing:** Open-source for collaborative development.
