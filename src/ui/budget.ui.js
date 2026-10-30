// ==========================================================================
// TripWeave — Integrated Budget & AI Cost Optimization Controller
// ==========================================================================

import { ICONS } from '../icons.js';
import { state } from '../state.js';
import {
  calculateBudgetPercentageSplit,
  DEFAULT_BUDGET_SPLIT_PERCENTAGES
} from '../services/budget.service.js';
import { analyzeBudgetWithAI } from '../services/ai.service.js';

let activeSplitState = { ...DEFAULT_BUDGET_SPLIT_PERCENTAGES };
let lastAIAnalysis = null;

export function setupBudgetUI({ onScenarioChanged = null, onBudgetUpdated = null }) {
  const container = document.getElementById('itinerary-budget-split-container');
  const heroAmountEl = document.getElementById('budget-hero-amount');
  const perPersonTextEl = document.getElementById('budget-per-person-text');
  const remainingTextEl = document.getElementById('budget-remaining-text');
  const meterFillEl = document.getElementById('budget-meter-fill');
  const scenarioButtons = document.querySelectorAll('.scenario-btn');

  // Blueprint Inputs
  const targetBudgetInput = document.getElementById('input-target-trip-budget');
  const destinationInput = document.getElementById('input-budget-destination');
  const daysInput = document.getElementById('input-budget-days');
  const travelersInput = document.getElementById('input-budget-travelers-count');

  // Metrics Pills
  const metricPerDayTotal = document.getElementById('metric-per-day-total');
  const metricPerDayPerson = document.getElementById('metric-per-day-person');
  const metricCorridorDist = document.getElementById('metric-corridor-dist');

  // Presets
  const quickBudgetButtons = document.querySelectorAll('.quick-budget-btn');

  // AI Advisor Elements
  const btnAiAnalyze = document.getElementById('btn-ai-analyze-budget');
  const aiLoadingEl = document.getElementById('budget-ai-loading');
  const aiHeadlineEl = document.getElementById('ai-budget-headline');
  const aiSavingsBadgeText = document.getElementById('ai-budget-savings-text');
  const aiSpendingGrid = document.getElementById('ai-spending-grid');
  const aiSavingsList = document.getElementById('ai-savings-list');
  const btnApplyAiSplit = document.getElementById('btn-apply-ai-budget-split');
  const aiInconvenienceNote = document.getElementById('ai-inconvenience-note');

  // 1. Scenario switch listeners (Low, Typical, High)
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

  // 2. Target Budget input listener
  if (targetBudgetInput) {
    targetBudgetInput.oninput = () => {
      const trip = state.getActiveTrip();
      if (!trip) return;
      const val = Math.max(1000, parseFloat(targetBudgetInput.value) || 25000);
      trip.totalBudget = val;
      state.saveToStorage();
      updateMetricPills();
      if (typeof onBudgetUpdated === 'function') onBudgetUpdated();
    };
  }

  // 3. Destination / Travel Area input listener
  if (destinationInput) {
    destinationInput.onchange = () => {
      const trip = state.getActiveTrip();
      if (!trip) return;
      trip.destination = destinationInput.value.trim() || 'Destination';
      state.saveToStorage();
      if (typeof onBudgetUpdated === 'function') onBudgetUpdated();
    };
  }

  // 4. Trip Duration (Days) input listener
  if (daysInput) {
    daysInput.oninput = () => {
      const trip = state.getActiveTrip();
      if (!trip) return;
      const days = Math.max(1, parseInt(daysInput.value, 10) || 3);
      trip.durationDays = days;
      state.saveToStorage();
      updateMetricPills();
      if (typeof onBudgetUpdated === 'function') onBudgetUpdated();
    };
  }

  // 5. Travelers count listener
  if (travelersInput) {
    travelersInput.oninput = () => {
      const trip = state.getActiveTrip();
      if (!trip) return;
      const count = Math.max(1, parseInt(travelersInput.value, 10) || 4);
      trip.groupSize = count;
      state.saveToStorage();
      updateMetricPills();
      if (typeof onBudgetUpdated === 'function') onBudgetUpdated();
    };
  }

  // 6. Quick budget preset buttons (₹15k, ₹25k, ₹40k, ₹60k)
  quickBudgetButtons.forEach(btn => {
    btn.onclick = () => {
      const amount = parseFloat(btn.dataset.budget) || 25000;
      const trip = state.getActiveTrip();
      if (!trip) return;
      trip.totalBudget = amount;
      if (targetBudgetInput) targetBudgetInput.value = amount;
      state.saveToStorage();
      updateMetricPills();
      if (typeof onBudgetUpdated === 'function') onBudgetUpdated();
    };
  });

  // 7. AI Budget Assistant trigger
  if (btnAiAnalyze) {
    btnAiAnalyze.onclick = async () => {
      const trip = state.getActiveTrip() || {};
      const budget = Math.max(1000, parseFloat(targetBudgetInput ? targetBudgetInput.value : trip.totalBudget) || 25000);
      const destination = destinationInput ? (destinationInput.value.trim() || trip.destination || '') : (trip.destination || '');
      const days = Math.max(1, parseInt(daysInput ? daysInput.value : trip.durationDays, 10) || 4);
      const travelers = Math.max(1, parseInt(travelersInput ? travelersInput.value : trip.groupSize, 10) || 4);
      const vehicleModel = trip.vehicleModel || 'Standard Vehicle';
      const fuelType = trip.fuelType || 'Diesel';
      const dist = Math.max(50, Number(trip.totalDistanceKm) || (days * 220));

      if (!destination) {
        if (typeof showToast === 'function') showToast('Please enter your destination / area above first');
        if (destinationInput) destinationInput.focus();
        return;
      }

      if (aiLoadingEl) aiLoadingEl.classList.remove('hidden');
      btnAiAnalyze.disabled = true;

      try {
        const result = await analyzeBudgetWithAI({
          totalBudget: budget,
          destination,
          days,
          travelers,
          vehicleModel,
          fuelType,
          distanceKm: dist
        });

        lastAIAnalysis = result;
        if (result.recommendedSplit) {
          activeSplitState = { ...result.recommendedSplit };
          trip.customBudgetSplit = { ...activeSplitState };
          state.saveToStorage();
        }
        renderAiAnalysis(result);
        const savingsBadge = document.getElementById('ai-budget-savings-badge');
        if (savingsBadge) savingsBadge.style.display = 'inline-flex';
        if (btnApplyAiSplit) btnApplyAiSplit.style.display = 'inline-flex';
        if (typeof onBudgetUpdated === 'function') onBudgetUpdated();
      } catch (err) {
        console.error('[Budget UI] AI Analysis failed:', err);
      } finally {
        if (aiLoadingEl) aiLoadingEl.classList.add('hidden');
        btnAiAnalyze.disabled = false;
      }
    };
  }

  // 8. Apply AI Cost-Saving Split button
  if (btnApplyAiSplit) {
    btnApplyAiSplit.onclick = () => {
      if (!lastAIAnalysis || !lastAIAnalysis.recommendedSplit) return;
      activeSplitState = { ...lastAIAnalysis.recommendedSplit };

      const trip = state.getActiveTrip();
      if (trip) {
        trip.customBudgetSplit = { ...activeSplitState };
        state.saveToStorage();
      }

      if (typeof onBudgetUpdated === 'function') onBudgetUpdated();
    };
  }

  function updateMetricPills() {
    const trip = state.getActiveTrip() || {};
    const budget = Math.max(1000, parseFloat(targetBudgetInput ? targetBudgetInput.value : trip.totalBudget) || 25000);
    const days = Math.max(1, parseInt(daysInput ? daysInput.value : trip.durationDays, 10) || 4);
    const travelers = Math.max(1, parseInt(travelersInput ? travelersInput.value : trip.groupSize, 10) || 4);
    const dist = Math.max(50, Math.round(Number(trip.totalDistanceKm) || (days * 220)));

    if (metricPerDayTotal) {
      metricPerDayTotal.textContent = `₹${Math.round(budget / days).toLocaleString('en-IN')} / day`;
    }
    if (metricPerDayPerson) {
      metricPerDayPerson.textContent = `₹${Math.round(budget / (days * travelers)).toLocaleString('en-IN')} / person`;
    }
    if (metricCorridorDist) {
      metricCorridorDist.textContent = `~${dist.toLocaleString('en-IN')} km`;
    }
  }

  function renderAiAnalysis(analysis) {
    if (!analysis) return;

    if (aiHeadlineEl && analysis.summaryHeadline) {
      aiHeadlineEl.textContent = analysis.summaryHeadline;
    }
    if (aiSavingsBadgeText && analysis.estimatedTotalSavings) {
      aiSavingsBadgeText.textContent = `Potential Savings: ${analysis.estimatedTotalSavings}`;
    }

    if (aiInconvenienceNote && analysis.inconvenienceFreeTip) {
      aiInconvenienceNote.textContent = analysis.inconvenienceFreeTip;
    }

    // Render Where to Spend
    if (aiSpendingGrid && analysis.spendingPlan) {
      const plan = analysis.spendingPlan;
      aiSpendingGrid.innerHTML = `
        <div class="ai-spending-card">
          <span class="ai-spending-card-title">Stay &amp; Halt</span>
          <span class="ai-spending-card-desc">${plan.stay || 'Balanced homestays'}</span>
        </div>
        <div class="ai-spending-card">
          <span class="ai-spending-card-title">Food &amp; Dining</span>
          <span class="ai-spending-card-desc">${plan.food || 'Authentic highway dhabas'}</span>
        </div>
        <div class="ai-spending-card">
          <span class="ai-spending-card-title">Highway Fuel</span>
          <span class="ai-spending-card-desc">${plan.fuel || 'Highway cruising efficiency'}</span>
        </div>
        <div class="ai-spending-card">
          <span class="ai-spending-card-title">Activities &amp; Tolls</span>
          <span class="ai-spending-card-desc">${plan.activities || 'Permits & entry tickets'}</span>
        </div>
      `;
    }

    // Render Where to Reduce Spending (Cost Cutting Opportunities)
    if (aiSavingsList && analysis.areasToReduceSpending && Array.isArray(analysis.areasToReduceSpending)) {
      aiSavingsList.innerHTML = analysis.areasToReduceSpending.map(tactic => `
        <div class="ai-saving-item">
          <div class="ai-saving-item-header">
            <div class="ai-saving-item-title">
              <svg class="icon-xs" style="color: #059669;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>${tactic.title}</span>
            </div>
            <span class="ai-saving-amount-pill">${tactic.savingText}</span>
          </div>
          <p class="ai-saving-item-desc">${tactic.advice}</p>
        </div>
      `).join('');
    }
  }

  function renderBudget(budgetResult, trip, routeDistanceKm = 0) {
    if (!trip) return;

    const totalBudget = trip.totalBudget || 25000;
    const groupSize = trip.groupSize || 4;
    const durationDays = trip.durationDays || 4;
    const destination = trip.destination || '';

    if (trip.customBudgetSplit) {
      activeSplitState = { ...DEFAULT_BUDGET_SPLIT_PERCENTAGES, ...trip.customBudgetSplit };
    }

    // Sync input fields
    if (targetBudgetInput && document.activeElement !== targetBudgetInput) {
      targetBudgetInput.value = totalBudget;
    }
    if (travelersInput && document.activeElement !== travelersInput) {
      travelersInput.value = groupSize;
    }
    if (daysInput && document.activeElement !== daysInput) {
      daysInput.value = durationDays;
    }
    if (destinationInput && document.activeElement !== destinationInput) {
      destinationInput.value = destination;
    }

    updateMetricPills();

    // Update Badge in header
    const budgetPillBadge = document.getElementById('badge-itin-budget-amount');
    if (budgetPillBadge) {
      budgetPillBadge.textContent = `₹${totalBudget.toLocaleString('en-IN')}`;
    }

    // Calculate percentage split breakdown
    const splitData = calculateBudgetPercentageSplit(
      totalBudget,
      groupSize,
      activeSplitState,
      routeDistanceKm,
      trip,
      durationDays,
      destination
    );

    // Render AI Advisor state: only show real analysis if user has run AI advisor
    const savingsBadge = document.getElementById('ai-budget-savings-badge');
    if (!lastAIAnalysis) {
      if (aiHeadlineEl) {
        aiHeadlineEl.textContent = 'AI Travel Budget & Cost-Saving Strategy';
      }
      if (aiSavingsBadgeText) {
        aiSavingsBadgeText.textContent = 'Ready for Analysis';
      }
      if (savingsBadge) {
        savingsBadge.style.display = 'none';
      }
      if (aiSpendingGrid) {
        aiSpendingGrid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 16px; text-align: center; color: var(--on-surface-variant); font-size: 12px; background: var(--surface); border: 1px dashed var(--outline-variant); border-radius: 12px;">
            Set your target budget and destination above, then tap <strong>"Analyze with AI Assistant"</strong> for personalized spending guidance.
          </div>
        `;
      }
      if (aiSavingsList) {
        aiSavingsList.innerHTML = `
          <div style="padding: 16px; text-align: center; color: var(--on-surface-variant); font-size: 12px; background: var(--surface); border: 1px dashed var(--outline-variant); border-radius: 12px;">
            Actionable cost-reduction opportunities and money-saving tactics will appear here after AI analysis.
          </div>
        `;
      }
      if (btnApplyAiSplit) {
        btnApplyAiSplit.style.display = 'none';
      }
    } else {
      renderAiAnalysis(lastAIAnalysis);
      if (savingsBadge) {
        savingsBadge.style.display = 'inline-flex';
      }
      if (btnApplyAiSplit) {
        btnApplyAiSplit.style.display = 'inline-flex';
      }
    }

    // Update Hero Stats (Total Actual vs Target)
    const estimatedActual = budgetResult ? Math.round(budgetResult.adjustedTotal || 0) : totalBudget;

    if (heroAmountEl) {
      heroAmountEl.textContent = `₹${totalBudget.toLocaleString('en-IN')}`;
    }
    if (perPersonTextEl) {
      perPersonTextEl.textContent = `₹${splitData.perPersonTotal.toLocaleString('en-IN')} / person • ${groupSize} travelers • ${durationDays} days`;
    }

    const remaining = totalBudget - estimatedActual;
    if (remainingTextEl) {
      if (remaining >= 0) {
        remainingTextEl.textContent = `₹${remaining.toLocaleString('en-IN')} Surplus vs Route Costs`;
        remainingTextEl.style.color = '#059669';
      } else {
        remainingTextEl.textContent = `₹${Math.abs(remaining).toLocaleString('en-IN')} Over Route Estimate`;
        remainingTextEl.style.color = 'var(--error)';
      }
    }

    if (meterFillEl) {
      const pct = Math.min(100, Math.max(5, Math.round((estimatedActual / totalBudget) * 100)));
      meterFillEl.style.width = `${pct}%`;
      meterFillEl.style.background = remaining >= 0 ? 'var(--primary)' : 'var(--error)';
    }

    // Render Multi-Segment Stacked Progress Bar ("Where the Budget Goes")
    const stackedBarEl = document.getElementById('budget-stacked-bar');
    const stackedLegendEl = document.getElementById('budget-stacked-legend');

    if (stackedBarEl) {
      stackedBarEl.innerHTML = splitData.breakdown.map(cat => `
        <div class="budget-stacked-segment" style="width: ${cat.pct}%; background: ${cat.color};" title="${cat.name}: ${cat.pct}% (₹${cat.amount.toLocaleString('en-IN')})"></div>
      `).join('');
    }

    if (stackedLegendEl) {
      stackedLegendEl.innerHTML = splitData.breakdown.map(cat => `
        <div class="budget-legend-item">
          <span class="budget-legend-dot" style="background: ${cat.color};"></span>
          <span>${cat.name.split(' ')[0]}: <strong>${cat.pct}%</strong></span>
        </div>
      `).join('');
    }

    // Render Itemized Division Rows with Proportional Meter Bars (No manual range sliders)
    if (container) {
      container.innerHTML = splitData.breakdown.map(cat => {
        const iconSvg = ICONS[cat.iconKey] || ICONS.fuel;
        return `
          <div class="budget-split-item" id="split-item-${cat.id}">
            <div class="budget-split-top">
              <div class="budget-split-name-box">
                <div class="budget-split-icon-badge" style="background: ${cat.color}18; color: ${cat.color};">
                  ${iconSvg}
                </div>
                <div>
                  <div style="font-size: 13.5px; font-weight: 700; color: var(--on-surface);">${cat.name}</div>
                  <div style="font-size: 10.5px; color: ${cat.color}; font-weight: 700;">${cat.confidence}</div>
                </div>
              </div>
              <div class="budget-split-amount-box">
                <div class="budget-split-amount">₹${cat.amount.toLocaleString('en-IN')}</div>
                <div class="budget-split-per-person">₹${cat.perPerson.toLocaleString('en-IN')} / person • ₹${cat.perDay.toLocaleString('en-IN')} / day</div>
              </div>
            </div>

            <!-- Dynamic Proportional Share Meter -->
            <div class="budget-split-meter-row">
              <div class="budget-split-meter-track">
                <div class="budget-split-meter-fill" style="width: ${cat.pct}%; background: ${cat.color};"></div>
              </div>
              <span class="budget-split-pct-badge" style="background: ${cat.color}1E; color: ${cat.color};">${cat.pct}%</span>
            </div>

            <!-- Dynamic Guidance Note -->
            <p class="budget-split-advice">
              ${cat.advice}
            </p>
          </div>
        `;
      }).join('');
    }
  }

  return { renderBudget };
}
