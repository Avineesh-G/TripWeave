package com.tripweave.core.database

import com.tripweave.core.model.*

fun TripEntity.toDomain(): Trip = Trip(
    id = id,
    title = title,
    destinationName = destinationName,
    startTimestampEpochMs = startTimestampEpochMs,
    departureTimeMinutes = departureTimeMinutes,
    totalBudget = totalBudget,
    perPersonBudget = perPersonBudget,
    groupSize = groupSize,
    travelMode = TravelMode.valueOf(travelMode),
    vehicleMileageKmPerLitre = vehicleMileageKmPerLitre,
    fuelPricePerLitre = fuelPricePerLitre,
    currency = currency,
    isDemo = isDemo,
    version = version
)

fun Trip.toEntity(): TripEntity = TripEntity(
    id = id,
    title = title,
    destinationName = destinationName,
    startTimestampEpochMs = startTimestampEpochMs,
    departureTimeMinutes = departureTimeMinutes,
    totalBudget = totalBudget,
    perPersonBudget = perPersonBudget,
    groupSize = groupSize,
    travelMode = travelMode.name,
    vehicleMileageKmPerLitre = vehicleMileageKmPerLitre,
    fuelPricePerLitre = fuelPricePerLitre,
    currency = currency,
    isDemo = isDemo,
    version = version
)

fun TripStopEntity.toDomain(): TripStop = TripStop(
    id = id,
    tripId = tripId,
    placeId = placeId,
    name = name,
    latitude = latitude,
    longitude = longitude,
    stopOrder = stopOrder,
    plannedDurationMinutes = plannedDurationMinutes,
    bufferMinutes = bufferMinutes,
    isOvernight = isOvernight,
    openingHours = if (openMinutes != null && closeMinutes != null) {
        OpeningHours(
            openMinutes = openMinutes,
            closeMinutes = closeMinutes,
            isOpen24Hours = isOpen24Hours,
            isClosed = isClosed
        )
    } else null,
    notes = notes
)

fun TripStop.toEntity(): TripStopEntity = TripStopEntity(
    id = id,
    tripId = tripId,
    placeId = placeId,
    name = name,
    latitude = latitude,
    longitude = longitude,
    stopOrder = stopOrder,
    plannedDurationMinutes = plannedDurationMinutes,
    bufferMinutes = bufferMinutes,
    isOvernight = isOvernight,
    openMinutes = openingHours?.openMinutes,
    closeMinutes = openingHours?.closeMinutes,
    isOpen24Hours = openingHours?.isOpen24Hours ?: false,
    isClosed = openingHours?.isClosed ?: false,
    notes = notes
)

fun ExpenseEntity.toDomain(): Expense = Expense(
    id = id,
    tripId = tripId,
    stopId = stopId,
    category = ExpenseCategory.valueOf(category),
    amount = amount,
    isShared = isShared,
    unit = ExpenseUnit.valueOf(unit),
    provenance = PriceProvenance(
        sourceType = PriceSourceType.valueOf(sourceType),
        sourceName = sourceName,
        sourceUrl = sourceUrl,
        timestamp = timestampEpochMs,
        confidence = ConfidenceLevel.valueOf(confidence),
        calculationMethod = calculationMethod
    )
)

fun Expense.toEntity(): ExpenseEntity = ExpenseEntity(
    id = id,
    tripId = tripId,
    stopId = stopId,
    category = category.name,
    amount = amount,
    isShared = isShared,
    unit = unit.name,
    sourceType = provenance.sourceType.name,
    sourceName = provenance.sourceName,
    sourceUrl = provenance.sourceUrl,
    confidence = provenance.confidence.name,
    calculationMethod = provenance.calculationMethod,
    timestampEpochMs = provenance.timestamp
)
