// Usage: node scripts/createDevUser.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function createDevUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/freelance-marketplace');
    console.log('Connected to MongoDB');
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: 'dev1@gmail.com' });
    if (existingUser) {
      console.log('User dev1@gmail.com already exists');
      return;
    }
    
    // Create the dev user
    const devUser = new User({
      name: 'Developer One',
      email: 'dev1@gmail.com',
      password: 'password',
      role: 'client'
    });
    
    await devUser.save();
    console.log('Dev user created successfully: dev1@gmail.com / password');
    
    // Verify the user was created
    const createdUser = await User.findOne({ email: 'dev1@gmail.com' });
    console.log('Created user:', {
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createDevUser(); 