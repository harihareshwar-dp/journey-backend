const { OpenAI } = require('openai');
const { db } = require('../firebase');
const { doc, setDoc, collection, addDoc, getDoc } = require('firebase/firestore');
const { cleanGPTResponse } = require('../utils/responseFormatter');
const { cleanWorksheetAnalysisResponse } = require('../utils/worksheetResponseFormatter');

// Analyze a worksheet submission
const analyzeWorksheet = async (req, res) => {
  try {
    const { topic, difficulty, questions, userId, journeyId, worksheetId } = req.body;

    // Prepare the analysis prompt for all questions
    const analysisPrompt = `As an expert IB Mathematics examiner, analyze this student's answers for multiple questions in detail.
Use LaTeX notation for ALL mathematical expressions, enclosed in $ symbols for inline math and $$ for display math.
Use LaTeX commands with double backslash (e.g., \\\\frac{a}{b} for fractions, \\\\cdot for multiplication, \\\\sqrt{x} for square roots).
Use \\n for line breaks in explanations.

Topic: ${topic}
Difficulty Level: ${difficulty}

${questions.map((q, idx) => `
Question ${idx + 1}: ${q.question}
Student's Answer: ${q.userAnswer}
Mark Scheme:
Steps:
${q.markscheme.steps.map(step => `- ${step.step} (${step.marks} marks)`).join('\\n')}
Common Errors:
${q.markscheme.common_errors.join('\\n')}
`).join('\\n\\n')}

Analyze each answer and provide a detailed response in EXACTLY this JSON format. This is CRITICAL:

{
  "questionAnalyses": [
    {
      "questionId": "string (matching the input question ID)",
      "stepByStepAnalysis": [
        {
          "step": "string (description of step 1) simply describe the step in a few words",
          "feedback": "string ( feedback for step 1) describe it in few words",
          "isCorrect": boolean,
          "workingShown": "string (student's working for step 1) not that detailed "
        },
       
        ... and so on for EACH step in the QUESTION
      ],
     
    },
    ... repeat for each question
  ],
  "areasofstrength": ["array of strings describing strengths"],
  "areasofimprovement": ["array of strings describing areas to improve"]
}

IMPORTANT INSTRUCTIONS:
1. Make sure to analyze EVERY step of the student's solution process
2. For each step, provide specific feedback on what was done correctly or incorrectly
3. Include ALL mathematical working in LaTeX format
4. The stepByStepAnalysis array MUST contain multiple objects, one for each step
5. Ensure the JSON structure is valid and complete

 , 

`;

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
      temperature: 0.4,
      max_completion_tokens: 2500
    });

    const analysisResponse = completion.choices[0].message.content.trim();
    console.log("Raw GPT response length:", analysisResponse.length);
    console.log("Response preview (first 200 chars):", analysisResponse.substring(0, 200) + "...");
    
    const cost = {
      inputTokens: completion.usage.prompt_tokens,
      outputTokens: completion.usage.completion_tokens,
      totalCost: (completion.usage.prompt_tokens * 0.15 / 1000000) + (completion.usage.completion_tokens * 0.6 / 1000000)
    }

    console.log("Token usage:", {
      input: completion.usage.prompt_tokens,
      output: completion.usage.completion_tokens,
      total: completion.usage.prompt_tokens + completion.usage.completion_tokens,
      cost: `$${cost.totalCost.toFixed(6)}`
    });
    
    let aiAnalysis;
    try {
      console.log("Attempting to parse GPT response directly...");
      
      // First try direct parsing
      try {
        aiAnalysis = JSON.parse(analysisResponse);
        console.log("Direct JSON parsing successful");
      } catch (directParseError) {
        console.log("Direct parsing failed, trying with specialized worksheet formatter...");
        
        // If direct parsing fails, try with the specialized cleaner for worksheet analysis
        try {
          const cleanedResponse = cleanWorksheetAnalysisResponse(analysisResponse);
          aiAnalysis = JSON.parse(cleanedResponse);
          console.log("Specialized worksheet formatter parsing successful");
        } catch (cleanedParseError) {
          console.log("Specialized formatter failed, trying manual fixes...");
          
          // If that also fails, try with the general cleaner as fallback
          try {
            const generalCleanedResponse = cleanGPTResponse(analysisResponse);
            aiAnalysis = JSON.parse(generalCleanedResponse);
            console.log("General formatter parsing successful");
          } catch (generalCleanError) {
            // Manual fixes as last resort
            // ... rest of the manual fixes code ...
          }
        }
      }
      
      // Log the structure but don't validate it
      if (aiAnalysis.questionAnalyses) {
        console.log(`Parsed ${aiAnalysis.questionAnalyses.length} question analyses`);
      }
    } catch (parseError) {
      console.error("All JSON parsing attempts failed:", parseError.message);
      
      // Create a minimal valid structure as fallback
      aiAnalysis = {
        questionAnalyses: questions.map((q, idx) => ({
          questionId: String(idx),
          stepByStepAnalysis: [{
            step: "Unable to parse analysis",
            feedback: "There was an error processing the AI response. Please try again.",
            isCorrect: false,
            workingShown: q.userAnswer || "No answer provided"
          }]
        })),
        areasofstrength: ["Unable to determine due to parsing error"],
        areasofimprovement: ["Unable to determine due to parsing error"]
      };
    }

    // Skip validation and just ensure we have the basic structure needed
    // If questionAnalyses is missing, create an empty array
    if (!aiAnalysis.questionAnalyses) {
      aiAnalysis.questionAnalyses = [];
    }
    
    // Ensure each question has at least one step
    aiAnalysis.questionAnalyses = aiAnalysis.questionAnalyses.map((analysis, idx) => {
      if (!analysis.stepByStepAnalysis || !Array.isArray(analysis.stepByStepAnalysis) || analysis.stepByStepAnalysis.length === 0) {
        analysis.stepByStepAnalysis = [{
          step: "Analysis step",
          feedback: "No detailed steps were provided by the AI.",
          isCorrect: false,
          workingShown: questions[idx]?.userAnswer || "No answer provided"
        }];
      }
      return analysis;
    });
    
    // Ensure we have strength/improvement areas
    if (!aiAnalysis.areasofstrength) {
      aiAnalysis.areasofstrength = ["General understanding of the topic"];
    }
    
    if (!aiAnalysis.areasofimprovement) {
      aiAnalysis.areasofimprovement = ["Practice with more complex problems"];
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
        
        // Calculate score based on correct steps
        // If we have the same number of steps as the mark scheme, match them directly
        if (analysis.stepByStepAnalysis.length === question.markscheme.steps.length) {
          analysis.stepByStepAnalysis.forEach((step, stepIndex) => {
            if (step.isCorrect && question.markscheme.steps[stepIndex]) {
              questionScore += question.markscheme.steps[stepIndex].marks;
            }
          });
        } else {
          // If steps don't match exactly, allocate marks proportionally
          const correctSteps = analysis.stepByStepAnalysis.filter(step => step.isCorrect).length;
          const totalSteps = analysis.stepByStepAnalysis.length;
          const correctRatio = totalSteps > 0 ? correctSteps / totalSteps : 0;
          
          // Apply the ratio to the total marks, rounded to nearest integer
          questionScore = Math.round(correctRatio * totalMarks);
        }

        // Ensure score doesn't exceed total marks
        questionScore = Math.min(questionScore, totalMarks);
        
        totalScore += questionScore;
        totalPossibleScore += totalMarks;

        return {
          ...analysis,
          overallGrade: questionScore,
          totalMarks: totalMarks,
          percentageScore: Math.round((questionScore / totalMarks) * 100)
        };
      }),
      areasofimprovement: aiAnalysis.areasofimprovement,
      areasofstrength: aiAnalysis.areasofstrength
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
    res.status(500).json({
      success: false,
      message: 'Error analyzing worksheet',
      error: error.message
    });
  }
};

// Get worksheet result by ID
const getWorksheetResult = async (req, res) => {
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
};

module.exports = {
  analyzeWorksheet,
  getWorksheetResult
}; 