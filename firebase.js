const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA9ufrj-0fRYAvMOZZNjfZtCCyNgORDF7E",
  authDomain: "journey-map-demo.firebaseapp.com",
  projectId: "journey-map-demo",
  storageBucket: "journey-map-demo.firebasestorage.app",
  messagingSenderId: "761882469344",
  appId: "1:761882469344:web:8fcbb93fed04ad3d1b8185",
  measurementId: "G-3FG51XB0ZS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = { db }; 