# TripWeave

**Autonomous Road Trip Planning & Feasibility Engine for India (v1.6.0)**

TripWeave is an intelligent, map-first itinerary planning system engineered specifically for multi-stop Indian road trips. Built with official Google Maps (Survey of India sovereign border compliance), Google Authentication, and Google Cloud Firestore database synchronization, TripWeave deterministically computes whether a planned road trip is realistically achievable within time and budget constraints, tracks attraction operating hours, provides daylight buffer management, and itemizes expenses with verified data provenance.

---

## What's New in Release v1.6.0

- 🏗️ **Re-Engineered Modular Architecture:** Completely modularized the monolithic codebase into high-performance, single-responsibility ES services (`map`, `routing`, `scheduler`, `budget`, `ai`, `auth`, `updater`) and dedicated UI controllers (`navigation`, `sheet`, `directions`, `timeline`, `budget`, `modals`, `auth`).
- 🔄 **Permanent Update Loop Elimination:** Implemented native Android `getAppVersionCode()` and `getAppVersionName()` bridge interfaces with OS-level `PackageManager` verification and 24-hour dismissal caching, permanently resolving recurring update dialogs.
- 🗺️ **Clean Startup & Zero Mock Data:** Clean, full-bleed Google Retina map on startup with zero random pins or synthetic dhabas. Map displays only high-resolution tiles and the traveler's authentic location dot until an origin or destination is actively set.
- 📍 **Hardware-Calibrated GPS Accuracy:** Direct hardware GPS fix with pulsing radar halo and accuracy ring. Background location tracking is throttled and silent, eliminating repetitive reverse-geocoding toast notifications.
- 🧭 **Highway Route Guidance & Authentic Corridor Stops:** Instant OSRM highway routing with turn-by-turn navigation HUD, live simulated driving preview, and authentic corridor query (hotels, dhabas, 24x7 fuel & EV plazas) along the route corridor with Google Maps deep-links and 1-tap "+ Add Stop" integration.
- 🤖 **Interactive Itinerary AI Assistant:** Embedded conversational road trip planner inside the Itinerary tab prompting for group size, target budget, hotel comfort tier (Budget Homestay / 3-Star Comfort / Luxury Resort), and dining preferences (Highway Dhabas / Pure Veg / Family Multi-Cuisine) powered by Groq Llama 3.3.
- 💰 **Synchronized Itemized Budget Engine:** Real-time deterministic formulas for Fuel (`(Distance / Mileage) * Fuel Price`), FASTag Tolls, Stays, and Meals with transparent provenance and per-head split calculator.
- 📱 **Floating Island Dock & Enlarge/Enclose Sheet:** Floating glassmorphic bottom navigation dock (`.app-nav`) with standard safe-area padding. The bottom trip card floats cleanly above the dock and features a dedicated `Enlarge` / `Enclose` toggle, ensuring navigation tabs are never obstructed.
- 🎨 **100% Vector SVG Iconography:** Complete replacement of emoji artifacts with crisp, scalable vector SVG icons throughout the application.

---

## Key Highlights

- **Deterministic Feasibility Engine:** Evaluates overall trip viability into three distinct states: Feasible, Tight, or Infeasible.
- **Google Authentication Only:** Strict Google OAuth 2.0 authentication gate with session persistence (guest login disabled for data security).
- **Cloud Firestore Database Sync:** Real-time multi-device synchronization of trips, waypoints, itineraries, and expenses under isolated user paths (`users/{userId}/trips`).
- **One-Time Privacy Policy & Terms Onboarding:** Transparent pre-login consent explaining requested device permissions (GPS location, local storage) and sovereign data protection.
- **Official Indian Sovereign Maps:** 100% Survey of India compliant (`gl=IN`) with complete sovereign borders for Jammu & Kashmir, Ladakh, and Arunachal Pradesh.
- **Authentic Google Location Dot:** Pulsing blue location dot with white border, radar halo, directional beam, and calibrated accuracy circle.
- **Attraction Operating Hours & Conflict Detection:** Built-in hours registry for major Indian heritage sites with arrival-time conflict warnings.
- **Multilingual Support (4 Indian Languages):** Full native localization in English, Telugu, Hindi, and Tamil.
- **Export & Road Book Engine:** Generates WhatsApp-ready itineraries, printable offline Road Book PDFs with Indian emergency helplines (112, 1033, 108), and JSON backups.
- **Dual-Platform Architecture:** Android Multi-Module Jetpack Compose application co-located with a rapid Vite web testbed.

---

## Languages & Technologies Used

TripWeave is built using a modern, dual-platform technology stack:

| Layer | Language / Technology | Purpose |
| :--- | :--- | :--- |
| **Android Client** | Kotlin, Jetpack Compose | Native Android application with declarative UI and Material 3 design tokens |
| **Core Architecture** | Kotlin Multiplatform (KMP) | Shared deterministic engines (`ScheduleEngine`, `BudgetEngine`, `FeasibilityEvaluator`) |
| **Local Database** | Room, SQLite, KSP | Android local persistence with type-safe DAOs and schema migrations |
| **Web Application** | JavaScript (ES Modules), HTML5, CSS3 | Rapid single-page web client with pure Vanilla CSS design system |
| **Cloud Backend & DB** | Google Cloud Firestore | Real-time NoSQL cloud database for user trips, stops, and budgets |
| **Identity & Security** | Google Firebase Authentication | OAuth 2.0 Google Sign-In with isolated per-user security rules |
| **Map Rendering** | Google Maps Tiles, Leaflet | High-DPI map viewport with Survey of India compliant boundaries |
| **Build System** | Gradle (Kotlin DSL), Vite | Android multi-module build toolchain and Vite web bundler |

---

## Supported Indian Languages

TripWeave supports 100% localized string resources across four languages, switchable in real-time without application restart:

| Language | Native Script | Script Coverage |
| :--- | :--- | :--- |
| **English** | English | Complete interface, navigation, and export reports |
| **Telugu** | Noto Sans Telugu | Native typography for Telangana and Andhra Pradesh |
| **Hindi** | Noto Sans Devanagari | Standard Hindi interface across northern and central states |
| **Tamil** | Noto Sans Tamil | Native typography for Tamil Nadu |

---

## Core Application Workflow

```
[1. Privacy & Terms] ──> [2. Google Auth] ──> [3. Route & Places] ──> [4. Operating Hours] ──> [5. Feasibility & Budget] ──> [6. Cloud Firestore]
   One-time consent         OAuth 2.0             Google / OSRM          Indian Registry          Arrival vs Closing           Live Multi-Device
   for new users           Strict guard           Survey of India         Buffer check             Fuel + Toll + Stays          Database Sync
```

---

## Repository Structure

```
TripWeave/
├── app/                          # Android Application module (Jetpack Compose & WebView Host)
│   ├── src/main/kotlin/          # MainActivity, Native JavaScript Interfaces & Bridges
│   ├── src/main/assets/          # Bundled web assets (index.html, JS/CSS bundles)
│   └── src/main/res/             # Android manifest, launcher icons, and resources
├── core/
│   ├── model/                    # Pure Kotlin domain entities (Trip, TripStop, Expense, Provenance)
│   ├── planning/                 # Pure Kotlin planning core (ScheduleEngine, BudgetEngine, FeasibilityEvaluator)
│   ├── providers/                # Place search and routing provider interfaces
│   ├── designsystem/             # Soft Tonal Material 3 design tokens, components, and multilingual strings
│   └── database/                 # Offline Room SQLite database, DAOs, and KSP processor
├── src/                          # Modular Web Application (ES Modules)
│   ├── main.js                   # Application coordinator & service bootstrapper
│   ├── state.js                  # Centralized reactive state store
│   ├── icons.js                  # Pure SVG vector icon library (zero emojis)
│   ├── services/
│   │   ├── map.service.js        # Leaflet map, 2x Retina Google tiles, GPS blue dot, layers
│   │   ├── routing.service.js    # OSRM highway routing, polyline decoder, corridor POIs
│   │   ├── scheduler.service.js  # Timeline computation, visiting hours check, ghat buffers
│   │   ├── budget.service.js     # Itemized budget math, fuel formulas, per-person split
│   │   ├── ai.service.js         # Groq Llama 3.3 cascade & deterministic fallback
│   │   ├── auth.service.js       # Android native Google sign-in bridge & Firestore sync
│   │   ├── export.service.js     # WhatsApp summary, JSON backup, and printable Road Book
│   │   ├── guidance.service.js   # Turn-by-turn guidance engine & voice simulation
│   │   └── updater.service.js    # In-app APK OTA updates & version verification
│   ├── ui/
│   │   ├── navigation.ui.js      # Floating navigation dock & tab router
│   │   ├── sheet.ui.js           # Floating trip card with Enlarge / Enclose controls
│   │   ├── directions.ui.js      # Map directions box & route proposal HUD
│   │   ├── timeline.ui.js        # Itinerary timeline list & time steppers
│   │   ├── budget.ui.js          # Budget category cards & expense editor
│   │   ├── modals.ui.js          # Dialog manager (Stop details, Settings, Update)
│   │   └── auth.ui.js            # Google Auth Gate and User Profile UI
│   ├── firebase.js               # Firebase Modular SDK service (Auth & Cloud Firestore sync)
│   └── style.css                 # Soft Tonal CSS design system (mobile-first 414px shell)
├── index.html                    # Single-page web interface
├── version.json                  # Remote OTA version specification and release notes
├── build-apk.bat                 # Automated release pipeline script
├── vite.config.js                # Vite build configuration with dynamic environment variable bridge
└── build.gradle.kts              # Root multi-module Gradle build definition
```

---

## How to Build & Run

### 1. Web Application

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build production bundle
npm run build
```

Open `http://localhost:5173/` in your browser.

### 2. Android Application

#### Prerequisites
- JDK 17
- Android SDK (API 34, minSdk 26)

#### Automated Release Build
```cmd
build-apk.bat
```

Or manually:
```bash
# Compile and package signed release APK
./gradlew :app:assembleRelease
```

The compiled release APK will be located at:
- `TripWeave.apk` (Root permanent installer)
- `releases/TripWeave-v1.6.0.apk`
- `app/build/outputs/apk/release/app-release.apk`

---

## Technical Specifications

- **Application Version:** v1.6.0 (versionCode 8)
- **Design System:** Soft Tonal (Material You palette, primary `#3B5FCC`, light canvas `#FAFAFD`, dark secondary `#111318`).
- **Icons:** Pure SVG vector graphics across all components (zero emojis).
- **Typography:** Google Sans Flex with tabular numeric figures (`tnum`).
- **Mobile Viewport:** Clean 414px mobile frame with zero clipping and floating navigation bar.
- **Licensing:** Open-source for collaborative development.
