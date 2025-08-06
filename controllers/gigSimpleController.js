const GigSimple = require('../models/GigSimple');

exports.createGigSimple = async (req, res) => {
  try {
    console.log('Creating simple gig with data:', req.body);
    console.log('User:', req.user);

    const gig = new GigSimple({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      subcategory: req.body.subcategory,
      price: req.body.price,
      deliveryTime: req.body.deliveryTime,
      revisions: req.body.revisions || 0,
      tags: req.body.tags || [],
      requirements: req.body.requirements || [],
      seller: req.user._id,
      status: 'draft'
    });

    console.log('Gig object created, attempting to save...');
    await gig.save();
    console.log('Gig saved successfully');

    res.status(201).json({
      success: true,
      data: gig
    });
  } catch (error) {
    console.error('Create simple gig error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}; 