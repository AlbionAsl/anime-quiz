// Import the functions you need from the SDKs you need
// This is for the script fullCodeTxt.py


import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAJ2-wWov82Fo7zmuvayyT9c4Uv8r24X1I",
  authDomain: "animequiz-d1890.firebaseapp.com",
  projectId: "animequiz-d1890",
  storageBucket: "animequiz-d1890.appspot.com",
  messagingSenderId: "108288016848",
  appId: "1:108288016848:web:3f051df26f3d15be3a39d5",
  measurementId: "G-R4YF26JYGC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);