'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// F4 Part 1: Quality Check Agent - Evaluates quality of upstream analytical agent outputs

const QualityCheckInputSchema = z.object({
  critiqueOutput: z.any().describe('Output from CritiqueAgent to assess'),
  biasDetectionOutput: z.any().describe('Output from BiasDetectionAgent to assess'),
  researchOutput: z.any().describe('Output from ResearcherAgent to assess'),
  counterResearchOutput: z.any().describe('Output from CounterEvidenceResearcherAgent to assess'),
  assumptionsOutput: z.any().describe('Output from AnalyzeAssumptionsAgent to assess'),
});

export type QualityCheckInput = z.infer<typeof QualityCheckInputSchema>;

const QualityScoreSchema = z.object({
  score: z.number().min(0).max(100).describe('Quality score from 0-100'),
  category: z.enum(['excellent', 'good', 'fair', 'poor']).describe('Quality category'),
  reasoning: z.string().describe('Detailed reasoning for the score'),
  specificIssues: z.array(z.string()).describe('Specific quality issues identified'),
  recommendations: z.array(z.string()).describe('Recommendations for improvement'),
});

export type QualityScore = z.infer<typeof QualityScoreSchema>;

const QualityCheckOutputSchema = z.object({
  overallQuality: z.object({
    averageScore: z.number().min(0).max(100),
    category: z.enum(['excellent', 'good', 'fair', 'poor']),
    summary: z.string(),
  }),
  componentQuality: z.object({
    critiqueQuality: QualityScoreSchema,
    biasDetectionQuality: QualityScoreSchema,
    researchQuality: QualityScoreSchema,
    counterResearchQuality: QualityScoreSchema,
    assumptionsQuality: QualityScoreSchema,
  }),
  qualityFactors: z.object({
    strengthFactors: z.array(z.string()),
    weaknessFactors: z.array(z.string()),
    criticalIssues: z.array(z.string()),
  }),
  recommendations: z.object({
    immediateActions: z.array(z.string()),
    synthesisGuidance: z.array(z.string()),
    confidenceAdjustments: z.array(z.string()),
  }),
});

export type QualityCheckOutput = z.infer<typeof QualityCheckOutputSchema>;

// Default output for error cases
const DEFAULT_QUALITY_OUTPUT: QualityCheckOutput = {
  overallQuality: {
    averageScore: 0,
    category: 'poor',
    summary: 'Quality assessment failed',
  },
  componentQuality: {
    critiqueQuality: {
      score: 0,
      category: 'poor',
      reasoning: 'Unable to assess critique quality',
      specificIssues: ['Assessment failed'],
      recommendations: ['Manual review required'],
    },
    biasDetectionQuality: {
      score: 0,
      category: 'poor',
      reasoning: 'Unable to assess bias detection quality',
      specificIssues: ['Assessment failed'],
      recommendations: ['Manual review required'],
    },
    researchQuality: {
      score: 0,
      category: 'poor',
      reasoning: 'Unable to assess research quality',
      specificIssues: ['Assessment failed'],
      recommendations: ['Manual review required'],
    },
    counterResearchQuality: {
      score: 0,
      category: 'poor',
      reasoning: 'Unable to assess counter-research quality',
      specificIssues: ['Assessment failed'],
      recommendations: ['Manual review required'],
    },
    assumptionsQuality: {
      score: 0,
      category: 'poor',
      reasoning: 'Unable to assess assumptions quality',
      specificIssues: ['Assessment failed'],
      recommendations: ['Manual review required'],
    },
  },
  qualityFactors: {
    strengthFactors: [],
    weaknessFactors: ['Quality assessment failed'],
    criticalIssues: ['Unable to complete quality assessment'],
  },
  recommendations: {
    immediateActions: ['Manual quality review required'],
    synthesisGuidance: ['Proceed with caution due to assessment failure'],
    confidenceAdjustments: ['Lower confidence due to unassessed quality'],
  },
};

// Quality assessment functions
function assessCritiqueQuality(critiqueOutput: any): QualityScore {
  try {
    if (!critiqueOutput || typeof critiqueOutput !== 'string') {
      return {
        score: 0,
        category: 'poor',
        reasoning: 'No critique output provided or invalid format',
        specificIssues: ['Missing or invalid critique'],
        recommendations: ['Regenerate critique with proper format'],
      };
    }

    const critique = critiqueOutput.toLowerCase();
    let score = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for specificity (25 points)
    if (critique.includes('specific') || critique.includes('particular') || critique.includes('concrete')) {
      score += 25;
    } else {
      issues.push('Lacks specificity');
      recommendations.push('Provide more specific examples and details');
    }

    // Check for actionability (25 points)
    if (critique.includes('should') || critique.includes('could') || critique.includes('recommend')) {
      score += 25;
    } else {
      issues.push('Not actionable');
      recommendations.push('Include actionable recommendations');
    }

    // Check for evidence-based reasoning (25 points)
    if (critique.includes('evidence') || critique.includes('source') || critique.includes('support')) {
      score += 25;
    } else {
      issues.push('Lacks evidence-based reasoning');
      recommendations.push('Ground critique in available evidence');
    }

    // Check for depth (25 points)
    if (critique.length > 200 && (critique.includes('because') || critique.includes('therefore') || critique.includes('however'))) {
      score += 25;
    } else {
      issues.push('Lacks depth of analysis');
      recommendations.push('Provide deeper analytical reasoning');
    }

    const category = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor';

    return {
      score,
      category,
      reasoning: `Critique assessment based on specificity, actionability, evidence-basis, and depth. Score: ${score}/100`,
      specificIssues: issues,
      recommendations,
    };
  } catch (error) {
    return {
      score: 0,
      category: 'poor',
      reasoning: 'Error assessing critique quality',
      specificIssues: ['Assessment error'],
      recommendations: ['Manual review required'],
    };
  }
}

function assessBiasDetectionQuality(biasOutput: any): QualityScore {
  try {
    if (!Array.isArray(biasOutput)) {
      return {
        score: 0,
        category: 'poor',
        reasoning: 'Bias detection output is not in expected array format',
        specificIssues: ['Invalid format'],
        recommendations: ['Ensure bias detection returns array of identified biases'],
      };
    }

    let score = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for bias identification (40 points)
    if (biasOutput.length > 0) {
      score += 40;
    } else {
      issues.push('No biases identified');
      recommendations.push('Review for common cognitive biases');
    }

    // Check for specific bias types (30 points)
    const commonBiases = ['confirmation', 'anchoring', 'availability', 'selection', 'survivorship'];
    const foundBiases = biasOutput.some((bias: any) => 
      commonBiases.some(commonBias => 
        JSON.stringify(bias).toLowerCase().includes(commonBias)
      )
    );
    
    if (foundBiases) {
      score += 30;
    } else {
      issues.push('No specific bias types identified');
      recommendations.push('Look for specific cognitive bias patterns');
    }

    // Check for detailed explanations (30 points)
    const hasDetailedExplanations = biasOutput.some((bias: any) =>
      (bias.explanation && bias.explanation.length > 50) ||
      (bias.description && bias.description.length > 50)
    );

    if (hasDetailedExplanations) {
      score += 30;
    } else {
      issues.push('Lacks detailed bias explanations');
      recommendations.push('Provide thorough explanations for identified biases');
    }

    const category = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor';

    return {
      score,
      category,
      reasoning: `Bias detection assessed on identification count (${biasOutput.length}), specificity, and explanation depth`,
      specificIssues: issues,
      recommendations,
    };
  } catch (error) {
    return {
      score: 0,
      category: 'poor',
      reasoning: 'Error assessing bias detection quality',
      specificIssues: ['Assessment error'],
      recommendations: ['Manual review required'],
    };
  }
}

function assessResearchQuality(researchOutput: any): QualityScore {
  try {
    if (!Array.isArray(researchOutput)) {
      return {
        score: 0,
        category: 'poor',
        reasoning: 'Research output is not in expected array format',
        specificIssues: ['Invalid format'],
        recommendations: ['Ensure research returns array of evidence items'],
      };
    }

    let score = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for evidence quantity (25 points)
    if (researchOutput.length >= 3) {
      score += 25;
    } else if (researchOutput.length >= 1) {
      score += 15;
      issues.push('Limited evidence quantity');
      recommendations.push('Gather more supporting evidence');
    } else {
      issues.push('No evidence found');
      recommendations.push('Conduct more thorough research');
    }

    // Check for source diversity (25 points)
    const sources = researchOutput.map((item: any) => item.source || item.citation || '').filter(Boolean);
    const uniqueSources = new Set(sources).size;
    if (uniqueSources >= 3) {
      score += 25;
    } else if (uniqueSources >= 2) {
      score += 15;
      issues.push('Limited source diversity');
      recommendations.push('Diversify evidence sources');
    } else {
      issues.push('Poor source diversity');
      recommendations.push('Use multiple independent sources');
    }

    // Check for evidence quality indicators (25 points)
    const hasQualityIndicators = researchOutput.some((item: any) =>
      (item.reliability && ['High', 'Medium'].includes(item.reliability)) ||
      (item.credibility && ['High', 'Medium'].includes(item.credibility)) ||
      (item.source && (item.source.includes('study') || item.source.includes('research')))
    );

    if (hasQualityIndicators) {
      score += 25;
    } else {
      issues.push('Lacks quality indicators');
      recommendations.push('Include reliability and credibility assessments');
    }

    // Check for relevance and detail (25 points)
    const hasDetailedEvidence = researchOutput.some((item: any) =>
      (item.evidence && item.evidence.length > 100) ||
      (item.description && item.description.length > 100) ||
      (item.summary && item.summary.length > 100)
    );

    if (hasDetailedEvidence) {
      score += 25;
    } else {
      issues.push('Lacks detailed evidence');
      recommendations.push('Provide more detailed evidence descriptions');
    }

    const category = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor';

    return {
      score,
      category,
      reasoning: `Research quality assessed on quantity (${researchOutput.length} items), diversity (${uniqueSources} sources), quality indicators, and detail`,
      specificIssues: issues,
      recommendations,
    };
  } catch (error) {
    return {
      score: 0,
      category: 'poor',
      reasoning: 'Error assessing research quality',
      specificIssues: ['Assessment error'],
      recommendations: ['Manual review required'],
    };
  }
}

function assessAssumptionsQuality(assumptionsOutput: any): QualityScore {
  try {
    if (!Array.isArray(assumptionsOutput)) {
      return {
        score: 0,
        category: 'poor',
        reasoning: 'Assumptions output is not in expected array format',
        specificIssues: ['Invalid format'],
        recommendations: ['Ensure assumptions analysis returns array of assumption items'],
      };
    }

    let score = 0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for assumption identification (30 points)
    if (assumptionsOutput.length >= 3) {
      score += 30;
    } else if (assumptionsOutput.length >= 1) {
      score += 20;
      issues.push('Limited assumption identification');
      recommendations.push('Identify more underlying assumptions');
    } else {
      issues.push('No assumptions identified');
      recommendations.push('Conduct more thorough assumption analysis');
    }

    // Check for risk assessment (35 points)
    const hasRiskAssessment = assumptionsOutput.some((item: any) =>
      item.risk && ['High', 'Medium', 'Low'].includes(item.risk)
    );

    if (hasRiskAssessment) {
      score += 35;
    } else {
      issues.push('Missing risk assessments');
      recommendations.push('Include risk levels for each assumption');
    }

    // Check for detailed explanations (35 points)
    const hasExplanations = assumptionsOutput.some((item: any) =>
      (item.explanation && item.explanation.length > 50) ||
      (item.rationale && item.rationale.length > 50)
    );

    if (hasExplanations) {
      score += 35;
    } else {
      issues.push('Lacks detailed explanations');
      recommendations.push('Provide thorough rationales for assumptions');
    }

    const category = score >= 90 ? 'excellent' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'poor';

    return {
      score,
      category,
      reasoning: `Assumptions quality assessed on identification count (${assumptionsOutput.length}), risk assessment presence, and explanation depth`,
      specificIssues: issues,
      recommendations,
    };
  } catch (error) {
    return {
      score: 0,
      category: 'poor',
      reasoning: 'Error assessing assumptions quality',
      specificIssues: ['Assessment error'],
      recommendations: ['Manual review required'],
    };
  }
}

export async function checkQuality(input: QualityCheckInput): Promise<QualityCheckOutput> {
  try {
    console.log('QualityCheckAgent: Starting quality assessment...');

    // Assess each component
    const critiqueQuality = assessCritiqueQuality(input.critiqueOutput);
    const biasDetectionQuality = assessBiasDetectionQuality(input.biasDetectionOutput);
    const researchQuality = assessResearchQuality(input.researchOutput);
    const counterResearchQuality = assessResearchQuality(input.counterResearchOutput); // Same logic
    const assumptionsQuality = assessAssumptionsQuality(input.assumptionsOutput);

    // Calculate overall quality
    const scores = [
      critiqueQuality.score,
      biasDetectionQuality.score,
      researchQuality.score,
      counterResearchQuality.score,
      assumptionsQuality.score,
    ];

    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const overallCategory = averageScore >= 90 ? 'excellent' : averageScore >= 70 ? 'good' : averageScore >= 50 ? 'fair' : 'poor';

    // Collect all factors
    const allIssues = [
      ...critiqueQuality.specificIssues,
      ...biasDetectionQuality.specificIssues,
      ...researchQuality.specificIssues,
      ...counterResearchQuality.specificIssues,
      ...assumptionsQuality.specificIssues,
    ];

    const strengthFactors: string[] = [];
    const weaknessFactors: string[] = [];
    const criticalIssues: string[] = [];

    // Categorize factors based on scores
    const qualityAssessments = [
      { name: 'Critique', quality: critiqueQuality },
      { name: 'Bias Detection', quality: biasDetectionQuality },
      { name: 'Research', quality: researchQuality },
      { name: 'Counter-Research', quality: counterResearchQuality },
      { name: 'Assumptions', quality: assumptionsQuality },
    ];

    qualityAssessments.forEach(({ name, quality }) => {
      if (quality.score >= 80) {
        strengthFactors.push(`${name}: High quality (${quality.score}/100)`);
      } else if (quality.score >= 60) {
        strengthFactors.push(`${name}: Adequate quality (${quality.score}/100)`);
      } else if (quality.score >= 40) {
        weaknessFactors.push(`${name}: Below average quality (${quality.score}/100)`);
      } else {
        criticalIssues.push(`${name}: Poor quality (${quality.score}/100) - ${quality.reasoning}`);
      }
    });

    // Generate recommendations
    const immediateActions: string[] = [];
    const synthesisGuidance: string[] = [];
    const confidenceAdjustments: string[] = [];

    if (averageScore < 50) {
      immediateActions.push('Consider regenerating poor quality analyses');
      confidenceAdjustments.push('Significantly reduce confidence due to poor analysis quality');
    } else if (averageScore < 70) {
      immediateActions.push('Review and improve moderate quality analyses');
      confidenceAdjustments.push('Moderately reduce confidence due to analysis quality issues');
    }

    if (criticalIssues.length > 0) {
      synthesisGuidance.push('Weight synthesis heavily toward higher quality inputs');
      synthesisGuidance.push('Clearly note quality limitations in final output');
    }

    if (strengthFactors.length > 0) {
      synthesisGuidance.push('Emphasize insights from high-quality analyses');
    }

    const result: QualityCheckOutput = {
      overallQuality: {
        averageScore: Math.round(averageScore),
        category: overallCategory,
        summary: `Overall analysis quality is ${overallCategory} (${Math.round(averageScore)}/100). ${strengthFactors.length} strong components, ${criticalIssues.length} critical issues identified.`,
      },
      componentQuality: {
        critiqueQuality,
        biasDetectionQuality,
        researchQuality,
        counterResearchQuality,
        assumptionsQuality,
      },
      qualityFactors: {
        strengthFactors,
        weaknessFactors,
        criticalIssues,
      },
      recommendations: {
        immediateActions,
        synthesisGuidance,
        confidenceAdjustments,
      },
    };

    console.log('QualityCheckAgent: Quality assessment completed', {
      averageScore: Math.round(averageScore),
      category: overallCategory,
      strengthsCount: strengthFactors.length,
      issuesCount: criticalIssues.length,
    });

    return result;

  } catch (error: any) {
    console.error('QualityCheckAgent: Error in quality assessment', { error: error.message });
    return DEFAULT_QUALITY_OUTPUT;
  }
}

// Export the flow for use in orchestration
export const qualityCheckFlow = ai.defineFlow(
  {
    name: 'qualityCheckFlow',
    inputSchema: QualityCheckInputSchema,
    outputSchema: QualityCheckOutputSchema,
  },
  checkQuality
); 