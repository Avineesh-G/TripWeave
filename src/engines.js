// Pure Planning Engines mirroring the Kotlin Core module

export const ScheduleEngine = {
  calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  calculateSchedule(trip, stops) {
    if (!stops || stops.length === 0) {
      return {
        stops: [],
        totalTripDurationMinutes: 0,
        totalTravelMinutes: 0,
        totalVisitMinutes: 0,
        totalBufferMinutes: 0,
        dayRollovers: 0
      };
    }

    const sortedStops = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);
    const scheduledStops = [];

    let currentDay = 0;
    let currentMinutesInDay = trip.departureTimeMinutes || 360; // 06:00 AM default
    let totalTravelMinutes = 0;
    let totalVisitMinutes = 0;
    let totalBufferMinutes = 0;
    let dayRollovers = 0;

    for (let index = 0; index < sortedStops.length; index++) {
      const stop = sortedStops[index];
      let travelDuration = 0;
      let distanceKm = 0;

      if (index === 0) {
        travelDuration = 0;
        distanceKm = 0;
      } else {
        const prev = sortedStops[index - 1];
        if (stop.roadDistanceKm && sortedStops.length === 2) {
          distanceKm = Math.round(stop.roadDistanceKm * 10) / 10;
          travelDuration = stop.plannedDurationMinutes || Math.round((distanceKm / 58) * 60);
        } else {
          // Real-world road driving distance (applies highway tortuosity factor 1.25x over straight-line)
          const straightKm = this.calculateHaversineDistanceKm(prev.latitude, prev.longitude, stop.latitude, stop.longitude);
          distanceKm = Math.round(straightKm * 1.25 * 10) / 10;
          const avgSpeedKmH = distanceKm > 80 ? 58 : 42; // Realistic Indian road speed
          travelDuration = Math.max(10, Math.round((distanceKm / avgSpeedKmH) * 60));
        }
      }

      totalTravelMinutes += travelDuration;
      currentMinutesInDay += travelDuration;

      while (currentMinutesInDay >= 1440) {
        currentMinutesInDay -= 1440;
        currentDay++;
        dayRollovers++;
      }

      const arrivalMinutes = currentMinutesInDay;
      const visitMinutes = stop.plannedDurationMinutes || 60;
      const bufferMinutes = stop.bufferMinutes || 15;

      totalVisitMinutes += visitMinutes;
      totalBufferMinutes += bufferMinutes;

      // Evaluate Opening Hours
      let openingStatus = 'OPEN';
      if (stop.openingHours) {
        if (stop.openingHours.isClosed) {
          openingStatus = 'CLOSED_ON_ARRIVAL';
        } else if (!stop.openingHours.isOpen24Hours) {
          const normArrival = arrivalMinutes % 1440;
          const endOfVisit = normArrival + visitMinutes;
          if (normArrival < stop.openingHours.openMinutes || normArrival >= stop.openingHours.closeMinutes) {
            openingStatus = 'CLOSED_ON_ARRIVAL';
          } else if (endOfVisit > stop.openingHours.closeMinutes) {
            openingStatus = 'TIGHT_CLOSING';
          }
        }
      }

      currentMinutesInDay += (visitMinutes + bufferMinutes);
      while (currentMinutesInDay >= 1440) {
        currentMinutesInDay -= 1440;
        currentDay++;
        dayRollovers++;
      }
      const departureMinutes = currentMinutesInDay;

      scheduledStops.push({
        stop,
        dayIndex: currentDay,
        arrivalMinutes,
        departureMinutes,
        travelDurationFromPreviousMinutes: travelDuration,
        distanceFromPreviousKm: distanceKm,
        openingStatus
      });

      // Overnight rest
      if (stop.isOvernight && index < sortedStops.length - 1) {
        currentDay++;
        dayRollovers++;
        currentMinutesInDay = trip.departureTimeMinutes || 480; // 08:00 AM next day
      }
    }

    const totalTripDurationMinutes = totalTravelMinutes + totalVisitMinutes + totalBufferMinutes;

    return {
      stops: scheduledStops,
      totalTripDurationMinutes,
      totalTravelMinutes,
      totalVisitMinutes,
      totalBufferMinutes,
      dayRollovers
    };
  }
};

export const BudgetEngine = {
  calculateBudget(trip, expenses = [], totalDistanceKm = 0) {
    const allExpenses = [...expenses];
    const groupSize = Math.max(1, trip.groupSize || 1);

    // Calculate Fuel
    const mileage = Math.max(1, trip.vehicleMileageKmPerLitre || 15);
    const fuelPrice = trip.fuelPricePerLitre || 102.5;
    const fuelAmount = (totalDistanceKm / mileage) * fuelPrice;

    if (!allExpenses.some(e => e.category === 'FUEL')) {
      allExpenses.push({
        id: `calc-fuel-${trip.id}`,
        tripId: trip.id,
        category: 'FUEL',
        amount: fuelAmount,
        isShared: true,
        unit: 'TOTAL',
        provenance: {
          sourceType: 'CALCULATED',
          sourceName: 'Formula: distance / mileage * fuelPrice',
          confidence: 'CONFIRMED',
          calculationMethod: `${Math.round(totalDistanceKm)} km @ ${mileage} km/L x ₹${fuelPrice}/L`
        }
      });
    }

    let fuelTotal = 0;
    let tollTotal = 0;
    let stayTotal = 0;
    let foodTotal = 0;
    let ticketTotal = 0;
    let activityTotal = 0;
    let otherTotal = 0;
    let contingencyTotal = 0;

    let estimatedPricesCount = 0;

    const categoryGroups = {};
    for (const exp of allExpenses) {
      const cat = exp.category || 'OTHER';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(exp);
    }

    const categoryBreakdown = [];

    for (const [cat, list] of Object.entries(categoryGroups)) {
      let catSum = 0;
      let hasEstimated = false;

      for (const e of list) {
        let effective = e.amount;
        if (e.unit === 'PER_PERSON') effective = e.amount * groupSize;
        catSum += effective;

        if (e.provenance?.confidence !== 'CONFIRMED') {
          hasEstimated = true;
          estimatedPricesCount++;
        }

        switch (cat) {
          case 'FUEL': fuelTotal += effective; break;
          case 'TOLL': tollTotal += effective; break;
          case 'STAY': stayTotal += effective; break;
          case 'FOOD': foodTotal += effective; break;
          case 'TICKET': ticketTotal += effective; break;
          case 'ACTIVITY': activityTotal += effective; break;
          case 'CONTINGENCY': contingencyTotal += effective; break;
          default: otherTotal += effective; break;
        }
      }

      categoryBreakdown.push({
        category: cat,
        totalAmount: catSum,
        perPersonAmount: catSum / groupSize,
        itemCount: list.size || list.length,
        hasEstimatedPrices: hasEstimated
      });
    }

    // Default 5% contingency if none entered
    if (contingencyTotal === 0 && (fuelTotal + stayTotal + foodTotal) > 0) {
      const baseCost = fuelTotal + tollTotal + stayTotal + foodTotal + ticketTotal + activityTotal + otherTotal;
      contingencyTotal = baseCost * 0.05;
      categoryBreakdown.push({
        category: 'CONTINGENCY',
        totalAmount: contingencyTotal,
        perPersonAmount: contingencyTotal / groupSize,
        itemCount: 1,
        hasEstimatedPrices: true
      });
    }

    const totalCost = fuelTotal + tollTotal + stayTotal + foodTotal + ticketTotal + activityTotal + otherTotal + contingencyTotal;
    const perPersonCost = totalCost / groupSize;
    const budgetRemaining = (trip.totalBudget || 0) - totalCost;
    const isOverBudget = budgetRemaining < 0;

    // Scenarios
    const lowScenarioCost = (fuelTotal * 0.95) + tollTotal + stayTotal + foodTotal + ticketTotal + activityTotal + otherTotal;
    const typicalScenarioCost = totalCost;
    const highScenarioCost = (fuelTotal * 1.15) + tollTotal + (stayTotal * 1.05) + (foodTotal * 1.10) + ticketTotal + activityTotal + otherTotal + (totalCost * 0.10);

    return {
      totalCost,
      perPersonCost,
      fuelCost: fuelTotal,
      tollCost: tollTotal,
      stayCost: stayTotal,
      foodCost: foodTotal,
      ticketCost: ticketTotal,
      activityCost: activityTotal,
      contingencyCost: contingencyTotal,
      categoryBreakdown,
      lowScenarioCost,
      typicalScenarioCost,
      highScenarioCost,
      estimatedPricesCount,
      budgetRemaining,
      isOverBudget
    };
  }
};

export const FeasibilityEvaluator = {
  evaluate(trip, scheduleResult, budgetResult) {
    const warnings = [];
    let hasClosedStops = false;
    let hasTightStops = false;

    for (const scheduled of scheduleResult.stops) {
      if (scheduled.openingStatus === 'CLOSED_ON_ARRIVAL') {
        hasClosedStops = true;
        warnings.push({
          id: `warn-closed-${scheduled.stop.id}`,
          title: `${scheduled.stop.name} is closed upon arrival`,
          severity: 'HARD_CONFLICT'
        });
      } else if (scheduled.openingStatus === 'TIGHT_CLOSING') {
        hasTightStops = true;
        warnings.push({
          id: `warn-tight-${scheduled.stop.id}`,
          title: `Tight window at ${scheduled.stop.name}`,
          severity: 'CAUTION'
        });
      }

      if ((scheduled.stop.bufferMinutes || 0) < 10) {
        warnings.push({
          id: `warn-buffer-${scheduled.stop.id}`,
          title: `Low buffer at ${scheduled.stop.name} (${scheduled.stop.bufferMinutes}m)`,
          severity: 'INFO'
        });
      }
    }

    const timeFeasibility = hasClosedStops ? 'INFEASIBLE' : (hasTightStops ? 'TIGHT' : 'FEASIBLE');

    const totalBudget = trip.totalBudget || 1;
    const budgetRatio = budgetResult.totalCost / totalBudget;

    let budgetFeasibility = 'FEASIBLE';
    if (budgetResult.isOverBudget) {
      budgetFeasibility = 'INFEASIBLE';
      warnings.push({
        id: 'warn-overbudget',
        title: `Over budget by ₹${Math.round(-budgetResult.budgetRemaining)}`,
        severity: 'HARD_CONFLICT'
      });
    } else if (budgetRatio >= 0.90) {
      budgetFeasibility = 'TIGHT';
      warnings.push({
        id: 'warn-tightbudget',
        title: `Budget is tight (over 90% allocated)`,
        severity: 'CAUTION'
      });
    }

    let overallFeasibility = 'FEASIBLE';
    if (timeFeasibility === 'INFEASIBLE' || budgetFeasibility === 'INFEASIBLE') {
      overallFeasibility = 'INFEASIBLE';
    } else if (timeFeasibility === 'TIGHT' || budgetFeasibility === 'TIGHT') {
      overallFeasibility = 'TIGHT';
    }

    const timeUsedPercent = scheduleResult.totalTripDurationMinutes > 0
      ? (scheduleResult.totalTravelMinutes / scheduleResult.totalTripDurationMinutes) * 100
      : 0;

    return {
      timeFeasibility,
      budgetFeasibility,
      overallFeasibility,
      timeUsedPercent: Math.min(100, timeUsedPercent),
      budgetUsedPercent: Math.min(100, budgetRatio * 100),
      warnings,
      confidenceScore: Math.max(30, 100 - (budgetResult.estimatedPricesCount * 8) - (hasClosedStops ? 25 : 0))
    };
  }
};
