'use server';
/**
 * @fileOverview Assumption Analyzer AI agent.
 *
 * - analyzeAssumptions - A function that handles the assumption analysis process.
 * - AnalyzeAssumptionsInput - The input type for the analyzeAssumptions function.
 * - AnalyzeAssumptionsOutput - The return type for the analyzeAssumptions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Defines the schema for the input to the Assumption Analyzer agent.
 */
const AnalyzeAssumptionsInputSchema = z.object({
  answer: z.string().describe('The answer to analyze for hidden assumptions.'),
});
/**
 * Represents the input structure for the Assumption Analyzer agent.
 */
export type AnalyzeAssumptionsInput = z.infer<typeof AnalyzeAssumptionsInputSchema>;

/**
 * Defines the schema for a single assumption item identified by the agent.
 */
const AssumptionItemSchema = z.object({
  assumption: z.string().describe('Hidden assumption being made'),
  risk: z.enum(['High', 'Medium', 'Low']).describe('The level of risk associated with the assumption.'),
  alternative: z.string().describe('Alternative perspective that challenges this assumption'),
});
/**
 * Represents a single assumption item with its risk and alternative.
 */
export type AssumptionItem = z.infer<typeof AssumptionItemSchema>;

/**
 * Defines the schema for the output of the Assumption Analyzer agent, which is an array of assumption items.
 */
const AnalyzeAssumptionsOutputSchema = z.array(AssumptionItemSchema);
/**
 * Represents the output structure for the Assumption Analyzer agent.
 */
export type AnalyzeAssumptionsOutput = z.infer<typeof AnalyzeAssumptionsOutputSchema>;

const MAX_RETRY_ATTEMPTS = 3; // Renamed for clarity and consistency
const AGENT_NAME = "AssumptionAnalyzerAgent"; // Defined for consistent logging
const DEFAULT_OUTPUT: AnalyzeAssumptionsOutput = []; // Empty array is a valid default

/**
 * Analyzes a given text (answer) to identify hidden assumptions.
 * This function includes input validation, retry logic with exponential backoff for the core AI call,
 * and output validation to ensure a reliable and structured list of assumptions.
 * 
 * @async
 * @param {AnalyzeAssumptionsInput} input - The input object containing the answer to be analyzed.
 * @returns {Promise<AnalyzeAssumptionsOutput>} A promise that resolves to an array of identified assumption items,
 *                                             or an empty array if processing fails or no assumptions are found.
 */
export async function analyzeAssumptions(input: AnalyzeAssumptionsInput): Promise<AnalyzeAssumptionsOutput> {
  const inputSummary: string = JSON.stringify(input).substring(0, 200); 

  // 1. Input Validation
  const parseResult = AnalyzeAssumptionsInputSchema.safeParse(input);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.flatten();
    console.error(`${AGENT_NAME}: Invalid input.`, { 
      error: errorDetails, 
      inputSummary,
      timestamp: new Date().toISOString(),
    });
    // For invalid input, returning default empty array as per schema.
    // A more informative error could be thrown or returned if the calling system can handle it.
    return DEFAULT_OUTPUT; 
  }
  const validInput: AnalyzeAssumptionsInput = parseResult.data;

  // 2. Retry Logic for Core Operation
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`${AGENT_NAME}: Calling analyzeAssumptionsFlow. Attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}.`, { inputSummary });
      const result: unknown = await analyzeAssumptionsFlow(validInput); // Call the internal flow
      
      // 3. Output Validation and Processing
      let parsedOutputFromResult: unknown = result;

      // Handle cases where LLM might return a string that needs parsing
      if (typeof result === 'string') {
        try {
          parsedOutputFromResult = JSON.parse(result);
        } catch (parseError: unknown) { // Catch unknown for type safety
          const parseErrorMsg = parseError instanceof Error ? parseError.message : String(parseError);
          console.warn(`${AGENT_NAME}: Attempt ${attempt + 1}: Output was a string but not valid JSON.`, { 
            stringOutput: result, 
            error: parseErrorMsg,
            inputSummary,
            timestamp: new Date().toISOString(),
          });
          // If parsing fails and it's not the last attempt, retry. Otherwise, it will fall through to default.
          if (attempt < MAX_RETRY_ATTEMPTS - 1) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue;
          }
          parsedOutputFromResult = null; // Ensure it proceeds to default output if parsing fails on last attempt
        }
      }
      
      const validation = AnalyzeAssumptionsOutputSchema.safeParse(parsedOutputFromResult);
      if (validation.success) {
        // Even if successful, ensure it's not an empty array if that's undesirable (though schema allows it)
        // For this agent, an empty array can be a valid response (no assumptions found).
        console.log(`${AGENT_NAME}: Attempt ${attempt + 1}: Successfully generated and validated assumptions.`, { inputSummary, count: validation.data.length });
        return validation.data;
      } else {
        console.warn(`${AGENT_NAME}: Attempt ${attempt + 1}: Output validation failed.`, { 
          errors: validation.error.flatten(), 
          outputReceived: parsedOutputFromResult,
          inputSummary,
          timestamp: new Date().toISOString(),
        });
        // If validation fails and not the last attempt, retry
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          console.warn(`${AGENT_NAME}: Retrying due to output validation failure... (Next Attempt: ${attempt + 2})`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue; 
        }
        // Last attempt failed validation
        console.error(`${AGENT_NAME}: Max retries reached. Output validation failed on final attempt.`, { inputSummary, lastOutputReceived: parsedOutputFromResult });
        return DEFAULT_OUTPUT; 
      }

    } catch (error: unknown) { // Catch unknown for type safety
      let errorMessage: string;
      let originalError: unknown = error; // Preserve original error for logging

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = "An unknown error occurred during agent execution.";
      }
      
      console.error(`${AGENT_NAME}: Attempt ${attempt + 1} failed with error.`, {
        error: errorMessage,
        inputSummary,
        timestamp: new Date().toISOString(),
        originalError: originalError, 
      });

      // Specific check for Genkit/LLM schema issues (e.g. LLM returns null for an array type)
      if (errorMessage.includes("INVALID_ARGUMENT") && errorMessage.includes("Expected array, got null")) {
         console.warn(`${AGENT_NAME}: Attempt ${attempt + 1}: Genkit schema validation failed (null for array). Retrying if attempts left.`);
      }

      if (attempt === MAX_RETRY_ATTEMPTS - 1) {
         console.error(`${AGENT_NAME}: Max retries reached after error. Returning default output.`, { lastError: errorMessage, inputSummary });
        return DEFAULT_OUTPUT;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); // Exponential backoff
    }
  }
  
  console.error(`${AGENT_NAME}: Reached end of function unexpectedly after all retries. Returning default output.`, { inputSummary });
  return DEFAULT_OUTPUT; 
}

/**
 * Template for the prompt provided to the language model for assumption analysis.
 */
const analyzeAssumptionsPromptTemplate = `You are an assumption analyzer. Identify hidden assumptions in: "{{{answer}}}"

Return a JSON array of assumptions with the following structure:
[
    {
        "assumption": "Hidden assumption being made",
        "risk": "High|Medium|Low",
        "alternative": "Alternative perspective that challenges this assumption"
    }
]

Find 3-4 key assumptions that:
- Are not explicitly stated but required for the claim
- Could significantly impact validity if wrong
- Represent different categories (cultural, practical, contextual, etc.)

Return ONLY a valid JSON array with the exact structure shown above. Do not include any explanatory text before or after the JSON.`;

/**
 * Genkit prompt definition for the assumption analyzer agent.
 */
const prompt = ai.definePrompt(
  {
    name: 'analyzeAssumptionsPrompt',
    input: {schema: AnalyzeAssumptionsInputSchema},
    output: {schema: AnalyzeAssumptionsOutputSchema},
    prompt: analyzeAssumptionsPromptTemplate,
  }
);

/**
 * Internal Genkit flow that makes the actual call to the language model using the defined prompt.
 * This flow is wrapped by the main `analyzeAssumptions` function to include robust retry logic,
 * input validation, and more comprehensive output validation/parsing.
 * @async
 * @param {AnalyzeAssumptionsInput} input - The input object containing the answer to be analyzed.
 * @returns {Promise<AnalyzeAssumptionsOutput>} A promise that resolves to the LLM's structured output (an array of assumptions),
 *                                   or an empty array if the LLM output is null/undefined.
 */
const analyzeAssumptionsFlow = ai.defineFlow(
  {
    name: 'analyzeAssumptionsInternalFlow', 
    inputSchema: AnalyzeAssumptionsInputSchema,
    outputSchema: AnalyzeAssumptionsOutputSchema, 
    description: 'Internal flow to analyze assumptions using the analyzeAssumptionsPrompt.'
  },
  async (input: AnalyzeAssumptionsInput): Promise<AnalyzeAssumptionsOutput> => { 
    const {output} = await prompt(input);
    // The prompt is defined with AnalyzeAssumptionsOutputSchema, so Genkit should try to match this.
    // If 'output' is null or undefined, it means the LLM likely failed to produce parsable output.
    return output ?? DEFAULT_OUTPUT; // Return default if LLM output is null/undefined
  }
);
