// ==========================================================================
// TripWeave — Authentication & Onboarding UI Controller
// ==========================================================================

import {
  loginWithGoogle,
  logoutUser,
  getCurrentUser,
  isTermsAccepted,
  setTermsAccepted
} from '../services/auth.service.js';
import { resizeMap } from '../services/map.service.js';
import { showToast } from './modals.ui.js';

export function setupAuthUI({ onAuthenticated }) {
  const screenAuthGate = document.getElementById('screen-auth-gate');
  const screenPrivacy = document.getElementById('screen-privacy-terms');
  const mainAppShell = document.getElementById('main-app-shell');

  const btnGoogleSignIn = document.getElementById('btn-google-signin');
  const googleBtnLabel = document.getElementById('google-signin-btn-label');
  const btnGuestSignIn = document.getElementById('btn-guest-signin');

  const btnViewTerms = document.getElementById('btn-view-terms');
  const btnBackFromTerms = document.getElementById('btn-back-from-terms');
  const chkPrivacyAgree = document.getElementById('chk-privacy-agree');
  const btnAcceptPrivacy = document.getElementById('btn-accept-privacy');
  const privacyApprovedCard = document.getElementById('privacy-status-approved-card');
  const privacyFooterReview = document.getElementById('privacy-footer-review-wrap');
  const privacyFooterApproved = document.getElementById('privacy-footer-approved-wrap');
  const btnPrivacyApprovedDone = document.getElementById('btn-privacy-approved-done');
  const privacySubtitle = document.querySelector('.privacy-subtitle');

  let pendingAuthUser = null;

  // Account modal elements
  const avatarBtn = document.getElementById('account-avatar-btn');
  const btnOpenFromSettings = document.getElementById('btn-open-account-from-settings');
  const modalAccount = document.getElementById('modal-account-settings');
  const modalAccountBack = document.getElementById('modal-account-back-btn');
  const modalAccountClose = document.getElementById('modal-account-close-btn');
  const modalAccountDone = document.getElementById('modal-account-done-btn');
  const modalAccountTheme = document.getElementById('modal-account-theme-btn');
  const modalAccountUpdate = document.getElementById('modal-account-check-update');
  const modalAccountName = document.getElementById('account-modal-name');
  const modalAccountEmail = document.getElementById('account-modal-email');
  const modalAccountBadge = document.getElementById('account-modal-avatar-badge');
  const modalAccountStatus = document.getElementById('account-modal-status');
  const btnAccountTerms = document.getElementById('btn-account-terms');
  const btnAccountSignOut = document.getElementById('btn-account-signout');

  // Settings screen profile card elements
  const settingsAvatarBadge = document.getElementById('settings-avatar-badge');
  const settingsUserName = document.getElementById('settings-user-name');
  const settingsUserEmail = document.getElementById('settings-user-email');

  function updateAvatarPill(user) {
    const initial = (user?.displayName || user?.email || 'A').trim().charAt(0).toUpperCase();

    // Map top search bar avatar
    if (avatarBtn) {
      if (user?.photoURL) {
        avatarBtn.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName || 'User'}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
      } else {
        avatarBtn.innerHTML = `<span>${initial}</span>`;
      }
    }

    // Settings screen avatar & labels
    if (settingsAvatarBadge) {
      if (user?.photoURL) {
        settingsAvatarBadge.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName || 'User'}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
      } else {
        settingsAvatarBadge.textContent = initial;
      }
    }
    if (settingsUserName) settingsUserName.textContent = user?.displayName || 'Google Explorer';
    if (settingsUserEmail) settingsUserEmail.textContent = user?.email || 'account@tripweave.app';
  }

  function applyUser(user) {
    if (screenAuthGate) screenAuthGate.classList.add('hidden');
    if (screenPrivacy) screenPrivacy.classList.add('hidden');
    if (mainAppShell) mainAppShell.classList.remove('hidden');

    updateAvatarPill(user);
    setTimeout(() => {
      resizeMap();
    }, 150);

    if (onAuthenticated) {
      onAuthenticated(user);
    }
  }

  // 1. Google Sign-In Click
  if (btnGoogleSignIn) {
    btnGoogleSignIn.onclick = async () => {
      if (btnGoogleSignIn.disabled) return;
      btnGoogleSignIn.disabled = true;
      if (googleBtnLabel) googleBtnLabel.textContent = 'Connecting with Google...';

      try {
        const result = await loginWithGoogle();
        if (result && result.success && result.user) {
          if (!isTermsAccepted()) {
            pendingAuthUser = result.user;
            openTermsScreen(true);
            showToast('Please review and approve permissions before entering.');
          } else {
            applyUser(result.user);
            showToast(`Welcome, ${result.user.displayName || 'Explorer'}!`);
          }
        } else {
          showToast(result?.error || 'Google sign-in was not completed. Please sign in to continue.');
        }
      } catch (err) {
        console.error('[TripWeave] Sign-in error:', err);
        showToast(err.message || 'Unable to sign in with Google. Please try again.');
      } finally {
        btnGoogleSignIn.disabled = false;
        if (googleBtnLabel) googleBtnLabel.textContent = 'Sign in with Google';
      }
    };
  }

  // 2. Privacy & Terms Screen Logic with Safe Back Navigation
  function openTermsScreen(isOnboarding = false) {
    if (modalAccount) modalAccount.classList.add('hidden');
    if (screenAuthGate) screenAuthGate.classList.add('hidden');
    if (screenPrivacy) screenPrivacy.classList.remove('hidden');

    const accepted = isTermsAccepted();
    if (accepted && !isOnboarding) {
      // Show Approved Permissions Status Card & Hide Agree Checkbox
      if (privacyApprovedCard) privacyApprovedCard.classList.remove('hidden');
      if (privacyFooterReview) privacyFooterReview.classList.add('hidden');
      if (privacyFooterApproved) privacyFooterApproved.classList.remove('hidden');
      if (privacySubtitle) {
        privacySubtitle.textContent = 'All required device permissions and privacy protections have been granted & approved.';
      }
    } else {
      // Show Review & Agree Checkbox
      if (privacyApprovedCard) privacyApprovedCard.classList.add('hidden');
      if (privacyFooterReview) privacyFooterReview.classList.remove('hidden');
      if (privacyFooterApproved) privacyFooterApproved.classList.add('hidden');
      if (privacySubtitle) {
        privacySubtitle.textContent = 'Please review our transparency commitments, data protections, and terms before continuing.';
      }
      if (chkPrivacyAgree) {
        chkPrivacyAgree.checked = false;
        if (btnAcceptPrivacy) btnAcceptPrivacy.disabled = true;
      }
    }

    window.history.pushState({ screen: 'privacy-terms' }, '');
  }

  function closeTermsScreen(fromHistory = false) {
    if (!screenPrivacy || screenPrivacy.classList.contains('hidden')) return;
    screenPrivacy.classList.add('hidden');

    const user = getCurrentUser();
    if (user && isTermsAccepted()) {
      if (mainAppShell) mainAppShell.classList.remove('hidden');
    } else {
      if (screenAuthGate) screenAuthGate.classList.remove('hidden');
    }

    if (!fromHistory && window.history.state?.screen === 'privacy-terms') {
      window.history.back();
    }
  }

  if (btnViewTerms) {
    btnViewTerms.onclick = () => openTermsScreen(false);
  }

  if (btnBackFromTerms) {
    btnBackFromTerms.onclick = () => closeTermsScreen(false);
  }

  if (btnPrivacyApprovedDone) {
    btnPrivacyApprovedDone.onclick = () => closeTermsScreen(false);
  }

  if (chkPrivacyAgree && btnAcceptPrivacy) {
    chkPrivacyAgree.onchange = () => {
      btnAcceptPrivacy.disabled = !chkPrivacyAgree.checked;
    };

    btnAcceptPrivacy.onclick = () => {
      setTermsAccepted(true);
      if (pendingAuthUser) {
        const u = pendingAuthUser;
        pendingAuthUser = null;
        applyUser(u);
        showToast(`Permissions approved! Welcome, ${u.displayName || 'Explorer'}!`);
      } else {
        const user = getCurrentUser();
        if (user) {
          closeTermsScreen(false);
          showToast('Privacy Policy & Terms accepted');
        } else {
          if (screenPrivacy) screenPrivacy.classList.add('hidden');
          if (screenAuthGate) screenAuthGate.classList.remove('hidden');
          showToast('Terms accepted. Sign in with Google to continue.');
        }
      }
    };
  }

  // 4. Account Settings Modal - Robust Opening & Universal Back Handlers
  function openAccountModal() {
    const user = getCurrentUser() || { displayName: 'Road Explorer', email: 'explorer@tripweave.app' };
    if (modalAccountName) modalAccountName.textContent = user.displayName || 'Google Explorer';
    if (modalAccountEmail) modalAccountEmail.textContent = user.email || 'account@tripweave.app';
    if (modalAccountStatus) modalAccountStatus.textContent = user.isGuest ? 'Explorer (Local)' : 'Google Verified';

    const initial = (user.displayName || 'A').trim().charAt(0).toUpperCase();
    if (modalAccountBadge) {
      if (user.photoURL) {
        modalAccountBadge.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
      } else {
        modalAccountBadge.textContent = initial;
      }
    }

    if (modalAccount) {
      modalAccount.classList.remove('hidden');
      window.history.pushState({ modal: 'account-settings' }, '');
    }
  }

  function closeAccountModal(fromHistory = false) {
    if (!modalAccount || modalAccount.classList.contains('hidden')) return;
    modalAccount.classList.add('hidden');

    if (!fromHistory && window.history.state?.modal === 'account-settings') {
      window.history.back();
    }
  }

  if (avatarBtn) {
    avatarBtn.onclick = () => openAccountModal();
  }

  if (btnOpenFromSettings) {
    btnOpenFromSettings.onclick = () => openAccountModal();
  }

  // Back button, Close button, and Done button inside the modal
  if (modalAccountBack) {
    modalAccountBack.onclick = () => closeAccountModal(false);
  }

  if (modalAccountClose) {
    modalAccountClose.onclick = () => closeAccountModal(false);
  }

  if (modalAccountDone) {
    modalAccountDone.onclick = () => closeAccountModal(false);
  }

  // Clicking outside modal on backdrop to close
  if (modalAccount) {
    modalAccount.onclick = (e) => {
      if (e.target === modalAccount) {
        closeAccountModal(false);
      }
    };
  }

  // In-modal Theme Switcher
  if (modalAccountTheme) {
    modalAccountTheme.onclick = () => {
      const isDark = document.body.classList.toggle('theme-dark');
      document.body.classList.toggle('theme-light', !isDark);
      localStorage.setItem('tripweave_theme', isDark ? 'dark' : 'light');
      showToast(`Switched to ${isDark ? 'Dark' : 'Light'} theme`);
    };
  }

  // In-modal Update Checker
  if (modalAccountUpdate) {
    modalAccountUpdate.onclick = () => {
      closeAccountModal(false);
      const btnCheck = document.getElementById('btn-check-update');
      if (btnCheck) btnCheck.click();
    };
  }

  // Navigate to Terms from Account Modal
  if (btnAccountTerms) {
    btnAccountTerms.onclick = () => {
      openTermsScreen();
    };
  }

  // Sign out
  if (btnAccountSignOut) {
    btnAccountSignOut.onclick = async () => {
      closeAccountModal(false);
      await logoutUser();
      if (mainAppShell) mainAppShell.classList.add('hidden');
      if (screenAuthGate) screenAuthGate.classList.remove('hidden');
      showToast('Signed out of TripWeave');
    };
  }

  // Global Keyboard (Escape) & Hardware/Browser Back Button (popstate)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalAccount && !modalAccount.classList.contains('hidden')) {
        closeAccountModal(false);
      } else if (screenPrivacy && !screenPrivacy.classList.contains('hidden')) {
        closeTermsScreen(false);
      }
    }
  });

  window.addEventListener('popstate', () => {
    if (modalAccount && !modalAccount.classList.contains('hidden')) {
      closeAccountModal(true);
    } else if (screenPrivacy && !screenPrivacy.classList.contains('hidden')) {
      closeTermsScreen(true);
    }
  });

  // 4. Bootstrap Auto-Check (Require Valid Google Account & Approved Terms)
  const existingUser = getCurrentUser();
  if (existingUser && !existingUser.isGuest) {
    if (!isTermsAccepted()) {
      pendingAuthUser = existingUser;
      openTermsScreen(true);
    } else {
      applyUser(existingUser);
    }
  } else {
    if (existingUser?.isGuest) {
      localStorage.removeItem('tripweave_auth_user');
    }
    if (screenAuthGate) screenAuthGate.classList.remove('hidden');
    if (mainAppShell) mainAppShell.classList.add('hidden');
  }

  return {
    applyUser,
    openAccountModal,
    closeAccountModal
  };
}
