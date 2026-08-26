/* ============================================
   ADULLAM — js/config.js
   Firebase + DeepSeek configuration, Firebase init.
   Load this file FIRST — everything else depends on it.
   ============================================ */

// Firebase Configuration
// ⚠️ REPLACE WITH YOUR FIREBASE CONFIG
// Import the functions you need from the SDKs you need

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA8dl9fpCZjkydBwlQMRDl8s_Ck7HrCsls",
  authDomain: "adullam-90a36.firebaseapp.com",
  databaseURL: "https://adullam-90a36-default-rtdb.firebaseio.com",
  projectId: "adullam-90a36",
  storageBucket: "adullam-90a36.firebasestorage.app",
  messagingSenderId: "220211700381",
  appId: "1:220211700381:web:4dfa996f180a3c8bacaa74",
  measurementId: "G-ETN0241C15"
};

// Initialize Firebase


// DeepSeek AI Configuration
// ⚠️ REPLACE WITH YOUR DEEPSEEK API KEY
const DEEPSEEK_API_KEY = "sk-836241f5b4e749f097e2f09ca7f4a152";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

