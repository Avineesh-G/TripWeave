// In-App APK OTA Update Verification Service (v1.5.1 Robust Engine)

export const CURRENT_APP_VERSION = '1.7.0';
export const CURRENT_VERSION_CODE = 9;
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

export async function checkAppUpdates(manualTrigger = false, onUpdateAvailable = null, onUpToDate = null) {
  const currentCode = getInstalledVersionCode();
  const currentName = getInstalledVersionName();

  try {
    const res = await fetch('https://raw.githubusercontent.com/Avineesh-G/TripWeave/main/version.json?t=' + Date.now());
    if (res.ok) {
      const remote = await res.json();
      if (remote.versionCode > currentCode) {
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
          onUpdateAvailable(remote);
        }
        return;
      }
    }
  } catch (err) {
    console.warn('[UpdaterService] Remote check error:', err);
  }

  if (manualTrigger && typeof onUpToDate === 'function') {
    onUpToDate(currentName);
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
