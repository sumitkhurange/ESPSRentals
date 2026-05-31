import { initializeApp } from "firebase/app";

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "firebase/auth";

/*
=====================================================
FIREBASE CONFIG
=====================================================
*/

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

/*
=====================================================
CHECK IF FIREBASE IS CONFIGURED
=====================================================
*/

const isFirebaseConfigured =
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId;

/*
=====================================================
INITIALIZE FIREBASE
=====================================================
*/

let app = null;
let auth = null;

try {

  if (isFirebaseConfigured) {

    app = initializeApp(firebaseConfig);

    auth = getAuth(app);

    console.log("Firebase Initialized Successfully");

  } else {

    console.warn("Firebase ENV variables are missing");

  }

} catch (error) {

  console.error("Firebase Initialization Error:", error);

}

/*
=====================================================
SETUP RECAPTCHA
=====================================================
*/

const setupRecaptcha = async () => {

  try {

    // Reuse existing recaptcha
    if (window.recaptchaVerifier) {

      return window.recaptchaVerifier;

    }

    if (!auth) {

      throw new Error("Firebase auth not initialized");

    }

    window.recaptchaVerifier =
      new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",

          callback: () => {

            console.log("reCAPTCHA solved");

          },

          "expired-callback": () => {

            console.log("reCAPTCHA expired");

          }
        }
      );

    await window.recaptchaVerifier.render();

    console.log("reCAPTCHA initialized");

    return window.recaptchaVerifier;

  } catch (error) {

    console.error(
      "Recaptcha Setup Error:",
      error
    );

    throw error;

  }

};

/*
=====================================================
SEND PHONE OTP
=====================================================
*/

const sendPhoneOTP = async (phoneNumber) => {

  try {

    if (!auth) {

      throw new Error(
        "Firebase Auth not initialized"
      );

    }

    const appVerifier =
      await setupRecaptcha();

    let formattedPhone =
      phoneNumber.trim();

    // Convert Indian number to +91 format
    if (!formattedPhone.startsWith("+91")) {

      formattedPhone =
        "+91" +
        formattedPhone.replace(/\D/g, "");

    }

    console.log(
      "Sending OTP to:",
      formattedPhone
    );

    const confirmationResult =
      await signInWithPhoneNumber(
        auth,
        formattedPhone,
        appVerifier
      );

    // Store globally for OTP verify
    window.confirmationResult =
      confirmationResult;

    console.log(
      "Phone OTP Sent Successfully"
    );

    return {
      success: true,
      confirmationResult
    };

  } catch (error) {

    console.error(
      "Phone OTP Error:",
      error
    );

    return {
      success: false,
      error: error.message
    };

  }

};

/*
=====================================================
VERIFY PHONE OTP
=====================================================
*/

const verifyPhoneOTP = async (otp) => {

  try {

    if (!window.confirmationResult) {

      throw new Error(
        "No OTP session found"
      );

    }

    const result =
      await window.confirmationResult.confirm(
        otp
      );

    console.log(
      "Phone Verified Successfully"
    );

    return {
      success: true,
      user: result.user
    };

  } catch (error) {

    console.error(
      "OTP Verification Error:",
      error
    );

    return {
      success: false,
      error: error.message
    };

  }

};

/*
=====================================================
GOOGLE LOGIN
=====================================================
*/

const googleProvider =
  new GoogleAuthProvider();

const googleLogin = async () => {

  try {

    if (!auth) {

      throw new Error(
        "Firebase Auth not initialized"
      );

    }

    const result =
      await signInWithPopup(
        auth,
        googleProvider
      );

    const user = result.user;

    // Firebase token
    const token =
      await user.getIdToken();

    console.log(
      "Google Login Success"
    );

    console.log("User:", user);

    console.log("Firebase Token:", token);

    return {
      success: true,
      user,
      token
    };

  } catch (error) {

    console.error(
      "Google Login Error:",
      error
    );

    return {
      success: false,
      error: error.message
    };

  }

};

/*
=====================================================
LOGOUT
=====================================================
*/

const logout = async () => {

  try {

    await signOut(auth);

    console.log("Logout Success");

    return {
      success: true
    };

  } catch (error) {

    console.error(
      "Logout Error:",
      error
    );

    return {
      success: false,
      error: error.message
    };

  }

};

/*
=====================================================
EXPORTS
=====================================================
*/

export {
  auth,
  isFirebaseConfigured,
  setupRecaptcha,
  sendPhoneOTP,
  verifyPhoneOTP,
  googleLogin,
  logout,
  RecaptchaVerifier,
  signInWithPhoneNumber
};