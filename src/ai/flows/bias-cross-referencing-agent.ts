'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// F1 Part 1: Bias Cross-Referencing Agent - Ensures biases are addressed

const BiasCrossReferencingInputSchema = z.object({
  potentialBiases: z.array(z.object({
    biasType: z.string(),
    location: z.string(),
    description: z.string(),
    evidence: z.string(),
    severity: z.enum(['high', 'medium', 'low']),
    mitigationSuggestion: z.string(),
  })),
  initialAnswerText: z.string(),
  critiqueOutput: z.string().describe('Output from critique agents'),
  aggregatedCounterResearch: z.array(z.object({
    claim: z.string(),
    support: z.string(),
    quality: z.enum(['high', 'moderate', 'low']),
    source: z.string(),
  })).optional().default([]),
});
export type BiasCrossReferencingInput = z.infer<typeof BiasCrossReferencingInputSchema>;

const CrossReferencedBiasItemSchema = z.object({
  originalBias: z.object({
    biasType: z.string(),
    description: z.string(),
    severity: z.enum(['high', 'medium', 'low']),
  }),
  addressedInCritique: z.boolean(),
  addressedByCounterEvidence: z.boolean(),
  conflictingPoints: z.array(z.string()).describe('Points where bias contradicts other analyses'),
  unaddressedConcerns: z.array(z.string()).describe('Bias concerns not covered by critiques'),
  recommendedActions: z.array(z.string()).describe('Specific actions to address this bias'),
  overallRisk: z.enum(['critical', 'high', 'medium', 'low']).describe('Risk if bias remains unaddressed'),
});

const BiasCrossReferencingOutputSchema = z.object({
  crossReferencedBiases: z.array(CrossReferencedBiasItemSchema),
  unaddressedBiasCount: z.number(),
  criticalBiasesRequiringAttention: z.array(z.string()),
  overallBiasAssessment: z.string().describe('Summary of bias mitigation status'),
});
export type BiasCrossReferencingOutput = z.infer<typeof BiasCrossReferencingOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: BiasCrossReferencingOutput = {
  crossReferencedBiases: [],
  unaddressedBiasCount: 0,
  criticalBiasesRequiringAttention: [],
  overallBiasAssessment: 'Unable to cross-reference biases due to processing error',
};

const biasCrossReferencingPrompt = ai.definePrompt({
  name: 'biasCrossReferencingPrompt',
  input: { schema: BiasCrossReferencingInputSchema },
  output: { schema: BiasCrossReferencingOutputSchema },
  prompt: `You are a Bias Cross-Referencing Agent ensuring that identified biases are properly addressed.

Identified Biases:
{{#each potentialBiases}}
- Type: {{this.biasType}} (Severity: {{this.severity}})
  Location: {{this.location}}
  Description: {{this.description}}
  Evidence: "{{this.evidence}}"
  Suggested Mitigation: {{this.mitigationSuggestion}}
{{/each}}

Initial Answer:
{{{initialAnswerText}}}

Critique Analysis:
{{{critiqueOutput}}}

Counter-Evidence:
{{#if aggregatedCounterResearch.length}}
{{#each aggregatedCounterResearch}}
- Against "{{this.claim}}": {{this.support}} ({{this.quality}} quality, {{this.source}})
{{/each}}
{{else}}
- No counter-evidence provided
{{/if}}

Your task is to:
1. Compare each identified bias against the critique to see if it was addressed
2. Check if counter-evidence helps mitigate any biases
3. Identify points where biases contradict critique findings or counter-evidence
4. Flag biases that remain completely unaddressed
5. Assess the overall risk of each unaddressed bias

For each bias, determine:
- Was it mentioned or addressed in the critique?
- Does counter-evidence help mitigate it?
- Are there conflicting points between the bias and other analyses?
- What specific concerns remain unaddressed?
- What actions would effectively address this bias?
- What's the risk level if this bias remains?

Return a JSON object with this structure:
{
  "crossReferencedBiases": [
    {
      "originalBias": {
        "biasType": "confirmation_bias",
        "description": "Description of the bias",
        "severity": "high"
      },
      "addressedInCritique": true/false,
      "addressedByCounterEvidence": true/false,
      "conflictingPoints": ["Point 1 where bias contradicts analysis"],
      "unaddressedConcerns": ["Concern 1 not covered"],
      "recommendedActions": ["Action 1 to address bias"],
      "overallRisk": "critical|high|medium|low"
    }
  ],
  "unaddressedBiasCount": 0,
  "criticalBiasesRequiringAttention": ["bias_type_1 description"],
  "overallBiasAssessment": "Summary of how well biases are being addressed"
}

Return ONLY the JSON object.`,
});

export async function crossReferenceBiases(input: BiasCrossReferencingInput): Promise<BiasCrossReferencingOutput> {
  try {
    BiasCrossReferencingInputSchema.parse(input);
  } catch (e: any) {
    console.error('BiasCrossReferencingAgent: Invalid input', { error: e.message });
    return DEFAULT_OUTPUT;
  }
  
  // Handle empty bias list
  if (!input.potentialBiases || input.potentialBiases.length === 0) {
    console.log('BiasCrossReferencingAgent: No biases to cross-reference');
    return {
      crossReferencedBiases: [],
      unaddressedBiasCount: 0,
      criticalBiasesRequiringAttention: [],
      overallBiasAssessment: 'No biases were identified to cross-reference',
    };
  }
  
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await biasCrossReferencingFlow(input);
      
      // Validate result
      const validation = BiasCrossReferencingOutputSchema.safeParse(result);
      if (validation.success) {
        console.log(`BiasCrossReferencingAgent: Cross-referenced ${validation.data.crossReferencedBiases.length} biases, ${validation.data.unaddressedBiasCount} remain unaddressed`);
        return validation.data;
      } else {
        console.warn(`BiasCrossReferencingAgent: Attempt ${attempt + 1}: Output validation failed.`, {
          errors: validation.error.errors,
        });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`BiasCrossReferencingAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
      });
      
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error('BiasCrossReferencingAgent: Max retries reached. Returning default output.');
        return DEFAULT_OUTPUT;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return DEFAULT_OUTPUT;
}

const biasCrossReferencingFlow = ai.defineFlow(
  {
    name: 'biasCrossReferencingFlow',
    inputSchema: BiasCrossReferencingInputSchema,
    outputSchema: BiasCrossReferencingOutputSchema,
  },
  async (input) => {
    const { output } = await biasCrossReferencingPrompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
