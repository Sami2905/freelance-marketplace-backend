const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No token, authorization denied' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'Account is deactivated' 
      });
    }

    if (user.isSuspended) {
      return res.status(401).json({ 
        success: false,
        message: 'Account is suspended' 
      });
    }

    // Check if user's role is valid
    const validRoles = ['freelancer', 'client', 'admin'];
    if (!validRoles.includes(user.role)) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid user role' 
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ 
      success: false,
      message: 'Token is not valid' 
    });
  }
};

exports.authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ 
      success: false,
      message: `User role '${req.user.role}' is not authorized to access this resource. Required roles: ${roles.join(', ')}` 
    });
  }
  next();
};

// Enhanced ownership check with better error handling
exports.requireOwnership = (model, paramName = 'id', ownerField = 'user') => async (req, res, next) => {
  try {
    const resource = await model.findById(req.params[paramName]);
    
    if (!resource) {
      return res.status(404).json({ 
        success: false,
        message: 'Resource not found' 
      });
    }

    // Check if user owns the resource or is admin
    const ownerId = resource[ownerField] || resource.seller || resource.user;
    
    if (!ownerId) {
      return res.status(500).json({ 
        success: false,
        message: 'Resource ownership field not found' 
      });
    }

    if (ownerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to access this resource' 
      });
    }

    req.resource = resource;
    next();
  } catch (error) {
    console.error('Ownership check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Check if user can access gig (owner, admin, or public gig)
exports.canAccessGig = async (req, res, next) => {
  try {
    const gig = await require('../models/Gig').findById(req.params.id);
    
    if (!gig) {
      return res.status(404).json({ 
        success: false,
        message: 'Gig not found' 
      });
    }

    // Public gigs can be accessed by anyone
    if (gig.status === 'active') {
      req.gig = gig;
      return next();
    }

    // Private gigs require ownership or admin access
    if (gig.seller.toString() === req.user.id || req.user.role === 'admin') {
      req.gig = gig;
      return next();
    }

    return res.status(403).json({ 
      success: false,
      message: 'Not authorized to access this gig' 
    });
  } catch (error) {
    console.error('Gig access check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Check if user can modify gig (owner or admin)
exports.canModifyGig = async (req, res, next) => {
  try {
    const gig = await require('../models/Gig').findById(req.params.id);
    
    if (!gig) {
      return res.status(404).json({ 
        success: false,
        message: 'Gig not found' 
      });
    }

    if (gig.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to modify this gig' 
      });
    }

    req.gig = gig;
    next();
  } catch (error) {
    console.error('Gig modification check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Check if user can access order (buyer, seller, or admin)
exports.canAccessOrder = async (req, res, next) => {
  try {
    const order = await require('../models/Order').findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    if (order.buyer.toString() === req.user._id.toString() || 
        order.seller.toString() === req.user._id.toString() || 
        req.user.role === 'admin') {
      req.order = order;
      return next();
    }

    return res.status(403).json({ 
      success: false,
      message: 'Not authorized to access this order' 
    });
  } catch (error) {
    console.error('Order access check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

// Rate limiting middleware
exports.rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.user ? req.user._id.toString() : req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const userRequests = requests.get(key);
    const recentRequests = userRequests.filter(time => time > windowStart);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later'
      });
    }
    
    recentRequests.push(now);
    requests.set(key, recentRequests);
    
    next();
  };
};

// Demo 2FA middleware
exports.require2FA = (req, res, next) => {
  if (req.user && req.user.twoFactorEnabled) {
    const code = req.headers['x-2fa-code'];
    if (code !== '654321') {
      return res.status(401).json({ 
        success: false,
        message: '2FA code required or invalid (demo)' 
      });
    }
  }
  next();
};

// Check if user has required permissions
exports.hasPermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required' 
    });
  }

  // Admin has all permissions
  if (req.user.role === 'admin') {
    return next();
  }

  // Check user-specific permissions
  const userPermissions = req.user.permissions || [];
  
  if (!userPermissions.includes(permission)) {
    return res.status(403).json({ 
      success: false,
      message: `Permission '${permission}' required` 
    });
  }

  next();
};

// Log user activity
exports.logActivity = (action) => (req, res, next) => {
  const activity = {
    user: req.user.id,
    action,
    resource: req.params.id || req.body.id,
    timestamp: new Date(),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  };
  
  // In a real application, you'd save this to a database
  console.log('User Activity:', activity);
  
  next();
}; 