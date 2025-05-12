const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const worksheetAnalysisRouter = require('./routes/worksheetAnalysis');
const answerAnalysisRouter = require('./routes/answerAnalysis');
const testQuestionsRouter = require('./routes/testQuestions');
const worksheetsRouter = require('./routes/worksheets');
const journeysRouter = require('./routes/journeys');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/worksheet-analysis', worksheetAnalysisRouter);
app.use('/api/answer-analysis', answerAnalysisRouter);
app.use('/api/test-questions', testQuestionsRouter);
app.use('/api/worksheets', worksheetsRouter);
app.use('/api/journeys', journeysRouter);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 