const express = require('express');
const cors = require('cors');
const { db } = require('./firebase');
const { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc    } = require('firebase/firestore');
const dotenv = require('dotenv');
const axios = require('axios'); // Add axios for internal API call
const gptRoutes = require('./routes/aiProgressCheck');
const worksheetRoutes = require('./routes/worksheetRoutes');
const journeyRoutes = require('./routes/journeys');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import routes

const worksheetAnalysisRoutes = require('./routes/worksheetAnalysis');
const aiProgressCheckRoutes = require('./routes/aiProgressCheck');

// Use routes

app.use('/api/worksheet-analysis', worksheetAnalysisRoutes);
app.use('/api/ai-progress-check', aiProgressCheckRoutes);
app.use('/api/gpt', gptRoutes);
app.use('/api/worksheets', worksheetRoutes);
app.use('/api/journeys', journeyRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});                            