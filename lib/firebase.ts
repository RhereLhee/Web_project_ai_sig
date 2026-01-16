// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app"
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth"

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAI2bJR3TN5NkCBPTepHmRw2bTRzW4LQ7c",
  authDomain: "techtrade-app.firebaseapp.com",
  projectId: "techtrade-app",
  storageBucket: "techtrade-app.firebasestorage.app",
  messagingSenderId: "560544608350",
  appId: "1:560544608350:web:a1d4dec71a8fe4dfe704cf",
  measurementId: "G-1ZTYXWHTEW"
}

// Initialize Firebase (prevent duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const auth = getAuth(app)

// Set language to Thai
auth.languageCode = 'th'

export { auth, RecaptchaVerifier, signInWithPhoneNumber }
export type { ConfirmationResult }