const express = require('express');
const { body } = require('express-validator');
const { register, login, updateProfile, logout, getProfile, uploadProfilePicture, changePassword, sendVerificationCode, verifyEmail, requestPasswordReset, resetPassword, verifyToken } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, req.user.id + '-' + Date.now() + ext);
  }
});
const upload = multer({ storage });

const router = express.Router();

router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['client', 'freelancer']).withMessage('Role must be client or freelancer'),
], register);

router.post('/login', login);

router.post('/logout', logout);

router.put('/profile', protect, updateProfile);
router.get('/profile', protect, getProfile);
router.put('/profile-picture', protect, upload.single('profilePicture'), uploadProfilePicture);
router.put('/change-password', protect, changePassword);
router.post('/send-verification-code', sendVerificationCode);
router.post('/verify-email', verifyEmail);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

router.get('/verify', protect, verifyToken);

module.exports = router; 