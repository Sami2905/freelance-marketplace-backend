const express = require('express');
const { body } = require('express-validator');
const { 
  createReview, 
  getGigReviews, 
  getUserReviews,
  updateReview,
  deleteReview,
  reportReview
} = require('../controllers/reviewController');
const { protect, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

// Public routes
router.get('/gig/:gigId', getGigReviews);
router.get('/user/:userId', getUserReviews);

// Protected routes
router.use(protect);

// Client routes
router.post('/', [
  body('orderId').isMongoId().withMessage('Valid order ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').notEmpty().withMessage('Review comment is required').isLength({ max: 1000 }).withMessage('Comment too long')
], authorizeRoles('client'), createReview);

router.put('/:id', [
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 1000 }).withMessage('Comment too long')
], authorizeRoles('client'), updateReview);

router.delete('/:id', authorizeRoles('client'), deleteReview);

// Report review
router.post('/:id/report', [
  body('reason').notEmpty().withMessage('Report reason is required')
], reportReview);

module.exports = router; 