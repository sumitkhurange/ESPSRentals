// ═══════════════════════════════════════════════════════════
//  app.js  –  Firebase Phone OTP Authentication Logic
//  Uses Firebase Web SDK v10 (modular) via CDN
// ═══════════════════════════════════════════════════════════

import { initializeApp }            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, RecaptchaVerifier,
         signInWithPhoneNumber,
         onAuthStateChanged,
         signOut }                  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig }           from './config.js';

// ─────────────────────────────────────────────────────────
//  FIREBASE INIT
// ─────────────────────────────────────────────────────────
let app  = null;
let auth = null;

function initFirebase() {
  if (auth) return true;
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing  = required.filter(k => !firebaseConfig[k] || firebaseConfig[k].startsWith('YOUR_'));
  if (missing.length) {
    showError(phoneError, `config.js is missing: ${missing.join(', ')}. Update config.js and reload.`);
    return false;
  }
  try {
    app  = initializeApp(firebaseConfig);
    auth = getAuth(app);
    return true;
  } catch (err) {
    console.error('Firebase init error:', err);
    showError(phoneError, 'Firebase initialization failed. Check your config.js values.');
    return false;
  }
}

// ─────────────────────────────────────────────────────────
//  DOM REFS
// ─────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const viewPhone       = $('view-phone');
const viewOtp         = $('view-otp');
const viewDashboard   = $('view-dashboard');
const phoneInput      = $('phone-input');
const btnSendOtp      = $('btn-send-otp');
const phoneError      = $('phone-error');
const otpPhoneDisplay = $('otp-phone-display');
const otpBoxes        = Array.from(document.querySelectorAll('.otp-box'));
const btnVerifyOtp    = $('btn-verify-otp');
const btnResend       = $('btn-resend');
const resendTimer     = $('resend-timer');
const otpError        = $('otp-error');
const btnBack         = $('btn-back');
const dashPhone       = $('dash-phone');
const dashUid         = $('dash-uid');
const btnSignout      = $('btn-signout');

// ─────────────────────────────────────────────────────────
//  VIEW MANAGEMENT
// ─────────────────────────────────────────────────────────
function showView(view) {
  [viewPhone, viewOtp, viewDashboard].forEach(v => {
    v.classList.add('hidden');
    v.classList.remove('active');
  });
  view.classList.remove('hidden');
  void view.offsetWidth;          // trigger reflow for animation
  view.classList.add('active');
}

// ─────────────────────────────────────────────────────────
//  BUTTON LOADING STATE
// ─────────────────────────────────────────────────────────
function setLoading(btn, loading) {
  const text    = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled  = loading;
  if (text)    text.classList.toggle('hidden', loading);
  if (spinner) spinner.classList.toggle('hidden', !loading);
}

// ─────────────────────────────────────────────────────────
//  ERROR DISPLAY
// ─────────────────────────────────────────────────────────
function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}
function clearError(el) {
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────
//  RECAPTCHA  (Firebase v10 signature: auth comes FIRST)
// ─────────────────────────────────────────────────────────
let recaptchaVerifier = null;

function setupRecaptcha() {
  if (!auth) return;

  // Always destroy & recreate to avoid stale widget errors
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch (_) {}
    recaptchaVerifier = null;
  }

  // ⚠️  Firebase v10: RecaptchaVerifier(auth, container, params)
  recaptchaVerifier = new RecaptchaVerifier(
    auth,
    'recaptcha-container',
    {
      size: 'invisible',
      callback: () => { /* reCAPTCHA solved */ },
      'expired-callback': () => {
        showError(phoneError, 'reCAPTCHA expired. Please click Send OTP again.');
        setLoading(btnSendOtp, false);
      }
    }
  );
}

// ─────────────────────────────────────────────────────────
//  OTP STATE
// ─────────────────────────────────────────────────────────
let confirmationResult = null;
let timerInterval      = null;
let currentPhone       = '';

// ─────────────────────────────────────────────────────────
//  SEND OTP
// ─────────────────────────────────────────────────────────
async function sendOtp(isResend = false) {
  clearError(phoneError);
  clearError(otpError);

  const phone = currentPhone || phoneInput.value.trim();

  if (!isResend) {
    if (!phone)            { showError(phoneError, 'Please enter your phone number.'); phoneInput.focus(); return; }
    if (!/^\d{10}$/.test(phone)) { showError(phoneError, 'Enter a valid 10-digit mobile number.'); phoneInput.focus(); return; }
  }

  if (!initFirebase()) return;

  setLoading(btnSendOtp, true);
  currentPhone = phone;
  const fullPhone = '+91' + phone;

  try {
    setupRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, fullPhone, recaptchaVerifier);

    // Navigate to OTP view
    otpPhoneDisplay.textContent = '+91 ' + phone;
    showView(viewOtp);
    otpBoxes[0].focus();
    startResendTimer();
  } catch (err) {
    // Always log the full error for debugging in DevTools (F12 → Console)
    console.error('[Firebase Auth Error]', err?.code, err?.message, err);
    showError(isResend ? otpError : phoneError, friendlyError(err));
    setLoading(btnSendOtp, false);

    // Reset reCAPTCHA on failure
    if (recaptchaVerifier) {
      try { recaptchaVerifier.clear(); } catch (_) {}
      recaptchaVerifier = null;
    }
  }
}

// ─────────────────────────────────────────────────────────
//  VERIFY OTP
// ─────────────────────────────────────────────────────────
async function verifyOtp() {
  clearError(otpError);
  const code = otpBoxes.map(b => b.value.trim()).join('');

  if (!/^\d{6}$/.test(code)) {
    showError(otpError, 'Please enter all 6 digits of the OTP.');
    return;
  }
  if (!confirmationResult) {
    showError(otpError, 'Session expired. Go back and request a new OTP.');
    return;
  }

  setLoading(btnVerifyOtp, true);

  try {
    const result = await confirmationResult.confirm(code);
    const user   = result.user;
    dashPhone.textContent = user.phoneNumber || ('+91 ' + currentPhone);
    dashUid.textContent   = user.uid;
    showView(viewDashboard);
    stopResendTimer();
  } catch (err) {
    console.error('[Firebase OTP Verify Error]', err?.code, err?.message, err);
    showError(otpError, friendlyError(err));
    setLoading(btnVerifyOtp, false);
    otpBoxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
    otpBoxes[0].focus();
  }
}

// ─────────────────────────────────────────────────────────
//  RESEND TIMER
// ─────────────────────────────────────────────────────────
function startResendTimer(seconds = 60) {
  stopResendTimer();
  let remaining = seconds;
  btnResend.disabled = true;
  resendTimer.textContent = `${remaining}s`;

  timerInterval = setInterval(() => {
    remaining--;
    resendTimer.textContent = `${remaining}s`;
    if (remaining <= 0) {
      stopResendTimer();
      btnResend.disabled = false;
      resendTimer.textContent = '';
    }
  }, 1000);
}

function stopResendTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ─────────────────────────────────────────────────────────
//  OTP INPUTS: auto-focus, backspace, paste
// ─────────────────────────────────────────────────────────
function setupOtpInputs() {
  otpBoxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(-1);
      box.classList.toggle('filled', !!box.value);
      if (box.value && i < otpBoxes.length - 1) otpBoxes[i + 1].focus();
    });

    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        otpBoxes[i - 1].value = '';
        otpBoxes[i - 1].classList.remove('filled');
        otpBoxes[i - 1].focus();
      }
    });
  });

  // Paste 6 digits anywhere in the OTP grid
  document.addEventListener('paste', e => {
    if (!e.target.classList.contains('otp-box')) return;
    const pasted = (e.clipboardData || window.clipboardData)
      .getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    pasted.split('').forEach((ch, idx) => {
      if (otpBoxes[idx]) { otpBoxes[idx].value = ch; otpBoxes[idx].classList.add('filled'); }
    });
    otpBoxes[Math.min(pasted.length, 5)].focus();
  });
}

// ─────────────────────────────────────────────────────────
//  FRIENDLY ERROR MESSAGES  (with code shown for debugging)
// ─────────────────────────────────────────────────────────
function friendlyError(err) {
  const code = err?.code || '';
  const map  = {
    'auth/invalid-phone-number':       'Invalid phone number. Please check and try again.',
    'auth/too-many-requests':          'Too many attempts. Wait a few minutes and try again.',
    'auth/invalid-verification-code':  'Wrong OTP entered. Please check and try again.',
    'auth/code-expired':               'OTP has expired. Please request a new one.',
    'auth/quota-exceeded':             'SMS quota exceeded for this Firebase project.',
    'auth/captcha-check-failed':       'reCAPTCHA check failed. Refresh the page and retry.',
    'auth/network-request-failed':     'Network error. Check your internet connection.',
    'auth/missing-phone-number':       'Phone number is required.',
    'auth/app-not-authorized':         '⚠ App not authorized. Add "localhost" to Firebase Console → Authentication → Settings → Authorized domains.',
    'auth/web-storage-unsupported':    'Enable cookies/localStorage in your browser settings.',
    'auth/internal-error':             '⚠ Firebase internal error. Ensure "localhost" is in Authorized domains AND Phone sign-in is enabled in Firebase Console.',
    'auth/missing-client-identifier':  '⚠ reCAPTCHA failed. Make sure "localhost" is in Firebase Authorized domains.',
  };
  if (map[code])  return map[code];
  if (err?.message) return `Error (${code || 'unknown'}): ${err.message}`;
  return 'Something went wrong. Open DevTools (F12 → Console) to see the exact error code.';
}

// ─────────────────────────────────────────────────────────
//  AUTH STATE  (auto-restore session on reload)
// ─────────────────────────────────────────────────────────
function listenAuthState() {
  onAuthStateChanged(auth, user => {
    if (user) {
      dashPhone.textContent = user.phoneNumber || ('+91 ' + currentPhone);
      dashUid.textContent   = user.uid;
      showView(viewDashboard);
    } else {
      showView(viewPhone);
      phoneInput.focus();
    }
  });
}

// ─────────────────────────────────────────────────────────
//  EVENT LISTENERS
// ─────────────────────────────────────────────────────────
btnSendOtp.addEventListener('click',  () => sendOtp(false));
phoneInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendOtp(false); });

btnVerifyOtp.addEventListener('click', verifyOtp);
btnResend.addEventListener('click',   () => sendOtp(true));

btnBack.addEventListener('click', () => {
  stopResendTimer();
  clearError(otpError);
  otpBoxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
  showView(viewPhone);
  setLoading(btnSendOtp, false);
  phoneInput.focus();
});

btnSignout.addEventListener('click', async () => {
  try {
    await signOut(auth);
    currentPhone      = '';
    phoneInput.value  = '';
    showView(viewPhone);
    phoneInput.focus();
  } catch (err) {
    console.error(err);
  }
});

// ─────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────
(function boot() {
  setupOtpInputs();
  if (initFirebase()) {
    listenAuthState();   // shows correct view (logged in or phone entry)
  } else {
    showView(viewPhone); // show blank form even if config is wrong
  }
})();
