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

const AnalyzeAssumptionsOutputSchema = z.array(
  z.object({
    assumption: z.string().describe('Hidden assumption being made'),
    risk: z.enum(['High', 'Medium', 'Low']).describe('The level of risk associated with the assumption.'),
    alternative: z.string().describe('Alternative perspective that challenges this assumption'),
  })
);
export type AnalyzeAssumptionsOutput = z.infer<typeof AnalyzeAssumptionsOutputSchema>;

export async function analyzeAssumptions(input: AnalyzeAssumptionsInput): Promise<AnalyzeAssumptionsOutput> {
  return analyzeAssumptionsFlow(input);
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

Return ONLY the JSON array.`,
});

const analyzeAssumptionsFlow = ai.defineFlow(
  {
    name: 'analyzeAssumptionsFlow',
    inputSchema: AnalyzeAssumptionsInputSchema,
    outputSchema: AnalyzeAssumptionsOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);

      if (!Array.isArray(output)) {
        console.warn(
          'Assumption analyzer output was not an array. LLM may not be conforming to schema. Output:',
          output
        );
        // Check if output is null or undefined, which is more likely if the LLM failed completely.
        // If it's some other non-array type, it's a different kind of non-conformance.
        if (output === null || typeof output === 'undefined') {
          console.warn('Assumption analyzer output was null or undefined. Returning empty array.');
        }
        return []; // Return empty array to maintain type safety if output is not an array
      }
      return output; // Output is a valid array
    } catch (error) {
      console.error('Error in analyzeAssumptionsFlow:', error);
      // Re-throw the error to let the orchestrator know something went wrong.
      // The orchestrator can then decide how to handle this (e.g., retry, skip, or halt).
      throw error;
    }
  }
);

