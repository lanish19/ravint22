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

const AnalyzeAssumptionsInputSchema = z.object({
  answer: z.string().describe('The answer to analyze for hidden assumptions.'),
});
export type AnalyzeAssumptionsInput = z.infer<typeof AnalyzeAssumptionsInputSchema>;

const AssumptionItemSchema = z.object({
  assumption: z.string().describe('Hidden assumption being made'),
  risk: z.enum(['High', 'Medium', 'Low']).describe('The level of risk associated with the assumption.'),
  alternative: z.string().describe('Alternative perspective that challenges this assumption'),
});
// No longer exporting AssumptionItemSchema directly
export type AssumptionItem = z.infer<typeof AssumptionItemSchema>;


const AnalyzeAssumptionsOutputSchema = z.array(AssumptionItemSchema);
export type AnalyzeAssumptionsOutput = z.infer<typeof AnalyzeAssumptionsOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: AnalyzeAssumptionsOutput = [];

export async function analyzeAssumptions(input: AnalyzeAssumptionsInput): Promise<AnalyzeAssumptionsOutput> {
  // Validate input (Genkit does this, but for belt-and-suspenders or non-Genkit flows)
  try {
    AnalyzeAssumptionsInputSchema.parse(input);
  } catch (e: any) {
    console.error('AssumptionAnalyzer: Invalid input', { error: e.message, input });
    return DEFAULT_OUTPUT;
  }

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await analyzeAssumptionsFlow(input);
      
      let parsedOutput = result;

      if (typeof result === 'string') {
        try {
          parsedOutput = JSON.parse(result);
        } catch (parseError) {
          console.warn(`AssumptionAnalyzer: Attempt ${attempt + 1}: Output was a string but not valid JSON. Retrying if possible.`, { stringOutput: result, error: parseError });
          if (attempt < RETRY_ATTEMPTS - 1) continue; 
          parsedOutput = DEFAULT_OUTPUT; // Force default on last attempt
        }
      }
      
      // Validate with Zod schema
      const validation = AnalyzeAssumptionsOutputSchema.safeParse(parsedOutput);
      if (validation.success) {
        return validation.data;
      } else {
        console.warn(`AssumptionAnalyzer: Attempt ${attempt + 1}: Output validation failed. Retrying if possible.`, { errors: validation.error.errors, outputReceived: parsedOutput });
        if (attempt < RETRY_ATTEMPTS - 1) continue; 
        return DEFAULT_OUTPUT;
      }

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`AssumptionAnalyzer: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
        input: JSON.stringify(input).substring(0, 500), // Log truncated input
        timestamp: new Date().toISOString()
      });
      if (errorMessage.includes("INVALID_ARGUMENT") && errorMessage.includes("Expected array, got null")) {
        console.warn(`AssumptionAnalyzer: Attempt ${attempt + 1}: Genkit schema validation failed (null for array). Retrying.`);
        if (attempt < RETRY_ATTEMPTS - 1) {
           await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
           continue;
        }
        console.warn(`AssumptionAnalyzer: Max retries reached for null array output. Returning default.`);
        return DEFAULT_OUTPUT;
      }
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error(`AssumptionAnalyzer: Max retries reached. Returning default output.`);
        return DEFAULT_OUTPUT; 
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  console.error("AssumptionAnalyzer: Reached end of function unexpectedly. Returning default.");
  return DEFAULT_OUTPUT; 
}

const prompt = ai.definePrompt({
  name: 'analyzeAssumptionsPrompt',
  input: {schema: AnalyzeAssumptionsInputSchema},
  output: {schema: AnalyzeAssumptionsOutputSchema},
  prompt: `You are an assumption analyzer. Identify hidden assumptions in: "{{{answer}}}"

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

Return ONLY a valid JSON array with the exact structure shown above. Do not include any explanatory text before or after the JSON.`,
});

// This is the core Genkit flow. The exported function `analyzeAssumptions` adds retries and robust parsing.
const analyzeAssumptionsFlow = ai.defineFlow(
  {
    name: 'analyzeAssumptionsInternalFlow', 
    inputSchema: AnalyzeAssumptionsInputSchema,
    outputSchema: AnalyzeAssumptionsOutputSchema, 
  },
  async (input) => {
    const {output} = await prompt(input);
    return output ?? DEFAULT_OUTPUT; 
  }
);
