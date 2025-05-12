const express = require('express');
const router = express.Router();
const progressCheckController = require('../controllers/progressCheckController');

// Analyze progress based on worksheet results
router.post('/analyze', progressCheckController.analyzeProgress);

module.exports = router; 