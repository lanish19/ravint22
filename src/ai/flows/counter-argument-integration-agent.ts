'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// F3 Part 1: Counter-Argument Integration Agent - Ensures counter-evidence is deeply integrated

const CounterArgumentIntegrationInputSchema = z.object({
  balancedBrief: z.any(), // From ArgumentReconstructionAgent
  aggregatedCounterResearch: z.array(z.object({
    claim: z.string(),
    support: z.string(),
    quality: z.enum(['high', 'moderate', 'low']),
    source: z.string(),
  })),
  challengeOutput: z.array(z.string()),
});
export type CounterArgumentIntegrationInput = z.infer<typeof CounterArgumentIntegrationInputSchema>;

const CounterArgumentIntegrationOutputSchema = z.object({
  pressureTestedBrief: z.object({
    integratedSummary: z.string().describe('Summary with counter-arguments deeply integrated'),
    claimsAndCounterclaims: z.array(z.object({
      originalClaim: z.string(),
      counterClaim: z.string(),
      resolution: z.enum(['counter_stronger', 'original_stronger', 'both_valid', 'requires_more_evidence']),
      integratedPosition: z.string(),
      confidenceImpact: z.enum(['increases', 'decreases', 'neutral']),
    })),
    revisedPositions: z.array(z.object({
      originalPosition: z.string(),
      revisedPosition: z.string(),
      revisionReason: z.string(),
    })),
    strengthenedPoints: z.array(z.string()).describe('Points strengthened by addressing counter-arguments'),
    invalidatedPoints: z.array(z.string()).describe('Points invalidated by counter-evidence'),
  }),
  integrationMetrics: z.object({
    counterEvidenceAddressed: z.number().describe('Percentage of counter-evidence addressed'),
    challengesIntegrated: z.number().describe('Percentage of challenges integrated'),
    positionsRevised: z.number().describe('Number of positions revised'),
  }),
  integrationQuality: z.enum(['comprehensive', 'substantial', 'partial', 'minimal']),
});
export type CounterArgumentIntegrationOutput = z.infer<typeof CounterArgumentIntegrationOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: CounterArgumentIntegrationOutput = {
  pressureTestedBrief: {
    integratedSummary: 'Unable to integrate counter-arguments',
    claimsAndCounterclaims: [],
    revisedPositions: [],
    strengthenedPoints: [],
    invalidatedPoints: [],
  },
  integrationMetrics: {
    counterEvidenceAddressed: 0,
    challengesIntegrated: 0,
    positionsRevised: 0,
  },
  integrationQuality: 'minimal',
};

const counterArgumentIntegrationPrompt = ai.definePrompt({
  name: 'counterArgumentIntegrationPrompt',
  input: { schema: CounterArgumentIntegrationInputSchema },
  output: { schema: CounterArgumentIntegrationOutputSchema },
  prompt: `You are a Counter-Argument Integration Agent ensuring counter-evidence is deeply integrated, not superficially acknowledged.

Balanced Brief:
{{{balancedBrief}}}

Counter-Evidence:
{{#each aggregatedCounterResearch}}
- Against "{{this.claim}}": {{this.support}} ({{this.quality}}, {{this.source}})
{{/each}}

Challenges:
{{#each challengeOutput}}
- {{this}}
{{/each}}

Your task is to:
1. Take each counter-argument and challenge seriously
2. Explicitly show how counter-evidence modifies or refutes original claims
3. Revise positions based on the strength of counter-evidence
4. Create an integrated narrative that incorporates all viewpoints
5. Identify which original points are strengthened, weakened, or invalidated

Integration principles:
- Don't just list counter-evidence; show how it changes conclusions
- When counter-evidence is strong, revise the position accordingly
- Identify synthesis opportunities where opposing views can be reconciled
- Be explicit about confidence changes based on counter-evidence
- Maintain intellectual honesty about what the evidence actually supports

For each major claim:
- Present the original claim
- Present the counter-claim with its evidence
- Analyze which is stronger and why
- Provide an integrated position that accounts for both

Return a JSON object with:
{
  "pressureTestedBrief": {
    "integratedSummary": "A summary that fully incorporates counter-arguments",
    "claimsAndCounterclaims": [
      {
        "originalClaim": "The original claim",
        "counterClaim": "The counter-claim",
        "resolution": "counter_stronger|original_stronger|both_valid|requires_more_evidence",
        "integratedPosition": "The position after considering both sides",
        "confidenceImpact": "increases|decreases|neutral"
      }
    ],
    "revisedPositions": [
      {
        "originalPosition": "Original position",
        "revisedPosition": "Revised position after counter-evidence",
        "revisionReason": "Why the revision was made"
      }
    ],
    "strengthenedPoints": ["Points that survived counter-arguments"],
    "invalidatedPoints": ["Points that were refuted"]
  },
  "integrationMetrics": {
    "counterEvidenceAddressed": 0-100,
    "challengesIntegrated": 0-100,
    "positionsRevised": number
  },
  "integrationQuality": "comprehensive|substantial|partial|minimal"
}

Return ONLY the JSON object.`,
});

export async function integrateCounterArguments(input: CounterArgumentIntegrationInput): Promise<CounterArgumentIntegrationOutput> {
  try {
    CounterArgumentIntegrationInputSchema.parse(input);
  } catch (e: any) {
    console.error('CounterArgumentIntegrationAgent: Invalid input', { error: e.message });
    return DEFAULT_OUTPUT;
  }
  
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await counterArgumentIntegrationFlow(input);
      
      // Validate result
      const validation = CounterArgumentIntegrationOutputSchema.safeParse(result);
      if (validation.success) {
        console.log(`CounterArgumentIntegrationAgent: Integrated counter-arguments with ${validation.data.integrationQuality} quality`);
        return validation.data;
      } else {
        console.warn(`CounterArgumentIntegrationAgent: Attempt ${attempt + 1}: Output validation failed.`, {
          errors: validation.error.errors,
        });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`CounterArgumentIntegrationAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
      });
      
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error('CounterArgumentIntegrationAgent: Max retries reached. Returning default output.');
        return DEFAULT_OUTPUT;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return DEFAULT_OUTPUT;
}

const counterArgumentIntegrationFlow = ai.defineFlow(
  {
    name: 'counterArgumentIntegrationFlow',
    inputSchema: CounterArgumentIntegrationInputSchema,
    outputSchema: CounterArgumentIntegrationOutputSchema,
  },
  async (input) => {
    const { output } = await counterArgumentIntegrationPrompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
