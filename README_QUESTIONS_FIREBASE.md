# Push Math Questions to Firebase

This folder contains scripts to push the IB Math questions to your Firebase Firestore database.

## Files

1. `questions.js` - Contains the IB Math questions organized by topic and difficulty.
2. `pushQuestionsToFirebase.js` - Script to push questions with a nested collection structure.
3. `pushQuestionsSimpleStructure.js` - Script to push questions with a flat structure.

## Database Structures

### Nested Structure (pushQuestionsToFirebase.js)

This script creates a hierarchical collection structure:

```
questions (collection)
  └── Binomial Theorem (document)
       └── easy (collection)
            └── question_1 (document)
            └── question_2 (document)
            └── ...
       └── medium (collection)
            └── ...
       └── hard (collection)
            └── ...
  └── Complex Numbers (document)
       └── ...
```

### Simple Structure (pushQuestionsSimpleStructure.js)

This script creates a flat collection with all questions and metadata:

```
math_questions (collection)
  └── q_1 (document)
       └── question: "..."
       └── options: [...]
       └── correctOption: number
       └── topic: "Binomial Theorem"
       └── difficulty: "easy"
       └── questionNumber: 1
       └── createdAt: timestamp
  └── q_2 (document)
       └── ...
```

## How to Use

1. Make sure your Firebase project is properly set up in `firebase.js`.

2. Install the required dependencies:
   ```bash
   npm install firebase
   ```

3. Run one of the scripts based on the database structure you prefer:
   ```bash
   # For nested structure
   node pushQuestionsToFirebase.js
   
   # For simple structure
   node pushQuestionsSimpleStructure.js
   ```

4. Check your Firebase console to verify the data has been pushed correctly.

## Query Examples

### Nested Structure

```javascript
// Get all easy questions for Binomial Theorem
const easyBinomialQuestions = await getDocs(
  collection(db, 'questions', 'Binomial Theorem', 'easy')
);

// Get a specific question
const specificQuestion = await getDoc(
  doc(db, 'questions', 'Complex Numbers', 'medium', 'question_2')
);
```

### Simple Structure

```javascript
// Get all easy questions for Binomial Theorem
const easyBinomialQuestions = await getDocs(
  query(
    collection(db, 'math_questions'),
    where('topic', '==', 'Binomial Theorem'),
    where('difficulty', '==', 'easy')
  )
);

// Get all hard questions from any topic
const hardQuestions = await getDocs(
  query(
    collection(db, 'math_questions'),
    where('difficulty', '==', 'hard')
  )
);
```

## Note

The simple structure is generally more flexible for querying but may result in more reads when retrieving specific types of questions. Choose the structure that best fits your application's needs. 