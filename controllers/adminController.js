const { validationResult } = require('express-validator');
const User = require('../models/User');
const Gig = require('../models/Gig');
const Order = require('../models/Order');
const Review = require('../models/Review');

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalFreelancers,
      totalClients,
      totalGigs,
      activeGigs,
      totalOrders,
      completedOrders,
      totalRevenue,
      pendingReviews
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'freelancer' }),
      User.countDocuments({ role: 'client' }),
      Gig.countDocuments(),
      Gig.countDocuments({ status: 'active' }),
      Order.countDocuments(),
      Order.countDocuments({ status: 'completed' }),
      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Review.countDocuments({ status: 'pending' })
    ]);

    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    // Get recent activity
    const recentOrders = await Order.find()
      .populate('gig', 'title')
      .populate('buyer', 'name')
      .populate('seller', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentUsers = await User.find()
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalFreelancers,
          totalClients,
          totalGigs,
          activeGigs,
          totalOrders,
          completedOrders,
          totalRevenue: revenue,
          pendingReviews
        },
        recentActivity: {
          orders: recentOrders,
          users: recentUsers
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get analytics
// @route   GET /api/admin/analytics
// @access  Private (Admin)
exports.getAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // User registration trends
    const userRegistrations = await User.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Order trends
    const orderTrends = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Revenue by category
    const revenueByCategory = await Order.aggregate([
      { $match: { status: 'completed' } },
      {
        $lookup: {
          from: 'gigs',
          localField: 'gig',
          foreignField: '_id',
          as: 'gigData'
        }
      },
      { $unwind: '$gigData' },
      {
        $group: {
          _id: '$gigData.category',
          revenue: { $sum: '$amount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        userRegistrations,
        orderTrends,
        revenueByCategory
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private (Admin)
exports.updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role, isActive, isSuspended, suspensionReason } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (isSuspended !== undefined) {
      user.isSuspended = isSuspended;
      if (isSuspended) {
        user.suspensionReason = suspensionReason;
        user.suspensionEndDate = null; // Permanent suspension
      } else {
        user.suspensionReason = null;
        user.suspensionEndDate = null;
      }
    }

    await user.save();

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has active orders or gigs
    const activeOrders = await Order.countDocuments({
      $or: [{ buyer: user._id }, { seller: user._id }],
      status: { $in: ['pending', 'accepted', 'in_progress', 'delivered'] }
    });

    const activeGigs = await Gig.countDocuments({
      seller: user._id,
      status: 'active'
    });

    if (activeOrders > 0 || activeGigs > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete user with active orders or gigs'
      });
    }

    await user.remove();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all gigs
// @route   GET /api/admin/gigs
// @access  Private (Admin)
exports.getGigs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, search } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const gigs = await Gig.find(filter)
      .populate('seller', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Gig.countDocuments(filter);

    res.json({
      success: true,
      data: gigs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get gigs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update gig status
// @route   PATCH /api/admin/gigs/:id/status
// @access  Private (Admin)
exports.updateGigStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, reason } = req.body;

    const gig = await Gig.findById(req.params.id);
    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    gig.status = status;
    await gig.save();

    res.json({
      success: true,
      data: gig
    });
  } catch (error) {
    console.error('Update gig status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all orders
// @route   GET /api/admin/orders
// @access  Private (Admin)
exports.getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const orders = await Order.find(filter)
      .populate('gig', 'title')
      .populate('buyer', 'name email')
      .populate('seller', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all reviews
// @route   GET /api/admin/reviews
// @access  Private (Admin)
exports.getReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(filter)
      .populate('reviewer', 'name email')
      .populate('reviewee', 'name email')
      .populate('gig', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(filter);

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update review status
// @route   PATCH /api/admin/reviews/:id/status
// @access  Private (Admin)
exports.updateReviewStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, reason } = req.body;

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    review.status = status;
    await review.save();

    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    console.error('Update review status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 
