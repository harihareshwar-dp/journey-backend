const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const { db } = require('../firebase');
const { doc, setDoc, collection, addDoc, getDoc } = require('firebase/firestore');
const { cleanWorksheetAnalysisResponse } = require('../utils/worksheetResponseFormatter');

const analyzeWorksheet = async (req, res) => {
  try {
    const { topic, difficulty, questions, userId, journeyId, worksheetId } = req.body;

    if (!topic || !difficulty || !questions || !Array.isArray(questions) || !userId || !journeyId || !worksheetId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: topic, difficulty, questions, userId, journeyId, worksheetId'
      });
    }

    // Prepare the analysis prompt for all questions
    const analysisPrompt = `As an expert IB Mathematics examiner, analyze this student's answers for multiple questions in detail.
Use LaTeX notation for ALL mathematical expressions, enclosed in $ symbols for inline math and $$ for display math.
Use LaTeX commands with double backslash (e.g., \\\\frac{a}{b} for fractions, \\\\cdot for multiplication, \\\\sqrt{x} for square roots).
Use \\n for line breaks in explanations.

IMPORTANT INSTRUCTION: For each question, break down the student's work into MULTIPLE logical steps (at least 3-4 steps per question) and analyze each step separately. Do not combine all analysis into a single step.

Topic: ${topic}
Difficulty Level: ${difficulty}

${questions.map((q, idx) => `
Question ${idx + 1}: ${q.question}
Student's Answer: ${q.userAnswer}
Mark Scheme:
Steps:
${q.markscheme.steps.map(step => `- ${step.step}`).join('\\n')}
Common Errors:
${q.markscheme.common_errors.join('\\n')}
`).join('\\n\\n')}

Analyze each answer and provide a detailed response in EXACTLY this JSON format,very important:

{
  "questionAnalyses": [
    {
      "questionId": "string (matching the input question ID)",
      "stepByStepAnalysis": [
        {
          "step": "string (what the student did, use LaTeX with \\\\frac, \\\\cdot, etc.) it can be simplified to a single line",
          "feedback": "string (detailed feedback with LaTeX math)",
          "isCorrect": boolean,
          "workingShown": "string (student's working with LaTeX formatting) can also be simplified to a single line"
        },
        {
          "step": "string (next step the student took) can also be simplified to a single line",
          "feedback": "string (feedback for this step)",
          "isCorrect": boolean,
          "workingShown": "string (student's working for this step) can also be simplified to a single line"
        },
        // Include ALL steps ,not just one
      ],
      
    }
  ],
  "strengthAreas": ["overall strength areas of the student(string)-array of strings"],
  "improvementAreas": ["overall improvement areas of the student(string)-array of strings"]
 
}`;

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert IB Mathematics examiner specializing in Numbers and Algebra topics. You must use LaTeX notation for ALL mathematical expressions and respond with ONLY a valid JSON object matching the specified structure. Use $ for inline math, $$ for display math, and double backslash for LaTeX commands (\\\\frac, \\\\cdot, \\\\sqrt, etc.). Use \\n for line breaks."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 2000
    });

    const analysisResponse = completion.choices[0].message.content.trim();
    console.log("Raw GPT response:", analysisResponse);
    const cost = {
      inputTokens: completion.usage.prompt_tokens,
      outputTokens: completion.usage.completion_tokens,
      totalCost: (completion.usage.prompt_tokens * 0.15 / 1000000) + (completion.usage.completion_tokens * 0.6 / 1000000)
    }

    console.log(cost);

    console.log("Raw GPT response:", analysisResponse);
    
    let aiAnalysis;
    try {
      const cleanedResponse = cleanWorksheetAnalysisResponse(analysisResponse);
      console.log("Cleaned response:", cleanedResponse);
      aiAnalysis = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("JSON parse error:", parseError.message);
      console.error("Failed to parse response:", analysisResponse);
      
      // Attempt a last-resort manual fix for common specific issues we've seen
      try {
        // If missing questionAnalyses array closing bracket
        let fixedResponse = analysisResponse;
        
        // Check if we're missing the end of the JSON structure
        if (!fixedResponse.trim().endsWith('}')) {
          fixedResponse = fixedResponse.trim() + '}';
        }
        
        // Use regex to extract the JSON object
        const jsonMatch = fixedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          fixedResponse = jsonMatch[0];
        }
        
        // Fix common GPT-4 formatting issues
        fixedResponse = fixedResponse
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .replace(/(\r\n|\n|\r)/gm, '')
          .replace(/,\s*([\]}])/g, '$1')
          .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
          // Handle LaTeX specific issues
          .replace(/\\\\([a-zA-Z]+)/g, '\\\\\\\\$1')
          // Fix boolean values in strings
          .replace(/"(true|false)"/g, '$1')
          // Fix missing commas between array items
          .replace(/}(\s*){/g, '},{')
          // Fix missing commas between object properties
          .replace(/"([^"]+)"(\s*)"([^"]+)"/g, '"$1","$3"')
          .trim();
        
        console.log("Manual fix attempt:", fixedResponse);
        aiAnalysis = JSON.parse(fixedResponse);
      } catch (lastError) {
        // If all parsing attempts fail, create a minimal valid structure
        console.error("All parsing attempts failed:", lastError.message);
        aiAnalysis = {
          questionAnalyses: [],
          strengthAreas: ["Unable to determine due to parsing error"],
          improvementAreas: ["Unable to determine due to parsing error"]
        };
      }
    }

    // Check if we have the expected structure
    if (!aiAnalysis || !aiAnalysis.questionAnalyses || !Array.isArray(aiAnalysis.questionAnalyses)) {
      throw new Error('Invalid analysis structure received from AI: missing questionAnalyses array');
    }

    if (!aiAnalysis.strengthAreas || !Array.isArray(aiAnalysis.strengthAreas)) {
      aiAnalysis.strengthAreas = ["General understanding of the topic"];
    }

    if (!aiAnalysis.improvementAreas || !Array.isArray(aiAnalysis.improvementAreas)) {
      aiAnalysis.improvementAreas = ["Practice with more complex problems"];
    }

    // Calculate scores manually using AI's step analysis
    let totalScore = 0;
    let totalPossibleScore = 0;

    const scoredAnalysis = {
      userId,
      journeyId,
      worksheetId,
      topic,
      difficulty,
      timestamp: new Date().toISOString(),
      questionAnalyses: aiAnalysis.questionAnalyses.map((analysis, idx) => {
        const question = questions[idx];
        let questionScore = 0;
        const totalMarks = question.markscheme.total_marks;
        
        // Ensure stepByStepAnalysis exists and is an array
        if (!analysis.stepByStepAnalysis || !Array.isArray(analysis.stepByStepAnalysis)) {
          analysis.stepByStepAnalysis = [];
          console.warn(`Missing stepByStepAnalysis for question ${idx + 1}`);
        }
        
        // Match steps with mark scheme and calculate scores
        analysis.stepByStepAnalysis.forEach((step, stepIndex) => {
          if (step && step.isCorrect && question.markscheme.steps[stepIndex]) {
            questionScore += question.markscheme.steps[stepIndex].marks;
          }
        });

        totalScore += questionScore;
        totalPossibleScore += totalMarks;

        return {
          ...analysis,
          overallGrade: questionScore,
          totalMarks: totalMarks,
          percentageScore: Math.round((questionScore / totalMarks) * 100)
        };
      }),
      areasOfImprovement: aiAnalysis.improvementAreas,
      areasOfStrength: aiAnalysis.strengthAreas
    };

    // Add total worksheet scores
    scoredAnalysis.totalScore = totalScore;
    scoredAnalysis.totalPossibleScore = totalPossibleScore;
    scoredAnalysis.percentageScore = Math.round((totalScore / totalPossibleScore) * 100);

    // Store in Firebase with a specific document ID format
    try {
      const worksheetResultId = `${journeyId}_${worksheetId}_${userId}_${Date.now()}`;
      const worksheetResultRef = doc(db, 'worksheetResults', worksheetResultId);
      await setDoc(worksheetResultRef, scoredAnalysis);
      
      // Add the ID to the response
      scoredAnalysis.worksheetResultId = worksheetResultId;
    } catch (dbError) {
      console.error('Error storing worksheet results:', dbError);
      // Continue even if storage fails - we still want to return the analysis
    }

    res.status(200).json({
      success: true,
      analysis: scoredAnalysis
    });

  } catch (error) {
    console.error('Error in worksheet analysis:', error);
    
    // Provide more detailed error information based on error type
    let errorMessage = 'Error analyzing worksheet';
    let statusCode = 500;
    
    if (error.message.includes('parse')) {
      errorMessage = 'Failed to parse AI response. Please try again.';
    } else if (error.message.includes('OpenAI')) {
      errorMessage = 'Error communicating with AI service. Please try again later.';
    } else if (error.message.includes('Firebase')) {
      errorMessage = 'Error storing worksheet results. Your analysis was processed but could not be saved.';
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
};

// Get worksheet result by ID
router.get('/result/:resultId', async (req, res) => {
  try {
    const { resultId } = req.params;
    const resultRef = doc(db, 'worksheetResults', resultId);
    const resultDoc = await getDoc(resultRef);

    if (!resultDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Worksheet result not found'
      });
    }

    res.status(200).json({
      success: true,
      analysis: resultDoc.data()
    });
  } catch (error) {
    console.error('Error fetching worksheet result:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching worksheet result',
      error: error.message
    });
  }
});

router.post('/analyze', analyzeWorksheet);

module.exports = router; 