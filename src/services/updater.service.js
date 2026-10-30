// In-App APK OTA Update Verification Service (v1.5.1 Robust Engine)

export const CURRENT_APP_VERSION = '1.7.1';
export const CURRENT_VERSION_CODE = 10;
export const FALLBACK_APK_URL = 'https://github.com/Avineesh-G/TripWeave/raw/main/TripWeave.apk';
const DISMISSED_KEY = 'tripweave_dismissed_update';

export function getInstalledVersionCode() {
  if (typeof window !== 'undefined' && window.AndroidAuthBridge && typeof window.AndroidAuthBridge.getAppVersionCode === 'function') {
    try {
      const nativeCode = window.AndroidAuthBridge.getAppVersionCode();
      if (typeof nativeCode === 'number' && nativeCode > 0) return nativeCode;
    } catch (e) {}
  }
  return CURRENT_VERSION_CODE;
}

export function getInstalledVersionName() {
  if (typeof window !== 'undefined' && window.AndroidAuthBridge && typeof window.AndroidAuthBridge.getAppVersionName === 'function') {
    try {
      const nativeName = window.AndroidAuthBridge.getAppVersionName();
      if (nativeName && typeof nativeName === 'string' && nativeName.trim()) return nativeName.trim();
    } catch (e) {}
  }
  return CURRENT_APP_VERSION;
}

const FALLBACK_RELEASE_NOTES = [
  {
    icon: "shield",
    title: "Clean Zero-Mock Data Architecture",
    desc: "Removed all placeholder dummy trips and synthetic stops. All routing, stops, and corridor amenities are verified live from GPS and OpenStreetMap."
  },
  {
    icon: "fuel",
    title: "Integrated AI Budget Strategy & Inconvenience-Free Reserve",
    desc: "Seamlessly merges financial breakdown into the itinerary with percentage distribution (Fuel, Stay, Food, Tolls, Activities, 10% Reserve) and AI cost reduction."
  },
  {
    icon: "car",
    title: "160+ Global Vehicle Specs & Multi-Fuel Matrix",
    desc: "Comprehensive global catalog of cars, sedans, SUVs, bikes, and EVs with brand search filtering and live energy pricing across India."
  },
  {
    icon: "pdf",
    title: "Publication-Grade A4 Travel Dossier PDF",
    desc: "Enhanced discrete page export embedding live budget percentage breakdown, AI cost-reduction blueprint, and itinerary milestone cards."
  },
  {
    icon: "navigation",
    title: "Continuous Workflow & Input Validation",
    desc: "Vehicle recommendations and AI budget advice only activate when trip parameters are set, preventing inaccurate pre-calculations."
  },
  {
    icon: "download",
    title: "Native In-App APK Updating",
    desc: "Direct OTA background download and package installation without leaving the application."
  }
];

export async function checkAppUpdates(manualTrigger = false, onUpdateAvailable = null, onUpToDate = null) {
  const currentCode = getInstalledVersionCode();
  const currentName = getInstalledVersionName();

  let remote = null;

  try {
    const res = await fetch('https://raw.githubusercontent.com/Avineesh-G/TripWeave/main/version.json?t=' + Date.now(), {
      cache: 'no-cache'
    });
    if (res.ok) {
      remote = await res.json();
    }
  } catch (err) {
    console.warn('[UpdaterService] Remote check network error:', err);
  }

  // Graceful fallback to embedded release manifest if network/DNS is blocked
  if (!remote || !remote.versionCode) {
    remote = {
      versionName: currentName,
      versionCode: currentCode,
      releaseDate: '2026-10-30',
      apkUrl: FALLBACK_APK_URL,
      releaseNotes: FALLBACK_RELEASE_NOTES
    };
  }

  const isRemoteNewer = (remote.versionCode > currentCode);

  if (isRemoteNewer) {
    // Check 24-hour dismissal suppression if automatic trigger
    try {
      const dismissedRaw = localStorage.getItem(DISMISSED_KEY);
      if (dismissedRaw && !manualTrigger) {
        const dismissed = JSON.parse(dismissedRaw);
        if (dismissed && dismissed.code >= remote.versionCode && (Date.now() - dismissed.timestamp) < (24 * 3600 * 1000)) {
          return;
        }
      }
    } catch (e) {}

    if (typeof onUpdateAvailable === 'function') {
      onUpdateAvailable(remote, false);
    }
  } else {
    // Current or older version
    if (manualTrigger) {
      if (typeof onUpdateAvailable === 'function') {
        onUpdateAvailable(remote, true);
      } else if (typeof onUpToDate === 'function') {
        onUpToDate(currentName);
      }
    }
  }
}

export function dismissUpdate(code = 7) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify({ code, timestamp: Date.now() }));
  } catch (e) {}
}

export function downloadAndInstallUpdate(apkUrl) {
  const url = apkUrl || FALLBACK_APK_URL;
  if (typeof window !== 'undefined' && window.AndroidAuthBridge && typeof window.AndroidAuthBridge.downloadUpdate === 'function') {
    window.AndroidAuthBridge.downloadUpdate(url);
  } else {
    window.open(url, '_blank');
  }
}
