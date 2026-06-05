import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, MapPin, ShoppingCart, User, Star, Play, Copy, Plus, Minus, 
  ChevronRight, ChevronDown, ChevronUp, Check, FileText, Upload, 
  ArrowLeft, ArrowRight, CreditCard, Smartphone, Activity, FileSpreadsheet, 
  LogOut, Trash2, Edit, CheckCircle2, AlertCircle, AlertTriangle, Calendar, Clock, Lock,
  Menu, X, Tv, Compass, Mail, Camera
} from 'lucide-react';
import { auth, RecaptchaVerifier, signInWithPhoneNumber, isFirebaseConfigured, sendPhoneOTP, verifyPhoneOTP, googleLogin } from './firebase';

const getAvgRating = (reviewsList) => {
  if (!reviewsList || reviewsList.length === 0) return 0;
  const sum = reviewsList.reduce((acc, r) => acc + r.rating, 0);
  return (sum / reviewsList.length).toFixed(1);
};

export default function App() {
  // API base URL - points to Render backend in production
  const API = import.meta.env.VITE_API_BASE_URL || '';

  // Page States: 'home', 'details', 'checkout', 'admin'
  const [view, setView] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Interactive Simulator States
  const [activeSimTab, setActiveSimTab] = useState('builder'); // 'builder' or 'quiz'
  const [simConsole, setSimConsole] = useState('ps5'); // 'ps5', 'vr2', 'none'
  const [simEdgeController, setSimEdgeController] = useState(false);
  const [simSteering, setSimSteering] = useState(false);
  const [simDuration, setSimDuration] = useState(1); // 1, 3, 7, 14 days
  const [activeVibe, setActiveVibe] = useState('none'); // 'racer', 'party', 'vr', 'solo', 'none'
  const [showPromoVideo, setShowPromoVideo] = useState(false);

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Booking Selection States (Product Details Page)
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deliverySlot, setDeliverySlot] = useState('2:00 PM - 4:00 PM');
  
  // Persistent Multi-Item Cart State
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('elite_cart');
      const parsed = saved ? JSON.parse(saved) : [];
      const ids = new Set();
      return parsed.map((item, index) => {
        // Detect old timestamp-style IDs (purely numeric, >10 digits) or missing/duplicate IDs
        const isOldStyleId = !item.id || /^\d{10,}$/.test(String(item.id)) || ids.has(item.id);
        const newId = isOldStyleId
          ? `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${index}`
          : item.id;
        ids.add(newId);
        return { ...item, id: newId };
      });
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('elite_cart', JSON.stringify(cart));
  }, [cart]);

  // Cart Helper Actions
  const addToCart = (product, plan, start, end, slot) => {
    if (!isUserLoggedIn) {
      showToast('Please sign in first to add items to your cart.', 'error');
      setView('login');
      return false;
    }
    let basePrice = 0;
    if (plan.period === 'day') {
      basePrice = plan.rate * plan.days;
    } else if (plan.period === 'week') {
      basePrice = plan.rate * (plan.days / 7);
    } else if (plan.period === 'month') {
      basePrice = plan.rate * (plan.days / 30);
    } else {
      basePrice = plan.rate;
    }

    const existing = cart.find(item => item.product.id === product.id && item.plan.label === plan.label);

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id && item.plan.label === plan.label);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].qty += 1;
        return updated;
      } else {
        return [...prev, {
          id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          product,
          plan,
          startDate: start,
          endDate: end,
          deliverySlot: slot || '10:00 AM - 12:00 PM',
          basePrice,
          deliveryCharge: 0,
          qty: 1
        }];
      }
    });

    if (existing) {
      showToast(`Increased quantity of ${product.name} in cart!`);
    } else {
      showToast(`Added ${product.name} to cart!`);
    }
    return true;
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
    showToast('Item removed from cart.');
  };

  const updateCartQty = (itemId, newQty) => {
    if (newQty < 1) return;
    setCart(prev => prev.map(item => item.id === itemId ? { ...item, qty: newQty } : item));
  };

  // Checkout States
  const [checkoutStep, setCheckoutStep] = useState(1); // 1: Verification, 2: Details & Address, 3: Payment, 4: Success
  const [uploadedSelfie, setUploadedSelfie] = useState(null);
  const [uploadedID, setUploadedID] = useState(null);
  const [signatureName, setSignatureName] = useState('');
  const [isSigned, setIsSigned] = useState(false);
  const signatureCanvasRef = useRef(null);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const [hasDrawnOnCanvas, setHasDrawnOnCanvas] = useState(false);
  const [signatureCanvasData, setSignatureCanvasData] = useState(null);

  // Camera Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState('selfie'); // 'selfie' or 'document'
  const videoRef = useRef(null);
  const [scannerError, setScannerError] = useState('');
  const [facingMode, setFacingMode] = useState('user'); // 'user' or 'environment'
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [useCredits, setUseCredits] = useState(true); // Share Credits toggle
  
  const [paymentMethod, setPaymentMethod] = useState('UPI'); // UPI, Card, Netbanking, COD
  const [upiTxnId, setUpiTxnId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [selectedBank, setSelectedBank] = useState('State Bank of India');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);

  // Admin Dashboard States
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminTab, setAdminTab] = useState('bookings'); // bookings, products, metrics
  const [adminBookings, setAdminBookings] = useState([]);
  const [adminAuthError, setAdminAuthError] = useState('');
  
  // Admin Editing Products Form
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProductForm, setNewProductForm] = useState({
    id: '', name: '', category: 'Gaming Consoles', brand: '', 
    price1: 990, price2: 850, price3: 690, price7: 2990, price30: 9990,
    stock: 2, about: '', features: '', included: '', image: ''
  });

  // UI Utilities (Toasts)
  const [toasts, setToasts] = useState([]);
  const [activeFaq, setActiveFaq] = useState(null);
  const lastToastRef = useRef({ message: '', time: 0 });

  // Trigger Toast Alert
  const showToast = (message, type = 'success') => {
    const now = Date.now();
    // Prevent exactly identical messages within 500ms
    if (lastToastRef.current.message === message && (now - lastToastRef.current.time) < 500) {
      return;
    }
    lastToastRef.current = { message, time: now };

    const id = `${now}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userToken, setUserToken] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  
  // Real-time step-by-step OTP States
  const [signupSessionId, setSignupSessionId] = useState('');
  const [devOtpHint, setDevOtpHint] = useState(''); // Dev mode: shows OTP on screen when SMTP/Twilio not configured
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupStep, setSignupStep] = useState(1); // 1: Form, 2: Email OTP, 3: Mobile OTP, 4: Success
  const [firebaseConfirmationResult, setFirebaseConfirmationResult] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [clientTab, setClientTab] = useState('bookings'); // bookings, coupons, emails, profile
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [navClock, setNavClock] = useState(new Date());

  // Admin Booking Filters & Sort States
  const [adminBookingFilterYear, setAdminBookingFilterYear] = useState('All');
  const [adminBookingFilterMonth, setAdminBookingFilterMonth] = useState('All');
  const [adminBookingFilterDate, setAdminBookingFilterDate] = useState('');
  const [adminBookingSortBy, setAdminBookingSortBy] = useState('newest');

  // Profile edit fields
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileGender, setProfileGender] = useState('Prefer not to say');
  const [profileBirthday, setProfileBirthday] = useState('Not set');
  const [profileLanguage, setProfileLanguage] = useState('English (United States)');
  const [profileHomeAddress, setProfileHomeAddress] = useState('Not set');
  const [profileWorkAddress, setProfileWorkAddress] = useState('Not set');
  const [profileAadhaarNumber, setProfileAadhaarNumber] = useState('');
  const [profileAlternatePhone, setProfileAlternatePhone] = useState('');
  const [profileCity, setProfileCity] = useState('');
  const [profileState, setProfileState] = useState('');
  const [profileZipCode, setProfileZipCode] = useState('');
  const [profileCompanyName, setProfileCompanyName] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Custom Datepicker States & Helper functions
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dpSelectedDate, setDpSelectedDate] = useState(new Date());
  const [dpCurrentMonth, setDpCurrentMonth] = useState(new Date().getMonth());
  const [dpCurrentYear, setDpCurrentYear] = useState(new Date().getFullYear());

  const parseBirthdayDate = (birthdayStr) => {
    if (!birthdayStr || birthdayStr === 'Not set') return new Date();
    const parts = birthdayStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    return new Date();
  };

  // Change Password fields
  const [currPassword, setCurrPassword] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmNewPasswordVal, setConfirmNewPasswordVal] = useState('');

  // Reviews & Ratings States
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [activeReviewRatingFilter, setActiveReviewRatingFilter] = useState('All');
  const [adminReviewRatingFilter, setAdminReviewRatingFilter] = useState('All');
  
  // Review Form States
  const [formName, setFormName] = useState('');
  const [formProduct, setFormProduct] = useState('');
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Post-Delivery Feedback Modal States
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackBooking, setFeedbackBooking] = useState(null);
  const [feedbackProductRating, setFeedbackProductRating] = useState(5);
  const [feedbackDeliveryRating, setFeedbackDeliveryRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Calculated Product Review Variables
  const productReviews = selectedProduct ? reviews.filter(r => r.productId === selectedProduct.id) : [];
  const prodAvg = getAvgRating(productReviews);
  const prodCount = productReviews.length;

  useEffect(() => {
    if (userProfile) {
      setProfileName(userProfile.name || '');
      setProfilePhone(userProfile.phone || '');
      setProfileGender(userProfile.gender || 'Prefer not to say');
      setProfileBirthday(userProfile.birthday || 'Not set');
      setProfileLanguage(userProfile.language || 'English (United States)');
      setProfileHomeAddress(userProfile.homeAddress || 'Not set');
      setProfileWorkAddress(userProfile.workAddress || 'Not set');
      setProfileAadhaarNumber(userProfile.aadhaarNumber || '');
      setProfileAlternatePhone(userProfile.alternatePhone || '');
      setProfileCity(userProfile.city || '');
      setProfileState(userProfile.state || '');
      setProfileZipCode(userProfile.zipCode || '');
      setProfileCompanyName(userProfile.companyName || '');
      setFormName(userProfile.name || '');
    }
  }, [userProfile]);

  const isProfileIncomplete = isUserLoggedIn && userProfile && (
    !userProfile.name || !userProfile.name.trim() || 
    !userProfile.phone || !userProfile.phone.trim() || 
    !userProfile.birthday || userProfile.birthday === 'Not set' || !userProfile.birthday.trim() || 
    !userProfile.homeAddress || userProfile.homeAddress === 'Not set' || !userProfile.homeAddress.trim() || 
    !userProfile.workAddress || userProfile.workAddress === 'Not set' || !userProfile.workAddress.trim() || 
    !userProfile.aadhaarNumber || !userProfile.aadhaarNumber.trim() || 
    !userProfile.alternatePhone || !userProfile.alternatePhone.trim() || 
    !userProfile.city || !userProfile.city.trim() || 
    !userProfile.state || !userProfile.state.trim() || 
    !userProfile.zipCode || !userProfile.zipCode.trim() || 
    !userProfile.companyName || !userProfile.companyName.trim()
  );

  // Enforce profile completion for logged-in users
  useEffect(() => {
    if (isProfileIncomplete) {
      if (view !== 'client-dashboard' || clientTab !== 'profile' || !isEditingProfile) {
        setView('client-dashboard');
        setClientTab('profile');
        setIsEditingProfile(true);
      }
    }
  }, [isProfileIncomplete, view, clientTab, isEditingProfile]);

  // Auto-fill checkout delivery form from user profile when checkout opens
  useEffect(() => {
    if (view === 'checkout' && checkoutStep === 1 && isUserLoggedIn && userProfile) {
      setCustomerName(prev => prev || userProfile.name || '');
      setCustomerPhone(prev => prev || userProfile.phone || '');
      setCustomerEmail(prev => prev || userProfile.email || '');
      setDeliveryAddress(prev => {
        if (prev) return prev;
        const addr = userProfile.homeAddress;
        return addr && addr !== 'Not set' ? addr : '';
      });
    }
  }, [view, checkoutStep]);

  // OTP Countdown Timer Hook
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  // Helper to format countdown timer as MM:SS
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // OTP inputs keyboard navigation
  const handleOtpChange = (index, value, setDigits, boxPrefix) => {
    const cleanValue = value.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = cleanValue;
      return next;
    });

    if (cleanValue && index < 5) {
      const nextInput = document.getElementById(`${boxPrefix}-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpKeyDown = (index, e, digits, setDigits, boxPrefix) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        setDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        const prevInput = document.getElementById(`${boxPrefix}-input-${index - 1}`);
        if (prevInput) prevInput.focus();
      } else {
        setDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      }
    }
  };

  const handleOtpPaste = (e, setDigits, boxPrefix) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData.length === 6) {
      const digitsArr = pasteData.split('');
      setDigits(digitsArr);
      const lastInput = document.getElementById(`${boxPrefix}-input-5`);
      if (lastInput) lastInput.focus();
    }
  };

  // Advanced Password Reset Flow States
  const [showForgotFlow, setShowForgotFlow] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotPasswordConfirm, setForgotPasswordConfirm] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: Send Code, 2: Reset Password
  const [forgotToken, setForgotToken] = useState('');

  // Inline password reset (in Change Password card)
  const [showInlineForgot, setShowInlineForgot] = useState(false);
  const [inlineForgotStep, setInlineForgotStep] = useState(1); // 1: phone, 2: OTP, 3: new password
  const [inlineForgotPhone, setInlineForgotPhone] = useState('');
  const [inlineForgotOtp, setInlineForgotOtp] = useState('');
  const [inlineForgotResetToken, setInlineForgotResetToken] = useState('');
  const [inlineForgotNewPass, setInlineForgotNewPass] = useState('');
  const [inlineForgotConfirm, setInlineForgotConfirm] = useState('');
  const [inlineDevOtp, setInlineDevOtp] = useState('');

  // Coupon States
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [adminCoupons, setAdminCoupons] = useState([]);
  const [adminNewCoupon, setAdminNewCoupon] = useState({
    code: '',
    discountType: 'percent',
    value: '',
    minOrders: '0',
    description: ''
  });

  // Terms and Conditions Acceptance
  const RENTAL_TERMS = [
    "Consoles & accessories are for personal indoor use only.",
    "Keep all equipment in dry, clean, dust-free areas.",
    "Renter is liable for any physical/liquid damage or loss.",
    "Renter must provide official ID proof (Aadhaar, Passport, etc.).",
    "Zero security deposit is conditional upon identity verification.",
    "No renting or sub-renting to third parties.",
    "Setup must be done by Elite PS representative.",
    "Delayed returns will attract daily charges.",
    "Refund/cancellation is subject to verification."
  ];
  const [termChecks, setTermChecks] = useState(Array(9).fill(false));
  const [tcAgreedOverall, setTcAgreedOverall] = useState(false);

  // Advanced Identity Verification States
  const [isVerifyingAI, setIsVerifyingAI] = useState(false);
  const [aiMatchProgress, setAiMatchProgress] = useState(0);
  const [aiVerificationResult, setAiVerificationResult] = useState('none'); // 'none', 'success', 'failed'

  // Email Notification Logs
  const [myEmails, setMyEmails] = useState([]);
  const [adminEmails, setAdminEmails] = useState([]);
  const [adminVerificationLogs, setAdminVerificationLogs] = useState([]);
  const [adminVerifiedUsers, setAdminVerifiedUsers] = useState([]);

  // Browser Back Button Navigation Confirmation
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [backTargetView, setBackTargetView] = useState('');
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(null);

  // Auto load auth state
  useEffect(() => {
    const adminToken = localStorage.getItem('eliteAdminToken');
    if (adminToken) {
      setIsAdminLoggedIn(true);
    }
    const token = localStorage.getItem('eliteUserToken');
    const profile = localStorage.getItem('eliteUserProfile');
    if (token && profile) {
      setIsUserLoggedIn(true);
      setUserToken(token);
      setUserProfile(JSON.parse(profile));
    }
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setReviewsLoading(true);
    try {
      const res = await fetch(`${API}/api/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const toggleFeatureReview = async (id) => {
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/reviews/${id}/feature`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Review featured status toggled!`);
        fetchReviews();
      } else {
        showToast(data.message || 'Failed to toggle feature status.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error.', 'error');
    }
  };

  const deleteReview = async (id) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/reviews/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Review deleted successfully!');
        fetchReviews();
      } else {
        showToast(data.message || 'Failed to delete review.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error.', 'error');
    }
  };

  const handleReviewSubmit = async (prodId) => {
    if (!formName.trim() || !formComment.trim()) {
      showToast('Please fill out all fields.', 'error');
      return;
    }
    setIsSubmittingForm(true);
    try {
      const res = await fetch(`${API}/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userToken ? { 'Authorization': `Bearer ${userToken}` } : {})
        },
        body: JSON.stringify({
          productId: prodId === 'general' ? null : prodId,
          customerName: formName,
          rating: formRating,
          comment: formComment
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Review submitted successfully!');
        setFormComment('');
        fetchReviews();
      } else {
        showToast(data.message || 'Failed to submit review.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error connecting to review API.', 'error');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleFeedbackRemindLater = () => {
    if (!feedbackBooking) return;
    const trackingKey = `elite_suppress_${feedbackBooking.id}`;
    let tracking = { skipCount: 0, lastReminderTime: Date.now() };
    const raw = localStorage.getItem(trackingKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        tracking.skipCount = parsed.skipCount + 1;
      } catch {}
    } else {
      tracking.skipCount = 1;
    }
    localStorage.setItem(trackingKey, JSON.stringify(tracking));
    setShowFeedbackModal(false);
    setFeedbackBooking(null);
    showToast('We will remind you in 24 hours!');
  };

  const handleFeedbackSkip = () => {
    if (!feedbackBooking) return;
    const trackingKey = `elite_suppress_${feedbackBooking.id}`;
    localStorage.setItem(trackingKey, JSON.stringify({ skipCount: 99, lastReminderTime: Date.now() }));
    setShowFeedbackModal(false);
    setFeedbackBooking(null);
    showToast('Feedback skipped.');
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackComment.trim()) {
      showToast('Please provide a comment.', 'error');
      return;
    }
    try {
      const res = await fetch(`${API}/api/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userToken ? { 'Authorization': `Bearer ${userToken}` } : {})
        },
        body: JSON.stringify({
          bookingId: feedbackBooking.id,
          productId: feedbackBooking.items?.[0]?.id,
          customerName: userProfile?.name || 'Customer',
          rating: feedbackProductRating,
          deliveryRating: feedbackDeliveryRating,
          comment: feedbackComment
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackSuccess(true);
        localStorage.removeItem(`elite_suppress_${feedbackBooking.id}`);
        setTimeout(() => {
          setShowFeedbackModal(false);
          setFeedbackBooking(null);
          setFeedbackSuccess(false);
          fetchReviews();
          fetchUserBookings(userToken);
        }, 2200);
      } else {
        showToast(data.message || 'Failed to submit feedback.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error.', 'error');
    }
  };

  // Check for delivered bookings to prompt feedback (disabled per request to only show reviews via mailbox)
  useEffect(() => {
    // Disabled auto-popup reviews modal on dashboard
  }, []);

  // Live clock ticker
  useEffect(() => {
    const clockInterval = setInterval(() => setNavClock(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Stars helper
  const renderStars = (rating) => {
    return (
      <div style={{ display: 'inline-flex', gap: '2px', color: 'var(--accent-cyan)' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star 
            key={star} 
            size={14} 
            fill={star <= rating ? 'var(--accent-cyan)' : 'none'} 
            strokeWidth={1.5}
          />
        ))}
      </div>
    );
  };

  // Push state on view changes if it doesn't match current state
  useEffect(() => {
    if (window.history.state?.view !== view) {
      window.history.pushState({ view }, '', '');
    }
  }, [view]);

  // Intercept back button
  useEffect(() => {
    const handlePopState = (event) => {
      const targetView = event.state?.view || 'home';
      const importantViews = ['checkout', 'admin', 'client-dashboard', 'details'];
      
      if (importantViews.includes(view)) {
        // Re-push current state to lock navigation
        window.history.pushState({ view }, '', '');
        setBackTargetView(targetView);
        setShowBackConfirm(true);
      } else {
        setView(targetView);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [view]);

  const fetchUserBookings = async (token) => {
    try {
      const res = await fetch(`${API}/api/my-bookings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUserBookings(data);
      }
    } catch (err) {
      console.error('Error fetching user bookings:', err);
    }
  };

  const refreshBookingStatus = async (bookingId) => {
    if (!userToken) return;
    try {
      const res = await fetch(`${API}/api/my-bookings`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUserBookings(data);
        const updated = data.find(b => b.id === bookingId);
        if (updated) {
          setCreatedBooking(updated);
          showToast('Booking status refreshed successfully!');
        }
      }
    } catch (err) {
      console.error('Error refreshing booking status:', err);
    }
  };

  const fetchMyEmails = async (token) => {
    try {
      const res = await fetch(`${API}/api/my-emails`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyEmails(data);
      }
    } catch (err) {
      console.error('Error fetching my emails:', err);
    }
  };

  const fetchAdminCoupons = async () => {
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/coupons`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminCoupons(data);
      }
    } catch (err) {
      console.error('Error fetching coupons:', err);
    }
  };

  const fetchAdminEmails = async () => {
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/emails`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminEmails(data);
      }
    } catch (err) {
      console.error('Error fetching admin emails:', err);
    }
  };

  const fetchAdminVerificationLogs = async () => {
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/admin/verification-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminVerificationLogs(data);
      }
    } catch (err) {
      console.error('Error fetching admin verification logs:', err);
    }
  };

  const fetchAdminVerifiedUsers = async () => {
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/admin/verified-users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setAdminVerifiedUsers(data.users);
      }
    } catch (err) {
      console.error('Error fetching verified users:', err);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) {
      setCouponMessage('Please enter a coupon code.');
      return;
    }
    try {
      const res = await fetch(`${API}/api/coupons/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCodeInput, email: customerEmail || userProfile?.email || 'customer@elite.com' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppliedCoupon(data.coupon);
        setCouponMessage(`Coupon ${data.coupon.code} applied! ${data.coupon.description}`);
        showToast(`Coupon ${data.coupon.code} applied!`);
      } else {
        setCouponMessage(data.message || 'Failed to apply coupon.');
      }
    } catch (err) {
      console.error(err);
      setCouponMessage('Error connecting to coupons system.');
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      showToast('Please enter your email.');
      return;
    }
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setForgotToken(data.token);
        setForgotStep(2);
        showToast('Verification code sent! See Simulated Inbox.');
      } else {
        showToast(data.message || 'Error processing request.');
      }
    } catch (err) {
      console.error(err);
      showToast('Server connection failed.');
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!forgotCode.trim() || !forgotPassword.trim()) {
      showToast('Please fill out all fields.');
      return;
    }
    if (forgotPassword !== forgotPasswordConfirm) {
      showToast('Passwords do not match.');
      return;
    }
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: forgotCode, password: forgotPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Password reset successfully! Please login.');
        setShowForgotFlow(false);
        setForgotStep(1);
        setForgotEmail('');
        setForgotCode('');
        setForgotPassword('');
        setForgotPasswordConfirm('');
      } else {
        showToast(data.message || 'Failed to reset password.');
      }
    } catch (err) {
      console.error(err);
      showToast('Server connection failed.');
    }
  };

  const handleAddCoupon = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/coupons`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(adminNewCoupon)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Coupon ${adminNewCoupon.code} added!`);
        fetchAdminCoupons();
        setAdminNewCoupon({ code: '', discountType: 'percent', value: '', minOrders: '0', description: '' });
      } else {
        showToast(data.message || 'Error adding coupon.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCoupon = async (code) => {
    if (!confirm(`Are you sure you want to delete coupon ${code}?`)) return;
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/coupons/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Coupon deleted.');
        fetchAdminCoupons();
      } else {
        showToast('Failed to delete coupon.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isUserLoggedIn && userToken) {
      fetchUserBookings(userToken);
      fetchMyEmails(userToken);
    }
  }, [isUserLoggedIn, userToken]);

  // Refetch bookings when entering client dashboard to prevent stale data
  useEffect(() => {
    if (view === 'client-dashboard' && isUserLoggedIn && userToken) {
      fetchUserBookings(userToken);
    }
  }, [view, isUserLoggedIn, userToken]);

  const handleUserLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.role === 'admin') {
          setIsAdminLoggedIn(true);
          localStorage.setItem('eliteAdminToken', data.token);
          showToast('Welcome back, Admin!');
          setView('admin');
          setLoginEmail('');
          setLoginPassword('');
          return;
        }

        setIsUserLoggedIn(true);
        setUserToken(data.token);
        setUserProfile(data.user);
        localStorage.setItem('eliteUserToken', data.token);
        localStorage.setItem('eliteUserProfile', JSON.stringify(data.user));
        
        // Auto fill checkout details if user logs in during checkout
        setCustomerName(data.user.name);
        setCustomerEmail(data.user.email);
        
        showToast(`Welcome back, ${data.user.name}!`);
        if (redirectAfterLogin === 'checkout') {
          setView('checkout');
          setCheckoutStep(1);
          setRedirectAfterLogin(null);
        } else {
          setView('home');
        }
        setLoginEmail('');
        setLoginPassword('');
      } else if (res.status === 403) {
        showToast('Please verify your account first.', 'error');
        setSignupEmail(loginEmail);
        setSignupStep(3);
        setView('signup');
      } else {
        showToast(data.message || 'Login failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error during login.', 'error');
    }
  };




  const handleUserSignup = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: signupName, email: signupEmail, password: signupPassword, phone: signupPhone })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserToken(data.token);
        setUserProfile(data.user);
        setIsUserLoggedIn(true);
        localStorage.setItem('eliteUserToken', data.token);
        localStorage.setItem('eliteUserProfile', JSON.stringify(data.user));
        showToast('Account created successfully!');
        
        // Take them to profile form directly in Edit Mode
        setView('client-dashboard');
        setClientTab('profile');
        setIsEditingProfile(true);

        // Reset signup fields
        setSignupName('');
        setSignupEmail('');
        setSignupPassword('');
        setSignupPhone('');
        setSignupStep(1);
      } else {
        showToast(data.message || 'Signup failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error during signup.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendFirebaseSmsOtp = async (phoneNumber) => {
    // Ensure recaptcha-container element exists in DOM
    let recaptchaContainer = document.getElementById('recaptcha-container');
    if (!recaptchaContainer) {
      recaptchaContainer = document.createElement('div');
      recaptchaContainer.id = 'recaptcha-container';
      document.body.appendChild(recaptchaContainer);
    }

    const res = await sendPhoneOTP(phoneNumber);
    if (res.success) {
      setFirebaseConfirmationResult(res.confirmationResult);
      showToast(`SMS OTP sent successfully via Firebase!`);
      return true;
    } else {
      console.error('Firebase SMS send error:', res.error);
      showToast(`Firebase SMS failed: ${res.error}`, 'error');
      return false;
    }
  };

  const handleVerifyEmailOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length < 6) {
      showToast('Please enter a 6-digit OTP code.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupSessionId, otp })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOtpDigits(['', '', '', '', '', '']);
        setDevOtpHint('');
        setTimer(300); // Restart 5 min timer for mobile OTP
        
        if (isFirebaseConfigured) {
          showToast('Email verified successfully! Sending Mobile SMS via Firebase...');
          const sent = await sendFirebaseSmsOtp(signupPhone);
          if (!sent) {
            // If Firebase sending failed (due to billing/config), fall back to showing dev mode OTP hint
            if (data.devMode && data.devSmsOtp) {
              setDevOtpHint(data.devSmsOtp);
              showToast(`⚠️ Firebase SMS failed. Please check the yellow banner for Simulated SMS OTP!`);
            }
          }
        } else {
          if (data.devMode && data.devSmsOtp) {
            // Dev mode — show hint only
            setDevOtpHint(data.devSmsOtp);
            showToast(`⚠️ Dev Mode: Please check the yellow banner for your SMS OTP!`);
          } else {
            showToast('Email verified! SMS OTP sent to your phone.');
          }
        }
        setSignupStep(3); // Go to Mobile verification
      } else {
        showToast(data.message || 'Email verification failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error during email verification.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyMobileOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length < 6) {
      showToast('Please enter a 6-digit OTP code.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isFirebaseConfigured && firebaseConfirmationResult) {
        // Verify code using Firebase
        const result = await firebaseConfirmationResult.confirm(otp);
        // If successful, tell our backend to complete signup (bypassing backend Twilio verification)
        const res = await fetch(`${API}/api/auth/verify-mobile-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signupSessionId, otp: 'FIREBASE_VERIFIED' })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setUserToken(data.token);
          setUserProfile(data.user);
          setIsUserLoggedIn(true);
          localStorage.setItem('eliteUserToken', data.token);
          localStorage.setItem('eliteUserProfile', JSON.stringify(data.user));
          showToast('Account created & logged in successfully via Firebase!');
          setSignupStep(4);
        } else {
          showToast(data.message || 'Registration failed in backend.', 'error');
        }
      } else {
        // Fallback to normal backend verification (dev mode / Twilio)
        const res = await fetch(`${API}/api/auth/verify-mobile-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signupSessionId, otp })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setUserToken(data.token);
          setUserProfile(data.user);
          setIsUserLoggedIn(true);
          localStorage.setItem('eliteUserToken', data.token);
          localStorage.setItem('eliteUserProfile', JSON.stringify(data.user));
          showToast('Account created & logged in successfully!');
          setSignupStep(4);
        } else {
          showToast(data.message || 'Mobile verification failed.', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Mobile verification failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (timer > 270) {
      showToast('Please wait 30 seconds before requesting a new code.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/resend-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signupSessionId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('A new verification code has been sent to your email.');
        setOtpDigits(['', '', '', '', '', '']);
        setTimer(300); // Reset timer to 5 minutes
      } else {
        showToast(data.message || 'Failed to resend code.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error while resending OTP.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendMobileOtp = async () => {
    if (timer > 270) {
      showToast('Please wait 30 seconds before requesting a new code.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isFirebaseConfigured) {
        const sent = await sendFirebaseSmsOtp(signupPhone);
        if (sent) {
          setOtpDigits(['', '', '', '', '', '']);
          setTimer(300);
        }
      } else {
        const res = await fetch(`${API}/api/auth/resend-mobile-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signupSessionId })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('A new verification code has been sent via SMS.');
          setOtpDigits(['', '', '', '', '', '']);
          setTimer(300);
        } else {
          showToast(data.message || 'Failed to resend code.', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Network error while resending SMS OTP.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Effect to auto-submit when all 6 digits are entered
  useEffect(() => {
    const isFull = otpDigits.every(d => d !== '');
    if (isFull) {
      if (signupStep === 2) {
        handleVerifyEmailOtp();
      } else if (signupStep === 3) {
        handleVerifyMobileOtp();
      }
    }
  }, [otpDigits]);

  const handleProtectedDrawerClick = (tabName) => {
    if (!isUserLoggedIn) {
      showToast('Please sign in first to access your dashboard.', 'error');
      setView('login');
      setMenuOpen(false);
      return;
    }
    setView('client-dashboard');
    setClientTab(tabName);
    setMenuOpen(false);
  };

  const handleUserLogout = () => {
    setIsUserLoggedIn(false);
    setUserToken('');
    setUserProfile(null);
    setUserBookings([]);
    localStorage.removeItem('eliteUserToken');
    localStorage.removeItem('eliteUserProfile');
    showToast('Logged out successfully.');
    setView('home');
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    // Validations: All fields must be filled and mandatory
    if (!profileName || !profileName.trim()) { showToast('Name is mandatory.', 'error'); return; }
    if (!profilePhone || !profilePhone.trim()) { showToast('Phone Number is mandatory.', 'error'); return; }
    if (profilePhone.replace(/\D/g, '').slice(-10).length !== 10) {
      showToast('Phone Number must be a valid 10-digit number.', 'error');
      return;
    }
    if (profileGender === 'Prefer not to say') { showToast('Please select your Gender (Male or Female).', 'error'); return; }
    if (!profileBirthday || profileBirthday === 'Not set' || !profileBirthday.trim()) { showToast('Birthday is mandatory.', 'error'); return; }
    
    // Age check: must be at least 18
    const birthDate = parseBirthdayDate(profileBirthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      showToast('You must be at least 18 years old to register/rent.', 'error');
      return;
    }
    if (!profileLanguage || profileLanguage === 'Not set' || !profileLanguage.trim()) { showToast('Language is mandatory.', 'error'); return; }
    if (!profileHomeAddress || profileHomeAddress === 'Not set' || !profileHomeAddress.trim()) { showToast('Home Address is mandatory.', 'error'); return; }
    if (!profileWorkAddress || profileWorkAddress === 'Not set' || !profileWorkAddress.trim()) { showToast('Work Address is mandatory.', 'error'); return; }
    if (!profileAadhaarNumber || !profileAadhaarNumber.trim()) { showToast('Aadhaar Number is mandatory.', 'error'); return; }
    if (!/^\d{12}$/.test(profileAadhaarNumber.replace(/\s/g, ''))) { showToast('Aadhaar Number must be a 12-digit number.', 'error'); return; }
    if (!profileAlternatePhone || !profileAlternatePhone.trim()) { showToast('Alternate Phone Number is mandatory.', 'error'); return; }
    if (profileAlternatePhone.replace(/\D/g, '').slice(-10).length !== 10) {
      showToast('Alternate Phone Number must be a valid 10-digit number.', 'error');
      return;
    }
    if (!profileCity || !profileCity.trim()) { showToast('City is mandatory.', 'error'); return; }
    if (!profileState || !profileState.trim()) { showToast('State is mandatory.', 'error'); return; }
    if (!profileZipCode || !profileZipCode.trim()) { showToast('Zip Code is mandatory.', 'error'); return; }
    if (!profileCompanyName || !profileCompanyName.trim()) { showToast('Company Name is mandatory.', 'error'); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/update-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone,
          gender: profileGender,
          birthday: profileBirthday,
          language: profileLanguage,
          homeAddress: profileHomeAddress,
          workAddress: profileWorkAddress,
          aadhaarNumber: profileAadhaarNumber,
          alternatePhone: profileAlternatePhone,
          city: profileCity,
          state: profileState,
          zipCode: profileZipCode,
          companyName: profileCompanyName
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserProfile(data.user);
        localStorage.setItem('eliteUserProfile', JSON.stringify(data.user));
        showToast('Profile updated successfully!');
        setIsEditingProfile(false);
        setClientTab('bookings'); // Take user to dashboard bookings history
      } else {
        showToast(data.message || 'Profile update failed.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error during profile update.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPasswordVal !== confirmNewPasswordVal) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          currentPassword: currPassword,
          newPassword: newPasswordVal
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Password changed successfully.');
        setCurrPassword('');
        setNewPasswordVal('');
        setConfirmNewPasswordVal('');
      } else {
        showToast(data.message || 'Failed to change password.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error while changing password.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchProducts = async () => {
    try {
      let url = `${API}/api/products`;
      const params = [];
      if (activeCategory !== 'All') params.push(`category=${encodeURIComponent(activeCategory)}`);
      if (searchQuery) params.push(`search=${encodeURIComponent(searchQuery)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await fetch(url);
      if (!res.ok) {
        console.error('Products fetch failed with status:', res.status);
        showToast('Failed to load products. Retrying...', 'error');
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      } else if (data && Array.isArray(data.products)) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      showToast('Could not connect to server. Please refresh.', 'error');
    }
  };

  // Fetch Products on Mount and category change
  useEffect(() => {
    fetchProducts();
  }, [activeCategory]);

  // Trigger search on typing
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Admin Booking Filtering & Exporting Helpers
  const getFilteredAndSortedBookings = () => {
    return adminBookings
      .filter((b) => {
        const dateObj = b.createdAt ? new Date(b.createdAt) : (b.items[0]?.startDate ? new Date(b.items[0].startDate) : null);
        if (!dateObj || isNaN(dateObj.getTime())) return true;

        if (adminBookingFilterYear !== 'All') {
          if (dateObj.getFullYear().toString() !== adminBookingFilterYear) {
            return false;
          }
        }

        if (adminBookingFilterMonth !== 'All') {
          const monthIndex = dateObj.getMonth();
          const monthsMap = {
            '0': 'January', '1': 'February', '2': 'March', '3': 'April',
            '4': 'May', '5': 'June', '6': 'July', '7': 'August',
            '8': 'September', '9': 'October', '10': 'November', '11': 'December'
          };
          if (monthsMap[monthIndex] !== adminBookingFilterMonth) {
            return false;
          }
        }

        if (adminBookingFilterDate) {
          const dateStr = dateObj.toISOString().split('T')[0];
          if (dateStr !== adminBookingFilterDate) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : (a.items[0]?.startDate ? new Date(a.items[0].startDate) : new Date(0));
        const dateB = b.createdAt ? new Date(b.createdAt) : (b.items[0]?.startDate ? new Date(b.items[0].startDate) : new Date(0));

        if (adminBookingSortBy === 'newest') {
          return dateB.getTime() - dateA.getTime();
        } else if (adminBookingSortBy === 'oldest') {
          return dateA.getTime() - dateB.getTime();
        } else if (adminBookingSortBy === 'amount-high') {
          return b.totalAmount - a.totalAmount;
        } else if (adminBookingSortBy === 'amount-low') {
          return a.totalAmount - b.totalAmount;
        }
        return 0;
      });
  };

  const getAdminBookingYears = () => {
    const years = new Set();
    adminBookings.forEach((b) => {
      const dateObj = b.createdAt ? new Date(b.createdAt) : (b.items[0]?.startDate ? new Date(b.items[0].startDate) : null);
      if (dateObj && !isNaN(dateObj.getTime())) {
        years.add(dateObj.getFullYear().toString());
      }
    });
    if (years.size === 0) {
      years.add(new Date().getFullYear().toString());
    }
    return Array.from(years).sort().reverse();
  };

  const exportBookingsToCSV = (filteredBookings) => {
    if (filteredBookings.length === 0) {
      showToast('No records to export.', 'error');
      return;
    }
    const headers = [
      'Booking ID',
      'Customer Name',
      'Phone',
      'Email',
      'Address',
      'Rental Items',
      'Plan Label',
      'Start Date',
      'End Date',
      'Delivery Slot',
      'Total Cost (INR)',
      'Payment Method',
      'Status',
      'Booking Date'
    ];

    const rows = filteredBookings.map((b) => {
      const itemsStr = b.items.map(item => `${item.name} (${item.quantity}x)`).join('; ');
      const planStr = b.items[0]?.planLabel || '';
      const startStr = b.items[0]?.startDate ? ` ${b.items[0].startDate}` : '';
      const endStr = b.items[0]?.endDate ? ` ${b.items[0].endDate}` : '';
      
      let createdStr = '';
      if (b.createdAt) {
        const d = new Date(b.createdAt);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          createdStr = ` ${yyyy}-${mm}-${dd} ${hh}:${min}`;
        }
      }

      return [
        b.id,
        b.customerName,
        b.phone,
        b.email,
        `"${(b.address || '').replace(/"/g, '""')}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
        planStr,
        startStr,
        endStr,
        b.deliverySlot,
        b.totalAmount.toFixed(2),
        b.paymentMethod,
        b.status,
        createdStr
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Elite_Bookings_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV report downloaded successfully!');
  };

  const exportBookingsToPDF = (filteredBookings) => {
    if (filteredBookings.length === 0) {
      showToast('No records to export.', 'error');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      showToast('Popup blocked! Please allow popups to export PDF.', 'error');
      return;
    }

    const todayStr = new Date().toLocaleDateString();
    const filterInfo = `Year: ${adminBookingFilterYear} | Month: ${adminBookingFilterMonth} | Date: ${adminBookingFilterDate || 'All'}`;
    const totalAmount = filteredBookings.reduce((sum, b) => sum + b.totalAmount, 0);

    let tableRows = '';
    filteredBookings.forEach((b) => {
      const itemsStr = b.items.map(item => `${item.name} (${item.quantity}x)`).join('<br/>');
      const startStr = b.items[0]?.startDate || '';
      const endStr = b.items[0]?.endDate || '';
      const createdStr = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '';

      tableRows += `
        <tr>
          <td><strong>${b.id}</strong></td>
          <td>
            <strong>${b.customerName}</strong><br/>
            <span style="font-size: 10px; color: #555;">${b.phone}</span><br/>
            <span style="font-size: 9px; color: #777;">${b.address || ''}</span>
          </td>
          <td style="font-size: 11px;">${itemsStr}</td>
          <td style="font-size: 11px;">
            ${b.items[0]?.planLabel || ''}<br/>
            <span style="font-size: 10px; color: #555;">${startStr} to ${endStr}</span>
          </td>
          <td>₹${b.totalAmount.toFixed(2)}</td>
          <td>${b.paymentMethod}</td>
          <td><span class="status-badge status-${b.status.toLowerCase().replace(/\s+/g, '-')}">${b.status}</span></td>
          <td style="font-size: 10px;">${createdStr}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <html>
        <head>
          <title>Elite PS Rentals - Bookings Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #333;
              padding: 20px;
              margin: 0;
            }
            .header {
              border-bottom: 2px solid #00e5ff;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            .header-title {
              font-size: 24px;
              font-weight: bold;
              color: #111827;
              margin: 0;
            }
            .header-subtitle {
              font-size: 12px;
              color: #666;
              margin: 4px 0 0 0;
            }
            .summary-cards {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
            }
            .summary-card {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 12px 16px;
              background-color: #f9fafb;
            }
            .summary-card-title {
              font-size: 11px;
              color: #6b7280;
              text-transform: uppercase;
              font-weight: bold;
            }
            .summary-card-value {
              font-size: 20px;
              font-weight: bold;
              color: #111827;
              margin-top: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 8px 12px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background-color: #f3f4f6;
              font-weight: bold;
              font-size: 12px;
              color: #374151;
            }
            td {
              font-size: 11.5px;
            }
            .status-badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: bold;
            }
            .status-booked { background-color: #dbeafe; color: #1e40af; }
            .status-ordered { background-color: #fef3c7; color: #92400e; }
            .status-confirmed { background-color: #e0f2fe; color: #0369a1; }
            .status-cancelled { background-color: #fee2e2; color: #991b1b; }
            .status-completed { background-color: #d1fae5; color: #065f46; }
            .status-active { background-color: #dcfce7; color: #166534; }
            .status-approved { background-color: #dcfce7; color: #166534; }
            .status-out-for-delivery { background-color: #ffedd5; color: #9a3412; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <h1 class="header-title">Elite PS Rentals</h1>
                <p class="header-subtitle">Bookings & Rental Operations Report</p>
              </div>
              <div style="text-align: right; font-size: 12px; color: #555;">
                <strong>Date:</strong> ${todayStr}<br/>
                <strong>Filters:</strong> ${filterInfo}
              </div>
            </div>
          </div>

          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-card-title">Total Bookings</div>
              <div class="summary-card-value">${filteredBookings.length}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-title">Total Estimated Value</div>
              <div class="summary-card-value">₹${totalAmount.toFixed(2)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%;">Booking ID</th>
                <th style="width: 25%;">Customer Details</th>
                <th style="width: 20%;">Rental Items</th>
                <th style="width: 18%;">Rental Period</th>
                <th style="width: 10%;">Amount</th>
                <th style="width: 5%;">Pay</th>
                <th style="width: 10%;">Status</th>
                <th style="width: 10%;">Booked Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div style="margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 8px; text-align: center; font-size: 10px; color: #999;">
            Elite PS Rentals Operations System - Confirms print log.
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showToast('Print preview generated. Save as PDF or print report.');
  };

  // Load Admin Data
  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/bookings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setAdminBookings(data);
      } else {
        showToast(data.message || 'Failed to fetch admin bookings.');
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn) {
      fetchAdminData();
      fetchAdminCoupons();
      fetchAdminEmails();
      fetchAdminVerificationLogs();
      fetchAdminVerifiedUsers();
    }
  }, [isAdminLoggedIn]);

  // Date Setup on Selecting a Product
  useEffect(() => {
    if (selectedProduct) {
      const today = new Date();
      const format = (d) => d.toISOString().split('T')[0];
      setStartDate(format(today));
      
      const plan = selectedProduct.pricePlans[selectedPlanIndex];
      const end = new Date(today);
      end.setDate(today.getDate() + plan.days);
      setEndDate(format(end));
    }
  }, [selectedProduct, selectedPlanIndex]);

  // Handle plan select
  const selectPlan = (index) => {
    setSelectedPlanIndex(index);
    if (selectedProduct) {
      const plan = selectedProduct.pricePlans[index];
      const start = new Date(startDate || new Date());
      const end = new Date(start);
      end.setDate(start.getDate() + plan.days);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  // Handle start date shift
  const handleStartDateChange = (val) => {
    setStartDate(val);
    if (selectedProduct) {
      const plan = selectedProduct.pricePlans[selectedPlanIndex];
      const start = new Date(val);
      const end = new Date(start);
      end.setDate(start.getDate() + plan.days);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  // Interactive Simulator Price Calculator
  const calculateSimPrice = () => {
    let consoleRate = 0;
    let accessoriesRate = 0;
    
    if (simConsole === 'ps5') {
      if (simDuration === 1) consoleRate = 990;
      else if (simDuration === 3) consoleRate = 690 * 3;
      else if (simDuration === 7) consoleRate = 2990;
      else if (simDuration === 14) consoleRate = 4990;
    } else if (simConsole === 'vr2') {
      if (simDuration === 1) consoleRate = 1190;
      else if (simDuration === 3) consoleRate = 850 * 3;
      else if (simDuration === 7) consoleRate = 3490;
      else if (simDuration === 14) consoleRate = 5980;
    }
    
    if (simEdgeController) {
      if (simDuration === 1) accessoriesRate += 290;
      else if (simDuration === 3) accessoriesRate += 190 * 3;
      else if (simDuration === 7) accessoriesRate += 790;
      else if (simDuration === 14) accessoriesRate += 1300;
    }
    
    if (simSteering) {
      if (simDuration === 1) accessoriesRate += 590;
      else if (simDuration === 3) accessoriesRate += 420 * 3;
      else if (simDuration === 7) accessoriesRate += 1790;
      else if (simDuration === 14) accessoriesRate += 2980;
    }
    
    return consoleRate + accessoriesRate;
  };

  // Auto apply simulator vibes preset selection
  const applyVibePreset = (vibe) => {
    setActiveVibe(vibe);
    if (vibe === 'racer') {
      setSimConsole('ps5');
      setSimSteering(true);
      setSimEdgeController(false);
      setSimDuration(3);
    } else if (vibe === 'party') {
      setSimConsole('ps5');
      setSimSteering(false);
      setSimEdgeController(true);
      setSimDuration(1);
    } else if (vibe === 'vr') {
      setSimConsole('vr2');
      setSimSteering(false);
      setSimEdgeController(false);
      setSimDuration(7);
    } else if (vibe === 'solo') {
      setSimConsole('ps5');
      setSimSteering(false);
      setSimEdgeController(true);
      setSimDuration(14);
    }
    showToast(`Vibe configured: ${vibe.toUpperCase()}`);
  };

  // Rent custom simulator setup
  const handleRentCustomSetup = () => {
    if (!isUserLoggedIn) {
      showToast('Please sign in first to rent a setup.', 'error');
      setView('login');
      return;
    }
    if (simConsole === 'none' && !simEdgeController && !simSteering) {
      showToast('Please select at least one console or accessory.');
      return;
    }
    
    const items = [];
    if (simConsole === 'ps5') items.push("PlayStation 5 Console");
    if (simConsole === 'vr2') items.push("PlayStation VR2 Headset");
    if (simEdgeController) items.push("DualSense Edge Controller");
    if (simSteering) items.push("Logitech G29 Steering Wheel");
    
    const basePrice = calculateSimPrice();
    const today = new Date();
    const format = (d) => d.toISOString().split('T')[0];
    const start = format(today);
    const end = new Date(today);
    end.setDate(today.getDate() + simDuration);
    
    const customProduct = {
      id: "custom-bundle",
      name: `Custom Setup Package (${items.join(' + ')})`,
      category: "Custom",
      image: simConsole === 'vr2' ? "/images/vr2.png" : "/images/ps5.png",
      rating: 5.0,
      about: `Tailored next-gen package customized via configuration tool. Selected items: ${items.join(', ')}.`,
      included: items
    };
    
    const customPlan = {
      label: `${simDuration} Day${simDuration > 1 ? 's' : ''}`,
      rate: Math.round(basePrice / (simDuration === 7 ? 1.4 : simDuration === 14 ? 2.8 : 1)),
      period: simDuration >= 7 ? 'week' : 'day',
      days: simDuration
    };
    
    const customItem = {
      id: 'cart-' + Math.floor(100000 + Math.random() * 900000),
      product: customProduct,
      plan: customPlan,
      startDate: start,
      endDate: format(end),
      deliverySlot: "12:00 PM - 02:00 PM",
      basePrice: basePrice,
      deliveryCharge: 0,
      qty: 1
    };
    setCart(prev => [...prev, customItem]);
    
    // Reset Form
    setCheckoutStep(1);
    setUploadedSelfie(null);
    setUploadedID(null);
    setSignatureName('');
    setIsSigned(false);
    setUpiTxnId('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');

    setView('cart');
    window.scrollTo(0, 0);
    showToast('Custom setup added to cart!');
  };

  // Open Product Details
  const viewProductDetails = (product) => {
    setSelectedProduct(product);
    setSelectedPlanIndex(0);
    setView('details');
    window.scrollTo(0, 0);
  };

  // Add Item to Checkout Package
  const proceedToCheckout = () => {
    if (!startDate || !endDate) {
      showToast('Please pick valid rental dates.');
      return;
    }
    
    const plan = selectedProduct.pricePlans[selectedPlanIndex];
    const success = addToCart(selectedProduct, plan, startDate, endDate, deliverySlot);
    if (!success) return;

    // Reset Checkout Form
    setCheckoutStep(1);
    setUploadedSelfie(null);
    setUploadedID(null);
    setSignatureName('');
    setIsSigned(false);
    setUpiTxnId('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');

    setView('cart');
    window.scrollTo(0, 0);
  };

  // Auto apply coupon suggestions helper
  const autoApplyCouponCode = async (code) => {
    try {
      const res = await fetch(`${API}/api/coupons/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, email: customerEmail || userProfile?.email || 'customer@elite.com' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppliedCoupon(data.coupon);
        setCouponMessage(`Coupon ${data.coupon.code} automatically applied!`);
      }
    } catch (err) {
      console.error('Auto apply coupon failed:', err);
    }
  };

  // Trigger auto apply suggestions when cart changes
  useEffect(() => {
    if (cart.length > 0) {
      const email = customerEmail || userProfile?.email || '';
      if (isUserLoggedIn && userBookings) {
        const completedCount = userBookings.filter(b => b.status === 'Completed').length;
        if (completedCount >= 3) {
          autoApplyCouponCode('LOYAL10');
        } else if (userBookings.length === 0) {
          autoApplyCouponCode('FIRST10');
        } else {
          autoApplyCouponCode('ELITE100');
        }
      } else {
        autoApplyCouponCode('FIRST10');
      }
    }
  }, [cart.length, isUserLoggedIn]);

  // Blank Screen Fallback Navigation Guard
  useEffect(() => {
    if (view === 'details' && !selectedProduct) {
      setView('catalog');
    }
    if (view === 'checkout' && cart.length === 0 && checkoutStep < 4) {
      setView('catalog');
    }
  }, [view, selectedProduct, cart.length, checkoutStep]);

  // Apply Coupon / Share Credits calculation
  const getSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.basePrice * item.qty, 0);
  };

  const getTax = () => {
    return getSubtotal() * 0.18; // 18% GST
  };

  const getDiscountAmount = () => {
    let base = getSubtotal();
    let discount = 0;
    if (useCredits) {
      discount += 100;
    }
    if (appliedCoupon) {
      if (appliedCoupon.discountType === 'percent') {
        discount += (base * appliedCoupon.value) / 100;
      } else {
        discount += appliedCoupon.value;
      }
    }
    return discount;
  };

  // Dynamically load html2pdf.js and download the receipt element
  const handleDownloadReceipt = () => {
    const element = document.getElementById('invoice-print-area');
    if (!element) {
      showToast('Receipt area not found!', 'error');
      return;
    }

    const opt = {
      margin:       [0.3, 0.3, 0.3, 0.3],
      filename:     `ElitePS_Booking_Receipt_${createdBooking?.id || 'EPB'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#0a0d18',
        logging: false
      },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    const runHtml2Pdf = () => {
      window.html2pdf().from(element).set(opt).save()
        .then(() => showToast('Receipt downloaded successfully!'))
        .catch(err => {
          console.error(err);
          showToast('Could not download PDF. Try printing instead.', 'error');
        });
    };

    if (window.html2pdf) {
      runHtml2Pdf();
    } else {
      showToast('Preparing download...');
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = runHtml2Pdf;
      script.onerror = () => {
        showToast('Failed to load PDF engine. Please use standard Print.', 'error');
      };
      document.head.appendChild(script);
    }
  };

  const getTotalPrice = () => {
    let total = getSubtotal() + getTax() - getDiscountAmount();
    return Math.max(0, total);
  };

  // Trigger real backend booking placement upon identity verification success
  const triggerOrderPlacement = async () => {
    setIsSubmittingOrder(true);
    try {
      const orderBody = {
        customerName,
        phone: customerPhone,
        email: customerEmail,
        address: deliveryAddress,
        items: cart.map(item => ({
          id: item.product.id,
          name: item.product.name,
          quantity: item.qty,
          startDate: item.startDate,
          endDate: item.endDate,
          planLabel: item.plan.label,
          rate: item.plan.rate,
          period: item.plan.period
        })),
        deliverySlot: cart[0]?.deliverySlot || '10:00 AM - 12:00 PM',
        shareCreditsUsed: useCredits,
        discountAmount: getDiscountAmount(),
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        paymentMethod: paymentMethod,
        paymentDetails: {
          transactionId: upiTxnId || 'TXN-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          cardLast4: cardNumber ? cardNumber.slice(-4) : '',
          bank: paymentMethod === 'Netbanking' ? selectedBank : ''
        },
        totalAmount: getTotalPrice(),
        status: 'Booked', // Placed as Booked, pending manual admin verification
        selfie: uploadedSelfie?.image || null,
        identityID: uploadedID?.image || null,
        signature: signatureCanvasData || null,
        agreementAccepted: true
      };

      const headers = { 'Content-Type': 'application/json' };
      if (isUserLoggedIn && userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      const res = await fetch(`${API}/api/bookings`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(orderBody)
      });
      
      const responseData = await res.json();
      
      if (res.ok && responseData.success) {
        setCreatedBooking(responseData.booking);
        setCart([]); // Clear cart on success
        setAppliedCoupon(null);
        setCouponCodeInput('');
        setCouponMessage('');
        setCheckoutStep(4); // Success step
        showToast('Booking submitted successfully! Waiting for admin document verification.');
        if (isUserLoggedIn && userToken) {
          fetchUserBookings(userToken);
          fetchMyEmails(userToken);
        }
      } else {
        showToast(responseData.message || 'Error processing rental request.');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error, please try again.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Simulate automated refund & cancel when verification fails
  const triggerVerificationFailureRefund = () => {
    // Generate a mock failed booking object for Step 4 details screen
    const failedBookingMock = {
      id: 'REF-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      items: cart.map(item => ({
        name: item.product.name,
        planLabel: item.plan.label,
        startDate: item.startDate,
        endDate: item.endDate
      })),
      deliverySlot: cart[0]?.deliverySlot || '10:00 AM - 12:00 PM',
      totalAmount: getTotalPrice(),
      paymentMethod: paymentMethod,
      status: 'Cancelled',
      refundStatus: 'Processed & Refunded',
      refundDetails: {
        amount: getTotalPrice(),
        method: paymentMethod,
        date: new Date().toISOString()
      }
    };
    
    setCreatedBooking(failedBookingMock);
    setCart([]); // Clear cart
    
    // Call mock route or send fake notification
    showToast('Auto-refund processed successfully.');
    setCheckoutStep(4);
  };

  // Camera Scanner Functions
  const startScanner = async (mode) => {
    setScannerMode(mode);
    setIsScannerOpen(true);
    setScannerError('');
    const initialFacingMode = mode === 'selfie' ? 'user' : 'environment';
    setFacingMode(initialFacingMode);
    
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: initialFacingMode }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setScannerError("Could not access camera. Please allow camera permissions or upload a file instead.");
      }
    }, 300);
  };

  const switchCamera = async () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
    }
    const nextFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacingMode);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacingMode }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Failed to switch camera:", err);
      setScannerError("Failed to switch camera.");
    }
  };

  const stopScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScannerOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (facingMode === 'user') {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        const dataUrl = canvas.toDataURL('image/jpeg');
        if (scannerMode === 'selfie') {
          setUploadedSelfie({ name: 'captured_selfie.jpg', image: dataUrl });
          showToast('Selfie check captured successfully!', 'success');
        } else {
          setUploadedID({ name: 'captured_id.jpg', image: dataUrl });
          showToast('ID document captured successfully!', 'success');
        }
        stopScanner();
      }
    }
  };

  // Start AI Verification 3-second loader
  const handleStartAIVerification = (simulateSuccess = true) => {
    setIsVerifyingAI(true);
    setAiMatchProgress(0);
    setAiVerificationResult('none');
    
    const interval = setInterval(() => {
      setAiMatchProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsVerifyingAI(false);
          if (simulateSuccess) {
            setAiVerificationResult('success');
            triggerOrderPlacement();
          } else {
            setAiVerificationResult('failed');
            triggerVerificationFailureRefund();
          }
          return 100;
        }
        return prev + 20;
      });
    }, 600);
  };

  // Admin Actions
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdminLoggedIn(true);
        localStorage.setItem('eliteAdminToken', data.token);
        setAdminAuthError('');
        showToast('Admin dashboard logged in.');
      } else {
        setAdminAuthError(data.message || 'Access Denied.');
      }
    } catch (err) {
      console.error(err);
      setAdminAuthError('Server is currently offline.');
    }
  };

  const handleUpdateBookingStatus = async (id, newStatus) => {
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (res.ok) {
        showToast(`Booking ${id} status updated to ${newStatus}.`);
        fetchAdminData();
      } else {
        showToast('Failed to update status.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerifyDocuments = async (bookingId, status) => {
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/bookings/${bookingId}/verify`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ verificationStatus: status })
      });
      if (res.ok) {
        showToast(`Verification ${status === 'Approved' ? 'Approved' : 'Rejected'} for booking ${bookingId}`);
        fetchAdminData();
      } else {
        showToast('Failed to update verification status.');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error updating verification status.');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Are you sure you want to remove this product?')) return;
    try {
      const token = localStorage.getItem('eliteAdminToken');
      const res = await fetch(`${API}/api/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        showToast('Product deleted.');
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    
    // Compose plans
    const formattedPlans = [
      { label: "1 Day", rate: parseFloat(newProductForm.price1), period: "day", days: 1 },
      { label: "2 Days", rate: parseFloat(newProductForm.price2), period: "day", days: 2 },
      { label: "3 Days", rate: parseFloat(newProductForm.price3), period: "day", days: 3 },
      { label: "1 Week", rate: parseFloat(newProductForm.price7), period: "week", days: 7 },
      { label: "1 Month", rate: parseFloat(newProductForm.price30), period: "month", days: 30 }
    ];

    const body = {
      id: newProductForm.id.trim(),
      name: newProductForm.name.trim(),
      category: newProductForm.category,
      brand: newProductForm.brand.trim(),
      image: newProductForm.image.trim() || '/images/default.png',
      pricePlans: formattedPlans,
      stock: parseInt(newProductForm.stock),
      about: newProductForm.about.trim(),
      features: newProductForm.features.split('\n').filter(x => x.trim()),
      included: newProductForm.included.split('\n').filter(x => x.trim()),
      faqs: [
        { q: "Is security deposit required?", a: "No, Elite PS Rentals offers all gaming equipment with zero security deposit." },
        { q: "What documents are required?", a: "You need a government address ID (Aadhaar/Driving License) and a quick selfie check." }
      ]
    };

    try {
      const token = localStorage.getItem('eliteAdminToken');
      let res;
      if (editingProduct) {
        res = await fetch(`${API}/api/products/${editingProduct.id.trim()}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch(`${API}/api/products`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
      }

      if (res.ok) {
        showToast(editingProduct ? 'Product updated.' : 'Product added.');
        fetchProducts();
        setEditingProduct(null);
        setNewProductForm({
          id: '', name: '', category: 'Gaming Consoles', brand: '', 
          price1: 990, price2: 850, price3: 690, price7: 2990, price30: 9990,
          stock: 2, about: '', features: '', included: '', image: ''
        });
      } else {
        const errorData = await res.json();
        showToast(errorData.message || 'Error saving product.');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error.');
    }
  };

  const handleEditProductClick = (product) => {
    setEditingProduct(product);
    setNewProductForm({
      id: product.id,
      name: product.name,
      category: product.category,
      brand: product.brand || '',
      price1: product.pricePlans.find(p => p.label === "1 Day")?.rate || product.pricePlans[0]?.rate || 990,
      price2: product.pricePlans.find(p => p.label === "2 Days")?.rate || product.pricePlans[1]?.rate || 850,
      price3: product.pricePlans.find(p => p.label === "3 Days")?.rate || product.pricePlans[2]?.rate || 690,
      price7: product.pricePlans.find(p => p.label === "1 Week")?.rate || product.pricePlans[3]?.rate || 2990,
      price30: product.pricePlans.find(p => p.label === "1 Month")?.rate || product.pricePlans[4]?.rate || 9990,
      stock: product.stock,
      about: product.about || '',
      features: (product.features || []).join('\n'),
      included: (product.included || []).join('\n'),
      image: product.image || ''
    });
  };

  // Helper copy coupon text
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast(`Copied "${text}" to clipboard!`);
  };

  // Dynamic Metrics Calc
  const getMetrics = () => {
    const totalBookings = adminBookings.length;
    const completedOrders = adminBookings.filter(b => b.status === 'Completed' || b.status === 'Active' || b.status === 'Approved');
    const revenue = completedOrders.reduce((sum, b) => sum + b.totalAmount, 0);
    const activeRentals = adminBookings.filter(b => b.status === 'Active').length;
    const lowStock = products.filter(p => p.stock === 0).length;
    
    return { revenue, totalBookings, activeRentals, lowStock };
  };

  const GLOBAL_FAQS = [
    {
      q: "How do I rent without paying a security deposit?",
      a: "Just upload a quick photo (selfie) and a government ID (like Aadhaar card) during checkout. We verify it in 2 minutes so you don't have to pay any deposit money!"
    },
    {
      q: "Where do you deliver?",
      a: "We deliver directly to your home in Vasai, Virar, Nalasopara, and nearby areas. Our team will also set up the console and make sure it works."
    },
    {
      q: "Do I get games with the console?",
      a: "Yes! Consoles come pre-installed with popular games like FIFA/FC, GTA V, Spider-Man, and more. You can also ask us to add specific games when booking."
    },
    {
      q: "What happens in case of accidental damage?",
      a: "Don't worry about small scratches from normal use. But if the console falls down, gets wet, or is opened up, you will have to pay for the repair cost."
    },
    {
      q: "Can I keep the console for more days?",
      a: "Yes, of course! Just message us on WhatsApp at least 2 days before your rental ends, and we will extend it if it is available."
    }
  ];

  const handleGoogleLogin = async () => {
    const result = await googleLogin();
    if (result.success) {
      console.log(result.user);
      try {
        const res = await fetch(`${API}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: result.user.email,
            name: result.user.displayName,
            phone: result.user.phoneNumber || ''
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsUserLoggedIn(true);
          setUserToken(data.token);
          setUserProfile(data.user);
          localStorage.setItem('eliteUserToken', data.token);
          localStorage.setItem('eliteUserProfile', JSON.stringify(data.user));
          setCustomerName(data.user.name);
          setCustomerEmail(data.user.email);
          setMenuOpen(false);
          if (redirectAfterLogin === 'checkout') {
            setView('checkout');
            setCheckoutStep(1);
            setRedirectAfterLogin(null);
          } else {
            setView('home');
          }
        } else {
          showToast(data.message || 'Google Auth failed on backend.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Server connection failed during Google Login.', 'error');
      }
    } else {
      showToast(result.error, 'error');
    }
  };

  return (
    <div className="app-container">
      <div id="recaptcha-container"></div>
      
      {/* HAMBURGER DRAWER SYSTEM */}
      <div 
        className={`hamburger-drawer-overlay ${menuOpen ? 'open' : ''}`} 
        onClick={() => setMenuOpen(false)}
      />
      <div className={`hamburger-drawer ${menuOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-title" onClick={() => { setView('home'); setMenuOpen(false); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/images/logo.png" alt="Elite PS Rentals Logo" style={{ height: '28px', width: '28px', borderRadius: '4px', objectFit: 'cover' }} />
            <span>Elite PS Rentals</span>
          </div>
          <button 
            className="drawer-close-btn" 
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="drawer-links">
          {isAdminLoggedIn ? (
            <>
              <div 
                className={`drawer-link ${view === 'admin' && adminTab === 'bookings' ? 'active' : ''}`}
                onClick={() => { setView('admin'); setAdminTab('bookings'); setMenuOpen(false); }}
              >
                <span>Bookings ({adminBookings.length})</span>
              </div>
              <div 
                className={`drawer-link ${view === 'admin' && adminTab === 'products' ? 'active' : ''}`}
                onClick={() => { setView('admin'); setAdminTab('products'); setMenuOpen(false); }}
              >
                <span>Inventory Catalog</span>
              </div>
              <div 
                className={`drawer-link ${view === 'admin' && adminTab === 'coupons' ? 'active' : ''}`}
                onClick={() => { setView('admin'); setAdminTab('coupons'); setMenuOpen(false); }}
              >
                <span>Coupons Available ({adminCoupons.length})</span>
              </div>
              <div 
                className={`drawer-link ${view === 'admin' && adminTab === 'emails' ? 'active' : ''}`}
                onClick={() => { setView('admin'); setAdminTab('emails'); setMenuOpen(false); }}
              >
                <span>Email Logs ({adminEmails.length})</span>
              </div>
              <div 
                className={`drawer-link ${view === 'admin' && adminTab === 'metrics' ? 'active' : ''}`}
                onClick={() => { setView('admin'); setAdminTab('metrics'); setMenuOpen(false); }}
              >
                <span>Metrics Summary</span>
              </div>
              <div 
                className={`drawer-link ${view === 'admin' && adminTab === 'verification-logs' ? 'active' : ''}`}
                onClick={() => { setView('admin'); setAdminTab('verification-logs'); setMenuOpen(false); }}
              >
                <span>Verification Logs ({adminVerificationLogs.length})</span>
              </div>
              <div 
                className={`drawer-link ${view === 'admin' && adminTab === 'verifications' ? 'active' : ''}`}
                onClick={() => { setView('admin'); setAdminTab('verifications'); setMenuOpen(false); }}
              >
                <span>Pending Verifications ({adminBookings.filter(b => b.verificationStatus === 'Pending').length})</span>
              </div>
              <div 
                className={`drawer-link ${view === 'admin' && adminTab === 'reviews' ? 'active' : ''}`}
                onClick={() => { setView('admin'); setAdminTab('reviews'); setMenuOpen(false); }}
              >
                <span>Customer Reviews ({reviews.length})</span>
              </div>
              <div 
                className={`drawer-link ${view === 'admin' && adminTab === 'verified-accounts' ? 'active' : ''}`}
                onClick={() => { setView('admin'); setAdminTab('verified-accounts'); fetchAdminData(); setMenuOpen(false); }}
              >
                <span>Verified Docs & Bills ({adminBookings.filter(b => b.verificationStatus === 'Approved').length})</span>
              </div>
              <div 
                className={`drawer-link ${view === 'home' ? 'active' : ''}`}
                onClick={() => { setView('home'); setSelectedProduct(null); setMenuOpen(false); }}
              >
                <span>Go to Storefront</span>
              </div>
            </>
          ) : (
            <>
              <div 
                className={`drawer-link ${view === 'home' ? 'active' : ''}`}
                onClick={() => { setView('home'); setSelectedProduct(null); setMenuOpen(false); }}
              >
                <span>Home Showcase</span>
              </div>
              <div 
                className={`drawer-link ${view === 'catalog' ? 'active' : ''}`}
                onClick={() => { setView('catalog'); setSelectedProduct(null); setMenuOpen(false); }}
              >
                <span>Browse Catalog</span>
              </div>
              {isUserLoggedIn && (
                <>
                  <div 
                    className={`drawer-link ${view === 'client-dashboard' && clientTab === 'profile' ? 'active' : ''}`}
                    onClick={() => handleProtectedDrawerClick('profile')}
                  >
                    <span>Profile</span>
                  </div>
                  <div 
                    className={`drawer-link ${view === 'client-dashboard' && clientTab === 'coupons' ? 'active' : ''}`}
                    onClick={() => handleProtectedDrawerClick('coupons')}
                  >
                    <span>Coupons Available</span>
                  </div>
                  <div 
                    className={`drawer-link ${view === 'client-dashboard' && clientTab === 'bookings' ? 'active' : ''}`}
                    onClick={() => handleProtectedDrawerClick('bookings')}
                  >
                    <span>Order History</span>
                  </div>
                  <div 
                    className={`drawer-link ${view === 'client-dashboard' && clientTab === 'emails' ? 'active' : ''}`}
                    onClick={() => handleProtectedDrawerClick('emails')}
                  >
                    <span>Mailbox Notification</span>
                  </div>
                  <div 
                    className={`drawer-link ${view === 'client-dashboard' && clientTab === 'verified-docs' ? 'active' : ''}`}
                    onClick={() => handleProtectedDrawerClick('verified-docs')}
                  >
                    <span>Verified Docs & Bills ({userBookings.filter(b => b.verificationStatus === 'Approved').length})</span>
                  </div>
                </>
              )}
              <div 
                className={`drawer-link ${view === 'about' ? 'active' : ''}`}
                onClick={() => { setView('about'); setMenuOpen(false); }}
              >
                <span>About Us</span>
              </div>
              <div 
                className={`drawer-link ${view === 'why-us' ? 'active' : ''}`}
                onClick={() => { setView('why-us'); setMenuOpen(false); }}
              >
                <span>Why Rent Us</span>
              </div>
              <div 
                className={`drawer-link ${view === 'contact' ? 'active' : ''}`}
                onClick={() => { setView('contact'); setMenuOpen(false); }}
              >
                <span>Contact Us</span>
              </div>
            </>
          )}
        </div>
        
        <div className="drawer-footer">
          {isAdminLoggedIn ? (
            <button 
              className="drawer-link active" 
              onClick={() => { setView('admin'); setMenuOpen(false); }}
              style={{ justifyContent: 'center' }}
            >
              Admin Dashboard
            </button>
          ) : isUserLoggedIn ? (
            <button 
              className="drawer-link active" 
              onClick={() => { setView('client-dashboard'); setClientTab('profile'); setMenuOpen(false); }}
              style={{ justifyContent: 'center' }}
            >
              My Account
            </button>
          ) : (
            <>
              <button 
                className="btn-signin" 
                onClick={() => { setLoginEmail(''); setLoginPassword(''); setView('login'); setMenuOpen(false); }}
                style={{ width: '100%', textAlign: 'center', marginBottom: '10px' }}
              >
                Sign In / Sign Up
              </button>

              <button
                className="btn-signin"
                onClick={handleGoogleLogin}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  background: '#ffffff',
                  color: '#000',
                  border: '1px solid #ccc'
                }}
              >
                Sign In With Google
              </button>
            </>
          )}
        </div>
      </div>

      {/* TOAST SYSTEM */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-message ${t.type}`}>
            {t.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* FLOATING WHATSAPP BUTTON */}
      <a 
        href="https://wa.me/918180807208?text=Hello%20Elite%20PS%20Rentals!%20I%27m%20interested%20in%20renting%20gaming%20consoles%20and%20accessories.%20Can%20you%20help%20me%20with%20pricing%20and%20availability%3F"
        target="_blank"
        rel="noopener noreferrer" 
        className="whatsapp-floating-btn"
        aria-label="Contact us on WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.503-5.729-1.46L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.97C16.388 1.97 13.916.945 11.3.944 5.86.944 1.437 5.314 1.433 10.74c-.002 1.673.448 3.305 1.302 4.747L1.83 20.897l5.503-1.44c-1.562.895-2.81 1.393-3.84 1.83.003-.01.006-.015.01-.02.502-.218.78-.344.97-.428l.215-.09.302-.13z" />
          <path d="M15.937 13.116c-.223-.112-1.32-.65-1.524-.725-.203-.075-.352-.112-.5.112-.148.225-.575.725-.705.875-.13.15-.26.162-.482.05-.222-.113-.938-.346-1.787-1.1-.662-.59-1.11-1.32-1.24-1.545-.13-.225-.014-.347.098-.458.101-.1.223-.26.335-.39.112-.128.149-.22.223-.366.074-.148.037-.28-.018-.39-.056-.113-.5-1.205-.685-1.65-.18-.435-.363-.377-.5-.384-.13-.007-.28-.008-.43-.008-.15 0-.395.056-.603.28-.208.224-.793.774-.793 1.886 0 1.112.81 2.186.922 2.336.113.15 1.593 2.43 3.86 3.41.538.232.96.37 1.287.473.54.172 1.03.148 1.417.09.43-.064 1.32-.54 1.505-1.06.185-.523.185-.97.13-1.06-.056-.094-.204-.15-.426-.262z" fill="#fff" />
        </svg>
        <span className="whatsapp-badge">1</span>
      </a>

      {/* NAVIGATION BAR */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            className="hamburger-btn" 
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          
          <div className="nav-brand" onClick={() => { setView('home'); setSelectedProduct(null); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/images/logo.png" alt="Elite PS Rentals Logo" style={{ height: '32px', width: '32px', borderRadius: '4px', objectFit: 'cover' }} />
            <span>Elite PS Rentals</span>
          </div>
        </div>
        
        {(view === 'home' || view === 'catalog' || view === 'details') && (
          <div className="search-bar-container">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              placeholder='Rent "PlayStation 5" or "Steering Wheel"...'
              className="search-bar"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (view !== 'catalog') {
                  setView('catalog');
                }
              }}
            />
          </div>
        )}

        <div className="nav-actions">
          <div className="location-badge">
            <MapPin size={14} />
            <span>Vasai, Mumbai</span>
          </div>

          {isUserLoggedIn && !isAdminLoggedIn && (
            <button 
              className="cart-icon-btn" 
              onClick={() => setView('cart')}
            >
              <ShoppingCart size={20} />
              {cart.length > 0 && <span className="cart-badge">{cart.reduce((sum, item) => sum + item.qty, 0)}</span>}
            </button>
          )}


          {isAdminLoggedIn ? (
            <div className="user-profile-btn" onClick={() => setView('admin')}>
              <Activity size={14} />
              <span>Admin Portal</span>
            </div>
          ) : isUserLoggedIn ? (
            <div style={{ position: 'relative' }}>
              <div
                className="user-profile-btn"
                onClick={() => setProfileDropdownOpen(v => !v)}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <User size={14} />
                <span>{userProfile?.name || 'My Account'}</span>
                <ChevronDown size={12} style={{ marginLeft: '2px', opacity: 0.7, transform: profileDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
              </div>
              {profileDropdownOpen && (
                <div
                  style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 2000,
                    background: 'var(--bg-light-dark)', border: '1px solid var(--border)',
                    borderRadius: '10px', padding: '6px', minWidth: '160px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    animation: 'fadeInDown 0.15s ease'
                  }}
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <div
                    style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}
                  >
                    {userProfile?.email}
                  </div>
                  <button
                    onClick={() => { setView('client-dashboard'); setClientTab('bookings'); }}
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <ShoppingCart size={13} /> My Bookings
                  </button>
                  <button
                    onClick={() => { setView('client-dashboard'); setClientTab('profile'); }}
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <User size={13} /> Profile
                  </button>
                  <button
                    onClick={handleUserLogout}
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <LogOut size={13} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn-signin" onClick={() => { setLoginEmail(''); setLoginPassword(''); setView('login'); }}>
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* HOMEPAGE VIEW */}
      {view === 'home' && (
        <>
          {/* HERO GRID */}
          <div className="hero-grid">
            {/* Left Col - Showcase Card */}
            <div className="glass-panel hero-video-card" onClick={() => setShowPromoVideo(true)} style={{ cursor: 'pointer', overflow: 'hidden' }}>
              <iframe 
                src="https://www.youtube.com/embed/RkC0l4iekYo?autoplay=1&mute=1&loop=1&playlist=RkC0l4iekYo&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                title="Gaming Showcase Loop"
                style={{
                  width: '300%',
                  height: '100%',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  pointerEvents: 'none',
                  zIndex: 0,
                  borderRadius: '16px'
                }}
              />
              <div className="video-overlay-tint" style={{ zIndex: 1 }} />
              <div className="play-btn-circle" style={{ zIndex: 2 }}>
                <Play size={24} fill="#fff" />
              </div>
              <div className="video-card-content" style={{ zIndex: 2 }}>
                <h3 className="video-card-title">Ultimate Gaming Awaits</h3>
                <p className="video-card-subtitle">Zero Deposit console delivery</p>
              </div>
            </div>

            {/* Right Col - Unified Hero Banner */}
            <div className="glass-panel" style={{ 
              height: '480px', 
              position: 'relative', 
              overflow: 'hidden', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'flex-end', 
              padding: '40px',
              borderRadius: '16px',
              border: '1px solid var(--border)'
            }}>
              <img 
                src="/images/hero_main_banner.png" 
                alt="Elite Gaming Showcase Setup" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  zIndex: 0,
                  transition: 'transform 0.5s ease'
                }} 
              />
              <div 
                className="video-overlay-tint" 
                style={{ 
                  zIndex: 1, 
                  background: 'linear-gradient(180deg, rgba(6, 9, 19, 0.1) 0%, rgba(6, 9, 19, 0.85) 100%)',
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0
                }} 
              />
              
              <div style={{ zIndex: 2, position: 'relative', maxWidth: '640px' }}>
                <span style={{ 
                  background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))', 
                  color: 'var(--bg-darker)', 
                  borderRadius: '4px', 
                  padding: '4px 12px', 
                  fontSize: '11px', 
                  fontWeight: '800', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px', 
                  display: 'inline-block', 
                  marginBottom: '16px',
                  boxShadow: '0 4px 10px rgba(0, 229, 255, 0.2)'
                }}>
                  Premium Gaming Gear
                </span>
                <h1 style={{ 
                  fontFamily: 'var(--font-display)', 
                  fontSize: '42px', 
                  fontWeight: '800', 
                  lineHeight: '1.15', 
                  color: '#fff', 
                  marginBottom: '12px',
                  letterSpacing: '-0.5px'
                }}>
                  Gear Up With The <span style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Ultimate Setup</span>
                </h1>
                <p style={{ 
                  color: 'var(--text-secondary)', 
                  fontSize: '15px', 
                  lineHeight: '1.5', 
                  margin: 0,
                  fontWeight: '500'
                }}>
                  Rent next-generation PlayStation 5 consoles, immersive VR headsets, and professional racing simulation hardware. All with zero security deposit, doorstep setup, and delivery within 2 hours.
                </p>
              </div>
            </div>
          </div>

          {/* TOP CATEGORIES */}
          <div className="section-header">
            <h2 className="section-title">Top <span>Categories</span></h2>
            <p className="section-subtitle">Premium equipment matching your gaming session needs</p>
          </div>

          <div className="categories-slider-container" style={{ marginBottom: '40px' }}>
            <div className="categories-grid">
              {[
                { name: "PS5", desc: "Rent PS5 & PS4 Pro Consoles", image: "/images/ps5.png", brands: "SONY" },
                { name: "Controllers", desc: "DualSense Edge & Pads", image: "/images/edge_controller.png", brands: "SONY" },
                { name: "Steering", desc: "Logitech G29 Steering Wheels", image: "/images/g29.png", brands: "LOGITECH" },
                { name: "VR", desc: "PlayStation VR2 Headsets & 4K Tech", image: "/images/vr2.png", brands: "SONY · BENQ" }
              ].map((cat) => (
                <div 
                  key={cat.name} 
                  className={`glass-panel category-card ${activeCategory === cat.name ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategory(cat.name);
                    setView('catalog');
                    showToast(`Filtered: ${cat.name}`);
                  }}
                  style={activeCategory === cat.name ? { borderColor: 'var(--accent-cyan)', boxShadow: 'var(--shadow-neon)' } : {}}
                >
                  <img src={cat.image} alt={cat.name} />
                  <div className="category-card-bg" />
                  <div className="category-info">
                    <h3 className="category-name">{cat.name}</h3>
                    <p className="category-brands">{cat.brands}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '40px 0 60px 0' }}>
            <button 
              className="btn-signin" 
              onClick={() => setView('catalog')}
              style={{ padding: '16px 48px', fontSize: '16px', fontWeight: 'bold' }}
            >
              Browse Equipment Catalog
            </button>
          </div>

          {/* CUSTOMER REVIEWS / TESTIMONIALS */}
          {!isUserLoggedIn && reviews.length > 0 && (
            <>
              <div className="section-header" style={{ marginTop: '16px' }}>
                <h2 className="section-title">What Our <span>Renters Say</span></h2>
                <p className="section-subtitle">Real reviews from verified customers who rented our gaming gear</p>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
                gap: '20px', 
                marginBottom: '48px' 
              }}>
                {[...reviews]
                  .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || new Date(b.createdAt) - new Date(a.createdAt))
                  .slice(0, 6)
                  .map((rev) => (
                    <div 
                      key={rev.id} 
                      className="glass-panel" 
                      style={{ 
                        padding: '24px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '12px',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,229,255,0.12)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      {/* Quote icon */}
                      <div style={{ 
                        position: 'absolute', 
                        top: '12px', 
                        right: '16px', 
                        fontSize: '48px', 
                        color: 'rgba(0,229,255,0.08)', 
                        fontFamily: 'Georgia, serif', 
                        lineHeight: 1, 
                        pointerEvents: 'none' 
                      }}>
                        "
                      </div>

                      {/* Stars */}
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {renderStars(rev.rating)}
                      </div>

                      {/* Comment */}
                      <p style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '13.5px', 
                        lineHeight: '1.55', 
                        margin: 0,
                        minHeight: '40px',
                        fontStyle: 'italic'
                      }}>
                        "{rev.comment}"
                      </p>

                      {/* Reviewer info */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        borderTop: '1px solid var(--border)', 
                        paddingTop: '12px',
                        marginTop: 'auto'
                      }}>
                        <div>
                          <strong style={{ color: '#fff', fontSize: '13.5px' }}>{rev.customerName}</strong>
                          {rev.bookingId && (
                            <span className="status-pill approved" style={{ fontSize: '8.5px', padding: '2px 6px', marginLeft: '6px', display: 'inline-flex', alignItems: 'center' }}>
                              Verified Renter
                            </span>
                          )}
                          {rev.productName && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Rented: {rev.productName}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(rev.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}


          {/* WRITE A REVIEW SECTION */}
          {isUserLoggedIn && (
            <>
              <div className="section-header" style={{ marginTop: '40px' }}>
                <h2 className="section-title">Share Your <span>Experience</span></h2>
                <p className="section-subtitle">Only verified and logged in customers can rate our systems and services</p>
              </div>

              <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto 48px auto', padding: '32px' }}>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleReviewSubmit(formProduct || 'general');
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Select Product / Service</label>
                      <select
                        className="form-input"
                        value={formProduct}
                        onChange={(e) => setFormProduct(e.target.value)}
                        style={{ background: 'var(--bg-darker)', color: '#fff', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}
                      >
                        <option value="general">General Storefront & Service</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            🎮 {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Your Rating</label>
                      <div style={{ display: 'flex', gap: '6px', cursor: 'pointer', marginTop: '6px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={24}
                            onClick={() => setFormRating(star)}
                            style={{
                              color: star <= formRating ? 'var(--accent-cyan)' : 'var(--text-muted)',
                              fill: star <= formRating ? 'var(--accent-cyan)' : 'none',
                              transition: 'all 0.2s ease'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Your Display Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      placeholder="Enter your name"
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Write Your Review</label>
                    <textarea
                      className="form-input"
                      rows="4"
                      value={formComment}
                      onChange={(e) => setFormComment(e.target.value)}
                      required
                      placeholder="Tell us what you think of the console, delivery, or service..."
                      style={{ resize: 'vertical', minHeight: '100px' }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-signin"
                    disabled={isSubmittingForm}
                    style={{ width: '100%', padding: '14px', fontSize: '14px', fontWeight: 'bold' }}
                  >
                    {isSubmittingForm ? 'Submitting Your Review...' : '🚀 Submit Review & Rating'}
                  </button>
                </form>
              </div>
            </>
          )}

          <div style={{ height: '20px' }} />
        </>
      )}

      {/* CATALOG VIEW */}
      {view === 'catalog' && (
        <>
          <div className="section-header" style={{ marginTop: '24px' }}>
            <h2 className="section-title">Equipment <span>Catalog</span></h2>
            <p className="section-subtitle">Zero-deposit next-generation gaming systems and setups</p>
          </div>

          <div className="tabs-container">
            {['All', 'PS5', 'Controllers', 'Steering', 'VR'].map((cat) => (
              <button 
                key={cat} 
                className={`tab-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'All' ? 'Deals & All' : cat}
              </button>
            ))}
          </div>

          {searchQuery && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
              Showing search results for: <strong>"{searchQuery}"</strong>
            </div>
          )}

          {/* PRODUCTS GRID */}
          <div className="products-grid">
            {products.length === 0 ? (
              <div style={{ 
                gridColumn: '1/-1', 
                textAlign: 'center', 
                padding: '60px 20px', 
                background: 'var(--bg-card)', 
                borderRadius: '16px', 
                border: '1px solid var(--border)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px #0000005e'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#fff' }}>
                  Sorry, no gaming gear matches "{searchQuery}"
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '440px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
                  We do not have this equipment available currently. Try searching for "PS5", "VR2", "Controller", or "Steering Wheel".
                </p>
                <button 
                  className="btn-signin" 
                  onClick={() => setSearchQuery('')}
                  style={{ padding: '8px 24px', fontSize: '13px', display: 'inline-block' }}
                >
                  Clear Search
                </button>
              </div>
            ) : (
              products.map((p) => {
                const plan1 = p.pricePlans[0];
                return (
                  <div key={p.id} className="glass-panel product-card">
                    <div className="product-badge-row">
                      {p.isLastStock && p.stock > 0 && <span className="badge-stock">Last in stock</span>}
                      {p.stock === 0 && <span className="badge-waitlist">Out of stock</span>}
                      <span className="zero-deposit-text" style={{ fontSize: '10px' }}>
                        ★ {(() => {
                          const pReviews = reviews.filter(r => r.productId === p.id);
                          return pReviews.length > 0 ? getAvgRating(pReviews) : '0.0';
                        })()}
                      </span>
                    </div>

                    <div className="product-img-container">
                      <img src={p.image} alt={p.name} />
                    </div>

                    <div className="product-info-row">
                      <span>{p.brand}</span>
                      <span>Zero Deposit</span>
                    </div>

                    <h3 className="product-name">{p.name}</h3>

                    <div className="product-footer-row">
                      <div>
                        <div className="product-price-label">Starts at</div>
                        <div className="product-price">
                          ₹{plan1?.rate}<span>/{plan1?.period}</span>
                        </div>
                      </div>

                      {p.stock > 0 ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-rent-now" onClick={() => viewProductDetails(p)}>
                            Rent Now
                          </button>
                          <button 
                            className="btn-rent-now" 
                            style={{ padding: '8px 12px', background: 'rgba(0, 229, 255, 0.1)', color: 'var(--accent-cyan)', borderColor: 'var(--accent-cyan)' }}
                            title="Quick Add to Cart"
                            onClick={() => {
                              const defaultPlan = p.pricePlans[0];
                              const todayStr = new Date().toISOString().split('T')[0];
                              const end = new Date();
                              end.setDate(end.getDate() + defaultPlan.days);
                              const endStr = end.toISOString().split('T')[0];
                              addToCart(p, defaultPlan, todayStr, endStr, '10:00 AM - 12:00 PM');
                            }}
                          >
                            + Cart
                          </button>
                        </div>
                      ) : (
                        <button className="btn-waitlist" disabled>
                          Waitlist
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* WHY RENT WITH US (FEATURES) VIEW */}
      {view === 'why-us' && (
        <>
          <div className="section-header" style={{ marginTop: '24px' }}>
            <h2 className="section-title">Stay Relaxed. <span>While You Rent</span></h2>
            <p className="section-subtitle">Our commitment to providing a hassle-free premium setup</p>
          </div>

          <div className="features-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="glass-panel feature-item-card">
              <div className="feature-icon-wrapper">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="feature-text-title">Zero Security Deposit</h3>
                <p className="feature-text-desc">Starting out should not be hard. Elite PS Rentals offers next-gen gear with zero deposits. Verification takes less than 5 minutes online.</p>
              </div>
            </div>

            <div className="glass-panel feature-item-card">
              <div className="feature-icon-wrapper">
                <Smartphone size={24} />
              </div>
              <div>
                <h3 className="feature-text-title">Instant Support & Chat</h3>
                <p className="feature-text-desc">Got a "bro, help!" moment with game setup? Real operators in Vasai are available over WhatsApp and Call to resolve connection or gameplay issues instantly.</p>
              </div>
            </div>

            <div className="glass-panel feature-item-card">
              <div className="feature-icon-wrapper">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="feature-text-title">Fast 2-Hour Deliveries</h3>
                <p className="feature-text-desc">Forget logistics delays. Our team schedules delivery and pickup directly. Consoles are delivered and connected within 2-4 hours of confirmation.</p>
              </div>
            </div>

            <div className="glass-panel feature-item-card">
              <div className="feature-icon-wrapper">
                <Star size={24} />
              </div>
              <div>
                <h3 className="feature-text-title">7-Point Inspection</h3>
                <p className="feature-text-desc">Every piece of gear returned undergoes sanitation, performance testing, system updates, and wire checks so you receive devices in absolute brand-new state.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* FAQs VIEW */}
      {view === 'faqs' && (
        <>
          <div className="section-header" style={{ marginTop: '24px' }}>
            <h2 className="section-title">Help &amp; <span>FAQs</span></h2>
            <p className="section-subtitle">Got questions? We have simple answers!</p>
          </div>

          <div style={{ maxWidth: '800px', margin: '0 auto 48px auto' }}>
            <div className="faq-accordion">
              {GLOBAL_FAQS.map((faq, idx) => {
                const isOpen = activeFaq === idx;
                return (
                  <div key={idx} className="faq-item" style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '12px' }}>
                    <div className="faq-header" onClick={() => setActiveFaq(isOpen ? null : idx)} style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 24px', cursor: 'pointer' }}>
                      <span style={{ fontWeight: '600' }}>{faq.q}</span>
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                    {isOpen && (
                      <div className="faq-content" style={{ padding: '18px 24px', borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ABOUT US VIEW */}
      {view === 'about' && (
        <>
          <div className="section-header" style={{ marginTop: '24px' }}>
            <h2 className="section-title">About <span>Elite PS Rentals</span></h2>
            <p className="section-subtitle">Simplifying console rentals in Vasai West, Mumbai</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '48px' }}>
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '800', color: 'var(--accent-cyan)' }}>Our Mission</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14.5px' }}>
                Welcome to Elite PS Rentals! We make premium gaming accessible to everyone. Instead of buying an expensive console like a PS5, you can rent it from us for a few days or weeks at very affordable prices.
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14.5px' }}>
                We charge <strong>Zero Security Deposit</strong> and deliver the console directly to your doorstep. We sanitize every device and check it 7 times before delivering it, so you get a brand-new experience. Our team will install it at your home and show you how to play. If you face any issues, our local support team in Vasai is just a WhatsApp message away!
              </p>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '800', color: 'var(--accent-cyan)' }}>Standard Rental Terms</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {RENTAL_TERMS.map((term, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', fontSize: '13.5px', color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>•</span>
                    <span>{term}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* RENTAL AGREEMENT TERMS VIEW */}
      {view === 'agreement-terms' && (
        <>
          <div className="section-header" style={{ marginTop: '24px' }}>
            <h2 className="section-title">Rental Agreement <span>Terms & Conditions</span></h2>
            <p className="section-subtitle">Please read these rules and guidelines carefully before renting equipment.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '48px' }}>
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', color: 'var(--accent-cyan)' }}>1. Zero Security Deposit Policy</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14.5px' }}>
                We offer a zero security deposit rental model. However, this is strictly conditional upon successful completion of identity verification (KYC) and proof of address. If the KYC verification fails, the booking will be immediately cancelled, and any payments made will be refunded within 24 hours.
              </p>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', color: 'var(--accent-cyan)' }}>2. Device Safety & General Usage</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14.5px' }}>
                Renters must adhere to the following rules to ensure the safety and longevity of our premium hardware:
              </p>
              <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', lineHeight: '1.5' }}>
                <li>Consoles, headsets, and controllers are strictly for personal, indoor use in dust-free and well-ventilated rooms.</li>
                <li>Do not expose the hardware to extreme temperatures, direct sunlight, moisture, or liquid spills.</li>
                <li>Connect all consoles to a high-quality surge protector or UPS to protect against voltage fluctuations.</li>
                <li>Keep the equipment out of reach of pets and infants.</li>
              </ul>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', color: 'var(--accent-cyan)' }}>3. Damage Liability & Financial Responsibility</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14.5px' }}>
                The renter is solely responsible for the hardware from the moment of setup until it is returned and verified by our representative.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '8px' }}>
                <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px' }}>
                  <h4 style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>Physical/Liquid Damage</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
                    Any physical breakage, cracked housings, liquid infiltration, or accessory loss will be charged to the renter up to the full replacement cost of the hardware.
                  </p>
                </div>
                <div style={{ padding: '16px', background: 'rgba(52, 211, 153, 0.05)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '8px' }}>
                  <h4 style={{ color: 'var(--accent-green)', fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>Normal Wear & Tear</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
                    Minor cosmetic scuffs or internal software malfunctions not caused by misuse are covered by Elite PS Rentals and will not attract charges.
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', color: 'var(--accent-cyan)' }}>4. Booking Extensions & Return Policy</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14.5px' }}>
                Our consoles are highly in demand. If you want to extend your rental tenure, please contact us on WhatsApp at least 48 hours before your active tenure expires. Extensions are subject to availability.
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14.5px' }}>
                Delayed returns without prior extension approval will attract a daily late fee of ₹500/day. Equipment must be handed over in its original condition and packaging.
              </p>
            </div>
          </div>
        </>
      )}

      {/* VERIFICATION FAQ VIEW */}
      {view === 'verification-faq' && (
        <>
          <div className="section-header" style={{ marginTop: '24px' }}>
            <h2 className="section-title">Verification <span>FAQ</span></h2>
            <p className="section-subtitle">Everything you need to know about our identity verification and KYC process.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '48px' }}>
            {[
              {
                q: "What is KYC and why is it mandatory?",
                a: "KYC (Know Your Customer) is an identity check to ensure security and prevent device theft or misuse. Since we provide high-value gaming consoles (like PS5) with zero security deposit, identity verification is necessary to confirm customer details before dispatch."
              },
              {
                q: "What documents are accepted for verification?",
                a: "We accept digital Aadhaar (UIDAI), Driving License, or Voter ID cards. The document must show your current residential address, which should match your delivery address. A matching electricity bill or rent agreement may be requested if your Aadhaar has a different address."
              },
              {
                q: "Why do you require a live selfie capture?",
                a: "Our system performs an automated biometric check to compare your live selfie with the photo on your government identity card. This ensures that the person booking the console is the actual owner of the uploaded document, preventing identity theft and fraud."
              },
              {
                q: "How long does the verification process take?",
                a: "Our compliance team reviews bookings within 30 minutes of submission. You will receive an immediate confirmation SMS and email once your booking is approved, or our representative will contact you if additional details are needed."
              },
              {
                q: "Is my personal data and document copy safe?",
                a: "Yes. Data security is our highest priority. All uploaded identity card scans and selfies are encrypted using military-grade AES-256 standards, transmitted over secure TLS 1.3 channels, and strictly stored on protected server folders. They are automatically deleted 30 days after the return of your rented equipment."
              }
            ].map((faq, index) => (
              <div key={index} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-cyan)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--accent-blue)', background: 'rgba(0,122,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>Q</span>
                  {faq.q}
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', paddingLeft: '32px' }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* PRIVACY POLICY VIEW */}
      {view === 'privacy-policy' && (
        <>
          <div className="section-header" style={{ marginTop: '24px' }}>
            <h2 className="section-title">Privacy <span>Policy</span></h2>
            <p className="section-subtitle">How we protect, encrypt, and handle your identity and personal data.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '48px' }}>
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>1. Information We Collect</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14px' }}>
                To fulfill your rental orders and verify your eligibility for zero-deposit renting, we collect:
              </p>
              <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px' }}>
                <li>Personal identifiers: Full Name, Email Address, Primary Phone, and Alternate Phone.</li>
                <li>Government-issued Identity documents: Aadhaar Number and images of your physical ID card.</li>
                <li>Verification media: Biometric liveness check selfie and a digital signature for terms agreement.</li>
                <li>Address details: Residential address and optional company information.</li>
              </ul>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>2. Security & Bank-Grade Encryption</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14px' }}>
                Your data is stored and handled with the highest security measures:
              </p>
              <ul style={{ color: 'var(--text-secondary)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13.5px' }}>
                <li><strong>Encryption in Transit:</strong> All data, including high-resolution ID images and selfies, is transmitted over HTTPS with TLS 1.3 encryption.</li>
                <li><strong>Encryption at Rest:</strong> Customer credentials and identity card scans are stored using AES-256 database-level encryption.</li>
                <li><strong>Strict Access Controls:</strong> Only authorized compliance supervisors have access to view ID documents for verification purposes.</li>
              </ul>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>3. Retention & Automatic Deletion</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14px' }}>
                We believe in data minimization. We do not keep your sensitive identity verification files permanently:
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14px' }}>
                Your uploaded documents (Aadhaar cards and selfies) are retained in our secure repository solely for the duration of the rental term. Once you return the console and our inspection confirms no damage, all identity images are permanently deleted from our servers within 30 days.
              </p>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>4. Third-Party Sharing</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '14px' }}>
                Elite PS Rentals does not sell, trade, or distribute your identity details or document copies to any third-party marketing companies or advertising agencies. Information is shared only with compliance tools for liveness analysis, and with law enforcement agencies solely in extreme cases of intentional asset theft or damage non-compliance.
              </p>
            </div>
          </div>
        </>
      )}

      {/* CONTACT US VIEW */}
      {view === 'contact' && (
        <>
          <div className="section-header" style={{ marginTop: '24px' }}>
            <h2 className="section-title">Contact <span>Our Hub</span></h2>
            <p className="section-subtitle">Get in touch or visit our local setup center in Vasai West</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '32px', marginBottom: '48px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>Vasai West Hub Address</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Shop no 01, Samer seth building, near Vartak College Road, opposite Union Bank, Navghar Manikpur, Vishal Nagar, Vasai West, Mumbai, Vasai-Virar, Maharashtra 401202
                </p>
              </div>

              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>Phone &amp; Support</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px' }}>
                  <Smartphone size={18} style={{ color: 'var(--accent-blue)' }} />
                  <strong>8180807208</strong>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Our customer service line is open daily from 9:00 AM to 10:00 PM for booking and setup queries.
                </p>
              </div>

              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>Email Support</h4>
                <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', margin: 0 }}>
                  ✉️ <a href="mailto:sumitkhurange123@gmail.com" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>sumitkhurange123@gmail.com</a>
                </p>
              </div>

              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>WhatsApp Chat Assistance</h4>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                  Have questions about availability or need setup support? Chat with our team instantly.
                </p>
                <a 
                  href="https://wa.me/918180807208"
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-signin"
                  style={{ background: '#25D366', color: '#fff', textAlign: 'center', display: 'block', padding: '10px', boxShadow: 'none' }}
                >
                  Message on WhatsApp
                </a>
              </div>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>Location Map & Directions</h4>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                Find us easily near Vartak College. Below is our physical hub location indicator.
              </p>
              
              {/* Map Mock/Placeholder indicator */}
              <div style={{ 
                flexGrow: 1, 
                minHeight: '260px', 
                background: 'rgba(0,0,0,0.3)', 
                border: '1px solid var(--border)', 
                borderRadius: '8px', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
                gap: '12px'
              }}>
                <MapPin size={36} style={{ color: 'var(--accent-blue)' }} />
                <div>
                  <strong style={{ fontSize: '15px' }}>Elite PS Rentals - Main Hub</strong>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Near Vartak College Road, Navghar Manikpur, Vasai West</div>
                </div>
                <a 
                  href="https://maps.google.com/?q=Shop+no+01,+Samer+seth+building,+near+Vartak+College+Road,+opposite+Union+Bank,+Navghar+Manikpur,+Vishal+Nagar,+Vasai+West,+Mumbai,+Vasai-Virar,+Maharashtra+401202" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-clipboard"
                  style={{ margin: 0, padding: '8px 16px' }}
                >
                  Open in Google Maps
                </a>
              </div>
            </div>
          </div>
        </>
      )}

      {/* PRODUCT DETAILS VIEW */}
      {view === 'details' && selectedProduct && (
        <div>
          <button className="btn-back-link" onClick={() => setView('catalog')} style={{ marginBottom: '24px' }}>
            <ArrowLeft size={18} />
          </button>

          <div className="product-details-container">
            {/* Main Info Column */}
            <div className="details-main-col">
              <div className="glass-panel gallery-card">
                <img src={selectedProduct.image} alt={selectedProduct.name} />
              </div>

              <div className="glass-panel info-text-card">
                <h3>About Item</h3>
                <p>{selectedProduct.about}</p>
              </div>

              <div className="glass-panel info-text-card">
                <h3>What's included in package?</h3>
                <ul className="included-list">
                  {selectedProduct.included.map((item, idx) => (
                    <li key={idx} className="included-item">
                      <CheckCircle2 size={16} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* FAQs Accordion */}
              <div className="glass-panel info-text-card">
                <h3>Frequently Asked Questions</h3>
                <div className="faq-accordion">
                  {selectedProduct.faqs.map((faq, idx) => {
                    const isOpen = activeFaq === idx;
                    return (
                      <div key={idx} className="faq-item">
                        <div className="faq-header" onClick={() => setActiveFaq(isOpen ? null : idx)}>
                          <span>{faq.q}</span>
                          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                        {isOpen && (
                          <div className="faq-content">
                            <p>{faq.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PRODUCT REVIEWS SECTION */}
              <div className="glass-panel info-text-card" style={{ marginTop: '24px' }}>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                  Customer Reviews ({prodCount})
                </h3>
                
                {productReviews.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', fontStyle: 'italic', marginBottom: '24px' }}>
                    No reviews for this product yet. Be the first to write one!
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                    {productReviews.map((rev) => (
                      <div key={rev.id} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div>
                            <strong style={{ color: '#fff', fontSize: '14px', marginRight: '8px' }}>{rev.customerName}</strong>
                            {rev.bookingId && (
                              <span className="status-pill approved" style={{ fontSize: '9px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center' }}>
                                Verified Renter
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {new Date(rev.createdAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ marginBottom: '8px' }}>{renderStars(rev.rating)}</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
                          {rev.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* ADD REVIEW INFO */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>
                    ✍️ Want to leave a review? You'll receive a rating link in your <strong>Mailbox Notification</strong> once your order is delivered!
                  </p>
                </div>
              </div>
            </div>

            {/* Sticky Pricing Sidebar */}
            <div className="pricing-sticky-panel">
              <div className="glass-panel">
                <div className="price-booking-header">
                  <span className="times-booked-pill">Booked {selectedProduct.bookedCount}+ times</span>
                  <span className="zero-deposit-text">Zero Deposit</span>
                </div>

                <h2 style={{ fontFamily: 'var(--font-display)', margin: '14px 0 6px 0', fontSize: '20px' }}>
                  {selectedProduct.name}
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Brand: {selectedProduct.brand}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  {renderStars(prodCount > 0 ? Math.round(prodAvg) : 0)}
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
                    {prodCount > 0 ? prodAvg : '0.0'}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ({prodCount} {prodCount === 1 ? 'Review' : 'Reviews'})
                  </span>
                </div>

                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Select Rental Plan
                  </h4>
                  <div className="plan-grid">
                    {selectedProduct.pricePlans.map((plan, idx) => (
                      <div 
                        key={idx}
                        className={`plan-option-card ${selectedPlanIndex === idx ? 'active' : ''}`}
                        onClick={() => selectPlan(idx)}
                      >
                        <div className="plan-label">{plan.label}</div>
                        <div className="plan-rate">
                          ₹{plan.rate}<span>/{plan.period}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Date range pickers */}
                <div style={{ margin: '18px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="date-pickers-row">
                    <div className="date-input-wrapper">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>START DATE</label>
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => handleStartDateChange(e.target.value)} 
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="date-input-wrapper">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>END DATE</label>
                      <input 
                        type="date" 
                        value={endDate} 
                        disabled 
                        style={{ opacity: 0.7 }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>DELIVERY SLOT</label>
                    <select 
                      className="form-input" 
                      style={{ padding: '8px 12px' }}
                      value={deliverySlot}
                      onChange={(e) => setDeliverySlot(e.target.value)}
                    >
                      <option>10:00 AM - 12:00 PM</option>
                      <option>12:00 PM - 2:00 PM</option>
                      <option>2:00 PM - 4:00 PM</option>
                      <option>4:00 PM - 6:00 PM</option>
                      <option>6:00 PM - 8:00 PM</option>
                    </select>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  Delivery slot includes setup. Pick-up at end of tenure is free. Delivery charges of ₹149 apply.
                </div>

                {/* Totals */}
                <div className="total-summary-row">
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Estimate</span>
                  <div className="total-amount-display">
                    <div className="total-amount-val">
                      ₹{(() => {
                        const p = selectedProduct.pricePlans[selectedPlanIndex];
                        const multiplier = p.period === 'day' ? p.days
                          : p.period === 'week' ? p.days / 7
                          : p.period === 'month' ? p.days / 30
                          : 1;
                        return Math.round(p.rate * multiplier).toLocaleString('en-IN');
                      })()}
                    </div>
                    <span className="total-amount-sub">Excluding taxes & delivery</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button 
                    className="form-submit-btn" 
                    style={{ flex: 1, marginTop: 0 }}
                    onClick={proceedToCheckout}
                  >
                    Rent Now
                  </button>
                  <button 
                    className="form-submit-btn" 
                    style={{ flex: 1, marginTop: 0, background: 'rgba(0, 229, 255, 0.1)', color: 'var(--accent-cyan)', border: '1px solid var(--accent-cyan)' }}
                    onClick={() => {
                      if (!startDate || !endDate) {
                        showToast('Please pick valid rental dates.');
                        return;
                      }
                      const plan = selectedProduct.pricePlans[selectedPlanIndex];
                      addToCart(selectedProduct, plan, startDate, endDate, deliverySlot);
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>

              {/* Share credits card */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>Apply Credits & Codes</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Use coupon <strong>ELITE100</strong> during checkout to save ₹100 on your first booking transaction.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CART SCREEN VIEW */}
      {view === 'cart' && (
        <div className="checkout-page-container">
          <div style={{ gridColumn: 'span 2' }}>
            <div className="checkout-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="btn-back-link" onClick={() => setView('catalog')}>
                  <ArrowLeft size={16} />
                </button>
                <h2 className="section-title" style={{ textAlign: 'left', marginTop: 0, marginBottom: 0 }}>
                  Your <span>Cart</span>
                </h2>
              </div>
            </div>
          </div>

          {cart.length === 0 ? (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '60px 20px' }}>
              <div className="glass-panel" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '500px', width: '100%', padding: '40px' }}>
                <div style={{ color: 'var(--accent-cyan)', background: 'rgba(0,229,255,0.05)', borderRadius: '50%', padding: '24px', display: 'inline-flex' }}>
                  <ShoppingCart size={48} />
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold' }}>Your Cart is Empty</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
                  Pick your favorite console, VR headset, or steering wheel from our catalog to get started. No security deposit, cancel anytime!
                </p>
                <button 
                  className="btn-signin" 
                  onClick={() => setView('catalog')}
                  style={{ padding: '12px 32px', fontSize: '14px', fontWeight: 'bold', width: 'auto' }}
                >
                  Explore Catalog
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Left Column - Cart Items List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {cart.map((item, idx) => {
                  const originalRate = item.plan.rate * 1.25; // Create a fake "regular" rate for beautiful discount styling
                  const originalPrice = originalRate * (item.plan.period === 'day' ? item.plan.days : (item.plan.days / 7));
                  return (
                    <div className="glass-panel" key={`${item.id}-${idx}`} style={{ display: 'flex', gap: '20px', padding: '20px', position: 'relative' }}>
                      <div className="recap-item-img" style={{ width: '110px', height: '110px', flexShrink: 0 }}>
                        <img src={item.product.image} alt={item.product.name} style={{ width: '90px', height: '90px', objectFit: 'contain' }} />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>
                              {item.product.name}
                            </h3>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Category: {item.product.category}
                            </div>
                          </div>
                          <button 
                            style={{ color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', padding: '4px' }}
                            title="Remove item"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          <span style={{ background: 'rgba(255,255,255,0.03)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <strong>Tenure:</strong> {item.plan.label}
                          </span>
                          <span style={{ background: 'rgba(255,255,255,0.03)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <strong>Dates:</strong> {item.startDate} to {item.endDate}
                          </span>
                          <span style={{ background: 'rgba(255,255,255,0.03)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <strong>Slot:</strong> {item.deliverySlot}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Quantity:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--bg-darker)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                              <button 
                                onClick={() => updateCartQty(item.id, item.qty - 1)}
                                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                                disabled={item.qty <= 1}
                              >
                                -
                              </button>
                              <span style={{ padding: '0 12px', fontSize: '13px', fontWeight: 'bold', minWidth: '30px', textAlign: 'center' }}>
                                {item.qty}
                              </span>
                              <button 
                                onClick={() => updateCartQty(item.id, item.qty + 1)}
                                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.02)', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-cyan)' }}>
                              ₹{(item.basePrice * item.qty).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column - Price Summary */}
              <div className="checkout-recap-panel">
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '12px', margin: 0 }}>
                    Price Details ({cart.reduce((sum, item) => sum + item.qty, 0)} Items)
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="recap-calculation-row">
                      <span>Base Rental Rate</span>
                      <span>₹{getSubtotal().toFixed(2)}</span>
                    </div>
                    <div className="recap-calculation-row">
                      <span>GST Tax (18%)</span>
                      <span>₹{getTax().toFixed(2)}</span>
                    </div>
                    <div className="recap-calculation-row">
                      <span>Delivery & Setup</span>
                      <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>FREE</span>
                    </div>

                    <div style={{ borderTop: '1px dashed var(--border)', margin: '6px 0' }} />

                    <div className="recap-total-row" style={{ fontSize: '20px', padding: 0, border: 'none' }}>
                      <span>Payable Amount</span>
                      <span style={{ color: 'var(--accent-cyan)' }}>₹{getTotalPrice().toFixed(2)}</span>
                    </div>
                  </div>

                  <button 
                    className="btn-signin"
                    style={{ width: '100%', padding: '14px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={() => {
                      if (!isUserLoggedIn) {
                        setRedirectAfterLogin('checkout');
                        setView('login');
                        showToast('Please login or register to complete checkout!');
                      } else {
                        setView('checkout');
                        setCheckoutStep(1);
                        window.scrollTo(0, 0);
                      }
                    }}
                  >
                    Proceed to Rent <ArrowRight size={16} />
                  </button>

                  <button 
                    className="btn-clipboard" 
                    onClick={() => setView('catalog')}
                    style={{ margin: 0, padding: '10px' }}
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CHECKOUT SCREEN VIEW */}
      {view === 'checkout' && (cart.length > 0 || checkoutStep === 4) && (
        <div className="checkout-page-container">
          <div>
            <div className="checkout-title-row">
              <button 
                className="btn-back-link" 
                onClick={() => {
                  if (checkoutStep === 4) {
                    setView(isUserLoggedIn ? 'client-dashboard' : 'home');
                  } else {
                    setView('cart');
                  }
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="section-title" style={{ textAlign: 'left', marginTop: 0 }}>
                {checkoutStep === 4 ? <>Booking <span>Receipt</span></> : <>Checkout <span>Booking</span></>}
              </h2>
            </div>

            {/* Stepper Progress Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', background: 'var(--bg-light-dark)', padding: '12px 20px', borderRadius: '30px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: checkoutStep >= 1 ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                <span className="step-num-badge" style={checkoutStep >= 1 ? { borderColor: 'var(--accent-cyan)', color: 'var(--bg-darker)', background: 'var(--accent-cyan)' } : {}}>1</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Billing & T&C</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: checkoutStep >= 2 ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                <span className="step-num-badge" style={checkoutStep >= 2 ? { borderColor: 'var(--accent-cyan)', color: 'var(--bg-darker)', background: 'var(--accent-cyan)' } : {}}>2</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Payment</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: checkoutStep >= 3 ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                <span className="step-num-badge" style={checkoutStep >= 3 ? { borderColor: 'var(--accent-cyan)', color: 'var(--bg-darker)', background: 'var(--accent-cyan)' } : {}}>3</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Liveness Check</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: checkoutStep >= 4 ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                <span className="step-num-badge" style={checkoutStep >= 4 ? { borderColor: 'var(--accent-cyan)', color: 'var(--bg-darker)', background: 'var(--accent-cyan)' } : {}}>4</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Receipt</span>
              </div>
            </div>

            {/* Step 1: Billing, Delivery & T&C Checklist */}
            {checkoutStep === 1 && (
              <div className="glass-panel checkout-steps-col">
                <div className="checkout-step-header">
                  <span className="step-num-badge">1/4</span>
                  <h3 className="step-title">Delivery Info & Terms Acceptance</h3>
                </div>

                {!isUserLoggedIn && (
                  <div style={{ background: 'rgba(41, 121, 255, 0.08)', border: '1px solid rgba(41, 121, 255, 0.2)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Want to save orders history?</span>
                    <button className="btn-clipboard" onClick={() => setView('login')} style={{ fontSize: '12px', padding: '4px 12px' }}>
                      Login / Sign Up
                    </button>
                  </div>
                )}

                {isUserLoggedIn && userProfile && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                    <button
                      type="button"
                      className="btn-clipboard"
                      style={{ margin: 0, fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => {
                        setCustomerName(userProfile.name || '');
                        setCustomerPhone(userProfile.phone || '');
                        setCustomerEmail(userProfile.email || '');
                        const addr = userProfile.homeAddress;
                        if (addr && addr !== 'Not set') setDeliveryAddress(addr);
                        showToast('Delivery form filled from your profile!');
                      }}
                    >
                      <User size={13} /> Use My Profile Info
                    </button>
                  </div>
                )}
                <div className="auth-form" style={{ marginTop: 0 }}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Neej Patel"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                   <div className="form-group">
                    <label>Phone Number (WhatsApp Active)</label>
                    <div style={{ display: 'flex', marginTop: '4px', width: '100%' }}>
                      <span style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--bg-light-dark)', 
                        border: '1px solid var(--border)', 
                        borderRight: 'none', 
                        borderTopLeftRadius: '8px', 
                        borderBottomLeftRadius: '8px', 
                        padding: '0 12px', 
                        color: 'var(--accent-cyan)', 
                        fontWeight: 'bold', 
                        fontSize: '14px' 
                      }}>+91</span>
                      <input 
                        type="tel" 
                        className="form-input" 
                        placeholder="98765 43210"
                        style={{ 
                          flex: 1, 
                          borderTopLeftRadius: 0, 
                          borderBottomLeftRadius: 0,
                          marginTop: 0 
                        }} 
                        value={customerPhone.replace(/^\+91\s*/, '')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setCustomerPhone(val ? `+91 ${val}` : '');
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="e.g. neej.patel@gmail.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Delivery Address in Vasai-Virar</label>
                    <textarea 
                      className="form-input" 
                      rows="2"
                      placeholder="e.g. Shop no 01, Manikpur, Vasai West"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                    />
                  </div>

                  <div style={{ margin: '16px 0' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-cyan)', marginBottom: '10px' }}>
                      Rental Agreement Terms & Conditions
                    </h4>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {[
                        "Keep console and gear in safe, dry indoor conditions.",
                        "Report cosmetic/technical issues over WhatsApp within 2 hours of delivery.",
                        "Delayed returns will attract standard daily rates.",
                        "No extension of rental tenure without admin approval.",
                        "Elite PS reserves the right to pick up equipment on agreement violations.",
                        "Renter is liable for repair/replacement cost of any damaged equipment.",
                        "Zero sub-renting rules: Renter will not sub-rent or lease to others.",
                        "ID verification and face-match selfie required.",
                        "Refund will be triggered automatically if face-match selfie fails."
                      ].map((termText, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>•</span>
                          <span>{termText}</span>
                        </div>
                      ))}
                    </div>
                    <label style={{ display: 'flex', gap: '8px', fontSize: '13px', cursor: 'pointer', alignItems: 'center', color: termChecks.every(Boolean) ? '#fff' : 'var(--text-secondary)', fontWeight: '600', marginTop: '12px' }}>
                      <input 
                        type="checkbox" 
                        checked={termChecks.every(Boolean)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setTermChecks(Array(9).fill(val));
                          setTcAgreedOverall(val);
                        }}
                        style={{ transform: 'scale(1.1)', accentColor: 'var(--accent-cyan)' }}
                      />
                      <span>I accept all 9 Rental Agreement Terms & Conditions listed above</span>
                    </label>
                  </div>

                  {/* Canvas Signature Board */}
                  <div style={{ margin: '12px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ✍️ Draw Your Signature
                      </label>
                      <button
                        type="button"
                        className="btn-clipboard"
                        style={{ margin: 0, fontSize: '11px', padding: '3px 10px' }}
                        onClick={() => {
                          const canvas = signatureCanvasRef.current;
                          if (canvas) {
                            const ctx = canvas.getContext('2d');
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                          }
                          setIsSigned(false);
                          setHasDrawnOnCanvas(false);
                          setSignatureCanvasData(null);
                        }}
                      >
                        Clear Board
                      </button>
                    </div>
                    <canvas
                      ref={signatureCanvasRef}
                      width={700}
                      height={160}
                      style={{
                        width: '100%',
                        height: '160px',
                        background: 'rgba(255,255,255,0.03)',
                        border: `2px solid ${isSigned ? 'var(--accent-cyan)' : hasDrawnOnCanvas ? 'rgba(0,229,255,0.4)' : 'var(--border)'}`,
                        borderRadius: '10px',
                        cursor: 'crosshair',
                        touchAction: 'none',
                        display: 'block'
                      }}
                      onMouseDown={(e) => {
                        setIsDrawingSignature(true);
                        setHasDrawnOnCanvas(true);
                        const canvas = signatureCanvasRef.current;
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        const ctx = canvas.getContext('2d');
                        ctx.beginPath();
                        ctx.strokeStyle = '#00e5ff';
                        ctx.lineWidth = 2.5;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawingSignature) return;
                        const canvas = signatureCanvasRef.current;
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        const ctx = canvas.getContext('2d');
                        ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
                        ctx.stroke();
                      }}
                      onMouseUp={() => setIsDrawingSignature(false)}
                      onMouseLeave={() => setIsDrawingSignature(false)}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        setIsDrawingSignature(true);
                        setHasDrawnOnCanvas(true);
                        const canvas = signatureCanvasRef.current;
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        const touch = e.touches[0];
                        const ctx = canvas.getContext('2d');
                        ctx.beginPath();
                        ctx.strokeStyle = '#00e5ff';
                        ctx.lineWidth = 2.5;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.moveTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
                      }}
                      onTouchMove={(e) => {
                        e.preventDefault();
                        if (!isDrawingSignature) return;
                        const canvas = signatureCanvasRef.current;
                        const rect = canvas.getBoundingClientRect();
                        const scaleX = canvas.width / rect.width;
                        const scaleY = canvas.height / rect.height;
                        const touch = e.touches[0];
                        const ctx = canvas.getContext('2d');
                        ctx.lineTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
                        ctx.stroke();
                      }}
                      onTouchEnd={() => setIsDrawingSignature(false)}
                    />
                    {!hasDrawnOnCanvas && (
                      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        Use your mouse or finger to draw your signature above
                      </div>
                    )}
                    {isSigned && (
                      <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} /> Agreement signed by <strong style={{ marginLeft: '4px' }}>{signatureName}</strong>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Type Full Name to Confirm"
                      className="form-input"
                      style={{ flexGrow: 1, padding: '8px 12px' }}
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                    />
                    <button
                      className="btn-rent-now"
                      style={{ width: 'auto' }}
                      onClick={() => {
                        if (!signatureName.trim()) {
                          showToast('Please type your full name to confirm.');
                          return;
                        }
                        if (!hasDrawnOnCanvas) {
                          showToast('Please draw your signature on the board above.');
                          return;
                        }
                        const canvas = signatureCanvasRef.current;
                        const dataUrl = canvas.toDataURL('image/png');
                        setSignatureCanvasData(dataUrl);
                        setIsSigned(true);
                        showToast('Agreement signed successfully!');
                      }}
                    >
                      Sign Agreement
                    </button>
                  </div>
                </div>

                <button 
                  className="form-submit-btn" 
                  style={{ width: '100%', marginTop: '16px' }}
                  onClick={() => {
                    if (!customerName || !customerPhone || !customerEmail || !deliveryAddress) {
                      showToast("Please fill in all contact and address fields.");
                      return;
                    }
                    if (termChecks.filter(Boolean).length < 9) {
                      showToast("You must agree to all 9 terms of the agreement.");
                      return;
                    }
                    if (!isSigned) {
                      showToast("Please sign the rental agreement first.");
                      return;
                    }
                    setCheckoutStep(2);
                  }}
                >
                  Continue to Payment
                </button>
              </div>
            )}

            {checkoutStep === 2 && (
              <div className="glass-panel checkout-steps-col">
                <div className="checkout-step-header">
                  <span className="step-num-badge">2/4</span>
                  <h3 className="step-title">UPI Payment Scanner</h3>
                </div>

                <div className="payment-detail-form" style={{ textAlign: 'center' }}>
                  <div className="upi-qr-display" style={{ display: 'inline-block', padding: '10px', background: '#fff', borderRadius: '8px', margin: '15px 0' }}>
                    <img 
                      src="/images/scanner.jpg" 
                      alt="UPI Payment QR" 
                      style={{ width: '200px', height: 'auto', display: 'block', borderRadius: '4px' }}
                    />
                  </div>
                  <div style={{ fontSize: '15px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                    Scan & Pay: ₹{getTotalPrice().toFixed(2)}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '10px 0', lineHeight: '1.4' }}>
                    Scan the QR Code with any UPI app (GPay, PhonePe, Paytm, BHIM) and enter the 12-digit UPI Transaction ID.
                  </p>
                  
                  <div className="form-group" style={{ textAlign: 'left', marginTop: '16px' }}>
                    <label style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', fontSize: '12px' }}>UPI Transaction ID (12 Digits)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. 612458925482" 
                      value={upiTxnId}
                      onChange={(e) => setUpiTxnId(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  className="form-submit-btn" 
                  style={{ width: '100%', marginTop: '16px' }}
                  onClick={() => {
                    if (!upiTxnId.trim()) {
                      showToast('Please enter your UPI transaction ID.');
                      return;
                    }
                    if (upiTxnId.trim().length !== 12 || isNaN(upiTxnId.trim())) {
                      showToast('UPI Transaction ID must be a 12-digit number.', 'error');
                      return;
                    }
                    setIsSubmittingOrder(true);
                    setTimeout(() => {
                      setIsSubmittingOrder(false);
                      setCheckoutStep(3); // Go to Selfie liveness check
                    }, 1000);
                  }}
                  disabled={isSubmittingOrder}
                >
                  {isSubmittingOrder ? "Submitting..." : "Submit & Continue"}
                </button>
              </div>
            )}

            {/* Step 3: Liveness identity verification match check */}
            {checkoutStep === 3 && (
              <div className="glass-panel checkout-steps-col">
                <div className="checkout-step-header">
                  <span className="step-num-badge">3/4</span>
                  <h3 className="step-title">ID & Face Verification</h3>
                </div>

                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Please upload a selfie photo and Aadhaar/Driving ID proof to complete the zero-deposit agreement validation.
                </p>

                <div className="file-upload-grid" style={{ margin: '16px 0' }}>
                  <div className="file-uploader-box" style={uploadedSelfie ? { borderColor: 'var(--accent-cyan)' } : {}}>
                    {uploadedSelfie && uploadedSelfie.image ? (
                      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={uploadedSelfie.image} alt="Selfie Preview" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-cyan)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginTop: '8px', fontWeight: 'bold' }}>Selfie Captured</span>
                        <button 
                          className="btn-clipboard" 
                          onClick={(e) => { e.stopPropagation(); setUploadedSelfie(null); }}
                          style={{ marginTop: '8px', padding: '3px 8px', fontSize: '10px' }}
                        >
                          Retake
                        </button>
                      </div>
                    ) : (
                      <>
                        <Camera size={24} />
                        <span className="uploader-title" style={{ fontSize: '13px', fontWeight: '600' }}>Selfie Verification</span>
                        <span className="uploader-sub">Liveness face validation</span>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button className="btn-rent-now" style={{ fontSize: '10.5px', padding: '4px 8px' }} onClick={() => startScanner('selfie')}>
                            Scan Camera
                          </button>
                          <label className="btn-clipboard" style={{ fontSize: '10.5px', padding: '4px 8px', margin: 0, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                            Upload
                            <input 
                              type="file" 
                              accept="image/*" 
                              style={{ display: 'none' }} 
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setUploadedSelfie({ name: file.name, image: event.target.result });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="file-uploader-box" style={uploadedID ? { borderColor: 'var(--accent-cyan)' } : {}}>
                    {uploadedID && uploadedID.image ? (
                      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={uploadedID.image} alt="ID Preview" style={{ width: '120px', height: '80px', borderRadius: '6px', objectFit: 'cover', border: '2px solid var(--accent-cyan)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', marginTop: '8px', fontWeight: 'bold' }}>ID Document Scanned</span>
                        <button 
                          className="btn-clipboard" 
                          onClick={(e) => { e.stopPropagation(); setUploadedID(null); }}
                          style={{ marginTop: '8px', padding: '3px 8px', fontSize: '10px' }}
                        >
                          Retake
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} />
                        <span className="uploader-title" style={{ fontSize: '13px', fontWeight: '600' }}>National ID proof</span>
                        <span className="uploader-sub">Aadhaar ID / DL</span>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <button className="btn-rent-now" style={{ fontSize: '10.5px', padding: '4px 8px' }} onClick={() => startScanner('document')}>
                            Scan Camera
                          </button>
                          <label className="btn-clipboard" style={{ fontSize: '10.5px', padding: '4px 8px', margin: 0, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                            Upload
                            <input 
                              type="file" 
                              accept="image/*" 
                              style={{ display: 'none' }} 
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setUploadedID({ name: file.name, image: event.target.result });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button 
                  className="form-submit-btn" 
                  style={{ width: '100%', marginTop: '16px' }}
                  onClick={() => {
                    if (!uploadedSelfie || !uploadedID) {
                      showToast("Please upload both selfie photo and ID document first.");
                      return;
                    }
                    triggerOrderPlacement();
                  }}
                  disabled={isSubmittingOrder}
                >
                  {isSubmittingOrder ? "Submitting documents..." : "Submit Verification"}
                </button>
              </div>
            )}

            {/* Step 4: Receipt / E-Bill Invoice overview screen */}
            {checkoutStep === 4 && createdBooking && (() => {
              const selfieImg = createdBooking.selfie || uploadedSelfie?.image;
              const idImg = createdBooking.identityID || uploadedID?.image;
              const sigImg = createdBooking.signature || signatureCanvasData;
              const sigName = createdBooking.customerName || signatureName;
              const isApproved = createdBooking.verificationStatus === 'Approved';
              const isPending = createdBooking.verificationStatus === 'Pending';
              const isRejected = createdBooking.verificationStatus === 'Rejected' || createdBooking.status === 'Cancelled';

              return (
                <div className="glass-panel checkout-steps-col" style={{ padding: '30px' }}>
                  {isRejected ? (
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <div style={{ color: '#ef4444', display: 'inline-flex', justifyContent: 'center', marginBottom: '12px' }}>
                        <AlertTriangle size={56} />
                      </div>
                      <h3 className="section-title" style={{ marginTop: 0 }}>Verification <span>Rejected</span></h3>
                      <p style={{ color: '#ef4444', fontSize: '14px', margin: '4px 0 16px 0', fontWeight: 'bold' }}>
                        Your rental agreement or identity verification was rejected by compliance.
                      </p>
                      {createdBooking.status === 'Cancelled' && createdBooking.refundStatus && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '8px', textAlign: 'left', fontSize: '13px', marginTop: '10px' }}>
                          <div style={{ marginBottom: '6px' }}><strong>Automatic Refund Triggered:</strong></div>
                          <div style={{ color: 'var(--text-secondary)' }}>Reference: {createdBooking.id}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>Amount: ₹{(createdBooking.totalAmount || 0).toFixed(2)}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>Status: Processed & Returned to original payment channel.</div>
                        </div>
                      )}
                    </div>
                  ) : isPending ? (
                    <div style={{ textAlign: 'center', padding: '10px 0' }} className="no-print">
                      <div style={{ color: 'var(--accent-cyan)', display: 'inline-flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <Clock size={64} className="textColor-cyan" style={{ filter: 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.3))' }} />
                      </div>
                      <h3 className="section-title" style={{ marginTop: 0 }}>Verification <span>Pending</span></h3>
                      
                      <div style={{ 
                        background: 'rgba(255, 171, 0, 0.08)', 
                        border: '1px solid rgba(255, 171, 0, 0.3)', 
                        padding: '16px 20px', 
                        borderRadius: '10px', 
                        fontSize: '14px', 
                        lineHeight: '1.5',
                        color: '#ffb300',
                        maxWidth: '520px', 
                        margin: '0 auto 24px auto',
                        fontWeight: '600',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
                      }}>
                        ⚠️ You will receive receipt after confirmation or payment will be refunded within 24 hours.
                      </div>

                      <div style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '10px', 
                        padding: '20px', 
                        maxWidth: '520px', 
                        margin: '0 auto', 
                        textAlign: 'left' 
                      }}>
                        <h4 style={{ margin: '0 0 12px 0', color: 'var(--accent-cyan)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', fontSize: '14px' }}>
                          Booking Information
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Booking ID:</span><br />
                            <strong>{createdBooking.id}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Status:</span><br />
                            <span style={{ color: '#ffb300', fontWeight: 'bold' }}>Pending Approval</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Amount Paid:</span><br />
                            <strong>₹{(createdBooking.totalAmount || 0).toFixed(2)}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Payment Method:</span><br />
                            <strong>{createdBooking.paymentMethod || 'UPI'}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Delivery Slot:</span><br />
                            <strong>{createdBooking.deliverySlot}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Customer Name:</span><br />
                            <strong>{sigName || 'Customer'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', marginBottom: '20px' }} className="no-print">
                      <div style={{ color: 'var(--accent-green)', display: 'inline-flex', justifyContent: 'center', marginBottom: '12px' }}>
                        <CheckCircle2 size={56} />
                      </div>
                      <h3 className="section-title" style={{ marginTop: 0 }}>Booking <span>Confirmed!</span></h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 16px 0' }}>
                        Verification passed! Your console gear will be delivered shortly. Reference: <strong>{createdBooking.id}</strong>.
                      </p>
                    </div>
                  )}

                  {/* Printable Invoice E-Bill Area (Rendered ONLY when Approved) */}
                  {isApproved && (
                    <div id="invoice-print-area" style={{ background: '#0a0d18', border: '1px solid var(--border)', padding: '24px', borderRadius: '12px', color: '#fff', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
                        <div>
                          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-cyan)', margin: '0 0 4px 0', fontSize: '18px' }}>Elite PS Rentals</h2>
                          <span style={{ color: 'var(--text-secondary)' }}>Vasai, Palghar, Maharashtra - 401201</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>E-BILL INVOICE</h4>
                          <span style={{ color: 'var(--text-secondary)' }}>Invoice ID: {createdBooking.id}</span><br />
                          <span style={{ color: 'var(--text-secondary)' }}>Date: {new Date(createdBooking.createdAt || Date.now()).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div>
                          <h4 style={{ textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: '6px', fontSize: '11px' }}>Renter Information</h4>
                          <strong>{sigName || 'Customer'}</strong><br />
                          <span>Phone: {createdBooking.phone}</span><br />
                          <span>Email: {createdBooking.email}</span><br />
                          <span>Address: {createdBooking.address}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <h4 style={{ textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: '6px', fontSize: '11px' }}>Delivery Schedule</h4>
                          <span>Slot: <strong>{createdBooking.deliverySlot}</strong></span><br />
                          {createdBooking.items && createdBooking.items[0] && (
                            <span>Rent Span: {createdBooking.items[0].startDate} to {createdBooking.items[0].endDate}</span>
                          )}
                        </div>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                            <th style={{ textAlign: 'left', padding: '6px 0' }}>Rental Hardware Item</th>
                            <th style={{ textAlign: 'center', padding: '6px 0' }}>Tenure Plan</th>
                            <th style={{ textAlign: 'center', padding: '6px 0' }}>Dates</th>
                            <th style={{ textAlign: 'right', padding: '6px 0' }}>Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(createdBooking.items || []).map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '10px 0' }}>
                                <strong>{item.name} {item.quantity > 1 ? `(x${item.quantity})` : ''}</strong>
                              </td>
                              <td style={{ textAlign: 'center', padding: '10px 0' }}>{item.planLabel}</td>
                              <td style={{ textAlign: 'center', padding: '10px 0' }}>{item.startDate} to {item.endDate}</td>
                              <td style={{ textAlign: 'right', padding: '10px 0' }}>₹{((item.rate || 0) * (item.quantity || 1)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '280px', fontSize: '10px', lineHeight: '1.4' }}>
                            * Zero Deposit rental terms. Renter agrees to keep equipment in clean, dry indoor condition. Liability for damage resides with renter.
                          </div>
                        </div>
                        <div style={{ minWidth: '180px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span>Subtotal:</span>
                            <span>₹{(createdBooking.totalAmount ? (createdBooking.totalAmount + (createdBooking.discountAmount || 0)) / 1.18 : 0).toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span>GST Tax (18%):</span>
                            <span>₹{(createdBooking.totalAmount ? ((createdBooking.totalAmount + (createdBooking.discountAmount || 0)) / 1.18) * 0.18 : 0).toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', color: '#10b981' }}>
                            <span>Delivery:</span>
                            <span>FREE 🎉</span>
                          </div>
                          {(createdBooking.discountAmount || 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', color: 'var(--accent-cyan)' }}>
                              <span>Discounts:</span>
                              <span>-₹{(createdBooking.discountAmount || 0).toFixed(2)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0 0 0', borderTop: '1px solid var(--border)', paddingTop: '6px', fontWeight: 'bold', fontSize: '13px' }}>
                            <span>Grand Total:</span>
                            <span style={{ color: 'var(--accent-cyan)' }}>₹{(createdBooking.totalAmount || 0).toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '10px', color: 'var(--text-secondary)' }}>
                            <span>Payment Status:</span>
                            <span>{createdBooking.status === 'Cancelled' ? 'Refunded' : 'Paid Via ' + (createdBooking.paymentMethod || 'UPI')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Verification Proofs Attachment */}
                      {(selfieImg || idImg) && (
                        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                          <h4 style={{ textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: '12px', fontSize: '11px', letterSpacing: '1px' }}>
                            Security Verification Proofs
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {selfieImg && (
                              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>
                                  LIVE VERIFICATION SELFIE
                                </span>
                                <img 
                                  src={selfieImg} 
                                  alt="Live Selfie" 
                                  style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.2)', objectFit: 'contain' }} 
                                />
                              </div>
                            )}
                            {idImg && (
                              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>
                                  IDENTITY PROOF DOCUMENT
                                </span>
                                <img 
                                  src={idImg} 
                                  alt="ID Document" 
                                  style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '6px', border: '1px solid rgba(0, 229, 255, 0.2)', objectFit: 'contain' }} 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Accepted Terms Agreement */}
                      <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                        <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '6px' }}>
                          ACCEPTED TERMS & CONDITIONS
                        </span>
                        <ul style={{ paddingLeft: '14px', margin: 0, fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          {RENTAL_TERMS.slice(0, 5).map((term, i) => (
                            <li key={i}>{term}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Digital Signature */}
                      {sigImg && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Consent Status:</span><br />
                              <span style={{ color: 'var(--accent-green)', fontWeight: 'bold', fontSize: '10px' }}>✓ E-SIGNATURE VERIFIED</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block' }}>Signed Digitally By:</span>
                              <strong style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: 'var(--accent-cyan)', fontStyle: 'italic' }}>
                                {sigName}
                              </strong>
                            </div>
                          </div>
                          <div style={{ marginTop: '8px', border: '1px dashed rgba(0,229,255,0.3)', borderRadius: '6px', background: 'rgba(0,229,255,0.02)', padding: '6px', textAlign: 'center' }}>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>HAND-DRAWN SIGNATURE</span>
                            <img src={sigImg} alt="Digital Signature" style={{ maxHeight: '60px', filter: 'brightness(1.2)' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }} className="no-print">
                    {isApproved ? (
                      <>
                        <button className="btn-signin" onClick={handleDownloadReceipt} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          📥 Download PDF Receipt
                        </button>
                        <button className="btn-clipboard" onClick={() => window.print()}>
                          Print Receipt
                        </button>
                        <a 
                          href={`https://wa.me/918180807208?text=Hello%20Elite%20PS%20Rentals!%20My%20booking%20has%20been%20approved.%0ABooking%20ID%3A%20${createdBooking.id}%0APlease%20confirm%20delivery.`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn-signin"
                          style={{ background: '#25D366', color: '#fff', boxShadow: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          Confirm on WhatsApp
                        </a>
                      </>
                    ) : isPending ? (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          ⏳ Document Verification Pending
                        </div>
                        <button 
                          className="btn-rent-now" 
                          style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', margin: 0 }}
                          onClick={() => refreshBookingStatus(createdBooking.id)}
                        >
                          🔄 Refresh Status
                        </button>
                      </div>
                    ) : (
                      <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '13px' }}>
                        ❌ Verification Rejected (Order Cancelled)
                      </div>
                    )}
                    <button className="btn-clipboard" onClick={() => { setCart([]); setView('home'); }}>
                      Back to Home
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right Column Checkout Recap */}
          {checkoutStep < 4 && (
            <div className="checkout-recap-panel">
              <div className="glass-panel">
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Order Recap</h3>
                
                {cart.map((item, idx) => (
                  <div className="recap-item-row" key={`${item.id}-${idx}`} style={{ display: 'flex', gap: '12px', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                    <div className="recap-item-img" style={{ width: '50px', height: '50px', flexShrink: 0 }}>
                      <img src={item.product.image} alt={item.product.name} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                    </div>
                    <div className="recap-item-info">
                      <div className="recap-item-name" style={{ fontSize: '13px', fontWeight: 'bold' }}>{item.product.name} (x{item.qty})</div>
                      <div className="recap-item-meta" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tenure: {item.plan.label}</div>
                      <div className="recap-item-meta" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Dates: {item.startDate} to {item.endDate}</div>
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                  <div className="recap-calculation-row">
                    <span>Base Rental Rate</span>
                    <span>₹{getSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="recap-calculation-row">
                    <span>GST Tax (18%)</span>
                    <span>₹{getTax().toFixed(2)}</span>
                  </div>
                  <div className="recap-calculation-row" style={{ color: '#10b981' }}>
                    <span>Delivery & Installation</span>
                    <span>FREE 🎉</span>
                  </div>

                  <div className="toggle-switch-row">
                    <div className="switch-label-col">
                      <h4>Apply Share Credits</h4>
                      <p>₹100.00 first booking coupon</p>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={useCredits} 
                        onChange={() => setUseCredits(!useCredits)} 
                        disabled={checkoutStep >= 2}
                      />
                      <span className="slider-toggle"></span>
                    </label>
                  </div>

                  {useCredits && (
                    <div className="recap-calculation-row discount">
                      <span>Credits Discount</span>
                      <span>-₹100.00</span>
                    </div>
                  )}

                  {/* Coupon Application Block */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '6px' }}>
                    {checkoutStep === 1 ? (
                      <>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                          Apply Promo Coupon Code
                        </label>

                        {/* Available coupon chips */}
                        {!appliedCoupon && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                            {[{ code: 'FIRST10', desc: '10% OFF' }, { code: 'LOYAL10', desc: '10% OFF' }, { code: 'ELITE100', desc: '₹100 OFF' }].filter(c => {
                              const usedCodes = (userBookings || []).filter(b => b.couponCode).map(b => b.couponCode.toUpperCase());
                              return !usedCodes.includes(c.code.toUpperCase());
                            }).map(c => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => {
                                  setCouponCodeInput(c.code);
                                  setTimeout(() => {
                                    fetch(`${API}/api/coupons/apply`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ code: c.code, email: customerEmail || userProfile?.email || 'guest@elite.com' })
                                    }).then(r => r.json()).then(data => {
                                      if (data.success) {
                                        setAppliedCoupon(data.coupon);
                                        setCouponMessage(`Coupon ${c.code} applied! ${data.coupon.description}`);
                                        showToast(`Coupon ${c.code} applied!`);
                                      } else {
                                        setCouponMessage(data.message || 'Could not apply coupon.');
                                      }
                                    }).catch(() => setCouponMessage('Network error.'));
                                  }, 0);
                                }}
                                style={{
                                  background: 'rgba(0,229,255,0.08)',
                                  border: '1px dashed rgba(0,229,255,0.35)',
                                  borderRadius: '6px',
                                  padding: '3px 10px',
                                  fontSize: '11px',
                                  color: 'var(--accent-cyan)',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  display: 'flex',
                                  gap: '5px',
                                  alignItems: 'center'
                                }}
                              >
                                {c.code} <span style={{ color: 'var(--accent-green)', fontSize: '10px' }}>{c.desc}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. FIRST10"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            value={couponCodeInput}
                            onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                          />
                          <button className="btn-rent-now" onClick={handleApplyCoupon} style={{ width: 'auto', padding: '6px 12px', fontSize: '11px' }}>
                            Apply
                          </button>
                        </div>
                        {couponMessage && (
                          <div style={{ fontSize: '11px', color: couponMessage.includes('applied') ? 'var(--accent-cyan)' : '#ef4444', marginTop: '6px' }}>
                            {couponMessage}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '4px 0' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>Coupon Applied</span>
                        <span style={{ fontWeight: 'bold', color: appliedCoupon ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                          {appliedCoupon ? appliedCoupon.code : '-'}
                        </span>
                      </div>
                    )}
                  </div>

                  {appliedCoupon && (
                    <div className="recap-calculation-row discount">
                      <span>Coupon Discount ({appliedCoupon.code})</span>
                      <span>-₹{(appliedCoupon.discountType === 'percent' ? (getSubtotal() * appliedCoupon.value) / 100 : appliedCoupon.value).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="recap-total-row">
                    <span>Total Cost</span>
                    <span style={{ color: 'var(--accent-cyan)' }}>₹{getTotalPrice().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ADMIN DASHBOARD VIEW */}
      {view === 'admin' && (
        <div className="admin-dashboard-container">
          {!isAdminLoggedIn ? (
            /* Login Form */
            <div className="glass-panel modal-content" style={{ margin: '80px auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Lock size={20} className="textColor-cyan" />
                <h3 className="step-title">Admin Authenticator</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Authorized Elite PS Rentals administrators only. Enter your password to configure inventory pricing or view active bookings.
              </p>
              
              {adminAuthError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
                  {adminAuthError}
                </div>
              )}

              <form onSubmit={handleAdminLogin} className="auth-form">
                <div className="form-group">
                  <label>Username</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    required 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="form-submit-btn">
                  Authenticate Account
                </button>
              </form>
            </div>
          ) : (
            /* Logged In Dashboard Layout */
            <>
              <div className="admin-header-row">
                <div>
                  <h2 className="section-title" style={{ textAlign: 'left', margin: 0 }}>
                    Admin <span>Dashboard</span>
                  </h2>
                  <p className="section-subtitle">Manage Elite PS Rentals Operations</p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="admin-tabs">
                    <button 
                      className={`tab-btn ${adminTab === 'bookings' ? 'active' : ''}`}
                      onClick={() => setAdminTab('bookings')}
                    >
                      Bookings ({adminBookings.length})
                    </button>
                    <button 
                      className={`tab-btn ${adminTab === 'products' ? 'active' : ''}`}
                      onClick={() => setAdminTab('products')}
                    >
                      Inventory Catalog
                    </button>
                    <button 
                      className={`tab-btn ${adminTab === 'coupons' ? 'active' : ''}`}
                      onClick={() => setAdminTab('coupons')}
                    >
                      Coupons Available ({adminCoupons.length})
                    </button>
                    <button 
                      className={`tab-btn ${adminTab === 'emails' ? 'active' : ''}`}
                      onClick={() => setAdminTab('emails')}
                    >
                      Email Logs ({adminEmails.length})
                    </button>
                    <button 
                      className={`tab-btn ${adminTab === 'metrics' ? 'active' : ''}`}
                      onClick={() => setAdminTab('metrics')}
                    >
                      Metrics Summary
                    </button>
                    <button 
                      className={`tab-btn ${adminTab === 'verification-logs' ? 'active' : ''}`}
                      onClick={() => setAdminTab('verification-logs')}
                    >
                      Verification Logs ({adminVerificationLogs.length})
                    </button>
                    <button 
                      className={`tab-btn ${adminTab === 'verifications' ? 'active' : ''}`}
                      onClick={() => setAdminTab('verifications')}
                    >
                      Pending Verifications ({adminBookings.filter(b => b.verificationStatus === 'Pending').length})
                    </button>
                    <button 
                      className={`tab-btn ${adminTab === 'reviews' ? 'active' : ''}`}
                      onClick={() => setAdminTab('reviews')}
                    >
                      Customer Reviews ({reviews.length})
                    </button>
                    <button 
                      className={`tab-btn ${adminTab === 'verified-accounts' ? 'active' : ''}`}
                      onClick={() => { setAdminTab('verified-accounts'); fetchAdminData(); }}
                    >
                      Verified Docs & Bills ({adminBookings.filter(b => b.verificationStatus === 'Approved').length})
                    </button>
                  </div>

                  <button 
                    className="btn-clipboard" 
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                    onClick={() => {
                      setIsAdminLoggedIn(false);
                      localStorage.removeItem('eliteAdminToken');
                      setAdminUsername('');
                      setAdminPassword('');
                      showToast('Logged out of Admin Portal.');
                      setView('home');
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>

              {/* Tab 1: Bookings Management */}
              {adminTab === 'bookings' && (
                <div className="glass-panel">
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Active Booking Orders</h3>
                  
                  {adminBookings.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No rental bookings have been placed yet.
                    </div>
                  ) : (
                    <>
                      {/* Filters & Export controls */}
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '12px', 
                        alignItems: 'center', 
                        marginBottom: '20px', 
                        padding: '14px', 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '10px' 
                      }}>
                        {/* Filter Year */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '110px', flex: '1 1 auto' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Filter Year</label>
                          <select 
                            className="form-input" 
                            style={{ padding: '6px 12px', fontSize: '13px', height: '36px', background: 'var(--bg-light-dark)' }}
                            value={adminBookingFilterYear}
                            onChange={(e) => setAdminBookingFilterYear(e.target.value)}
                          >
                            <option value="All">All Years</option>
                            {getAdminBookingYears().map(yr => (
                              <option key={yr} value={yr}>{yr}</option>
                            ))}
                          </select>
                        </div>

                        {/* Filter Month */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px', flex: '1 1 auto' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Filter Month</label>
                          <select 
                            className="form-input" 
                            style={{ padding: '6px 12px', fontSize: '13px', height: '36px', background: 'var(--bg-light-dark)' }}
                            value={adminBookingFilterMonth}
                            onChange={(e) => setAdminBookingFilterMonth(e.target.value)}
                          >
                            <option value="All">All Months</option>
                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        {/* Filter Date */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px', flex: '1 1 auto' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Specific Date</label>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input 
                              type="date" 
                              className="form-input" 
                              style={{ padding: '6px 12px', fontSize: '13px', height: '36px', background: 'var(--bg-light-dark)', flex: 1 }}
                              value={adminBookingFilterDate}
                              onChange={(e) => setAdminBookingFilterDate(e.target.value)}
                            />
                            {adminBookingFilterDate && (
                              <button 
                                className="btn-clipboard" 
                                style={{ margin: 0, padding: '6px 10px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                                onClick={() => setAdminBookingFilterDate('')}
                                title="Clear date filter"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Sort By */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px', flex: '1 1 auto' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Sort Bookings</label>
                          <select 
                            className="form-input" 
                            style={{ padding: '6px 12px', fontSize: '13px', height: '36px', background: 'var(--bg-light-dark)' }}
                            value={adminBookingSortBy}
                            onChange={(e) => setAdminBookingSortBy(e.target.value)}
                          >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="amount-high">Price: High to Low</option>
                            <option value="amount-low">Price: Low to High</option>
                          </select>
                        </div>

                        {/* Actions / Export Buttons */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flex: '2 1 auto', justifyContent: 'flex-end' }}>
                          {(adminBookingFilterYear !== 'All' || adminBookingFilterMonth !== 'All' || adminBookingFilterDate) && (
                            <button 
                              className="btn-clipboard"
                              style={{ margin: 0, height: '36px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                              onClick={() => {
                                setAdminBookingFilterYear('All');
                                setAdminBookingFilterMonth('All');
                                setAdminBookingFilterDate('');
                              }}
                            >
                              Clear Filters
                            </button>
                          )}
                          <button 
                            className="btn-clipboard"
                            style={{ margin: 0, height: '36px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => exportBookingsToCSV(getFilteredAndSortedBookings())}
                          >
                            <FileSpreadsheet size={14} /> Export CSV
                          </button>
                          <button 
                            className="btn-rent-now"
                            style={{ margin: 0, width: 'auto', padding: '0 16px', height: '36px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => exportBookingsToPDF(getFilteredAndSortedBookings())}
                          >
                            <FileText size={14} /> Download PDF
                          </button>
                        </div>
                      </div>

                      {getFilteredAndSortedBookings().length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No rental bookings match the selected filter criteria.
                        </div>
                      ) : (
                        <div className="admin-table-container">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>Booking ID</th>
                                <th>Customer Details</th>
                                <th>Rental Items</th>
                                <th>Dates / Slot</th>
                                <th>Total Cost</th>
                                <th>Payment Status</th>
                                <th>Action Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getFilteredAndSortedBookings().map((b) => (
                                <tr key={b.id}>
                                  <td style={{ fontWeight: 'bold' }}>{b.id}</td>
                                  <td>
                                    <div><strong>{b.customerName}</strong></div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{b.phone}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{b.address}</div>
                                  </td>
                                  <td>
                                    {b.items.map((item, idx) => (
                                      <div key={idx} style={{ fontSize: '12px' }}>
                                        {item.name} ({item.quantity}x)
                                      </div>
                                    ))}
                                  </td>
                                  <td>
                                    <div style={{ fontSize: '12px' }}>{b.items[0]?.planLabel}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{b.items[0]?.startDate} to {b.items[0]?.endDate}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Slot: {b.deliverySlot}</div>
                                  </td>
                                  <td style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>₹{b.totalAmount.toFixed(2)}</td>
                                  <td>
                                    <span className={`status-pill ${b.paymentMethod === 'COD' ? 'pending' : 'completed'}`} style={{ fontSize: '10px' }}>
                                      {b.paymentMethod}
                                    </span>
                                    {b.paymentDetails?.transactionId && (
                                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Txn: {b.paymentDetails.transactionId}</div>
                                    )}
                                  </td>
                                  <td>
                                    <select 
                                      className="admin-select-status"
                                      value={b.status}
                                      onChange={(e) => handleUpdateBookingStatus(b.id, e.target.value)}
                                    >
                                      <option value="Booked">Booked</option>
                                      <option value="Ordered">Ordered</option>
                                      <option value="Confirmed">Confirmed</option>
                                      <option value="Cancelled">Cancelled</option>
                                      <option value="Delivered">Delivered</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Refunded">Refunded</option>
                                      <option value="Pending">Pending</option>
                                      <option value="Approved">Approved</option>
                                      <option value="Out for Delivery">Out for Delivery</option>
                                      <option value="Active">Active</option>
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Tab 2: Inventory Catalog */}
              {adminTab === 'products' && (
                <div style={{ display: 'grid', gridTemplateColumns: '60% 38%', gap: '24px' }}>
                  
                  {/* List of existing inventory */}
                  <div className="glass-panel">
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Device Catalog</h3>
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Device</th>
                            <th>Category</th>
                            <th>Stock</th>
                            <th>Plans (1D/3D/1W/2W)</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <img src={p.image} alt={p.name} style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                                  <div>
                                    <strong>{p.name}</strong>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.brand}</div>
                                  </div>
                                </div>
                              </td>
                              <td>{p.category}</td>
                              <td style={{ fontWeight: 'bold', color: p.stock === 0 ? '#ef4444' : 'inherit' }}>{p.stock}</td>
                              <td>
                                <div style={{ fontSize: '11px' }}>
                                  ₹{p.pricePlans[0]?.rate} / ₹{p.pricePlans[1]?.rate} / ₹{p.pricePlans[2]?.rate} / ₹{p.pricePlans[3]?.rate}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button onClick={() => handleEditProductClick(p)} style={{ color: 'var(--accent-cyan)' }}>
                                    <Edit size={16} />
                                  </button>
                                  <button onClick={() => handleDeleteProduct(p.id)} style={{ color: '#ef4444' }}>
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add / Edit Form Panel */}
                  <div className="glass-panel">
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
                      {editingProduct ? "Edit Product" : "Add New Rental Device"}
                    </h3>
                    
                    <form onSubmit={handleSaveProduct} className="auth-form">
                      <div className="form-group">
                        <label>Product ID (Unique String)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. ps5-slim" 
                          required
                          disabled={!!editingProduct}
                          value={newProductForm.id}
                          onChange={(e) => setNewProductForm({...newProductForm, id: e.target.value})}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label>Product Display Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. Sony PlayStation 5 Slim" 
                          required
                          value={newProductForm.name}
                          onChange={(e) => setNewProductForm({...newProductForm, name: e.target.value})}
                        />
                      </div>

                      {/* Image upload section */}
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flexShrink: 0 }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Device Image</label>
                          <div
                            style={{
                              width: '80px', height: '80px', borderRadius: '50%',
                              border: '2px dashed var(--border)', background: 'var(--bg-darker)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', position: 'relative', overflow: 'hidden',
                              transition: 'border-color 0.2s'
                            }}
                            onClick={() => document.getElementById('productImageUpload').click()}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-cyan)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                          >
                            {newProductForm.image && (newProductForm.image.startsWith('data:') || newProductForm.image.startsWith('/')) ? (
                              <img src={newProductForm.image} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : (
                              <>
                                <Camera size={22} style={{ color: 'var(--accent-cyan)' }} />
                                <span style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center', lineHeight: 1.2 }}>Upload</span>
                              </>
                            )}
                            <input
                              id="productImageUpload"
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => setNewProductForm({...newProductForm, image: ev.target.result});
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Or Image URL</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. /images/ps5.png"
                            value={newProductForm.image?.startsWith('data:') ? '' : newProductForm.image}
                            onChange={(e) => setNewProductForm({...newProductForm, image: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="date-pickers-row">
                        <div className="form-group">
                          <label>Category</label>
                          <select 
                            className="form-input"
                            value={newProductForm.category}
                            onChange={(e) => setNewProductForm({...newProductForm, category: e.target.value})}
                          >
                            <option>Gaming Consoles</option>
                            <option>Controllers & Accessories</option>
                            <option>Top Games</option>
                            <option>Gaming TVs & Screens</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Stock Count</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            min="0"
                            required
                            value={newProductForm.stock}
                            onChange={(e) => setNewProductForm({...newProductForm, stock: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Brand Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. Sony" 
                          required
                          value={newProductForm.brand}
                          onChange={(e) => setNewProductForm({...newProductForm, brand: e.target.value})}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label>Rate (1 Day, ₹)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            value={newProductForm.price1}
                            onChange={(e) => setNewProductForm({...newProductForm, price1: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Rate (2 Days, ₹/day)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            value={newProductForm.price2}
                            onChange={(e) => setNewProductForm({...newProductForm, price2: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Rate (3 Days, ₹/day)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            value={newProductForm.price3}
                            onChange={(e) => setNewProductForm({...newProductForm, price3: e.target.value})}
                          />
                        </div>
                        <div className="form-group">
                          <label>Rate (1 Week, ₹/week)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            value={newProductForm.price7}
                            onChange={(e) => setNewProductForm({...newProductForm, price7: e.target.value})}
                          />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label>Rate (1 Month, ₹/month)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            value={newProductForm.price30}
                            onChange={(e) => setNewProductForm({...newProductForm, price30: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>About Description</label>
                        <textarea 
                          className="form-input" 
                          rows="2" 
                          value={newProductForm.about}
                          onChange={(e) => setNewProductForm({...newProductForm, about: e.target.value})}
                        />
                      </div>

                      <div className="form-group">
                        <label>Key Features (One feature per line)</label>
                        <textarea 
                          className="form-input" 
                          rows="2" 
                          placeholder="Feature 1&#10;Feature 2"
                          value={newProductForm.features}
                          onChange={(e) => setNewProductForm({...newProductForm, features: e.target.value})}
                        />
                      </div>

                      <div className="form-group">
                        <label>What's Included (One item per line)</label>
                        <textarea 
                          className="form-input" 
                          rows="2" 
                          placeholder="Console Unit&#10;HDMI Cord"
                          value={newProductForm.included}
                          onChange={(e) => setNewProductForm({...newProductForm, included: e.target.value})}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <button type="submit" className="form-submit-btn" style={{ flexGrow: 1 }}>
                          {editingProduct ? "Update Catalog Item" : "Save to Catalog"}
                        </button>
                        {editingProduct && (
                          <button 
                            type="button" 
                            className="btn-clipboard"
                            onClick={() => {
                              setEditingProduct(null);
                              setNewProductForm({
                                id: '', name: '', category: 'Gaming Consoles', brand: '', 
                                price1: 990, price3: 690, price7: 2990, price14: 2495,
                                stock: 2, about: '', features: '', included: ''
                              });
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Tab: Coupons available management */}
              {adminTab === 'coupons' && (
                <div style={{ display: 'grid', gridTemplateColumns: '60% 38%', gap: '24px' }}>
                  {/* Coupon List */}
                  <div className="glass-panel">
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Active Promo Coupons</h3>
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Discount</th>
                            <th>Min Rentals</th>
                            <th>Description</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminCoupons.map((c) => (
                            <tr key={c.code}>
                              <td style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{c.code}</td>
                              <td>{c.discountType === 'percent' ? `${c.value}%` : `₹${c.value}`}</td>
                              <td>{c.minOrders || 0}</td>
                              <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.description}</td>
                              <td>
                                <button 
                                  className="btn-clipboard" 
                                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '4px 8px', margin: 0 }}
                                  onClick={() => handleDeleteCoupon(c.code)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add Coupon Form */}
                  <div className="glass-panel">
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Create Promo Code</h3>
                    <form onSubmit={handleAddCoupon} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group">
                        <label>Promo Code (Uppercase, no spaces)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          required 
                          placeholder="e.g. SUMMER20"
                          value={adminNewCoupon.code}
                          onChange={(e) => setAdminNewCoupon({...adminNewCoupon, code: e.target.value.toUpperCase().replace(/\s+/g, '')})}
                        />
                      </div>

                      <div className="form-group">
                        <label>Discount Type</label>
                        <select 
                          className="form-input"
                          value={adminNewCoupon.discountType}
                          onChange={(e) => setAdminNewCoupon({...adminNewCoupon, discountType: e.target.value})}
                        >
                          <option value="percent">Percentage (%)</option>
                          <option value="flat">Flat Value (₹)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Discount Value</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          required 
                          min="1"
                          placeholder="e.g. 10 or 150"
                          value={adminNewCoupon.value}
                          onChange={(e) => setAdminNewCoupon({...adminNewCoupon, value: parseFloat(e.target.value) || ''})}
                        />
                      </div>

                      <div className="form-group">
                        <label>Min Completed Rentals Required</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          min="0"
                          placeholder="0"
                          value={adminNewCoupon.minOrders}
                          onChange={(e) => setAdminNewCoupon({...adminNewCoupon, minOrders: parseInt(e.target.value) || 0})}
                        />
                      </div>

                      <div className="form-group">
                        <label>Brief Description</label>
                        <textarea 
                          className="form-input" 
                          rows="2" 
                          placeholder="e.g. Get 10% off your purchase."
                          value={adminNewCoupon.description}
                          onChange={(e) => setAdminNewCoupon({...adminNewCoupon, description: e.target.value})}
                        />
                      </div>

                      <button type="submit" className="form-submit-btn" style={{ marginTop: '8px' }}>
                        Add Coupon
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Tab: Email logs system feed */}
              {adminTab === 'emails' && (
                <div className="glass-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>System Mail Log (Global Notification Feed)</h3>
                    <button className="btn-clipboard" onClick={fetchAdminEmails} style={{ fontSize: '12px', margin: 0 }}>
                      Refresh Feed
                    </button>
                  </div>

                  {adminEmails.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No simulated email logs found in database.
                    </div>
                  ) : (
                    <div className="admin-table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th style={{ width: '20%' }}>Recipient</th>
                            <th style={{ width: '25%' }}>Subject</th>
                            <th style={{ width: '15%' }}>Timestamp</th>
                            <th style={{ width: '40%' }}>Content Message Body</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminEmails.map((email, idx) => (
                            <tr key={idx} style={{ verticalAlign: 'top' }}>
                              <td style={{ fontWeight: '600', color: 'var(--accent-cyan)', fontSize: '12.5px' }}>{email.to}</td>
                              <td style={{ fontWeight: '500', fontSize: '12.5px' }}>{email.subject}</td>
                              <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {new Date(email.timestamp || email.createdAt).toLocaleString()}
                              </td>
                              <td>
                                <pre style={{ 
                                  whiteSpace: 'pre-wrap', 
                                  fontFamily: 'monospace', 
                                  fontSize: '11px', 
                                  color: 'var(--text-secondary)',
                                  background: 'rgba(0,0,0,0.2)',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  margin: 0,
                                  border: '1px solid var(--border)'
                                }}>
                                  {email.body}
                                </pre>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Metrics summary */}
              {adminTab === 'metrics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="metrics-row">
                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box">
                        <Activity size={24} />
                      </div>
                      <div className="metric-val-col">
                        <span className="metric-title">Gross Rental Sales</span>
                        <span className="metric-value">₹{getMetrics().revenue.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box">
                        <FileSpreadsheet size={24} />
                      </div>
                      <div className="metric-val-col">
                        <span className="metric-title">Total Rental Bookings</span>
                        <span className="metric-value">{getMetrics().totalBookings}</span>
                      </div>
                    </div>

                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box">
                        <CheckCircle2 size={24} />
                      </div>
                      <div className="metric-val-col">
                        <span className="metric-title">Active Devices Out</span>
                        <span className="metric-value">{getMetrics().activeRentals}</span>
                      </div>
                    </div>

                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box">
                        <AlertCircle size={24} style={{ color: getMetrics().lowStock > 0 ? '#ef4444' : 'inherit' }} />
                      </div>
                      <div className="metric-val-col">
                        <span className="metric-title">Out of Stock Items</span>
                        <span className="metric-value" style={{ color: getMetrics().lowStock > 0 ? '#ef4444' : 'inherit' }}>{getMetrics().lowStock}</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel">
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Business Metrics Analytics</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      Elite PS Rentals is currently tracking 100% rental operations locally in Vasai West. Gross sales calculations represent booked amounts from all approved, out-for-delivery, active, and completed orders. Cancellations automatically release equipment stock back to the store catalog catalog database.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab: Verification logs system feed */}
              {adminTab === 'verification-logs' && (
                <div className="glass-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                      Real-Time Verification Logs (Gateway Audits)
                    </h3>
                    <button className="btn-clipboard" onClick={fetchAdminVerificationLogs} style={{ fontSize: '12px', margin: 0 }}>
                      Refresh Logs
                    </button>
                  </div>

                  {adminVerificationLogs.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No verification logs found in database.
                    </div>
                  ) : (
                    <div className="admin-table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Session ID</th>
                            <th>Target / Info</th>
                            <th>Channel Type</th>
                            <th>Event Action</th>
                            <th>Gateway Status Response</th>
                            <th>Audit Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminVerificationLogs.map((log, idx) => (
                            <tr key={idx} style={{ verticalAlign: 'top' }}>
                              <td style={{ fontWeight: '600', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {log.signupSessionId || log.email || 'N/A'}
                              </td>
                              <td>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                                  {log.target}
                                </div>
                                {log.name && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    Name: {log.name}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className={`status-pill ${log.type === 'email' ? 'completed' : 'pending'}`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                                  {log.type}
                                </span>
                              </td>
                              <td>
                                <span className="status-pill" style={{ 
                                  fontSize: '10px', 
                                  background: log.action === 'verified' || log.action === 'success' ? 'rgba(16, 185, 129, 0.15)' : log.action === 'failed' || log.action === 'expired' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                  color: log.action === 'verified' || log.action === 'success' ? '#10b981' : log.action === 'failed' || log.action === 'expired' ? '#ef4444' : '#fff'
                                }}>
                                  {log.action}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', maxWidth: '300px', wordBreak: 'break-all' }}>
                                  {log.gatewayResponse ? JSON.stringify(log.gatewayResponse) : 'N/A'}
                                </div>
                              </td>
                              <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {adminTab === 'verifications' && (() => {
                const pendingBookings = adminBookings.filter(b => b.verificationStatus === 'Pending');
                return (
                  <div className="glass-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                        Manual Document Verifications
                      </h3>
                      <button className="btn-clipboard" onClick={fetchAdminData} style={{ fontSize: '12px', margin: 0 }}>
                        Refresh
                      </button>
                    </div>

                    {pendingBookings.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        🎉 No bookings are currently pending verification!
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {pendingBookings.map((b) => (
                          <div key={b.id} className="glass-panel" style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                              <div>
                                <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 'bold', textTransform: 'uppercase', display: 'block' }}>Booking Reference</span>
                                <strong style={{ fontSize: '15px' }}>{b.id}</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '10px' }}>Placed on: {new Date(b.createdAt).toLocaleString()}</span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>UPI Transaction ID</span>
                                <strong style={{ fontSize: '14px', color: 'var(--accent-cyan)' }}>{b.paymentDetails?.transactionId || 'N/A'}</strong>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '16px' }}>
                              <div>
                                <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Renter Details</h4>
                                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div><strong>Name:</strong> {b.customerName}</div>
                                  <div><strong>Phone:</strong> {b.phone}</div>
                                  <div><strong>Email:</strong> {b.email}</div>
                                  <div><strong>Address:</strong> {b.address}</div>
                                  <div><strong>Total Amount:</strong> ₹{b.totalAmount.toFixed(2)}</div>
                                </div>
                                <div style={{ marginTop: '12px' }}>
                                  <strong>Items:</strong>
                                  <ul style={{ margin: '4px 0', paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {b.items.map((item, i) => (
                                      <li key={i}>{item.name} ({item.quantity}x) - {item.planLabel}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              <div>
                                <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>Verification Documents</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                  <div style={{ textAlign: 'center' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>CUSTOMER SELFIE</span>
                                    {b.selfie ? (
                                      <img src={b.selfie} alt="Selfie" style={{ maxWidth: '100%', maxHeight: '130px', borderRadius: '6px', border: '1px solid var(--border)', objectFit: 'contain' }} />
                                    ) : (
                                      <div style={{ height: '130px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px dashed var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>No Selfie</div>
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>ID DOCUMENT</span>
                                    {b.identityID ? (
                                      <img src={b.identityID} alt="ID Document" style={{ maxWidth: '100%', maxHeight: '130px', borderRadius: '6px', border: '1px solid var(--border)', objectFit: 'contain' }} />
                                    ) : (
                                      <div style={{ height: '130px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px dashed var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>No ID Proof</div>
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>E-SIGNATURE</span>
                                    {b.signature ? (
                                      <img src={b.signature} alt="Signature" style={{ maxWidth: '100%', maxHeight: '130px', borderRadius: '6px', border: '1px solid var(--border)', objectFit: 'contain', background: 'rgba(255,255,255,0.05)' }} />
                                    ) : (
                                      <div style={{ height: '130px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px dashed var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>No Signature</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                              <button 
                                className="btn-rent-now" 
                                style={{ width: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                onClick={() => handleVerifyDocuments(b.id, 'Rejected')}
                              >
                                Reject Documents
                              </button>
                              <button 
                                className="btn-rent-now" 
                                style={{ width: 'auto' }}
                                onClick={() => handleVerifyDocuments(b.id, 'Approved')}
                              >
                                Approve Documents & Confirm
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {adminTab === 'reviews' && (
                <div className="glass-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                      Customer Reviews & Feedback Management
                    </h3>
                    <button className="btn-clipboard" onClick={fetchReviews} style={{ fontSize: '12px', margin: 0 }}>
                      Refresh Reviews
                    </button>
                  </div>

                  {/* Summary Cards */}
                  <div className="metrics-row" style={{ marginBottom: '24px' }}>
                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box">⭐</div>
                      <div className="metric-val-col">
                        <span className="metric-title">Average Rating</span>
                        <span className="metric-value">{getAvgRating(reviews) || '0.0'} / 5.0</span>
                      </div>
                    </div>
                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box">💬</div>
                      <div className="metric-val-col">
                        <span className="metric-title">Total Reviews</span>
                        <span className="metric-value">{reviews.length}</span>
                      </div>
                    </div>
                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box">🚚</div>
                      <div className="metric-val-col">
                        <span className="metric-title">Avg Delivery Rating</span>
                        <span className="metric-value">
                          {(reviews.filter(r => r.deliveryRating).reduce((acc, r) => acc + r.deliveryRating, 0) / (reviews.filter(r => r.deliveryRating).length || 1)).toFixed(1)} / 5.0
                        </span>
                      </div>
                    </div>
                    <div className="glass-panel metric-card">
                      <div className="metric-icon-box">✨</div>
                      <div className="metric-val-col">
                        <span className="metric-title">Featured Reviews</span>
                        <span className="metric-value">{reviews.filter(r => r.featured).length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reviews Star Filter */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {['All', 5, 4, 3, 2, 1].map((star) => (
                      <button
                        key={star}
                        className={`btn-clipboard ${adminReviewRatingFilter === star ? 'active' : ''}`}
                        onClick={() => setAdminReviewRatingFilter(star)}
                        style={{
                          margin: 0,
                          padding: '6px 12px',
                          fontSize: '12px',
                          borderColor: adminReviewRatingFilter === star ? 'var(--accent-cyan)' : 'var(--border)',
                          background: adminReviewRatingFilter === star ? '#00e5ff0a' : 'transparent',
                          color: adminReviewRatingFilter === star ? 'var(--accent-cyan)' : 'var(--text-secondary)'
                        }}
                      >
                        {star === 'All' ? 'All Stars' : `${star} ★`}
                      </button>
                    ))}
                  </div>

                  {/* Reviews Table */}
                  {reviews.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No reviews found.
                    </div>
                  ) : (
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>User/Customer</th>
                            <th>Product</th>
                            <th>Rating</th>
                            <th>Comment</th>
                            <th>Date</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviews
                            .filter(r => adminReviewRatingFilter === 'All' || r.rating === adminReviewRatingFilter)
                            .map((rev) => (
                              <tr key={rev.id}>
                                <td>
                                  <div>
                                    <strong>{rev.customerName}</strong>
                                    {rev.bookingId && (
                                      <div style={{ fontSize: '10px', color: 'var(--accent-green)' }}>
                                        Verified (ID: {rev.bookingId})
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontSize: '12.5px' }}>{rev.productName || 'General Package'}</div>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{rev.productId || 'general'}</span>
                                </td>
                                <td>
                                  <div>Prod: {renderStars(rev.rating)}</div>
                                  {rev.deliveryRating && (
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                      Deliv: {rev.deliveryRating} ★
                                    </div>
                                  )}
                                </td>
                                <td style={{ maxWidth: '300px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                  {rev.comment}
                                </td>
                                <td>
                                  {new Date(rev.createdAt).toLocaleDateString()}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      className="btn-signin"
                                      onClick={() => toggleFeatureReview(rev.id)}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        margin: 0,
                                        background: rev.featured ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                                        borderColor: rev.featured ? 'var(--accent-cyan)' : 'var(--border)'
                                      }}
                                    >
                                      {rev.featured ? '★ Featured' : 'Feature'}
                                    </button>
                                    <button
                                      className="btn-clipboard"
                                      onClick={() => deleteReview(rev.id)}
                                      style={{
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        margin: 0,
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#ef4444',
                                        borderColor: 'rgba(239, 68, 68, 0.2)'
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {adminTab === 'verified-accounts' && (() => {
                const approvedBookings = adminBookings.filter(b => b.verificationStatus === 'Approved');
                return (
                  <div className="glass-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#fff' }}>
                          ✅ Verified Documents & Bills
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                          Bookings approved by admin with completed document verification • Total: {approvedBookings.length}
                        </p>
                      </div>
                      <button className="btn-clipboard" onClick={fetchAdminData} style={{ fontSize: '12px', margin: 0 }}>
                        Refresh
                      </button>
                    </div>

                    {approvedBookings.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No approved bookings yet. Approve documents from the Pending Verifications tab.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {approvedBookings.map((b, idx) => (
                          <div key={b.id} style={{ border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', background: 'rgba(16,185,129,0.03)', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ background: 'rgba(16,185,129,0.08)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', fontSize: '14px', fontFamily: 'monospace' }}>{b.id}</span>
                                <span className="status-pill completed" style={{ fontSize: '10px' }}>✅ APPROVED</span>
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(b.createdAt).toLocaleString('en-IN')}</span>
                            </div>

                            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                              {/* Customer Info */}
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>Renter</div>
                                <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>{b.customerName}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>📞 {b.phone}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>✉️ {b.email}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>📍 {b.address}</div>
                              </div>

                              {/* Items */}
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>Rented Items</div>
                                {(b.items || []).map((item, i) => (
                                  <div key={i} style={{ fontSize: '12px', color: '#fff', marginBottom: '4px' }}>
                                    🎮 {item.name} ({item.planLabel})<br />
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.startDate} → {item.endDate}</span>
                                  </div>
                                ))}
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>🚚 {b.deliverySlot}</div>
                              </div>

                              {/* Bill Summary */}
                              <div>
                                <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>Bill Summary</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Payment: <strong style={{ color: '#fff' }}>{b.paymentMethod}</strong></div>
                                {b.paymentDetails?.transactionId && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Txn ID: {b.paymentDetails.transactionId}</div>
                                )}
                                {b.couponCode && (
                                  <div style={{ fontSize: '11px', color: '#10b981' }}>Coupon: {b.couponCode} (-₹{b.discountAmount?.toFixed(2)})</div>
                                )}
                                <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--accent-cyan)', marginTop: '6px' }}>₹{b.totalAmount?.toFixed(2)}</div>
                                <div style={{ fontSize: '10px', color: '#10b981' }}>✓ Paid & Verified</div>
                              </div>
                            </div>

                            {/* Document Proofs */}
                            {(b.selfie || b.identityID || b.signature) && (
                              <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(16,185,129,0.15)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>VERIFICATION DOCS:</span>
                                {b.selfie && <span style={{ fontSize: '11px', color: '#10b981' }}>✅ Selfie</span>}
                                {b.identityID && <span style={{ fontSize: '11px', color: '#10b981' }}>✅ ID Proof</span>}
                                {b.signature && <span style={{ fontSize: '11px', color: '#10b981' }}>✅ E-Signature</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* CUSTOMER LOGIN VIEW */}
      {view === 'login' && (
        <div className="admin-dashboard-container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', margin: '40px auto' }}>
            {showForgotFlow ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <Lock size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Reset Password</h3>
                </div>

                {forgotStep === 1 ? (
                  <form onSubmit={handleForgotSubmit} className="auth-form">
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
                      Enter your account email below, and we will send a password reset code.
                    </p>
                    <div className="form-group">
                      <label>Email Address</label>
                      <input 
                        type="email" 
                        className="form-input" 
                        required 
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="form-submit-btn" style={{ width: '100%', marginTop: '10px' }}>
                      Send Reset OTP
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPasswordSubmit} className="auth-form">
                    <div className="form-group">
                      <label>Verification OTP</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        required 
                        placeholder="Paste code here..."
                        value={forgotCode}
                        onChange={(e) => setForgotCode(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>New Password</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        required 
                        value={forgotPassword}
                        onChange={(e) => setForgotPassword(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Confirm Password</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        required 
                        value={forgotPasswordConfirm}
                        onChange={(e) => setForgotPasswordConfirm(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="form-submit-btn" style={{ width: '100%', marginTop: '10px' }}>
                      Reset Password
                    </button>
                  </form>
                )}

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', fontSize: '13px' }}>
                  <span onClick={() => { setShowForgotFlow(false); setForgotStep(1); }} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 'bold' }}>
                    Back to Sign In
                  </span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <User size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>User Authenticator</h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Sign in to manage your bookings, view your payment history, and place fast zero-deposit rentals.
                </p>

                <form onSubmit={handleUserLogin} className="auth-form" autoComplete="off">
                  <div className="form-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      required 
                      autoComplete="new-password"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      required 
                      autoComplete="new-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="form-submit-btn" style={{ width: '100%' }}>
                    Sign In
                  </button>
                </form>

                <div style={{ margin: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <div style={{ flexGrow: 1, height: '1px', background: 'var(--border)' }}></div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>OR</span>
                  <div style={{ flexGrow: 1, height: '1px', background: 'var(--border)' }}></div>
                </div>

                <button
                  type="button"
                  className="btn-signin"
                  onClick={handleGoogleLogin}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    background: '#ffffff',
                    color: '#000',
                    border: '1px solid #ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '30px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block' }}>
                    <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.78 2.16c1.63-1.5 2.57-3.7 2.57-6.3a8.6 8.6 0 0 0-.21-2.19Z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.78-2.16c-.77.52-1.76.83-2.96.83a5.55 5.55 0 0 1-5.23-3.84H1.1v2.24A9 9 0 0 0 9 18Z"/>
                    <path fill="#FBBC05" d="M3.77 10.63a5.4 5.4 0 0 1 0-3.26V5.13H1.1a9 9 0 0 0 0 7.74l2.67-2.24Z"/>
                    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 1.1 5.13l2.67 2.24A5.55 5.55 0 0 1 9 3.58Z"/>
                  </svg>
                  Sign In With Google
                </button>

                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', fontSize: '13px' }}>
                  <span onClick={() => setShowForgotFlow(true)} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '12px' }}>
                    Forgot Password?
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    New to Elite PS?{' '}
                    <span onClick={() => setView('signup')} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 'bold' }}>
                      Sign Up
                    </span>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {view === 'signup' && (
        <div className="admin-dashboard-container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', margin: '40px auto' }}>
            {signupStep === 1 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <User size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Create Customer Account</h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Sign up today for zero-security-deposit renting and instant document verification.
                </p>

                <form onSubmit={handleUserSignup} className="auth-form">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      required 
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Mobile Number</label>
                    <div style={{ display: 'flex', marginTop: '4px', width: '100%' }}>
                      <span style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--bg-light-dark)', 
                        border: '1px solid var(--border)', 
                        borderRight: 'none', 
                        borderTopLeftRadius: '8px', 
                        borderBottomLeftRadius: '8px', 
                        padding: '0 12px', 
                        color: 'var(--accent-cyan)', 
                        fontWeight: 'bold', 
                        fontSize: '14px' 
                      }}>+91</span>
                      <input 
                        type="tel" 
                        className="form-input" 
                        placeholder="98765 43210"
                        required 
                        style={{ 
                          flex: 1, 
                          borderTopLeftRadius: 0, 
                          borderBottomLeftRadius: 0,
                          marginTop: 0 
                        }} 
                        value={signupPhone.replace(/^\+91\s*/, '')}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setSignupPhone(val ? `+91 ${val}` : '');
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      required 
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="form-submit-btn" style={{ width: '100%' }}>
                    Create Account
                  </button>
                </form>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Already have an account?{' '}
                    <span onClick={() => { setView('login'); setSignupStep(1); }} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 'bold' }}>
                      Sign In
                    </span>
                  </span>
                </div>
              </>
            )}

            {signupStep === 2 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <Mail size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Verify Email OTP</h3>
                </div>

                {devOtpHint && (
                  <div style={{
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.35)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px'
                  }}>
                    <span style={{ fontSize: '18px' }}>⚠️</span>
                    <div>
                      <strong style={{ color: '#eab308' }}>Dev Mode</strong>
                      <span style={{ color: 'var(--text-secondary)' }}> — SMTP not configured. Your Email OTP: </span>
                      <strong style={{ color: '#fff', fontFamily: 'monospace', fontSize: '15px', letterSpacing: '2px' }}>{devOtpHint}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                        To receive real emails, add SMTP_USER and SMTP_PASS to backend/.env
                      </span>
                    </div>
                  </div>
                )}
                
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.4' }}>
                  We have sent a verification OTP code to <strong>{signupEmail}</strong>. Please check your inbox (or check the yellow banner in Dev Mode) and enter the 6-digit code below:
                </p>

                <form onSubmit={(e) => { e.preventDefault(); handleVerifyEmailOtp(); }} className="auth-form">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '20px' }}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`email-otp-input-${idx}`}
                        type="text"
                        maxLength={1}
                        pattern="\d*"
                        inputMode="numeric"
                        style={{
                          width: '48px',
                          height: '52px',
                          textAlign: 'center',
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#fff',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'all 0.2s ease'
                        }}
                        className="otp-digit-box"
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value, setOtpDigits, 'email-otp')}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e, otpDigits, setOtpDigits, 'email-otp')}
                        onPaste={(e) => handleOtpPaste(e, setOtpDigits, 'email-otp')}
                        required
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <button 
                    type="submit" 
                    className="form-submit-btn" 
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="loading-spinner"></span> Verifying...
                      </>
                    ) : (
                      'Verify Email Address'
                    )}
                  </button>
                </form>

                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  {timer > 0 ? (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Resend code in <strong style={{ color: 'var(--accent-cyan)' }}>{formatTimer(timer)}</strong>
                    </span>
                  ) : (
                    <button 
                      onClick={handleResendEmailOtp} 
                      className="btn-link"
                      style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
                      disabled={isSubmitting}
                    >
                      Resend Email OTP
                    </button>
                  )}
                  <span onClick={() => { setSignupStep(1); }} style={{ color: 'var(--text-muted)', cursor: 'pointer', fontWeight: '500', fontSize: '12px', marginTop: '10px' }}>
                    ← Back to Sign Up form
                  </span>
                </div>
              </>
            )}

            {signupStep === 3 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <Smartphone size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Verify Mobile OTP</h3>
                </div>

                {devOtpHint && (
                  <div style={{
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.35)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '13px'
                  }}>
                    <span style={{ fontSize: '18px' }}>⚠️</span>
                    <div>
                      <strong style={{ color: '#eab308' }}>Dev Mode</strong>
                      <span style={{ color: 'var(--text-secondary)' }}> — Twilio not configured. Your SMS OTP: </span>
                      <strong style={{ color: '#fff', fontFamily: 'monospace', fontSize: '15px', letterSpacing: '2px' }}>{devOtpHint}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginTop: '2px' }}>
                        To receive real SMS, add Twilio credentials to backend/.env
                      </span>
                    </div>
                  </div>
                )}
                
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.4' }}>
                  An SMS text OTP code has been dispatched to <strong>{signupPhone}</strong>. Please enter the 6-digit code below to finish verification (or check the yellow banner in Dev Mode):
                </p>

                <form onSubmit={(e) => { e.preventDefault(); handleVerifyMobileOtp(); }} className="auth-form">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '20px' }}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`mobile-otp-input-${idx}`}
                        type="text"
                        maxLength={1}
                        pattern="\d*"
                        inputMode="numeric"
                        style={{
                          width: '48px',
                          height: '52px',
                          textAlign: 'center',
                          fontSize: '20px',
                          fontWeight: 'bold',
                          color: '#fff',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'all 0.2s ease'
                        }}
                        className="otp-digit-box"
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value, setOtpDigits, 'mobile-otp')}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e, otpDigits, setOtpDigits, 'mobile-otp')}
                        onPaste={(e) => handleOtpPaste(e, setOtpDigits, 'mobile-otp')}
                        required
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <button 
                    type="submit" 
                    className="form-submit-btn" 
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="loading-spinner"></span> Completing Signup...
                      </>
                    ) : (
                      'Verify Mobile & Register'
                    )}
                  </button>
                </form>

                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  {timer > 0 ? (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Resend code in <strong style={{ color: 'var(--accent-cyan)' }}>{formatTimer(timer)}</strong>
                    </span>
                  ) : (
                    <button 
                      onClick={handleResendMobileOtp} 
                      className="btn-link"
                      style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
                      disabled={isSubmitting}
                    >
                      Resend SMS OTP
                    </button>
                  )}
                  <span onClick={() => { setSignupStep(1); }} style={{ color: 'var(--text-muted)', cursor: 'pointer', fontWeight: '500', fontSize: '12px', marginTop: '10px' }}>
                    ← Restart Sign Up
                  </span>
                </div>
              </>
            )}

            {signupStep === 4 && (
              <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                <div style={{ fontSize: '54px', color: '#10b981', marginBottom: '16px' }}>✔️</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: '#fff' }}>
                  Account Created Successfully!
                </h3>
                <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
                  Your mobile number has been verified successfully. Your premium gaming account is active.
                </p>
                <button 
                  onClick={() => {
                    if (redirectAfterLogin === 'checkout') {
                      setView('checkout');
                      setCheckoutStep(1);
                      setRedirectAfterLogin(null);
                    } else {
                      setView('home');
                    }
                    setSignupStep(1);
                    setSignupName('');
                    setSignupEmail('');
                    setSignupPassword('');
                    setSignupPhone('');
                  }}
                  className="form-submit-btn" 
                  style={{ width: '100%' }}
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}


      {/* CLIENT DASHBOARD / MY ACCOUNT VIEW */}
      {view === 'client-dashboard' && (
        <div className="admin-dashboard-container" style={{ minHeight: '60vh' }}>
          <div className="admin-header-row" style={{ marginBottom: '24px' }}>
            <div>
              <h2 className="section-title" style={{ textAlign: 'left', margin: 0 }}>
                My <span>Account</span>
              </h2>
              <p className="section-subtitle">Welcome back, {userProfile?.name}</p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button 
                className="btn-clipboard"
                onClick={() => { setView('home'); }}
                style={{ fontSize: '13px' }}
              >
                Browse Catalog
              </button>
              <button 
                className="btn-clipboard" 
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '13px' }}
                onClick={handleUserLogout}
              >
                Logout
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '68% 30%', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Client Dashboard Navigation Tabs removed as they are moved to the hamburger menu */}

              {/* Tab 1: Booking History with Delivery Status */}
              {clientTab === 'bookings' && (() => {
                const pendingReviewBookings = userBookings.filter(b => b.status === 'Delivered' && !reviews.some(r => r.bookingId === b.id));
                return (
                  <>
                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', marginBottom: '6px' }}>
                    My Rentals & Booking History
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Track the delivery and status of your consoles below.</p>

                  {userBookings.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                      <ShoppingCart size={32} style={{ color: 'var(--text-muted)' }} />
                      <span>You have no active or past rentals.</span>
                      <button className="btn-rent-now" onClick={() => setView('home')} style={{ width: 'auto', padding: '8px 20px' }}>
                        Rent Your First Console
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {userBookings.map((b) => {
                        const rawStatus = b.status || 'Booked';
                        const st = rawStatus.toLowerCase();
                        
                        const isReceived = st === 'completed' || st === 'received';
                        const isOutForDelivery = st === 'active' || st === 'out for delivery';
                        const isConfirmedOrApproved = st === 'confirmed' || st === 'approved';
                        const isCancelled = st === 'cancelled' || st === 'refunded';

                        let statusColor = '#a78bfa'; // purple
                        let statusBg = 'rgba(167,139,250,0.08)';
                        let statusLabel = `⏳ ${rawStatus}`;

                        if (isReceived) {
                          statusColor = '#22c55e'; // green
                          statusBg = 'rgba(34,197,94,0.08)';
                          statusLabel = rawStatus === 'Completed' ? '✅ Completed' : '✅ Received';
                        } else if (isOutForDelivery) {
                          statusColor = '#f59e0b'; // orange
                          statusBg = 'rgba(245,158,11,0.08)';
                          statusLabel = rawStatus === 'Active' ? '🎮 Active' : '🚚 Out for Delivery';
                        } else if (isConfirmedOrApproved) {
                          statusColor = '#00e5ff'; // cyan
                          statusBg = 'rgba(0,229,255,0.08)';
                          statusLabel = rawStatus === 'Confirmed' ? '✨ Confirmed' : '👍 Approved';
                        } else if (isCancelled) {
                          statusColor = '#ef4444'; // red
                          statusBg = 'rgba(239,68,68,0.08)';
                          statusLabel = rawStatus === 'Cancelled' ? '❌ Cancelled' : '💰 Refunded';
                        }

                        return (
                          <div key={b.id} className="glass-panel" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '12px', border: `1px solid ${statusColor}22` }}>
                            {/* Status Banner */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>{b.id}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>•</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{b.paymentMethod}</span>
                              </div>
                              <span style={{ padding: '4px 12px', borderRadius: '20px', background: statusBg, color: statusColor, fontSize: '11px', fontWeight: 'bold', border: `1px solid ${statusColor}44` }}>
                                {statusLabel}
                              </span>
                            </div>

                            {/* Progress Track */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {['Order Placed', 'Out for Delivery', 'Received'].map((step, i) => {
                                const stepDone = isReceived ? true : isOutForDelivery ? i < 2 : i < 1;
                                const stepActive = isOutForDelivery && i === 1;
                                return (
                                  <React.Fragment key={step}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1 }}>
                                      <div style={{
                                        width: '22px', height: '22px', borderRadius: '50%',
                                        background: isCancelled ? 'rgba(239,68,68,0.2)' : stepDone ? statusColor : 'var(--bg-light-dark)',
                                        border: `2px solid ${isCancelled ? '#ef4444' : stepDone ? statusColor : 'var(--border)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '10px', fontWeight: 'bold', color: stepDone && !isCancelled ? '#000' : 'var(--text-muted)'
                                      }}>
                                        {isCancelled ? '✕' : stepDone ? '✓' : i + 1}
                                      </div>
                                      <span style={{ fontSize: '9px', color: stepDone && !isCancelled ? statusColor : 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{step}</span>
                                    </div>
                                    {i < 2 && <div style={{ flex: 2, height: '2px', background: (!isCancelled && ((isReceived) || (isOutForDelivery && i === 0))) ? statusColor : 'var(--border)', borderRadius: '2px', marginBottom: '14px' }} />}
                                  </React.Fragment>
                                );
                              })}
                            </div>

                            {/* Items */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {b.items.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                  <span style={{ fontWeight: '600', color: '#fff' }}>🎮 {item.name}</span>
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{item.planLabel} · {item.startDate} → {item.endDate}</span>
                                </div>
                              ))}
                            </div>

                            {/* Footer */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                  {b.paymentDetails?.transactionId ? `Txn: ${b.paymentDetails.transactionId}` : 'Payment Confirmed'}
                                </span>
                                <button
                                  className="btn-clipboard"
                                  style={{ margin: 0, padding: '4px 10px', fontSize: '11px', width: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => {
                                    setCreatedBooking(b);
                                    setCheckoutStep(4);
                                    setView('checkout');
                                  }}
                                >
                                  📄 View Receipt
                                </button>
                                {(st === 'delivered' || st === 'completed' || st === 'active') && !reviews.some(r => r.bookingId === b.id) && (
                                  <button
                                    className="btn-signin"
                                    style={{ margin: '6px 0 0 0', padding: '4px 10px', fontSize: '11px', width: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => {
                                      setFeedbackBooking(b);
                                      setFeedbackProductRating(5);
                                      setFeedbackDeliveryRating(5);
                                      setFeedbackComment('');
                                      setFeedbackSuccess(false);
                                      setShowFeedbackModal(true);
                                    }}
                                  >
                                    ✍️ Rate &amp; Review
                                  </button>
                                )}
                              </div>
                              <span style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', fontSize: '15px' }}>₹{b.totalAmount.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                  </>
                );
              })()}

              {/* Tab 2: Available Coupons */}
              {clientTab === 'coupons' && (() => {
                const allCoupons = [
                  { code: 'FIRST10', label: 'FIRST10', desc: '10% OFF on your first rental booking order', color: 'var(--accent-cyan)' },
                  { code: 'LOYAL10', label: 'LOYAL10', desc: '10% OFF after completing 3 rentals (loyalty reward)', color: '#a78bfa' },
                  { code: 'ELITE100', label: 'ELITE100', desc: 'Flat ₹100 discount on any rental order', color: '#f59e0b' },
                ];
                const usedCodes = (userBookings || []).filter(b => b.couponCode).map(b => b.couponCode.toUpperCase());
                const availableCoupons = allCoupons.filter(c => !usedCodes.includes(c.code.toUpperCase()));
                return (
                  <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                      🎟️ Your Discount Coupons
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                      These promo codes give you discounts at checkout. Copy a code and paste it in the coupon field during checkout.
                    </p>

                    {availableCoupons.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎉</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>You've used all available coupons. Keep renting to unlock more!</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {availableCoupons.map(c => (
                          <div key={c.code} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(0, 229, 255, 0.03)', border: '1px dashed rgba(0, 229, 255, 0.2)' }}>
                            <div>
                              <span style={{ fontSize: '14.5px', fontWeight: 'bold', color: c.color }}>{c.label}</span>
                              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{c.desc}</p>
                            </div>
                            <button className="btn-clipboard" onClick={() => copyToClipboard(c.code)} style={{ margin: 0 }}>
                              Copy Code
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {usedCodes.length > 0 && (
                      <div style={{ marginTop: '20px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                          ✅ Already used: {usedCodes.map(code => <strong key={code} style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>{code}</strong>)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tab 3: Simulated Mail Log */}
              {clientTab === 'emails' && (
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
                      My Simulated Mail Logs
                    </h3>
                    <button className="btn-clipboard" onClick={() => fetchMyEmails(userToken)} style={{ fontSize: '12px', margin: 0 }}>
                      Refresh Inbox
                    </button>
                  </div>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.4' }}>
                    Mock email communications sent to your account address are logged below:
                  </p>

                  {myEmails.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No mock notifications sent to you yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
                      {myEmails.map((email, idx) => (
                        <div key={idx} className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                            <strong style={{ fontSize: '13.5px', color: 'var(--accent-cyan)' }}>{email.subject}</strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(email.timestamp || email.createdAt).toLocaleString()}</span>
                          </div>
                          <pre style={{ 
                            whiteSpace: 'pre-wrap', 
                            fontFamily: 'monospace', 
                            fontSize: '12px', 
                            color: 'var(--text-secondary)', 
                            margin: 0,
                            lineHeight: '1.4'
                          }}>
                            {email.body}
                          </pre>
                          {email.subject.startsWith('Order Delivered Successfully') && (() => {
                            const match = email.subject.match(/EPB-\d+/);
                            const bId = match ? match[0] : null;
                            const booking = userBookings.find(b => b.id === bId);
                            const hasBeenReviewed = reviews.some(r => r.bookingId === bId);
                            if (booking && !hasBeenReviewed) {
                              return (
                                <button
                                  className="btn-signin"
                                  style={{ marginTop: '10px', padding: '6px 14px', fontSize: '12.5px', width: 'auto', alignSelf: 'flex-start', margin: '8px 0 0 0' }}
                                  onClick={() => {
                                    setFeedbackBooking(booking);
                                    setFeedbackProductRating(5);
                                    setFeedbackDeliveryRating(5);
                                    setFeedbackComment('');
                                    setFeedbackSuccess(false);
                                    setShowFeedbackModal(true);
                                  }}
                                >
                                  ✍️ Rate &amp; Review Your Order
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4b: Verified Documents & Bills */}
              {clientTab === 'verified-docs' && (() => {
                const approvedBookings = userBookings.filter(b => b.verificationStatus === 'Approved');
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Header */}
                    <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#fff' }}>
                          ✅ Verified Documents & Bills
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                          Your admin-approved bookings with confirmed E-Bill invoices
                        </p>
                      </div>
                      <button
                        className="btn-clipboard"
                        onClick={() => fetchUserBookings(userToken)}
                        style={{ fontSize: '12px', margin: 0 }}
                      >
                        🔄 Refresh
                      </button>
                    </div>

                    {approvedBookings.length === 0 ? (
                      <div className="glass-panel" style={{ padding: '50px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                        <div style={{ fontSize: '40px' }}>📋</div>
                        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>No verified bookings yet.</p>
                        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '12px' }}>Once admin approves your documents, your confirmed bookings and bills will appear here.</p>
                      </div>
                    ) : (
                      approvedBookings.map(b => (
                        <div key={b.id} style={{ border: '1px solid rgba(0,229,255,0.25)', borderRadius: '14px', overflow: 'hidden', background: 'rgba(0,229,255,0.02)' }}>

                          {/* Invoice Header */}
                          <div style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.1), rgba(16,185,129,0.08))', padding: '16px 24px', borderBottom: '1px solid rgba(0,229,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '15px', color: 'var(--accent-cyan)' }}>{b.id}</span>
                              <span style={{ padding: '3px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '10px', fontWeight: 'bold', border: '1px solid rgba(16,185,129,0.3)' }}>
                                ✅ APPROVED & CONFIRMED
                              </span>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
                              <div>{new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                              <div>{new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>

                          {/* Invoice Body */}
                          <div style={{ padding: '20px 24px', background: '#0a0d18' }}>
                            {/* Elite PS Rentals Brand + Invoice Title */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '16px' }}>
                              <div>
                                <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-cyan)', margin: '0 0 4px 0', fontSize: '16px' }}>Elite PS Rentals</h4>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Vasai, Palghar, Maharashtra - 401201</span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#fff' }}>E-BILL INVOICE</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Invoice ID: {b.id}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Date: {new Date(b.createdAt).toLocaleDateString('en-IN')}</div>
                              </div>
                            </div>

                            {/* Renter + Delivery */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: '6px', letterSpacing: '0.5px' }}>Renter Information</div>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{b.customerName}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>📞 {b.phone}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>✉️ {b.email}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>📍 {b.address}</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: '6px', letterSpacing: '0.5px' }}>Delivery Schedule</div>
                                <div style={{ fontSize: '12px', color: '#fff' }}>Slot: <strong>{b.deliverySlot}</strong></div>
                                {b.items?.[0] && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    {b.items[0].startDate} → {b.items[0].endDate}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Items Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                  <th style={{ textAlign: 'left', padding: '6px 0' }}>Rental Item</th>
                                  <th style={{ textAlign: 'center', padding: '6px 0' }}>Plan</th>
                                  <th style={{ textAlign: 'center', padding: '6px 0' }}>Dates</th>
                                  <th style={{ textAlign: 'right', padding: '6px 0' }}>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(b.items || []).map((item, i) => (
                                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <td style={{ padding: '8px 0', color: '#fff', fontWeight: '600' }}>🎮 {item.name} {item.quantity > 1 ? `(x${item.quantity})` : ''}</td>
                                    <td style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text-secondary)' }}>{item.planLabel}</td>
                                    <td style={{ textAlign: 'center', padding: '8px 0', color: 'var(--text-secondary)' }}>{item.startDate} → {item.endDate}</td>
                                    <td style={{ textAlign: 'right', padding: '8px 0', color: '#fff' }}>₹{((item.rate || 0) * (item.quantity || 1)).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* Totals + Payment */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '240px' }}>
                                * Zero Deposit rental. Renter agrees to return equipment in original condition.
                              </div>
                              <div style={{ minWidth: '180px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', margin: '3px 0' }}>
                                  <span>Subtotal:</span>
                                  <span>₹{(b.totalAmount ? (b.totalAmount + (b.discountAmount || 0)) / 1.18 : 0).toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', margin: '3px 0' }}>
                                  <span>GST (18%):</span>
                                  <span>₹{(b.totalAmount ? ((b.totalAmount + (b.discountAmount || 0)) / 1.18) * 0.18 : 0).toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#10b981', margin: '3px 0' }}>
                                  <span>Delivery:</span>
                                  <span>FREE 🎉</span>
                                </div>
                                {(b.discountAmount || 0) > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#10b981', margin: '3px 0' }}>
                                    <span>Discount {b.couponCode ? `(${b.couponCode})` : ''}:</span>
                                    <span>-₹{(b.discountAmount || 0).toFixed(2)}</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid var(--border)', paddingTop: '6px', marginTop: '4px' }}>
                                  <span style={{ color: '#fff' }}>Grand Total:</span>
                                  <span style={{ color: 'var(--accent-cyan)', fontSize: '15px' }}>₹{(b.totalAmount || 0).toFixed(2)}</span>
                                </div>
                                <div style={{ fontSize: '10px', color: '#10b981', textAlign: 'right', marginTop: '3px' }}>
                                  ✓ Paid via {b.paymentMethod}
                                  {b.paymentDetails?.transactionId ? ` | Txn: ${b.paymentDetails.transactionId}` : ''}
                                </div>
                              </div>
                            </div>

                            {/* Document Verification Status */}
                            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Submitted Docs:</span>
                              <span style={{ fontSize: '11px', color: b.selfie ? '#10b981' : '#ef4444' }}>{b.selfie ? '✅' : '❌'} Selfie</span>
                              <span style={{ fontSize: '11px', color: b.identityID ? '#10b981' : '#ef4444' }}>{b.identityID ? '✅' : '❌'} ID Proof</span>
                              <span style={{ fontSize: '11px', color: b.signature ? '#10b981' : '#ef4444' }}>{b.signature ? '✅' : '❌'} E-Signature</span>
                              <div style={{ marginLeft: 'auto' }}>
                                <button
                                  className="btn-clipboard"
                                  style={{ margin: 0, padding: '6px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                  onClick={() => {
                                    setCreatedBooking(b);
                                    setCheckoutStep(4);
                                    setView('checkout');
                                  }}
                                >
                                  📄 View Full Receipt & Print
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}

              {/* Tab 4: Profile & Password Change */}
              {clientTab === 'profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Personal info Header */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>
                      Personal info
                    </h3>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.4' }}>
                      Info about you and your preferences across Elite PS Rentals services.
                    </p>

                    {/* Info rows container */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      background: 'rgba(255, 255, 255, 0.02)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}>
                      {/* Row 1: Profile picture */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px', 
                        borderBottom: '1px solid var(--border)' 
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Profile picture</span>
                          <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>A profile picture helps personalize your account</span>
                        </div>
                        <div style={{ 
                          width: '48px', 
                          height: '48px', 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: '#fff', 
                          fontWeight: 'bold', 
                          fontSize: '18px',
                          border: '2px solid rgba(255,255,255,0.2)'
                        }}>
                          {profileName ? profileName.charAt(0).toUpperCase() : 'U'}
                        </div>
                      </div>

                      {/* Row 2: Name */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px', 
                        borderBottom: '1px solid var(--border)' 
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</span>
                          {isEditingProfile ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px' }} 
                              value={profileName} 
                              onChange={(e) => setProfileName(e.target.value)} 
                            />
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileName || 'Not set'}</span>
                          )}
                        </div>
                      </div>

                      {/* Row 3: Gender */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px', 
                        borderBottom: '1px solid var(--border)' 
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gender</span>
                          {isEditingProfile ? (
                            <select 
                              className="form-input" 
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px' }} 
                              value={profileGender} 
                              onChange={(e) => setProfileGender(e.target.value)}
                            >
                              <option value="Female">Female</option>
                              <option value="Male">Male</option>
                              <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileGender}</span>
                          )}
                        </div>
                      </div>

                      {/* Row 4: Email */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px', 
                        borderBottom: '1px solid var(--border)' 
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</span>
                          <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{userProfile?.email}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verified ✓</span>
                      </div>

                      {/* Row 5: Phone */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px', 
                        borderBottom: '1px solid var(--border)' 
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</span>
                          {isEditingProfile ? (
                            <div style={{ display: 'flex', marginTop: '4px', width: '250px' }}>
                              <span style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                background: 'var(--bg-light-dark)', 
                                border: '1px solid var(--border)', 
                                borderRight: 'none', 
                                borderTopLeftRadius: '8px', 
                                borderBottomLeftRadius: '8px', 
                                padding: '0 12px', 
                                color: 'var(--accent-cyan)', 
                                fontWeight: 'bold', 
                                fontSize: '14px' 
                              }}>+91</span>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="98765 43210"
                                style={{ 
                                  flex: 1, 
                                  borderTopLeftRadius: 0, 
                                  borderBottomLeftRadius: 0,
                                  marginTop: 0 
                                }} 
                                value={profilePhone.replace(/^\+91\s*/, '')} 
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                  setProfilePhone(val ? `+91 ${val}` : '');
                                }} 
                              />
                            </div>
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>
                              {profilePhone ? (profilePhone.startsWith('+91') ? profilePhone : `+91 ${profilePhone}`) : 'Not set'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 6: Birthday */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px', 
                        borderBottom: '1px solid var(--border)' 
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Birthday</span>
                          {isEditingProfile ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Select Birthdate"
                              readOnly
                              onClick={() => {
                                const initialDate = parseBirthdayDate(profileBirthday);
                                setDpSelectedDate(initialDate);
                                setDpCurrentMonth(initialDate.getMonth());
                                setDpCurrentYear(initialDate.getFullYear());
                                setShowDatePicker(true);
                              }}
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px', cursor: 'pointer' }} 
                              value={profileBirthday !== 'Not set' ? profileBirthday : ''} 
                            />
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileBirthday}</span>
                          )}
                        </div>
                      </div>

                      {/* Row 7: Language */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px', 
                        borderBottom: '1px solid var(--border)' 
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Language</span>
                          {isEditingProfile ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px' }} 
                              value={profileLanguage} 
                              onChange={(e) => setProfileLanguage(e.target.value)} 
                            />
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileLanguage}</span>
                          )}
                        </div>
                      </div>

                      {/* Row 8: Home Address */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px', 
                        borderBottom: '1px solid var(--border)' 
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Home Address</span>
                          {isEditingProfile ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px' }} 
                              value={profileHomeAddress} 
                              onChange={(e) => setProfileHomeAddress(e.target.value)} 
                            />
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileHomeAddress}</span>
                          )}
                        </div>
                      </div>

                      {/* Row 9: Work Address */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Work Address</span>
                          {isEditingProfile ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px' }} 
                              value={profileWorkAddress} 
                              onChange={(e) => setProfileWorkAddress(e.target.value)} 
                            />
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileWorkAddress}</span>
                          )}
                        </div>
                      </div>

                      {/* Row 10: Aadhaar Number */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aadhaar Number</span>
                          {isEditingProfile ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="e.g. 1234 5678 9012"
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px' }} 
                              value={profileAadhaarNumber} 
                              onChange={(e) => setProfileAadhaarNumber(e.target.value)} 
                            />
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileAadhaarNumber || 'Not set'}</span>
                          )}
                        </div>
                      </div>

                      {/* Row 11: Alternate Phone */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alternate Phone</span>
                          {isEditingProfile ? (
                            <div style={{ display: 'flex', marginTop: '4px', width: '250px' }}>
                              <span style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                background: 'var(--bg-light-dark)', 
                                border: '1px solid var(--border)', 
                                borderRight: 'none', 
                                borderTopLeftRadius: '8px', 
                                borderBottomLeftRadius: '8px', 
                                padding: '0 12px', 
                                color: 'var(--accent-cyan)', 
                                fontWeight: 'bold', 
                                fontSize: '14px' 
                              }}>+91</span>
                              <input 
                                type="text" 
                                className="form-input" 
                                placeholder="98765 43210"
                                style={{ 
                                  flex: 1, 
                                  borderTopLeftRadius: 0, 
                                  borderBottomLeftRadius: 0,
                                  marginTop: 0 
                                }} 
                                value={profileAlternatePhone.replace(/^\+91\s*/, '')} 
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                  setProfileAlternatePhone(val ? `+91 ${val}` : '');
                                }} 
                              />
                            </div>
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>
                              {profileAlternatePhone ? (profileAlternatePhone.startsWith('+91') ? profileAlternatePhone : `+91 ${profileAlternatePhone}`) : 'Not set'}
                            </span>
                          )}
                        </div>
                      </div>



                      {/* Row 14: City */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>City</span>
                          {isEditingProfile ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="e.g. Pune"
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px' }} 
                              value={profileCity} 
                              onChange={(e) => setProfileCity(e.target.value)} 
                            />
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileCity || 'Not set'}</span>
                          )}
                        </div>
                      </div>

                      {/* Row 15: State */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>State</span>
                          {isEditingProfile ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="e.g. Maharashtra"
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px' }} 
                              value={profileState} 
                              onChange={(e) => setProfileState(e.target.value)} 
                            />
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileState || 'Not set'}</span>
                          )}
                        </div>
                      </div>

                      {/* Row 16: Zip Code */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zip Code</span>
                          {isEditingProfile ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="e.g. 411001"
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px' }} 
                              value={profileZipCode} 
                              onChange={(e) => setProfileZipCode(e.target.value)} 
                            />
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileZipCode || 'Not set'}</span>
                          )}
                        </div>
                      </div>



                      {/* Row 18: Company Name */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '16px 20px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Company Name</span>
                          {isEditingProfile ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="e.g. TechCorp"
                              style={{ width: '250px', marginTop: '4px', padding: '6px 12px' }} 
                              value={profileCompanyName} 
                              onChange={(e) => setProfileCompanyName(e.target.value)} 
                            />
                          ) : (
                            <span style={{ fontSize: '15px', fontWeight: '500', color: '#fff' }}>{profileCompanyName || 'Not set'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Edit Profile Action Buttons */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                      {isEditingProfile ? (
                        <>
                          {!isProfileIncomplete && (
                            <button 
                              className="btn-clipboard" 
                              style={{ margin: 0 }}
                              onClick={() => {
                                setIsEditingProfile(false);
                                // Reset fields to userProfile values
                                setProfileName(userProfile.name || '');
                                setProfilePhone(userProfile.phone || '');
                                setProfileGender(userProfile.gender || 'Prefer not to say');
                                setProfileBirthday(userProfile.birthday || 'Not set');
                                setProfileLanguage(userProfile.language || 'English (United States)');
                                setProfileHomeAddress(userProfile.homeAddress || 'Not set');
                                setProfileWorkAddress(userProfile.workAddress || 'Not set');
                                setProfileAadhaarNumber(userProfile.aadhaarNumber || '');
                                setProfileAlternatePhone(userProfile.alternatePhone || '');
                                setProfileCity(userProfile.city || '');
                                setProfileState(userProfile.state || '');
                                setProfileZipCode(userProfile.zipCode || '');
                                setProfileCompanyName(userProfile.companyName || '');
                              }}
                            >
                              Cancel
                            </button>
                          )}
                          <button 
                            className="btn-rent-now" 
                            style={{ margin: 0, width: 'auto', padding: '8px 20px' }}
                            onClick={handleUpdateProfile}
                          >
                            Save Details
                          </button>
                        </>
                      ) : (
                        <button 
                          className="btn-rent-now" 
                          style={{ margin: 0, width: 'auto', padding: '8px 20px' }}
                          onClick={() => setIsEditingProfile(true)}
                        >
                          Edit Profile Details
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Change Password Card */}
                  {!isEditingProfile && (
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>
                        Change Password
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        Update your account security password. {userProfile?.isGoogle && "Since you logged in with Google, you can set a password for password-based logins."}
                      </p>

                      {!showInlineForgot ? (
                        <>
                          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '400px' }}>
                            {!userProfile?.isGoogle && (
                              <div className="form-group">
                                <label>Current Password</label>
                                <input
                                  type="password"
                                  className="form-input"
                                  required
                                  value={currPassword}
                                  onChange={(e) => setCurrPassword(e.target.value)}
                                />
                              </div>
                            )}
                            <div className="form-group">
                              <label>New Password</label>
                              <input
                                type="password"
                                className="form-input"
                                required
                                value={newPasswordVal}
                                onChange={(e) => setNewPasswordVal(e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label>Confirm New Password</label>
                              <input
                                type="password"
                                className="form-input"
                                required
                                value={confirmNewPasswordVal}
                                onChange={(e) => setConfirmNewPasswordVal(e.target.value)}
                              />
                            </div>
                            <button type="submit" className="form-submit-btn" style={{ width: 'auto', alignSelf: 'flex-start', padding: '10px 24px' }}>
                              Change Password
                            </button>
                          </form>

                          {/* Forgot password link */}
                          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', textDecoration: 'underline', padding: 0 }}
                              onClick={() => { setShowInlineForgot(true); setInlineForgotStep(1); setInlineForgotPhone(''); setInlineForgotOtp(''); setInlineForgotNewPass(''); setInlineForgotConfirm(''); setInlineDevOtp(''); }}
                            >
                              🔑 Forgot your password? Reset via Phone OTP
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ maxWidth: '400px' }}>
                          {/* Step indicator */}
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                            {['Enter Phone', 'Verify OTP', 'New Password'].map((s, i) => (
                              <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: inlineForgotStep > i ? 'var(--accent-cyan)' : inlineForgotStep === i + 1 ? 'rgba(0,229,255,0.3)' : 'var(--bg-light-dark)', border: `2px solid ${inlineForgotStep >= i + 1 ? 'var(--accent-cyan)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', fontSize: '11px', fontWeight: 'bold', color: inlineForgotStep > i ? '#000' : inlineForgotStep === i + 1 ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                                  {inlineForgotStep > i ? '✓' : i + 1}
                                </div>
                                <span style={{ fontSize: '9px', color: inlineForgotStep === i + 1 ? 'var(--accent-cyan)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s}</span>
                              </div>
                            ))}
                          </div>

                          {/* Step 1: Enter Phone */}
                          {inlineForgotStep === 1 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Enter the phone number linked to your account. We'll send a 6-digit OTP.</p>
                              <div className="form-group">
                                <label>Registered Phone Number</label>
                                <div style={{ display: 'flex', marginTop: '4px', width: '100%' }}>
                                  <span style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: 'var(--bg-light-dark)', 
                                    border: '1px solid var(--border)', 
                                    borderRight: 'none', 
                                    borderTopLeftRadius: '8px', 
                                    borderBottomLeftRadius: '8px', 
                                    padding: '0 12px', 
                                    color: 'var(--accent-cyan)', 
                                    fontWeight: 'bold', 
                                    fontSize: '14px' 
                                  }}>+91</span>
                                  <input
                                    type="tel"
                                    className="form-input"
                                    placeholder="98765 43210"
                                    style={{ 
                                      flex: 1, 
                                      borderTopLeftRadius: 0, 
                                      borderBottomLeftRadius: 0,
                                      marginTop: 0 
                                    }} 
                                    value={inlineForgotPhone.replace(/^\+91\s*/, '')}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                      setInlineForgotPhone(val ? `+91 ${val}` : '');
                                    }}
                                  />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                  type="button"
                                  className="btn-clipboard"
                                  style={{ margin: 0 }}
                                  onClick={() => setShowInlineForgot(false)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="form-submit-btn"
                                  style={{ flex: 1 }}
                                  disabled={isSubmitting}
                                  onClick={async () => {
                                    if (!inlineForgotPhone.trim()) { showToast('Please enter your phone number.', 'error'); return; }
                                    setIsSubmitting(true);
                                    try {
                                      const res = await fetch(`${API}/api/auth/forgot-password-phone`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ phone: inlineForgotPhone.trim() })
                                      });
                                      const data = await res.json();
                                      if (res.ok && data.success) {
                                        showToast(data.message);
                                        if (data.devOtp) setInlineDevOtp(data.devOtp);
                                        setInlineForgotStep(2);
                                      } else {
                                        showToast(data.message || 'Phone not found.', 'error');
                                      }
                                    } catch { showToast('Network error.', 'error'); }
                                    finally { setIsSubmitting(false); }
                                  }}
                                >
                                  {isSubmitting ? 'Sending OTP...' : 'Send OTP'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 2: Enter OTP */}
                          {inlineForgotStep === 2 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Enter the 6-digit OTP sent to your phone.</p>
                              {inlineDevOtp && (
                                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#f59e0b' }}>
                                  ⚠️ Dev Mode OTP: <strong style={{ fontSize: '16px', letterSpacing: '2px' }}>{inlineDevOtp}</strong>
                                </div>
                              )}
                              <div className="form-group">
                                <label>6-Digit OTP Code</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="e.g. 483920"
                                  maxLength={6}
                                  value={inlineForgotOtp}
                                  onChange={(e) => setInlineForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" className="btn-clipboard" style={{ margin: 0 }} onClick={() => setInlineForgotStep(1)}>← Back</button>
                                <button
                                  type="button"
                                  className="form-submit-btn"
                                  style={{ flex: 1 }}
                                  disabled={isSubmitting || inlineForgotOtp.length < 6}
                                  onClick={() => {
                                    setInlineForgotResetToken(inlineForgotOtp);
                                    setInlineForgotStep(3);
                                  }}
                                >
                                  Verify OTP
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 3: Set New Password */}
                          {inlineForgotStep === 3 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>OTP verified! Set your new password below.</p>
                              <div className="form-group">
                                <label>New Password</label>
                                <input
                                  type="password"
                                  className="form-input"
                                  placeholder="At least 6 characters"
                                  value={inlineForgotNewPass}
                                  onChange={(e) => setInlineForgotNewPass(e.target.value)}
                                />
                              </div>
                              <div className="form-group">
                                <label>Confirm New Password</label>
                                <input
                                  type="password"
                                  className="form-input"
                                  placeholder="Repeat new password"
                                  value={inlineForgotConfirm}
                                  onChange={(e) => setInlineForgotConfirm(e.target.value)}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" className="btn-clipboard" style={{ margin: 0 }} onClick={() => setInlineForgotStep(2)}>← Back</button>
                                <button
                                  type="button"
                                  className="form-submit-btn"
                                  style={{ flex: 1 }}
                                  disabled={isSubmitting}
                                  onClick={async () => {
                                    if (inlineForgotNewPass !== inlineForgotConfirm) { showToast('Passwords do not match.', 'error'); return; }
                                    if (inlineForgotNewPass.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
                                    setIsSubmitting(true);
                                    try {
                                      const res = await fetch(`${API}/api/auth/reset-password`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ token: inlineForgotResetToken, password: inlineForgotNewPass })
                                      });
                                      const data = await res.json();
                                      if (res.ok && data.success) {
                                        showToast('Password reset successfully! Please log in again.');
                                        setShowInlineForgot(false);
                                        setInlineForgotStep(1);
                                        handleUserLogout();
                                      } else {
                                        showToast(data.message || 'Reset failed. OTP may have expired.', 'error');
                                      }
                                    } catch { showToast('Network error.', 'error'); }
                                    finally { setIsSubmitting(false); }
                                  }}
                                >
                                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>


            {/* Profile Sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>Renter Profile</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Name:</span> <strong style={{ float: 'right' }}>{userProfile?.name}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> <strong style={{ float: 'right' }}>{userProfile?.email}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Verification Status:</span> <strong style={{ float: 'right', color: 'var(--accent-green)' }}>Verified ✓</strong></div>
                </div>
              </div>

              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>Need Help?</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Our installation technicians are active. If you face any issues with your setup or console connectivity, connect over WhatsApp.
                </p>
                <a 
                  href="https://wa.me/918180807208?text=Hello%20Elite%20PS%20Rentals!%20I'm%20having%20an%20issue%20with%20my%20rental."
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-signin"
                  style={{ background: '#25D366', color: '#fff', textAlign: 'center', display: 'block', fontSize: '12px', boxShadow: 'none' }}
                >
                  WhatsApp Support
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      {view !== 'admin' && (
        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-brand-col">
              <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/images/logo.png" alt="Elite PS Rentals Logo" style={{ height: '32px', width: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                <span>Elite PS Rentals</span>
              </div>
              <p className="footer-desc">
                India's premium zero-deposit rental service for gaming systems, pro accessories, driving simulators, virtual reality rigs, and 4K audio-visual layouts.
              </p>
            </div>

            <div>
              <h4 className="footer-col-title">Gaming Systems</h4>
              <ul className="footer-links">
                <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Gaming Consoles'); setView('home'); }}>PlayStation 5</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Gaming Consoles'); setView('home'); }}>PlayStation 4 Pro</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Gaming Consoles'); setView('home'); }}>PlayStation VR2</a></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">Accessories</h4>
              <ul className="footer-links">
                <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Controllers & Accessories'); setView('home'); }}>Logitech G29 Steering Wheel</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setActiveCategory('Controllers & Accessories'); setView('home'); }}>DualSense Edge Controller</a></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">Company Info</h4>
              <ul className="footer-links">
                <li><a href="#" onClick={(e) => { e.preventDefault(); setView('about'); window.scrollTo(0, 0); }}>About Us</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setView('agreement-terms'); window.scrollTo(0, 0); }}>Rental Agreement Terms</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setView('verification-faq'); window.scrollTo(0, 0); }}>Verification FAQ</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); setView('privacy-policy'); window.scrollTo(0, 0); }}>Privacy Policy</a></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">Vasai West Hub</h4>
              <p className="footer-address">
                Shop no 01, Samer seth building, near Vartak College Road, opposite Union Bank, Navghar Manikpur, Vishal Nagar, Vasai West, Mumbai, Vasai-Virar, Maharashtra 401202
              </p>
              <div className="footer-phone">
                <Smartphone size={14} />
                <span>8180807208</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>&copy; {new Date().getFullYear()} Elite PS Rentals. All rights reserved.</span>
            <span>Designed with Vanilla CSS and React.</span>
          </div>
        </footer>
      )}

      {showPromoVideo && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 15, 0.95)',
          backdropFilter: 'blur(15px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => setShowPromoVideo(false)}>
          <div className="glass-panel" style={{ maxWidth: '900px', width: '100%', aspectRatio: '16/9', padding: '0', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowPromoVideo(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(5, 7, 15, 0.6)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 'bold',
                zIndex: 10
              }}
            >
              <X size={16} /> Close
            </button>
            <iframe 
              src="https://www.youtube.com/embed/RkC0l4iekYo?autoplay=1&controls=1"
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
        </div>
      )}

      {showBackConfirm && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 15, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '30px', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--accent-cyan)', display: 'inline-flex', justifyContent: 'center', marginBottom: '16px' }}>
              <AlertCircle size={48} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#fff' }}>
              Confirm Navigation
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 24px 0' }}>
              Do you want to leave this page and return to Dashboard?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                className="btn-clipboard" 
                style={{ width: '100%', padding: '12px', margin: 0 }}
                onClick={() => setShowBackConfirm(false)}
              >
                Stay Here
              </button>
              <button 
                className="btn-rent-now" 
                style={{ width: '100%', padding: '12px', margin: 0 }}
                onClick={() => {
                  setShowBackConfirm(false);
                  setView(isUserLoggedIn ? 'client-dashboard' : 'home');
                  if (isUserLoggedIn) setClientTab('profile');
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeedbackModal && feedbackBooking && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 15, 0.9)',
          backdropFilter: 'blur(15px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel feedback-modal" style={{ maxWidth: '480px', width: '100%', padding: '30px', border: '1px solid var(--border)', textAlign: 'center' }}>
            {feedbackSuccess ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }} className="animate-fade-in">
                <div style={{ fontSize: '64px', animation: 'gift-bounce 1s infinite alternate' }}>🎁</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '800', color: 'var(--accent-cyan)' }}>
                  Thank You!
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Your reviews help the gaming community make informed choices. Enjoy renting with us!
                </p>
              </div>
            ) : (
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', marginBottom: '8px', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Rate Your Experience
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.4' }}>
                  Your console <strong>{feedbackBooking.items?.[0]?.name || 'package'}</strong> was successfully delivered! Help us improve by rating below.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                  {/* Product Rating */}
                  <div>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 'bold' }}>
                      Rate the Product
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setFeedbackProductRating(star)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          <Star
                            size={28}
                            fill={star <= feedbackProductRating ? 'var(--accent-cyan)' : 'none'}
                            color="var(--accent-cyan)"
                            strokeWidth={1.5}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Rating */}
                  <div>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 'bold' }}>
                      Rate Delivery & Setup
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setFeedbackDeliveryRating(star)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          <Star
                            size={28}
                            fill={star <= feedbackDeliveryRating ? 'var(--accent-cyan)' : 'none'}
                            color="var(--accent-cyan)"
                            strokeWidth={1.5}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comments */}
                  <div style={{ textAlign: 'left' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 'bold' }}>
                      Your Review comments
                    </label>
                    <textarea
                      placeholder="Was the delivery prompt? Did technician setup console properly?"
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        background: 'var(--bg-darker)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        color: '#fff',
                        fontSize: '13px',
                        resize: 'none',
                        fontFamily: 'inherit'
                      }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <button 
                    className="btn-clipboard" 
                    style={{ margin: 0, padding: '12px' }}
                    onClick={handleFeedbackRemindLater}
                  >
                    Remind Later
                  </button>
                  <button 
                    className="btn-rent-now" 
                    style={{ margin: 0, padding: '12px' }}
                    onClick={handleFeedbackSubmit}
                  >
                    Submit Review
                  </button>
                </div>

                <button 
                  className="btn-clipboard" 
                  style={{ width: '100%', margin: 0, padding: '8px', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', borderColor: 'transparent' }}
                  onClick={handleFeedbackSkip}
                >
                  Skip Feedback
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isScannerOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 15, 0.95)',
          backdropFilter: 'blur(15px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', padding: '24px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '800', margin: 0, background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {scannerMode === 'selfie' ? 'Liveness Face Scanner' : 'Document Scanner'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
              {scannerMode === 'selfie' 
                ? 'Align your face within the circular boundary and click Capture.' 
                : 'Place your Aadhaar card / Driving License inside the frame.'}
            </p>

            <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: '12px', overflow: 'hidden', background: '#000', border: '2px solid var(--border-glow)', boxShadow: 'var(--shadow-neon)' }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
              />
              
              {/* Target overlay overlay frame */}
              {scannerMode === 'selfie' ? (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%',
                  height: '80%',
                  borderRadius: '50%',
                  border: '3px dashed var(--accent-cyan)',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                  pointerEvents: 'none'
                }} />
              ) : (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '80%',
                  height: '60%',
                  borderRadius: '8px',
                  border: '3px dashed var(--accent-cyan)',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                  pointerEvents: 'none'
                }} />
              )}

              {scannerError && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5, 7, 15, 0.9)', padding: '20px', color: '#ef4444', textAlign: 'center', fontSize: '13.5px' }}>
                  {scannerError}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
              <button 
                className="btn-clipboard" 
                style={{ margin: 0, padding: '12px' }}
                onClick={switchCamera}
              >
                Switch Camera
              </button>
              <button 
                className="btn-rent-now" 
                style={{ margin: 0, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={capturePhoto}
                disabled={!!scannerError}
              >
                <Camera size={16} /> Capture Photo
              </button>
            </div>
            
            <button 
              className="btn-clipboard" 
              style={{ margin: 0, padding: '8px', width: '100%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              onClick={stopScanner}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showDatePicker && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 15, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '320px',
            width: '100%',
            padding: 0,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: '#111827',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            {/* Header displaying selected date */}
            <div style={{
              padding: '20px',
              background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
              color: '#000',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {dpSelectedDate.getFullYear()}
              </div>
              <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px' }}>
                {(() => {
                  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  return `${days[dpSelectedDate.getDay()]}, ${dpSelectedDate.getDate()} ${monthsShort[dpSelectedDate.getMonth()]}`;
                })()}
              </div>
            </div>

            {/* Calendar Body */}
            <div style={{ padding: '16px' }}>
              {/* Navigation (Month & Year selectors) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    let nextMonth = dpCurrentMonth - 1;
                    let nextYear = dpCurrentYear;
                    if (nextMonth < 0) {
                      nextMonth = 11;
                      nextYear -= 1;
                    }
                    setDpCurrentMonth(nextMonth);
                    setDpCurrentYear(nextYear);
                    setDpSelectedDate(prev => {
                      const day = prev.getDate();
                      const maxDays = new Date(nextYear, nextMonth + 1, 0).getDate();
                      const safeDay = Math.min(day, maxDays);
                      return new Date(nextYear, nextMonth, safeDay);
                    });
                  }} 
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '0 8px' }}
                >
                  &lt;
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    value={dpCurrentMonth} 
                    onChange={(e) => {
                      const newMonth = parseInt(e.target.value, 10);
                      setDpCurrentMonth(newMonth);
                      setDpSelectedDate(prev => {
                        const day = prev.getDate();
                        const year = prev.getFullYear();
                        const maxDays = new Date(year, newMonth + 1, 0).getDate();
                        const safeDay = Math.min(day, maxDays);
                        return new Date(year, newMonth, safeDay);
                      });
                    }}
                    style={{ background: '#1e293b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                      <option key={m} value={idx}>{m}</option>
                    ))}
                  </select>

                  <select 
                    value={dpCurrentYear} 
                    onChange={(e) => {
                      const newYear = parseInt(e.target.value, 10);
                      setDpCurrentYear(newYear);
                      setDpSelectedDate(prev => {
                        const day = prev.getDate();
                        const month = prev.getMonth();
                        const maxDays = new Date(newYear, month + 1, 0).getDate();
                        const safeDay = Math.min(day, maxDays);
                        return new Date(newYear, month, safeDay);
                      });
                    }}
                    style={{ background: '#1e293b', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    {(() => {
                      const yearsList = [];
                      const currentYearNum = new Date().getFullYear();
                      for (let y = currentYearNum; y >= currentYearNum - 100; y--) {
                        yearsList.push(y);
                      }
                      return yearsList.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ));
                    })()}
                  </select>
                </div>

                <button 
                  type="button" 
                  onClick={() => {
                    let nextMonth = dpCurrentMonth + 1;
                    let nextYear = dpCurrentYear;
                    if (nextMonth > 11) {
                      nextMonth = 0;
                      nextYear += 1;
                    }
                    setDpCurrentMonth(nextMonth);
                    setDpCurrentYear(nextYear);
                    setDpSelectedDate(prev => {
                      const day = prev.getDate();
                      const maxDays = new Date(nextYear, nextMonth + 1, 0).getDate();
                      const safeDay = Math.min(day, maxDays);
                      return new Date(nextYear, nextMonth, safeDay);
                    });
                  }} 
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '0 8px' }}
                >
                  &gt;
                </button>
              </div>

              {/* Weekday headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                  <span key={idx} style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>{day}</span>
                ))}
              </div>

              {/* Days grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', justifyItems: 'center' }}>
                {(() => {
                  const totalDays = new Date(dpCurrentYear, dpCurrentMonth + 1, 0).getDate();
                  let startDay = new Date(dpCurrentYear, dpCurrentMonth, 1).getDay();
                  startDay = startDay === 0 ? 6 : startDay - 1; // Mon-start conversion (Mon=0... Sun=6)

                  const cells = [];
                  // Empty slots
                  for (let e = 0; e < startDay; e++) {
                    cells.push(<div key={`empty-${e}`} style={{ width: '32px', height: '32px' }} />);
                  }
                  // Month days
                  for (let d = 1; d <= totalDays; d++) {
                    const isSelected = dpSelectedDate.getDate() === d &&
                                      dpSelectedDate.getMonth() === dpCurrentMonth &&
                                      dpSelectedDate.getFullYear() === dpCurrentYear;
                    cells.push(
                      <button
                        type="button"
                        key={`day-${d}`}
                        onClick={() => setDpSelectedDate(new Date(dpCurrentYear, dpCurrentMonth, d))}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: 'none',
                          background: isSelected ? 'var(--accent-cyan)' : 'none',
                          color: isSelected ? '#000' : '#fff',
                          fontSize: '12px',
                          fontWeight: isSelected ? 'bold' : 'normal',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {d}
                      </button>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <button
                type="button"
                onClick={() => {
                  setProfileBirthday('Not set');
                  setShowDatePicker(false);
                }}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', padding: '6px 12px' }}
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', padding: '6px 12px' }}
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  const day = String(dpSelectedDate.getDate()).padStart(2, '0');
                  const month = String(dpSelectedDate.getMonth() + 1).padStart(2, '0');
                  const year = dpSelectedDate.getFullYear();
                  
                  // Age check: must be at least 18
                  const today = new Date();
                  let age = today.getFullYear() - dpSelectedDate.getFullYear();
                  const m = today.getMonth() - dpSelectedDate.getMonth();
                  if (m < 0 || (m === 0 && today.getDate() < dpSelectedDate.getDate())) {
                    age--;
                  }
                  if (age < 18) {
                    showToast('You must be at least 18 years old.', 'error');
                    return;
                  }

                  setProfileBirthday(`${day}-${month}-${year}`);
                  setShowDatePicker(false);
                }}
                style={{ background: 'none', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', padding: '6px 12px' }}
              >
                SET
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
