// 'use server'
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

export async function analyzeFailures(input: PremortermItemInput): Promise<PremortermItem[]> {
  return analyzeFailuresFlow(input);
}

const prompt = ai.definePrompt({
  name: 'premortemAnalysisPrompt',
  input: {schema: PremortermItemInputSchema},
  output: {schema: z.array(PremortermItemSchema)},
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

Return ONLY the JSON array.`,
});

const analyzeFailuresFlow = ai.defineFlow(
  {
    name: 'analyzeFailuresFlow',
    inputSchema: PremortermItemInputSchema,
    outputSchema: z.array(PremortermItemSchema),
  },
  async input => {
    const {output} = await prompt(input);
    return output || []; // Ensure an array is always returned
  }
);

