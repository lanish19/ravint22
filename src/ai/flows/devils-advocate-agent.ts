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

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: ChallengeOutput = [];

export async function challenge(input: ChallengeInput): Promise<ChallengeOutput> {
  try {
    ChallengeInputSchema.parse(input);
  } catch (e: any) {
    console.error('DevilsAdvocateAgent: Invalid input', { error: e.message, input });
    return DEFAULT_OUTPUT;
  }

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await challengeInternalFlow(input);
      
      let parsedOutput = result;
      if (typeof result === 'string') {
        try {
          parsedOutput = JSON.parse(result);
        } catch (parseError) {
          console.warn(`DevilsAdvocateAgent: Attempt ${attempt + 1}: Output was a string but not valid JSON. Retrying if possible.`, { stringOutput: result, error: parseError });
          if (attempt < RETRY_ATTEMPTS - 1) continue;
          parsedOutput = DEFAULT_OUTPUT;
        }
      }
      
      const validation = ChallengeOutputSchema.safeParse(parsedOutput);
      if (validation.success) {
        return validation.data;
      } else {
        console.warn(`DevilsAdvocateAgent: Attempt ${attempt + 1}: Output validation failed. Retrying if possible.`, { errors: validation.error.errors, outputReceived: parsedOutput });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
        return DEFAULT_OUTPUT;
      }

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`DevilsAdvocateAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
        input: JSON.stringify(input).substring(0,500),
        timestamp: new Date().toISOString()
      });
      if (errorMessage.includes("INVALID_ARGUMENT") && errorMessage.includes("Expected array, got null")) {
        console.warn(`DevilsAdvocateAgent: Attempt ${attempt + 1}: Genkit schema validation failed (null for array). Retrying.`);
        if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        console.warn(`DevilsAdvocateAgent: Max retries reached for null array output. Returning default.`);
        return DEFAULT_OUTPUT;
      }
      if (attempt === RETRY_ATTEMPTS - 1) {
         console.error(`DevilsAdvocateAgent: Max retries reached. Returning default output.`);
        return DEFAULT_OUTPUT;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  console.error("DevilsAdvocateAgent: Reached end of function unexpectedly. Returning default.");
  return DEFAULT_OUTPUT;
}

const prompt = ai.definePrompt({
  name: 'devilsAdvocatePrompt',
  input: {schema: ChallengeInputSchema},
  output: {schema: ChallengeOutputSchema},
  prompt: `You are a devil's advocate agent. Challenge this claim: "{{answer}}"

Consider this critique: {{critique}}

Generate 4-5 strong counterarguments. Return a JSON array of strings with the following structure:
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

Return ONLY a valid JSON array with the exact structure shown above. Do not include any explanatory text before or after the JSON.`,
});

const challengeInternalFlow = ai.defineFlow(
  {
    name: 'challengeInternalFlow',
    inputSchema: ChallengeInputSchema,
    outputSchema: ChallengeOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
