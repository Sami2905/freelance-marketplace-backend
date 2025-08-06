require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file or copy from env.example');
  process.exit(1);
}

console.log('Environment loaded successfully');
console.log('MongoDB URI:', process.env.MONGO_URI ? '✓ Set' : '✗ Missing');
console.log('JWT Secret:', process.env.JWT_SECRET ? '✓ Set' : '✗ Missing');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();

const isDev = process.env.NODE_ENV !== 'production';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      clientUrl, 
      'http://localhost:3000', 
      'http://localhost:3001', 
      'http://127.0.0.1:3000', 
      'http://127.0.0.1:3001',
      'https://freelance-marketplace-frontend.netlify.app',
      'https://freelance-markeetplace.netlify.app',
      'https://freelance-marketplace-frontend.netlify.app/',
      'https://freelance-markeetplace.netlify.app/'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));

// Add CORS headers to all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    clientUrl, 
    'http://localhost:3000', 
    'http://localhost:3001', 
    'http://127.0.0.1:3000', 
    'http://127.0.0.1:3001',
    'https://freelance-marketplace-frontend.netlify.app',
    'https://freelance-markeetplace.netlify.app',
    'https://freelance-marketplace-frontend.netlify.app/',
    'https://freelance-markeetplace.netlify.app/'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  res.setHeader('Vary', 'Origin');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Relax helmet for /uploads to allow cross-origin images
app.use('/uploads', helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));

// Use default helmet for all other routes except /uploads
app.use((req, res, next) => {
  if (!req.path.startsWith('/uploads')) {
    helmet()(req, res, next);
  } else {
    next();
  }
});
app.use(compression());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: isDev ? 1000 : 100 }));

// Health check route
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });

// Import routes
const authRoutes = require('../routes/auth');
const gigRoutes = require('../routes/gigs');
const gigSimpleRoutes = require('../routes/gigSimple');
const orderRoutes = require('../routes/orders');
const messageRoutes = require('../routes/messages');
const reviewRoutes = require('../routes/reviews');
const adminRoutes = require('../routes/admin');

// Handle OPTIONS requests for CORS preflight
app.options('*', cors(corsOptions));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/gigs', gigRoutes);
app.use('/api/gigs', gigSimpleRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'https://freelance-marketplace-frontend.netlify.app',
    'https://freelance-markeetplace.netlify.app'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  next();
}, express.static(uploadsPath, {
  setHeaders: (res, path) => {
    const origin = res.req?.headers?.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'https://freelance-marketplace-frontend.netlify.app',
      'https://freelance-markeetplace.netlify.app'
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}));
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.join(__dirname, '../../client/public/favicon.svg');
  if (fs.existsSync(faviconPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(faviconPath);
  } else {
    res.status(404).send('Favicon not found');
  }
});
app.get('/uploads/default-gig.png', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/public/default-gig.png'));
});
app.get('/api/uploads/list', (req, res) => {
  const uploadsDir = path.join(__dirname, '../uploads');
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return res.status(500).json({ msg: 'Failed to list uploads', error: err.message });
    res.json({ files });
  });
});

// After express.static for /uploads, add a catch-all to always set CORS headers for 404s
app.use('/uploads', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Vary', 'Origin');
  res.status(404).send('Not found');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ msg: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 