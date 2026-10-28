// ==========================================================================
// TripWeave — Budget Screen & Transparent Cost Breakdown UI Controller
// ==========================================================================

import { ICONS } from '../icons.js';
import { state } from '../state.js';

export function setupBudgetUI({ onScenarioChanged = null }) {
  const container = document.getElementById('category-cards-list');
  const heroAmountEl = document.getElementById('budget-hero-amount');
  const perPersonTextEl = document.getElementById('budget-per-person-text');
  const remainingTextEl = document.getElementById('budget-remaining-text');
  const meterFillEl = document.getElementById('budget-meter-fill');
  const contingencyEl = document.getElementById('budget-contingency-val');
  const scenarioButtons = document.querySelectorAll('.scenario-btn');

  scenarioButtons.forEach(btn => {
    btn.onclick = () => {
      scenarioButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const scenario = btn.getAttribute('data-scenario') || 'typical';
      state.setScenario(scenario);
      if (typeof onScenarioChanged === 'function') {
        onScenarioChanged(scenario);
      }
    };
  });

  function renderBudget(budgetResult, trip) {
    if (!budgetResult) return;

    const groupSize = (trip && trip.groupSize) ? trip.groupSize : 4;
    const totalCost = Math.round(budgetResult.adjustedTotal || 0);
    const perPerson = Math.round(budgetResult.adjustedPerPerson || 0);

    if (heroAmountEl) heroAmountEl.textContent = `₹${totalCost.toLocaleString('en-IN')}`;
    if (perPersonTextEl) perPersonTextEl.textContent = `₹${perPerson.toLocaleString('en-IN')} / person • ${groupSize} travelers`;

    const totalBudget = (trip && trip.totalBudget) ? trip.totalBudget : 25000;
    const remaining = totalBudget - totalCost;

    if (remainingTextEl) {
      if (remaining >= 0) {
        remainingTextEl.textContent = `₹${remaining.toLocaleString('en-IN')} Remaining`;
        remainingTextEl.style.color = 'var(--primary)';
      } else {
        remainingTextEl.textContent = `₹${Math.abs(remaining).toLocaleString('en-IN')} Over Budget`;
        remainingTextEl.style.color = 'var(--error)';
      }
    }

    if (meterFillEl) {
      const pct = Math.min(100, Math.max(0, Math.round((totalCost / totalBudget) * 100)));
      meterFillEl.style.width = `${pct}%`;
      meterFillEl.style.background = remaining >= 0 ? 'var(--primary)' : 'var(--error)';
    }

    if (contingencyEl) {
      const contingency = Math.round(totalCost * 0.1);
      contingencyEl.textContent = `₹${contingency.toLocaleString('en-IN')}`;
    }

    if (!container) return;

    const categories = [
      {
        key: 'fuel',
        icon: ICONS.fuel,
        name: 'Fuel Expenditure',
        amount: Math.round(budgetResult.adjustedFuel || 0),
        note: `${Math.round(budgetResult.totalDistanceKm || 0)} km highway driving at ₹${(trip?.fuelPricePerLitre || 102.5)}/L`,
        confidence: 'High (Formula)'
      },
      {
        key: 'tolls',
        icon: ICONS.tolls,
        name: 'FASTag Highway Tolls',
        amount: Math.round(budgetResult.adjustedToll || 0),
        note: 'National Highway NHAI plaza rates',
        confidence: 'Verified Rates'
      },
      {
        key: 'stays',
        icon: ICONS.stays,
        name: 'Accommodations & Homestays',
        amount: Math.round(budgetResult.adjustedStay || 0),
        note: 'Comfort tier highway resort & homestays',
        confidence: 'Market Dynamic'
      },
      {
        key: 'food',
        icon: ICONS.food,
        name: 'Meals & Highway Dhabas',
        amount: Math.round(budgetResult.adjustedFood || 0),
        note: `Breakfast, lunch, and dinner for ${groupSize} travelers`,
        confidence: 'Regional Estimates'
      },
      {
        key: 'activities',
        icon: ICONS.activities,
        name: 'Heritage Monuments & Safaris',
        amount: Math.round(budgetResult.adjustedActivity || 0),
        note: 'ASI monument permits and park entrance',
        confidence: 'Official ASI Tickets'
      }
    ];

    container.innerHTML = categories.map(cat => `
      <div class="budget-category-row">
        <div class="budget-cat-left">
          <div class="budget-cat-icon-box">${cat.icon}</div>
          <div>
            <div class="budget-cat-name">${cat.name}</div>
            <div style="font-size: 11px; color: var(--on-surface-variant); margin-top: 2px;">${cat.note}</div>
          </div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <strong style="font-size: 14.5px; color: var(--on-surface);">₹${cat.amount.toLocaleString('en-IN')}</strong>
          <div style="font-size: 10px; color: var(--primary); font-weight: 700; margin-top: 2px;">${cat.confidence}</div>
        </div>
      </div>
    `).join('');
  }

  return { renderBudget };
}
