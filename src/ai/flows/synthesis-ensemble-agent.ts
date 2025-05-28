'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// E14/F7: Synthesis Ensemble - Multi-perspective synthesis with parallel processing

const SynthesisEnsembleInputSchema = z.object({
  pressureTestedBrief: z.string().optional(),
  balancedBrief: z.string().optional(),
  initialAnswerText: z.string(),
  impactAssessments: z.string().optional(),
  overallConfidence: z.object({
    score: z.enum(['High', 'Medium', 'Low']),
    rationale: z.string(),
  }).optional(),
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
  conflictResolutionAnalysis: z.any().optional(),
  sensitivityAnalysisReport: z.string().optional(),
  errorsEncountered: z.array(z.object({
    agent: z.string(),
    error: z.string(),
  })).optional().default([]),
});
export type SynthesisEnsembleInput = z.infer<typeof SynthesisEnsembleInputSchema>;

const SynthesisPerspectiveSchema = z.object({
  perspectiveType: z.enum(['most_likely', 'worst_case', 'best_case', 'high_agreement_focus', 'high_disagreement_focus', 'balanced']),
  confidence: z.enum(['High', 'Medium', 'Low']),
  summary: z.string(),
  keyStrengths: z.array(z.string()),
  keyWeaknesses: z.array(z.string()),
  howCounterEvidenceWasAddressed: z.array(z.string()),
  actionableRecommendations: z.array(z.string()),
  remainingUncertainties: z.array(z.string()),
  criticalAssumptions: z.array(z.string()).optional(),
});

const SynthesisEnsembleOutputSchema = z.object({
  individualPerspectives: z.array(SynthesisPerspectiveSchema),
  metaSynthesis: z.object({
    confidence: z.enum(['High', 'Medium', 'Low']),
    summary: z.string(),
    keyStrengths: z.array(z.string()),
    keyWeaknesses: z.array(z.string()),
    howCounterEvidenceWasAddressed: z.array(z.string()),
    actionableRecommendations: z.array(z.string()),
    remainingUncertainties: z.array(z.string()),
    perspectiveDivergence: z.string().describe('Analysis of where perspectives differed'),
    synthesisApproach: z.string().describe('How perspectives were integrated'),
  }),
  errorHandling: z.object({
    criticalFailuresDetected: z.boolean(),
    failureImpactDescription: z.string().optional(),
    confidenceAdjustmentReason: z.string().optional(),
  }),
});
export type SynthesisEnsembleOutput = z.infer<typeof SynthesisEnsembleOutputSchema>;

// Individual perspective synthesizer prompts
const createPerspectivePrompt = (perspectiveType: string, perspectiveInstructions: string) => 
  ai.definePrompt({
    name: `synthesis${perspectiveType}Prompt`,
    input: { schema: SynthesisEnsembleInputSchema },
    output: { schema: SynthesisPerspectiveSchema },
    prompt: `You are a synthesis agent with a ${perspectiveType} perspective.

${perspectiveInstructions}

Inputs to synthesize:
{{#if pressureTestedBrief}}
Pressure-Tested Brief: {{{pressureTestedBrief}}}
{{else if balancedBrief}}
Balanced Brief: {{{balancedBrief}}}
{{else}}
Initial Answer: {{{initialAnswerText}}}
{{/if}}

{{#if impactAssessments}}
Impact Assessments: {{{impactAssessments}}}
{{/if}}

{{#if overallConfidence}}
Confidence Assessment: {{overallConfidence.score}} - {{overallConfidence.rationale}}
{{/if}}

Supporting Evidence:
{{#each aggregatedSupportingResearch}}
- {{this.claim}}: {{this.support}} ({{this.quality}}, {{this.source}})
{{/each}}

Counter-Evidence:
{{#each aggregatedCounterResearch}}
- {{this.claim}}: {{this.support}} ({{this.quality}}, {{this.source}})
{{/each}}

{{#if conflictResolutionAnalysis}}
Conflict Analysis: {{{conflictResolutionAnalysis}}}
{{/if}}

{{#if sensitivityAnalysisReport}}
Sensitivity Analysis: {{{sensitivityAnalysisReport}}}
{{/if}}

{{#if errorsEncountered.length}}
IMPORTANT - Critical Errors Encountered:
{{#each errorsEncountered}}
- {{this.agent}}: {{this.error}}
{{/each}}
If critical data is missing, state that comprehensive synthesis is not possible and explain the impact.
{{/if}}

Create a synthesis that:
1. Integrates all available information from your perspective
2. EXPLICITLY addresses counter-evidence (don't just list it, explain how it affects conclusions)
3. Accounts for identified conflicts and uncertainties
4. Provides actionable recommendations based on your perspective
5. Clearly states remaining uncertainties and their impact
6. Adjusts confidence based on errors or missing data

Return a JSON object with:
{
  "perspectiveType": "${perspectiveType}",
  "confidence": "High|Medium|Low",
  "summary": "Your synthesized summary from this perspective",
  "keyStrengths": ["Strength 1", "Strength 2"],
  "keyWeaknesses": ["Weakness 1", "Weakness 2"],
  "howCounterEvidenceWasAddressed": [
    "Specific explanation of how counter-evidence X was integrated",
    "How counter-evidence Y modified conclusion Z"
  ],
  "actionableRecommendations": ["Recommendation 1", "Recommendation 2"],
  "remainingUncertainties": ["Uncertainty 1", "Uncertainty 2"],
  "criticalAssumptions": ["Assumption 1", "Assumption 2"]
}

Return ONLY the JSON object.`,
  });

// Define different perspective prompts
const perspectiveDefinitions = [
  {
    type: 'most_likely',
    instructions: 'Focus on the most probable outcomes based on evidence weight and historical patterns. Be realistic and grounded.',
  },
  {
    type: 'worst_case',
    instructions: 'Focus on potential negative outcomes and risks. Consider what could go wrong and emphasize caution.',
  },
  {
    type: 'best_case',
    instructions: 'Focus on positive potential and opportunities. Be optimistic but still evidence-based.',
  },
  {
    type: 'high_agreement_focus',
    instructions: 'Focus on areas where evidence strongly agrees and build conclusions from points of consensus.',
  },
  {
    type: 'high_disagreement_focus',
    instructions: 'Focus on areas of conflict and disagreement. Highlight where evidence diverges and uncertainty is highest.',
  },
];

// Meta-synthesis prompt
const metaSynthesisPrompt = ai.definePrompt({
  name: 'metaSynthesisPrompt',
  input: { 
    schema: z.object({
      perspectives: z.array(SynthesisPerspectiveSchema),
      originalInput: SynthesisEnsembleInputSchema,
    })
  },
  output: { schema: SynthesisEnsembleOutputSchema },
  prompt: `You are the Meta-Synthesis Agent reviewing multiple perspective syntheses.

Individual Perspectives:
{{#each perspectives}}
{{this.perspectiveType}} Perspective (Confidence: {{this.confidence}}):
- Summary: {{this.summary}}
- Key Strengths: {{#each this.keyStrengths}}{{this}}, {{/each}}
- Key Weaknesses: {{#each this.keyWeaknesses}}{{this}}, {{/each}}
- Counter-Evidence Handling: {{#each this.howCounterEvidenceWasAddressed}}{{this}}; {{/each}}
{{/each}}

Your task is to:
1. Review all perspective syntheses
2. Identify where they agree and diverge
3. Create a final meta-synthesis that best represents the overall analysis
4. Explain how you integrated different perspectives
5. Note any critical failures that affected the synthesis

Consider:
- Which perspectives align with the evidence best?
- Where do perspectives critically diverge and why?
- What's the most balanced and defensible position?
- How should conflicting perspectives be weighted?

Return a complete SynthesisEnsembleOutput JSON including:
- The individual perspectives array (pass through)
- Your metaSynthesis object
- Error handling information

Return ONLY the JSON object.`,
});

const RETRY_ATTEMPTS = 2;
const DEFAULT_OUTPUT: SynthesisEnsembleOutput = {
  individualPerspectives: [],
  metaSynthesis: {
    confidence: 'Low',
    summary: 'Synthesis ensemble failed to generate comprehensive analysis',
    keyStrengths: [],
    keyWeaknesses: ['Multiple synthesis attempts failed'],
    howCounterEvidenceWasAddressed: ['Unable to process counter-evidence due to errors'],
    actionableRecommendations: [],
    remainingUncertainties: ['Complete synthesis was not possible'],
    perspectiveDivergence: 'Unable to analyze perspective differences',
    synthesisApproach: 'Synthesis failed',
  },
  errorHandling: {
    criticalFailuresDetected: true,
    failureImpactDescription: 'Synthesis ensemble encountered critical errors',
  },
};

export async function runSynthesisEnsemble(input: SynthesisEnsembleInput): Promise<SynthesisEnsembleOutput> {
  try {
    SynthesisEnsembleInputSchema.parse(input);
  } catch (e: any) {
    console.error('SynthesisEnsembleAgent: Invalid input', { error: e.message });
    return DEFAULT_OUTPUT;
  }
  
  // Check for critical errors that would prevent synthesis
  const criticalErrors = input.errorsEncountered.filter(e => 
    e.agent.includes('Critical') || 
    e.agent.includes('Responder') ||
    e.error.includes('Critical')
  );
  
  if (criticalErrors.length > 0) {
    console.warn('SynthesisEnsembleAgent: Critical errors detected, adjusting synthesis approach');
  }
  
  const perspectives: z.infer<typeof SynthesisPerspectiveSchema>[] = [];
  
  // Generate individual perspectives in parallel
  console.log('SynthesisEnsembleAgent: Generating multiple perspective syntheses...');
  
  const perspectivePromises = perspectiveDefinitions.map(async (def) => {
    for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
      try {
        const prompt = createPerspectivePrompt(def.type, def.instructions);
        const { output } = await prompt(input);
        
        if (output) {
          console.log(`SynthesisEnsembleAgent: Generated ${def.type} perspective`);
          return output;
        }
      } catch (error: any) {
        console.error(`SynthesisEnsembleAgent: Error generating ${def.type} perspective (attempt ${attempt + 1})`, {
          error: error.message,
        });
        
        if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    // Return a minimal perspective if generation fails
    return {
      perspectiveType: def.type as any,
      confidence: 'Low' as const,
      summary: `Failed to generate ${def.type} perspective`,
      keyStrengths: [],
      keyWeaknesses: ['Perspective generation failed'],
      howCounterEvidenceWasAddressed: [],
      actionableRecommendations: [],
      remainingUncertainties: ['Perspective could not be generated'],
    };
  });
  
  const generatedPerspectives = await Promise.all(perspectivePromises);
  perspectives.push(...generatedPerspectives);
  
  // Run meta-synthesis
  console.log('SynthesisEnsembleAgent: Running meta-synthesis...');
  
  try {
    const { output } = await metaSynthesisPrompt({
      perspectives,
      originalInput: input,
    });
    
    if (output) {
      return output;
    }
  } catch (error: any) {
    console.error('SynthesisEnsembleAgent: Meta-synthesis failed', { error: error.message });
  }
  
  // If meta-synthesis fails, return best individual perspective
  const bestPerspective = perspectives.find(p => p.confidence === 'High') || 
                         perspectives.find(p => p.confidence === 'Medium') ||
                         perspectives[0];
  
  if (bestPerspective) {
    return {
      individualPerspectives: perspectives,
      metaSynthesis: {
        ...bestPerspective,
        perspectiveDivergence: 'Meta-synthesis failed, using best individual perspective',
        synthesisApproach: `Selected ${bestPerspective.perspectiveType} perspective as most reliable`,
      },
      errorHandling: {
        criticalFailuresDetected: criticalErrors.length > 0,
        failureImpactDescription: criticalErrors.length > 0 ? 
          `Critical errors in: ${criticalErrors.map(e => e.agent).join(', ')}` : undefined,
      },
    };
  }
  
  return DEFAULT_OUTPUT;
}

// Export the flow
export const synthesisEnsembleFlow = ai.defineFlow(
  {
    name: 'synthesisEnsembleFlow',
    inputSchema: SynthesisEnsembleInputSchema,
    outputSchema: SynthesisEnsembleOutputSchema,
  },
  runSynthesisEnsemble
);
