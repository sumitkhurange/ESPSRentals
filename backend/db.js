const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

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
  saveVerificationLogs
};
