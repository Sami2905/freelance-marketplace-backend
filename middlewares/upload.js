const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const userId = req.user ? req.user._id : 'anonymous';
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${userId}-${uniqueSuffix}-${sanitizedFilename}`);
  }
});

// Enhanced file filter with better validation
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
  }

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return cb(new Error(`File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`), false);
  }

  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(fileExtension)) {
    return cb(new Error(`Invalid file extension. Allowed extensions: ${allowedExtensions.join(', ')}`), false);
  }

  cb(null, true);
};

// Configure multer with enhanced options
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10, // Max 10 files for gig images
    fieldSize: 2 * 1024 * 1024 // 2MB for field data
  }
});

// Custom error handling middleware
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 10 files allowed.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message.includes('Invalid file type') || error.message.includes('Invalid file extension')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  console.error('Upload error:', error);
  res.status(500).json({
    success: false,
    message: 'File upload failed.'
  });
};

// Helper function to process uploaded files
const processUploadedFiles = (files) => {
  if (!files) return [];
  
  const fileArray = Array.isArray(files) ? files : [files];
  
  return fileArray.map(file => ({
    url: `/uploads/${file.filename}`,
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    isPrimary: false,
    uploadedAt: new Date()
  }));
};

// Helper function to validate image dimensions (optional)
const validateImageDimensions = async (filePath, minWidth = 200, minHeight = 200) => {
  try {
    const sharp = require('sharp');
    const metadata = await sharp(filePath).metadata();
    
    if (metadata.width < minWidth || metadata.height < minHeight) {
      throw new Error(`Image dimensions too small. Minimum: ${minWidth}x${minHeight}px`);
    }
    
    return true;
  } catch (error) {
    if (error.message.includes('dimensions too small')) {
      throw error;
    }
    // If sharp is not available or other error, skip dimension validation
    return true;
  }
};

module.exports = {
  upload,
  handleUploadError,
  processUploadedFiles,
  validateImageDimensions
}; 