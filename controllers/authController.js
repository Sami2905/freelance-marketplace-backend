const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const path = require('path');
const bcrypt = require('bcryptjs');

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, email, password, role } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'Email already exists' });
    user = new User({ name, email, password, role });
    await user.save();
    const token = generateToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Always false for localhost
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });
    res.status(201).json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.login = async (req, res) => {
  console.log('🔍 Login request received:', { 
    body: req.body, 
    headers: req.headers,
    method: req.method,
    url: req.url 
  });
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { email, password } = req.body;
  console.log('📧 Login attempt for email:', email);
  
  try {
    const user = await User.findOne({ email });
    console.log('👤 User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('❌ User not found for email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await require('bcryptjs').compare(password, user.password);
    console.log('🔑 Password match:', isMatch ? 'Yes' : 'No');
    
    if (!isMatch) {
      console.log('❌ Password mismatch for email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = generateToken(user);
    
    // Set the token in an HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Always false for localhost development
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Also include the token in the response body for client-side storage if needed
    res.json({ 
      user: { 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        profilePicture: user.profilePicture
      },
      token // Include the token in the response body
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: false, // Always false for localhost development
    sameSite: 'lax'
  });
  res.json({ msg: 'Logged out' });
};

exports.updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, email } = req.body;
  try {
    const update = {};
    if (name) update.name = name;
    if (email) update.email = email;
    const user = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePicture: `/uploads/${req.file.filename}` },
      { new: true }
    );
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role, profilePicture: user.profilePicture } });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ msg: 'Both current and new password are required' });
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ msg: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Add demo email verification and password reset endpoints
exports.sendVerificationCode = async (req, res) => {
  // Demo: always succeed and return a code
  res.json({ msg: 'Verification code sent (demo)', code: '123456' });
};
exports.verifyEmail = async (req, res) => {
  const { code } = req.body;
  if (code === '123456') {
    res.json({ msg: 'Email verified (demo)' });
  } else {
    res.status(400).json({ msg: 'Invalid code' });
  }
};
exports.requestPasswordReset = async (req, res) => {
  // Demo: always succeed
  res.json({ msg: 'Password reset link sent (demo)', code: 'reset123' });
};
exports.resetPassword = async (req, res) => {
  const { code, newPassword } = req.body;
  if (code === 'reset123') {
    res.json({ msg: 'Password reset successful (demo)' });
  } else {
    res.status(400).json({ msg: 'Invalid reset code' });
  }
};

// Add token verification endpoint
exports.verifyToken = async (req, res) => {
  try {
    // The token is already verified by the auth middleware
    // If we reach here, the token is valid
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }
    
    res.json({ 
      valid: true, 
      user: { 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      } 
    });
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
}; 