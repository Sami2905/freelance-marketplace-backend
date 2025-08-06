const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const Gig = require('../models/Gig');
const User = require('../models/User');

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private (Client)
exports.createOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gigId, requirements, amount } = req.body;

    // Check if gig exists and is active
    const gig = await Gig.findById(gigId);
    if (!gig) {
      return res.status(404).json({
        success: false,
        message: 'Gig not found'
      });
    }

    if (gig.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Gig is not available for orders'
      });
    }

    // Check if user is not the seller
    if (gig.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot order your own gig'
      });
    }

    const order = new Order({
      gig: gigId,
      buyer: req.user._id,
      seller: gig.seller,
      amount,
      requirements,
      status: 'pending'
    });

    await order.save();

    // Populate gig and seller details
    await order.populate('gig', 'title images');
    await order.populate('seller', 'name profilePicture');

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all orders (admin only)
// @route   GET /api/orders
// @access  Private (Admin)
exports.getOrders = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const orders = await Order.find()
      .populate('gig', 'title')
      .populate('buyer', 'name email')
      .populate('seller', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('gig', 'title images category')
      .populate('buyer', 'name email profilePicture')
      .populate('seller', 'name email profilePicture');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user is authorized to view this order
    if (req.user.role !== 'admin' && 
        order.buyer.toString() !== req.user._id && 
        order.seller.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get buyer orders
// @route   GET /api/orders/buyer
// @access  Private (Client)
exports.getBuyerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate('gig', 'title images category')
      .populate('seller', 'name profilePicture')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Get buyer orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get seller orders
// @route   GET /api/orders/seller
// @access  Private (Freelancer)
exports.getSellerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ seller: req.user._id })
      .populate('gig', 'title images category')
      .populate('buyer', 'name profilePicture')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Get seller orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private
exports.updateOrderStatus = async (req, res) => {
  try {


    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, message } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && 
        order.buyer.toString() !== req.user._id.toString() && 
        order.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this order'
      });
    }

    // Add message to order messages
    if (message && message.trim() && message.trim().length > 0) {
      order.messages.push({
        sender: req.user._id,
        content: message.trim(),
        timestamp: new Date()
      });
    }

    order.status = status;
    
    // Set completion date if order is completed
    if (status === 'completed') {
      order.completedDate = new Date();
    }

    await order.save();

    await order.populate('gig', 'title');
    await order.populate('buyer', 'name');
    await order.populate('seller', 'name');

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Submit delivery
// @route   POST /api/orders/:id/delivery
// @access  Private (Freelancer)
exports.submitDelivery = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user is the seller
    if (order.seller.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit delivery for this order'
      });
    }

    order.status = 'delivered';
    order.deliveryDate = new Date();
    if (message) {
      order.deliveryMessage = message;
    }

    // Add message to order messages
    order.messages.push({
      sender: req.user._id,
      content: (message && message.trim()) ? message.trim() : 'Delivery submitted',
      timestamp: new Date()
    });

    await order.save();

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Submit delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Request revision
// @route   POST /api/orders/:id/revision
// @access  Private (Client)
exports.requestRevision = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user is the buyer
    if (order.buyer.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to request revision for this order'
      });
    }

    // Add revision request
    order.revisionRequests.push({
      message,
      requestedAt: new Date(),
      status: 'pending'
    });

    // Add message to order messages
    if (message && message.trim() && message.trim().length > 0) {
      order.messages.push({
        sender: req.user._id,
        content: message.trim(),
        timestamp: new Date()
      });
    }

    await order.save();

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Request revision error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Complete order
// @route   PATCH /api/orders/:id/complete
// @access  Private (Client)
exports.completeOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user is the buyer
    if (order.buyer.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete this order'
      });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Order must be delivered before completion'
      });
    }

    order.status = 'completed';
    order.completedDate = new Date();

    // Update seller stats
    const seller = await User.findById(order.seller);
    seller.totalOrders += 1;
    seller.totalEarnings += order.amount;
    await seller.save();

    // Update gig stats
    const gig = await Gig.findById(order.gig);
    gig.totalOrders += 1;
    gig.totalEarnings += order.amount;
    await gig.save();

    await order.save();

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Complete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Cancel order
// @route   PATCH /api/orders/:id/cancel
// @access  Private
exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && 
        order.buyer.toString() !== req.user._id && 
        order.seller.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    order.status = 'cancelled';
    order.cancelledDate = new Date();
    order.cancelledBy = req.user.role === 'admin' ? 'admin' : 
                       order.buyer.toString() === req.user._id ? 'buyer' : 'seller';
    if (reason) {
      order.cancellationReason = reason;
    }

    await order.save();

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get order messages
// @route   GET /api/orders/:id/messages
// @access  Private
exports.getOrderMessages = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && 
        order.buyer.toString() !== req.user._id && 
        order.seller.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.json({
      success: true,
      data: order.messages || []
    });
  } catch (error) {
    console.error('Get order messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Send message to order
// @route   POST /api/orders/:id/messages
// @access  Private
exports.sendOrderMessage = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && 
        order.buyer.toString() !== req.user._id && 
        order.seller.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages to this order'
      });
    }

    const message = {
      sender: req.user._id,
      content: content.trim(),
      timestamp: new Date(),
      read: false
    };

    order.messages.push(message);
    await order.save();

    // Populate sender info
    const populatedMessage = {
      ...message,
      sender: {
        _id: req.user._id,
        name: req.user.name,
        profilePicture: req.user.profilePicture
      }
    };

    res.json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    console.error('Send order message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};