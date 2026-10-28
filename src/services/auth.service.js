// Google Authentication and Terms Management Service
import {
  loginWithGoogle as fbLogin,
  logoutUser as fbLogout,
  getCurrentUser as fbGetCurrentUser,
  subscribeAuthState as fbSubscribeAuth,
  syncTripToCloud
} from '../firebase.js';

export function isTermsAccepted() {
  return localStorage.getItem('tripweave_terms_accepted') === 'true';
}

export function setTermsAccepted(accepted = true) {
  localStorage.setItem('tripweave_terms_accepted', accepted ? 'true' : 'false');
}

export async function loginWithGoogle() {
  return await fbLogin();
}

export async function logoutUser() {
  return await fbLogout();
}

export function getCurrentUser() {
  return fbGetCurrentUser();
}

export function listenAuth(callback) {
  return fbSubscribeAuth(callback);
}

export async function saveTripToCloud(userId, trip, stops, expenses) {
  return await syncTripToCloud(userId, trip, stops, expenses);
}
