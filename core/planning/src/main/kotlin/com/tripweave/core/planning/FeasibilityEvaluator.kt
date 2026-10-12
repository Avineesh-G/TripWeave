package com.tripweave.core.planning

import com.tripweave.core.model.*

object FeasibilityEvaluator {

    fun evaluate(
        trip: Trip,
        scheduleResult: ScheduleResult,
        budgetResult: BudgetResult
    ): FeasibilityReport {
        val warnings = mutableListOf<PlanWarning>()

        var hasClosedStops = false
        var hasTightStops = false

        for (scheduledStop in scheduleResult.stops) {
            when (scheduledStop.openingStatus) {
                OpeningStatus.CLOSED_ON_ARRIVAL -> {
                    hasClosedStops = true
                    warnings.add(
                        PlanWarning(
                            id = "warn-closed-${scheduledStop.stop.id}",
                            title = "${scheduledStop.stop.name} is closed on arrival",
                            description = "Scheduled arrival is outside opening hours (${formatMinutes(scheduledStop.arrivalMinutes)}).",
                            severity = WarningSeverity.HARD_CONFLICT,
                            stopId = scheduledStop.stop.id,
                            actionType = WarningActionType.ADJUST_DEPARTURE
                        )
                    )
                }
                OpeningStatus.TIGHT_CLOSING -> {
                    hasTightStops = true
                    warnings.add(
                        PlanWarning(
                            id = "warn-tight-${scheduledStop.stop.id}",
                            title = "Tight visit at ${scheduledStop.stop.name}",
                            description = "Planned visit duration reaches or exceeds closing time.",
                            severity = WarningSeverity.CAUTION,
                            stopId = scheduledStop.stop.id,
                            actionType = WarningActionType.SHORTEN_VISIT
                        )
                    )
                }
                else -> {}
            }
        }

        for (scheduledStop in scheduleResult.stops) {
            if (scheduledStop.stop.bufferMinutes < 10) {
                warnings.add(
                    PlanWarning(
                        id = "warn-buffer-${scheduledStop.stop.id}",
                        title = "Low buffer at ${scheduledStop.stop.name}",
                        description = "Buffer is only ${scheduledStop.stop.bufferMinutes} min. Parking or delays may cause schedule slippage.",
                        severity = WarningSeverity.INFO,
                        stopId = scheduledStop.stop.id,
                        actionType = WarningActionType.ADD_BUFFER
                    )
                )
            }
        }

        val timeFeasibility = when {
            hasClosedStops -> FeasibilityLevel.INFEASIBLE
            hasTightStops -> FeasibilityLevel.TIGHT
            else -> FeasibilityLevel.FEASIBLE
        }

        val budgetUsedRatio = if (trip.totalBudget > 0) {
            (budgetResult.totalCost / trip.totalBudget).toFloat()
        } else 0f

        val budgetFeasibility = when {
            budgetResult.isOverBudget -> {
                warnings.add(
                    PlanWarning(
                        id = "warn-budget-overrun",
                        title = "Budget exceeded by ₹${(-budgetResult.budgetRemaining).toInt()}",
                        description = "Total estimated trip cost (₹${budgetResult.totalCost.toInt()}) exceeds planned budget (₹${trip.totalBudget.toInt()}).",
                        severity = WarningSeverity.HARD_CONFLICT,
                        actionType = WarningActionType.EDIT_PRICE
                    )
                )
                FeasibilityLevel.INFEASIBLE
            }
            budgetUsedRatio >= 0.90f -> {
                warnings.add(
                    PlanWarning(
                        id = "warn-budget-tight",
                        title = "Budget is tight (over 90% allocated)",
                        description = "Remaining buffer is ₹${budgetResult.budgetRemaining.toInt()}.",
                        severity = WarningSeverity.CAUTION
                    )
                )
                FeasibilityLevel.TIGHT
            }
            else -> FeasibilityLevel.FEASIBLE
        }

        val overallFeasibility = when {
            timeFeasibility == FeasibilityLevel.INFEASIBLE || budgetFeasibility == FeasibilityLevel.INFEASIBLE -> FeasibilityLevel.INFEASIBLE
            timeFeasibility == FeasibilityLevel.TIGHT || budgetFeasibility == FeasibilityLevel.TIGHT -> FeasibilityLevel.TIGHT
            else -> FeasibilityLevel.FEASIBLE
        }

        var confidence = 100
        if (budgetResult.estimatedPricesCount > 0) {
            confidence -= minOf(30, budgetResult.estimatedPricesCount * 8)
        }
        if (hasTightStops) confidence -= 10
        if (hasClosedStops) confidence -= 25

        val timeUsedPercent = if (scheduleResult.totalTripDurationMinutes > 0) {
            (scheduleResult.totalTravelMinutes.toFloat() / scheduleResult.totalTripDurationMinutes) * 100f
        } else 0f

        return FeasibilityReport(
            timeFeasibility = timeFeasibility,
            budgetFeasibility = budgetFeasibility,
            overallFeasibility = overallFeasibility,
            timeUsedPercent = timeUsedPercent,
            budgetUsedPercent = budgetUsedRatio * 100f,
            warnings = warnings,
            confidenceScore = maxOf(20, confidence)
        )
    }

    private fun formatMinutes(minutes: Int): String {
        val normalized = minutes % 1440
        val h = normalized / 60
        val m = normalized % 60
        val amPm = if (h >= 12) "PM" else "AM"
        val hour12 = if (h == 0) 12 else if (h > 12) h - 12 else h
        return String.format("%02d:%02d %s", hour12, m, amPm)
    }
}
