
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RespondInputSchema = z.object({
  query: z.string().describe('The question to be answered.'),
});
export type RespondInput = z.infer<typeof RespondInputSchema>;

const RespondOutputSchema = z.object({ 
  answer: z.string().describe('A comprehensive, well-reasoned answer to the question.'),
});
export type RespondOutput = z.infer<typeof RespondOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: RespondOutput = { answer: "I apologize, but I couldn't generate a proper response at this moment." };

export async function respond(input: RespondInput): Promise<RespondOutput> {
  try {
    RespondInputSchema.parse(input);
  } catch (e: any) {
    console.error('ResponderAgent: Invalid input', { error: e.message, input });
    return DEFAULT_OUTPUT;
  }

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await respondInternalFlow(input);
      
      let validatedResult: RespondOutput | null = null;

      // If LLM returns a string instead of an object {answer: "..."}
      if (typeof result === 'string') {
        console.warn(`ResponderAgent: Attempt ${attempt + 1}: LLM returned a string, wrapping it in an object.`, { stringOutput: result});
        const validation = RespondOutputSchema.safeParse({ answer: result });
        if (validation.success) {
          validatedResult = validation.data;
        } else {
           console.warn(`ResponderAgent: Attempt ${attempt + 1}: Wrapped string output validation failed.`, { errors: validation.error.errors, outputReceived: {answer: result} });
        }
      } else {
        // Validate the result (which should be an object by now or from Genkit)
        const validation = RespondOutputSchema.safeParse(result);
        if (validation.success) {
          validatedResult = validation.data;
        } else {
           console.warn(`ResponderAgent: Attempt ${attempt + 1}: Direct output validation failed.`, { errors: validation.error.errors, outputReceived: result });
        }
      }
      
      if (validatedResult) {
        // Ensure the answer string itself is not empty, unless that's acceptable
        if (validatedResult.answer && validatedResult.answer.trim() !== "") {
          return validatedResult;
        } else {
          console.warn(`ResponderAgent: Attempt ${attempt + 1}: LLM returned an empty answer string. Retrying if possible.`);
        }
      }
      
      // If validation failed or answer was empty, and not the last attempt, retry
      if (attempt < RETRY_ATTEMPTS - 1) {
          console.log(`ResponderAgent: Retrying... (Attempt ${attempt + 2})`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
      }
      
      // Return default after last attempt if still not valid
      console.warn(`ResponderAgent: Max retries or persistent validation failure. Returning default output.`);
      return DEFAULT_OUTPUT; 

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`ResponderAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
        input: JSON.stringify(input).substring(0,500),
        timestamp: new Date().toISOString()
      });

      if (errorMessage.includes("INVALID_ARGUMENT") && (errorMessage.includes("Expected object, got null") || errorMessage.includes("answer: Required"))) {
         console.warn(`ResponderAgent: Attempt ${attempt + 1}: Genkit schema validation error (null object or missing answer). Retrying.`);
         if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        console.warn(`ResponderAgent: Max retries for Genkit schema error. Returning default.`);
        return DEFAULT_OUTPUT;
      }

      if (attempt === RETRY_ATTEMPTS - 1) {
         console.error(`ResponderAgent: Max retries reached. Returning default output.`);
        return DEFAULT_OUTPUT;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  console.error("ResponderAgent: Reached end of function unexpectedly. Returning default.");
  return DEFAULT_OUTPUT;
}

const prompt = ai.definePrompt({
  name: 'respondPrompt',
  input: {schema: RespondInputSchema},
  output: {schema: RespondOutputSchema}, 
  prompt: `You are an expert responder agent in a critical thinking system. 
Provide a comprehensive, well-reasoned answer to this question: "{{{query}}}"

Your response should be:
- Thorough but concise (2-3 paragraphs)
- Based on established knowledge
- Clear and well-structured
- Confident but not overreaching

Focus on accuracy and clarity. This is the initial response that will be analyzed by other agents.

Return a JSON object with the exact structure shown:
{
  "answer": "Your comprehensive answer here"
}
Do not include any explanatory text before or after the JSON.`,
});

const respondInternalFlow = ai.defineFlow(
  {
    name: 'respondInternalFlow',
    inputSchema: RespondInputSchema,
    outputSchema: RespondOutputSchema,
  },
  async (input): Promise<RespondOutput> => {
    const {output} = await prompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
