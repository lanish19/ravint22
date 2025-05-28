// This file is machine-generated - edit at your own risk.

'use server';

/**
 * @fileOverview The Devil's Advocate AI agent.
 *
 * - challenge - A function that handles generating counterarguments and challenges to an initial answer.
 * - ChallengeInput - The input type for the challenge function.
 * - ChallengeOutput - The return type for the challenge function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChallengeInputSchema = z.object({
  answer: z.string().describe('The initial answer to challenge.'),
  critique: z.string().describe('The critique of the answer.'),
});
export type ChallengeInput = z.infer<typeof ChallengeInputSchema>;

const ChallengeOutputSchema = z.array(z.string()).describe('A list of counterarguments.');
export type ChallengeOutput = z.infer<typeof ChallengeOutputSchema>;

export async function challenge(input: ChallengeInput): Promise<ChallengeOutput> {
  return challengeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'devilsAdvocatePrompt',
  input: {schema: ChallengeInputSchema},
  output: {schema: ChallengeOutputSchema},
  prompt: `You are a devil's advocate agent. Challenge this claim: "{{answer}}"

Consider this critique: {{critique}}

Generate 4-5 strong counterarguments. Return a JSON array with the following structure:
[
    "Counterargument 1 that challenges the core premise",
    "Counterargument 2 addressing potential negative consequences",
    "Counterargument 3 about alternative explanations",
    "Counterargument 4 questioning the evidence base",
    "Counterargument 5 about practical limitations"
]

Make arguments that are:
- Substantive and thought-provoking
- Based on plausible concerns
- Diverse in perspective
- Challenging but fair

Return ONLY the JSON array.`,
});

const challengeFlow = ai.defineFlow(
  {
    name: 'challengeFlow',
    inputSchema: ChallengeInputSchema,
    outputSchema: ChallengeOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);

      if (!Array.isArray(output)) {
        console.warn(
          'DevilsAdvocate output was not an array. LLM may not be conforming to schema. Output:',
          output
        );
        // Check if output is null or undefined, which is more likely if the LLM failed completely.
        if (output === null || typeof output === 'undefined') {
          console.warn('DevilsAdvocate output was null or undefined. Returning empty array.');
        }
        return []; // Return empty array to maintain type safety if output is not an array
      }
      return output; // Output is a valid array
    } catch (error) {
      console.error('Error in challengeFlow:', error);
      // Re-throw the error to let the orchestrator know something went wrong.
      throw error;
    }
  }
);

