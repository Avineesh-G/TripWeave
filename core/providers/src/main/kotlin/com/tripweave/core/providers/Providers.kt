package com.tripweave.core.providers

import com.tripweave.core.model.*

data class PlaceSearchResult(
    val placeId: String,
    val name: String,
    val address: String,
    val latitude: Double,
    val longitude: Double,
    val category: String, // ATTRACTION, FOOD, FUEL, STAY, REST_STOP
    val openingHours: OpeningHours? = null,
    val isDemo: Boolean = true
)

data class PlaceDetails(
    val placeId: String,
    val name: String,
    val address: String,
    val latitude: Double,
    val longitude: Double,
    val openingHours: OpeningHours? = null,
    val estimatedVisitDurationMinutes: Int = 60,
    val suggestedExpenses: List<Expense> = emptyList(),
    val isDemo: Boolean = true
)

interface PlaceSearchProvider {
    fun searchPlaces(query: String, category: String? = null, languageCode: String = "en"): List<PlaceSearchResult>
    fun getPlaceDetails(placeId: String, languageCode: String = "en"): PlaceDetails?
}

interface RoutingProvider {
    fun getRouteSegment(
        fromStopId: String,
        toStopId: String,
        originLat: Double,
        originLng: Double,
        destLat: Double,
        destLng: Double,
        mode: TravelMode = TravelMode.CAR
    ): RouteSegment
}
