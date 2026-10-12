package com.tripweave.core.planning

import com.tripweave.core.model.*
import kotlin.math.max
import kotlin.math.roundToInt

object BudgetEngine {

    fun calculateBudget(
        trip: Trip,
        expenses: List<Expense>,
        totalDistanceKm: Double
    ): BudgetResult {
        val allExpenses = expenses.toMutableList()

        val fuelAmount: Double
        if (trip.travelMode == TravelMode.CAR || trip.travelMode == TravelMode.MOTORCYCLE) {
            val mileage = max(1.0, trip.vehicleMileageKmPerLitre)
            fuelAmount = (totalDistanceKm / mileage) * trip.fuelPricePerLitre
            
            if (allExpenses.none { it.category == ExpenseCategory.FUEL }) {
                allExpenses.add(
                    Expense(
                        id = "calc-fuel-${trip.id}",
                        tripId = trip.id,
                        category = ExpenseCategory.FUEL,
                        amount = fuelAmount,
                        isShared = true,
                        unit = ExpenseUnit.TOTAL,
                        provenance = PriceProvenance(
                            sourceType = PriceSourceType.CALCULATED,
                            sourceName = "Distance / Mileage * Fuel Price",
                            confidence = ConfidenceLevel.CONFIRMED,
                            calculationMethod = "${totalDistanceKm.roundToInt()} km @ ${mileage} km/l x ₹${trip.fuelPricePerLitre}/L"
                        )
                    )
                )
            }
        } else {
            fuelAmount = 0.0
        }

        var fuelTotal = 0.0
        var tollTotal = 0.0
        var stayTotal = 0.0
        var foodTotal = 0.0
        var activityTotal = 0.0
        var ticketTotal = 0.0
        var transitTotal = 0.0
        var otherTotal = 0.0
        var contingencyTotal = 0.0

        var missingPricesCount = 0
        var estimatedPricesCount = 0

        val groupSize = max(1, trip.groupSize)

        val categoryGroups = allExpenses.groupBy { it.category }
        val categoryBreakdowns = mutableListOf<CategoryBudget>()

        for ((category, list) in categoryGroups) {
            var catSum = 0.0
            var hasEst = false

            for (exp in list) {
                val effectiveAmount = when (exp.unit) {
                    ExpenseUnit.PER_PERSON -> exp.amount * groupSize
                    ExpenseUnit.PER_ROOM_NIGHT -> exp.amount
                    ExpenseUnit.PER_VEHICLE -> exp.amount
                    ExpenseUnit.TOTAL -> exp.amount
                }
                catSum += effectiveAmount

                if (exp.provenance.confidence != ConfidenceLevel.CONFIRMED) {
                    hasEst = true
                    estimatedPricesCount++
                }

                when (category) {
                    ExpenseCategory.FUEL -> fuelTotal += effectiveAmount
                    ExpenseCategory.TOLL -> tollTotal += effectiveAmount
                    ExpenseCategory.STAY -> stayTotal += effectiveAmount
                    ExpenseCategory.FOOD -> foodTotal += effectiveAmount
                    ExpenseCategory.ACTIVITY -> activityTotal += effectiveAmount
                    ExpenseCategory.TICKET -> ticketTotal += effectiveAmount
                    ExpenseCategory.TRANSIT -> transitTotal += effectiveAmount
                    ExpenseCategory.OTHER -> otherTotal += effectiveAmount
                    ExpenseCategory.CONTINGENCY -> contingencyTotal += effectiveAmount
                    ExpenseCategory.PARKING -> otherTotal += effectiveAmount
                }
            }

            categoryBreakdowns.add(
                CategoryBudget(
                    category = category,
                    totalAmount = catSum,
                    perPersonAmount = catSum / groupSize,
                    itemCount = list.size,
                    hasEstimatedPrices = hasEst
                )
            )
        }

        if (contingencyTotal == 0.0 && (fuelTotal + stayTotal + foodTotal) > 0) {
            val baseCost = fuelTotal + tollTotal + stayTotal + foodTotal + activityTotal + ticketTotal + otherTotal
            contingencyTotal = baseCost * 0.05
            categoryBreakdowns.add(
                CategoryBudget(
                    category = ExpenseCategory.CONTINGENCY,
                    totalAmount = contingencyTotal,
                    perPersonAmount = contingencyTotal / groupSize,
                    itemCount = 1,
                    hasEstimatedPrices = true
                )
            )
        }

        val totalCost = fuelTotal + tollTotal + stayTotal + foodTotal + activityTotal + ticketTotal + transitTotal + otherTotal + contingencyTotal
        val perPersonCost = totalCost / groupSize
        val budgetRemaining = trip.totalBudget - totalCost
        val isOverBudget = budgetRemaining < 0

        val lowScenarioCost = (fuelTotal * 0.95) + tollTotal + stayTotal + foodTotal + activityTotal + ticketTotal + transitTotal + otherTotal
        val typicalScenarioCost = totalCost
        val highScenarioCost = (fuelTotal * 1.15) + tollTotal + (stayTotal * 1.05) + (foodTotal * 1.10) + activityTotal + ticketTotal + transitTotal + otherTotal + (totalCost * 0.10)

        return BudgetResult(
            totalCost = totalCost,
            perPersonCost = perPersonCost,
            fuelCost = fuelTotal,
            tollCost = tollTotal,
            stayCost = stayTotal,
            foodCost = foodTotal,
            activityCost = activityTotal + ticketTotal,
            otherCost = otherTotal + transitTotal,
            contingencyCost = contingencyTotal,
            categoryBreakdown = categoryBreakdowns,
            lowScenarioCost = lowScenarioCost,
            typicalScenarioCost = typicalScenarioCost,
            highScenarioCost = highScenarioCost,
            missingPricesCount = missingPricesCount,
            estimatedPricesCount = estimatedPricesCount,
            budgetRemaining = budgetRemaining,
            isOverBudget = isOverBudget
        )
    }
}
