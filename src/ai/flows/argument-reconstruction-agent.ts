'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// F2 Part 1: Argument Reconstruction Agent - Creates neutral summary to counter anchoring bias

const ArgumentReconstructionInputSchema = z.object({
  initialAnswerText: z.string(),
  stressTestedArgument: z.string().optional(),
  critiqueOutput: z.string(),
  challengeOutput: z.array(z.string()),
  aggregatedCounterResearch: z.array(z.object({
    claim: z.string(),
    support: z.string(),
    quality: z.enum(['high', 'moderate', 'low']),
    source: z.string(),
  })),
});
export type ArgumentReconstructionInput = z.infer<typeof ArgumentReconstructionInputSchema>;

const ArgumentReconstructionOutputSchema = z.object({
  balancedBrief: z.object({
    neutralSummary: z.string().describe('Neutral summary of the argument state'),
    keyPositions: z.array(z.object({
      position: z.string(),
      supportLevel: z.enum(['strong', 'moderate', 'weak']),
      evidence: z.array(z.string()),
    })),
    majorCritiques: z.array(z.object({
      critique: z.string(),
      severity: z.enum(['high', 'medium', 'low']),
      addressed: z.boolean(),
    })),
    counterPositions: z.array(z.object({
      position: z.string(),
      evidence: z.string(),
      strength: z.enum(['strong', 'moderate', 'weak']),
    })),
    unresolved: z.array(z.string()).describe('Unresolved points of contention'),
  }),
  reconstructionApproach: z.string().describe('How the brief was constructed to maintain neutrality'),
  biasCheckResults: z.object({
    anchoringBiasRisk: z.enum(['high', 'medium', 'low']),
    mitigationApplied: z.array(z.string()),
  }),
});
export type ArgumentReconstructionOutput = z.infer<typeof ArgumentReconstructionOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: ArgumentReconstructionOutput = {
  balancedBrief: {
    neutralSummary: 'Unable to reconstruct argument',
    keyPositions: [],
    majorCritiques: [],
    counterPositions: [],
    unresolved: [],
  },
  reconstructionApproach: 'Reconstruction failed',
  biasCheckResults: {
    anchoringBiasRisk: 'high',
    mitigationApplied: [],
  },
};

const argumentReconstructionPrompt = ai.definePrompt({
  name: 'argumentReconstructionPrompt',
  input: { schema: ArgumentReconstructionInputSchema },
  output: { schema: ArgumentReconstructionOutputSchema },
  prompt: `You are an Argument Reconstruction Agent tasked with creating a neutral, balanced brief to prevent anchoring bias.

Initial Answer:
{{{initialAnswerText}}}

{{#if stressTestedArgument}}
Stress-Tested Version:
{{{stressTestedArgument}}}
{{/if}}

Critique:
{{{critiqueOutput}}}

Challenges:
{{#each challengeOutput}}
- {{this}}
{{/each}}

Counter-Evidence:
{{#each aggregatedCounterResearch}}
- Against "{{this.claim}}": {{this.support}} ({{this.quality}}, {{this.source}})
{{/each}}

Your task is to:
1. Create a NEUTRAL summary that doesn't favor the initial answer
2. Present all viewpoints with equal weight initially
3. Structure information to prevent the synthesis agent from anchoring on the initial answer
4. Identify which critiques have been addressed vs. remain open
5. Clearly separate positions, evidence, and challenges

Guidelines for neutrality:
- Don't lead with the initial answer's conclusions
- Present competing viewpoints side-by-side
- Use neutral language (avoid "however", "despite", "although" when transitioning between viewpoints)
- Let evidence speak for itself without editorial commentary
- Structure the brief to encourage fresh analysis

Return a JSON object with:
{
  "balancedBrief": {
    "neutralSummary": "A neutral overview of the topic and competing viewpoints",
    "keyPositions": [
      {
        "position": "Position or claim",
        "supportLevel": "strong|moderate|weak",
        "evidence": ["Evidence point 1", "Evidence point 2"]
      }
    ],
    "majorCritiques": [
      {
        "critique": "The critique point",
        "severity": "high|medium|low",
        "addressed": true/false
      }
    ],
    "counterPositions": [
      {
        "position": "Alternative view or counter-claim",
        "evidence": "Supporting evidence",
        "strength": "strong|moderate|weak"
      }
    ],
    "unresolved": ["Unresolved issue 1", "Unresolved issue 2"]
  },
  "reconstructionApproach": "Explanation of how neutrality was maintained",
  "biasCheckResults": {
    "anchoringBiasRisk": "high|medium|low",
    "mitigationApplied": ["Mitigation strategy 1", "Mitigation strategy 2"]
  }
}

Return ONLY the JSON object.`,
});

export async function reconstructArgument(input: ArgumentReconstructionInput): Promise<ArgumentReconstructionOutput> {
  try {
    ArgumentReconstructionInputSchema.parse(input);
  } catch (e: any) {
    console.error('ArgumentReconstructionAgent: Invalid input', { error: e.message });
    return DEFAULT_OUTPUT;
  }
  
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await argumentReconstructionFlow(input);
      
      // Validate result
      const validation = ArgumentReconstructionOutputSchema.safeParse(result);
      if (validation.success) {
        console.log('ArgumentReconstructionAgent: Successfully created balanced brief');
        return validation.data;
      } else {
        console.warn(`ArgumentReconstructionAgent: Attempt ${attempt + 1}: Output validation failed.`, {
          errors: validation.error.errors,
        });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`ArgumentReconstructionAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
      });
      
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error('ArgumentReconstructionAgent: Max retries reached. Returning default output.');
        return DEFAULT_OUTPUT;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return DEFAULT_OUTPUT;
}

const argumentReconstructionFlow = ai.defineFlow(
  {
    name: 'argumentReconstructionFlow',
    inputSchema: ArgumentReconstructionInputSchema,
    outputSchema: ArgumentReconstructionOutputSchema,
  },
  async (input) => {
    const { output } = await argumentReconstructionPrompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
