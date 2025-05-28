import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Validate required environment variables
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!GOOGLE_AI_API_KEY) {
  throw new Error(
    'GOOGLE_AI_API_KEY environment variable is required. ' +
    'Please create a .env file based on env.example and set your API key.'
  );
}

export const ai = genkit({
  plugins: [googleAI({
    apiKey: GOOGLE_AI_API_KEY,
  })],
  model: 'googleai/gemini-2.0-flash',
});
