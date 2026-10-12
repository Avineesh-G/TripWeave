// ==========================================================================
// TripWeave — Firebase Authentication & Cloud Firestore Database Service
// ==========================================================================

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDocs, 
  collection, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';

// Configuration injected securely via vite.config.js from local.properties
const firebaseConfig = typeof __FIREBASE_CONFIG__ !== 'undefined' ? __FIREBASE_CONFIG__ : {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== '' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== ''
);

let app = null;
let auth = null;
let db = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    console.log('[TripWeave] Firebase initialized with live Cloud Firestore & Google Auth');
  } catch (err) {
    console.warn('[TripWeave] Firebase initialization error:', err);
  }
} else {
  console.info('[TripWeave] Firebase keys not yet added to local.properties. Ready for setup.');
}

// --------------------------------------------------------------------------
// AUTHENTICATION API (Google Login Only)
// --------------------------------------------------------------------------

export async function loginWithGoogle() {
  if (isFirebaseConfigured && auth && googleProvider) {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const profile = {
        uid: user.uid,
        displayName: user.displayName || 'Google Explorer',
        email: user.email,
        photoURL: user.photoURL,
        providerId: 'google.com'
      };
      localStorage.setItem('tripweave_auth_user', JSON.stringify(profile));
      return { success: true, user: profile };
    } catch (error) {
      console.error('[TripWeave] Google sign-in failed:', error);
      return { success: false, error: error.message };
    }
  } else {
    // Interactive Developer / Preview Mode when keys are being created
    console.info('[TripWeave] Simulating Google Sign-In in preview mode.');
    const devUser = {
      uid: 'google-user-' + Date.now(),
      displayName: 'Avineesh G',
      email: 'avineesh.dev@gmail.com',
      photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      providerId: 'google.com'
    };
    localStorage.setItem('tripweave_auth_user', JSON.stringify(devUser));
    return { 
      success: true, 
      user: devUser, 
      isDevPreview: true,
      message: 'Signed in via Google Auth Preview. Add your Firebase keys to local.properties for live multi-device sync.' 
    };
  }
}

export async function logoutUser() {
  localStorage.removeItem('tripweave_auth_user');
  if (isFirebaseConfigured && auth) {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  }
}

export function subscribeAuthState(callback) {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        const profile = {
          uid: user.uid,
          displayName: user.displayName || 'Google Explorer',
          email: user.email,
          photoURL: user.photoURL,
          providerId: 'google.com'
        };
        localStorage.setItem('tripweave_auth_user', JSON.stringify(profile));
        callback(profile);
      } else {
        localStorage.removeItem('tripweave_auth_user');
        callback(null);
      }
    });
  } else {
    // Check local storage for persisted session
    const saved = localStorage.getItem('tripweave_auth_user');
    if (saved) {
      try {
        callback(JSON.parse(saved));
      } catch (e) {
        callback(null);
      }
    } else {
      callback(null);
    }
    // Return dummy unsubscribe
    return () => {};
  }
}

export function getCurrentUser() {
  const saved = localStorage.getItem('tripweave_auth_user');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }
  return null;
}

// --------------------------------------------------------------------------
// CLOUD FIRESTORE DATABASE API (Trips, Stops, Expenses per User)
// --------------------------------------------------------------------------

export async function syncTripToCloud(userId, trip, stops = [], expenses = []) {
  if (!userId) return false;

  if (isFirebaseConfigured && db) {
    try {
      const tripRef = doc(db, 'users', userId, 'trips', trip.id);
      await setDoc(tripRef, {
        trip,
        stops,
        expenses,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return true;
    } catch (err) {
      if (err.code === 'permission-denied') {
        console.warn('[TripWeave] Cloud Firestore permission denied. In Production mode, ensure your Firestore Security Rules allow: match /users/{userId}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == userId; }');
      } else {
        console.warn('[TripWeave] Cloud Firestore sync failed:', err);
      }
      return false;
    }
  }
  return false;
}

export async function removeTripFromCloud(userId, tripId) {
  if (!userId || !tripId) return false;

  if (isFirebaseConfigured && db) {
    try {
      const tripRef = doc(db, 'users', userId, 'trips', tripId);
      await deleteDoc(tripRef);
      return true;
    } catch (err) {
      console.warn('[TripWeave] Cloud Firestore delete failed:', err);
      return false;
    }
  }
  return false;
}

export function subscribeCloudTrips(userId, callback) {
  if (!userId) return () => {};

  if (isFirebaseConfigured && db) {
    try {
      const tripsCol = collection(db, 'users', userId, 'trips');
      return onSnapshot(tripsCol, (snapshot) => {
        const cloudTrips = [];
        const stopsMap = {};
        const expensesMap = {};

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.trip) {
            cloudTrips.push(data.trip);
            stopsMap[data.trip.id] = data.stops || [];
            expensesMap[data.trip.id] = data.expenses || [];
          }
        });

        callback({ trips: cloudTrips, stopsMap, expensesMap });
      }, (err) => {
        console.warn('[TripWeave] Cloud trips subscription error:', err);
      });
    } catch (e) {
      console.warn('Subscribe cloud trips error:', e);
    }
  }

  return () => {};
}
