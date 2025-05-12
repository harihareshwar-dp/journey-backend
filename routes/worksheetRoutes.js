const express = require('express');
const router = express.Router();
const { getWorksheetById, getWorksheetResultById } = require('../controllers/worksheetController');

// Route to get a worksheet by ID
router.get('/:id', getWorksheetById);

// Route to get a worksheet result by ID
router.get('/result/:resultId', getWorksheetResultById);

module.exports = router; 