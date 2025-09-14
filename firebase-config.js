// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCKgaGJCJWzi1a0QCIboekZGGYHPj5wCZc",
  authDomain: "frazekraze.firebaseapp.com",
  projectId: "frazekraze",
  storageBucket: "frazekraze.firebasestorage.app",
  messagingSenderId: "620963055360",
  appId: "1:620963055360:web:5c368f0b9577a54793d5e5",
  measurementId: "G-F319E1RWC4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);