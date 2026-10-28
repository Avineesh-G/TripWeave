// Export & Sharing Service (WhatsApp, Road Book, Offline Backup)
import { formatMinutes, getPlaceHours } from './scheduler.service.js';

export function generateWhatsAppSummary(trip, stops, schedule, expenses) {
  if (!trip || !stops || stops.length === 0) return '';

  const depTimeStr = formatMinutes(trip.departureTimeMinutes || 480);
  const totalCost = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const perPersonCost = trip.groupSize > 0 ? Math.round(totalCost / trip.groupSize) : totalCost;

  let lines = [];
  lines.push(`*[ROAD TRIP ITINERARY]* ${trip.title}`);
  lines.push(`• ${stops.length} Stops | ${trip.groupSize || 4} Travelers | Departs: ${depTimeStr}`);
  lines.push(`---------------------------------`);
  lines.push(`*TIMELINE & VISITS:*`);

  (schedule || []).forEach((item, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === (schedule.length - 1);
    const arrStr = formatMinutes(item.arrivalTimeMinutes);
    const depStr = formatMinutes(item.departureTimeMinutes);
    const hours = getPlaceHours(item.stop.name);
    const hoursNote = hours ? ` · [Open: ${hours.name}]` : '';

    if (isFirst) {
      lines.push(`${idx + 1}. *${item.stop.name}* (Departure ${depStr})`);
    } else if (isLast && item.stop.isOvernight) {
      lines.push(`${idx + 1}. *${item.stop.name}* (Arrival ${arrStr}) · [Overnight Stay]`);
    } else {
      lines.push(`${idx + 1}. *${item.stop.name}* (Arr ${arrStr} → Dep ${depStr}) [${item.stop.durationMinutes}m stop]${hoursNote}`);
    }
  });

  lines.push(`---------------------------------`);
  lines.push(`*ESTIMATED BUDGET:*`);
  lines.push(`Total: ₹${totalCost.toLocaleString('en-IN')} (₹${perPersonCost.toLocaleString('en-IN')}/person)`);

  const fuelExp = expenses.find(e => e.category === 'FUEL') || { amount: 4200 };
  const tollExp = expenses.find(e => e.category === 'TOLL') || { amount: 380 };
  const stayExp = expenses.find(e => e.category === 'STAY') || { amount: 4800 };
  const foodExp = expenses.find(e => e.category === 'FOOD') || { amount: 2400 };

  lines.push(`• Fuel: ₹${fuelExp.amount.toLocaleString('en-IN')} | Tolls: ₹${tollExp.amount.toLocaleString('en-IN')}`);
  lines.push(`• Stays: ₹${stayExp.amount.toLocaleString('en-IN')} | Food: ₹${foodExp.amount.toLocaleString('en-IN')}`);

  lines.push(`---------------------------------`);
  lines.push(`*ROAD & SAFETY ADVISORIES:*`);
  lines.push(`• Daylight ghat driving recommended on winding sections.`);
  lines.push(`• Keep FASTag active with sufficient balance.`);
  lines.push(`• Emergency Assistance: NHAI 1033 | National 112`);
  lines.push(`---------------------------------`);
  lines.push(`Planned with *TripWeave*`);

  return lines.join('\n');
}

export function exportTripAsJSON(stateData) {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(stateData, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `tripweave_backup_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
