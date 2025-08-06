// Usage: node scripts/testAdminPassword.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function testAdminPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/freelance-marketplace');
    console.log('Connected to MongoDB');
    
    const admin = await User.findOne({ email: 'admin@example.com' });
    if (!admin) {
      console.log('Admin user not found');
      return;
    }
    
    console.log('Admin user found:', admin.email);
    console.log('Admin password hash:', admin.password);
    
    // Test different passwords
    const passwordsToTest = ['adminpass', 'password', 'admin', '123456'];
    
    for (const password of passwordsToTest) {
      const isMatch = await bcrypt.compare(password, admin.password);
      console.log(`Password "${password}" match: ${isMatch}`);
    }
    
    // Create a new admin with correct password
    console.log('\nCreating new admin with correct password...');
    await User.deleteOne({ email: 'admin@example.com' });
    
    const newAdmin = new User({
      name: 'Admin',
      email: 'admin@example.com',
      password: 'adminpass',
      role: 'admin'
    });
    
    await newAdmin.save();
    console.log('New admin created successfully');
    
    // Test the new admin password
    const updatedAdmin = await User.findOne({ email: 'admin@example.com' });
    const isMatch = await bcrypt.compare('adminpass', updatedAdmin.password);
    console.log(`New admin password "adminpass" match: ${isMatch}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testAdminPassword(); 