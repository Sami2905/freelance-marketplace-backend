// Usage: node scripts/checkUsers.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/freelance-marketplace');
    console.log('Connected to MongoDB');
    
    const users = await User.find({});
    console.log(`\nFound ${users.length} users in database:\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Password hash: ${user.password.substring(0, 20)}...`);
      console.log(`   Created: ${user.createdAt}`);
      console.log('');
    });
    
    // Test password hashing
    console.log('Testing password hashing...');
    const testPassword = 'password';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    console.log(`Original password: ${testPassword}`);
    console.log(`Hashed password: ${hashedPassword.substring(0, 20)}...`);
    
    // Test if any user has the password 'password'
    for (const user of users) {
      const isMatch = await bcrypt.compare(testPassword, user.password);
      console.log(`${user.email} password match: ${isMatch}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers(); 