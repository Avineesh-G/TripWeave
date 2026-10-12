package com.tripweave.core.database

import androidx.room.*

@Entity(tableName = "trips")
data class TripEntity(
    @PrimaryKey val id: String,
    val title: String,
    val destinationName: String,
    val startTimestampEpochMs: Long,
    val departureTimeMinutes: Int,
    val totalBudget: Double,
    val perPersonBudget: Double?,
    val groupSize: Int,
    val travelMode: String,
    val vehicleMileageKmPerLitre: Double,
    val fuelPricePerLitre: Double,
    val currency: String,
    val isDemo: Boolean,
    val version: Long
)

@Entity(
    tableName = "trip_stops",
    foreignKeys = [
        ForeignKey(
            entity = TripEntity::class,
            parentColumns = ["id"],
            childColumns = ["tripId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("tripId"), Index("stopOrder")]
)
data class TripStopEntity(
    @PrimaryKey val id: String,
    val tripId: String,
    val placeId: String?,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val stopOrder: Int,
    val plannedDurationMinutes: Int,
    val bufferMinutes: Int,
    val isOvernight: Boolean,
    val openMinutes: Int?,
    val closeMinutes: Int?,
    val isOpen24Hours: Boolean,
    val isClosed: Boolean,
    val notes: String?
)

@Entity(
    tableName = "expenses",
    foreignKeys = [
        ForeignKey(
            entity = TripEntity::class,
            parentColumns = ["id"],
            childColumns = ["tripId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("tripId"), Index("stopId")]
)
data class ExpenseEntity(
    @PrimaryKey val id: String,
    val tripId: String,
    val stopId: String?,
    val category: String,
    val amount: Double,
    val isShared: Boolean,
    val unit: String,
    val sourceType: String,
    val sourceName: String?,
    val sourceUrl: String?,
    val confidence: String,
    val calculationMethod: String?,
    val timestampEpochMs: Long
)

@Entity(tableName = "sync_outbox")
data class SyncOutboxEntity(
    @PrimaryKey(autoGenerate = true) val outboxId: Long = 0,
    val entityType: String,
    val entityId: String,
    val operation: String,
    val payloadJson: String,
    val createdAtEpochMs: Long,
    val retryCount: Int = 0
)
