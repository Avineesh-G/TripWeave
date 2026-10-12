package com.tripweave.core.planning

import com.tripweave.core.model.*
import kotlin.math.*

object ScheduleEngine {

    fun calculateSchedule(
        trip: Trip,
        stops: List<TripStop>,
        segments: Map<Pair<String, String>, RouteSegment> = emptyMap()
    ): ScheduleResult {
        if (stops.isEmpty()) {
            return ScheduleResult(
                stops = emptyList(),
                totalTripDurationMinutes = 0,
                totalTravelMinutes = 0,
                totalVisitMinutes = 0,
                totalBufferMinutes = 0,
                dayRollovers = 0
            )
        }

        val sortedStops = stops.sortedBy { it.stopOrder }
        val scheduledStops = mutableListOf<ScheduledStop>()

        var currentDay = 0
        var currentMinutesInDay = trip.departureTimeMinutes
        var totalTravelMinutes = 0
        var totalVisitMinutes = 0
        var totalBufferMinutes = 0
        var dayRollovers = 0

        for (index in sortedStops.indices) {
            val stop = sortedStops[index]

            val travelDuration: Int
            val distanceKm: Double

            if (index == 0) {
                travelDuration = 0
                distanceKm = 0.0
            } else {
                val prevStop = sortedStops[index - 1]
                val key = Pair(prevStop.id, stop.id)
                val segment = segments[key]

                if (segment != null) {
                    travelDuration = segment.durationMinutes
                    distanceKm = segment.distanceMeters / 1000.0
                } else {
                    distanceKm = calculateHaversineDistanceKm(
                        prevStop.latitude, prevStop.longitude,
                        stop.latitude, stop.longitude
                    )
                    travelDuration = max(10, ((distanceKm / 45.0) * 60.0).roundToInt())
                }
            }

            totalTravelMinutes += travelDuration
            currentMinutesInDay += travelDuration

            while (currentMinutesInDay >= 1440) {
                currentMinutesInDay -= 1440
                currentDay++
                dayRollovers++
            }

            val arrivalMinutes = currentMinutesInDay
            val visitMinutes = stop.plannedDurationMinutes
            val bufferMinutes = stop.bufferMinutes

            totalVisitMinutes += visitMinutes
            totalBufferMinutes += bufferMinutes

            val openingStatus = evaluateOpeningHours(stop.openingHours, arrivalMinutes, visitMinutes)

            currentMinutesInDay += (visitMinutes + bufferMinutes)
            while (currentMinutesInDay >= 1440) {
                currentMinutesInDay -= 1440
                currentDay++
                dayRollovers++
            }
            val departureMinutes = currentMinutesInDay

            scheduledStops.add(
                ScheduledStop(
                    stop = stop,
                    dayIndex = currentDay,
                    arrivalMinutes = arrivalMinutes,
                    departureMinutes = departureMinutes,
                    travelDurationFromPreviousMinutes = travelDuration,
                    distanceFromPreviousKm = distanceKm,
                    openingStatus = openingStatus
                )
            )

            if (stop.isOvernight && index < sortedStops.size - 1) {
                currentDay++
                dayRollovers++
                currentMinutesInDay = trip.departureTimeMinutes
            }
        }

        val totalTripDurationMinutes = totalTravelMinutes + totalVisitMinutes + totalBufferMinutes

        return ScheduleResult(
            stops = scheduledStops,
            totalTripDurationMinutes = totalTripDurationMinutes,
            totalTravelMinutes = totalTravelMinutes,
            totalVisitMinutes = totalVisitMinutes,
            totalBufferMinutes = totalBufferMinutes,
            dayRollovers = dayRollovers
        )
    }

    private fun evaluateOpeningHours(
        openingHours: OpeningHours?,
        arrivalMinutes: Int,
        visitMinutes: Int
    ): OpeningStatus {
        if (openingHours == null) return OpeningStatus.UNKNOWN
        if (openingHours.isOpen24Hours) return OpeningStatus.OPEN
        if (openingHours.isClosed) return OpeningStatus.CLOSED_ON_ARRIVAL

        val normalizedArrival = arrivalMinutes % 1440
        val endOfVisit = normalizedArrival + visitMinutes

        return when {
            normalizedArrival < openingHours.openMinutes -> OpeningStatus.CLOSED_ON_ARRIVAL
            normalizedArrival >= openingHours.closeMinutes -> OpeningStatus.CLOSED_ON_ARRIVAL
            endOfVisit > openingHours.closeMinutes -> OpeningStatus.TIGHT_CLOSING
            else -> OpeningStatus.OPEN
        }
    }

    fun calculateHaversineDistanceKm(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ): Double {
        val r = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return r * c
    }
}
