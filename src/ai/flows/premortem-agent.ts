'use server';
/**
 * @fileOverview This file defines the Premortem Agent flow, which analyzes potential failure modes of a given answer.
 *
 * The flow takes an answer as input and returns a list of potential failure modes, their probabilities, and mitigation strategies.
 * - analyzeFailures - Function to trigger the premortem analysis.
 * - PremortermItem - The interface for a single failure mode item.
 * - PremortermItemInput - The input type for the analyzeFailures function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PremortermItemSchema = z.object({ 
  failure: z.string().describe('Specific way this could fail'),
  probability: z
    .string()
    .describe('High (60-80%)|Moderate (30-60%)|Low (10-30%)'),
  mitigation: z
    .string()
    .describe('Concrete steps to prevent or handle this failure'),
});
export type PremortermItem = z.infer<typeof PremortermItemSchema>;

const PremortermItemInputSchema = z.object({
  answer: z.string().describe('The answer to analyze for potential failure modes.'),
});
export type PremortermItemInput = z.infer<typeof PremortermItemInputSchema>;

const PremortemOutputSchema = z.array(PremortermItemSchema);
export type PremortemOutput = z.infer<typeof PremortemOutputSchema>;


const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: PremortemOutput = [];

export async function analyzeFailures(input: PremortermItemInput): Promise<PremortemOutput> {
  try {
    PremortermItemInputSchema.parse(input);
  } catch (e: any) {
    console.error('PremortemAgent: Invalid input', { error: e.message, input });
    return DEFAULT_OUTPUT;
  }

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await analyzeFailuresInternalFlow(input);
      
      let parsedOutput = result;
      if (typeof result === 'string') {
        try {
          parsedOutput = JSON.parse(result);
        } catch (parseError) {
          console.warn(`PremortemAgent: Attempt ${attempt + 1}: Output was a string but not valid JSON. Retrying if possible.`, { stringOutput: result, error: parseError });
          if (attempt < RETRY_ATTEMPTS - 1) continue;
          parsedOutput = DEFAULT_OUTPUT;
        }
      }
      
      const validation = PremortemOutputSchema.safeParse(parsedOutput);
      if (validation.success) {
        return validation.data;
      } else {
        console.warn(`PremortemAgent: Attempt ${attempt + 1}: Output validation failed. Retrying if possible.`, { errors: validation.error.errors, outputReceived: parsedOutput });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
        return DEFAULT_OUTPUT;
      }

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`PremortemAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
        input: JSON.stringify(input).substring(0,500),
        timestamp: new Date().toISOString()
      });
      if (errorMessage.includes("INVALID_ARGUMENT") && errorMessage.includes("Expected array, got null")) {
         console.warn(`PremortemAgent: Attempt ${attempt + 1}: Genkit schema validation failed (null for array). Retrying.`);
         if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        console.warn(`PremortemAgent: Max retries reached for null array output. Returning default.`);
        return DEFAULT_OUTPUT;
      }
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error(`PremortemAgent: Max retries reached. Returning default output.`);
        return DEFAULT_OUTPUT;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  console.error("PremortemAgent: Reached end of function unexpectedly. Returning default.");
  return DEFAULT_OUTPUT;
}

const prompt = ai.definePrompt({
  name: 'premortemAnalysisPrompt',
  input: {schema: PremortermItemInputSchema},
  output: {schema: PremortemOutputSchema},
  prompt: `You are a premortem analysis agent. Consider this advice: {{{answer}}}.

Imagine this advice is implemented and fails. Return a JSON array of failure modes with the following structure:
[
  {
    "failure": "Specific way this could fail",
    "probability": "High (60-80%)|Moderate (30-60%)|Low (10-30%)",
    "mitigation": "Concrete steps to prevent or handle this failure"
  }
]

Provide 3-4 realistic failure modes that:
- Address different types of failures (implementation, context, unintended consequences)
- Have realistic probability assessments
- Include actionable mitigation strategies

Return ONLY a valid JSON array with the exact structure shown above. Do not include any explanatory text before or after the JSON.`,
});

const analyzeFailuresInternalFlow = ai.defineFlow(
  {
    name: 'analyzeFailuresInternalFlow',
    inputSchema: PremortermItemInputSchema,
    outputSchema: PremortemOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
