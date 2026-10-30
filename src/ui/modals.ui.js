// ==========================================================================
// TripWeave — Modals & Dialogs UI Controller
// ==========================================================================

import { dismissUpdate, downloadAndInstallUpdate } from '../services/updater.service.js';
import { generateItinerarySummaryText, exportTripAsJSON } from '../services/export.service.js';

let activeToastTimeout = null;

export function showToast(message) {
  const toast = document.getElementById('app-toast');
  const textEl = document.getElementById('toast-text');
  if (!toast || !textEl) return;
  textEl.textContent = message;
  toast.classList.remove('hidden');
  if (activeToastTimeout) clearTimeout(activeToastTimeout);
  activeToastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    activeToastTimeout = null;
  }, 2400);
}

let pendingRemoteVersionCode = 9;
let pendingRemoteApkUrl = null;

const UPDATE_NOTE_ICONS = {
  shield: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  fuel: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22h12"></path><path d="M4 9h10"></path><path d="M4 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"></path><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"></path></svg>`,
  privacy: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
  pdf: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
  history: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  download: `<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`
};

const UPDATE_NOTE_TAGS = {
  shield: 'Interface',
  fuel: 'Vehicles',
  privacy: 'Privacy',
  pdf: 'Export',
  history: 'History',
  download: 'OTA Engine'
};

export function setupUpdateModal() {
  const modal = document.getElementById('modal-app-update');
  const closeBtn = document.getElementById('modal-update-close-btn');
  const laterBtn = document.getElementById('modal-update-later-btn');
  const installBtn = document.getElementById('btn-install-apk-update');

  const hide = () => {
    if (modal) modal.classList.add('hidden');
    dismissUpdate(pendingRemoteVersionCode);
  };

  if (closeBtn) closeBtn.onclick = hide;
  if (laterBtn) laterBtn.onclick = hide;
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) hide();
    };
  }

  if (installBtn) {
    installBtn.onclick = () => {
      downloadAndInstallUpdate(pendingRemoteApkUrl);
      showToast('Downloading update in background... Installer will open automatically.');
      hide();
    };
  }
}

export function showUpdateModal(versionData, isLatest = false) {
  const modal = document.getElementById('modal-app-update');
  if (!modal) return;

  if (versionData && versionData.versionCode) {
    pendingRemoteVersionCode = versionData.versionCode;
  }
  if (versionData && versionData.apkUrl) {
    pendingRemoteApkUrl = versionData.apkUrl;
  }

  const versionEl = document.getElementById('update-modal-version');
  if (versionEl) {
    versionEl.textContent = `TripWeave v${versionData.versionName || '1.7.1'}`;
  }

  const dateEl = document.getElementById('update-modal-date');
  if (dateEl) {
    const buildCode = versionData.versionCode ? `Build ${versionData.versionCode}` : 'Production';
    const releaseText = versionData.releaseDate ? `Released ${versionData.releaseDate}` : 'In-App Release';
    dateEl.textContent = `${buildCode} • ${releaseText}`;
  }

  const statusBadge = document.getElementById('update-modal-status-badge');
  if (statusBadge) {
    if (isLatest) {
      statusBadge.textContent = 'Up to Date';
      statusBadge.className = 'update-status-chip current';
    } else {
      statusBadge.textContent = 'Update Available';
      statusBadge.className = 'update-status-chip available';
    }
  }

  const installBtn = document.getElementById('btn-install-apk-update');
  const installLabel = document.getElementById('btn-install-update-label');
  const laterBtn = document.getElementById('modal-update-later-btn');

  if (installLabel) {
    installLabel.textContent = isLatest ? 'Re-download APK' : 'Download & Install Update';
  }
  if (laterBtn) {
    laterBtn.textContent = isLatest ? 'Got It' : 'Later';
  }

  const notesEl = document.getElementById('update-modal-notes');
  if (notesEl && Array.isArray(versionData.releaseNotes)) {
    notesEl.innerHTML = versionData.releaseNotes.map((item, idx) => {
      if (typeof item === 'object' && item !== null) {
        const iconKey = (item.icon || 'download').toLowerCase();
        const svgIcon = UPDATE_NOTE_ICONS[iconKey] || UPDATE_NOTE_ICONS.download;
        const tag = UPDATE_NOTE_TAGS[iconKey] || 'Update';
        return `
          <div class="update-note-card ${idx === 0 ? 'active' : ''}" tabindex="0" data-note-index="${idx}">
            <div class="update-note-icon-badge ${iconKey}">
              ${svgIcon}
            </div>
            <div class="update-note-body">
              <div class="update-note-header">
                <span class="update-note-title">${item.title || 'Feature Enhancement'}</span>
                <span class="update-note-tag">${tag}</span>
              </div>
              <p class="update-note-desc">${item.desc || ''}</p>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="update-note-card" tabindex="0">
            <div class="update-note-icon-badge download">
              ${UPDATE_NOTE_ICONS.download}
            </div>
            <div class="update-note-body">
              <p class="update-note-desc" style="margin: 0; font-weight: 600;">${String(item)}</p>
            </div>
          </div>
        `;
      }
    }).join('');

    // Attach interactive click & focus toggles to each note card
    notesEl.querySelectorAll('.update-note-card').forEach(card => {
      card.addEventListener('click', () => {
        notesEl.querySelectorAll('.update-note-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          notesEl.querySelectorAll('.update-note-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
        }
      });
    });
  }

  modal.classList.remove('hidden');
}

// --------------------------------------------------------------------------
// Share & Export Modal
// --------------------------------------------------------------------------

export function setupShareModal(getPlanCallback) {
  const modal = document.getElementById('modal-share-trip');
  const btnOpen = document.getElementById('btn-open-share');
  const btnClose = document.getElementById('modal-share-close-btn');
  const btnDone = document.getElementById('modal-share-done-btn');
  const titleEl = document.getElementById('share-trip-title');
  const metaEl = document.getElementById('share-trip-meta');
  const textarea = document.getElementById('share-summary-text') || document.getElementById('share-whatsapp-text');
  const btnCopy = document.getElementById('btn-share-copy-text');
  const btnExportJson = document.getElementById('btn-export-json');

  function openModal() {
    if (!modal) return;
    const plan = getPlanCallback ? getPlanCallback() : null;
    if (plan && plan.trip) {
      if (titleEl) titleEl.textContent = plan.trip.title || 'TripWeave Road Trip';
      if (metaEl) {
        metaEl.textContent = `${plan.stops.length} stops • ${Math.round(plan.totalDistanceKm || 0)} km • ${plan.trip.groupSize || 4} travelers`;
      }
      if (textarea) {
        textarea.value = generateItinerarySummaryText(plan.trip, plan.stops, plan.scheduleResult?.stops || [], plan.expenses);
      }
    }
    modal.classList.remove('hidden');
    window.history.pushState({ modal: 'share-trip' }, '');
  }

  function closeModal(fromHistory = false) {
    if (modal) modal.classList.add('hidden');
    if (!fromHistory && window.history.state?.modal === 'share-trip') {
      window.history.back();
    }
  }

  if (btnOpen) btnOpen.onclick = () => openModal();
  if (btnClose) btnClose.onclick = () => closeModal(false);
  if (btnDone) btnDone.onclick = () => closeModal(false);
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal(false);
    };
  }

  window.addEventListener('popstate', () => {
    if (modal && !modal.classList.contains('hidden')) {
      closeModal(true);
    }
  });

  if (btnCopy) {
    btnCopy.onclick = () => {
      const text = textarea ? textarea.value : '';
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text);
        showToast('Itinerary copied to clipboard!');
      }
    };
  }


  if (btnExportJson) {
    btnExportJson.onclick = () => {
      const plan = getPlanCallback ? getPlanCallback() : null;
      if (plan) {
        exportTripAsJSON(plan.trip, plan.stops, plan.expenses);
        showToast('Trip exported as JSON backup');
      }
    };
  }

  return { openModal, closeModal };
}

// --------------------------------------------------------------------------
// Add / Edit Stop Modal
// --------------------------------------------------------------------------

export function setupAddStopModal({ onStopAdded = null }) {
  const modal = document.getElementById('modal-add-stop');
  const btnClose = document.getElementById('modal-stop-close-btn');
  const btnCancel = document.getElementById('modal-btn-cancel-stop');
  const btnSave = document.getElementById('modal-btn-save-stop');
  const inputName = document.getElementById('stop-name-input');
  const inputDuration = document.getElementById('stop-duration-input');
  const inputBuffer = document.getElementById('stop-buffer-input');
  const inputOpenTime = document.getElementById('stop-open-time');
  const inputCloseTime = document.getElementById('stop-close-time');
  const inputOvernight = document.getElementById('stop-overnight-input');

  const btnMinus = document.getElementById('btn-duration-minus');
  const btnPlus = document.getElementById('btn-duration-plus');
  const chip30 = document.getElementById('chip-dur-30');
  const chip60 = document.getElementById('chip-dur-60');
  const chip120 = document.getElementById('chip-dur-120');

  const btnMonument = document.getElementById('preset-hours-monument');
  const btnPark = document.getElementById('preset-hours-park');
  const btn24h = document.getElementById('preset-hours-24h');

  function openModal(defaultName = '') {
    if (!modal) return;
    if (inputName) {
      inputName.value = defaultName;
      setTimeout(() => inputName.focus(), 100);
    }
    if (inputDuration) inputDuration.value = '60';
    if (inputBuffer) inputBuffer.value = '15';
    if (inputOvernight) inputOvernight.checked = false;
    modal.classList.remove('hidden');
    window.history.pushState({ modal: 'add-stop' }, '');
  }

  function closeModal(fromHistory = false) {
    if (modal) modal.classList.add('hidden');
    if (!fromHistory && window.history.state?.modal === 'add-stop') {
      window.history.back();
    }
  }

  if (btnClose) btnClose.onclick = () => closeModal(false);
  if (btnCancel) btnCancel.onclick = () => closeModal(false);
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeModal(false);
    };
  }

  window.addEventListener('popstate', () => {
    if (modal && !modal.classList.contains('hidden')) {
      closeModal(true);
    }
  });

  if (btnMinus && inputDuration) {
    btnMinus.onclick = () => {
      const cur = parseInt(inputDuration.value, 10) || 60;
      inputDuration.value = Math.max(15, cur - 15);
    };
  }

  if (btnPlus && inputDuration) {
    btnPlus.onclick = () => {
      const cur = parseInt(inputDuration.value, 10) || 60;
      inputDuration.value = cur + 15;
    };
  }

  if (chip30 && inputDuration) chip30.onclick = () => { inputDuration.value = '30'; };
  if (chip60 && inputDuration) chip60.onclick = () => { inputDuration.value = '60'; };
  if (chip120 && inputDuration) chip120.onclick = () => { inputDuration.value = '120'; };

  if (btnMonument) {
    btnMonument.onclick = () => {
      if (inputOpenTime) inputOpenTime.value = '10:00';
      if (inputCloseTime) inputCloseTime.value = '17:30';
    };
  }

  if (btnPark) {
    btnPark.onclick = () => {
      if (inputOpenTime) inputOpenTime.value = '09:00';
      if (inputCloseTime) inputCloseTime.value = '17:00';
    };
  }

  if (btn24h) {
    btn24h.onclick = () => {
      if (inputOpenTime) inputOpenTime.value = '00:00';
      if (inputCloseTime) inputCloseTime.value = '23:59';
    };
  }

  if (btnSave) {
    btnSave.onclick = () => {
      const name = inputName ? inputName.value.trim() : '';
      if (!name) {
        showToast('Please enter a stop name');
        return;
      }

      const duration = parseInt(inputDuration?.value || '60', 10);
      const buffer = parseInt(inputBuffer?.value || '15', 10);
      const isOvernight = Boolean(inputOvernight?.checked);

      const newStop = {
        id: `stop-${Date.now()}`,
        name,
        durationMinutes: duration,
        plannedDurationMinutes: duration,
        bufferMinutes: buffer,
        isOvernight,
        openTime: inputOpenTime?.value || '09:00',
        closeTime: inputCloseTime?.value || '18:00'
      };

      if (typeof onStopAdded === 'function') {
        onStopAdded(newStop);
      }

      closeModal();
      showToast(`Added ${name} to itinerary!`);
    };
  }

  return { openModal, closeModal };
}

// --------------------------------------------------------------------------
// Respectful PDF Download Confirmation Modal
// --------------------------------------------------------------------------

export function setupPdfDownloadConfirmModal({ onProceed = null, onCancel = null } = {}) {
  const modal = document.getElementById('modal-pdf-download-confirm');
  const btnClose = document.getElementById('modal-pdf-confirm-close-btn');
  const btnCancel = document.getElementById('btn-pdf-confirm-cancel');
  const btnProceed = document.getElementById('btn-pdf-confirm-proceed');
  const titleEl = document.getElementById('pdf-confirm-trip-title');
  const metaEl = document.getElementById('pdf-confirm-trip-meta');

  let currentPlan = null;

  function openConfirm(plan) {
    if (!modal) return;
    currentPlan = plan;

    if (titleEl) {
      if (plan && plan.origin && plan.destination) {
        titleEl.textContent = `${plan.origin} → ${plan.destination}`;
      } else if (plan && plan.title) {
        titleEl.textContent = plan.title;
      } else {
        titleEl.textContent = 'Road Trip Itinerary';
      }
    }

    if (metaEl) {
      const stopCount = plan && plan.stops ? plan.stops.length : 0;
      const km = plan && plan.totalDistanceKm ? Math.round(plan.totalDistanceKm) : 0;
      metaEl.textContent = `${stopCount} stops • ${km > 0 ? km + ' km • ' : ''}Verified Travel Dossier`;
    }

    modal.classList.remove('hidden');
  }

  function closeConfirm(userCancelled = false) {
    if (modal) modal.classList.add('hidden');
    if (userCancelled && typeof onCancel === 'function') {
      onCancel();
    }
  }

  if (btnClose) {
    btnClose.onclick = () => closeConfirm(true);
  }
  if (btnCancel) {
    btnCancel.onclick = () => closeConfirm(true);
  }
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeConfirm(true);
    };
  }

  if (btnProceed) {
    btnProceed.onclick = () => {
      closeConfirm(false);
      if (typeof onProceed === 'function') {
        onProceed(currentPlan);
      }
    };
  }

  return { openConfirm, closeConfirm };
}

