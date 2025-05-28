'use server';

/**
 * @fileOverview An AI agent that researches evidence for a given claim.
 *
 * - researchEvidence - A function that handles the evidence research process.
 * - ResearchEvidenceInput - The input type for the researchEvidence function.
 * - ResearchEvidenceOutput - The return type for the researchEvidence function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EvidenceSchema = z.object({
  claim: z.string().describe('Specific aspect of the claim being supported'),
  support: z.string().describe('Detailed evidence with statistics, studies, or expert consensus'),
  quality: z.enum(['high', 'moderate', 'low']).describe('Quality of the evidence'),
  source: z.string().describe('Credible source citation (journal, institution, etc.)'),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

const ResearchEvidenceInputSchema = z.object({
  claim: z.string().describe('The claim to research and find evidence for.'),
});
export type ResearchEvidenceInput = z.infer<typeof ResearchEvidenceInputSchema>;

const ResearchEvidenceOutputSchema = z.array(EvidenceSchema);
export type ResearchEvidenceOutput = z.infer<typeof ResearchEvidenceOutputSchema>;

export async function researchEvidence(input: ResearchEvidenceInput): Promise<ResearchEvidenceOutput> {
  return researchEvidenceFlow(input);
}

const researchEvidencePrompt = ai.definePrompt({
  name: 'researchEvidencePrompt',
  input: {schema: ResearchEvidenceInputSchema},
  output: {schema: ResearchEvidenceOutputSchema},
  prompt: `You are a research agent analyzing this claim: "{{{claim}}}"

Find and analyze evidence for this claim. You must return a valid JSON array with exactly this structure:
[
    {
        "claim": "Specific aspect of the claim being supported",
        "support": "Detailed evidence with statistics, studies, or expert consensus",
        "quality": "high|moderate|low",
        "source": "Credible source citation (journal, institution, etc.)"
    }
]

Provide 3-5 pieces of evidence. Ensure each piece:
- Addresses a specific aspect of the claim
- Includes concrete data or expert backing
- Has realistic quality assessment
- Cites plausible sources

Return ONLY the JSON array, no other text.`,
});

const researchEvidenceFlow = ai.defineFlow(
  {
    name: 'researchEvidenceFlow',
    inputSchema: ResearchEvidenceInputSchema,
    outputSchema: ResearchEvidenceOutputSchema,
  },
  async input => {
    const {output} = await researchEvidencePrompt(input);
    return output!;
  }
);
