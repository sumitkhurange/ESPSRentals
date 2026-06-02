const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

// Ensure data directory and files exist
function initDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  
  if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([], null, 2), 'utf8');
  }

  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

initDB();

// Read products
function getProducts() {
  try {
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading products file:', err);
    return [];
  }
}

// Write products
function saveProducts(products) {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing products file:', err);
    return false;
  }
}

// Read bookings
function getBookings() {
  try {
    const data = fs.readFileSync(BOOKINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading bookings file:', err);
    return [];
  }
}

// Write bookings
function saveBookings(bookings) {
  try {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing bookings file:', err);
    return false;
  }
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const VERIFICATION_TOKENS_FILE = path.join(DATA_DIR, 'verificationTokens.json');
const COUPONS_FILE = path.join(DATA_DIR, 'coupons.json');
const EMAILS_FILE = path.join(DATA_DIR, 'emails.json');
const VERIFICATION_LOGS_FILE = path.join(DATA_DIR, 'verificationLogs.json');

// Ensure users, verification token, coupons, emails, and verification logs files exist
function initUserFiles() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(VERIFICATION_TOKENS_FILE)) {
    fs.writeFileSync(VERIFICATION_TOKENS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(EMAILS_FILE)) {
    fs.writeFileSync(EMAILS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(VERIFICATION_LOGS_FILE)) {
    fs.writeFileSync(VERIFICATION_LOGS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(COUPONS_FILE)) {
    const defaultCoupons = [
      { code: 'FIRST10', discountType: 'percent', value: 10, minOrders: 0, description: '10% OFF on your first booking rental!' },
      { code: 'LOYAL10', discountType: 'percent', value: 10, minOrders: 3, description: '10% OFF Loyalty Discount (Requires 3+ successful rentals)!' },
      { code: 'ELITE100', discountType: 'flat', value: 100, minOrders: 0, description: 'Flat ₹100 OFF on any rental package!' }
    ];
    fs.writeFileSync(COUPONS_FILE, JSON.stringify(defaultCoupons, null, 2), 'utf8');
  }
}
initUserFiles();

// Users
function getUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading users file:', err);
    return [];
  }
}
function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing users file:', err);
    return false;
  }
}
// Verification tokens
function getVerificationTokens() {
  try {
    const data = fs.readFileSync(VERIFICATION_TOKENS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading verification tokens file:', err);
    return [];
  }
}
function saveVerificationTokens(tokens) {
  try {
    fs.writeFileSync(VERIFICATION_TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing verification tokens file:', err);
    return false;
  }
}

// Coupons Database
function getCoupons() {
  try {
    const data = fs.readFileSync(COUPONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading coupons file:', err);
    return [];
  }
}
function saveCoupons(coupons) {
  try {
    fs.writeFileSync(COUPONS_FILE, JSON.stringify(coupons, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing coupons file:', err);
    return false;
  }
}

// Emails Database (Notification Logs)
function getEmails() {
  try {
    const data = fs.readFileSync(EMAILS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading emails file:', err);
    return [];
  }
}
function saveEmails(emails) {
  try {
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing emails file:', err);
    return false;
  }
}

// Verification logs
function getVerificationLogs() {
  try {
    const data = fs.readFileSync(VERIFICATION_LOGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading verification logs file:', err);
    return [];
  }
}
function saveVerificationLogs(logs) {
  try {
    fs.writeFileSync(VERIFICATION_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing verification logs file:', err);
    return false;
  }
}

function getReviews() {
  try {
    const data = fs.readFileSync(REVIEWS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading reviews file:', err);
    return [];
  }
}

function saveReviews(reviews) {
  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing reviews file:', err);
    return false;
  }
}

// Shift all database dates so the latest date aligns with the current time.
// This fulfills: "in whole website the details must be till the present day till its used"
function shiftDatabaseDatesToPresent() {
  const bookings = getBookings();
  const logs = getVerificationLogs();
  const emails = getEmails();
  const reviews = getReviews();

  let maxTime = 0;

  const checkMax = (dateStr) => {
    if (!dateStr) return;
    const t = new Date(dateStr).getTime();
    if (!isNaN(t) && t > maxTime) {
      maxTime = t;
    }
  };

  bookings.forEach(b => {
    checkMax(b.createdAt);
    if (b.items) {
      b.items.forEach(item => {
        checkMax(item.startDate);
        checkMax(item.endDate);
      });
    }
  });

  logs.forEach(log => {
    checkMax(log.timestamp);
  });

  emails.forEach(email => {
    checkMax(email.createdAt);
  });

  reviews.forEach(review => {
    checkMax(review.createdAt);
  });

  if (maxTime === 0) return;

  const now = Date.now();
  const diffMs = now - maxTime;

  // Only shift if the max time is in the past (e.g., more than 5 minutes ago)
  if (diffMs > 5 * 60 * 1000) {
    console.log(`[DB] Shifting database dates forward by ${(diffMs / (1000 * 60 * 60 * 24)).toFixed(2)} days to match the present day.`);

    const shiftDateTime = (str) => {
      if (!str) return str;
      const t = new Date(str).getTime();
      if (isNaN(t)) return str;
      return new Date(t + diffMs).toISOString();
    };

    const shiftDateOnly = (str) => {
      if (!str) return str;
      const t = new Date(str).getTime();
      if (isNaN(t)) return str;
      return new Date(t + diffMs).toISOString().split('T')[0];
    };

    bookings.forEach(b => {
      b.createdAt = shiftDateTime(b.createdAt);
      if (b.items) {
        b.items.forEach(item => {
          item.startDate = shiftDateOnly(item.startDate);
          item.endDate = shiftDateOnly(item.endDate);
        });
      }
    });

    logs.forEach(log => {
      log.timestamp = shiftDateTime(log.timestamp);
      if (!log.action) {
        if (log.type === 'email_verified') {
          log.type = 'email';
          log.action = 'verified';
        } else if (log.type === 'phone_verified') {
          log.type = 'phone';
          log.action = 'verified';
        } else if (log.type === 'failed_otp_attempt') {
          log.type = (log.details && log.details.toLowerCase().includes('email')) ? 'email' : 'phone';
          log.action = 'failed';
        } else if (log.type === 'suspicious_activity') {
          log.type = 'security';
          log.action = 'failed';
        } else {
          log.action = 'success';
        }
      }
    });

    emails.forEach(email => {
      email.createdAt = shiftDateTime(email.createdAt);
    });

    reviews.forEach(review => {
      review.createdAt = shiftDateTime(review.createdAt);
    });

    saveBookings(bookings);
    saveVerificationLogs(logs);
    saveEmails(emails);
    saveReviews(reviews);
  } else {
    // If not shifting dates, still migrate any old format logs
    let logsChanged = false;
    logs.forEach(log => {
      if (!log.action) {
        if (log.type === 'email_verified') {
          log.type = 'email';
          log.action = 'verified';
        } else if (log.type === 'phone_verified') {
          log.type = 'phone';
          log.action = 'verified';
        } else if (log.type === 'failed_otp_attempt') {
          log.type = (log.details && log.details.toLowerCase().includes('email')) ? 'email' : 'phone';
          log.action = 'failed';
        } else if (log.type === 'suspicious_activity') {
          log.type = 'security';
          log.action = 'failed';
        } else {
          log.action = 'success';
        }
        logsChanged = true;
      }
    });
    if (logsChanged) {
      saveVerificationLogs(logs);
    }
  }
}

shiftDatabaseDatesToPresent();


module.exports = {
  getProducts,
  saveProducts,
  getBookings,
  saveBookings,
  getUsers,
  saveUsers,
  getVerificationTokens,
  saveVerificationTokens,
  getCoupons,
  saveCoupons,
  getEmails,
  saveEmails,
  getVerificationLogs,
  saveVerificationLogs,
  getReviews,
  saveReviews
};
