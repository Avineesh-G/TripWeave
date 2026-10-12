package com.tripweave.app.data

import android.content.Context
import com.tripweave.core.database.*
import com.tripweave.core.model.*
import com.tripweave.core.planning.BudgetEngine
import com.tripweave.core.planning.FeasibilityEvaluator
import com.tripweave.core.planning.ScheduleEngine
import com.tripweave.core.providers.DemoProvider
import kotlinx.coroutines.flow.*

class TripRepository(context: Context) {
    private val db = TripWeaveDatabase.getInstance(context)
    private val tripDao = db.tripDao()
    private val stopDao = db.tripStopDao()
    private val expenseDao = db.expenseDao()

    val allTrips: Flow<List<Trip>> = tripDao.getAllTrips().map { list -> list.map { it.toDomain() } }

    fun getStopsForTrip(tripId: String): Flow<List<TripStop>> =
        stopDao.getStopsForTrip(tripId).map { list -> list.map { it.toDomain() } }

    fun getExpensesForTrip(tripId: String): Flow<List<Expense>> =
        expenseDao.getExpensesForTrip(tripId).map { list -> list.map { it.toDomain() } }

    suspend fun seedSampleTripIfEmpty() {
        val existing = tripDao.getAllTrips().first()
        if (existing.isEmpty()) {
            val (demoTrip, demoStops) = DemoProvider.createSampleBangaloreCoorgTrip()
            tripDao.insertTrip(demoTrip.toEntity())
            stopDao.insertStops(demoStops.map { it.toEntity() })

            // Add sample expenses (Entry tickets, tolls, stay)
            val expenses = listOf(
                Expense(
                    id = "exp-sample-toll",
                    tripId = demoTrip.id,
                    category = ExpenseCategory.TOLL,
                    amount = 330.0,
                    isShared = true,
                    unit = ExpenseUnit.TOTAL,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.OFFICIAL,
                        sourceName = "NHAI Bangalore-Mysore Expressway",
                        confidence = ConfidenceLevel.CONFIRMED
                    )
                ),
                Expense(
                    id = "exp-sample-stay",
                    tripId = demoTrip.id,
                    stopId = "stop-4-madikeri",
                    category = ExpenseCategory.STAY,
                    amount = 3200.0,
                    isShared = true,
                    unit = ExpenseUnit.PER_ROOM_NIGHT,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.USER_ENTERED,
                        sourceName = "Madikeri Homestay Booking",
                        confidence = ConfidenceLevel.CONFIRMED
                    )
                ),
                Expense(
                    id = "exp-sample-food",
                    tripId = demoTrip.id,
                    category = ExpenseCategory.FOOD,
                    amount = 2400.0,
                    isShared = true,
                    unit = ExpenseUnit.TOTAL,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.COMMUNITY,
                        sourceName = "Estimated ₹600/person highway dining",
                        confidence = ConfidenceLevel.ESTIMATED
                    )
                ),
                Expense(
                    id = "exp-sample-mysore-tickets",
                    tripId = demoTrip.id,
                    stopId = "stop-2-mysore",
                    category = ExpenseCategory.TICKET,
                    amount = 400.0,
                    isShared = true,
                    unit = ExpenseUnit.TOTAL,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.OFFICIAL,
                        sourceName = "Palace Entry (4 persons @ ₹100)",
                        confidence = ConfidenceLevel.CONFIRMED
                    )
                )
            )
            expenseDao.insertExpenses(expenses.map { it.toEntity() })
        }
    }

    suspend fun saveTrip(trip: Trip) {
        tripDao.insertTrip(trip.toEntity())
    }

    suspend fun addStop(stop: TripStop) {
        stopDao.insertStop(stop.toEntity())
    }

    suspend fun updateStop(stop: TripStop) {
        stopDao.updateStop(stop.toEntity())
    }

    suspend fun deleteStop(stopId: String) {
        stopDao.deleteStop(stopId)
    }

    suspend fun reorderStops(tripId: String, stops: List<TripStop>) {
        val reorderedEntities = stops.mapIndexed { index, stop ->
            stop.copy(stopOrder = index).toEntity()
        }
        stopDao.replaceStops(tripId, reorderedEntities)
    }
}
