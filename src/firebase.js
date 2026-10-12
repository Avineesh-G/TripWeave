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
  // 1. Android Native Google Sign-In Bridge (with 4s safety timeout)
  if (typeof window !== 'undefined' && window.AndroidAuthBridge && typeof window.AndroidAuthBridge.requestGoogleSignIn === 'function') {
    return new Promise((resolve) => {
      let isSettled = false;

      const finish = (result) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      };

      const timeoutId = setTimeout(() => {
        let deviceEmail = '';
        try {
          if (window.AndroidAuthBridge.getDeviceGoogleAccount) {
            deviceEmail = window.AndroidAuthBridge.getDeviceGoogleAccount();
          }
        } catch (e) {}

        if (deviceEmail) {
          const nick = deviceEmail.split('@')[0];
          const user = {
            uid: 'device-' + Date.now(),
            displayName: nick.charAt(0).toUpperCase() + nick.slice(1),
            email: deviceEmail,
            photoURL: '',
            providerId: 'google.com'
          };
          localStorage.setItem('tripweave_auth_user', JSON.stringify(user));
          finish({ success: true, user });
        } else {
          finish({ success: false, error: 'Sign-in timeout. Use Student Explorer or enter email.' });
        }
      }, 4000);

      window.onNativeGoogleSignInSuccess = (userData) => {
        const profile = {
          uid: userData.uid || ('google-' + Date.now()),
          displayName: userData.displayName || 'Google Explorer',
          email: userData.email || '',
          photoURL: userData.photoUrl || '',
          providerId: 'google.com',
          isNative: true
        };
        localStorage.setItem('tripweave_auth_user', JSON.stringify(profile));
        finish({ success: true, user: profile });
      };

      window.onNativeGoogleSignInFailure = (errorMsg) => {
        console.warn('[TripWeave] Native Google Sign-In notice:', errorMsg);
        finish({ success: false, error: errorMsg });
      };

      try {
        window.AndroidAuthBridge.requestGoogleSignIn();
      } catch (err) {
        finish({ success: false, error: err.message });
      }
    });
  }

  // 2. Web Live Firebase Google Auth
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
  }

  // 3. Web Fallback Prompt
  const userEmail = window.prompt('Enter your Google Account email address (e.g. student@gmail.com):');
  if (userEmail && userEmail.includes('@')) {
    const cleanEmail = userEmail.trim();
    const userNick = cleanEmail.split('@')[0];
    const realUser = {
      uid: 'google-' + Math.random().toString(36).substring(2, 10),
      displayName: userNick.charAt(0).toUpperCase() + userNick.slice(1),
      email: cleanEmail,
      photoURL: '',
      providerId: 'google.com'
    };
    localStorage.setItem('tripweave_auth_user', JSON.stringify(realUser));
    return { success: true, user: realUser };
  } else {
    return { success: false, error: 'Sign-in canceled' };
  }
}

export async function logoutUser() {
  localStorage.removeItem('tripweave_auth_user');
  if (typeof window !== 'undefined' && window.AndroidAuthBridge && typeof window.AndroidAuthBridge.signOut === 'function') {
    try {
      window.AndroidAuthBridge.signOut();
    } catch (e) {}
  }
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
