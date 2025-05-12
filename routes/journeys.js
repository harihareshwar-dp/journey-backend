const express = require('express');
const router = express.Router();
const journeyController = require('../controllers/journeyController');

// Create a new journey
router.post('/create', journeyController.createJourney);

// Get all journeys for a user
router.get('/user/:userId', journeyController.getUserJourneys);

// Get a specific journey by ID
router.get('/:journeyId', journeyController.getJourneyById);

// Update journey task completion
router.patch('/:journeyId/tasks/:day', journeyController.updateTaskCompletion);

// Update journey completion status
router.patch('/:journeyId/complete', journeyController.updateJourneyCompletionStatus);

// Add new tasks to a journey
router.post('/:journeyId/tasks', journeyController.addJourneyTasks);

// Update topics to review
router.patch('/:journeyId/topics-to-review', journeyController.updateTopicsToReview);

router.put('/:journeyId/full-update', journeyController.updateEntireJourney);

module.exports = router; 