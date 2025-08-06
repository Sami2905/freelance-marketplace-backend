// Usage: node scripts/seedDemoData.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Gig = require('../models/Gig');
const Order = require('../models/Order');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Review = require('../models/Review');
const bcrypt = require('bcryptjs');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});
  await Gig.deleteMany({});
  await Order.deleteMany({});
  await Message.deleteMany({});
  await Conversation.deleteMany({});
  await Review.deleteMany({});

  // Create users
  const users = await User.insertMany([
    { name: 'Alice Client', email: 'alice@example.com', password: await bcrypt.hash('password', 10), role: 'client' },
    { name: 'Bob Freelancer', email: 'bob@example.com', password: await bcrypt.hash('password', 10), role: 'freelancer' },
    { name: 'Admin', email: 'admin@example.com', password: await bcrypt.hash('adminpass', 10), role: 'admin' },
  ]);

  // Create gigs
  const gigs = await Gig.insertMany([
    { seller: users[1]._id, title: 'Logo Design', description: 'Professional logo design', price: 50, deliveryTime: 3, category: 'Graphics & Design', subcategory: 'Logo Design', tags: ['logo', 'design'], imageUrl: '/default-gig.png' },
    { seller: users[1]._id, title: 'Website Development', description: 'Full-stack web development', price: 300, deliveryTime: 7, category: 'Programming & Tech', subcategory: 'Web Development', tags: ['web', 'development'], imageUrl: '/default-gig.png' },
  ]);

  // Create orders
  const orders = await Order.insertMany([
    { gig: gigs[0]._id, buyer: users[0]._id, seller: users[1]._id, amount: 50, status: 'completed', requirements: ['Need a modern logo'], deliveryFiles: [], revisionCount: 0 },
    { gig: gigs[1]._id, buyer: users[0]._id, seller: users[1]._id, amount: 300, status: 'in_progress', requirements: ['Build a portfolio site'], deliveryFiles: [], revisionCount: 0 },
  ]);

  // Create conversations
  const conversations = await Conversation.insertMany([
    { participants: [users[0]._id, users[1]._id], order: orders[0]._id, gig: gigs[0]._id },
    { participants: [users[0]._id, users[1]._id], order: orders[1]._id, gig: gigs[1]._id },
  ]);

  // Create messages
  await Message.insertMany([
    { conversation: conversations[0]._id, sender: users[0]._id, content: 'Hi Bob, excited to work with you!' },
    { conversation: conversations[0]._id, sender: users[1]._id, content: 'Thanks Alice! I will start soon.' },
    { conversation: conversations[1]._id, sender: users[0]._id, content: 'Looking forward to the website.' },
  ]);

  // Create reviews
  await Review.insertMany([
    { order: orders[0]._id, reviewer: users[0]._id, reviewee: users[1]._id, gig: gigs[0]._id, rating: 5, comment: 'Great work!' },
    { order: orders[1]._id, reviewer: users[0]._id, reviewee: users[1]._id, gig: gigs[1]._id, rating: 4, comment: 'Good job, but some delays.' },
  ]);

  console.log('Demo data seeded!');
  process.exit();
}

seed().catch(e => { console.error(e); process.exit(1); }); 