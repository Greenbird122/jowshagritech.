const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors()); // Allow your GitHub Pages domain
app.use(express.json());

// In-memory OTP store (email -> { otp, expires })
const otpStore = new Map();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Nodemailer transporter (Gmail)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Test transporter on startup (optional)
transporter.verify((error, success) => {
  if (error) console.error('SMTP connection error:', error);
  else console.log('SMTP ready to send emails');
});

// ---------- ENDPOINT: Send OTP ----------
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  const otp = generateOTP();
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
  otpStore.set(email, { otp, expires });

  try {
    await transporter.sendMail({
      from: `"Jowsh Agritech" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your Jowsh Agritech Verification Code',
      text: `Your OTP is: ${otp}\nIt is valid for 5 minutes.`,
      html: `<p>Your OTP is: <strong>${otp}</strong></p><p>Valid for 5 minutes.</p>`,
    });

    res.json({ success: true, message: 'OTP sent to email' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});

// ---------- ENDPOINT: Verify OTP ----------
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP required' });
  }

  const record = otpStore.get(email);
  if (!record) {
    return res.status(400).json({ success: false, message: 'No OTP found for this email' });
  }

  if (Date.now() > record.expires) {
    otpStore.delete(email);
    return res.status(400).json({ success: false, message: 'OTP expired' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ success: false, message: 'Invalid OTP' });
  }

  // OTP verified – you can now create a session / token
  otpStore.delete(email); // remove after successful verification
  res.json({ success: true, message: 'OTP verified successfully' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Email OTP backend running on port ${PORT}`));
