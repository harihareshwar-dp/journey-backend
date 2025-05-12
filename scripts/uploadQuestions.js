const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, writeBatch, doc } = require('firebase/firestore');
const { questions } = require('../questions');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA9ufrj-0fRYAvMOZZNjfZtCCyNgORDF7E",
  authDomain: "journey-map-demo.firebaseapp.com",
  projectId: "journey-map-demo",
  storageBucket: "journey-map-demo.firebasestorage.app",
  messagingSenderId: "761882469344",
  appId: "1:761882469344:web:8fcbb93fed04ad3d1b8185",
  measurementId: "G-3FG51XB0ZS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function uploadQuestions() {
  try {
    console.log('Starting questions upload...');
    
    // Use batched writes for better performance
    const batch = writeBatch(db);
    const questionsRef = collection(db, 'test-questions');
    
    // Counter for tracking questions
    let count = 0;
    
    // Maximum batch size is 500, so we'll process in chunks
    const chunkSize = 400;
    
    for (let i = 0; i < questions.length; i += chunkSize) {
      const chunk = questions.slice(i, i + chunkSize);
      const currentBatch = writeBatch(db);
      
      chunk.forEach((question) => {
        const docRef = doc(questionsRef);
        currentBatch.set(docRef, {
          ...question,
          createdAt: new Date(),
          id: docRef.id
        });
        count++;
      });
      
      // Commit the batch
      await currentBatch.commit();
      console.log(`Uploaded ${count} questions so far...`);
    }
    
    console.log(`Successfully uploaded ${count} questions to Firestore!`);
    
  } catch (error) {
    console.error('Error uploading questions:', error);
  }
}

// Run the upload
uploadQuestions().then(() => {
  console.log('Upload script completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
}); 