/* ============================================
   ADULLAM — js/config.js
   Firebase + DeepSeek configuration, Firebase init.
   Load this file FIRST — everything else depends on it.
   ============================================ */

// Firebase Configuration
// Import the functions you need from the SDKs you need

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAYyIEAlJD8FgeE2bv73fWwKbpsDPuiB84",
  authDomain: "graceguide-8d9f5.firebaseapp.com",
   databaseURL: "https://graceguide-8d9f5-default-rtdb.firebase.io",
  projectId: "graceguide-8d9f5",
  storageBucket: "graceguide-8d9f5.firebasestorage.app",
  messagingSenderId: "859988308746",
  appId: "1:859988308746:web:f68879be9f0d967b9040f3",
  measurementId: "G-2QKQHE2TBW"

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

