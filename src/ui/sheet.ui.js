// ==========================================================================
// TripWeave — Floating Bottom Trip Card & Sheet UI Controller (with Enlarge & Enclose)
// ==========================================================================

import { state } from '../state.js';

export function setupSheetUI({ onOpenFullItinerary = null, onStartNavigation = null, onAddStop = null, onCancelRoute = null }) {
  const dragHandle = document.getElementById('sheet-drag-handle');
  const peekSheet = document.getElementById('map-peek-sheet');
  const summaryPeek = document.getElementById('sheet-summary-peek');
  const mapScreen = document.getElementById('screen-map');
  const btnToggleSheet = document.getElementById('btn-toggle-sheet');
  const btnEncloseSheet = document.getElementById('btn-enclose-sheet');
  const btnEmptyCardToggle = document.getElementById('btn-empty-card-toggle');
  const btnEnlargeEmptyCard = document.getElementById('btn-enlarge-empty-card');
  const emptyStateCard = document.getElementById('trip-card-empty-state');
  const minimizedCard = document.getElementById('trip-card-minimized-state');

  function updateCardStateClasses(isEnclosed) {
    if (mapScreen) {
      mapScreen.classList.toggle('card-is-enclosed', isEnclosed);
      mapScreen.classList.toggle('card-is-enlarged', !isEnclosed);
    }
  }

  function toggleSheetExpanded(forceState = null) {
    if (!peekSheet) return;
    const shouldExpand = forceState !== null ? forceState : !peekSheet.classList.contains('expanded');
    peekSheet.classList.toggle('expanded', shouldExpand);

    if (mapScreen) {
      mapScreen.classList.toggle('sheet-is-expanded', shouldExpand);
    }
    document.body.classList.toggle('sheet-is-expanded', shouldExpand);

    const enlargeLabel = peekSheet.querySelector('.enlarge-label');
    const encloseLabel = peekSheet.querySelector('.enclose-label');
    if (enlargeLabel && encloseLabel) {
      if (shouldExpand) {
        enlargeLabel.classList.add('hidden');
        encloseLabel.classList.remove('hidden');
      } else {
        enlargeLabel.classList.remove('hidden');
        encloseLabel.classList.add('hidden');
      }
    }

    const corridorTray = document.getElementById('corridor-amenities-tray');
    if (corridorTray) {
      if (state.corridorAmenities && state.corridorAmenities.length > 0) {
        corridorTray.classList.remove('hidden');
      } else {
        corridorTray.classList.add('hidden');
      }
    }
  }

  if (dragHandle) {
    dragHandle.onclick = (e) => {
      e.stopPropagation();
      toggleSheetExpanded();
    };
  }

  if (summaryPeek) {
    summaryPeek.onclick = (e) => {
      if (e.target.closest('#btn-toggle-sheet')) return;
      toggleSheetExpanded();
    };
  }

  if (btnToggleSheet) {
    btnToggleSheet.onclick = (e) => {
      e.stopPropagation();
      toggleSheetExpanded();
    };
  }

  if (btnEncloseSheet) {
    btnEncloseSheet.onclick = (e) => {
      e.stopPropagation();
      toggleSheetExpanded(false);
    };
  }

  if (btnEmptyCardToggle) {
    btnEmptyCardToggle.onclick = (e) => {
      e.stopPropagation();
      if (peekSheet) peekSheet.classList.add('minimized');
      if (emptyStateCard) emptyStateCard.classList.add('hidden');
      if (minimizedCard) minimizedCard.classList.remove('hidden');
      updateCardStateClasses(true);
    };
  }

  if (btnEnlargeEmptyCard) {
    btnEnlargeEmptyCard.onclick = (e) => {
      e.stopPropagation();
      if (peekSheet) peekSheet.classList.remove('minimized');
      if (emptyStateCard) emptyStateCard.classList.remove('hidden');
      if (minimizedCard) minimizedCard.classList.add('hidden');
      updateCardStateClasses(false);
    };
  }

  const btnOpenFull = document.getElementById('btn-open-full-itinerary');
  if (btnOpenFull && typeof onOpenFullItinerary === 'function') {
    btnOpenFull.onclick = () => {
      toggleSheetExpanded(false);
      onOpenFullItinerary();
    };
  }

  const btnNav = document.getElementById('btn-start-navigation');
  if (btnNav && typeof onStartNavigation === 'function') {
    btnNav.onclick = () => onStartNavigation();
  }

  const btnQuickNav = document.getElementById('btn-quick-start-nav');
  if (btnQuickNav && typeof onStartNavigation === 'function') {
    btnQuickNav.onclick = (e) => {
      e.stopPropagation();
      onStartNavigation();
    };
  }

  const btnAdd = document.getElementById('btn-sheet-add-stop');
  if (btnAdd && typeof onAddStop === 'function') {
    btnAdd.onclick = () => onAddStop();
  }

  const btnCancelActive = document.getElementById('btn-cancel-active-route');
  if (btnCancelActive) {
    btnCancelActive.onclick = (e) => {
      e.stopPropagation();
      if (typeof onCancelRoute === 'function') {
        onCancelRoute();
      }
    };
  }

  const btnCancelActiveExpanded = document.getElementById('btn-cancel-active-route-expanded');
  if (btnCancelActiveExpanded) {
    btnCancelActiveExpanded.onclick = (e) => {
      e.stopPropagation();
      toggleSheetExpanded(false);
      if (typeof onCancelRoute === 'function') {
        onCancelRoute();
      }
    };
  }

  // Initial state: Card is open / enlarged by default
  updateCardStateClasses(false);

  return { toggleSheetExpanded };
}

export function updateSheetState(plan) {
  const emptyCard = document.getElementById('trip-card-empty-state');
  const activeCard = document.getElementById('trip-card-active-state');
  const minimizedCard = document.getElementById('trip-card-minimized-state');
  const peekSheet = document.getElementById('map-peek-sheet');
  const mapScreen = document.getElementById('screen-map');

  const stops = plan ? plan.stops : [];
  const hasStops = stops && stops.length > 0;

  function updateCardStateClasses(isEnclosed) {
    if (mapScreen) {
      mapScreen.classList.toggle('card-is-enclosed', isEnclosed);
      mapScreen.classList.toggle('card-is-enlarged', !isEnclosed);
    }
  }

  if (emptyCard && activeCard) {
    if (hasStops) {
      emptyCard.classList.add('hidden');
      if (minimizedCard) minimizedCard.classList.add('hidden');
      if (peekSheet) peekSheet.classList.remove('minimized');
      activeCard.classList.remove('hidden');
      updateCardStateClasses(false);
    } else {
      if (!peekSheet || !peekSheet.classList.contains('minimized')) {
        emptyCard.classList.remove('hidden');
        if (minimizedCard) minimizedCard.classList.add('hidden');
        updateCardStateClasses(false);
      } else {
        updateCardStateClasses(true);
      }
      activeCard.classList.add('hidden');
    }
  }

  const peekNextStopTitle = document.getElementById('peek-next-stop-title');
  if (peekNextStopTitle) {
    if (hasStops) {
      if (stops.length > 1) {
        peekNextStopTitle.textContent = `${stops[0].name} → ${stops[stops.length - 1].name}`;
      } else {
        peekNextStopTitle.textContent = `Destination: ${stops[0].name}`;
      }
    } else {
      peekNextStopTitle.textContent = 'No Stops Added';
    }
  }

  const peekStatsSubtitle = document.getElementById('peek-stats-subtitle');
  if (peekStatsSubtitle) {
    peekStatsSubtitle.textContent = hasStops
      ? `${stops.length} stops • ${Math.round(plan.totalDistanceKm || 0)} km • ${plan.trip ? plan.trip.groupSize : 1} travelers`
      : '0 stops • 0 km • 0 travelers';
  }

  const peekTotalCost = document.getElementById('peek-total-cost');
  if (peekTotalCost) {
    const cost = (plan && plan.budgetResult) ? Math.round(plan.budgetResult.totalCost) : 0;
    peekTotalCost.textContent = `₹${cost.toLocaleString('en-IN')}`;
  }

  const peekBudgetCaption = document.getElementById('peek-budget-caption');
  if (peekBudgetCaption) {
    const budgetVal = (plan && plan.trip && plan.trip.totalBudget) ? Math.round(plan.trip.totalBudget) : 0;
    peekBudgetCaption.textContent = `of ₹${budgetVal.toLocaleString('en-IN')} budget`;
  }

  const sheetList = document.getElementById('sheet-stops-compact-list');
  if (sheetList) {
    if (!hasStops) {
      sheetList.innerHTML = '<div style="font-size: 12px; color: var(--on-surface-variant); padding: 8px 0; text-align: center;">No stops added yet. Tap anywhere on the map or search to add stops.</div>';
    } else {
      sheetList.innerHTML = stops.map((s, idx) => {
        let metaText = 'Start Point';
        if (idx > 0) {
          const legKm = s.roadDistanceKm || (plan.scheduleResult && plan.scheduleResult.stops[idx] ? plan.scheduleResult.stops[idx].distanceFromPreviousKm : 0);
          const durMin = s.durationMinutes || (plan.scheduleResult && plan.scheduleResult.stops[idx] ? plan.scheduleResult.stops[idx].travelDurationFromPreviousMinutes : 60);
          const hrs = Math.floor(durMin / 60);
          const mins = durMin % 60;
          const durStr = hrs > 0 ? `${hrs}h ${mins > 0 ? mins + 'm' : ''}` : `${mins}m`;
          metaText = `+${Math.round(legKm)} km • ~${durStr} drive`;
        }
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; padding: 6px 0; border-bottom: 1px dashed var(--outline-variant);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--primary-container); color: var(--on-primary-container); font-size: 11px; font-weight: 800;">${idx + 1}</span>
              <strong style="color: var(--on-surface); font-size: 13px;">${s.name}</strong>
            </div>
            <span style="color: var(--primary); font-weight: 700; font-size: 11.5px;">${metaText}</span>
          </div>
        `;
      }).join('');
    }
  }
}
