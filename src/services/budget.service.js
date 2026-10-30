// Budget and Expense Engine Service
import { BudgetEngine } from '../engines.js';

export const FUEL_TYPES = {
  PETROL: {
    id: 'PETROL',
    name: 'Petrol (91)',
    shortName: 'Petrol',
    unit: 'L',
    mileageUnit: 'km / L',
    priceUnit: '₹ / L',
    defaultPrice: 102.8,
    defaultMileage: 16.0,
    badgeColor: '#EF4444'
  },
  DIESEL: {
    id: 'DIESEL',
    name: 'Diesel',
    shortName: 'Diesel',
    unit: 'L',
    mileageUnit: 'km / L',
    priceUnit: '₹ / L',
    defaultPrice: 89.6,
    defaultMileage: 19.5,
    badgeColor: '#F59E0B'
  },
  EV: {
    id: 'EV',
    name: 'EV (Electric)',
    shortName: 'EV Battery',
    unit: 'kWh',
    mileageUnit: 'km / kWh',
    priceUnit: '₹ / kWh',
    defaultPrice: 8.5,
    defaultMileage: 7.2,
    badgeColor: '#10B981'
  },
  XP100: {
    id: 'XP100',
    name: 'XP100 (100 Octane)',
    shortName: 'XP100',
    unit: 'L',
    mileageUnit: 'km / L',
    priceUnit: '₹ / L',
    defaultPrice: 160.0,
    defaultMileage: 11.2,
    badgeColor: '#8B5CF6'
  },
  XP95: {
    id: 'XP95',
    name: 'XP95 (95 Octane)',
    shortName: 'XP95',
    unit: 'L',
    mileageUnit: 'km / L',
    priceUnit: '₹ / L',
    defaultPrice: 108.5,
    defaultMileage: 17.5,
    badgeColor: '#EC4899'
  },
  CNG: {
    id: 'CNG',
    name: 'CNG',
    shortName: 'CNG',
    unit: 'kg',
    mileageUnit: 'km / kg',
    priceUnit: '₹ / kg',
    defaultPrice: 82.5,
    defaultMileage: 26.5,
    badgeColor: '#06B6D4'
  },
  HYBRID: {
    id: 'HYBRID',
    name: 'Strong Hybrid',
    shortName: 'Strong Hybrid',
    unit: 'L',
    mileageUnit: 'km / L',
    priceUnit: '₹ / L',
    defaultPrice: 102.8,
    defaultMileage: 27.5,
    badgeColor: '#3B82F6'
  }
};

export const TRANSPORT_MODES = {
  ALL: { id: 'ALL', name: 'All Vehicles', icon: 'spark' },
  CAR: { id: 'CAR', name: 'Cars & Sedans', icon: 'car' },
  BIKE: { id: 'BIKE', name: 'Bikes & Motos', icon: 'bike' },
  SUV: { id: 'SUV', name: 'SUVs & 4x4s', icon: 'suv' },
  EV: { id: 'EV', name: 'Electric (EV)', icon: 'bolt' }
};

import { GLOBAL_VEHICLE_DATABASE, VEHICLE_BRANDS } from './vehicles.database.js';

export { GLOBAL_VEHICLE_DATABASE, VEHICLE_BRANDS };
export const VEHICLE_MODELS = GLOBAL_VEHICLE_DATABASE;

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

export function recommendBestVehicleForTrip(distanceKm = 0, currentTrip = {}, preferredTransportMode = 'ALL') {
  const effectiveDistance = Math.max(distanceKm || 0, 100);
  const curMileage = Math.max(0.1, currentTrip.vehicleMileageKmPerLitre || 16);
  const curPrice = currentTrip.fuelPricePerLitre || 102.8;
  const currentCost = Math.round((effectiveDistance / curMileage) * curPrice);

  const vehicleComparisons = VEHICLE_MODELS.map(v => {
    const cost = Math.round((effectiveDistance / v.mileage) * v.price);
    const savings = currentCost - cost;
    return {
      ...v,
      tripCost: cost,
      savings
    };
  });

  // Filter if user has chosen a specific transport mode
  const filtered = preferredTransportMode && preferredTransportMode !== 'ALL'
    ? vehicleComparisons.filter(v => v.transportType === preferredTransportMode)
    : vehicleComparisons;

  // Sort by lowest trip cost
  const pool = filtered.length > 0 ? filtered : vehicleComparisons;
  const sorted = [...pool].sort((a, b) => a.tripCost - b.tripCost);
  const bestVehicle = sorted[0];

  // Best hybrid or non-EV within the pool
  const bestNonEv = sorted.find(v => v.fuelType !== 'EV') || sorted[1] || sorted[0];

  return {
    effectiveDistance,
    currentCost,
    bestVehicle,
    bestNonEv,
    preferredTransportMode,
    allComparisons: vehicleComparisons
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

// ==========================================================================
// Percentage Budget Split & Expense Division Engine
// ==========================================================================

export const DEFAULT_BUDGET_SPLIT_PERCENTAGES = {
  FUEL: 22,
  STAY: 35,
  FOOD: 20,
  TOLLS: 5,
  ACTIVITIES: 8,
  RESERVE: 10
};

export const BUDGET_STRATEGIES = {
  balanced: {
    id: 'balanced',
    name: 'Balanced Road Trip',
    desc: 'Harmonious distribution across transit, verified stays, and good food',
    split: { FUEL: 22, STAY: 35, FOOD: 20, TOLLS: 5, ACTIVITIES: 8, RESERVE: 10 }
  },
  budget: {
    id: 'budget',
    name: 'Budget Explorer',
    desc: 'Cost-saving stays to maximize sightseeing & scenic exploration',
    split: { FUEL: 25, STAY: 25, FOOD: 22, TOLLS: 6, ACTIVITIES: 12, RESERVE: 10 }
  },
  ai_optimized: {
    id: 'ai_optimized',
    name: 'AI Cost-Saving Split',
    desc: 'Optimized by AI to reduce accommodation & fuel bloat while protecting emergency reserve',
    split: { FUEL: 20, STAY: 32, FOOD: 22, TOLLS: 5, ACTIVITIES: 11, RESERVE: 10 }
  }
};

export function calculateBudgetPercentageSplit(
  totalBudget = 25000,
  groupSize = 4,
  customSplit = null,
  routeDistanceKm = 0,
  trip = {},
  tripDays = 3,
  travelArea = ''
) {
  const effectiveBudget = Math.max(1000, Number(totalBudget) || 25000);
  const effectiveGroup = Math.max(1, Number(groupSize) || 4);
  const effectiveDays = Math.max(1, Number(tripDays) || (trip && trip.durationDays) || 3);
  const effectiveNights = Math.max(1, effectiveDays - 1);
  const destination = (travelArea || (trip && trip.destination) || 'Destination').trim();
  const split = { ...DEFAULT_BUDGET_SPLIT_PERCENTAGES, ...(customSplit || {}) };

  // Calculate actual fuel required from verified vehicle efficiency and route km
  const mileage = Math.max(0.1, trip.vehicleMileageKmPerLitre || 16);
  const fuelPrice = trip.fuelPricePerLitre || 102.8;
  const actualFuelCost = routeDistanceKm > 0 ? Math.round((routeDistanceKm / mileage) * fuelPrice) : 0;

  const stayAmount = Math.round((effectiveBudget * (split.STAY || 35)) / 100);
  const perNightStay = Math.round(stayAmount / effectiveNights);

  const foodAmount = Math.round((effectiveBudget * (split.FOOD || 20)) / 100);
  const perDayPersonFood = Math.round(foodAmount / (effectiveDays * effectiveGroup));

  const categories = [
    {
      id: 'FUEL',
      name: 'Fuel & Transit Energy',
      pct: split.FUEL || 22,
      color: '#3B82F6',
      iconKey: 'fuel',
      advice: actualFuelCost > 0
        ? `Route requires ~₹${actualFuelCost.toLocaleString('en-IN')} (${Math.round(routeDistanceKm)} km in ${trip.vehicleModel || 'vehicle'}). Remainder covers city roaming across ${effectiveDays} days.`
        : `Covers highway driving, city sightseeing & AC consumption for ${effectiveDays} days in ${destination}.`,
      confidence: 'Highway Formula'
    },
    {
      id: 'STAY',
      name: 'Accommodations & Stays',
      pct: split.STAY || 35,
      color: '#8B5CF6',
      iconKey: 'stays',
      advice: `~₹${perNightStay.toLocaleString('en-IN')}/night for ${effectiveNights} night(s) for ${effectiveGroup} travelers in ${destination}.`,
      confidence: 'Market Dynamic'
    },
    {
      id: 'FOOD',
      name: 'Meals & Highway Dhabas',
      pct: split.FOOD || 20,
      color: '#F59E0B',
      iconKey: 'food',
      advice: `~₹${perDayPersonFood.toLocaleString('en-IN')}/day per person for breakfast, lunch, dinner & tea across ${effectiveDays} days.`,
      confidence: 'Regional Average'
    },
    {
      id: 'TOLLS',
      name: 'FASTag & Highway Tolls',
      pct: split.TOLLS || 5,
      color: '#06B6D4',
      iconKey: 'tolls',
      advice: `FASTag expressway plazas & entry cess to ${destination}.`,
      confidence: 'NHAI Rates'
    },
    {
      id: 'ACTIVITIES',
      name: 'Sightseeing & Permits',
      pct: split.ACTIVITIES || 8,
      color: '#10B981',
      iconKey: 'activities',
      advice: `Entry permits, viewpoint tickets & activity passes in ${destination}.`,
      confidence: 'Official Tickets'
    },
    {
      id: 'RESERVE',
      name: 'Emergency & Inconvenience Buffer',
      pct: split.RESERVE || 10,
      color: '#EC4899',
      iconKey: 'spark',
      advice: '10% safety buffer for tyre punctures, tolls surge, sudden fuel price changes or repairs to travel without inconvenience.',
      confidence: 'Risk Protection'
    }
  ];

  let allocatedSum = 0;
  const breakdown = categories.map(cat => {
    const amount = Math.round((effectiveBudget * cat.pct) / 100);
    const perPerson = Math.round(amount / effectiveGroup);
    const perDay = Math.round(amount / effectiveDays);
    const perDayPerPerson = Math.round(amount / (effectiveDays * effectiveGroup));
    allocatedSum += amount;
    return {
      ...cat,
      amount,
      perPerson,
      perDay,
      perDayPerPerson
    };
  });

  return {
    totalBudget: effectiveBudget,
    groupSize: effectiveGroup,
    durationDays: effectiveDays,
    destination,
    perPersonTotal: Math.round(effectiveBudget / effectiveGroup),
    perDayTotal: Math.round(effectiveBudget / effectiveDays),
    perDayPerPerson: Math.round(effectiveBudget / (effectiveDays * effectiveGroup)),
    allocatedSum,
    actualFuelCost,
    breakdown
  };
}
