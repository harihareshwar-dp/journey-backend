const asyncHandler = require('express-async-handler');
const { db } = require('../firebase');
const { doc, getDoc } = require('firebase/firestore');

// @desc    Get worksheet by ID
// @route   GET /api/worksheets/:id
// @access  Public
const getWorksheetById = asyncHandler(async (req, res) => {
    try {
        console.log("Fetching worksheet by ID:", req.params.id);
        const worksheetRef = doc(db, 'worksheets', req.params.id);
        const worksheetDoc = await getDoc(worksheetRef);

        if (!worksheetDoc.exists()) {
            res.status(404);
            throw new Error('Worksheet not found');
        }

        const worksheet = {
            id: worksheetDoc.id,
            ...worksheetDoc.data()
        };

        res.status(200).json(worksheet);
    } catch (error) {
        res.status(500);
        throw new Error('Error fetching worksheet: ' + error.message);
    }
});


// @desc    Get worksheet result by ID
// @route   GET /api/worksheets/result/:resultId
// @access  Public
const getWorksheetResultById = asyncHandler(async (req, res) => {
    try {
        const { resultId } = req.params;

        if (!resultId) {
            res.status(400);
            throw new Error('Result ID is required');
        }

        const resultRef = doc(db, 'worksheetResults', resultId);
        const resultDoc = await getDoc(resultRef);

        if (!resultDoc.exists()) {
            res.status(404);
            throw new Error('Worksheet result not found');
        }

        const resultData = {
            id: resultId,
            ...resultDoc.data()
        };

        res.status(200).json(resultData);

    } catch (error) {
        res.status(500);
        throw new Error('Error fetching worksheet result: ' + error.message);
    }
});


module.exports = {
    getWorksheetById

    ,
    getWorksheetResultById
}; 