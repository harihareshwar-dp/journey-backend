const { db } = require('../firebase');
const { collection, query, where, getDocs, doc, getDoc } = require('firebase/firestore');

// Get a single question by ID
const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Question ID is required'
      });
    }

    const questionRef = doc(db, 'test-questions', id);
    const questionDoc = await getDoc(questionRef);

    if (!questionDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: questionDoc.id,
        ...questionDoc.data()
      }
    });

  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching question',
      error: error.message
    });
  }
};

// Get questions by topic and difficulty
const getQuestionsByTopicAndDifficulty = async (req, res) => {
  try {
    const { topic, difficulty } = req.query;
    
    // If no filters provided, return all questions
    if (!topic && !difficulty) {
      return getAllQuestions(req, res);
    }

    let q = collection(db, 'test-questions');
    const conditions = [];

    if (topic) {
      conditions.push(where('topic', '==', topic));
    }
    
    if (difficulty) {
      conditions.push(where('difficulty', '==', difficulty));
    }

    q = conditions.length > 0 ? query(q, ...conditions) : q;
    const querySnapshot = await getDocs(q);

    const questions = [];
    querySnapshot.forEach((doc) => {
      questions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json({
      success: true,
      data: questions
    });

  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching questions',
      error: error.message
    });
  }
};

// Get all questions
const getAllQuestions = async (req, res) => {
  try {
    const questionsRef = collection(db, 'test-questions');
    const querySnapshot = await getDocs(questionsRef);

    const questions = [];
    querySnapshot.forEach((doc) => {
      questions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.status(200).json({
      success: true,
      data: questions
    });

  } catch (error) {
    console.error('Error fetching all questions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching questions',
      error: error.message
    });
  }
};

module.exports = {
  getQuestionById,
  getQuestionsByTopicAndDifficulty,
  getAllQuestions
}; 