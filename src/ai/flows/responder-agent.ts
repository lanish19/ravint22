'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Defines the schema for the input to the responder agent.
 */
const RespondInputSchema = z.object({
  query: z.string().describe('The question to be answered by the agent.'),
});
/**
 * Represents the input structure for the responder agent.
 */
export type RespondInput = z.infer<typeof RespondInputSchema>;

/**
 * Defines the schema for the output of the responder agent.
 */
const RespondOutputSchema = z.object({ 
  answer: z.string().describe('A comprehensive, well-reasoned answer to the question.'),
});
/**
 * Represents the output structure for the responder agent.
 */
export type RespondOutput = z.infer<typeof RespondOutputSchema>;

const MAX_RETRY_ATTEMPTS = 3; 
const DEFAULT_ERROR_ANSWER = "I apologize, but I couldn't generate a proper response at this moment due to an internal error.";
const DEFAULT_OUTPUT: RespondOutput = { answer: DEFAULT_ERROR_ANSWER };

/**
 * Generates a direct response to a user's query.
 * This function handles input validation, retries with exponential backoff for the core LLM call,
 * and output validation to ensure a reliable response.
 * @async
 * @param {RespondInput} input - The input object containing the user's query.
 * @returns {Promise<RespondOutput>} A promise that resolves to the agent's response, 
 *                                   or a default error response if processing fails.
 */
export async function respond(input: RespondInput): Promise<RespondOutput> {
  const agentName = "ResponderAgent";
  const inputSummary: string = JSON.stringify(input).substring(0, 200); 

  // 1. Input Validation
  const parseResult = RespondInputSchema.safeParse(input);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.flatten();
    console.error(`${agentName}: Invalid input.`, { 
      error: errorDetails, 
      inputSummary,
      timestamp: new Date().toISOString(),
    });
    const fieldErrors = errorDetails.fieldErrors.query?.join(', ');
    return { answer: `Error: Invalid input provided to ${agentName}. ${fieldErrors ? `Issues with query: ${fieldErrors}` : ''}`.trim() };
  }
  const validInput: RespondInput = parseResult.data;

  // 2. Retry Logic for Core Operation (calling respondInternalFlow)
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`${agentName}: Calling respondInternalFlow. Attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}.`, { inputSummary });
      const result: unknown = await respondInternalFlow(validInput); 
      
      // 3. Output Validation and Processing
      let validatedResult: RespondOutput | null = null;

      if (typeof result === 'string') {
        // Handle case where LLM might return a raw string instead of the expected object.
        console.warn(`${agentName}: Attempt ${attempt + 1}: LLM returned a string, wrapping it.`, { stringOutput: result, inputSummary });
        const validation = RespondOutputSchema.safeParse({ answer: result });
        if (validation.success) {
          validatedResult = validation.data;
        } else {
           console.warn(`${agentName}: Attempt ${attempt + 1}: Wrapped string output validation failed.`, { 
             errors: validation.error.flatten(), 
             outputReceived: {answer: result}, 
             inputSummary,
             timestamp: new Date().toISOString(),
            });
        }
      } else if (result && typeof result === 'object') {
        // Standard case: result is an object, attempt to parse.
        // Also handles Genkit's common pattern of nesting output under an 'output' key.
        const potentialOutput = 'output' in result ? (result as { output: RespondOutput }).output : result;
        const validation = RespondOutputSchema.safeParse(potentialOutput);
        if (validation.success) {
          validatedResult = validation.data;
        } else {
           console.warn(`${agentName}: Attempt ${attempt + 1}: Direct output validation failed.`, { 
             errors: validation.error.flatten(), 
             outputReceived: potentialOutput,
             inputSummary,
             timestamp: new Date().toISOString(),
            });
        }
      } else {
        // Handle unexpected output types (null, undefined, etc.)
         console.warn(`${agentName}: Attempt ${attempt + 1}: Unexpected output type received from LLM.`, { 
            outputReceived: result, 
            inputType: typeof result,
            inputSummary,
            timestamp: new Date().toISOString(),
          });
      }
      
      // Check if the validated result's answer is non-empty
      if (validatedResult) {
        if (validatedResult.answer && validatedResult.answer.trim() !== "") {
          console.log(`${agentName}: Attempt ${attempt + 1}: Successfully generated and validated answer.`, { inputSummary });
          return validatedResult; // Success
        } else {
          // Log if the answer is empty and prepare for retry (if attempts left)
          console.warn(`${agentName}: Attempt ${attempt + 1}: LLM returned an empty answer string.`, { outputReceived: validatedResult, inputSummary });
        }
      }
      
      // If validation failed or answer was empty, retry if attempts are left
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          console.warn(`${agentName}: Attempt ${attempt + 1} failed validation or got empty answer. Retrying... (Next Attempt: ${attempt + 2})`, { inputSummary });
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // Exponential backoff
          continue; // Go to next attempt
      } else {
        // Last attempt failed validation or resulted in an empty answer
        console.error(`${agentName}: Max retries reached. Output validation failed or answer was empty on final attempt.`, { inputSummary, lastOutputReceived: result });
        return DEFAULT_OUTPUT; 
      }

    } catch (error: unknown) { 
      let errorMessage: string;
      let originalError: unknown = error; // Preserve original error for logging

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = "An unknown error occurred during agent execution.";
      }
      
      console.error(`${agentName}: Attempt ${attempt + 1} failed with error.`, {
        error: errorMessage,
        inputSummary,
        timestamp: new Date().toISOString(),
        originalError: originalError, 
      });

      // Specific check for Genkit/LLM schema issues that might be recoverable by retry
      if (errorMessage.includes("INVALID_ARGUMENT") && (errorMessage.includes("Expected object, got null") || errorMessage.includes("answer: Required"))) {
         console.warn(`${agentName}: Attempt ${attempt + 1}: Genkit schema validation error. Retrying if attempts left.`);
      }

      // If this was the last attempt, return default output
      if (attempt === MAX_RETRY_ATTEMPTS - 1) {
         console.error(`${agentName}: Max retries reached after error. Returning default output.`, { lastError: errorMessage, inputSummary });
        return DEFAULT_OUTPUT;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); 
    }
  }
  
  // Fallback, should ideally not be reached if the loop logic is sound
  console.error(`${agentName}: Reached end of function unexpectedly after all retries. Returning default output.`, { inputSummary });
  return DEFAULT_OUTPUT;
}

/**
 * Template for the prompt provided to the language model.
 * It instructs the LLM on its role, the desired response format, and content guidelines.
 */
const respondPromptTemplate = `You are an expert responder agent in a critical thinking system. 
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
Do not include any explanatory text before or after the JSON.`;

/**
 * Genkit prompt definition for the responder agent.
 * This defines the input/output schemas and the prompt template for the AI call.
 */
const prompt = ai.definePrompt(
  {
    name: 'respondPrompt',
    input: {schema: RespondInputSchema},
    output: {schema: RespondOutputSchema}, 
    prompt: respondPromptTemplate, 
  }
);

/**
 * Internal Genkit flow that makes the actual call to the language model using the defined prompt.
 * This flow is wrapped by the main `respond` function to include retry logic and more detailed validation.
 * @async
 * @param {RespondInput} input - The input object containing the user's query.
 * @returns {Promise<RespondOutput>} A promise that resolves to the LLM's structured output,
 *                                   or a default error response if the LLM output is null/undefined.
 */
const respondInternalFlow = ai.defineFlow(
  {
    name: 'respondInternalFlow',
    inputSchema: RespondInputSchema,
    outputSchema: RespondOutputSchema, 
    description: 'Internal flow to generate a response using the respondPrompt.' // Added description
  },
  async (input: RespondInput): Promise<RespondOutput> => { 
    const {output} = await prompt(input);
    if (output && typeof output.answer === 'string') {
        return output;
    }
    // This warning helps identify issues if the LLM doesn't adhere to the output schema.
    console.warn("respondInternalFlow: LLM output was null, undefined, or not matching schema. Returning default.", { llmOutput: output });
    return DEFAULT_OUTPUT; 
  }
);
