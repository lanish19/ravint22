'use server';

/**
 * @fileOverview An AI agent that researches counter-evidence for a given claim.
 *
 * - researchCounterEvidence - A function that handles the counter-evidence research process.
 * - ResearchCounterEvidenceInput - The input type for the researchCounterEvidence function.
 * - ResearchCounterEvidenceOutput - The return type for the researchCounterEvidence function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Re-using the Evidence schema structure from the main researcher agent
// as the format of an evidence item is the same.
const EvidenceSchema = z.object({
  claim: z.string().describe('Specific aspect of the original claim being challenged or an alternative claim'),
  support: z.string().describe('Detailed counter-evidence, contradictory data, or support for an alternative perspective'),
  quality: z.enum(['high', 'moderate', 'low']).describe('Quality of the counter-evidence'),
  source: z.string().describe('Credible source citation for the counter-evidence (journal, institution, etc.)'),
});
export type Evidence = z.infer<typeof EvidenceSchema>;


const ResearchCounterEvidenceInputSchema = z.object({
  claim: z.string().describe('The original claim to find counter-evidence for.'),
});
export type ResearchCounterEvidenceInput = z.infer<typeof ResearchCounterEvidenceInputSchema>;

const ResearchCounterEvidenceOutputSchema = z.array(EvidenceSchema);
export type ResearchCounterEvidenceOutput = z.infer<typeof ResearchCounterEvidenceOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: ResearchCounterEvidenceOutput = [];

export async function researchCounterEvidence(input: ResearchCounterEvidenceInput): Promise<ResearchCounterEvidenceOutput> {
  try {
    ResearchCounterEvidenceInputSchema.parse(input);
  } catch (e: any) {
    console.error('CounterEvidenceResearcherAgent: Invalid input', { error: e.message, input });
    return DEFAULT_OUTPUT;
  }

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await researchCounterEvidenceInternalFlow(input);

      let parsedOutput = result;
      if (typeof result === 'string') {
        try {
          parsedOutput = JSON.parse(result);
        } catch (parseError) {
          console.warn(`CounterEvidenceResearcherAgent: Attempt ${attempt + 1}: Output was a string but not valid JSON. Retrying if possible.`, { stringOutput: result, error: parseError });
          if (attempt < RETRY_ATTEMPTS - 1) continue;
          parsedOutput = DEFAULT_OUTPUT;
        }
      }

      const validation = ResearchCounterEvidenceOutputSchema.safeParse(parsedOutput);
      if (validation.success) {
        return validation.data;
      } else {
        console.warn(`CounterEvidenceResearcherAgent: Attempt ${attempt + 1}: Output validation failed. Retrying if possible.`, { errors: validation.error.errors, outputReceived: parsedOutput });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
        return DEFAULT_OUTPUT;
      }

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`CounterEvidenceResearcherAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
        input: JSON.stringify(input).substring(0,500),
        timestamp: new Date().toISOString()
      });
       if (errorMessage.includes("INVALID_ARGUMENT") && errorMessage.includes("Expected array, got null")) {
         console.warn(`CounterEvidenceResearcherAgent: Attempt ${attempt + 1}: Genkit schema validation failed (null for array). Retrying.`);
         if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        console.warn(`CounterEvidenceResearcherAgent: Max retries reached for null array output. Returning default.`);
        return DEFAULT_OUTPUT;
      }
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error(`CounterEvidenceResearcherAgent: Max retries reached. Returning default output.`);
        return DEFAULT_OUTPUT;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  console.error("CounterEvidenceResearcherAgent: Reached end of function unexpectedly. Returning default.");
  return DEFAULT_OUTPUT;
}

const researchCounterEvidencePrompt = ai.definePrompt({
  name: 'researchCounterEvidencePrompt',
  input: {schema: ResearchCounterEvidenceInputSchema},
  output: {schema: ResearchCounterEvidenceOutputSchema},
  prompt: `You are a research agent specializing in finding counter-arguments and alternative perspectives.
Analyze this claim: "{{{claim}}}"

Your task is to find evidence that *challenges* or *contradicts* this claim, or evidence that supports alternative viewpoints. Provide up to 10 pieces of such counter-evidence.
Focus on quality and relevance. Ensure each piece clearly presents a contrasting viewpoint, contradictory data, or highlights limitations of the original claim.

You must return a valid JSON array with exactly this structure:
[
    {
        "claim": "Specific aspect of the original claim being challenged or an alternative claim being presented",
        "support": "Detailed counter-evidence, contradictory data, or support for an alternative perspective",
        "quality": "high|moderate|low",
        "source": "Credible source citation for the counter-evidence (journal, institution, etc.)"
    }
]

Ensure each piece:
- Directly addresses or refutes an aspect of the original claim, or introduces a significant alternative.
- Includes concrete data, expert opinions, or logical reasoning.
- Has a realistic quality assessment.
- Cites plausible sources.

Return ONLY a valid JSON array with the exact structure shown above. Do not include any explanatory text before or after the JSON.`,
});

const researchCounterEvidenceInternalFlow = ai.defineFlow(
  {
    name: 'researchCounterEvidenceInternalFlow',
    inputSchema: ResearchCounterEvidenceInputSchema,
    outputSchema: ResearchCounterEvidenceOutputSchema,
  },
  async (input) => {
    const {output} = await researchCounterEvidencePrompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
