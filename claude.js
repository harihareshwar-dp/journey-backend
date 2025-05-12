// claudeRequest.js

const ANTHROPIC_API_KEY = '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'; // Replace with your key
const API_URL = 'https://api.anthropic.com/v1/messages';

async function queryClaude(prompt) {
  const body = {
    model: 'claude-3-haiku-20240307', // Or opus/haiku
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('Claude response:\n', data);
  } catch (error) {
    console.error('Error querying Claude:', error);
  }
}

// Example usage
queryClaude("Explain relativity like I'm 12.");
