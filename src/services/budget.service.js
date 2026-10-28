// Budget and Expense Engine Service
import { BudgetEngine } from '../engines.js';

export function calculateTripBudget(trip, expenses = [], totalDistanceKm = 0, scenario = 'typical') {
  const result = BudgetEngine.calculateBudget(trip, expenses, totalDistanceKm);
  let multiplier = 1.0;
  if (scenario === 'low') multiplier = 0.88;
  if (scenario === 'high') multiplier = 1.18;

  return {
    ...result,
    adjustedTotal: Math.round(result.totalCost * multiplier),
    adjustedPerPerson: Math.round(result.perPersonCost * multiplier),
    adjustedFuel: Math.round(result.fuelCost * multiplier),
    adjustedToll: Math.round(result.tollCost * multiplier),
    adjustedStay: Math.round(result.stayCost * multiplier),
    adjustedFood: Math.round(result.foodCost * multiplier),
    adjustedActivity: Math.round(result.activityCost * multiplier),
    multiplier
  };
}

export function buildItemizedExpenses(tripId, { fuelCost, tollCost, stayCost, mealsCost, activityCost = 0 }) {
  return [
    {
      id: `fuel-${tripId}`,
      tripId,
      category: 'FUEL',
      name: 'Fuel Expenditure',
      amount: fuelCost,
      isShared: true,
      unit: 'TOTAL'
    },
    {
      id: `toll-${tripId}`,
      tripId,
      category: 'TOLL',
      name: 'FASTag Highway Tolls',
      amount: tollCost,
      isShared: true,
      unit: 'TOTAL'
    },
    {
      id: `stay-${tripId}`,
      tripId,
      category: 'STAY',
      name: 'Accommodations & Homestays',
      amount: stayCost,
      isShared: true,
      unit: 'TOTAL'
    },
    {
      id: `food-${tripId}`,
      tripId,
      category: 'FOOD',
      name: 'Meals & Highway Food',
      amount: mealsCost,
      isShared: true,
      unit: 'TOTAL'
    },
    {
      id: `activity-${tripId}`,
      tripId,
      category: 'ACTIVITY',
      name: 'Entry Tickets & Safari',
      amount: activityCost,
      isShared: true,
      unit: 'TOTAL'
    }
  ];
}
