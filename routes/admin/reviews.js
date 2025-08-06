const express = require('express');
const { protect, authorize } = require('../../middlewares/auth');
const {
  getReviews,
  getReview,
  approveReview,
  rejectReview,
  flagReview,
  updateReviewStatus,
  addAdminResponse,
  deleteReview
} = require('../../controllers/admin/reviewController');

const router = express.Router();

// All routes are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

// GET /api/admin/reviews
// GET /api/admin/reviews?status=pending&sort=newest&page=1
router.get('/', getReviews);

// GET /api/admin/reviews/:id
router.get('/:id', getReview);

// PUT /api/admin/reviews/:id/approve
router.put('/:id/approve', approveReview);

// PUT /api/admin/reviews/:id/reject
router.put('/:id/reject', rejectReview);

// POST /api/admin/reviews/:id/flag
router.post('/:id/flag', flagReview);

// PUT /api/admin/reviews/:id/status
router.put('/:id/status', updateReviewStatus);

// POST /api/admin/reviews/:id/response
router.post('/:id/response', addAdminResponse);

// DELETE /api/admin/reviews/:id
router.delete('/:id', deleteReview);

module.exports = router;
