@echo off
set NODE_ENV=development
set PORT=5000
set MONGO_URI=mongodb://localhost:27017/freelance-marketplace
set JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
set CLIENT_URL=http://localhost:3000
set RATE_LIMIT_WINDOW_MS=900000
set RATE_LIMIT_MAX_REQUESTS=100

echo Starting server...
node src/index.js 