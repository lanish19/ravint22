'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// E12: Evidence Conflict Resolution Agent - Identifies and resolves conflicting evidence

const EvidenceItemSchema = z.object({
  claim: z.string(),
  support: z.string(),
  quality: z.enum(['high', 'moderate', 'low']),
  source: z.string(),
});

const EvidenceConflictResolutionInputSchema = z.object({
  aggregatedSupportingResearch: z.array(EvidenceItemSchema),
  aggregatedCounterResearch: z.array(EvidenceItemSchema),
});
export type EvidenceConflictResolutionInput = z.infer<typeof EvidenceConflictResolutionInputSchema>;

const ConflictItemSchema = z.object({
  conflictType: z.enum(['direct_contradiction', 'partial_disagreement', 'different_interpretation', 'scope_mismatch', 'temporal_difference']),
  supportingEvidence: z.object({
    claim: z.string(),
    support: z.string(),
    source: z.string(),
  }),
  counterEvidence: z.object({
    claim: z.string(),
    support: z.string(),
    source: z.string(),
  }),
  conflictDescription: z.string(),
  possibleExplanations: z.array(z.string()),
  reliabilityAssessment: z.object({
    moreReliable: z.enum(['supporting', 'counter', 'equal']),
    reasoning: z.string(),
  }),
  impactOnAnalysis: z.enum(['critical', 'significant', 'moderate', 'minor']),
  resolutionSuggestion: z.string(),
});

const EvidenceConflictResolutionOutputSchema = z.object({
  identifiedConflicts: z.array(ConflictItemSchema),
  totalConflictsFound: z.number(),
  criticalConflicts: z.array(z.string()).describe('Summary of conflicts with critical impact'),
  overallReliabilityAssessment: z.string(),
  synthesisGuidance: z.string().describe('Guidance for synthesis agent on handling conflicts'),
});
export type EvidenceConflictResolutionOutput = z.infer<typeof EvidenceConflictResolutionOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: EvidenceConflictResolutionOutput = {
  identifiedConflicts: [],
  totalConflictsFound: 0,
  criticalConflicts: [],
  overallReliabilityAssessment: 'Unable to assess evidence reliability',
  synthesisGuidance: 'Evidence conflict analysis was not completed',
};

const evidenceConflictResolutionPrompt = ai.definePrompt({
  name: 'evidenceConflictResolutionPrompt',
  input: { schema: EvidenceConflictResolutionInputSchema },
  output: { schema: EvidenceConflictResolutionOutputSchema },
  prompt: `You are an Evidence Conflict Resolution Agent tasked with identifying and analyzing conflicting evidence.

Supporting Evidence:
{{#each aggregatedSupportingResearch}}
[S{{@index}}] Claim: "{{this.claim}}"
    Support: "{{this.support}}"
    Quality: {{this.quality}}, Source: {{this.source}}
{{/each}}

Counter Evidence:
{{#each aggregatedCounterResearch}}
[C{{@index}}] Claim: "{{this.claim}}"
    Support: "{{this.support}}"
    Quality: {{this.quality}}, Source: {{this.source}}
{{/each}}

Your task is to:
1. Identify pairs or sets of evidence that conflict with each other
2. Classify the type of conflict (direct contradiction, partial disagreement, etc.)
3. Explain the nature of each conflict
4. Suggest possible explanations for the discrepancy
5. Assess which evidence is more reliable and why
6. Determine the impact on the overall analysis
7. Suggest how to resolve or account for the conflict

Types of conflicts to look for:
- **Direct Contradiction**: Claims that cannot both be true
- **Partial Disagreement**: Evidence that agrees on some points but not others
- **Different Interpretation**: Same data interpreted differently
- **Scope Mismatch**: Evidence addressing different scopes of the same issue
- **Temporal Difference**: Evidence from different time periods

For reliability assessment, consider:
- Source credibility and expertise
- Evidence quality ratings
- Recency of data
- Methodology strength
- Potential biases

Return a JSON object with this structure:
{
  "identifiedConflicts": [
    {
      "conflictType": "direct_contradiction",
      "supportingEvidence": {
        "claim": "The claim from supporting evidence",
        "support": "The supporting details",
        "source": "The source"
      },
      "counterEvidence": {
        "claim": "The conflicting claim",
        "support": "The counter details", 
        "source": "The counter source"
      },
      "conflictDescription": "Clear explanation of how these conflict",
      "possibleExplanations": [
        "Explanation 1 for the discrepancy",
        "Explanation 2"
      ],
      "reliabilityAssessment": {
        "moreReliable": "supporting|counter|equal",
        "reasoning": "Why one is more reliable"
      },
      "impactOnAnalysis": "critical|significant|moderate|minor",
      "resolutionSuggestion": "How to handle this conflict in synthesis"
    }
  ],
  "totalConflictsFound": 0,
  "criticalConflicts": ["Brief summary of critical conflict 1"],
  "overallReliabilityAssessment": "Summary of evidence reliability patterns",
  "synthesisGuidance": "Overall guidance for handling these conflicts in synthesis"
}

Return ONLY the JSON object.`,
});

export async function resolveEvidenceConflicts(input: EvidenceConflictResolutionInput): Promise<EvidenceConflictResolutionOutput> {
  try {
    EvidenceConflictResolutionInputSchema.parse(input);
  } catch (e: any) {
    console.error('EvidenceConflictResolutionAgent: Invalid input', { error: e.message });
    return DEFAULT_OUTPUT;
  }
  
  // Handle case with no evidence
  if ((!input.aggregatedSupportingResearch || input.aggregatedSupportingResearch.length === 0) &&
      (!input.aggregatedCounterResearch || input.aggregatedCounterResearch.length === 0)) {
    console.log('EvidenceConflictResolutionAgent: No evidence provided to analyze');
    return {
      identifiedConflicts: [],
      totalConflictsFound: 0,
      criticalConflicts: [],
      overallReliabilityAssessment: 'No evidence provided for conflict analysis',
      synthesisGuidance: 'No evidence conflicts to consider',
    };
  }
  
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await evidenceConflictResolutionFlow(input);
      
      // Validate result
      const validation = EvidenceConflictResolutionOutputSchema.safeParse(result);
      if (validation.success) {
        console.log(`EvidenceConflictResolutionAgent: Identified ${validation.data.totalConflictsFound} conflicts`);
        return validation.data;
      } else {
        console.warn(`EvidenceConflictResolutionAgent: Attempt ${attempt + 1}: Output validation failed.`, {
          errors: validation.error.errors,
        });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`EvidenceConflictResolutionAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
      });
      
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error('EvidenceConflictResolutionAgent: Max retries reached. Returning default output.');
        return DEFAULT_OUTPUT;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return DEFAULT_OUTPUT;
}

const evidenceConflictResolutionFlow = ai.defineFlow(
  {
    name: 'evidenceConflictResolutionFlow',
    inputSchema: EvidenceConflictResolutionInputSchema,
    outputSchema: EvidenceConflictResolutionOutputSchema,
  },
  async (input) => {
    const { output } = await evidenceConflictResolutionPrompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
