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

const EvidenceSchema = z.object({
  claim: z.string().describe('Specific aspect of the claim being supported/challenged'),
  support: z.string().describe('Detailed evidence with statistics, studies, or expert consensus'),
  quality: z.enum(['high', 'moderate', 'low']).describe('Quality of the evidence'),
  source: z.string().describe('Credible source citation (journal, institution, etc.)'),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

const ResearchEvidenceInputSchema = z.object({
  claim: z.string().describe('The claim to research and find supporting evidence for.'),
});
export type ResearchEvidenceInput = z.infer<typeof ResearchEvidenceInputSchema>;

const ResearchEvidenceOutputSchema = z.array(EvidenceSchema);
export type ResearchEvidenceOutput = z.infer<typeof ResearchEvidenceOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: ResearchEvidenceOutput = [];

export async function researchEvidence(input: ResearchEvidenceInput): Promise<ResearchEvidenceOutput> {
  try {
    ResearchEvidenceInputSchema.parse(input);
  } catch (e: any) {
    console.error('ResearcherAgent (Supporting): Invalid input', { error: e.message, input });
    return DEFAULT_OUTPUT;
  }

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await researchEvidenceInternalFlow(input);

      let parsedOutput = result;
      if (typeof result === 'string') {
        try {
          parsedOutput = JSON.parse(result);
        } catch (parseError) {
          console.warn(`ResearcherAgent: Attempt ${attempt + 1}: Output was a string but not valid JSON. Retrying if possible.`, { stringOutput: result, error: parseError });
          if (attempt < RETRY_ATTEMPTS - 1) continue;
          parsedOutput = DEFAULT_OUTPUT;
        }
      }

      const validation = ResearchEvidenceOutputSchema.safeParse(parsedOutput);
      if (validation.success) {
        return validation.data;
      } else {
        console.warn(`ResearcherAgent (Supporting): Attempt ${attempt + 1}: Output validation failed. Retrying if possible.`, { errors: validation.error.errors, outputReceived: parsedOutput });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
        return DEFAULT_OUTPUT;
      }

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`ResearcherAgent (Supporting): Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
        input: JSON.stringify(input).substring(0,500),
        timestamp: new Date().toISOString()
      });
       if (errorMessage.includes("INVALID_ARGUMENT") && errorMessage.includes("Expected array, got null")) {
         console.warn(`ResearcherAgent (Supporting): Attempt ${attempt + 1}: Genkit schema validation failed (null for array). Retrying.`);
         if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        console.warn(`ResearcherAgent (Supporting): Max retries reached for null array output. Returning default.`);
        return DEFAULT_OUTPUT;
      }
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error(`ResearcherAgent (Supporting): Max retries reached. Returning default output.`);
        return DEFAULT_OUTPUT;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  console.error("ResearcherAgent (Supporting): Reached end of function unexpectedly. Returning default.");
  return DEFAULT_OUTPUT;
}

const researchEvidencePrompt = ai.definePrompt({
  name: 'researchSupportingEvidencePrompt',
  input: {schema: ResearchEvidenceInputSchema},
  output: {schema: ResearchEvidenceOutputSchema},
  prompt: `You are a research agent analyzing this claim: "{{{claim}}}"

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

Return ONLY a valid JSON array with the exact structure shown above. Do not include any explanatory text before or after the JSON.`,
});

const researchEvidenceInternalFlow = ai.defineFlow(
  {
    name: 'researchSupportingEvidenceInternalFlow',
    inputSchema: ResearchEvidenceInputSchema,
    outputSchema: ResearchEvidenceOutputSchema,
  },
  async (input) => {
    const {output} = await researchEvidencePrompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);

