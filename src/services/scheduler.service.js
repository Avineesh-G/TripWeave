// Deterministic Itinerary Timeline Scheduler & Operating Hours Service
import { ScheduleEngine } from '../engines.js';

export const VERIFIED_INDIAN_HOURS = {
  'mysore palace': { open: 600, close: 1050, name: '10:00 AM - 05:30 PM' },
  'abbey falls': { open: 540, close: 1020, name: '09:00 AM - 05:00 PM' },
  'namdroling': { open: 540, close: 1080, name: '09:00 AM - 06:00 PM' },
  'raja seat': { open: 360, close: 1200, name: '06:00 AM - 08:00 PM' },
  'dubare': { open: 540, close: 1020, name: '09:00 AM - 05:00 PM' },
  'virupaksha': { open: 360, close: 1200, name: '06:00 AM - 08:00 PM' },
  'vittala': { open: 510, close: 1080, name: '08:30 AM - 06:00 PM' },
  'hampi': { open: 360, close: 1140, name: '06:00 AM - 07:00 PM' },
  'taj mahal': { open: 360, close: 1140, name: '06:00 AM - 07:00 PM' },
  'qutub minar': { open: 420, close: 1200, name: '07:00 AM - 08:00 PM' },
  'red fort': { open: 570, close: 1050, name: '09:30 AM - 05:30 PM' },
  'gateway of india': { open: 0, close: 1440, name: 'Open 24 Hours' }
};

export function getPlaceHours(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(VERIFIED_INDIAN_HOURS)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

export function formatMinutes(mins) {
  const norm = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
}

export function calculateTripSchedule(trip, stops) {
  return ScheduleEngine.calculateSchedule(trip, stops);
}
