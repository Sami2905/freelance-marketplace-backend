const express = require('express');
const { body } = require('express-validator');
const { 
  createOrder, 
  getOrders, 
  getOrder, 
  updateOrderStatus,
  submitDelivery,
  requestRevision,
  completeOrder,
  cancelOrder,
  getBuyerOrders,
  getSellerOrders,
  getOrderMessages,
  sendOrderMessage
} = require('../controllers/orderController');
const { protect, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

// Client routes
router.post('/', [
  body('gigId').isMongoId().withMessage('Valid gig ID is required'),
  body('requirements').notEmpty().withMessage('Requirements are required'),
  body('amount').isNumeric().withMessage('Amount must be a number').isFloat({ min: 5 }).withMessage('Amount must be at least $5')
], authorizeRoles('client'), createOrder);

router.get('/buyer', authorizeRoles('client'), getBuyerOrders);

// Freelancer routes
router.get('/seller', authorizeRoles('freelancer'), getSellerOrders);

// Shared routes
router.get('/', getOrders);
router.get('/:id', getOrder);

router.patch('/:id/status', [
  body('status').isIn(['pending', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('message').optional().isString().withMessage('Message must be a string')
], authorizeRoles('freelancer', 'client', 'admin'), updateOrderStatus);

router.post('/:id/delivery', [
  body('message').optional().isString().withMessage('Message must be a string')
], authorizeRoles('freelancer'), submitDelivery);

router.post('/:id/revision', [
  body('message').notEmpty().withMessage('Revision message is required')
], authorizeRoles('client'), requestRevision);

router.patch('/:id/complete', authorizeRoles('client'), completeOrder);

router.patch('/:id/cancel', [
  body('reason').optional().isString().withMessage('Reason must be a string')
], cancelOrder);

// Order messages
router.get('/:id/messages', getOrderMessages);
router.post('/:id/messages', [
  body('content').notEmpty().withMessage('Message content is required').isLength({ max: 2000 }).withMessage('Message too long')
], sendOrderMessage);

module.exports = router; 