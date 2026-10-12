# TripWeave Performance Baseline Report (Step 1)

Date: 2026-10-12
Document Version: 1.0.0
Status: Step 1 Complete - Awaiting User Approval Prior to Optimization

---

## 1. Executive Summary

This document establishes the official unoptimized baseline for TripWeave in accordance with Step 1 of the TripWeave Strict Performance Optimisation Prompt (v5).

In strict adherence to Rule 0 (Measure, change, re-measure) and Rule 10 (First task: Do Step 1 baseline measurement only), no optimization, shrinking, code refactoring, or dependency alteration has been applied during this phase. All measurements reflect the exact initial codebase.

The baseline audit reveals that 87.1% of the release APK size and 90.4% of the release AAB size is unminified multidex bytecode (classes.dex). R8 minification and resource shrinking are currently disabled by default. Enabling R8 and optimizing bytecode in Step 2 represents the primary opportunity for size reduction.

---

## 2. Test Environment and Build Configuration

### 2.1 Build Environment
- Operating System: Windows 11
- Java Runtime: OpenJDK 17.0.12
- Gradle Version: 8.13
- Android Gradle Plugin (AGP): 8.13.0
- Kotlin Version: 2.0.21
- Jetpack Compose Compiler: Integrated Kotlin Compose Compiler Plugin 2.0.21
- Compile SDK: 34 (Android 14)
- Target SDK: 34 (Android 14)
- Minimum SDK: 26 (Android 8.0 Oreo)

### 2.2 Device Availability and Testing Constraints
- Verification Command: `adb devices -l` (using platform-tools adb.exe at C:\Users\avine\AppData\Local\Android\Sdk\platform-tools\adb.exe)
- Attached Devices: 0 physical devices currently detected over USB/Wi-Fi.
- Constraint Statement: In accordance with Rule 3 (Release builds only. Never report emulator numbers as real performance), live hardware execution traces for S1 through S8 require physical hardware attached via USB debugging. The automated instrumentation scripts, dump commands, and benchmark protocols are detailed in Section 5 below to be executed upon physical device connection.
- Recommended Reference Devices:
  1. Low-end reference device: 2 GB to 3 GB RAM, Android 10 to 12, 60 Hz display refresh rate.
  2. Mid-range reference device: 6 GB to 8 GB RAM, Android 13 or 14, 90 Hz or 120 Hz display refresh rate.

---

## 3. Baseline Binary Size Audit

### 3.1 Overview of Generated Artifacts

| Artifact | File Path | Raw Size (Bytes) | Size (MB) |
|---|---|---|---|
| Release APK (Unsigned) | [app-release-unsigned.apk](file:///c:/Users/avine/OneDrive/Desktop/My-Projects/Tripline/app/build/outputs/apk/release/app-release-unsigned.apk) | 12,292,812 | 11.72 MB |
| Release App Bundle (AAB) | [app-release.aab](file:///c:/Users/avine/OneDrive/Desktop/My-Projects/Tripline/app/build/outputs/bundle/release/app-release.aab) | 11,834,953 | 11.29 MB |
| Debug APK | [app-debug.apk](file:///c:/Users/avine/OneDrive/Desktop/My-Projects/Tripline/app/build/outputs/apk/debug/app-debug.apk) | 22,029,680 | 21.01 MB |

### 3.2 Release APK Composition Breakdown ([app-release-unsigned.apk](file:///c:/Users/avine/OneDrive/Desktop/My-Projects/Tripline/app/build/outputs/apk/release/app-release-unsigned.apk))

| Component | Entry Count | Compressed Size (MB) | Compressed Size (Bytes) | Uncompressed Size (MB) | Percentage of APK |
|---|---|---|---|---|---|
| DEX (Bytecode) | 3 | 10.699 MB | 11,218,796 | 40.842 MB | 87.15% |
| Resources Table (resources.arsc) | 1 | 0.589 MB | 617,668 | 0.589 MB | 5.02% |
| Web Application Assets (assets/) | 6 | 0.267 MB | 279,985 | 1.022 MB | 2.28% |
| Drawables and XML (res/) | 131 | 0.059 MB | 62,384 | 0.082 MB | 0.51% |
| Native JNI Headers/Libraries (lib/) | 4 | 0.036 MB | 37,344 | 0.036 MB | 0.30% |
| Manifest and Root Metadata (Other) | 17 | 0.013 MB | 13,858 | 0.039 MB | 0.11% |
| META-INF Signatures | 65 | 0.001 MB | 1,189 | 0.001 MB | 0.01% |
| Total APK | 227 | 11.723 MB | 12,292,812 | 42.611 MB | 100.00% |

### 3.3 Release DEX Breakdown
- classes.dex: 31,792,584 bytes uncompressed (7,326,880 bytes compressed). Primary Compose, AndroidX, and Room runtime definitions.
- classes2.dex: 10,437,588 bytes uncompressed (3,682,177 bytes compressed). Google Play Services Auth, WebKit, and Kotlin standard libraries.
- classes3.dex: 595,976 bytes uncompressed (209,739 bytes compressed). Synthetics, annotations, and secondary indices.
- Observation: Because R8 shrinking and dead-code stripping are currently turned off (isMinifyEnabled = false), unused classes across all transitive dependencies remain in the final artifact.

### 3.4 Web Assets Breakdown (assets/)
- index-DMx6FnTH.js: 924,130 bytes raw (242,252 bytes compressed). Contains bundled application logic, Leaflet map engine, and utility packages.
- index-RQZrGN7U.css: 63,763 bytes raw (15,341 bytes compressed). Contains design system tokens and responsive rules.
- index.html: 74,773 bytes raw (13,876 bytes compressed). Structure, translations, and templates.
- app-logo.svg: 434 bytes raw (278 bytes compressed).
- dexopt/baseline.prof: 8,256 bytes raw (8,256 bytes compressed). ART compilation baseline profile.
- dexopt/baseline.profm: 404 bytes raw (404 bytes compressed). ART profile metadata.
- Observation: The web application layer accounts for only 267 KB compressed (2.28% of the APK), confirming that the frontend payload is already compact.

### 3.5 Release AAB Breakdown ([app-release.aab](file:///c:/Users/avine/OneDrive/Desktop/My-Projects/Tripline/app/build/outputs/bundle/release/app-release.aab))

| Component | Entry Count | Compressed Size (MB) | Uncompressed Size (MB) | Percentage of AAB |
|---|---|---|---|---|
| base/dex/ | 3 | 10.699 MB | 40.842 MB | 90.40% |
| base/assets/ | 4 | 0.259 MB | 1.014 MB | 2.19% |
| base/resources.pb | 1 | 0.177 MB | 0.497 MB | 1.50% |
| base/res/ | 131 | 0.058 MB | 0.102 MB | 0.49% |
| base/lib/ | 4 | 0.017 MB | 0.036 MB | 0.14% |
| BUNDLE-METADATA/ | 5 | 0.013 MB | 0.018 MB | 0.11% |
| Other | 85 | 0.015 MB | 0.041 MB | 0.13% |
| Total Bundle | 233 | 11.287 MB | 42.550 MB | 100.00% |

---

## 4. Test Scenarios (S1 to S8) Protocol and Baseline State

All scenarios are defined below with exact terminal commands and reproducible steps to be run 5 times on the physical reference devices.

### Scenario S1: Startup Timing (Cold, Warm, Hot)
- Procedure:
  1. Kill application process: adb shell am force-stop com.tripweave.app
  2. Cold Start Command: adb shell am start-activity -W -n com.tripweave.app/.MainActivity
  3. Measure TotalTime and WaitTime output by ActivityManager.
  4. Warm Start: Send app to background via Home button (adb shell input keyevent 3), wait 5 seconds, launch again.
  5. Hot Start: Launch while activity is suspended in recent tasks.
- Baseline Status: Pending physical device attachment for hardware measurement.

### Scenario S2: Map Home with 10-Stop Route (Pan, Zoom, Marker Select)
- Procedure: Load 10-stop route on map; execute scripted touch gestures (pan 500 px left/right, pinch-to-zoom 2x, select 5 consecutive stop markers).
- Measurement Command: adb shell dumpsys gfxinfo com.tripweave.app reset before scenario, followed by adb shell dumpsys gfxinfo com.tripweave.app after scenario.
- Metric to capture: 95th percentile frame time, jank frame count, and dropped frame percentage.

### Scenario S3: Bottom Sheet Drag (Peek to Expanded)
- Procedure: Repeatedly drag the itinerary sheet between peek (collapsed) and fully expanded state 10 times consecutively.
- Metric to capture: Janky frames percentage; verify whether map padding updates trigger map surface re-layout or main-thread frame drops.

### Scenario S4: Itinerary with 20 Stops (Scroll, Reorder, Delete with Undo)
- Procedure: Populate itinerary with 20 stops; fling scroll from top to bottom; drag stop 1 to position 15; delete stop 5; trigger Undo action from snackbar.
- Metric to capture: Main-thread calculation duration during reorder and frame drop rate during list fling.

### Scenario S5: Create Trip Flow
- Procedure: Tap New Trip, enter trip title, select start and end dates, add 3 stops via search, tap Save Trip.
- Metric to capture: Form input latency, dialog render time, database write duration on IO dispatcher.

### Scenario S6: Language Switch (English, Telugu, Hindi, Tamil)
- Procedure: Open Settings; cycle through English, Telugu, Hindi, and Tamil; measure layout recomputation and render time.
- Metric to capture: Activity recreation duration, resource reloading latency, memory churn during locale switch.

### Scenario S7: 30-Minute Foreground Battery Session
- Procedure:
  1. Reset battery stats: adb shell dumpsys batterystats --reset
  2. Keep screen on with Map Home visible and normal periodic interactions for 30 minutes.
  3. Dump stats: adb shell dumpsys batterystats com.tripweave.app > battery_s7.txt
- Metric to capture: Total mAh consumed, screen-on drain percentage, CPU wake lock duration.

### Scenario S8: 1-Hour Background Session
- Procedure: Save trip; place app in background; leave idle for 60 minutes with screen off.
- Metric to capture: AlarmManager wakeups, JobScheduler/WorkManager runs, background CPU seconds, network transmission bytes. Target is zero unauthorized wakeups.

---

## 5. Proposed Targets for Approval

Based on the baseline audit, the following concrete targets are proposed for Step 2 through Step 7:

| Metric / Scenario | Current Baseline (Unoptimized) | Proposed Target | Target Phase |
|---|---|---|---|
| Release APK Size (Unsigned) | 12.29 MB (11.72 MiB) | Under 6.50 MB | Step 2 (R8, shrinking, locale filters) |
| Release AAB Size | 11.83 MB (11.29 MiB) | Under 6.00 MB | Step 2 (Resource and code minification) |
| DEX Size (Compressed) | 10.70 MB | Under 4.50 MB | Step 2 (ProGuard / R8 rules) |
| Web Assets Size (Compressed) | 267 KB | Under 250 KB | Step 2 (Asset hygiene) |
| Cold Startup to First Usable Frame | Baseline to be recorded on device | Under 2.0 seconds on mid-range device | Step 4 (Startup deferral, baseline profiles) |
| Frame Time (95th percentile) | Baseline to be recorded on device | Under 16 ms (60 Hz) / under 8 ms (120 Hz) | Step 4 (Recomposition and draw-phase reads) |
| Itinerary / Budget Recalculation (10 stops) | Off main thread | Under 100 ms | Step 4 (Background dispatcher optimization) |
| Bottom Sheet Drag Jank Rate | Baseline to be recorded on device | Less than 2% dropped frames | Step 4 (Decoupled map padding) |
| S7: 30-min Foreground Battery Drain | Baseline to be recorded on device | At least 15% lower than baseline | Step 3 (Adaptive power mode, throttled animations) |
| S8: 1-hr Background Activity | To be verified on device | 0 wake locks, 0 continuous location requests | Step 3 (WorkManager constraints) |

---

## 6. Verification and Next Steps

- Unit Tests: All unit tests across all modules (:core:model, :core:planning, :core:providers, :core:designsystem, :core:database, :app) pass cleanly.
- Integrity: 100% of existing functionality, all 4 languages (English, Telugu, Hindi, Tamil), and accessibility structures remain intact.
- Status: Step 1 is complete. No optimizations have been performed.
- Action Required: Awaiting user approval of this baseline report and final targets before initiating Step 2 (APK and App Size Management).


