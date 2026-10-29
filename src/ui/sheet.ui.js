// ==========================================================================
// TripWeave — Floating Bottom Trip Card & Sheet UI Controller (with Enlarge & Enclose)
// ==========================================================================

import { state } from '../state.js';
import { navigationEngine, MANEUVER_SVGS, formatDistance } from '../services/guidance.service.js';
import { highlightTurnLocation } from '../services/map.service.js';
import { showToast } from './modals.ui.js';

export function setupSheetUI({ onOpenFullItinerary = null, onStartNavigation = null, onAddStop = null, onCancelRoute = null }) {
  const dragHandle = document.getElementById('sheet-drag-handle');
  const peekSheet = document.getElementById('map-peek-sheet');
  const summaryPeek = document.getElementById('sheet-summary-peek');
  const mapScreen = document.getElementById('screen-map');
  const btnToggleSheet = document.getElementById('btn-toggle-sheet');
  const btnEncloseSheet = document.getElementById('btn-enclose-sheet');

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
      const willExpand = !peekSheet.classList.contains('expanded');
      toggleSheetExpanded();
      if (willExpand && tabSteps && state.activeRoute) {
        tabSteps.click();
      }
    };
  }

  if (btnEncloseSheet) {
    btnEncloseSheet.onclick = (e) => {
      e.stopPropagation();
      toggleSheetExpanded(false);
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

  // Tab switching: Stops vs Turn-by-Turn Directions
  const tabStops = document.getElementById('tab-sheet-stops');
  const tabSteps = document.getElementById('tab-sheet-steps');
  const viewStops = document.getElementById('sheet-stops-view');
  const viewDirections = document.getElementById('sheet-directions-view');

  if (tabStops && tabSteps) {
    tabStops.onclick = (e) => {
      e.stopPropagation();
      tabStops.classList.add('active');
      tabSteps.classList.remove('active');
      if (viewStops) viewStops.classList.remove('hidden');
      if (viewDirections) viewDirections.classList.add('hidden');
    };

    tabSteps.onclick = (e) => {
      e.stopPropagation();
      tabSteps.classList.add('active');
      tabStops.classList.remove('active');
      if (viewDirections) viewDirections.classList.remove('hidden');
      if (viewStops) viewStops.classList.add('hidden');
    };
  }

  const btnStepsNav = document.getElementById('btn-sheet-steps-start-nav');
  if (btnStepsNav && typeof onStartNavigation === 'function') {
    btnStepsNav.onclick = () => onStartNavigation();
  }

  // Initial state: Hide sheet if no stops exist
  const initialStops = state.getActiveStops();
  if (!initialStops || initialStops.length === 0) {
    if (peekSheet) {
      peekSheet.classList.add('hidden');
      peekSheet.classList.remove('expanded', 'minimized');
    }
  }

  return { toggleSheetExpanded };
}

export function updateSheetState(plan) {
  const activeCard = document.getElementById('trip-card-active-state');
  const peekSheet = document.getElementById('map-peek-sheet');
  const mapScreen = document.getElementById('screen-map');

  const stops = plan ? plan.stops : [];
  const hasStops = stops && stops.length > 0;

  if (!peekSheet) return;

  if (hasStops) {
    peekSheet.classList.remove('hidden');
    if (activeCard) activeCard.classList.remove('hidden');
    if (mapScreen) {
      mapScreen.classList.remove('card-is-enclosed');
      mapScreen.classList.add('card-is-enlarged');
    }
  } else {
    // Keep map 100% clean and unobstructed when no trip is active
    peekSheet.classList.add('hidden');
    peekSheet.classList.remove('expanded', 'minimized');
    if (activeCard) activeCard.classList.add('hidden');
    if (mapScreen) {
      mapScreen.classList.remove('card-is-enclosed', 'card-is-enlarged', 'sheet-is-expanded');
    }
    document.body.classList.remove('sheet-is-expanded');
    return;
  }

  const activeRoute = state.activeRoute;
  const peekRouteHeroTime = document.getElementById('peek-route-hero-time');
  const peekRouteHeroSub = document.getElementById('peek-route-hero-sub');
  const peekNextStopTitle = document.getElementById('peek-next-stop-title');

  if (activeRoute && activeRoute.polylineLatlngs && activeRoute.polylineLatlngs.length > 1) {
    const mins = Math.round(activeRoute.durationMinutes || 0);
    const hrs = Math.floor(mins / 60);
    const remM = mins % 60;
    const durStr = hrs > 0 ? `${hrs} hr ${remM > 0 ? remM + ' min' : ''}` : `${mins} min`;
    const km = Math.round(activeRoute.distanceKm || 0);

    if (peekRouteHeroTime) peekRouteHeroTime.textContent = durStr;
    if (peekRouteHeroSub) {
      peekRouteHeroSub.innerHTML = `<span>${km} km</span> • <span class="route-fastest-tag">⚡ Fastest route</span>`;
    }
  } else if (hasStops) {
    const estKm = Math.round(plan.totalDistanceKm || 0);
    const estHrs = Math.round((plan.totalDurationHours || (estKm / 55)) * 10) / 10;
    if (peekRouteHeroTime) peekRouteHeroTime.textContent = estHrs > 0 ? `~${estHrs} hrs` : '-- min';
    if (peekRouteHeroSub) peekRouteHeroSub.textContent = `${estKm} km • Itinerary Plan`;
  } else {
    if (peekRouteHeroTime) peekRouteHeroTime.textContent = '-- min';
    if (peekRouteHeroSub) peekRouteHeroSub.textContent = '-- km • No route';
  }

  if (peekNextStopTitle) {
    const trip = state.getActiveTrip();
    if (trip && trip.origin && trip.destination) {
      peekNextStopTitle.textContent = `${trip.origin} → ${trip.destination}`;
    } else if (hasStops) {
      if (stops.length > 1) {
        peekNextStopTitle.textContent = `${stops[0].name} → ${stops[stops.length - 1].name}`;
      } else {
        peekNextStopTitle.textContent = stops[0].name;
      }
    } else {
      peekNextStopTitle.textContent = 'Enter Destination';
    }
  }

  const peekStatsSubtitle = document.getElementById('peek-stats-subtitle');
  if (peekStatsSubtitle) {
    peekStatsSubtitle.textContent = hasStops
      ? `${stops.length} stops • ${Math.round(plan.totalDistanceKm || 0)} km`
      : '0 stops • 0 km';
  }

  const peekTotalCost = document.getElementById('peek-total-cost');
  if (peekTotalCost) {
    const cost = (plan && plan.budgetResult) ? Math.round(plan.budgetResult.totalCost) : 0;
    peekTotalCost.textContent = `₹${cost.toLocaleString('en-IN')}`;
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
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; padding: 8px 0; border-bottom: 1px dashed var(--outline-variant);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: var(--primary-container); color: var(--on-primary-container); font-size: 11px; font-weight: 800;">${idx + 1}</span>
              <strong style="color: var(--on-surface); font-size: 13px;">${s.name}</strong>
            </div>
            <span style="color: var(--primary); font-weight: 700; font-size: 11.5px;">${metaText}</span>
          </div>
        `;
      }).join('');
    }
  }

  // Render Connected Vertical Timeline Turn-by-Turn Maneuvers in sheet
  const stepsList = document.getElementById('sheet-directions-steps-list');
  const stepsBadge = document.getElementById('tab-steps-badge');
  const dirSummaryTitle = document.getElementById('sheet-directions-summary-title');
  const dirSummarySub = document.getElementById('sheet-directions-summary-sub');

  if (activeRoute && activeRoute.polylineLatlngs && activeRoute.polylineLatlngs.length > 1) {
    const parsedSteps = navigationEngine.parseSteps(activeRoute);
    if (stepsBadge) stepsBadge.textContent = String(parsedSteps.length);

    if (dirSummaryTitle) {
      const trip = state.getActiveTrip();
      dirSummaryTitle.textContent = trip ? `${trip.origin || 'Start'} → ${trip.destination}` : 'Highway Route';
    }
    if (dirSummarySub) {
      const km = Math.round(activeRoute.distanceKm || 0);
      const mins = activeRoute.durationMinutes || 0;
      const hrs = Math.floor(mins / 60);
      const remM = mins % 60;
      const durText = hrs > 0 ? `${hrs} hr ${remM > 0 ? remM + ' min' : ''}` : `${mins} min`;
      dirSummarySub.textContent = `⚡ Fastest route • ${km} km • ~${durText} drive`;
    }

    if (stepsList) {
      stepsList.innerHTML = `
        <div class="timeline-steps-wrapper">
          <div class="timeline-steps-spine"></div>
          ${parsedSteps.map((st, i) => {
            const isFirst = i === 0;
            const isLast = i === parsedSteps.length - 1;
            const iconSvg = MANEUVER_SVGS[st.iconKey] || MANEUVER_SVGS.straight;
            const distStr = formatDistance(st.distanceMeters);
            const locAttr = st.location ? `data-lat="${st.location[0]}" data-lng="${st.location[1]}"` : '';
            
            let badgeClass = 'timeline-badge-default';
            if (isFirst) badgeClass = 'timeline-badge-start';
            else if (isLast) badgeClass = 'timeline-badge-end';

            return `
              <div class="directions-step-item ${isFirst ? 'is-start' : ''} ${isLast ? 'is-end' : ''}" data-step-idx="${i}" ${locAttr} data-instruction="${st.instruction}">
                <div class="timeline-step-badge ${badgeClass}">
                  ${iconSvg}
                </div>
                <div class="step-content">
                  <div class="step-instruction">${st.instruction}</div>
                  <div class="step-meta-row">
                    <span class="step-dist-pill">${distStr}</span>
                    <span class="step-road-text">${st.name || 'Highway Corridor'}</span>
                  </div>
                </div>
                <div class="step-action-arrow">
                  <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      stepsList.querySelectorAll('.directions-step-item').forEach(itemEl => {
        itemEl.onclick = () => {
          stepsList.querySelectorAll('.directions-step-item').forEach(el => el.classList.remove('selected-step'));
          itemEl.classList.add('selected-step');

          const lat = parseFloat(itemEl.getAttribute('data-lat'));
          const lng = parseFloat(itemEl.getAttribute('data-lng'));
          const inst = itemEl.getAttribute('data-instruction') || 'Turn location';
          if (!isNaN(lat) && !isNaN(lng)) {
            highlightTurnLocation(lat, lng, inst);
            showToast(inst);
          }
        };
      });
    }
  } else {
    if (stepsBadge) stepsBadge.textContent = '0';
    if (stepsList) {
      stepsList.innerHTML = '<div style="font-size: 12px; color: var(--on-surface-variant); padding: 16px 0; text-align: center;">No active route calculated yet. Enter a destination to view turn-by-turn steps.</div>';
    }
  }
}
