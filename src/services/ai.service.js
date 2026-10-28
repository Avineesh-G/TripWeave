// Groq AI Road Trip Planner and Deterministic Cascade Service
import { geocodePlace, calculateOSRMRoute } from './routing.service.js';

const GROQ_STORAGE_KEY = 'groq_user_key';
const AI_HISTORY_KEY = 'tripweave_ai_history';

export function getCustomGroqKey() {
  try {
    return localStorage.getItem(GROQ_STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setCustomGroqKey(key) {
  try {
    if (key && key.trim()) {
      localStorage.setItem(GROQ_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(GROQ_STORAGE_KEY);
    }
  } catch (e) {}
}

export function getAIHistoryPlans() {
  try {
    const raw = localStorage.getItem(AI_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveAIHistoryPlan(plan) {
  try {
    const existing = getAIHistoryPlans();
    const updated = [plan, ...existing.filter(p => p.id !== plan.id)].slice(0, 15);
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {}
}

export function deleteAIHistoryPlan(id) {
  try {
    const existing = getAIHistoryPlans();
    const updated = existing.filter(p => p.id !== id);
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return [];
  }
}

export async function generateRoadTripPlan({ origin, destination, members = 4, targetBudget = 15000, comfort = 'comfort', dining = 'dhabas' }) {
  const origGeo = await geocodePlace(origin);
  const destGeo = await geocodePlace(destination);

  if (!origGeo || !destGeo) {
    throw new Error('Could not geocode Origin or Destination. Please enter valid places.');
  }

  const osrmRoute = await calculateOSRMRoute([origGeo.lat, origGeo.lng], [destGeo.lat, destGeo.lng]);
  const distKm = Math.round(osrmRoute.distanceKm || 200);
  const drivingHours = parseFloat((osrmRoute.durationMinutes / 60).toFixed(1));

  // Determine stay rate per room based on comfort tier
  let stayRatePerRoom = 3200;
  if (comfort === 'budget') stayRatePerRoom = 1600;
  if (comfort === 'luxury') stayRatePerRoom = 6800;

  // Determine daily meal rate per person based on dining preference
  let dailyMealPerPerson = 450;
  if (dining === 'dhabas') dailyMealPerPerson = 350;
  if (dining === 'family') dailyMealPerPerson = 700;

  const roomsNeeded = Math.ceil(members / 2);
  const tripDays = Math.max(1, Math.ceil(drivingHours / 7));
  const tripNights = Math.max(1, tripDays - 1 || 1);

  const fuelCost = Math.round((distKm / 15) * 102.5);
  const tollCost = Math.round(distKm * 1.45);
  const stayCost = Math.round(roomsNeeded * tripNights * stayRatePerRoom);
  const mealsCost = Math.round(members * tripDays * dailyMealPerPerson);
  const totalCost = fuelCost + tollCost + stayCost + mealsCost;

  const planId = `ai-plan-${Date.now()}`;
  const stops = [
    {
      id: `${planId}-start`,
      name: origGeo.name,
      latitude: origGeo.lat,
      longitude: origGeo.lng,
      durationMinutes: 0,
      plannedDurationMinutes: 0,
      stopOrder: 0,
      isOvernight: false,
      category: 'start'
    },
    {
      id: `${planId}-midpoint`,
      name: `${destGeo.name} Highway Midpoint Rest Plaza`,
      latitude: (origGeo.lat + destGeo.lat) / 2,
      longitude: (origGeo.lng + destGeo.lng) / 2,
      durationMinutes: 45,
      plannedDurationMinutes: 45,
      stopOrder: 1,
      isOvernight: false,
      category: 'lunch',
      recommendedFood: 'Hot tandoori rotis, dal makhani, and masala chai'
    },
    {
      id: `${planId}-end`,
      name: destGeo.name,
      latitude: destGeo.lat,
      longitude: destGeo.lng,
      durationMinutes: 120,
      plannedDurationMinutes: 120,
      stopOrder: 2,
      isOvernight: true,
      category: 'destination'
    }
  ];

  const plan = {
    id: planId,
    title: `${origGeo.name} to ${destGeo.name} Road Trip`,
    origin: origGeo.name,
    destination: destGeo.name,
    originCoords: [origGeo.lat, origGeo.lng],
    destCoords: [destGeo.lat, destGeo.lng],
    totalDistanceKm: distKm,
    totalDrivingHours: drivingHours,
    members,
    comfort,
    dining,
    roomsNeeded,
    tripDays,
    tripNights,
    fuelCost,
    tollCost,
    stayCost,
    mealsCost,
    totalCost,
    hotelName: `${destGeo.name} Grand Comfort Highway Stay`,
    stops,
    savedAt: Date.now()
  };

  saveAIHistoryPlan(plan);
  return plan;
}
