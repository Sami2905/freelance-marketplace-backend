const express = require('express');
const { body } = require('express-validator');
const { 
  getDashboardStats,
  getUsers,
  updateUser,
  deleteUser,
  getGigs,
  updateGigStatus,
  getOrders,
  getReviews,
  updateReviewStatus,
  getAnalytics
} = require('../controllers/adminController');
const { protect, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

// All routes require admin role
router.use(protect);
router.use(authorizeRoles('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);
router.get('/analytics', getAnalytics);

// User management
router.get('/users', getUsers);
router.put('/users/:id', [
  body('role').optional().isIn(['client', 'freelancer', 'admin']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('isSuspended').optional().isBoolean().withMessage('isSuspended must be a boolean')
], updateUser);
router.delete('/users/:id', deleteUser);

// Gig management
router.get('/gigs', getGigs);
router.patch('/gigs/:id/status', [
  body('status').isIn(['active', 'paused', 'rejected']).withMessage('Invalid status'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], updateGigStatus);

// Order management
router.get('/orders', getOrders);

// Review management
router.get('/reviews', getReviews);
router.patch('/reviews/:id/status', [
  body('status').isIn(['approved', 'rejected']).withMessage('Invalid status'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], updateReviewStatus);

module.exports = router;