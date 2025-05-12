const { db } = require('../firebase');
const { collection, addDoc, getDocs, doc, getDoc, setDoc, query, where, updateDoc } = require('firebase/firestore');

// Topics for Number & Algebra unit with resources
const NUMBER_ALGEBRA_TOPICS = [
  {
    name: 'Binomial Theorem',
    resources: [
      {
        title: 'Introduction to Binomial Theorem',
        url: 'https://www.khanacademy.org/math/algebra2/x2ec2f6f830c9fb89:binomial',
        type: 'video'
      },
      {
        title: 'Binomial Theorem Practice',
        url: 'https://www.mathsisfun.com/algebra/binomial-theorem.html',
        type: 'interactive'
      }
    ]
  },
  {
    name: 'Complex Numbers',
    resources: [
      {
        title: 'Understanding Complex Numbers',
        url: 'https://www.khanacademy.org/math/algebra2/x2ec2f6f830c9fb89:complex',
        type: 'video'
      }
    ]
  },
  {
    name: 'Sequences and Series',
    resources: [
      {
        title: 'Introduction to Sequences',
        url: 'https://www.khanacademy.org/math/algebra2/x2ec2f6f830c9fb89:seq',
        type: 'video'
      }
    ]
  },
  {
    name: 'Mathematical Induction and Contradiction',
    resources: [
      {
        title: 'Mathematical Induction Explained',
        url: 'https://www.khanacademy.org/math/algebra2/x2ec2f6f830c9fb89:proofs',
        type: 'video'
      }
    ]
  },
  {
    name: 'Exponents and Logarithms',
    resources: [
      {
        title: 'Exponents and Logarithms Overview',
        url: 'https://www.khanacademy.org/math/algebra2/x2ec2f6f830c9fb89:exp-log',
        type: 'video'
      }
    ]
  }
];

// Helper to get worksheetId for a topic/difficulty
function worksheetId(topic, difficulty) {
  return `${topic.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${difficulty}`;
}

// Create a new journey
const createJourney = async (req, res) => {
  try {
    const { goals, userId, unit, preferences, courseLevel, startDate } = req.body;
    if (!preferences || !goals || !unit || !courseLevel || !startDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Initialize topic progress with attempts counter
    const topicProgress = {};
    NUMBER_ALGEBRA_TOPICS.forEach(topicObj => {
      topicProgress[topicObj.name] = {
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
        totalResources: topicObj.resources.length
      };
    });

    // Generate initial tasks with both resources and worksheets
    const generatedTasks = [];
    const firstTopic = NUMBER_ALGEBRA_TOPICS[0];

    // Add resource task first
    firstTopic.resources.forEach((resource, index) => {
      generatedTasks.push({
        type: 'resource',
        topic: firstTopic.name,
        day: index + 1,
        completed: false,
        title: resource.title,
        url: resource.url,
        resourceType: resource.type
      });
    });

    // Add worksheet task after resources
    generatedTasks.push({
      type: 'worksheet',
      topic: firstTopic.name,
      worksheetId: worksheetId(firstTopic.name, 'medium'),
      difficulty: 'medium',
      day: firstTopic.resources.length + 1,
      completed: false
    });

    const journey = {
      lastUpdated: new Date().toISOString(),
      goals,
      userId: userId || null,
      unit,
      generatedTasks,
      preferences,
      completed: false,
      topicProgress,
      courseLevel,
      worksheetResults: [],
      startDate,
      topicsToReview: []
    };

    const docRef = await addDoc(collection(db, 'journeys'), journey);
    return res.status(201).json({ success: true, journeyId: docRef.id, journey });
  } catch (err) {
    console.error('Error creating journey:', err);
    return res.status(500).json({ success: false, message: 'Error creating journey', error: err.message });
  }
};

// Get all journeys for a user
const getUserJourneys = async (req, res) => {
  try {
    const { userId } = req.params;
    const journeysRef = collection(db, 'journeys');
    const q = query(journeysRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const journeys = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json({ success: true, journeys });
  } catch (err) {
    console.error('Error fetching user journeys:', err);
    return res.status(500).json({ success: false, message: 'Error fetching journeys', error: err.message });
  }
};

// Get a specific journey by ID
const getJourneyById = async (req, res) => {
  try {
    const { journeyId } = req.params;
    const docRef = doc(db, 'journeys', journeyId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Journey not found' });
    }
    return res.json({ success: true, journey: { id: docSnap.id, ...docSnap.data() } });
  } catch (err) {
    console.error('Error fetching journey:', err);
    return res.status(500).json({ success: false, message: 'Error fetching journey', error: err.message });
  }
};

// Update journey task completion
const updateTaskCompletion = async (req, res) => {
  try {
    const { journeyId, day } = req.params;
    const { completed, worksheetResultId, score, userId, isManualUpdate } = req.body;

    const journeyRef = doc(db, 'journeys', journeyId);
    const journeyDoc = await getDoc(journeyRef);

    if (!journeyDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Journey not found'
      });
    }

    // Verify ownership
    const journeyData = journeyDoc.data();
    if (journeyData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not have permission to update this journey'
      });
    }

    const taskIndex = journeyData.generatedTasks.findIndex(task => task.day === parseInt(day));

    if (taskIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const task = journeyData.generatedTasks[taskIndex];
    const topic = task.topic;

    // Handle manual updates differently from analysis-based updates
    if (isManualUpdate) {
      // For manual updates, only update completion status and resource progress
      if (task.type === 'resource' && completed) {
        if (topic && journeyData.topicProgress[topic]) {
          journeyData.topicProgress[topic].resourcesCompleted = 
            (journeyData.topicProgress[topic].resourcesCompleted || 0) + 1;
        }
        
        // Update the specific task
        journeyData.generatedTasks[taskIndex] = {
          ...task,
          completed,
          completedAt: new Date().toISOString()
        };
      } else if (task.type === 'worksheet') {
        // For worksheets, manual updates should only be allowed to mark as incomplete
        // This prevents bypassing the analysis process
        if (!completed) {
          journeyData.generatedTasks[taskIndex] = {
            ...task,
            completed: false,
            worksheetResultId: null,
            score: null
          };

          // Reset topic progress if needed
          if (topic && journeyData.topicProgress[topic]) {
            // Only reset if this was the last completed worksheet
            const hasOtherCompletedWorksheets = journeyData.generatedTasks.some(t => 
              t.type === 'worksheet' && 
              t.topic === topic && 
              t.completed && 
              t.day !== parseInt(day)
            );

            if (!hasOtherCompletedWorksheets) {
              journeyData.topicProgress[topic].completed = false;
              // Don't reset attempts or best score
            }
          }
        } else {
          return res.status(400).json({
            success: false,
            message: 'Worksheets can only be marked as complete through the analysis process'
          });
        }
      }
    } else {
      // For analysis-based updates, handle worksheet completion
      if (task.type === 'worksheet') {
        if (completed && worksheetResultId) {
          // Update task with completion details
          journeyData.generatedTasks[taskIndex] = {
            ...task,
            completed: true,
            completedAt: new Date().toISOString(),
            worksheetResultId,
            score: score || null
          };

          // Track worksheet result IDs
          if (!journeyData.worksheetResults) {
            journeyData.worksheetResults = [];
          }
          if (!journeyData.worksheetResults.includes(worksheetResultId)) {
            journeyData.worksheetResults.push(worksheetResultId);
          }

          // Update topic progress (record attempt)
          if (topic && journeyData.topicProgress[topic]) {
            // Initialize attempts object if it doesn't exist or has old format
            if (!journeyData.topicProgress[topic].attempts || typeof journeyData.topicProgress[topic].attempts === 'number') {
              journeyData.topicProgress[topic].attempts = {
                easy: 0,
                medium: 0,
                hard: 0,
                total: journeyData.topicProgress[topic].attempts || 0
              };
            }
            
            // Increment the appropriate difficulty counter
            const difficulty = task.difficulty || 'medium';
            journeyData.topicProgress[topic].attempts[difficulty] = 
              (journeyData.topicProgress[topic].attempts[difficulty] || 0) + 1;
            journeyData.topicProgress[topic].attempts.total = 
              (journeyData.topicProgress[topic].attempts.total || 0) + 1;
              
            journeyData.topicProgress[topic].lastAttemptDate = new Date().toISOString();
            
            if (score) {
              journeyData.topicProgress[topic].bestScore = 
                Math.max(score, journeyData.topicProgress[topic].bestScore || 0);
            }
          }
        }
      }
    }

    // Update the journey with the modified task
    await updateDoc(journeyRef, {
      generatedTasks: journeyData.generatedTasks,
      topicProgress: journeyData.topicProgress,
      worksheetResults: journeyData.worksheetResults || [],
      lastUpdated: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      updatedTask: journeyData.generatedTasks[taskIndex]
    });
  } catch (err) {
    console.error('Error updating task:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating task',
      error: err.message
    });
  }
};

// Update journey completion status
const updateJourneyCompletionStatus = async (req, res) => {
  try {
    const { journeyId } = req.params;
    const { completed, userId, endReason } = req.body;

    if (completed === undefined || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: completed, userId'
      });
    }

    const journeyRef = doc(db, 'journeys', journeyId);
    const journeyDoc = await getDoc(journeyRef);

    if (!journeyDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Journey not found'
      });
    }

    // Verify ownership
    const journeyData = journeyDoc.data();
    if (journeyData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not have permission to update this journey'
      });
    }

    // Update completion status
    const updateData = {
      completed,
      lastUpdated: new Date().toISOString()
    };

    // If journey is being marked as completed, add completion date and reason
    if (completed) {
      updateData.completedDate = new Date().toISOString();
      if (endReason) {
        updateData.endReason = endReason;
      }
    }

    await updateDoc(journeyRef, updateData);

    return res.status(200).json({
      success: true,
      message: `Journey ${completed ? 'completed' : 'marked as incomplete'} successfully`
    });
  } catch (err) {
    console.error('Error updating journey completion status:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating journey completion status',
      error: err.message
    });
  }
};

// Add new tasks to a journey
const addJourneyTasks = async (req, res) => {
  try {
    const { journeyId } = req.params;
    const { tasks, userId } = req.body;

    if (!Array.isArray(tasks) || tasks.length === 0 || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields or invalid tasks format'
      });
    }

    const journeyRef = doc(db, 'journeys', journeyId);
    const journeyDoc = await getDoc(journeyRef);

    if (!journeyDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Journey not found'
      });
    }

    // Verify ownership
    const journeyData = journeyDoc.data();
    if (journeyData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not have permission to update this journey'
      });
    }

    // Determine the highest day number
    const currentMaxDay = journeyData.generatedTasks.reduce(
      (max, task) => Math.max(max, task.day), 0
    );

    // Add new tasks with incrementing day numbers
    const newTasks = tasks.map((task, index) => ({
      ...task,
      day: currentMaxDay + index + 1,
      completed: false
    }));

    // Update the journey with new tasks
    await updateDoc(journeyRef, {
      generatedTasks: [...journeyData.generatedTasks, ...newTasks],
      lastUpdated: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Tasks added successfully',
      addedTasks: newTasks
    });
  } catch (err) {
    console.error('Error adding tasks to journey:', err);
    return res.status(500).json({
      success: false,
      message: 'Error adding tasks to journey',
      error: err.message
    });
  }
};

// Update topics to review
const updateTopicsToReview = async (req, res) => {
  try {
    const { journeyId } = req.params;
    const { topicsToReview, userId } = req.body;

    const journeyRef = doc(db, 'journeys', journeyId);
    const journeyDoc = await getDoc(journeyRef);

    if (!journeyDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Journey not found'
      });
    }

    // Verify ownership
    const journeyData = journeyDoc.data();
    if (journeyData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not have permission to update this journey'
      });
    }

    await updateDoc(journeyRef, {
      topicsToReview,
      lastUpdated: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: 'Topics to review updated successfully'
    });
  } catch (err) {
    console.error('Error updating topics to review:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating topics to review',
      error: err.message
    });
  }
};

// Update entire journey
const updateEntireJourney = async (req, res) => {
  try {
    const { journeyId } = req.params;
    const updatedJourneyData = req.body;
    const { userId } = updatedJourneyData;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: userId'
      });
    }

    const journeyRef = doc(db, 'journeys', journeyId);
    const journeyDoc = await getDoc(journeyRef);

    if (!journeyDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Journey not found'
      });
    }

    // Verify ownership
    const journeyData = journeyDoc.data();
    if (journeyData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You do not have permission to update this journey'
      });
    }

    // Add last updated timestamp
    updatedJourneyData.lastUpdated = new Date().toISOString();

    // Update the entire journey document
    await updateDoc(journeyRef, updatedJourneyData);

    return res.json({
      success: true,
      message: 'Journey updated successfully',
      journeyId
    });
  } catch (err) {
    console.error('Error updating journey:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating journey',
      error: err.message
    });
  }
};

module.exports = {
  NUMBER_ALGEBRA_TOPICS,
  createJourney,
  getUserJourneys,
  getJourneyById,
  updateTaskCompletion,
  updateJourneyCompletionStatus,
  addJourneyTasks,
  updateTopicsToReview,
  updateEntireJourney
}; 