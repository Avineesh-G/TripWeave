// Itinerary Timeline List & AI Assistant Card UI Controller
import { ICONS } from '../icons.js';
import { formatMinutes, getPlaceHours } from '../services/scheduler.service.js';
import { generateRoadTripPlan } from '../services/ai.service.js';

export function setupTimelineUI({ onStopDeleted = null, onPlanGenerated = null, onToast = null }) {
  const container = document.getElementById('timeline-list');
  const btnGenerateAI = document.getElementById('btn-generate-ai-plan');
  const aiInputOrigin = document.getElementById('ai-chat-origin');
  const aiInputDest = document.getElementById('ai-chat-dest');
  const aiInputMembers = document.getElementById('ai-chat-members');
  const aiInputBudget = document.getElementById('ai-chat-budget');
  const comfortChips = document.querySelectorAll('#ai-comfort-chips .ai-pill-chip');
  const diningChips = document.querySelectorAll('#ai-dining-chips .ai-pill-chip');

  let selectedComfort = 'comfort';
  let selectedDining = 'dhabas';

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
      btnGenerateAI.innerHTML = `<span class="spinner-ai" style="width:16px;height:16px;border-width:2px;"></span> Calculating Plan...`;

      try {
        const plan = await generateRoadTripPlan({
          origin: orig,
          destination: dest,
          members,
          targetBudget: budget,
          comfort: selectedComfort,
          dining: selectedDining
        });

        if (typeof onPlanGenerated === 'function') {
          onPlanGenerated(plan);
        }
        if (typeof onToast === 'function') {
          onToast(`Road trip itinerary created with ${plan.stops.length} stops!`);
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
