const express = require('express');
const { body } = require('express-validator');
const { 
  createGig, 
  getGigs, 
  getGig, 
  updateGig, 
  deleteGig, 
  getUserGigs,
  searchGigs,
  updateGigStatus,
  addImages,
  setPrimaryImage,
  removeImage
} = require('../controllers/gigController');
const { createGigSimple } = require('../controllers/gigSimpleController');
const { protect, authorizeRoles, canModifyGig } = require('../middlewares/auth');
const { upload, handleUploadError } = require('../middlewares/upload');

const router = express.Router();

// Public routes
router.get('/', getGigs);
router.get('/search', searchGigs);
router.get('/:id', getGig);

// Simple gig creation route for testing (before protect middleware)
router.post('/simple', protect, authorizeRoles('freelancer'), createGigSimple);

// Debug route to check current user
router.get('/debug/user', protect, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    message: 'User authenticated successfully'
  });
});

// Protected routes
router.use(protect);

// Freelancer routes
router.post('/', authorizeRoles('freelancer'), upload.array('images', 10), handleUploadError, createGig);

router.get('/user/me', authorizeRoles('freelancer'), getUserGigs);

router.put('/:id', [
  body('title').optional().isLength({ min: 10, max: 100 }).withMessage('Title must be between 10 and 100 characters'),
  body('description').optional().isLength({ min: 50, max: 2000 }).withMessage('Description must be between 50 and 2000 characters'),
  body('price').optional().isNumeric().withMessage('Price must be a number').isFloat({ min: 5 }).withMessage('Price must be at least $5'),
  body('deliveryTime').optional().isInt({ min: 1, max: 30 }).withMessage('Delivery time must be between 1 and 30 days'),
  body('revisions').optional().isInt({ min: 0, max: 10 }).withMessage('Revisions must be between 0 and 10')
], authorizeRoles('freelancer'), canModifyGig, updateGig);

router.delete('/:id', authorizeRoles('freelancer'), canModifyGig, deleteGig);

router.patch('/:id/status', [
  body('status').isIn(['draft', 'pending', 'active', 'paused']).withMessage('Invalid status')
], authorizeRoles('freelancer', 'admin'), updateGigStatus);

// Image management routes
router.post('/:id/images', 
  canModifyGig,
  upload.array('images', 10), 
  handleUploadError,
  addImages
);

router.patch('/:id/images/primary', [
  body('imageIndex').isInt({ min: 0 }).withMessage('Valid image index required')
], canModifyGig, setPrimaryImage);

router.delete('/:id/images/:imageIndex', canModifyGig, removeImage);

// Admin routes
router.patch('/:id/admin/status', [
  body('status').isIn(['active', 'paused', 'rejected']).withMessage('Invalid status'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], authorizeRoles('admin'), updateGigStatus);



module.exports = router; 