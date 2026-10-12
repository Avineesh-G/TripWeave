// Data definitions and Multilingual Localizations (Zero Mock Data)

export const TRANSLATIONS = {
  en: {
    app_name: "TripWeave",
    active_trip: "Active",
    nav_map: "Map",
    nav_itinerary: "Itinerary",
    nav_budget: "Budget",
    nav_trips: "Trips",
    nav_settings: "Settings",
    feasible: "Feasible",
    tight: "Tight",
    infeasible: "Not Feasible",
    add_stop: "+ Add Stop",
    total_cost: "Total Estimated Cost",
    per_person: "/ person",
    remaining: "Remaining",
    overrun: "Over Budget",
    low_scenario: "Low Scenario",
    typical_scenario: "Typical (Baseline)",
    high_scenario: "High Scenario"
  },
  te: {
    app_name: "ట్రిప్‌వీవ్",
    active_trip: "ప్రస్తుత ట్రిప్",
    nav_map: "మ్యాప్",
    nav_itinerary: "షెడ్యూల్",
    nav_budget: "బడ్జెట్",
    nav_trips: "ట్రిప్‌లు",
    nav_settings: "సెట్టింగ్‌లు",
    feasible: "సాధ్యమే",
    tight: "సమయం తక్కువ",
    infeasible: "సాధ్యం కాదు",
    add_stop: "+ స్టాప్ జోడించండి",
    total_cost: "అంచనా మొత్తం ఖర్చు",
    per_person: "/ ఒక్కొక్కరికి",
    remaining: "మిగిలినది",
    overrun: "బడ్జెట్ దాటినది",
    low_scenario: "కనిష్ట",
    typical_scenario: "సాధారణ",
    high_scenario: "గరిష్ట"
  },
  hi: {
    app_name: "ट्रिपवीव",
    active_trip: "सक्रिय ट्रिप",
    nav_map: "नक्शा",
    nav_itinerary: "समय सारणी",
    nav_budget: "बजट",
    nav_trips: "ट्रिप्स",
    nav_settings: "सेटिंग्स",
    feasible: "संभव है",
    tight: "तंग समय",
    infeasible: "संभव नहीं",
    add_stop: "+ स्टॉप जोड़ें",
    total_cost: "कुल अनुमानित लागत",
    per_person: "/ प्रति व्यक्ति",
    remaining: "शेष बजट",
    overrun: "बजट से अधिक",
    low_scenario: "न्यूनतम",
    typical_scenario: "सामान्य",
    high_scenario: "अधिकतम"
  },
  ta: {
    app_name: "ட்ரிப்வீவ்",
    active_trip: "தற்போதைய பயணம்",
    nav_map: "வரைபடம்",
    nav_itinerary: "கால அட்டவணை",
    nav_budget: "பட்ஜெட்",
    nav_trips: "பயணங்கள்",
    nav_settings: "அமைப்புகள்",
    feasible: "சாத்தியமானது",
    tight: "குறைந்த நேரம்",
    infeasible: "சாத்தியமற்றது",
    add_stop: "+ நிறுத்தம் சேர்க்க",
    total_cost: "மதிப்பிடப்பட்ட செலவு",
    per_person: "/ ஒரு நபருக்கு",
    remaining: "மீதமுள்ள பட்ஜெட்",
    overrun: "பட்ஜெட்டை தாண்டியது",
    low_scenario: "குறைந்தபட்ச",
    typical_scenario: "வழக்கமான",
    high_scenario: "அதிகபட்ச"
  }
};

export const SAMPLE_TRIPS = {};

export const Storage = {
  load() {
    try {
      const data = localStorage.getItem("tripweave_state");
      if (data) {
        const parsed = JSON.parse(data);
        // Automatically purge any legacy mock trips
        if (parsed.activeTripId && (parsed.activeTripId.includes('coorg') || parsed.activeTripId.includes('blr') || parsed.activeTripId.includes('hampi'))) {
          localStorage.removeItem("tripweave_state");
        } else if (parsed.trips && parsed.trips.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not load from localStorage", e);
    }

    // Clean initial blank state
    const defaultTrip = {
      id: "trip-" + Date.now(),
      title: "My Road Trip",
      destinationName: "Select Destination",
      departureTimeMinutes: 480, // 08:00 AM
      totalBudget: 15000,
      groupSize: 2,
      vehicleMileageKmPerLitre: 16.0,
      fuelPricePerLitre: 102.8,
      isArchived: false
    };

    return {
      activeTripId: defaultTrip.id,
      trips: [defaultTrip],
      stopsMap: {
        [defaultTrip.id]: []
      },
      expensesMap: {
        [defaultTrip.id]: []
      },
      lang: "en",
      theme: "light"
    };
  },

  save(state) {
    try {
      localStorage.setItem("tripweave_state", JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  }
};
