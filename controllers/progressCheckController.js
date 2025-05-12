const { OpenAI } = require('openai');
const { db } = require('../firebase');
const { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc } = require('firebase/firestore');
const { LEARNING_RESOURCES } = require('../constants/learningResources');

// Helper function to clean and parse JSON from GPT responses
const cleanAndParseJSON = (response) => {
  try {
    // First attempt: direct parse
    return JSON.parse(response);
  } catch (e) {
    try {
      console.log('First parse attempt failed, trying to clean JSON response...');
      
      // Remove any potential markdown code block syntax
      let cleaned = response.replace(/```json/g, '').replace(/```/g, '');
      
      // Find the first { and the last }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1) {
        console.error('No valid JSON object found in the response');
        throw new Error('No valid JSON object found in the response');
      }
      
      // Extract just the JSON object
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      
      // Fix common GPT formatting issues
      cleaned = cleaned
        .replace(/(\r\n|\n|\r)/gm, '') // Remove newlines
        .replace(/,\s*([\]}])/g, '$1')  // Remove trailing commas
        .replace(/\\n/g, ' ')           // Replace \n with space
        .replace(/\\"/g, '"')           // Fix escaped quotes
        .replace(/"\s+"/g, '" "')       // Fix spaces between quotes
        .replace(/\s+/g, ' ')           // Normalize spaces
        .trim();
      
      console.log('Cleaned JSON:', cleaned.substring(0, 100) + '...');
      
      // Third attempt: Try to parse the cleaned JSON
      try {
        return JSON.parse(cleaned);
      } catch (e3) {
        console.log('Third parse attempt failed, applying more aggressive fixes...');
        
        // Fourth attempt: More aggressive fixing
        cleaned = cleaned
          // Fix unquoted property names
          .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
          // Remove trailing commas in arrays
          .replace(/,(\s*\])/g, '$1')
          // Fix dangling commas in objects
          .replace(/,(\s*\})/g, '$1');
          
        console.log('Aggressively cleaned JSON:', cleaned.substring(0, 100) + '...');
        
        try {
          return JSON.parse(cleaned);
        } catch (e4) {
          // Fifth attempt: Last resort for nested quotes issues
          console.log('Fourth parse attempt failed, trying to fix nested quotes...');
          
          // Handle nested quotes issues
          cleaned = cleaned
            // Fix nested quotes in values
            .replace(/"([^"]*?)\\?"([^"]*?)\\?"([^"]*?)"/g, '"$1\\\"$2\\\"$3"')
            // Fix missing commas between properties
            .replace(/}(\s*){/g, '},\n{')
            // Fix extra commas
            .replace(/,\s*,/g, ',');
            
          console.log('Final cleaned JSON:', cleaned.substring(0, 100) + '...');
          
          return JSON.parse(cleaned);
        }
      }
    } catch (e2) {
      // Last resort: Create a fallback response with error details
      console.error('All JSON parsing attempts failed for response:', response);
      console.error('Original parse error:', e.message);
      console.error('Cleaning error:', e2.message);
      
      // Return a fallback object with error information
      return {
        error: true,
        parseError: true,
        errorMessage: `Failed to parse GPT response: ${e.message}. Cleaning error: ${e2.message}`,
        progressionStatus: {
          level: "review",
          "next-topic": "Same topic", // Default to staying on same topic
          "next-topic-difficulty": "medium",
          explanation: "Due to an error processing the AI response, we recommend reviewing the current topic again.",
          confidenceScore: 50
        },
        conceptualUnderstanding: "Unable to analyze due to parsing error",
        patternAnalysis: {
          recurringStrengths: [],
          recurringWeaknesses: []
        },
        skillBreakdown: {
          mastered: [],
          developing: [],
          needsWork: []
        },
        recommendedFocus: {
          topicsForNextWorksheet: [],
          conceptsToReview: []
        },
        learningResources: {
          recommendedMaterials: []
        }
      };
    }
  }
};

// Analyze a worksheet result and provide progress recommendations
const analyzeProgress = async (req, res) => {
  try {
    const { worksheetResultId } = req.body;

    if (!worksheetResultId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: worksheetResultId'
      });
    }

    // Fetch the worksheet result from Firebase
    const worksheetResultRef = doc(db, 'worksheetResults', worksheetResultId);
    const worksheetResultDoc = await getDoc(worksheetResultRef);

    if (!worksheetResultDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Worksheet result not found'
      });
    }

    const worksheetResult = worksheetResultDoc.data();
    console.log(`Processing progress check for worksheet result: ${worksheetResultId}, topic: ${worksheetResult.topic}`);

    // Fetch the journey to get topic progress
    const journeyRef = doc(db, 'journeys', worksheetResult.journeyId);
    const journeyDoc = await getDoc(journeyRef);
    
    if (!journeyDoc.exists()) {
      throw new Error('Journey not found');
    }

    const journey = journeyDoc.data();
    const topicProgress = journey.topicProgress || {};
    const currentTopicProgress = topicProgress[worksheetResult.topic] || {
      attempts: {
        easy: 0,
        medium: 0,
        hard: 0,
        total: 0
      },
      completed: false,
      resourcesCompleted: 0,
      totalResources: 0
    };

    // Convert old format attempts to new format if needed
    if (typeof currentTopicProgress.attempts === 'number') {
      currentTopicProgress.attempts = {
        easy: 0,
        medium: 0,
        hard: 0,
        total: currentTopicProgress.attempts
      };
    }

    // Prepare detailed analysis for GPT
    const analysisPrompt = `As an IB Mathematics expert tutor, analyze this student's worksheet performance in detail.
Please provide a comprehensive analysis of their understanding, progress, and readiness for advancement.

Worksheet Details:
Topic: ${worksheetResult.topic}
Difficulty: ${worksheetResult.difficulty}
Overall Score: ${worksheetResult.totalScore}/${worksheetResult.totalPossibleScore} (${worksheetResult.percentageScore}%)
Journey ID: ${worksheetResult.journeyId}
Areas of Improvement: ${worksheetResult.areasofimprovement}
Areas of Strength: ${worksheetResult.areasofstrength}

${topicProgress[worksheetResult.topic] && topicProgress[worksheetResult.topic].attempts ? 
  `Previous Attempts: 
   - Easy: ${(topicProgress[worksheetResult.topic].attempts.easy || 0)} attempts
   - Medium: ${(topicProgress[worksheetResult.topic].attempts.medium || 0)} attempts
   - Hard: ${(topicProgress[worksheetResult.topic].attempts.hard || 0)} attempts
   - Total: ${(topicProgress[worksheetResult.topic].attempts.total || 0)} attempts` : 
  'No previous attempts recorded'}

Question-by-Question Analysis:
${worksheetResult.questionAnalyses.map((q, idx) => `
Question ${idx + 1}:
- Score: ${q.overallGrade}/${q.totalMarks}
- Steps Analysis: ${q.stepByStepAnalysis.map(step => 
  `  * ${step.step} (${step.isCorrect ? 'Correct' : 'Incorrect'}) - ${step.feedback}`
).join('\\n')}

`).join('\\n')}

Based on this performance, provide a detailed analysis STRICTLY in the following JSON format:

{
    "conceptualUnderstanding": "detailed analysis of overall conceptual understanding",
    "patternAnalysis": {
        "recurringStrengths": ["list of consistently strong areas"],
        "recurringWeaknesses": ["list of consistently weak areas"]
    },
    "skillBreakdown": {
        "mastered": ["list of fully mastered skills"],
        "developing": ["skills showing progress but needing refinement"],
        "needsWork": ["skills requiring significant improvement"]
    },
    "progressionStatus": {
        "level": "next-topic/review/intensive-review",
        "next-topic": "specify the next topic name based on the current topic (${worksheetResult.topic}). If level is review/intensive-review, keep same topic",
        "next-topic-difficulty": "specify difficulty (easy/medium/hard) based on performance and previous attempts",
        "explanation": "detailed explanation of the recommendation",
        "confidenceScore": "number between 0-100 indicating confidence"
    },
    "recommendedFocus": {
        "topicsForNextWorksheet": ["specific topics to include"],
        "conceptsToReview": ["specific concepts needing review"]
    },
    "journeyStatus": {
        "journey-complete": "yes/no - yes if student has mastered the last topic, no otherwise",
        "endReason": "journey-complete/too-many-attempts - journey-complete if all topics mastered, too-many-attempts if struggling with easy difficulty"
    }
}

Consider the following topics sequence for progression:
1. Binomial Theorem
2. Complex Numbers
3. Sequences and Series
4. Mathematical Induction and Contradiction
5. Exponents and Logarithms

Ensure the analysis is thorough and considers:
1. Both correct and incorrect answers
2. The process used, not just final results
3. Patterns in mistakes
4. Conceptual understanding vs. mechanical errors
5. Readiness for more advanced topics
6. Previous attempts at different difficulty levels
7. If there are silly and careless mistakes, you can recommend moving to next topic but mention in the analysis
8. The progression level should be carefully determined based on:
   
- Performance on the current worksheet
   - if the current difficulty is easy and they scored pretty decent also ,consider having the same topic but with higher difficulty based on the performance
   - Previous attempts at different difficulty levels
   - If the student has already mastered the current difficulty level
   - If the student has attempted multiple difficulty levels for the same topic

For difficulty recommendations:
- If recommending the same topic, consider increasing difficulty if they've done well - very important
- If recommending a new topic, consider their mastery level of the current topic
- For students who have struggled with easy difficulty multiple times, consider ending their journey
- For students who excel at hard difficulty, they should progress to the next topic`;

    console.log('Sending progress check request to OpenAI...');
    
    // Call GPT for analysis
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert IB Mathematics tutor specializing in detailed progress analysis and learning path recommendations. Provide thorough, actionable insights based on student performance 
          data.

          You must use LaTeX for ALL mathematical expressions and respond with ONLY a valid JSON 
          object matching the specified structure. Use $ for inline math, $$ for display math, and double backslash for LaTeX commands (\\\\frac, \\\\cdot, \\\\sqrt, etc.). Use \\n for line breaks.`
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    // Extract token usage
    const tokenUsage = {
      inputTokens: completion.usage.prompt_tokens,
      outputTokens: completion.usage.completion_tokens
    };

    // Calculate cost based on GPT-4 rates
    const cost = {
      inputCost: (tokenUsage.inputTokens * 2.50) / 1000000,  // $2.50 per 1M tokens
      outputCost: (tokenUsage.outputTokens * 10.00) / 1000000, // $10.00 per 1M tokens
      totalCost: ((tokenUsage.inputTokens * 2.50) + (tokenUsage.outputTokens * 10.00)) / 1000000
    };

    // Log token usage and cost in backend with detailed formatting
    console.log('\n=== Progress Check API Usage (GPT-4o) ===');
    console.log('Journey ID:', worksheetResult.journeyId);
    console.log('Topic:', worksheetResult.topic);
    console.log('\nToken Usage:');
    console.log('  Input Tokens:', tokenUsage.inputTokens.toLocaleString());
    console.log('  Output Tokens:', tokenUsage.outputTokens.toLocaleString());
    console.log('  Total Tokens:', (tokenUsage.inputTokens + tokenUsage.outputTokens).toLocaleString());
    console.log('\nCost Breakdown:');
    console.log('  Input Cost ($2.50/1M tokens):', `$${cost.inputCost.toFixed(6)}`);
    console.log('  Output Cost ($10.00/1M tokens):', `$${cost.outputCost.toFixed(6)}`);
    console.log('  Total Cost:', `$${cost.totalCost.toFixed(6)}`);
    console.log('============================================\n');

    // Get the raw response content
    const rawResponse = completion.choices[0].message.content.trim();
    console.log('Raw GPT response received. Length:', rawResponse.length);
    
    // Try to parse the JSON response with our improved parser
    const progressAnalysis = cleanAndParseJSON(rawResponse);
    
    // Check if we got an error response from the parser
    if (progressAnalysis.parseError) {
      console.warn('JSON parsing error detected. Using fallback response.');
      // Log the error but continue with the fallback response
    } else {
      console.log('Successfully parsed GPT response into JSON.');
    }

    // Store the analysis in Firebase with token usage
    const progressAnalysisData = {
      worksheetResultId,
      userId: worksheetResult.userId,
      topic: worksheetResult.topic,
      journeyId: worksheetResult.journeyId,
      timestamp: new Date().toISOString(),
      analysis: progressAnalysis,
      tokenUsage,
      apiCost: cost,
      rawResponse: rawResponse // Store the raw response for debugging
    };

    const progressAnalysisRef = collection(db, 'progressAnalyses');
    const docRef = await addDoc(progressAnalysisRef, progressAnalysisData);
    console.log(`Progress analysis stored in Firestore with ID: ${docRef.id}`);

    // Check if journey should end
    let shouldEndJourney = false;
    let endReason = '';
    let journeyComplete = false;

    // Case 1: Current topic is the last topic
    const topics = [
      "Binomial Theorem",
      "Complex Numbers",
      "Sequences and Series",
      "Mathematical Induction and Contradiction",
      "Exponents and Logarithms"
    ];
    
    // Normalize topic names to handle inconsistencies
    const normalizeTopicName = (topic) => {
      // Handle the specific case of Exponents/Exponentials
      if (topic.toLowerCase().includes('exponent') && topic.toLowerCase().includes('logarithm')) {
        return "Exponents and Logarithms";
      }
      return topic;
    };
    
    const normalizedCurrentTopic = normalizeTopicName(worksheetResult.topic);
    const normalizedNextTopic = normalizeTopicName(progressAnalysis.progressionStatus['next-topic']);
    
    // Check if current topic is the last one in our sequence
    const isLastTopic = topics.indexOf(normalizedCurrentTopic) === topics.length - 1;
    
    // Check if we're moving to a topic that doesn't exist in our sequence
    // This would indicate we're trying to go beyond the last topic
    const nextTopicNotInSequence = topics.indexOf(normalizedNextTopic) === -1;
    
    // Case 2: Same topic, easy difficulty, more than 2 attempts on easy
    const isSameTopic = normalizedNextTopic === normalizedCurrentTopic;
    const isEasyDifficulty = worksheetResult.difficulty === 'easy';
    const hasTooManyEasyAttempts = (currentTopicProgress.attempts.easy || 0) >= 2;

    // Check if AI provided journey status information
    if (progressAnalysis.journeyStatus && typeof progressAnalysis.journeyStatus['journey-complete'] === 'string') {
      journeyComplete = progressAnalysis.journeyStatus['journey-complete'].toLowerCase() === 'yes';
      
      if (progressAnalysis.journeyStatus.endReason) {
        endReason = progressAnalysis.journeyStatus.endReason === 'journey-complete' ? 
          'completed_all_topics' : 'max_attempts_reached';
      }
    } else {
      // Fallback to our original logic if AI didn't provide journey status
      if (isLastTopic && (progressAnalysis.progressionStatus.level === 'next-topic' || nextTopicNotInSequence)) {
        journeyComplete = true;
        endReason = 'completed_all_topics';
        console.log('Journey ending: Completed all topics');
      } else if (isSameTopic && isEasyDifficulty && hasTooManyEasyAttempts) {
        journeyComplete = false;
        endReason = 'max_attempts_reached';
        console.log('Journey ending: Maximum attempts reached on easy difficulty');
      }
    }
    
    // Force journey completion if we're on the last topic and performing well
    if (isLastTopic && worksheetResult.percentageScore >= 80 && worksheetResult.difficulty === 'hard') {
      journeyComplete = true;
      endReason = 'completed_all_topics';
      console.log('Journey ending: Completed last topic with good performance');
    }
    
    // Determine if journey should end based on our analysis
    shouldEndJourney = journeyComplete || (isSameTopic && isEasyDifficulty && hasTooManyEasyAttempts);

    // Update journey with new tasks if not ending
    if (!shouldEndJourney) {
      const nextTopic = progressAnalysis.progressionStatus['next-topic'];
      const nextDifficulty = progressAnalysis.progressionStatus['next-topic-difficulty'];
      
      console.log(`Planning next steps: Topic=${nextTopic}, Difficulty=${nextDifficulty}`);
      
      // Generate new tasks for the next topic
      // Get learning resources for next topic from constants
      const topicResources = LEARNING_RESOURCES[nextTopic] || [];
      
      // Generate tasks from available resources
      const newTasks = [];
      
      // Add resource tasks
      topicResources.forEach((resource, index) => {
        newTasks.push({
          day: journey.generatedTasks.length + index + 1,
          topic: nextTopic,
          type: 'resource',
          resourceType: resource.type,
          title: resource.title,
          url: resource.url,
          completed: false
        });
      });

      // Add worksheet task after resources
      newTasks.push({
        day: journey.generatedTasks.length + topicResources.length + 1,
        topic: nextTopic,
        type: 'worksheet',
        difficulty: nextDifficulty,
        worksheetId: `${nextTopic.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${nextDifficulty}`,
        completed: false
      });

      // Initialize attempts object for next topic if needed
      if (!topicProgress[nextTopic]) {
        topicProgress[nextTopic] = {
          completed: false,
          attempts: {
            easy: 0,
            medium: 0,
            hard: 0,
            total: 0
          },
          lastAttemptDate: null,
          bestScore: 0,
          resourcesCompleted: 0,
          totalResources: topicResources.length
        };
      } else if (typeof topicProgress[nextTopic].attempts === 'number') {
        // Convert old format to new format
        topicProgress[nextTopic].attempts = {
          easy: 0,
          medium: 0,
          hard: 0,
          total: topicProgress[nextTopic].attempts || 0
        };
      }

      // Update current topic attempts
      const difficulty = worksheetResult.difficulty || 'medium';
      currentTopicProgress.attempts[difficulty] = (currentTopicProgress.attempts[difficulty] || 0) + 1;
      currentTopicProgress.attempts.total = (currentTopicProgress.attempts.total || 0) + 1;

      console.log(`Updating journey with ${newTasks.length} new tasks`);
      
      // Update journey document
      await updateDoc(journeyRef, {
        generatedTasks: [...journey.generatedTasks, ...newTasks],
        topicProgress: {
          ...topicProgress,
          [worksheetResult.topic]: {
            ...currentTopicProgress,
            lastAttemptDate: new Date().toISOString(),
            bestScore: Math.max(worksheetResult.percentageScore, currentTopicProgress.bestScore || 0)
          }
        }
      });
      
      console.log('Journey updated successfully with new tasks');
    } else {
      // End the journey
      // Update current topic attempts
      const difficulty = worksheetResult.difficulty || 'medium';
      currentTopicProgress.attempts[difficulty] = (currentTopicProgress.attempts[difficulty] || 0) + 1;
      currentTopicProgress.attempts.total = (currentTopicProgress.attempts.total || 0) + 1;

      console.log('Ending journey and updating final status');
      
      await updateDoc(journeyRef, {
        completed: true,
        endReason: endReason,
        completedDate: new Date().toISOString(),
        journeyComplete: journeyComplete,
        topicProgress: {
          ...topicProgress,
          [worksheetResult.topic]: {
            ...currentTopicProgress,
            lastAttemptDate: new Date().toISOString(),
            bestScore: Math.max(worksheetResult.percentageScore, currentTopicProgress.bestScore || 0)
          }
        }
      });
      
      console.log('Journey marked as completed');
    }

    // If review is recommended, fetch appropriate learning resources
    let learningResources = [];
    if (progressAnalysis.progressionStatus.level.includes('review') && 
        Array.isArray(progressAnalysis.recommendedFocus.conceptsToReview) &&
        progressAnalysis.recommendedFocus.conceptsToReview.length > 0) {
      try {
        console.log('Fetching additional learning resources for review concepts');
        
        const resourcesRef = collection(db, 'learningResources');
        const resourcesQuery = query(
          resourcesRef,
          where('topics', 'array-contains-any', progressAnalysis.recommendedFocus.conceptsToReview)
        );
        const resourcesSnapshot = await getDocs(resourcesQuery);
        
        resourcesSnapshot.forEach(doc => {
          learningResources.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        console.log(`Found ${learningResources.length} additional learning resources`);
      } catch (resourceErr) {
        console.error('Error fetching learning resources:', resourceErr);
        // Continue without additional resources
      }
    }

    console.log('Sending successful response to client');
    
    res.status(200).json({
      success: true,
      analysis: progressAnalysis,
      journeyEnded: shouldEndJourney,
      endReason: shouldEndJourney ? endReason : undefined,
      journeyComplete: journeyComplete,
      learningResources: learningResources.length > 0 ? learningResources : undefined,
      tokenUsage,
      apiCost: cost,
      parseError: progressAnalysis.parseError || false
    });

  } catch (error) {
    console.error('Error in progress analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing progress',
      error: error.message
    });
  }
};

module.exports = {
  analyzeProgress
}; 