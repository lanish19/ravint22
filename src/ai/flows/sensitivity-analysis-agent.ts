'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// F4 Part 2: Sensitivity Analysis Agent - Tests robustness of conclusions under different assumption scenarios

const SensitivityAnalysisInputSchema = z.object({
  originalConclusions: z.array(z.string()).describe('Original conclusions to test'),
  keyAssumptions: z.array(z.object({
    assumption: z.string(),
    confidence: z.enum(['High', 'Medium', 'Low']),
    impact: z.enum(['High', 'Medium', 'Low']),
    riskLevel: z.enum(['High', 'Medium', 'Low']),
  })).describe('Key assumptions to vary in sensitivity analysis'),
  synthesisEvidence: z.any().describe('Available evidence for alternate scenarios'),
});

export type SensitivityAnalysisInput = z.infer<typeof SensitivityAnalysisInputSchema>;

const ScenarioTestSchema = z.object({
  scenarioId: z.string().describe('Unique identifier for scenario'),
  scenarioName: z.string().describe('Descriptive name for scenario'),
  changedAssumptions: z.array(z.object({
    originalAssumption: z.string(),
    modifiedAssumption: z.string(),
    changeType: z.enum(['weakened', 'strengthened', 'reversed', 'replaced']),
    changeRationale: z.string(),
  })),
  impactOnConclusions: z.array(z.object({
    originalConclusion: z.string(),
    revisedConclusion: z.string(),
    changeLevel: z.enum(['none', 'minor', 'moderate', 'major', 'complete_reversal']),
    confidenceAdjustment: z.number().min(-100).max(100),
    reasoning: z.string(),
  })),
  scenarioViability: z.object({
    plausibility: z.enum(['very_low', 'low', 'moderate', 'high', 'very_high']),
    evidenceSupport: z.enum(['weak', 'moderate', 'strong']),
    rationalExplanation: z.string(),
  }),
});

export type ScenarioTest = z.infer<typeof ScenarioTestSchema>;

const SensitivityAnalysisOutputSchema = z.object({
  overallRobustness: z.object({
    score: z.number().min(0).max(100).describe('Overall robustness score'),
    category: z.enum(['very_robust', 'robust', 'moderately_robust', 'fragile', 'very_fragile']),
    summary: z.string(),
  }),
  scenarioTests: z.array(ScenarioTestSchema),
  assumptionSensitivity: z.array(z.object({
    assumption: z.string(),
    sensitivityLevel: z.enum(['very_high', 'high', 'moderate', 'low', 'very_low']),
    averageImpact: z.number().min(0).max(100),
    criticalityRating: z.enum(['critical', 'important', 'moderate', 'minor']),
    reasoning: z.string(),
  })),
  conclusionStability: z.array(z.object({
    conclusion: z.string(),
    stabilityScore: z.number().min(0).max(100),
    stabilityCategory: z.enum(['very_stable', 'stable', 'moderately_stable', 'unstable', 'very_unstable']),
    variationRange: z.string(),
    keyVulnerabilities: z.array(z.string()),
  })),
  riskAssessment: z.object({
    highRiskScenarios: z.array(z.string()),
    lowRiskScenarios: z.array(z.string()),
    criticalAssumptions: z.array(z.string()),
    robustnessConcerns: z.array(z.string()),
  }),
  recommendations: z.object({
    strengthenAssumptions: z.array(z.string()),
    additionalResearch: z.array(z.string()),
    confidenceAdjustments: z.array(z.string()),
    contingencyPlanning: z.array(z.string()),
  }),
});

export type SensitivityAnalysisOutput = z.infer<typeof SensitivityAnalysisOutputSchema>;

// Default output for error cases
const DEFAULT_SENSITIVITY_OUTPUT: SensitivityAnalysisOutput = {
  overallRobustness: {
    score: 0,
    category: 'very_fragile',
    summary: 'Sensitivity analysis failed - robustness unknown',
  },
  scenarioTests: [],
  assumptionSensitivity: [],
  conclusionStability: [],
  riskAssessment: {
    highRiskScenarios: ['Unable to assess scenarios'],
    lowRiskScenarios: [],
    criticalAssumptions: ['Analysis failed'],
    robustnessConcerns: ['Sensitivity analysis could not be completed'],
  },
  recommendations: {
    strengthenAssumptions: ['Manual sensitivity analysis required'],
    additionalResearch: ['Reassess key assumptions manually'],
    confidenceAdjustments: ['Lower confidence due to incomplete robustness assessment'],
    contingencyPlanning: ['Develop manual scenario testing'],
  },
};

// Scenario generation functions
function generateWeakeningScenario(assumption: string, index: number): ScenarioTest {
  return {
    scenarioId: `weak_${index}`,
    scenarioName: `Weakened Assumption ${index + 1}`,
    changedAssumptions: [{
      originalAssumption: assumption,
      modifiedAssumption: `Weakened version: ${assumption} (with reduced confidence)`,
      changeType: 'weakened',
      changeRationale: 'Testing impact of reduced assumption strength',
    }],
    impactOnConclusions: [],
    scenarioViability: {
      plausibility: 'moderate',
      evidenceSupport: 'moderate',
      rationalExplanation: 'Standard weakening test to assess robustness',
    },
  };
}

function generateStrengtheningScenario(assumption: string, index: number): ScenarioTest {
  return {
    scenarioId: `strong_${index}`,
    scenarioName: `Strengthened Assumption ${index + 1}`,
    changedAssumptions: [{
      originalAssumption: assumption,
      modifiedAssumption: `Strengthened version: ${assumption} (with increased confidence)`,
      changeType: 'strengthened',
      changeRationale: 'Testing impact of increased assumption strength',
    }],
    impactOnConclusions: [],
    scenarioViability: {
      plausibility: 'moderate',
      evidenceSupport: 'moderate',
      rationalExplanation: 'Standard strengthening test to assess robustness',
    },
  };
}

function generateReversalScenario(assumption: string, index: number): ScenarioTest {
  return {
    scenarioId: `reverse_${index}`,
    scenarioName: `Reversed Assumption ${index + 1}`,
    changedAssumptions: [{
      originalAssumption: assumption,
      modifiedAssumption: `Opposite of: ${assumption}`,
      changeType: 'reversed',
      changeRationale: 'Testing impact of assumption reversal',
    }],
    impactOnConclusions: [],
    scenarioViability: {
      plausibility: 'low',
      evidenceSupport: 'weak',
      rationalExplanation: 'Extreme test to identify critical dependencies',
    },
  };
}

// Analysis functions
function assessConclusionImpact(conclusion: string, scenario: ScenarioTest): any {
  // Simplified impact assessment based on scenario type
  let changeLevel: any;
  let confidenceAdjustment: number;

  switch (scenario.changedAssumptions[0]?.changeType) {
    case 'weakened':
      changeLevel = 'minor';
      confidenceAdjustment = -15;
      break;
    case 'strengthened':
      changeLevel = 'minor';
      confidenceAdjustment = 10;
      break;
    case 'reversed':
      changeLevel = 'major';
      confidenceAdjustment = -50;
      break;
    default:
      changeLevel = 'moderate';
      confidenceAdjustment = -25;
  }

  return {
    originalConclusion: conclusion,
    revisedConclusion: `${conclusion} (modified under ${scenario.scenarioName})`,
    changeLevel,
    confidenceAdjustment,
    reasoning: `Impact assessed based on ${scenario.changedAssumptions[0]?.changeType} assumption change`,
  };
}

function calculateAssumptionSensitivity(assumption: any, scenarios: ScenarioTest[]): any {
  // Calculate sensitivity based on impact across scenarios
  const relatedScenarios = scenarios.filter(s => 
    s.changedAssumptions.some(ca => ca.originalAssumption.includes(assumption.assumption))
  );

  let averageImpact = 0;
  if (relatedScenarios.length > 0) {
    const impacts = relatedScenarios.flatMap(s => 
      s.impactOnConclusions.map(ic => Math.abs(ic.confidenceAdjustment))
    );
    averageImpact = impacts.reduce((sum, impact) => sum + impact, 0) / impacts.length;
  }

  let sensitivityLevel: any;
  let criticalityRating: any;

  if (averageImpact >= 40) {
    sensitivityLevel = 'very_high';
    criticalityRating = 'critical';
  } else if (averageImpact >= 25) {
    sensitivityLevel = 'high';
    criticalityRating = 'important';
  } else if (averageImpact >= 15) {
    sensitivityLevel = 'moderate';
    criticalityRating = 'moderate';
  } else {
    sensitivityLevel = 'low';
    criticalityRating = 'minor';
  }

  return {
    assumption: assumption.assumption,
    sensitivityLevel,
    averageImpact: Math.round(averageImpact),
    criticalityRating,
    reasoning: `Average impact across ${relatedScenarios.length} scenarios: ${Math.round(averageImpact)}%`,
  };
}

function calculateConclusionStability(conclusion: string, scenarios: ScenarioTest[]): any {
  // Assess how stable each conclusion is across scenarios
  const conclusionImpacts = scenarios.flatMap(s => 
    s.impactOnConclusions.filter(ic => ic.originalConclusion === conclusion)
  );

  if (conclusionImpacts.length === 0) {
    return {
      conclusion,
      stabilityScore: 50,
      stabilityCategory: 'moderately_stable',
      variationRange: 'Unknown - no variation data',
      keyVulnerabilities: ['No scenario testing performed'],
    };
  }

  const confidenceChanges = conclusionImpacts.map(ic => Math.abs(ic.confidenceAdjustment));
  const averageChange = confidenceChanges.reduce((sum, change) => sum + change, 0) / confidenceChanges.length;
  const maxChange = Math.max(...confidenceChanges);

  const stabilityScore = Math.max(0, 100 - averageChange);
  
  let stabilityCategory: any;
  if (stabilityScore >= 90) stabilityCategory = 'very_stable';
  else if (stabilityScore >= 75) stabilityCategory = 'stable';
  else if (stabilityScore >= 60) stabilityCategory = 'moderately_stable';
  else if (stabilityScore >= 40) stabilityCategory = 'unstable';
  else stabilityCategory = 'very_unstable';

  const keyVulnerabilities = conclusionImpacts
    .filter(ic => Math.abs(ic.confidenceAdjustment) > 30)
    .map(ic => `Vulnerable to ${ic.reasoning}`);

  return {
    conclusion,
    stabilityScore: Math.round(stabilityScore),
    stabilityCategory,
    variationRange: `${Math.round(averageChange)}% average change, up to ${Math.round(maxChange)}% maximum`,
    keyVulnerabilities: keyVulnerabilities.length > 0 ? keyVulnerabilities : ['No major vulnerabilities identified'],
  };
}

export async function analyzeSensitivity(input: SensitivityAnalysisInput): Promise<SensitivityAnalysisOutput> {
  try {
    console.log('SensitivityAnalysisAgent: Starting sensitivity analysis...');

    if (!input.keyAssumptions || input.keyAssumptions.length === 0) {
      console.warn('SensitivityAnalysisAgent: No key assumptions provided');
      return {
        ...DEFAULT_SENSITIVITY_OUTPUT,
        riskAssessment: {
          ...DEFAULT_SENSITIVITY_OUTPUT.riskAssessment,
          robustnessConcerns: ['No assumptions provided for sensitivity testing'],
        },
      };
    }

    // Generate test scenarios for each assumption
    const scenarios: ScenarioTest[] = [];

    input.keyAssumptions.forEach((assumption, index) => {
      // Generate different types of scenarios based on assumption risk level
      if (assumption.riskLevel === 'High' || assumption.impact === 'High') {
        scenarios.push(generateWeakeningScenario(assumption.assumption, index));
        scenarios.push(generateReversalScenario(assumption.assumption, index));
      } else if (assumption.riskLevel === 'Medium') {
        scenarios.push(generateWeakeningScenario(assumption.assumption, index));
        scenarios.push(generateStrengtheningScenario(assumption.assumption, index));
      } else {
        scenarios.push(generateWeakeningScenario(assumption.assumption, index));
      }
    });

    // Test impact on each conclusion for each scenario
    scenarios.forEach(scenario => {
      scenario.impactOnConclusions = input.originalConclusions.map(conclusion =>
        assessConclusionImpact(conclusion, scenario)
      );
    });

    // Calculate assumption sensitivity levels
    const assumptionSensitivity = input.keyAssumptions.map(assumption =>
      calculateAssumptionSensitivity(assumption, scenarios)
    );

    // Calculate conclusion stability
    const conclusionStability = input.originalConclusions.map(conclusion =>
      calculateConclusionStability(conclusion, scenarios)
    );

    // Calculate overall robustness
    const stabilityScores = conclusionStability.map(cs => cs.stabilityScore);
    const averageStability = stabilityScores.reduce((sum, score) => sum + score, 0) / stabilityScores.length;

    let robustnessCategory: any;
    if (averageStability >= 90) robustnessCategory = 'very_robust';
    else if (averageStability >= 75) robustnessCategory = 'robust';
    else if (averageStability >= 60) robustnessCategory = 'moderately_robust';
    else if (averageStability >= 40) robustnessCategory = 'fragile';
    else robustnessCategory = 'very_fragile';

    // Risk assessment
    const highRiskScenarios = scenarios
      .filter(s => s.scenarioViability.plausibility === 'high' && 
        s.impactOnConclusions.some(ic => Math.abs(ic.confidenceAdjustment) > 30))
      .map(s => s.scenarioName);

    const lowRiskScenarios = scenarios
      .filter(s => s.scenarioViability.plausibility === 'low' || 
        s.impactOnConclusions.every(ic => Math.abs(ic.confidenceAdjustment) < 15))
      .map(s => s.scenarioName);

    const criticalAssumptions = assumptionSensitivity
      .filter(as => as.criticalityRating === 'critical')
      .map(as => as.assumption);

    const robustnessConcerns: string[] = [];
    if (averageStability < 60) {
      robustnessConcerns.push('Overall conclusion stability is below acceptable threshold');
    }
    if (criticalAssumptions.length > 2) {
      robustnessConcerns.push('Multiple critical assumptions create compound vulnerability');
    }
    if (highRiskScenarios.length > 0) {
      robustnessConcerns.push('High-plausibility scenarios show significant impact');
    }

    // Generate recommendations
    const strengthenAssumptions = assumptionSensitivity
      .filter(as => as.criticalityRating === 'critical' || as.criticalityRating === 'important')
      .map(as => `Strengthen evidence for: ${as.assumption}`);

    const additionalResearch = criticalAssumptions.map(assumption =>
      `Research alternatives to critical assumption: ${assumption}`
    );

    const confidenceAdjustments: string[] = [];
    if (averageStability < 70) {
      confidenceAdjustments.push('Reduce overall confidence due to sensitivity concerns');
    }
    if (criticalAssumptions.length > 0) {
      confidenceAdjustments.push('Flag dependency on critical assumptions in final output');
    }

    const contingencyPlanning = highRiskScenarios.map(scenario =>
      `Develop contingency for scenario: ${scenario}`
    );

    const result: SensitivityAnalysisOutput = {
      overallRobustness: {
        score: Math.round(averageStability),
        category: robustnessCategory,
        summary: `Analysis shows ${robustnessCategory.replace('_', ' ')} conclusions (${Math.round(averageStability)}/100). Tested ${scenarios.length} scenarios across ${input.keyAssumptions.length} assumptions.`,
      },
      scenarioTests: scenarios,
      assumptionSensitivity,
      conclusionStability,
      riskAssessment: {
        highRiskScenarios,
        lowRiskScenarios,
        criticalAssumptions,
        robustnessConcerns: robustnessConcerns.length > 0 ? robustnessConcerns : ['No major robustness concerns identified'],
      },
      recommendations: {
        strengthenAssumptions,
        additionalResearch,
        confidenceAdjustments,
        contingencyPlanning,
      },
    };

    console.log('SensitivityAnalysisAgent: Sensitivity analysis completed', {
      robustnessScore: Math.round(averageStability),
      category: robustnessCategory,
      scenariosCount: scenarios.length,
      criticalAssumptions: criticalAssumptions.length,
    });

    return result;

  } catch (error: any) {
    console.error('SensitivityAnalysisAgent: Error in sensitivity analysis', { error: error.message });
    return DEFAULT_SENSITIVITY_OUTPUT;
  }
}

// Export the flow for use in orchestration
export const sensitivityAnalysisFlow = ai.defineFlow(
  {
    name: 'sensitivityAnalysisFlow',
    inputSchema: SensitivityAnalysisInputSchema,
    outputSchema: SensitivityAnalysisOutputSchema,
  },
  analyzeSensitivity
); 