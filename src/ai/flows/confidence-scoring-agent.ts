'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// E7: Confidence Scoring Agent - Provides transparent confidence assessment

const ConfidenceScoringInputSchema = z.object({
  pressureTestedBrief: z.any().optional(),
  aggregatedSupportingResearch: z.array(z.object({
    claim: z.string(),
    support: z.string(),
    quality: z.enum(['high', 'moderate', 'low']),
    source: z.string(),
  })),
  aggregatedCounterResearch: z.array(z.object({
    claim: z.string(),
    support: z.string(),
    quality: z.enum(['high', 'moderate', 'low']),
    source: z.string(),
  })),
  critiqueOutput: z.string(),
  biasReport: z.any().optional(),
  conflictResolutionAnalysis: z.any().optional(),
  impactAssessments: z.any().optional(),
  qualityScores: z.record(z.string(), z.number()).optional(),
});
export type ConfidenceScoringInput = z.infer<typeof ConfidenceScoringInputSchema>;

const ConfidenceScoringOutputSchema = z.object({
  overallConfidence: z.object({
    score: z.enum(['High', 'Medium', 'Low']),
    numericScore: z.number().min(0).max(100),
    rationale: z.string(),
  }),
  componentScores: z.object({
    evidenceQuality: z.object({
      score: z.number().min(0).max(100),
      breakdown: z.object({
        highQualityEvidence: z.number(),
        moderateQualityEvidence: z.number(),
        lowQualityEvidence: z.number(),
      }),
      reasoning: z.string(),
    }),
    evidenceBalance: z.object({
      score: z.number().min(0).max(100),
      supportToCounterRatio: z.string(),
      reasoning: z.string(),
    }),
    biasManagement: z.object({
      score: z.number().min(0).max(100),
      identifiedBiases: z.number(),
      addressedBiases: z.number(),
      reasoning: z.string(),
    }),
    uncertaintyHandling: z.object({
      score: z.number().min(0).max(100),
      criticalGaps: z.number(),
      riskyAssumptions: z.number(),
      reasoning: z.string(),
    }),
    analyticalRigor: z.object({
      score: z.number().min(0).max(100),
      critiqueQuality: z.enum(['strong', 'moderate', 'weak']),
      conflictResolution: z.enum(['comprehensive', 'partial', 'minimal']),
      reasoning: z.string(),
    }),
  }),
  confidenceFactors: z.object({
    strengthFactors: z.array(z.string()),
    weaknessFactors: z.array(z.string()),
    criticalLimitations: z.array(z.string()),
  }),
  recommendations: z.object({
    toIncreaseConfidence: z.array(z.string()),
    minimumRequirementsForHighConfidence: z.array(z.string()),
  }),
});
export type ConfidenceScoringOutput = z.infer<typeof ConfidenceScoringOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: ConfidenceScoringOutput = {
  overallConfidence: {
    score: 'Low',
    numericScore: 0,
    rationale: 'Confidence scoring failed',
  },
  componentScores: {
    evidenceQuality: {
      score: 0,
      breakdown: { highQualityEvidence: 0, moderateQualityEvidence: 0, lowQualityEvidence: 0 },
      reasoning: 'Unable to assess',
    },
    evidenceBalance: {
      score: 0,
      supportToCounterRatio: 'Unknown',
      reasoning: 'Unable to assess',
    },
    biasManagement: {
      score: 0,
      identifiedBiases: 0,
      addressedBiases: 0,
      reasoning: 'Unable to assess',
    },
    uncertaintyHandling: {
      score: 0,
      criticalGaps: 0,
      riskyAssumptions: 0,
      reasoning: 'Unable to assess',
    },
    analyticalRigor: {
      score: 0,
      critiqueQuality: 'weak',
      conflictResolution: 'minimal',
      reasoning: 'Unable to assess',
    },
  },
  confidenceFactors: {
    strengthFactors: [],
    weaknessFactors: ['Confidence assessment failed'],
    criticalLimitations: ['Unable to complete scoring'],
  },
  recommendations: {
    toIncreaseConfidence: [],
    minimumRequirementsForHighConfidence: [],
  },
};

const confidenceScoringPrompt = ai.definePrompt({
  name: 'confidenceScoringPrompt',
  input: { schema: ConfidenceScoringInputSchema },
  output: { schema: ConfidenceScoringOutputSchema },
  prompt: `You are a Confidence Scoring Agent providing transparent, auditable confidence assessment.

{{#if pressureTestedBrief}}
Pressure-Tested Brief:
{{{pressureTestedBrief}}}
{{/if}}

Supporting Evidence ({{aggregatedSupportingResearch.length}} pieces):
{{#each aggregatedSupportingResearch}}
- {{this.quality}} quality: {{this.claim}}
{{/each}}

Counter-Evidence ({{aggregatedCounterResearch.length}} pieces):
{{#each aggregatedCounterResearch}}
- {{this.quality}} quality: {{this.claim}}
{{/each}}

Critique Analysis:
{{{critiqueOutput}}}

{{#if biasReport}}
Bias Report:
{{{biasReport}}}
{{/if}}

{{#if conflictResolutionAnalysis}}
Conflict Resolution:
{{{conflictResolutionAnalysis}}}
{{/if}}

{{#if impactAssessments}}
Impact Assessments:
{{{impactAssessments}}}
{{/if}}

{{#if qualityScores}}
Quality Scores:
{{#each qualityScores}}
- {{@key}}: {{this}}
{{/each}}
{{/if}}

Your task is to:
1. Score confidence based on multiple dimensions
2. Provide transparent reasoning for each score
3. Calculate overall confidence with clear rationale
4. Identify specific factors affecting confidence
5. Recommend actions to increase confidence

Scoring rubric:
- Evidence Quality (0-100): High quality sources score higher
- Evidence Balance (0-100): Well-balanced evidence scores higher than one-sided
- Bias Management (0-100): Identified and addressed biases score higher
- Uncertainty Handling (0-100): Acknowledged and managed uncertainties score higher
- Analytical Rigor (0-100): Thorough critique and conflict resolution score higher

Overall confidence mapping:
- High (80-100): Strong evidence, minimal bias, uncertainties well-managed
- Medium (50-79): Reasonable evidence, some unaddressed issues
- Low (0-49): Weak evidence, significant biases or uncertainties

Return a JSON object with:
{
  "overallConfidence": {
    "score": "High|Medium|Low",
    "numericScore": 0-100,
    "rationale": "Clear explanation of overall score"
  },
  "componentScores": {
    "evidenceQuality": {
      "score": 0-100,
      "breakdown": {
        "highQualityEvidence": count,
        "moderateQualityEvidence": count,
        "lowQualityEvidence": count
      },
      "reasoning": "Why this score"
    },
    "evidenceBalance": {
      "score": 0-100,
      "supportToCounterRatio": "e.g., 3:2",
      "reasoning": "Why this score"
    },
    "biasManagement": {
      "score": 0-100,
      "identifiedBiases": count,
      "addressedBiases": count,
      "reasoning": "Why this score"
    },
    "uncertaintyHandling": {
      "score": 0-100,
      "criticalGaps": count,
      "riskyAssumptions": count,
      "reasoning": "Why this score"
    },
    "analyticalRigor": {
      "score": 0-100,
      "critiqueQuality": "strong|moderate|weak",
      "conflictResolution": "comprehensive|partial|minimal",
      "reasoning": "Why this score"
    }
  },
  "confidenceFactors": {
    "strengthFactors": ["Factor increasing confidence"],
    "weaknessFactors": ["Factor decreasing confidence"],
    "criticalLimitations": ["Major issues preventing higher confidence"]
  },
  "recommendations": {
    "toIncreaseConfidence": ["Specific action 1", "Specific action 2"],
    "minimumRequirementsForHighConfidence": ["Requirement 1", "Requirement 2"]
  }
}

Return ONLY the JSON object.`,
});

export async function scoreConfidence(input: ConfidenceScoringInput): Promise<ConfidenceScoringOutput> {
  try {
    ConfidenceScoringInputSchema.parse(input);
  } catch (e: any) {
    console.error('ConfidenceScoringAgent: Invalid input', { error: e.message });
    return DEFAULT_OUTPUT;
  }
  
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await confidenceScoringFlow(input);
      
      // Validate result
      const validation = ConfidenceScoringOutputSchema.safeParse(result);
      if (validation.success) {
        console.log(`ConfidenceScoringAgent: Scored confidence as ${validation.data.overallConfidence.score} (${validation.data.overallConfidence.numericScore}/100)`);
        return validation.data;
      } else {
        console.warn(`ConfidenceScoringAgent: Attempt ${attempt + 1}: Output validation failed.`, {
          errors: validation.error.errors,
        });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`ConfidenceScoringAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
      });
      
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error('ConfidenceScoringAgent: Max retries reached. Returning default output.');
        return DEFAULT_OUTPUT;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return DEFAULT_OUTPUT;
}

const confidenceScoringFlow = ai.defineFlow(
  {
    name: 'confidenceScoringFlow',
    inputSchema: ConfidenceScoringInputSchema,
    outputSchema: ConfidenceScoringOutputSchema,
  },
  async (input) => {
    const { output } = await confidenceScoringPrompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
