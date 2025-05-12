const { db } = require('./firebase');
const { collection, doc, setDoc } = require('firebase/firestore');
const { questions } = require('./questions');

// Group questions by topic and difficulty
function groupQuestions(questions) {
  const grouped = {};
  for (const q of questions) {
    if (!grouped[q.topic]) grouped[q.topic] = {};
    if (!grouped[q.topic][q.difficulty]) grouped[q.topic][q.difficulty] = [];
    grouped[q.topic][q.difficulty].push(q);
  }
  return grouped;
}

// Generate a worksheet ID
function worksheetId(topic, difficulty) {
  return `${topic.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${difficulty}`;
}

async function pushWorksheets() {
  const grouped = groupQuestions(questions);
  const worksheetsRef = collection(db, 'worksheets');
  let count = 0;
  for (const topic of Object.keys(grouped)) {
    for (const difficulty of Object.keys(grouped[topic])) {
      const qs = grouped[topic][difficulty].slice(0, 3); // Take first 3 questions
      if (qs.length < 3) {
        console.warn(`Not enough questions for ${topic} - ${difficulty}, skipping.`);
        continue;
      }
      const worksheet = {
        topic,
        difficulty,
        questions: qs.map(q => ({
          question: q.question,
          markscheme: q.markscheme || null
        })),
        createdAt: new Date().toISOString()
      };
      const id = worksheetId(topic, difficulty);
      await setDoc(doc(worksheetsRef, id), worksheet);
      console.log(`Pushed worksheet: ${id}`);
      count++;
    }
  }
  console.log(`\nTotal worksheets created: ${count}`);
}

pushWorksheets().then(() => {
  console.log('Done.');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
}); 