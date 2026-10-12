package com.tripweave.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tripweave.app.data.TripRepository
import com.tripweave.core.model.*
import com.tripweave.core.planning.*
import com.tripweave.core.providers.DemoProvider
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

enum class AppTab {
    MAP, ITINERARY, BUDGET, TRIPS, SETTINGS
}

data class PlanUiState(
    val selectedTab: AppTab = AppTab.MAP,
    val activeTrip: Trip? = null,
    val stops: List<TripStop> = emptyList(),
    val expenses: List<Expense> = emptyList(),
    val scheduleResult: ScheduleResult? = null,
    val budgetResult: BudgetResult? = null,
    val feasibilityReport: FeasibilityReport? = null,
    val selectedStopForDetail: TripStop? = null,
    val currentLanguage: String = "en",
    val isCreateTripOpen: Boolean = false,
    val allTrips: List<Trip> = emptyList()
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = TripRepository(application)
    private val demoProvider = DemoProvider()

    private val _uiState = MutableStateFlow(PlanUiState())
    val uiState: StateFlow<PlanUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            repository.seedSampleTripIfEmpty()
            repository.allTrips.collect { trips ->
                _uiState.update { it.copy(allTrips = trips) }
                if (_uiState.value.activeTrip == null && trips.isNotEmpty()) {
                    selectTrip(trips.first())
                }
            }
        }
    }

    fun selectTrip(trip: Trip) {
        viewModelScope.launch {
            _uiState.update { it.copy(activeTrip = trip) }
            // Observe stops and expenses for active trip
            combine(
                repository.getStopsForTrip(trip.id),
                repository.getExpensesForTrip(trip.id)
            ) { stops, expenses ->
                recalculate(trip, stops, expenses)
            }.collect()
        }
    }

    private fun recalculate(trip: Trip, stops: List<TripStop>, expenses: List<Expense>) {
        val schedule = ScheduleEngine.calculateSchedule(trip, stops)
        val totalDistanceKm = schedule.stops.sumOf { it.distanceFromPreviousKm }
        val budget = BudgetEngine.calculateBudget(trip, expenses, totalDistanceKm)
        val feasibility = FeasibilityEvaluator.evaluate(trip, schedule, budget)

        _uiState.update {
            it.copy(
                stops = stops,
                expenses = expenses,
                scheduleResult = schedule,
                budgetResult = budget,
                feasibilityReport = feasibility
            )
        }
    }

    fun selectTab(tab: AppTab) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    fun setLanguage(langCode: String) {
        _uiState.update { it.copy(currentLanguage = langCode) }
    }

    fun openStopDetail(stop: TripStop?) {
        _uiState.update { it.copy(selectedStopForDetail = stop) }
    }

    fun setCreateTripOpen(open: Boolean) {
        _uiState.update { it.copy(isCreateTripOpen = open) }
    }

    fun updateStopDuration(stop: TripStop, deltaMinutes: Int) {
        val newDuration = (stop.plannedDurationMinutes + deltaMinutes).coerceAtLeast(15)
        viewModelScope.launch {
            repository.updateStop(stop.copy(plannedDurationMinutes = newDuration))
        }
    }

    fun updateStopBuffer(stop: TripStop, deltaMinutes: Int) {
        val newBuffer = (stop.bufferMinutes + deltaMinutes).coerceAtLeast(0)
        viewModelScope.launch {
            repository.updateStop(stop.copy(bufferMinutes = newBuffer))
        }
    }

    fun moveStop(fromIndex: Int, toIndex: Int) {
        val currentStops = _uiState.value.stops.toMutableList()
        if (fromIndex in currentStops.indices && toIndex in currentStops.indices) {
            val item = currentStops.removeAt(fromIndex)
            currentStops.add(toIndex, item)
            _uiState.value.activeTrip?.let { trip ->
                viewModelScope.launch {
                    repository.reorderStops(trip.id, currentStops)
                }
            }
        }
    }

    fun deleteStop(stopId: String) {
        viewModelScope.launch {
            repository.deleteStop(stopId)
        }
    }

    fun addStopToActiveTrip(name: String, lat: Double, lng: Double, duration: Int = 60, buffer: Int = 15) {
        val trip = _uiState.value.activeTrip ?: return
        val currentCount = _uiState.value.stops.size
        val newStop = TripStop(
            id = "stop-${System.currentTimeMillis()}",
            tripId = trip.id,
            name = name,
            latitude = lat,
            longitude = lng,
            stopOrder = currentCount,
            plannedDurationMinutes = duration,
            bufferMinutes = buffer
        )
        viewModelScope.launch {
            repository.addStop(newStop)
        }
    }

    fun createNewTrip(
        title: String,
        destination: String,
        departureMinutes: Int,
        budget: Double,
        groupSize: Int,
        mileage: Double,
        fuelPrice: Double
    ) {
        val newTrip = Trip(
            id = "trip-${System.currentTimeMillis()}",
            title = title,
            destinationName = destination,
            startTimestampEpochMs = System.currentTimeMillis() + 86400000L * 2,
            departureTimeMinutes = departureMinutes,
            totalBudget = budget,
            perPersonBudget = budget / groupSize.coerceAtLeast(1),
            groupSize = groupSize,
            vehicleMileageKmPerLitre = mileage,
            fuelPricePerLitre = fuelPrice,
            isDemo = true
        )
        viewModelScope.launch {
            repository.saveTrip(newTrip)
            selectTrip(newTrip)
            _uiState.update { it.copy(isCreateTripOpen = false, selectedTab = AppTab.MAP) }
        }
    }
}
