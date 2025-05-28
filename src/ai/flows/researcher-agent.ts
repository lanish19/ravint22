'use server';

/**
 * @fileOverview An AI agent that researches evidence supporting a given claim.
 *
 * - researchEvidence - A function that handles the evidence research process.
 * - ResearchEvidenceInput - The input type for the researchEvidence function.
 * - ResearchEvidenceOutput - The return type for the researchEvidence function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Defines the schema for a single piece of evidence.
 */
const EvidenceSchema = z.object({
  claim: z.string().describe('Specific aspect of the claim being supported/challenged'),
  support: z.string().describe('Detailed evidence with statistics, studies, or expert consensus'),
  quality: z.enum(['high', 'moderate', 'low']).describe('Quality of the evidence'),
  source: z.string().describe('Credible source citation (journal, institution, etc.)'),
});
/**
 * Represents a single piece of evidence related to a claim.
 */
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Defines the schema for the input to the researchEvidence agent.
 */
const ResearchEvidenceInputSchema = z.object({
  claim: z.string().describe('The claim to research and find supporting evidence for.'),
});
/**
 * Represents the input structure for the researchEvidence agent.
 */
export type ResearchEvidenceInput = z.infer<typeof ResearchEvidenceInputSchema>;

/**
 * Defines the schema for the output of the researchEvidence agent, an array of evidence items.
 */
const ResearchEvidenceOutputSchema = z.array(EvidenceSchema);
/**
 * Represents the output structure for the researchEvidence agent.
 */
export type ResearchEvidenceOutput = z.infer<typeof ResearchEvidenceOutputSchema>;

const MAX_RETRY_ATTEMPTS = 3; // Consistent naming
const AGENT_NAME = "ResearcherAgent (Supporting)"; // Consistent agent name for logging
const DEFAULT_OUTPUT: ResearchEvidenceOutput = []; // Default is an empty array

/**
 * Researches and provides evidence supporting a given claim.
 * This function includes input validation, retry logic with exponential backoff,
 * and output validation to ensure reliable and structured evidence is returned.
 * 
 * @async
 * @param {ResearchEvidenceInput} input - The input object containing the claim to research.
 * @returns {Promise<ResearchEvidenceOutput>} A promise that resolves to an array of evidence items,
 *                                            or an empty array if processing fails or no evidence is found.
 */
export async function researchEvidence(input: ResearchEvidenceInput): Promise<ResearchEvidenceOutput> {
  const inputSummary: string = JSON.stringify(input).substring(0, 200);

  // 1. Input Validation
  const parseResult = ResearchEvidenceInputSchema.safeParse(input);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.flatten();
    console.error(`${AGENT_NAME}: Invalid input.`, { 
      error: errorDetails, 
      inputSummary,
      timestamp: new Date().toISOString(),
    });
    // Returning DEFAULT_OUTPUT for invalid input as per current pattern,
    // though throwing an error or returning a more specific error object might be alternatives.
    return DEFAULT_OUTPUT; 
  }
  const validInput: ResearchEvidenceInput = parseResult.data;

  // 2. Retry Logic for Core Operation
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`${AGENT_NAME}: Calling researchEvidenceInternalFlow. Attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}.`, { inputSummary });
      const result: unknown = await researchEvidenceInternalFlow(validInput);
      
      // 3. Output Validation and Processing
      let parsedOutputFromResult: unknown = result;

      // Handle cases where LLM might return a string that needs parsing
      if (typeof result === 'string') {
        try {
          parsedOutputFromResult = JSON.parse(result);
        } catch (parseError: unknown) {
          const parseErrorMsg = parseError instanceof Error ? parseError.message : String(parseError);
          console.warn(`${AGENT_NAME}: Attempt ${attempt + 1}: Output was a string but not valid JSON.`, { 
            stringOutput: result, 
            error: parseErrorMsg,
            inputSummary,
            timestamp: new Date().toISOString(),
          });
          if (attempt < MAX_RETRY_ATTEMPTS - 1) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue; // Retry if parsing failed and attempts are left
          }
          parsedOutputFromResult = null; // Force default if parsing fails on last attempt
        }
      }
      
      const validation = ResearchEvidenceOutputSchema.safeParse(parsedOutputFromResult);
      if (validation.success) {
        // For this agent, an empty array can be a valid response (no specific evidence found).
        console.log(`${AGENT_NAME}: Attempt ${attempt + 1}: Successfully generated and validated evidence.`, { inputSummary, count: validation.data.length });
        return validation.data;
      } else {
        console.warn(`${AGENT_NAME}: Attempt ${attempt + 1}: Output validation failed.`, { 
          errors: validation.error.flatten(), 
          outputReceived: parsedOutputFromResult,
          inputSummary,
          timestamp: new Date().toISOString(),
        });
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          console.warn(`${AGENT_NAME}: Retrying due to output validation failure... (Next Attempt: ${attempt + 2})`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue; 
        }
        console.error(`${AGENT_NAME}: Max retries reached. Output validation failed on final attempt.`, { inputSummary, lastOutputReceived: parsedOutputFromResult });
        return DEFAULT_OUTPUT; 
      }

    } catch (error: unknown) { 
      let errorMessage: string;
      let originalError: unknown = error; 

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
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); 
    }
  }
  
  console.error(`${AGENT_NAME}: Reached end of function unexpectedly after all retries. Returning default output.`, { inputSummary });
  return DEFAULT_OUTPUT; 
}

/**
 * Template for the prompt provided to the language model for researching supporting evidence.
 */
const researchEvidencePromptTemplate = `You are a research agent analyzing this claim: "{{{claim}}}"

Find and analyze evidence *supporting* this claim. Provide up to 10 pieces of evidence. Focus on quality and relevance for the supporting evidence.

You must return a valid JSON array with exactly this structure:
[
    {
        "claim": "Specific aspect of the claim being supported",
        "support": "Detailed evidence with statistics, studies, or expert consensus",
        "quality": "high|moderate|low",
        "source": "Credible source citation (journal, institution, etc.)"
    }
]

Ensure each piece:
- Addresses a specific aspect of the claim
- Includes concrete data or expert backing
- Has realistic quality assessment
- Cites plausible sources

Return ONLY a valid JSON array with the exact structure shown above. Do not include any explanatory text before or after the JSON.`;

/**
 * Genkit prompt definition for the researchEvidence agent.
 */
const researchEvidencePrompt = ai.definePrompt({
  name: 'researchSupportingEvidencePrompt',
  input: {schema: ResearchEvidenceInputSchema},
  output: {schema: ResearchEvidenceOutputSchema},
  prompt: researchEvidencePromptTemplate,
});

/**
 * Internal Genkit flow that makes the actual call to the language model.
 * This flow is wrapped by the main `researchEvidence` function for added robustness.
 * @async
 * @param {ResearchEvidenceInput} input - The input object containing the claim.
 * @returns {Promise<ResearchEvidenceOutput>} A promise that resolves to the LLM's structured output,
 *                                            or an empty array if the LLM output is null/undefined.
 */
const researchEvidenceInternalFlow = ai.defineFlow(
  {
    name: 'researchSupportingEvidenceInternalFlow',
    inputSchema: ResearchEvidenceInputSchema,
    outputSchema: ResearchEvidenceOutputSchema,
    description: 'Internal flow to research supporting evidence using the researchSupportingEvidencePrompt.'
  },
  async (input: ResearchEvidenceInput): Promise<ResearchEvidenceOutput> => {
    const {output} = await researchEvidencePrompt(input);
    return output ?? DEFAULT_OUTPUT; // Return default if LLM output is null/undefined
  }
);
