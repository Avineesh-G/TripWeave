package com.tripweave.core.providers

import com.tripweave.core.model.*
import kotlin.math.roundToInt

class DemoProvider : PlaceSearchProvider, RoutingProvider {

    private val demoPlaces = listOf(
        // Bangalore to Coorg places
        PlaceDetails(
            placeId = "demo-mysore-palace",
            name = "Mysore Palace",
            address = "Sayyaji Rao Rd, Agrahara, Chamrajpura, Mysuru, Karnataka 570001",
            latitude = 12.3051,
            longitude = 76.6551,
            openingHours = OpeningHours(openMinutes = 600, closeMinutes = 1050), // 10:00 AM - 5:30 PM
            estimatedVisitDurationMinutes = 120,
            suggestedExpenses = listOf(
                Expense(
                    id = "exp-demo-palace-entry",
                    tripId = "",
                    stopId = "demo-mysore-palace",
                    category = ExpenseCategory.TICKET,
                    amount = 100.0,
                    unit = ExpenseUnit.PER_PERSON,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.OFFICIAL,
                        sourceName = "Karnataka Tourism / Palace Board",
                        confidence = ConfidenceLevel.CONFIRMED
                    )
                )
            ),
            isDemo = true
        ),
        PlaceDetails(
            placeId = "demo-bylakuppe",
            name = "Namdroling Monastery (Golden Temple)",
            address = "Arlikumari, Bylakuppe, Karnataka 571104",
            latitude = 12.4300,
            longitude = 75.9664,
            openingHours = OpeningHours(openMinutes = 540, closeMinutes = 1080), // 09:00 AM - 6:00 PM
            estimatedVisitDurationMinutes = 90,
            suggestedExpenses = listOf(
                Expense(
                    id = "exp-demo-monastery-entry",
                    tripId = "",
                    stopId = "demo-bylakuppe",
                    category = ExpenseCategory.TICKET,
                    amount = 0.0,
                    unit = ExpenseUnit.TOTAL,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.OFFICIAL,
                        sourceName = "Monastery Trust (Free Entry)",
                        confidence = ConfidenceLevel.CONFIRMED
                    )
                )
            ),
            isDemo = true
        ),
        PlaceDetails(
            placeId = "demo-rajas-seat",
            name = "Raja's Seat",
            address = "Stuart Hill, Madikeri, Karnataka 571201",
            latitude = 12.4190,
            longitude = 75.7380,
            openingHours = OpeningHours(openMinutes = 330, closeMinutes = 1200), // 05:30 AM - 8:00 PM
            estimatedVisitDurationMinutes = 60,
            suggestedExpenses = listOf(
                Expense(
                    id = "exp-demo-rajas-seat-entry",
                    tripId = "",
                    stopId = "demo-rajas-seat",
                    category = ExpenseCategory.TICKET,
                    amount = 25.0,
                    unit = ExpenseUnit.PER_PERSON,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.OFFICIAL,
                        sourceName = "District Administration Madikeri",
                        confidence = ConfidenceLevel.CONFIRMED
                    )
                )
            ),
            isDemo = true
        ),
        PlaceDetails(
            placeId = "demo-abbey-falls",
            name = "Abbey Falls",
            address = "Madikeri, Kodagu, Karnataka 571201",
            latitude = 12.4530,
            longitude = 75.7190,
            openingHours = OpeningHours(openMinutes = 540, closeMinutes = 1020), // 09:00 AM - 5:00 PM
            estimatedVisitDurationMinutes = 75,
            suggestedExpenses = listOf(
                Expense(
                    id = "exp-demo-abbey-entry",
                    tripId = "",
                    stopId = "demo-abbey-falls",
                    category = ExpenseCategory.TICKET,
                    amount = 15.0,
                    unit = ExpenseUnit.PER_PERSON,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.OFFICIAL,
                        sourceName = "Kodagu District Tourism",
                        confidence = ConfidenceLevel.CONFIRMED
                    )
                ),
                Expense(
                    id = "exp-demo-abbey-parking",
                    tripId = "",
                    stopId = "demo-abbey-falls",
                    category = ExpenseCategory.PARKING,
                    amount = 50.0,
                    unit = ExpenseUnit.PER_VEHICLE,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.COMMUNITY,
                        sourceName = "Visitor Reported Parking Rate",
                        confidence = ConfidenceLevel.ESTIMATED
                    )
                )
            ),
            isDemo = true
        ),
        // Hyderabad to Hampi places
        PlaceDetails(
            placeId = "demo-kurnool-buruju",
            name = "Konda Reddy Buruju",
            address = "Old City, Kurnool, Andhra Pradesh 518001",
            latitude = 15.8281,
            longitude = 78.0373,
            openingHours = OpeningHours(isOpen24Hours = true),
            estimatedVisitDurationMinutes = 45,
            suggestedExpenses = emptyList(),
            isDemo = true
        ),
        PlaceDetails(
            placeId = "demo-virupaksha",
            name = "Virupaksha Temple",
            address = "Hampi, Karnataka 583239",
            latitude = 15.3353,
            longitude = 76.4600,
            openingHours = OpeningHours(openMinutes = 360, closeMinutes = 1110), // 06:00 AM - 6:30 PM
            estimatedVisitDurationMinutes = 90,
            suggestedExpenses = listOf(
                Expense(
                    id = "exp-demo-virupaksha-entry",
                    tripId = "",
                    stopId = "demo-virupaksha",
                    category = ExpenseCategory.TICKET,
                    amount = 25.0,
                    unit = ExpenseUnit.PER_PERSON,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.OFFICIAL,
                        sourceName = "Temple Trust",
                        confidence = ConfidenceLevel.CONFIRMED
                    )
                )
            ),
            isDemo = true
        ),
        PlaceDetails(
            placeId = "demo-vittala",
            name = "Vijaya Vittala Temple & Stone Chariot",
            address = "Hampi, Bellary, Karnataka 583239",
            latitude = 15.3350,
            longitude = 76.4600,
            openingHours = OpeningHours(openMinutes = 510, closeMinutes = 1050), // 08:30 AM - 5:30 PM
            estimatedVisitDurationMinutes = 120,
            suggestedExpenses = listOf(
                Expense(
                    id = "exp-demo-vittala-entry",
                    tripId = "",
                    stopId = "demo-vittala",
                    category = ExpenseCategory.TICKET,
                    amount = 40.0,
                    unit = ExpenseUnit.PER_PERSON,
                    provenance = PriceProvenance(
                        sourceType = PriceSourceType.OFFICIAL,
                        sourceName = "Archaeological Survey of India (ASI)",
                        confidence = ConfidenceLevel.CONFIRMED
                    )
                )
            ),
            isDemo = true
        )
    )

    override fun searchPlaces(query: String, category: String?, languageCode: String): List<PlaceSearchResult> {
        val q = query.lowercase().trim()
        val filtered = if (q.isEmpty()) demoPlaces else demoPlaces.filter {
            it.name.lowercase().contains(q) || it.address.lowercase().contains(q)
        }
        return filtered.map {
            PlaceSearchResult(
                placeId = it.placeId,
                name = it.name,
                address = it.address,
                latitude = it.latitude,
                longitude = it.longitude,
                category = "ATTRACTION",
                openingHours = it.openingHours,
                isDemo = true
            )
        }
    }

    override fun getPlaceDetails(placeId: String, languageCode: String): PlaceDetails? {
        return demoPlaces.find { it.placeId == placeId }
    }

    override fun getRouteSegment(
        fromStopId: String,
        toStopId: String,
        originLat: Double,
        originLng: Double,
        destLat: Double,
        destLng: Double,
        mode: TravelMode
    ): RouteSegment {
        val distKm = com.tripweave.core.planning.ScheduleEngine.calculateHaversineDistanceKm(
            originLat, originLng, destLat, destLng
        )
        // Realistic Indian highway average speeds: 55 km/h for highways, 30 km/h for ghats/hills
        val avgSpeed = if (distKm > 100) 55.0 else 40.0
        val durationMins = ((distKm / avgSpeed) * 60.0).roundToInt()
        
        // Toll estimate on major highways: ~ ₹1.8 / km
        val tollCost = if (distKm > 50) (distKm * 1.8).roundToInt().toDouble() else 0.0

        return RouteSegment(
            fromStopId = fromStopId,
            toStopId = toStopId,
            distanceMeters = (distKm * 1000).toLong(),
            durationMinutes = durationMins,
            tollCost = tollCost
        )
    }

    companion object {
        fun createSampleBangaloreCoorgTrip(): Pair<Trip, List<TripStop>> {
            val trip = Trip(
                id = "sample-blr-coorg",
                title = "Bangalore to Coorg Coffee & Hills",
                destinationName = "Madikeri, Coorg",
                startTimestampEpochMs = System.currentTimeMillis() + 86400000L * 3,
                departureTimeMinutes = 360, // 06:00 AM
                totalBudget = 16000.0,
                perPersonBudget = 4000.0,
                groupSize = 4,
                travelMode = TravelMode.CAR,
                vehicleMileageKmPerLitre = 16.0,
                fuelPricePerLitre = 102.86,
                isDemo = true
            )

            val stops = listOf(
                TripStop(
                    id = "stop-1-blr",
                    tripId = trip.id,
                    name = "MG Road, Bangalore (Origin)",
                    latitude = 12.9716,
                    longitude = 77.5946,
                    stopOrder = 0,
                    plannedDurationMinutes = 15,
                    bufferMinutes = 0,
                    isOvernight = false
                ),
                TripStop(
                    id = "stop-2-mysore",
                    tripId = trip.id,
                    placeId = "demo-mysore-palace",
                    name = "Mysore Palace",
                    latitude = 12.3051,
                    longitude = 76.6551,
                    stopOrder = 1,
                    plannedDurationMinutes = 120,
                    bufferMinutes = 20,
                    isOvernight = false,
                    openingHours = OpeningHours(openMinutes = 600, closeMinutes = 1050),
                    notes = "Official entry tickets available at South Gate counter"
                ),
                TripStop(
                    id = "stop-3-bylakuppe",
                    tripId = trip.id,
                    placeId = "demo-bylakuppe",
                    name = "Namdroling Monastery (Golden Temple)",
                    latitude = 12.4300,
                    longitude = 75.9664,
                    stopOrder = 2,
                    plannedDurationMinutes = 90,
                    bufferMinutes = 15,
                    isOvernight = false,
                    openingHours = OpeningHours(openMinutes = 540, closeMinutes = 1080)
                ),
                TripStop(
                    id = "stop-4-madikeri",
                    tripId = trip.id,
                    placeId = "demo-rajas-seat",
                    name = "Raja's Seat & Madikeri Stay",
                    latitude = 12.4190,
                    longitude = 75.7380,
                    stopOrder = 3,
                    plannedDurationMinutes = 60,
                    bufferMinutes = 15,
                    isOvernight = true,
                    openingHours = OpeningHours(openMinutes = 330, closeMinutes = 1200),
                    notes = "Catch the sunset then check into homestay"
                ),
                TripStop(
                    id = "stop-5-abbey",
                    tripId = trip.id,
                    placeId = "demo-abbey-falls",
                    name = "Abbey Falls",
                    latitude = 12.4530,
                    longitude = 75.7190,
                    stopOrder = 4,
                    plannedDurationMinutes = 75,
                    bufferMinutes = 15,
                    isOvernight = false,
                    openingHours = OpeningHours(openMinutes = 540, closeMinutes = 1020)
                )
            )

            return Pair(trip, stops)
        }
    }
}
