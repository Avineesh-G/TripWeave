// Centralized State Management Store for TripWeave

const STORAGE_KEY = 'tripweave_state';

class StateStore {
  constructor() {
    this.trips = [];
    this.stopsMap = {};
    this.expensesMap = {};
    this.activeTripId = null;

    // Transient Runtime State
    this.userLocation = null;
    this.currentScenario = 'typical';
    this.activeTab = 'map';
    this.currentLanguage = localStorage.getItem('tripweave_language') || 'en';
    this.activeRoute = null; // Decoded OSRM polyline, distance, duration
    this.corridorAmenities = []; // Highway amenities along active route
    this.hasInitiallyCenteredOnUser = false;

    this.listeners = new Set();
    this.onSave = null;
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.trips)) {
          this.trips = data.trips;
          this.stopsMap = data.stopsMap || {};
          this.expensesMap = data.expensesMap || {};
          this.activeTripId = data.activeTripId || (this.trips[0] ? this.trips[0].id : null);
        }
      }

      // Restore last-known user location from persistent storage
      const savedLoc = localStorage.getItem('tripweave_last_user_location');
      if (savedLoc) {
        const loc = JSON.parse(savedLoc);
        if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' && loc.lat !== 0) {
          this.userLocation = {
            lat: loc.lat,
            lng: loc.lng,
            accuracy: loc.accuracy || 20,
            isRealGPS: true,
            provider: loc.provider || 'saved'
          };
          this.hasInitiallyCenteredOnUser = true;
        }
      }
    } catch (e) {
      console.warn('[TripWeave State] Error reading localStorage:', e);
    }
  }

  saveToStorage() {
    try {
      const payload = {
        trips: this.trips,
        stopsMap: this.stopsMap,
        expensesMap: this.expensesMap,
        activeTripId: this.activeTripId
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      if (typeof this.onSave === 'function') {
        this.onSave(payload);
      }
    } catch (e) {
      console.warn('[TripWeave State] Error writing localStorage:', e);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch (err) {
        console.error('[TripWeave State] Listener error:', err);
      }
    }
  }

  getActiveTrip() {
    if (!this.activeTripId) return this.trips[0] || null;
    return this.trips.find(t => t.id === this.activeTripId) || this.trips[0] || null;
  }

  getActiveStops() {
    const trip = this.getActiveTrip();
    if (!trip) {
      if (this.activeTripId && this.stopsMap[this.activeTripId]) {
        return this.stopsMap[this.activeTripId];
      }
      if (this.stopsMap['default-trip']) {
        return this.stopsMap['default-trip'];
      }
      return [];
    }
    return this.stopsMap[trip.id] || (this.stopsMap['default-trip'] || []);
  }

  getActiveExpenses() {
    const trip = this.getActiveTrip();
    if (!trip) return [];
    return this.expensesMap[trip.id] || [];
  }

  setActiveTrip(tripId) {
    this.activeTripId = tripId;
    this.saveToStorage();
    this.notify();
  }

  setStops(tripId, stops) {
    this.stopsMap[tripId] = stops;
    this.saveToStorage();
    this.notify();
  }

  setExpenses(tripId, expenses) {
    this.expensesMap[tripId] = expenses;
    this.saveToStorage();
    this.notify();
  }

  addStop(tripId, stop) {
    if (!this.stopsMap[tripId]) this.stopsMap[tripId] = [];
    this.stopsMap[tripId].push(stop);
    this.saveToStorage();
    this.notify();
  }

  removeStop(tripId, stopId) {
    if (!this.stopsMap[tripId]) return;
    this.stopsMap[tripId] = this.stopsMap[tripId].filter(s => s.id !== stopId);
    this.saveToStorage();
    this.notify();
  }

  setUserLocation(lat, lng, accuracy, isRealGPS = true, provider = 'gps') {
    this.userLocation = { lat, lng, accuracy, isRealGPS, provider };
    try {
      localStorage.setItem('tripweave_last_user_location', JSON.stringify({
        lat,
        lng,
        accuracy,
        provider,
        timestamp: Date.now()
      }));
    } catch (e) {}
    this.notify();
  }

  setScenario(scenario) {
    this.currentScenario = scenario;
    this.notify();
  }

  setActiveTab(tab) {
    this.activeTab = tab;
    this.notify();
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    localStorage.setItem('tripweave_language', lang);
    this.notify();
  }
}

export const state = new StateStore();
