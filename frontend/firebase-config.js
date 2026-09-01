/**
 * firebase-config.js
 * Initialize Firebase using the compat SDK loaded via CDN in index.html.
 * Do NOT use ES module imports here – the compat SDK is loaded as a global.
 */

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCFYaL4CnnSMQfiEDBrAwa4vFfRde_Lb0",
  authDomain: "jansahayakai.firebaseapp.com",
  projectId: "jansahayakai",
  storageBucket: "jansahayakai.firebasestorage.app",
  messagingSenderId: "990870638643",
  appId: "1:990870638643:web:c92af5739763b9f1d45346",
};

// Avoid "app already exists" error on hot-reload
const existingApp = firebase.apps && firebase.apps.length > 0;

try {
  const app = existingApp
    ? firebase.app()                     // reuse existing app
    : firebase.initializeApp(firebaseConfig);

  window.db   = firebase.firestore();
  window.auth = firebase.auth();
  window.firebaseReady = true;
  console.log("✅ Firebase initialized successfully");
} catch (e) {
  // Log the EXACT error so we can diagnose it
  console.error("❌ Firebase initialization failed:", e.code, e.message, e);
  window.firebaseReady = false;
  window.db   = null;
  window.auth = null;
}
