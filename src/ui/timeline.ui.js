// Itinerary Timeline List & AI Assistant Card UI Controller
import { ICONS } from '../icons.js';
import { formatMinutes, getPlaceHours } from '../services/scheduler.service.js';
import { generateRoadTripPlan } from '../services/ai.service.js';

export function setupTimelineUI({ onStopDeleted = null, onPlanGenerated = null, onDownloadPdf = null, onToast = null }) {
  const container = document.getElementById('timeline-list');
  const btnGenerateAI = document.getElementById('btn-generate-ai-plan');
  const aiInputOrigin = document.getElementById('ai-chat-origin');
  const aiInputDest = document.getElementById('ai-chat-dest');
  const aiInputMembers = document.getElementById('ai-chat-members');
  const aiInputBudget = document.getElementById('ai-chat-budget');
  const comfortChips = document.querySelectorAll('#ai-comfort-chips .ai-pill-chip');
  const diningChips = document.querySelectorAll('#ai-dining-chips .ai-pill-chip');
  const resultContainer = document.getElementById('ai-chat-result');

  let selectedComfort = 'comfort';
  let selectedDining = 'dhabas';
  let lastCalculatedPlan = null;

  comfortChips.forEach(chip => {
    chip.onclick = () => {
      comfortChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedComfort = chip.getAttribute('data-comfort');
    };
  });

  diningChips.forEach(chip => {
    chip.onclick = () => {
      diningChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedDining = chip.getAttribute('data-dining');
    };
  });

  function renderPlanResult(plan) {
    if (!resultContainer) return;
    lastCalculatedPlan = plan;

    resultContainer.innerHTML = `
      <div class="calculated-tour-card" style="background: var(--surface-container); border: 1.5px solid var(--primary); border-radius: 18px; padding: 16px; margin-top: 12px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
          <div>
            <div style="font-size: 15px; font-weight: 800; color: var(--on-surface);">${plan.title}</div>
            <div style="font-size: 12px; color: var(--on-surface-variant); margin-top: 2px;">
              ${plan.origin} → ${plan.destination} • ${plan.members || 4} travelers
            </div>
          </div>
          <span class="chip active" style="font-size: 10.5px; padding: 3px 9px; border-radius: 20px; background: var(--primary-container); color: var(--primary); font-weight: 700; white-space: nowrap;">
            Verified Route
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: var(--surface); padding: 10px; border-radius: 12px; border: 1px solid var(--outline-variant); text-align: center;">
          <div>
            <div style="font-size: 9.5px; color: var(--on-surface-variant); font-weight: 700;">DISTANCE</div>
            <div style="font-size: 13px; font-weight: 800; color: var(--on-surface); margin-top: 2px;">${plan.totalDistanceKm} km</div>
          </div>
          <div>
            <div style="font-size: 9.5px; color: var(--on-surface-variant); font-weight: 700;">DRIVE</div>
            <div style="font-size: 13px; font-weight: 800; color: var(--on-surface); margin-top: 2px;">~${plan.totalDrivingHours}h</div>
          </div>
          <div>
            <div style="font-size: 9.5px; color: var(--on-surface-variant); font-weight: 700;">STOPS</div>
            <div style="font-size: 13px; font-weight: 800; color: var(--on-surface); margin-top: 2px;">${plan.stops.length}</div>
          </div>
          <div>
            <div style="font-size: 9.5px; color: var(--on-surface-variant); font-weight: 700;">BUDGET</div>
            <div style="font-size: 13px; font-weight: 800; color: var(--primary); margin-top: 2px;">₹${(plan.totalCost || 0).toLocaleString('en-IN')}</div>
          </div>
        </div>

        <!-- Real Waypoint Stops preview -->
        <div style="font-size: 11.5px; color: var(--on-surface-variant); display: flex; flex-direction: column; gap: 5px; background: var(--surface-container-low); padding: 8px 12px; border-radius: 10px; border: 1px solid var(--outline-variant);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #10B981; flex-shrink: 0;"></span>
            <strong>Start:</strong> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${plan.origin}</span>
          </div>
          ${plan.stops.slice(1, -1).map(s => `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #F59E0B; flex-shrink: 0;"></span>
              <strong>Waypoint:</strong> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.name}</span>
            </div>
          `).join('')}
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #EF4444; flex-shrink: 0;"></span>
            <strong>End:</strong> <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${plan.destination}</span>
          </div>
        </div>

        <!-- Bottom Action Options: View in App or Download as PDF -->
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button id="btn-tour-view-app" class="btn-primary" style="flex: 1; padding: 11px 12px; border-radius: var(--radius-pill); font-weight: 700; font-size: 12.5px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;" type="button">
            <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            <span>View in App</span>
          </button>
          <button id="btn-tour-download-pdf" class="btn-secondary" style="flex: 1.25; padding: 11px 12px; border-radius: var(--radius-pill); font-weight: 800; font-size: 12.5px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: var(--primary); color: #FFFFFF; border: none; box-shadow: 0 4px 14px rgba(26, 86, 219, 0.32); cursor: pointer;" type="button">
            <svg class="icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Download as PDF</span>
          </button>
        </div>
      </div>
    `;
    resultContainer.classList.remove('hidden');

    const btnViewApp = document.getElementById('btn-tour-view-app');
    if (btnViewApp) {
      btnViewApp.onclick = () => {
        if (typeof onPlanGenerated === 'function') onPlanGenerated(plan);
      };
    }

    const btnDownloadPdf = document.getElementById('btn-tour-download-pdf');
    if (btnDownloadPdf) {
      btnDownloadPdf.onclick = () => {
        if (typeof onDownloadPdf === 'function') onDownloadPdf(plan);
      };
    }
  }

  if (btnGenerateAI) {
    btnGenerateAI.onclick = async () => {
      const orig = aiInputOrigin.value.trim();
      const dest = aiInputDest.value.trim();
      const members = parseInt(aiInputMembers.value, 10) || 4;
      const budget = parseInt(aiInputBudget.value, 10) || 15000;

      if (!orig || !dest) {
        if (typeof onToast === 'function') onToast('Please enter both Starting City and Destination');
        return;
      }

      const originalBtnText = btnGenerateAI.innerHTML;
      btnGenerateAI.disabled = true;
      btnGenerateAI.innerHTML = `<span class="spinner-ai" style="width:16px;height:16px;border-width:2px;"></span> Calculating Verified Plan...`;

      try {
        const plan = await generateRoadTripPlan({
          origin: orig,
          destination: dest,
          members,
          targetBudget: budget,
          comfort: selectedComfort,
          dining: selectedDining
        });

        renderPlanResult(plan);

        if (typeof onToast === 'function') {
          onToast(`Road trip plan ready! Choose "View in App" or "Download as PDF" below.`);
        }
      } catch (err) {
        console.error('AI plan error:', err);
        if (typeof onToast === 'function') onToast('Could not calculate trip plan. Check city names.');
      } finally {
        btnGenerateAI.disabled = false;
        btnGenerateAI.innerHTML = originalBtnText;
      }
    };
  }

  function renderTimeline(scheduleResult, stops) {
    if (!container) return;
    container.innerHTML = '';

    if (!stops || stops.length === 0) {
      container.innerHTML = `
        <div style="padding: 36px 16px; text-align: center; background: var(--surface-container-low); border: 1px dashed var(--outline-variant); border-radius: 16px; margin: 16px 0;">
          <div style="font-size: 15px; font-weight: 700; color: var(--on-surface);">Your Itinerary is Empty</div>
          <p style="font-size: 12.5px; color: var(--on-surface-variant); margin: 6px 0 16px 0; line-height: 1.5;">Search places on the map or use the AI Assistant to generate your stops.</p>
        </div>
      `;
      return;
    }

    const scheduledStops = scheduleResult ? scheduleResult.stops : [];
    scheduledStops.forEach((scheduled, index) => {
      const itemWrapper = document.createElement('div');
      itemWrapper.className = 'timeline-item-wrapper';

      const hoursInfo = getPlaceHours(scheduled.stop.name);
      const hoursLabel = hoursInfo ? hoursInfo.name : '09:00 AM - 06:00 PM';

      let warningBadge = `<span class="confidence-chip official">${ICONS.check}<span>Open on Arrival</span></span>`;
      let closingBanner = '';

      if (scheduled.openingStatus === 'CLOSED_ON_ARRIVAL') {
        warningBadge = `<span class="confidence-chip error">${ICONS.warning}<span>Closed on Arrival</span></span>`;
        closingBanner = `
          <div style="background: var(--error-container); color: var(--error); padding: 8px 10px; border-radius: var(--radius-sm); font-size: 11px; margin-top: 6px;">
            <strong>Closed on arrival:</strong> Arriving at ${formatMinutes(scheduled.arrivalMinutes)}. Operating hours: ${hoursLabel}.
          </div>
        `;
      } else if (scheduled.openingStatus === 'TIGHT_CLOSING') {
        warningBadge = `<span class="confidence-chip tight">${ICONS.clock}<span>Closing Soon</span></span>`;
      }

      const overnightBadge = scheduled.stop.isOvernight
        ? `<span class="confidence-chip" style="background: var(--secondary-container); color: var(--primary);">${ICONS.moon}<span>Overnight Rest</span></span>`
        : '';

      itemWrapper.innerHTML = `
        <div class="timeline-spine-col">
          <div class="timeline-dot">${index + 1}</div>
          ${index < scheduledStops.length - 1 ? '<div class="timeline-spine-line"></div>' : ''}
        </div>
        <div class="timeline-content-card">
          <div class="stop-header-row">
            <div>
              <div class="stop-title">${scheduled.stop.name}</div>
              <div class="stop-times">${formatMinutes(scheduled.arrivalMinutes)} — ${formatMinutes(scheduled.departureMinutes)} (${scheduled.stop.durationMinutes || 60}m visit)</div>
              ${scheduled.stop.recommendedFood ? `<div style="font-size: 11px; color: var(--on-surface-variant); margin-top: 2px;">Dining: ${scheduled.stop.recommendedFood}</div>` : ''}
            </div>
            <div style="display: flex; gap: 4px;">
              ${index > 0 && index < scheduledStops.length - 1 ? `<button class="btn-small delete-stop-btn" data-id="${scheduled.stop.id}" style="color: var(--error); display: inline-flex; align-items: center; justify-content: center; padding: 2px 6px;" title="Remove stop">${ICONS.close}</button>` : ''}
            </div>
          </div>
          <div class="stop-meta-row" style="margin-top: 6px;">
            ${warningBadge}
            ${overnightBadge}
            <span class="confidence-chip calculated">${ICONS.clock}<span>Hours: ${hoursLabel}</span></span>
          </div>
          ${closingBanner}
        </div>
      `;

      const deleteBtn = itemWrapper.querySelector('.delete-stop-btn');
      if (deleteBtn) {
        deleteBtn.onclick = () => {
          if (typeof onStopDeleted === 'function') {
            onStopDeleted(scheduled.stop.id);
          }
        };
      }

      container.appendChild(itemWrapper);

      // Travel connector between stops
      if (index < scheduledStops.length - 1) {
        const next = scheduledStops[index + 1];
        const durMin = next.travelDurationFromPreviousMinutes || 30;
        const hrs = Math.floor(durMin / 60);
        const mins = durMin % 60;
        const durStr = hrs > 0 ? `${hrs}h ${mins > 0 ? mins + 'm' : ''}` : `${mins} mins`;

        const conn = document.createElement('div');
        conn.className = 'travel-connector';
        conn.innerHTML = `
          ${ICONS.car}
          <span>${Math.round(next.distanceFromPreviousKm || 0)} km</span>
          <span>•</span>
          <span>~${durStr} drive</span>
        `;
        container.appendChild(conn);
      }
    });
  }

  return { renderTimeline };
}
