const express = require('express');
const { createGigSimple } = require('../controllers/gigSimpleController');
const { protect, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

router.post('/simple', protect, authorizeRoles('freelancer'), createGigSimple);

module.exports = router; 