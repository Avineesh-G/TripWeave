// Floating Navigation Island & Tab Router UI Controller
import { state } from '../state.js';
import { resizeMap } from '../services/map.service.js';

export function setupNavigationUI({ onTabChanged = null }) {
  const tabs = document.querySelectorAll('.nav-tab');
  const screens = document.querySelectorAll('.screen-view');

  function switchTab(tabId, pushHistory = true) {
    if (!tabId) return;
    const prevTab = state.activeTab;
    state.setActiveTab(tabId);

    tabs.forEach(t => {
      const match = t.getAttribute('data-tab') === tabId;
      t.classList.toggle('active', match);
    });

    screens.forEach(s => {
      const match = s.id === `screen-${tabId}`;
      s.classList.toggle('active', match);
    });

    // Invalidate map dimensions when returning to Map view
    if (tabId === 'map') {
      setTimeout(resizeMap, 50);
      setTimeout(resizeMap, 180);
    }

    if (pushHistory && tabId !== 'map' && prevTab === 'map') {
      window.history.pushState({ tab: tabId }, '');
    }

    if (typeof onTabChanged === 'function') {
      onTabChanged(tabId);
    }
  }

  window.addEventListener('popstate', () => {
    const anyModalOpen = document.querySelector('.modal-backdrop:not(.hidden)');
    const privacyOpen = document.getElementById('screen-privacy-terms');
    if (anyModalOpen || (privacyOpen && !privacyOpen.classList.contains('hidden'))) {
      return;
    }
    if (state.activeTab && state.activeTab !== 'map') {
      switchTab('map', false);
    }
  });

  tabs.forEach(t => {
    t.onclick = (e) => {
      e.preventDefault();
      const tabId = t.getAttribute('data-tab');
      switchTab(tabId);
    };
  });

  return { switchTab };
}
