package com.tripweave.core.model

enum class TravelMode {
    CAR, MOTORCYCLE, BUS, TRAIN, FLIGHT
}

enum class ExpenseCategory {
    FUEL, TOLL, PARKING, FOOD, STAY, TICKET, TRANSIT, ACTIVITY, OTHER, CONTINGENCY
}

enum class ExpenseUnit {
    PER_PERSON, PER_ROOM_NIGHT, PER_VEHICLE, TOTAL
}

enum class PriceSourceType {
    CALCULATED,
    OFFICIAL,
    USER_ENTERED,
    COMMUNITY,
    HISTORICAL,
    DEMO
}

enum class ConfidenceLevel {
    CONFIRMED,
    ESTIMATED,
    UNVERIFIED,
    STALE
}

enum class FeasibilityLevel {
    FEASIBLE,
    TIGHT,
    INFEASIBLE
}

enum class OpeningStatus {
    OPEN,
    CLOSED_ON_ARRIVAL,
    TIGHT_CLOSING,
    UNKNOWN
}

enum class WarningSeverity {
    INFO,
    CAUTION,
    HARD_CONFLICT
}

enum class WarningActionType {
    SHORTEN_VISIT,
    ADJUST_DEPARTURE,
    ADD_BUFFER,
    EDIT_PRICE,
    REMOVE_STOP
}

data class OpeningHours(
    val openMinutes: Int = 9 * 60,   // 09:00 AM
    val closeMinutes: Int = 18 * 60, // 06:00 PM
    val isOpen24Hours: Boolean = false,
    val isClosed: Boolean = false
)

data class PriceProvenance(
    val sourceType: PriceSourceType,
    val sourceName: String? = null,
    val sourceUrl: String? = null,
    val timestamp: Long = System.currentTimeMillis(),
    val confidence: ConfidenceLevel = ConfidenceLevel.ESTIMATED,
    val calculationMethod: String? = null
)

data class Expense(
    val id: String,
    val tripId: String,
    val stopId: String? = null,
    val category: ExpenseCategory,
    val amount: Double,
    val isShared: Boolean = true,
    val unit: ExpenseUnit = ExpenseUnit.TOTAL,
    val provenance: PriceProvenance
)

data class RouteSegment(
    val fromStopId: String,
    val toStopId: String,
    val distanceMeters: Long,
    val durationMinutes: Int,
    val tollCost: Double? = null
)

data class TripStop(
    val id: String,
    val tripId: String,
    val placeId: String? = null,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val stopOrder: Int,
    val plannedDurationMinutes: Int = 60,
    val bufferMinutes: Int = 15,
    val isOvernight: Boolean = false,
    val openingHours: OpeningHours? = null,
    val notes: String? = null,
    val costItems: List<Expense> = emptyList()
)

data class Trip(
    val id: String,
    val title: String,
    val destinationName: String,
    val startTimestampEpochMs: Long,
    val departureTimeMinutes: Int = 360, // 06:00 AM
    val totalBudget: Double,
    val perPersonBudget: Double? = null,
    val groupSize: Int = 1,
    val travelMode: TravelMode = TravelMode.CAR,
    val vehicleMileageKmPerLitre: Double = 15.0,
    val fuelPricePerLitre: Double = 102.50,
    val currency: String = "INR",
    val isDemo: Boolean = false,
    val version: Long = 1L
)

data class ScheduledStop(
    val stop: TripStop,
    val dayIndex: Int,
    val arrivalMinutes: Int,
    val departureMinutes: Int,
    val travelDurationFromPreviousMinutes: Int,
    val distanceFromPreviousKm: Double,
    val openingStatus: OpeningStatus = OpeningStatus.OPEN
)

data class ScheduleResult(
    val stops: List<ScheduledStop>,
    val totalTripDurationMinutes: Int,
    val totalTravelMinutes: Int,
    val totalVisitMinutes: Int,
    val totalBufferMinutes: Int,
    val dayRollovers: Int
)

data class CategoryBudget(
    val category: ExpenseCategory,
    val totalAmount: Double,
    val perPersonAmount: Double,
    val itemCount: Int,
    val hasEstimatedPrices: Boolean
)

data class BudgetResult(
    val totalCost: Double,
    val perPersonCost: Double,
    val fuelCost: Double,
    val tollCost: Double,
    val stayCost: Double,
    val foodCost: Double,
    val activityCost: Double,
    val otherCost: Double,
    val contingencyCost: Double,
    val categoryBreakdown: List<CategoryBudget>,
    val lowScenarioCost: Double,
    val typicalScenarioCost: Double,
    val highScenarioCost: Double,
    val missingPricesCount: Int,
    val estimatedPricesCount: Int,
    val budgetRemaining: Double,
    val isOverBudget: Boolean
)

data class PlanWarning(
    val id: String,
    val title: String,
    val description: String,
    val severity: WarningSeverity,
    val stopId: String? = null,
    val actionType: WarningActionType? = null
)

data class FeasibilityReport(
    val timeFeasibility: FeasibilityLevel,
    val budgetFeasibility: FeasibilityLevel,
    val overallFeasibility: FeasibilityLevel,
    val timeUsedPercent: Float,
    val budgetUsedPercent: Float,
    val warnings: List<PlanWarning>,
    val confidenceScore: Int
)
