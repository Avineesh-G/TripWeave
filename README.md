# TripWeave

**Autonomous Road Trip Planning & Feasibility Engine for India**

TripWeave is an intelligent, map-first itinerary planning system engineered specifically for multi-stop Indian road trips. Built with official Google Maps (Survey of India sovereign border compliance), Google Authentication, and Google Cloud Firestore database synchronization, TripWeave deterministically computes whether a planned road trip is realistically achievable within time and budget constraints, tracks attraction operating hours, provides daylight buffer management, and itemizes expenses with verified data provenance.

---

## Key Highlights

- **Deterministic Feasibility Engine:** Evaluates overall trip viability into three distinct states: Feasible, Tight, or Infeasible.
- **Google Authentication Only:** Strict Google OAuth 2.0 authentication gate with session persistence (guest login disabled for data security).
- **Cloud Firestore Database Sync:** Real-time multi-device synchronization of trips, waypoints, itineraries, and expenses under isolated user paths (`users/{userId}/trips`).
- **One-Time Privacy Policy & Terms Onboarding:** Transparent pre-login consent explaining requested device permissions (GPS location, local storage) and sovereign data protection.
- **Official Indian Sovereign Maps:** 100% Survey of India compliant (`gl=IN`) with complete sovereign borders for Jammu & Kashmir, Ladakh, and Arunachal Pradesh.
- **Authentic Google Location Dot:** Pulsing blue location dot with white border, radar halo, directional beam, and calibrated accuracy circle.
- **Attraction Operating Hours & "Plan Accordingly":** Detects closed monuments upon arrival and shifts departure time with one tap to clear scheduling conflicts.
- **Multilingual Support (4 Indian Languages):** Full native localization in English, Telugu, Hindi, and Tamil.
- **Transparent Provenance Budgeting:** Itemized costs labeled with verified sources (NHAI Tolls, State Fuel Rates, Homestays).
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

TripWeave operates across six deterministic calculation and synchronization layers:

```
[1. Privacy & Terms] ──> [2. Google Auth] ──> [3. Route & Places] ──> [4. Operating Hours] ──> [5. Feasibility & Budget] ──> [6. Cloud Firestore]
   One-time consent         OAuth 2.0             Google / OSRM          Indian Registry          Arrival vs Closing           Live Multi-Device
   for new users           Strict guard           Survey of India         Buffer check             Fuel + Toll + Stays          Database Sync
```

### 1. Privacy Policy & Terms Onboarding
- First-time visitors review a transparent policy explaining device permissions (GPS device location, local storage caching) and data privacy guarantees before proceeding to login. Acceptance is saved locally once and never blocks returning users.

### 2. Strict Google Authentication
- Eliminates insecure guest sessions. User identity is verified through official Google OAuth 2.0 popup flows, creating isolated document namespaces in Google Cloud Firestore.

### 3. Route Planning & Sovereign Maps
- Renders official Google Maps layers with `gl=IN` compliance, displaying verified sovereign boundaries.
- Uses OSRM and Photon for routing geometries, computing real-world highway driving times, distances, and tollway segments.

### 4. Operating Hours Verification & Conflict Detection
- Integrates a built-in operating hours registry for major Indian monuments and attractions (Mysore Palace, Abbey Falls, Namdroling Monastery, Virupaksha Temple, Amer Fort, Hawa Mahal, Shore Temple, Golconda Fort, Charminar, etc.).
- Evaluates arrival windows against gate closing times and parking buffers to flag conflicts.

### 5. One-Tap "Plan Accordingly" Engine
- When an attraction closure conflict is detected, tapping **Plan Accordingly** automatically recalculates the optimal departure time to ensure a minimum 45-minute visit buffer before closing, restoring the trip state to **Feasible**.

### 6. Transparent Provenance Budgeting & Cloud Sync
- **Fuel Math:** `(Total Highway Distance / Vehicle Mileage) * State Fuel Price`.
- **Itemized Categories:** FASTag tolls (NHAI rate card), homestays/resorts, highway meals, and forest entry permits.
- **Cloud Replication:** State changes (`Storage.save`) automatically trigger Firestore synchronization under `users/{userId}/trips/{tripId}`.

---

## Security & API Key Management

TripWeave enforces strict secret isolation to prevent key exposure in source code and public repositories:

1. **Excluded from Version Control:**
   - Private keys and credentials reside in `local.properties` (for Android and local web builds) or Vercel environment variables (for production deployments).
   - `.gitignore` strictly blocks `local.properties`, `.env`, keystore files (`*.jks`, `*.keystore`), and build outputs.

2. **Dynamic Injection:**
   - [vite.config.js](vite.config.js) uses `loadEnv` to securely read `MAPS_API_KEY` and `FIREBASE_*` credentials at compile time without baking hardcoded secrets into code.
   - The Android build reads `MAPS_API_KEY` dynamically from `local.properties` and injects it into `AndroidManifest.xml` via manifest placeholders.

3. **Cloud Firestore Security Rules (Production Mode):**
   - Access to Firestore documents is protected by per-user security rules:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /users/{userId}/{document=**} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
     ```

---

## Repository Structure

```
TripWeave/
├── app/                      # Android Application module (Jetpack Compose)
│   ├── src/main/kotlin/      # MainActivity, Navigation, Compose screens
│   └── src/main/res/         # Android manifest and application assets
├── core/
│   ├── model/                # Pure Kotlin domain entities (Trip, TripStop, Expense, Provenance)
│   ├── planning/             # Pure Kotlin planning core (ScheduleEngine, BudgetEngine, FeasibilityEvaluator)
│   ├── providers/            # Place search and routing provider interfaces
│   ├── designsystem/         # Soft Tonal Material 3 design tokens, components, and multilingual strings
│   └── database/             # Offline Room SQLite database, DAOs, and KSP processor
├── src/                      # Single-page Web Application
│   ├── main.js               # Application coordinator, Google Auth binding, location engine, UI events
│   ├── firebase.js           # Firebase Modular SDK service (Auth & Cloud Firestore sync)
│   ├── engines.js            # Pure JavaScript implementation of core planning engines
│   ├── data.js               # Translations and storage abstraction with onSave cloud hook
│   └── style.css             # Soft Tonal CSS design system (mobile-first 414px shell)
├── index.html                # Single-page web interface
├── vite.config.js            # Vite build configuration with dynamic environment variable bridge
├── local.properties          # Private local SDK and API credentials (git-ignored)
└── build.gradle.kts          # Root multi-module Gradle build definition
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
- **Mobile Viewport:** Clean 414px mobile frame with zero clipping and floating navigation bar.
- **Licensing:** Open-source for collaborative development.
