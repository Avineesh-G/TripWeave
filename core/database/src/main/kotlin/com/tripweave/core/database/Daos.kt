package com.tripweave.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface TripDao {
    @Query("SELECT * FROM trips ORDER BY startTimestampEpochMs DESC")
    fun getAllTrips(): Flow<List<TripEntity>>

    @Query("SELECT * FROM trips WHERE id = :id")
    fun getTripById(id: String): Flow<TripEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTrip(trip: TripEntity)

    @Update
    suspend fun updateTrip(trip: TripEntity)

    @Query("DELETE FROM trips WHERE id = :id")
    suspend fun deleteTrip(id: String)
}

@Dao
interface TripStopDao {
    @Query("SELECT * FROM trip_stops WHERE tripId = :tripId ORDER BY stopOrder ASC")
    fun getStopsForTrip(tripId: String): Flow<List<TripStopEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStops(stops: List<TripStopEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStop(stop: TripStopEntity)

    @Update
    suspend fun updateStop(stop: TripStopEntity)

    @Query("DELETE FROM trip_stops WHERE id = :id")
    suspend fun deleteStop(id: String)

    @Transaction
    suspend fun replaceStops(tripId: String, newStops: List<TripStopEntity>) {
        deleteStopsForTrip(tripId)
        insertStops(newStops)
    }

    @Query("DELETE FROM trip_stops WHERE tripId = :tripId")
    suspend fun deleteStopsForTrip(tripId: String)
}

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses WHERE tripId = :tripId")
    fun getExpensesForTrip(tripId: String): Flow<List<ExpenseEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpense(expense: ExpenseEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpenses(expenses: List<ExpenseEntity>)

    @Query("DELETE FROM expenses WHERE id = :id")
    suspend fun deleteExpense(id: String)
}

@Dao
interface SyncOutboxDao {
    @Query("SELECT * FROM sync_outbox ORDER BY outboxId ASC")
    fun getPendingOutbox(): Flow<List<SyncOutboxEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun queueMutation(item: SyncOutboxEntity)

    @Query("DELETE FROM sync_outbox WHERE outboxId = :id")
    suspend fun completeMutation(id: Long)
}
