'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// E2: Bias Detection Agent - Identifies cognitive biases in analysis

const BiasDetectionInputSchema = z.object({
  initialAnswerText: z.string(),
  aggregatedSupportingResearch: z.array(z.object({
    claim: z.string(),
    support: z.string(),
    quality: z.enum(['high', 'moderate', 'low']),
    source: z.string(),
  })).optional().default([]),
  aggregatedCounterResearch: z.array(z.object({
    claim: z.string(),
    support: z.string(),
    quality: z.enum(['high', 'moderate', 'low']),
    source: z.string(),
  })).optional().default([]),
});
export type BiasDetectionInput = z.infer<typeof BiasDetectionInputSchema>;

const BiasItemSchema = z.object({
  biasType: z.enum([
    'confirmation_bias',
    'anchoring_bias',
    'availability_heuristic',
    'recency_bias',
    'selection_bias',
    'framing_effect',
    'overconfidence_bias',
    'authority_bias',
    'groupthink',
    'status_quo_bias',
    'sunk_cost_fallacy',
    'optimism_bias',
    'pessimism_bias',
    'hindsight_bias',
    'correlation_causation_fallacy',
  ]),
  location: z.enum(['initial_answer', 'supporting_research', 'counter_research', 'overall_framing']),
  description: z.string(),
  evidence: z.string().describe('Specific text or pattern that indicates this bias'),
  severity: z.enum(['high', 'medium', 'low']),
  mitigationSuggestion: z.string(),
});

const BiasDetectionOutputSchema = z.array(BiasItemSchema);
export type BiasDetectionOutput = z.infer<typeof BiasDetectionOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: BiasDetectionOutput = [];

const biasDetectionPrompt = ai.definePrompt({
  name: 'biasDetectionPrompt',
  input: { schema: BiasDetectionInputSchema },
  output: { schema: BiasDetectionOutputSchema },
  prompt: `You are a specialized Bias Detection Agent trained to identify cognitive biases in analytical content.

Initial Answer:
{{{initialAnswerText}}}

Supporting Research:
{{#if aggregatedSupportingResearch.length}}
{{#each aggregatedSupportingResearch}}
- Claim: "{{this.claim}}"
  Support: "{{this.support}}"
  Quality: {{this.quality}}, Source: {{this.source}}
{{/each}}
{{else}}
- No supporting research provided
{{/if}}

Counter Research:
{{#if aggregatedCounterResearch.length}}
{{#each aggregatedCounterResearch}}
- Claim: "{{this.claim}}"
  Support: "{{this.support}}"
  Quality: {{this.quality}}, Source: {{this.source}}
{{/each}}
{{else}}
- No counter research provided
{{/if}}

Your task is to identify potential cognitive biases present in the content above. Consider these common biases:

1. **Confirmation Bias**: Favoring information that confirms existing beliefs
2. **Anchoring Bias**: Over-relying on the first piece of information
3. **Availability Heuristic**: Overweighting easily recalled information
4. **Recency Bias**: Giving more weight to recent events
5. **Selection Bias**: Cherry-picking supportive evidence
6. **Framing Effect**: Being influenced by how information is presented
7. **Overconfidence Bias**: Excessive certainty in conclusions
8. **Authority Bias**: Over-relying on authoritative sources
9. **Groupthink**: Conforming to perceived consensus
10. **Status Quo Bias**: Preferring current state of affairs
11. **Sunk Cost Fallacy**: Justifying past decisions
12. **Optimism/Pessimism Bias**: Unrealistic positive/negative expectations
13. **Hindsight Bias**: Claiming predictability after the fact
14. **Correlation-Causation Fallacy**: Assuming correlation implies causation

For each bias you identify:
- Specify the exact type of bias
- Indicate where it appears (initial_answer, supporting_research, counter_research, overall_framing)
- Describe how the bias manifests
- Quote specific evidence showing the bias
- Assess severity (high/medium/low)
- Suggest how to mitigate it

Return a JSON array of bias objects. If no biases are detected, return an empty array [].

Example format:
[
  {
    "biasType": "confirmation_bias",
    "location": "supporting_research",
    "description": "Research appears to only include studies that support the initial claim",
    "evidence": "All 5 cited studies support the position, no contradictory studies mentioned",
    "severity": "high",
    "mitigationSuggestion": "Actively seek and include studies with contradictory findings"
  }
]

Return ONLY the JSON array without additional text.`,
});

export async function detectBiases(input: BiasDetectionInput): Promise<BiasDetectionOutput> {
  try {
    BiasDetectionInputSchema.parse(input);
  } catch (e: any) {
    console.error('BiasDetectionAgent: Invalid input', { error: e.message });
    return DEFAULT_OUTPUT;
  }
  
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await biasDetectionFlow(input);
      
      // Validate result
      const validation = BiasDetectionOutputSchema.safeParse(result);
      if (validation.success) {
        console.log(`BiasDetectionAgent: Identified ${validation.data.length} potential biases`);
        return validation.data;
      } else {
        console.warn(`BiasDetectionAgent: Attempt ${attempt + 1}: Output validation failed.`, {
          errors: validation.error.errors,
        });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`BiasDetectionAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
      });
      
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error('BiasDetectionAgent: Max retries reached. Returning empty bias list.');
        return DEFAULT_OUTPUT;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return DEFAULT_OUTPUT;
}

const biasDetectionFlow = ai.defineFlow(
  {
    name: 'biasDetectionFlow',
    inputSchema: BiasDetectionInputSchema,
    outputSchema: BiasDetectionOutputSchema,
  },
  async (input) => {
    const { output } = await biasDetectionPrompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
