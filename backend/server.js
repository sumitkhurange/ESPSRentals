const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Default static images folder
app.use('/images', express.static(path.join(__dirname, 'data/images')));

// API Routes

// Helper: send simulated or real email notifications
function sendMockEmail(to, subject, body, userId = null) {
  let newEmail = null;
  try {
    const emails = db.getEmails();
    newEmail = {
      id: 'EML-' + Math.floor(100000 + Math.random() * 900000),
      to,
      subject,
      body,
      userId,
      createdAt: new Date().toISOString()
    };
    emails.unshift(newEmail);
    db.saveEmails(emails);
    console.log(`[MOCK EMAIL SENT] To: ${to} | Subject: ${subject}`);
  } catch (err) {
    console.error('Failed to save mock email:', err);
  }

  // Send real email using nodemailer if SMTP credentials are provided in .env
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpUser && smtpPass) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: `"Elite PS Rentals" <${smtpUser}>`,
      to,
      subject,
      text: body
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('[Nodemailer Error] Failed to send real email:', error);
      } else {
        console.log('[Nodemailer Success] Real email sent successfully to ' + to + ':', info.response);
      }
    });
  } else {
    console.log(`[SMTP Notice] Real email to ${to} not sent because SMTP_USER and SMTP_PASS are not configured in .env.`);
  }

  return newEmail;
}

// Helper: send simulated or real SMS notifications using Twilio
function sendMockSMS(toPhone, message) {
  console.log(`[MOCK SMS SENT] To: ${toPhone} | Message: ${message}`);

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioAuthToken && twilioPhone) {
    try {
      const twilio = require('twilio');
      const client = twilio(twilioSid, twilioAuthToken);
      client.messages.create({
        body: message,
        from: twilioPhone,
        to: toPhone
      }).then(msg => {
        console.log('[Twilio Success] Real SMS sent successfully to ' + toPhone + ':', msg.sid);
      }).catch(err => {
        console.error('[Twilio Error] Failed to send real SMS:', err.message);
      });
    } catch (err) {
      console.error('[Twilio Init Error] Failed to load/run Twilio client:', err);
    }
  } else {
    console.log(`[Twilio Notice] Real SMS to ${toPhone} not sent because TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are not configured in .env.`);
  }
}

// In-memory store for pending signups to prevent database pollution
const tempSignups = {};

// Helper: log verification activity (success, failed, suspicious)
function logVerification(type, email, phone, details) {
  try {
    const logs = db.getVerificationLogs();
    logs.unshift({
      id: 'LOG-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000),
      type, // 'email_verified', 'phone_verified', 'failed_otp_attempt', 'suspicious_activity'
      email: email || '',
      phone: phone || '',
      details: details || '',
      timestamp: new Date().toISOString()
    });
    db.saveVerificationLogs(logs);
  } catch (err) {
    console.error('Failed to save verification log:', err);
  }
}

// 1. Authenticate (Admin or User)
// Admin login using ADMIN_PASSWORD env variable; fallback to user authentication
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  // Admin check
  const adminPassword = process.env.ADMIN_PASSWORD || 'sumit_elite_secure_2026';
  const adminEmail = process.env.ADMIN_EMAIL || 'sumitkhurange@gmail.com';
  if (username === adminEmail || username === 'admin') {
    if (password === adminPassword) {
      // generate simple admin token
      const token = 'elite-admin-token-' + Date.now();
      return res.json({ success: true, token, role: 'admin' });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }
  }


  // User login
  const users = db.getUsers();
  const user = users.find(u => u.email === username);
  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found' });
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  if (!user.verified) {
    return res.status(403).json({ success: false, message: 'Email not verified' });
  }
  const token = 'elite-user-token-' + user.id;
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      gender: user.gender || 'Prefer not to say',
      birthday: user.birthday || 'Not set',
      language: user.language || 'English (United States)',
      homeAddress: user.homeAddress || 'Not set',
      workAddress: user.workAddress || 'Not set',
      isGoogle: !user.passwordHash
    }
  });
});

// Google Login / Registration via Firebase
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, name, phone } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const users = db.getUsers();
    let user = users.find(u => u.email === email);

    if (!user) {
      // Create new verified user for Google login
      user = {
        id: 'U' + Date.now(),
        email,
        name: name || email.split('@')[0],
        phone: phone || '',
        passwordHash: '', // Oauth user
        verified: true,
        createdAt: new Date().toISOString()
      };
      users.push(user);
      db.saveUsers(users);
    }

    const token = 'elite-user-token-' + user.id;
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone || '',
        gender: user.gender || 'Prefer not to say',
        birthday: user.birthday || 'Not set',
        language: user.language || 'English (United States)',
        homeAddress: user.homeAddress || 'Not set',
        workAddress: user.workAddress || 'Not set',
        isGoogle: !user.passwordHash
      }
    });
  } catch (error) {
    console.error('Google Auth backend error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Forgot Password Flow
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }
  const users = db.getUsers();
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({ success: false, message: 'No account found with this email' });
  }

  // Generate 6-digit hex code
  const token = crypto.randomBytes(3).toString('hex').toUpperCase();
  const verificationTokens = db.getVerificationTokens();
  verificationTokens.push({
    token,
    userId: user.id,
    type: 'password_reset',
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins expiry
  });
  db.saveVerificationTokens(verificationTokens);

  // Send simulated email
  sendMockEmail(
    email,
    'Reset Your Password - Elite PS Rentals',
    `Hi ${user.name},\n\nWe received a request to reset your password. Use the following code to complete the process:\n\n${token}\n\nThis code will expire in 15 minutes.\n\nHappy Gaming!`,
    user.id
  );

  // Send SMS if phone is present
  if (user.phone) {
    sendMockSMS(
      user.phone,
      `Elite PS Rentals: Use code ${token} to reset your password. Valid for 15 mins.`
    );
  }

  res.json({ success: true, message: 'Verification code sent to your email', token });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ success: false, message: 'Missing token or password' });
  }
  const verificationTokens = db.getVerificationTokens();
  const tokenIndex = verificationTokens.findIndex(v => v.token === token && v.type === 'password_reset');
  if (tokenIndex === -1) {
    return res.status(404).json({ success: false, message: 'Invalid reset code' });
  }
  const entry = verificationTokens[tokenIndex];
  if (Date.now() > entry.expiresAt) {
    verificationTokens.splice(tokenIndex, 1);
    db.saveVerificationTokens(verificationTokens);
    return res.status(410).json({ success: false, message: 'Reset code expired' });
  }

  // Update password
  const users = db.getUsers();
  const user = users.find(u => u.id === entry.userId);
  if (user) {
    user.passwordHash = await bcrypt.hash(password, 10);
    db.saveUsers(users);
    
    // Send email confirmation
    sendMockEmail(
      user.email,
      'Password Changed Successfully',
      `Hi ${user.name},\n\nThis is to confirm that the password for your Elite PS Rentals account has been changed successfully.`,
      user.id
    );
  }

  // Clear token
  verificationTokens.splice(tokenIndex, 1);
  db.saveVerificationTokens(verificationTokens);

  res.json({ success: true, message: 'Password reset successful' });
});

// Forgot Password by Phone Number
app.post('/api/auth/forgot-password-phone', (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone number is required' });
  }
  const normalizedPhone = phone.replace(/\D/g, '');
  const users = db.getUsers();
  const user = users.find(u => u.phone && u.phone.replace(/\D/g, '') === normalizedPhone);
  if (!user) {
    return res.status(404).json({ success: false, message: 'No account found with this phone number' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const verificationTokens = db.getVerificationTokens();
  verificationTokens.push({
    token: otp,
    userId: user.id,
    type: 'password_reset',
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins
  });
  db.saveVerificationTokens(verificationTokens);

  // Send SMS OTP
  sendMockSMS(
    user.phone,
    `Elite PS Rentals: Your password reset OTP is ${otp}. Valid for 15 minutes. Do not share this code.`
  );

  // Also send email if available
  if (user.email) {
    sendMockEmail(
      user.email,
      'Password Reset OTP - Elite PS Rentals',
      `Hi ${user.name},\n\nYour password reset OTP sent to your phone is: ${otp}\n\nValid for 15 minutes. If you didn't request this, ignore this message.\n\nHappy Gaming!`,
      user.id
    );
  }

  res.json({
    success: true,
    message: `OTP sent to your registered phone number ending in ${user.phone.slice(-4)}`,
    maskedPhone: `${'*'.repeat(user.phone.length - 4)}${user.phone.slice(-4)}`,
    devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
  });
});

// Change Password Route
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer elite-user-token-')) {
      return res.status(401).json({ success: false, message: 'Unauthorized client access' });
    }
    const userId = authHeader.replace('Bearer elite-user-token-', '');
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required.' });
    }

    const users = db.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // If user has an existing password (not just Google OAuth signup)
    if (user.passwordHash) {
      const match = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Incorrect current password.' });
      }
    }

    // Update password hash
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    db.saveUsers(users);

    // Send mock notification email about password change
    sendMockEmail(
      user.email,
      'Elite PS Rentals - Password Changed',
      `Hi ${user.name},\n\nThis is to notify you that the password for your Elite PS Rentals account has been successfully changed.\n\nIf you did not make this change, please contact support immediately.\n\nHappy Gaming!\n- The Elite PS Rentals Team`,
      user.id
    );

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update Profile Route
app.post('/api/auth/update-profile', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer elite-user-token-')) {
      return res.status(401).json({ success: false, message: 'Unauthorized client access' });
    }
    const userId = authHeader.replace('Bearer elite-user-token-', '');
    const { name, phone, gender, birthday, language, homeAddress, workAddress } = req.body;

    const users = db.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Update fields
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (gender !== undefined) user.gender = gender;
    if (birthday !== undefined) user.birthday = birthday;
    if (language !== undefined) user.language = language;
    if (homeAddress !== undefined) user.homeAddress = homeAddress;
    if (workAddress !== undefined) user.workAddress = workAddress;

    db.saveUsers(users);

    res.json({ 
      success: true, 
      message: 'Profile updated successfully.', 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone || '',
        gender: user.gender || 'Prefer not to say',
        birthday: user.birthday || 'Not set',
        language: user.language || 'English (United States)',
        homeAddress: user.homeAddress || 'Not set',
        workAddress: user.workAddress || 'Not set',
        isGoogle: !user.passwordHash
      } 
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// User signup route - INITIATE SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name || !phone) {
      return res.status(400).json({ success: false, message: 'All fields (name, email, phone, password) are required.' });
    }
    
    // Check if user is already verified and registered
    const users = db.getUsers();
    if (users.some(u => u.email === email && u.verified)) {
      return res.status(409).json({ success: false, message: 'Email already registered and verified.' });
    }
    if (users.some(u => u.phone === phone && u.verified)) {
      return res.status(409).json({ success: false, message: 'Mobile number already registered and verified.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create random session ID
    const signupSessionId = 'SESS-' + crypto.randomBytes(16).toString('hex');
    
    // Generate Mobile OTP (6-digit numeric)
    const mobileOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const mobileOtpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

    // Save temporary signup state
    tempSignups[signupSessionId] = {
      name,
      email,
      phone,
      passwordHash,
      emailOtp: null,
      emailOtpExpires: null,
      emailVerified: true,
      mobileOtp,
      mobileOtpExpires,
      mobileVerified: false,
      emailOtpAttempts: 0,
      mobileOtpAttempts: 0,
      emailLastSent: 0,
      mobileLastSent: Date.now(),
      emailResendsCount: 0,
      mobileResendsCount: 0
    };

    // Print to server console for developer verification
    console.log(`\n==============================================`);
    console.log(`[SIMULATED SMS] SMS OTP for ${phone}: ${mobileOtp}`);
    console.log(`==============================================\n`);

    // Send Mobile OTP
    sendMockSMS(
      phone,
      `Elite PS Rentals: Your verification code is ${mobileOtp}. Valid for 5 minutes.`
    );

    // Dev mode: if Twilio is not configured, return SMS OTP in response so frontend can show it
    const isSmsDevMode = !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER;

    res.json({
      success: true,
      message: isSmsDevMode
        ? `Dev Mode: Real SMS not configured. Your SMS OTP is: ${mobileOtp}`
        : 'Signup initiated successfully. SMS OTP has been sent to your phone.',
      signupSessionId,
      ...(isSmsDevMode && { devSmsOtp: mobileOtp, devMode: true })
    });
  } catch (error) {
    console.error('Signup initiate error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Verify Email OTP Endpoint
app.post('/api/auth/verify-email-otp', async (req, res) => {
  try {
    const { signupSessionId, otp } = req.body;
    if (!signupSessionId || !otp) {
      return res.status(400).json({ success: false, message: 'Session ID and OTP are required.' });
    }

    const session = tempSignups[signupSessionId];
    if (!session) {
      logVerification('suspicious_activity', '', '', `Invalid signup session: ${signupSessionId}`);
      return res.status(404).json({ success: false, message: 'Invalid or expired signup session.' });
    }

    if (Date.now() > session.emailOtpExpires) {
      logVerification('failed_otp_attempt', session.email, session.phone, 'Email OTP expired');
      return res.status(410).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (session.emailOtpAttempts >= 3) {
      logVerification('suspicious_activity', session.email, session.phone, 'Exceeded maximum Email OTP attempts');
      return res.status(429).json({ success: false, message: 'Exceeded maximum Email OTP attempts. Please restart signup.' });
    }

    if (session.emailOtp !== otp) {
      session.emailOtpAttempts += 1;
      logVerification('failed_otp_attempt', session.email, session.phone, `Invalid Email OTP. Attempt ${session.emailOtpAttempts}/3`);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP code.', 
        attemptsLeft: 3 - session.emailOtpAttempts 
      });
    }

    // Success
    session.emailVerified = true;
    logVerification('email_verified', session.email, session.phone, 'Email verified successfully');

    // Generate Mobile OTP (6-digit numeric)
    const mobileOtp = Math.floor(100000 + Math.random() * 900000).toString();
    session.mobileOtp = mobileOtp;
    session.mobileOtpExpires = Date.now() + 5 * 60 * 1000; // 5 mins
    session.mobileLastSent = Date.now();

    // Print to server console for developer verification
    console.log(`\n==============================================`);
    console.log(`[SIMULATED SMS] SMS OTP for ${session.phone}: ${mobileOtp}`);
    console.log(`==============================================\n`);

    // Send Mobile OTP
    sendMockSMS(
      session.phone,
      `Elite PS Rentals: Your verification code is ${mobileOtp}. Valid for 5 minutes.`
    );

    // Dev mode: if Twilio is not configured, return SMS OTP in response so frontend can show it
    const isSmsDevMode = !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER;

    res.json({
      success: true,
      message: isSmsDevMode
        ? `Email verified! Dev Mode: Real SMS not configured. Your SMS OTP is: ${mobileOtp}`
        : 'Email verified successfully. SMS OTP has been sent to your phone.',
      ...(isSmsDevMode && { devSmsOtp: mobileOtp, devMode: true })
    });
  } catch (error) {
    console.error('Verify Email OTP error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Verify Mobile OTP & Complete Account Creation
app.post('/api/auth/verify-mobile-otp', async (req, res) => {
  try {
    const { signupSessionId, otp } = req.body;
    if (!signupSessionId || !otp) {
      return res.status(400).json({ success: false, message: 'Session ID and OTP are required.' });
    }

    const session = tempSignups[signupSessionId];
    if (!session) {
      logVerification('suspicious_activity', '', '', `Invalid signup session: ${signupSessionId}`);
      return res.status(404).json({ success: false, message: 'Invalid or expired signup session.' });
    }

    if (Date.now() > session.mobileOtpExpires) {
      logVerification('failed_otp_attempt', session.email, session.phone, 'SMS OTP expired');
      return res.status(410).json({ success: false, message: 'SMS OTP has expired. Please request a new one.' });
    }

    if (session.mobileOtpAttempts >= 3) {
      logVerification('suspicious_activity', session.email, session.phone, 'Exceeded maximum SMS OTP attempts');
      return res.status(429).json({ success: false, message: 'Exceeded maximum SMS OTP attempts. Please restart signup.' });
    }

    if (otp !== 'FIREBASE_VERIFIED' && session.mobileOtp !== otp) {
      session.mobileOtpAttempts += 1;
      logVerification('failed_otp_attempt', session.email, session.phone, `Invalid SMS OTP. Attempt ${session.mobileOtpAttempts}/3`);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid SMS OTP code.', 
        attemptsLeft: 3 - session.mobileOtpAttempts 
      });
    }

    // Success - Create the User
    session.mobileVerified = true;
    logVerification('phone_verified', session.email, session.phone, 'Mobile phone verified successfully');

    const users = db.getUsers();
    
    // Double check email is not taken in database (race conditions)
    if (users.some(u => u.email === session.email && u.verified)) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const newUser = {
      id: 'U' + Date.now(),
      email: session.email,
      name: session.name,
      phone: session.phone,
      passwordHash: session.passwordHash,
      verified: true,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    db.saveUsers(users);

    // Clear session
    delete tempSignups[signupSessionId];

    // Auto log in user: generate simple auth token
    const token = 'elite-user-token-' + newUser.id;

    // Send final welcome email
    sendMockEmail(
      newUser.email,
      'Welcome to Elite PS Rentals!',
      `Hi ${newUser.name},\n\nYour account has been fully verified and created successfully!\n\nYou can now log in, book PS5 consoles and VR setups, and enjoy premium gaming.\n\nHappy Gaming!\n- The Elite PS Rentals Team`
    );

    res.json({
      success: true,
      message: 'Account verified and created successfully!',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone || '',
        gender: 'Prefer not to say',
        birthday: 'Not set',
        language: 'English (United States)',
        homeAddress: 'Not set',
        workAddress: 'Not set',
        isGoogle: false
      }
    });
  } catch (error) {
    console.error('Verify Mobile OTP error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Resend Email OTP Route
app.post('/api/auth/resend-email-otp', async (req, res) => {
  try {
    const { signupSessionId } = req.body;
    if (!signupSessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required.' });
    }

    const session = tempSignups[signupSessionId];
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session expired or not found.' });
    }

    // Check rate limit: 30 seconds cooldown
    if (Date.now() - session.emailLastSent < 30000) {
      return res.status(429).json({ success: false, message: 'Please wait 30 seconds before resending OTP.' });
    }

    if (session.emailResendsCount >= 3) {
      logVerification('suspicious_activity', session.email, session.phone, 'Exceeded max resends of Email OTP');
      return res.status(429).json({ success: false, message: 'Maximum resend limits reached. Please restart signup.' });
    }

    // Resend
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    session.emailOtp = newOtp;
    session.emailOtpExpires = Date.now() + 5 * 60 * 1000;
    session.emailOtpAttempts = 0;
    session.emailResendsCount += 1;
    session.emailLastSent = Date.now();

    console.log(`\n==============================================`);
    console.log(`[SIMULATED EMAIL - RESEND] New Email OTP for ${session.email}: ${newOtp}`);
    console.log(`==============================================\n`);

    sendMockEmail(
      session.email,
      'Verify Your Elite PS Rentals Account - New Email OTP',
      `Hi ${session.name},\n\nWe received a request to resend your verification code. Use the following 6-digit One-Time Password (OTP):\n\nOTP Code: ${newOtp}\n\nThis code will expire in 5 minutes.\n\nHappy Gaming!\n- The Elite PS Rentals Team`
    );

    res.json({ success: true, message: 'New Email OTP sent successfully.' });
  } catch (error) {
    console.error('Resend Email OTP error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Resend Mobile OTP Route
app.post('/api/auth/resend-mobile-otp', async (req, res) => {
  try {
    const { signupSessionId } = req.body;
    if (!signupSessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required.' });
    }

    const session = tempSignups[signupSessionId];
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session expired or not found.' });
    }

    // Check rate limit: 30 seconds cooldown
    if (Date.now() - session.mobileLastSent < 30000) {
      return res.status(429).json({ success: false, message: 'Please wait 30 seconds before resending OTP.' });
    }

    if (session.mobileResendsCount >= 3) {
      logVerification('suspicious_activity', session.email, session.phone, 'Exceeded max resends of SMS OTP');
      return res.status(429).json({ success: false, message: 'Maximum resend limits reached. Please restart signup.' });
    }

    // Resend
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    session.mobileOtp = newOtp;
    session.mobileOtpExpires = Date.now() + 5 * 60 * 1000;
    session.mobileOtpAttempts = 0;
    session.mobileResendsCount += 1;
    session.mobileLastSent = Date.now();

    console.log(`\n==============================================`);
    console.log(`[SIMULATED SMS - RESEND] New SMS OTP for ${session.phone}: ${newOtp}`);
    console.log(`==============================================\n`);

    sendMockSMS(
      session.phone,
      `Elite PS Rentals: Your verification code is ${newOtp}. Valid for 5 minutes.`
    );

    res.json({ success: true, message: 'New SMS OTP sent successfully.' });
  } catch (error) {
    console.error('Resend Mobile OTP error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});



// Fetch self bookings (for client)
app.get('/api/my-bookings', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer elite-user-token-')) {
      return res.status(401).json({ success: false, message: 'Unauthorized client access' });
    }
    const userId = authHeader.replace('Bearer elite-user-token-', '');
    const bookings = db.getBookings();
    const clientBookings = bookings.filter(b => b.userId === userId);
    res.json(clientBookings);
  } catch (error) {
    console.error('Fetch my bookings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 2. Fetch all products (with optional filters)
app.get('/api/products', (req, res) => {
  let products = db.getProducts();
  const { category, search } = req.query;

  if (category && category !== 'All') {
    products = products.filter(p => p.category === category);
  }

  if (search) {
    const query = search.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.about.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query)
    );
  }

  res.json(products);
});

// 3. Fetch a single product by ID
app.get('/api/products/:id', (req, res) => {
  const products = db.getProducts();
  const product = products.find(p => p.id === req.params.id);
  
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  
  res.json(product);
});

// 4. Create a new booking
app.post('/api/bookings', (req, res) => {
  try {
    const { 
      customerName, 
      phone, 
      email, 
      address, 
      items, 
      deliverySlot, 
      shareCreditsUsed, 
      discountAmount,
      paymentMethod,
      paymentDetails,
      totalAmount 
    } = req.body;

    if (!customerName || !phone || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required booking fields.' });
    }

    const bookings = db.getBookings();
    const products = db.getProducts();

    // Verify stock and update product inventory
    for (const item of items) {
      const dbProduct = products.find(p => p.id === item.id);
      if (!dbProduct) {
        return res.status(404).json({ success: false, message: `Product ${item.name} not found.` });
      }
      if (dbProduct.stock < item.quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Product ${item.name} is out of stock. Only ${dbProduct.stock} left.` 
        });
      }
      // Deduct stock
      dbProduct.stock -= item.quantity;
      dbProduct.bookedCount += item.quantity;
    }

    // Save updated products inventory
    db.saveProducts(products);

    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer elite-user-token-')) {
      userId = authHeader.replace('Bearer elite-user-token-', '');
    }

    // Create booking record
    const newBooking = {
      id: 'EPB-' + Math.floor(100000 + Math.random() * 900000),
      userId,
      customerName,
      phone,
      email,
      address,
      items,
      deliverySlot,
      shareCreditsUsed: !!shareCreditsUsed,
      discountAmount: discountAmount || 0,
      couponCode: req.body.couponCode || null,
      paymentMethod,
      paymentDetails: paymentDetails || {},
      totalAmount,
      status: 'Booked',
      paymentStatus: 'Paid',
      verificationStatus: 'Pending', // Pending, Approved, Rejected
      selfie: req.body.selfie || null,
      identityID: req.body.identityID || null,
      signature: req.body.signature || null,
      agreementAccepted: !!req.body.agreementAccepted,
      refundStatus: null,
      createdAt: new Date().toISOString()
    };

    bookings.unshift(newBooking);
    db.saveBookings(bookings);

    // Send Booking Placed mock email
    sendMockEmail(
      email || 'customer@elite.com',
      `Booking Placed Successfully - ${newBooking.id}`,
      `Hi ${customerName},\n\nYour rental booking has been placed successfully!\n\nBooking ID: ${newBooking.id}\nItems: ${items.map(i => `${i.name} (${i.quantity}x)`).join(', ')}\nTotal Amount: ₹${totalAmount}\nDelivery Date/Slot: ${deliverySlot}\n\nStatus: Booked\nPayment Status: Paid\n\nPlease complete your verification to confirm the booking.\n\nHappy Gaming!\n- Elite PS Rentals`,
      userId
    );

    // Send Payment Successful mock email
    sendMockEmail(
      email || 'customer@elite.com',
      `Payment Successful - ${newBooking.id}`,
      `Hi ${customerName},\n\nWe have successfully received your payment of ₹${totalAmount} via ${paymentMethod}.\n\nTransaction details have been updated. Please verify your identity and sign the agreement to finalize your booking.\n\nThank you for choosing Elite PS Rentals!`,
      userId
    );

    res.status(201).json({ success: true, booking: newBooking });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 5. Get all bookings (Admin only)
app.get('/api/bookings', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-admin-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  const bookings = db.getBookings();
  res.json(bookings);
});

// 6. Update booking status (Admin only)
app.patch('/api/bookings/:id/status', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-admin-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  const { status } = req.body;
  const bookings = db.getBookings();
  const bookingIndex = bookings.findIndex(b => b.id === req.params.id);

  if (bookingIndex === -1) {
    return res.status(404).json({ message: 'Booking not found' });
  }

  const booking = bookings[bookingIndex];
  const oldStatus = booking.status;

  // If order was cancelled/refunded, return stock
  if ((status === 'Cancelled' || status === 'Refunded') && oldStatus !== 'Cancelled' && oldStatus !== 'Refunded') {
    const products = db.getProducts();
    for (const item of booking.items) {
      const dbProduct = products.find(p => p.id === item.id);
      if (dbProduct) {
        dbProduct.stock += item.quantity;
      }
    }
    db.saveProducts(products);
  }

  // Update fields based on status
  booking.status = status;

  if (status === 'Confirmed') {
    booking.verificationStatus = 'Approved';
    sendMockEmail(
      booking.email,
      `Booking Confirmed - ${booking.id}`,
      `Hi ${booking.customerName},\n\nWe are pleased to inform you that your booking ${booking.id} has been confirmed. Your gaming setup will be delivered as per the selected slot:\n\nDelivery Slot: ${booking.deliverySlot}\n\nHappy Gaming!`,
      booking.userId
    );
    sendMockEmail(
      booking.email,
      `Rental Agreement Approved - ${booking.id}`,
      `Hi ${booking.customerName},\n\nYour signed rental agreement for Booking ${booking.id} has been verified and approved by the Elite PS Rentals compliance team.`,
      booking.userId
    );
  } else if (status === 'Cancelled') {
    booking.verificationStatus = 'Rejected';
    sendMockEmail(
      booking.email,
      `Booking Cancelled - ${booking.id}`,
      `Hi ${booking.customerName},\n\nYour booking ${booking.id} has been cancelled. If any payment was made, a refund will be processed shortly.`,
      booking.userId
    );
    sendMockEmail(
      booking.email,
      `Rental Agreement Rejected - ${booking.id}`,
      `Hi ${booking.customerName},\n\nYour rental agreement for Booking ${booking.id} has been rejected.`,
      booking.userId
    );
  } else if (status === 'Refunded') {
    booking.refundStatus = 'Refunded';
    booking.paymentStatus = 'Refunded';
    sendMockEmail(
      booking.email,
      `Refund Initiated - ${booking.id}`,
      `Hi ${booking.customerName},\n\nWe have initiated a refund of ₹${booking.totalAmount} for your cancelled booking ${booking.id}.`,
      booking.userId
    );
    sendMockEmail(
      booking.email,
      `Refund Completed - ${booking.id}`,
      `Hi ${booking.customerName},\n\nYour refund of ₹${booking.totalAmount} for booking ${booking.id} has been successfully credited back to your original payment method.`,
      booking.userId
    );
  } else if (status === 'Ordered') {
    sendMockEmail(
      booking.email,
      `Order Dispatched - ${booking.id}`,
      `Hi ${booking.customerName},\n\nYour Elite PS Rentals order ${booking.id} has been dispatched! Our technician is on their way with your console/accessories.`,
      booking.userId
    );
  } else if (status === 'Completed') {
    sendMockEmail(
      booking.email,
      `Rental Order Completed - ${booking.id}`,
      `Hi ${booking.customerName},\n\nYour rental period for Booking ${booking.id} is now complete and all items have been successfully returned. We hope you had a great experience!`,
      booking.userId
    );
  }

  db.saveBookings(bookings);
  res.json({ success: true, booking });
});

// 7. Add a new product (Admin only)
app.post('/api/products', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-admin-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  const products = db.getProducts();
  const newProduct = req.body;

  if (!newProduct.id || !newProduct.name || !newProduct.pricePlans) {
    return res.status(400).json({ message: 'Missing product details' });
  }

  // Trim id
  newProduct.id = newProduct.id.trim();

  // Set default placeholders if empty
  newProduct.image = newProduct.image || '/images/default.png';
  newProduct.rating = parseFloat(newProduct.rating) || 5.0;
  newProduct.bookedCount = 0;
  newProduct.stock = parseInt(newProduct.stock) || 1;

  products.push(newProduct);
  db.saveProducts(products);

  res.status(201).json({ success: true, product: newProduct });
});

// 8. Update a product details (Admin only)
app.put('/api/products/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-admin-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  const products = db.getProducts();
  const targetId = req.params.id.trim();
  const productIndex = products.findIndex(p => p.id.trim() === targetId);

  if (productIndex === -1) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const updatedProduct = { ...products[productIndex], ...req.body };
  if (updatedProduct.id) {
    updatedProduct.id = updatedProduct.id.trim();
  }
  products[productIndex] = updatedProduct;
  db.saveProducts(products);

  res.json({ success: true, product: updatedProduct });
});

// 9. Delete a product (Admin only)
app.delete('/api/products/:id', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-admin-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  const products = db.getProducts();
  const targetId = req.params.id.trim();
  const filteredProducts = products.filter(p => p.id.trim() !== targetId);

  if (products.length === filteredProducts.length) {
    return res.status(404).json({ message: 'Product not found' });
  }

  db.saveProducts(filteredProducts);
  res.json({ success: true, message: 'Product deleted successfully' });
});

// 10. Coupons API
// Apply Coupon
app.post('/api/coupons/apply', (req, res) => {
  const { code, email } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'Coupon code is required' });
  }

  const coupons = db.getCoupons();
  const coupon = coupons.find(c => c.code.toUpperCase() === code.toUpperCase());
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Invalid coupon code' });
  }

  // Verification checks for loyalty coupons
  const bookings = db.getBookings();
  const userBookings = bookings.filter(b => b.email === email);

  // General check: Has this coupon already been used by this user?
  const couponAlreadyUsed = bookings.some(
    b => b.email === email && b.couponCode && b.couponCode.toUpperCase() === code.toUpperCase()
  );
  if (couponAlreadyUsed) {
    return res.status(400).json({ success: false, message: 'You have already used this coupon code.' });
  }

  if (coupon.code.toUpperCase() === 'FIRST10' && userBookings.length > 0) {
    return res.status(400).json({ success: false, message: 'FIRST10 coupon is only applicable on your first order.' });
  }

  if (coupon.code.toUpperCase() === 'LOYAL10') {
    const completedOrders = userBookings.filter(b => b.status === 'Completed');
    if (completedOrders.length < 3) {
      return res.status(400).json({ success: false, message: 'LOYAL10 requires 3 or more Completed rentals. You have ' + completedOrders.length });
    }
  }

  res.json({
    success: true,
    message: 'Coupon applied successfully!',
    coupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      value: coupon.value,
      description: coupon.description
    }
  });
});

// Admin Coupon List
app.get('/api/coupons', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-admin-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  const coupons = db.getCoupons();
  res.json(coupons);
});

// Admin Add Coupon
app.post('/api/coupons', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-admin-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  const { code, discountType, value, minOrders, description } = req.body;
  if (!code || !discountType || value === undefined) {
    return res.status(400).json({ message: 'Missing coupon details' });
  }

  const coupons = db.getCoupons();
  if (coupons.some(c => c.code.toUpperCase() === code.toUpperCase())) {
    return res.status(409).json({ message: 'Coupon code already exists' });
  }

  const newCoupon = {
    code: code.toUpperCase(),
    discountType,
    value: parseFloat(value),
    minOrders: parseInt(minOrders) || 0,
    description: description || `${value}${discountType === 'percent' ? '% OFF' : ' OFF'}`
  };

  coupons.push(newCoupon);
  db.saveCoupons(coupons);

  res.status(201).json({ success: true, coupon: newCoupon });
});

// Admin Delete Coupon
app.delete('/api/coupons/:code', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-admin-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  const coupons = db.getCoupons();
  const filtered = coupons.filter(c => c.code.toUpperCase() !== req.params.code.toUpperCase());
  if (coupons.length === filtered.length) {
    return res.status(404).json({ message: 'Coupon not found' });
  }
  db.saveCoupons(filtered);
  res.json({ success: true, message: 'Coupon deleted successfully' });
});

// 11. Email Notification Logs API
// Admin Emails List
app.get('/api/emails', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-admin-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  const emails = db.getEmails();
  res.json(emails);
});

// Customer Emails List
app.get('/api/my-emails', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-user-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized client access' });
  }
  const userId = authHeader.replace('Bearer elite-user-token-', '');
  const users = db.getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const emails = db.getEmails();
  const userEmails = emails.filter(e => e.to === user.email || e.userId === userId);
  res.json(userEmails);
});

// Admin Verification Logs API
app.get('/api/verification-logs', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer elite-admin-token-')) {
    return res.status(401).json({ success: false, message: 'Unauthorized admin access' });
  }
  const logs = db.getVerificationLogs();
  res.json(logs);
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
