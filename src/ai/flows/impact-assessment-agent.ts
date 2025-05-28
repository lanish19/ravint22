'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// F6 Part 1: Impact Assessment Agent - Assesses impact of gaps and assumptions

const ImpactAssessmentInputSchema = z.object({
  informationGaps: z.array(z.object({
    gap: z.string(),
    impact: z.enum(['High', 'Medium', 'Low']),
  })),
  assumptions: z.array(z.object({
    assumption: z.string(),
    risk: z.enum(['High', 'Medium', 'Low']),
    alternative: z.string(),
  })),
});
export type ImpactAssessmentInput = z.infer<typeof ImpactAssessmentInputSchema>;

const ImpactAssessmentOutputSchema = z.object({
  impactAssessments: z.object({
    overallImpactSummary: z.string(),
    criticalGapImpacts: z.array(z.object({
      gap: z.string(),
      originalImpactRating: z.enum(['High', 'Medium', 'Low']),
      detailedImpact: z.string(),
      consequencesIfUnfilled: z.array(z.string()),
      confidenceEffect: z.enum(['severe_reduction', 'moderate_reduction', 'minor_reduction']),
      mitigationStrategies: z.array(z.string()),
    })),
    criticalAssumptionImpacts: z.array(z.object({
      assumption: z.string(),
      originalRiskRating: z.enum(['High', 'Medium', 'Low']),
      detailedImpact: z.string(),
      consequencesIfFalse: z.array(z.string()),
      probabilityOfBeingFalse: z.enum(['high', 'medium', 'low']),
      cascadingEffects: z.array(z.string()),
    })),
    compoundedRisks: z.array(z.object({
      description: z.string(),
      riskLevel: z.enum(['critical', 'high', 'medium', 'low']),
      scenario: z.string(),
    })),
  }),
  recommendedActions: z.array(z.object({
    action: z.string(),
    priority: z.enum(['immediate', 'high', 'medium', 'low']),
    addressesGaps: z.array(z.string()),
    addressesAssumptions: z.array(z.string()),
  })),
  confidenceCeiling: z.object({
    maxConfidenceGivenGaps: z.enum(['High', 'Medium', 'Low']),
    reasoning: z.string(),
  }),
});
export type ImpactAssessmentOutput = z.infer<typeof ImpactAssessmentOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: ImpactAssessmentOutput = {
  impactAssessments: {
    overallImpactSummary: 'Unable to assess impact',
    criticalGapImpacts: [],
    criticalAssumptionImpacts: [],
    compoundedRisks: [],
  },
  recommendedActions: [],
  confidenceCeiling: {
    maxConfidenceGivenGaps: 'Low',
    reasoning: 'Impact assessment failed',
  },
};

const impactAssessmentPrompt = ai.definePrompt({
  name: 'impactAssessmentPrompt',
  input: { schema: ImpactAssessmentInputSchema },
  output: { schema: ImpactAssessmentOutputSchema },
  prompt: `You are an Impact Assessment Agent evaluating the consequences of information gaps and assumptions.

Information Gaps:
{{#each informationGaps}}
- Gap: "{{this.gap}}" (Impact: {{this.impact}})
{{/each}}

Assumptions:
{{#each assumptions}}
- Assumption: "{{this.assumption}}" (Risk: {{this.risk}})
  Alternative: "{{this.alternative}}"
{{/each}}

Your task is to:
1. Assess the ACTUAL CONSEQUENCES if gaps remain unfilled
2. Evaluate what happens if critical assumptions prove false
3. Identify compound risks from multiple gaps/assumptions
4. Determine the maximum reasonable confidence given these limitations
5. Recommend specific actions to address the most critical issues

For each high-impact gap or high-risk assumption:
- Describe specific, concrete consequences
- Explain how it affects the overall analysis
- Consider cascading effects
- Suggest mitigation strategies

Assessment guidelines:
- Be specific about impacts (not just "reduces confidence")
- Consider worst-case scenarios for critical items
- Identify which gaps/assumptions interact to create larger risks
- Prioritize what MUST be addressed vs. nice-to-have

Return a JSON object with:
{
  "impactAssessments": {
    "overallImpactSummary": "Executive summary of combined impact",
    "criticalGapImpacts": [
      {
        "gap": "The information gap",
        "originalImpactRating": "High|Medium|Low",
        "detailedImpact": "Specific description of impact",
        "consequencesIfUnfilled": ["Consequence 1", "Consequence 2"],
        "confidenceEffect": "severe_reduction|moderate_reduction|minor_reduction",
        "mitigationStrategies": ["Strategy 1", "Strategy 2"]
      }
    ],
    "criticalAssumptionImpacts": [
      {
        "assumption": "The assumption",
        "originalRiskRating": "High|Medium|Low",
        "detailedImpact": "What happens if this is false",
        "consequencesIfFalse": ["Consequence 1", "Consequence 2"],
        "probabilityOfBeingFalse": "high|medium|low",
        "cascadingEffects": ["Effect 1", "Effect 2"]
      }
    ],
    "compoundedRisks": [
      {
        "description": "Description of compound risk",
        "riskLevel": "critical|high|medium|low",
        "scenario": "Scenario where multiple issues combine"
      }
    ]
  },
  "recommendedActions": [
    {
      "action": "Specific action to take",
      "priority": "immediate|high|medium|low",
      "addressesGaps": ["Gap 1", "Gap 2"],
      "addressesAssumptions": ["Assumption 1"]
    }
  ],
  "confidenceCeiling": {
    "maxConfidenceGivenGaps": "High|Medium|Low",
    "reasoning": "Why confidence cannot be higher given current limitations"
  }
}

Return ONLY the JSON object.`,
});

export async function assessImpact(input: ImpactAssessmentInput): Promise<ImpactAssessmentOutput> {
  try {
    ImpactAssessmentInputSchema.parse(input);
  } catch (e: any) {
    console.error('ImpactAssessmentAgent: Invalid input', { error: e.message });
    return DEFAULT_OUTPUT;
  }
  
  // Handle empty inputs
  const hasGaps = input.informationGaps && input.informationGaps.length > 0;
  const hasAssumptions = input.assumptions && input.assumptions.length > 0;
  
  if (!hasGaps && !hasAssumptions) {
    console.log('ImpactAssessmentAgent: No gaps or assumptions to assess');
    return {
      impactAssessments: {
        overallImpactSummary: 'No significant information gaps or risky assumptions identified',
        criticalGapImpacts: [],
        criticalAssumptionImpacts: [],
        compoundedRisks: [],
      },
      recommendedActions: [],
      confidenceCeiling: {
        maxConfidenceGivenGaps: 'High',
        reasoning: 'No critical limitations identified',
      },
    };
  }
  
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await impactAssessmentFlow(input);
      
      // Validate result
      const validation = ImpactAssessmentOutputSchema.safeParse(result);
      if (validation.success) {
        console.log(`ImpactAssessmentAgent: Assessed impact with confidence ceiling of ${validation.data.confidenceCeiling.maxConfidenceGivenGaps}`);
        return validation.data;
      } else {
        console.warn(`ImpactAssessmentAgent: Attempt ${attempt + 1}: Output validation failed.`, {
          errors: validation.error.errors,
        });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`ImpactAssessmentAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
      });
      
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error('ImpactAssessmentAgent: Max retries reached. Returning default output.');
        return DEFAULT_OUTPUT;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return DEFAULT_OUTPUT;
}

const impactAssessmentFlow = ai.defineFlow(
  {
    name: 'impactAssessmentFlow',
    inputSchema: ImpactAssessmentInputSchema,
    outputSchema: ImpactAssessmentOutputSchema,
  },
  async (input) => {
    const { output } = await impactAssessmentPrompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
