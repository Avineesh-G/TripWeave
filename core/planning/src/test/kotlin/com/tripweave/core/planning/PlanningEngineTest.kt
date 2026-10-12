package com.tripweave.core.planning

import com.tripweave.core.model.*
import org.junit.Assert.*
import org.junit.Test

class PlanningEngineTest {

    @Test
    fun testScheduleCalculation_sequentialStops() {
        val trip = Trip(
            id = "test-trip",
            title = "Bangalore to Mysore",
            destinationName = "Mysore",
            startTimestampEpochMs = 1700000000000L,
            departureTimeMinutes = 360, // 06:00 AM
            totalBudget = 5000.0,
            groupSize = 2,
            travelMode = TravelMode.CAR,
            vehicleMileageKmPerLitre = 15.0,
            fuelPricePerLitre = 100.0
        )

        val stop1 = TripStop(
            id = "stop-blr",
            tripId = "test-trip",
            name = "Bangalore Start",
            latitude = 12.9716,
            longitude = 77.5946,
            stopOrder = 0,
            plannedDurationMinutes = 15,
            bufferMinutes = 0
        )

        val stop2 = TripStop(
            id = "stop-mys",
            tripId = "test-trip",
            name = "Mysore Palace",
            latitude = 12.3051,
            longitude = 76.6551,
            stopOrder = 1,
            plannedDurationMinutes = 120,
            bufferMinutes = 15,
            openingHours = OpeningHours(openMinutes = 600, closeMinutes = 1050)
        )

        val segment = RouteSegment(
            fromStopId = "stop-blr",
            toStopId = "stop-mys",
            distanceMeters = 150_000,
            durationMinutes = 180
        )

        val result = ScheduleEngine.calculateSchedule(
            trip = trip,
            stops = listOf(stop1, stop2),
            segments = mapOf(Pair("stop-blr", "stop-mys") to segment)
        )

        assertEquals(2, result.stops.size)
        assertEquals(360, result.stops[0].arrivalMinutes)
        assertEquals(375, result.stops[0].departureMinutes)

        assertEquals(555, result.stops[1].arrivalMinutes)
        assertEquals(OpeningStatus.CLOSED_ON_ARRIVAL, result.stops[1].openingStatus)
        assertEquals(690, result.stops[1].departureMinutes)
    }

    @Test
    fun testScheduleCalculation_overnightRollover() {
        val trip = Trip(
            id = "test-trip",
            title = "Weekend Outing",
            destinationName = "Coorg",
            startTimestampEpochMs = 1700000000000L,
            departureTimeMinutes = 480, // 08:00 AM
            totalBudget = 10000.0
        )

        val stop1 = TripStop(
            id = "s1",
            tripId = "test-trip",
            name = "Day 1 Resort Stay",
            latitude = 12.4,
            longitude = 75.7,
            stopOrder = 0,
            plannedDurationMinutes = 60,
            bufferMinutes = 0,
            isOvernight = true
        )

        val stop2 = TripStop(
            id = "s2",
            tripId = "test-trip",
            name = "Day 2 Coffee Plantation",
            latitude = 12.5,
            longitude = 75.8,
            stopOrder = 1,
            plannedDurationMinutes = 90,
            bufferMinutes = 15
        )

        val segment = RouteSegment("s1", "s2", distanceMeters = 20_000, durationMinutes = 30)

        val result = ScheduleEngine.calculateSchedule(
            trip = trip,
            stops = listOf(stop1, stop2),
            segments = mapOf(Pair("s1", "s2") to segment)
        )

        assertEquals(2, result.stops.size)
        assertEquals(0, result.stops[0].dayIndex)
        assertEquals(1, result.stops[1].dayIndex)
        assertEquals(510, result.stops[1].arrivalMinutes)
    }

    @Test
    fun testBudgetEngine_fuelMathAndScenarios() {
        val trip = Trip(
            id = "trip-budget",
            title = "Road Trip",
            destinationName = "Hampi",
            startTimestampEpochMs = 1700000000000L,
            totalBudget = 10000.0,
            groupSize = 4,
            travelMode = TravelMode.CAR,
            vehicleMileageKmPerLitre = 15.0,
            fuelPricePerLitre = 100.0
        )

        val expenses = listOf(
            Expense(
                id = "toll-1",
                tripId = "trip-budget",
                category = ExpenseCategory.TOLL,
                amount = 400.0,
                isShared = true,
                unit = ExpenseUnit.TOTAL,
                provenance = PriceProvenance(PriceSourceType.OFFICIAL, "NHAI Fastag", confidence = ConfidenceLevel.CONFIRMED)
            ),
            Expense(
                id = "stay-1",
                tripId = "trip-budget",
                category = ExpenseCategory.STAY,
                amount = 3000.0,
                isShared = true,
                unit = ExpenseUnit.TOTAL,
                provenance = PriceProvenance(PriceSourceType.USER_ENTERED, "Hotel Booking", confidence = ConfidenceLevel.CONFIRMED)
            )
        )

        val budgetResult = BudgetEngine.calculateBudget(trip, expenses, totalDistanceKm = 300.0)

        assertEquals(2000.0, budgetResult.fuelCost, 0.01)
        assertEquals(400.0, budgetResult.tollCost, 0.01)
        assertEquals(3000.0, budgetResult.stayCost, 0.01)

        assertEquals(5670.0, budgetResult.totalCost, 0.01)
        assertEquals(5670.0 / 4, budgetResult.perPersonCost, 0.01)
        assertFalse(budgetResult.isOverBudget)

        assertTrue(budgetResult.lowScenarioCost < budgetResult.typicalScenarioCost)
        assertTrue(budgetResult.typicalScenarioCost < budgetResult.highScenarioCost)
    }

    @Test
    fun testFeasibilityEvaluator_detectsOverBudgetAndConflicts() {
        val trip = Trip(
            id = "tight-trip",
            title = "Tight Budget Trip",
            destinationName = "Goa",
            startTimestampEpochMs = 1700000000000L,
            totalBudget = 3000.0,
            groupSize = 2
        )

        val stop1 = TripStop(
            id = "stop-1",
            tripId = "tight-trip",
            name = "Monument",
            latitude = 15.0,
            longitude = 74.0,
            stopOrder = 0,
            plannedDurationMinutes = 60,
            openingHours = OpeningHours(openMinutes = 600, closeMinutes = 1000)
        )

        val scheduleResult = ScheduleEngine.calculateSchedule(trip, listOf(stop1))
        val expenses = listOf(
            Expense(
                id = "e1",
                tripId = "tight-trip",
                category = ExpenseCategory.STAY,
                amount = 4000.0,
                unit = ExpenseUnit.TOTAL,
                provenance = PriceProvenance(PriceSourceType.USER_ENTERED, confidence = ConfidenceLevel.CONFIRMED)
            )
        )
        val budgetResult = BudgetEngine.calculateBudget(trip, expenses, totalDistanceKm = 0.0)

        val report = FeasibilityEvaluator.evaluate(trip, scheduleResult, budgetResult)

        assertEquals(FeasibilityLevel.INFEASIBLE, report.budgetFeasibility)
        assertEquals(FeasibilityLevel.INFEASIBLE, report.overallFeasibility)
        assertTrue(report.warnings.any { it.severity == WarningSeverity.HARD_CONFLICT })
    }
}
