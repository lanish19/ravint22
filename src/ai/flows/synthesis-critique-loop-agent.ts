'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// F4 Part 5: Synthesis Critique Loop Agent - Iteratively critiques and refines synthesis outputs

const SynthesisCritiqueLoopInputSchema = z.object({
  synthesis: z.string().describe("The synthesis output to critique"),
  originalData: z.array(z.string()).describe("Original data sources that informed the synthesis"),
  analysisContext: z.string().describe("Context and purpose of the analysis"),
  previousCritiques: z.array(z.object({
    critique: z.string(),
    addressed: z.boolean(),
    resolution: z.string().optional()
  })).optional().describe("Previous critique iterations and their resolutions")
});

export type SynthesisCritiqueLoopInput = z.infer<typeof SynthesisCritiqueLoopInputSchema>;

const SynthesisCritiqueLoopOutputSchema = z.object({
  critiqueResults: z.object({
    overallAssessment: z.string().describe("Overall assessment of synthesis quality"),
    strengths: z.array(z.string()).describe("Identified strengths in the synthesis"),
    weaknesses: z.array(z.object({
      category: z.enum(['logical_gaps', 'evidence_gaps', 'clarity_issues', 'completeness', 'bias', 'methodology']),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      suggestedFix: z.string()
    })).describe("Identified weaknesses and improvement suggestions"),
    gapAnalysis: z.object({
      evidenceGaps: z.array(z.string()).describe("Missing evidence or data points"),
      logicalGaps: z.array(z.string()).describe("Logical inconsistencies or missing connections"),
      perspectiveGaps: z.array(z.string()).describe("Missing viewpoints or considerations")
    }),
    refinementSuggestions: z.array(z.object({
      area: z.string(),
      suggestion: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      expectedImpact: z.string()
    })).describe("Specific suggestions for improvement"),
    iterativeImprovements: z.object({
      currentIteration: z.number(),
      convergenceAssessment: z.string().describe("Assessment of whether synthesis is converging to quality"),
      recommendNextIteration: z.boolean(),
      stoppingCriteria: z.object({
        qualityThresholdMet: z.boolean(),
        diminishingReturns: z.boolean(),
        maxIterationsReached: z.boolean()
      })
    })
  }),
  qualityMetrics: z.object({
    completenessScore: z.number().min(0).max(100),
    coherenceScore: z.number().min(0).max(100),
    evidenceQualityScore: z.number().min(0).max(100),
    clarityScore: z.number().min(0).max(100),
    balanceScore: z.number().min(0).max(100),
    overallQualityScore: z.number().min(0).max(100)
  }),
  recommendations: z.object({
    immediateActions: z.array(z.string()).describe("Actions to take immediately"),
    structuralChanges: z.array(z.string()).describe("Structural improvements needed"),
    contentEnhancements: z.array(z.string()).describe("Content-specific enhancements"),
    methodologyImprovements: z.array(z.string()).describe("Methodological improvements")
  }),
  nextSteps: z.object({
    requiresRevision: z.boolean(),
    revisionPriority: z.enum(['low', 'medium', 'high', 'critical']),
    focusAreas: z.array(z.string()),
    estimatedEffort: z.enum(['minimal', 'moderate', 'substantial', 'major'])
  })
});

export type SynthesisCritiqueLoopOutput = z.infer<typeof SynthesisCritiqueLoopOutputSchema>;

// Default output for error handling
const DEFAULT_SYNTHESIS_CRITIQUE_OUTPUT: SynthesisCritiqueLoopOutput = {
  critiqueResults: {
    overallAssessment: "Unable to complete critique analysis due to processing error",
    strengths: [],
    weaknesses: [],
    gapAnalysis: {
      evidenceGaps: [],
      logicalGaps: [],
      perspectiveGaps: []
    },
    refinementSuggestions: [],
    iterativeImprovements: {
      currentIteration: 1,
      convergenceAssessment: "Analysis incomplete",
      recommendNextIteration: false,
      stoppingCriteria: {
        qualityThresholdMet: false,
        diminishingReturns: false,
        maxIterationsReached: false
      }
    }
  },
  qualityMetrics: {
    completenessScore: 0,
    coherenceScore: 0,
    evidenceQualityScore: 0,
    clarityScore: 0,
    balanceScore: 0,
    overallQualityScore: 0
  },
  recommendations: {
    immediateActions: [],
    structuralChanges: [],
    contentEnhancements: [],
    methodologyImprovements: []
  },
  nextSteps: {
    requiresRevision: true,
    revisionPriority: 'high',
    focusAreas: ['error_resolution'],
    estimatedEffort: 'substantial'
  }
};

// Helper functions for analysis components
function analyzeSynthesisStructure(synthesis: string) {
  return {
    hasIntroduction: synthesis.includes('introduction') || synthesis.includes('overview'),
    hasConclusion: synthesis.includes('conclusion') || synthesis.includes('summary'),
    hasLogicalFlow: checkLogicalFlow(synthesis),
    sectionCount: countSections(synthesis),
    averageSectionLength: calculateAverageSectionLength(synthesis)
  };
}

function analyzeSynthesisContent(synthesis: string, originalData: string[]) {
  return {
    evidenceUtilization: calculateEvidenceUtilization(synthesis, originalData),
    claimSupport: assessClaimSupport(synthesis),
    balanceAssessment: assessPerspectiveBalance(synthesis),
    depthAnalysis: assessAnalysisDepth(synthesis)
  };
}

function analyzeSynthesisLogic(synthesis: string) {
  return {
    logicalConsistency: assessLogicalConsistency(synthesis),
    causalChaining: assessCausalChaining(synthesis),
    argumentStrength: assessArgumentStrength(synthesis),
    contradictionDetection: detectContradictions(synthesis)
  };
}

function identifyStrengths(synthesis: string, structural: any, content: any): string[] {
  const strengths: string[] = [];
  
  if (structural.hasLogicalFlow) strengths.push("Clear logical flow and organization");
  if (content.evidenceUtilization > 0.7) strengths.push("Strong evidence utilization");
  if (content.balanceAssessment > 0.8) strengths.push("Well-balanced perspective presentation");
  if (synthesis.length > 1000) strengths.push("Comprehensive coverage of topic");
  if (structural.hasIntroduction && structural.hasConclusion) strengths.push("Well-structured with clear introduction and conclusion");
  
  return strengths;
}

function identifyWeaknesses(synthesis: string, structural: any, content: any, logical: any) {
  const weaknesses: Array<{
    category: 'logical_gaps' | 'evidence_gaps' | 'clarity_issues' | 'completeness' | 'bias' | 'methodology';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestedFix: string;
  }> = [];

  if (!structural.hasLogicalFlow) {
    weaknesses.push({
      category: 'logical_gaps',
      description: "Synthesis lacks clear logical progression",
      severity: 'high',
      suggestedFix: "Restructure content with clear logical transitions and argument flow"
    });
  }

  if (content.evidenceUtilization < 0.5) {
    weaknesses.push({
      category: 'evidence_gaps',
      description: "Insufficient utilization of available evidence",
      severity: 'high',
      suggestedFix: "Incorporate more evidence from available sources to support claims"
    });
  }

  if (logical.contradictionDetection.length > 0) {
    weaknesses.push({
      category: 'logical_gaps',
      description: "Internal contradictions detected in synthesis",
      severity: 'critical',
      suggestedFix: "Resolve contradictory statements and ensure logical consistency"
    });
  }

  if (content.balanceAssessment < 0.6) {
    weaknesses.push({
      category: 'bias',
      description: "Synthesis appears biased toward certain perspectives",
      severity: 'medium',
      suggestedFix: "Include more balanced representation of different viewpoints"
    });
  }

  return weaknesses;
}

function performGapAnalysis(synthesis: string, originalData: string[], context: string) {
  return {
    evidenceGaps: identifyEvidenceGaps(synthesis, originalData),
    logicalGaps: identifyLogicalGaps(synthesis),
    perspectiveGaps: identifyPerspectiveGaps(synthesis, context)
  };
}

function generateRefinementSuggestions(weaknesses: any[], gapAnalysis: any) {
  const suggestions: Array<{
    area: string;
    suggestion: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    expectedImpact: string;
  }> = [];

  // Generate suggestions based on weaknesses
  weaknesses.forEach(weakness => {
    suggestions.push({
      area: weakness.category,
      suggestion: weakness.suggestedFix,
      priority: weakness.severity === 'critical' ? 'critical' : 
               weakness.severity === 'high' ? 'high' : 
               weakness.severity === 'medium' ? 'medium' : 'low',
      expectedImpact: `Addressing this ${weakness.category} issue will improve overall synthesis quality`
    });
  });

  // Add suggestions based on gap analysis
  if (gapAnalysis.evidenceGaps.length > 0) {
    suggestions.push({
      area: 'evidence',
      suggestion: "Address identified evidence gaps by incorporating missing data points",
      priority: 'high',
      expectedImpact: "Will strengthen evidential support for key claims"
    });
  }

  return suggestions;
}

function assessIterativeProgress(previousCritiques: any[], currentWeaknesses: any[]) {
  const currentIteration = previousCritiques.length + 1;
  const previousWeaknessCount = previousCritiques.reduce((sum, critique) => 
    sum + (critique.weaknessCount || 0), 0) / Math.max(previousCritiques.length, 1);
  
  return {
    currentIteration,
    convergenceAssessment: currentWeaknesses.length < previousWeaknessCount ? 
      "Synthesis quality is improving with iterations" : 
      "Limited improvement observed in recent iterations",
    recommendNextIteration: currentWeaknesses.length > 2 && currentIteration < 5,
    stoppingCriteria: {
      qualityThresholdMet: currentWeaknesses.length <= 1,
      diminishingReturns: currentIteration > 3 && currentWeaknesses.length >= previousWeaknessCount,
      maxIterationsReached: currentIteration >= 5
    }
  };
}

function calculateQualityMetrics(synthesis: string, structural: any, content: any, logical: any) {
  const completenessScore = Math.min(100, (synthesis.length / 1500) * 80 + (structural.sectionCount / 5) * 20);
  const coherenceScore = structural.hasLogicalFlow ? 85 : 60;
  const evidenceQualityScore = content.evidenceUtilization * 100;
  const clarityScore = assessClarityScore(synthesis);
  const balanceScore = content.balanceAssessment * 100;
  
  const overallQualityScore = (completenessScore + coherenceScore + evidenceQualityScore + clarityScore + balanceScore) / 5;

  return {
    completenessScore: Math.round(completenessScore),
    coherenceScore: Math.round(coherenceScore),
    evidenceQualityScore: Math.round(evidenceQualityScore),
    clarityScore: Math.round(clarityScore),
    balanceScore: Math.round(balanceScore),
    overallQualityScore: Math.round(overallQualityScore)
  };
}

function generateRecommendations(weaknesses: any[], suggestions: any[], qualityMetrics: any) {
  const recommendations = {
    immediateActions: [] as string[],
    structuralChanges: [] as string[],
    contentEnhancements: [] as string[],
    methodologyImprovements: [] as string[]
  };

  // Categorize recommendations based on weakness types and severity
  weaknesses.forEach(weakness => {
    if (weakness.severity === 'critical' || weakness.severity === 'high') {
      recommendations.immediateActions.push(weakness.suggestedFix);
    }
    
    if (weakness.category === 'logical_gaps' || weakness.category === 'clarity_issues') {
      recommendations.structuralChanges.push(weakness.suggestedFix);
    } else if (weakness.category === 'evidence_gaps' || weakness.category === 'completeness') {
      recommendations.contentEnhancements.push(weakness.suggestedFix);
    } else if (weakness.category === 'methodology' || weakness.category === 'bias') {
      recommendations.methodologyImprovements.push(weakness.suggestedFix);
    }
  });

  // Add general recommendations based on quality scores
  if (qualityMetrics.completenessScore < 70) {
    recommendations.contentEnhancements.push("Expand synthesis to provide more comprehensive coverage");
  }
  
  if (qualityMetrics.coherenceScore < 70) {
    recommendations.structuralChanges.push("Improve logical flow and organization");
  }

  return recommendations;
}

function determineNextSteps(qualityMetrics: any, iterativeAssessment: any, iterationCount: number) {
  const requiresRevision = qualityMetrics.overallQualityScore < 75 || iterativeAssessment.stoppingCriteria.qualityThresholdMet === false;
  
  let revisionPriority: 'low' | 'medium' | 'high' | 'critical';
  if (qualityMetrics.overallQualityScore < 50) revisionPriority = 'critical';
  else if (qualityMetrics.overallQualityScore < 65) revisionPriority = 'high';
  else if (qualityMetrics.overallQualityScore < 80) revisionPriority = 'medium';
  else revisionPriority = 'low';

  const focusAreas = [];
  if (qualityMetrics.completenessScore < 70) focusAreas.push('completeness');
  if (qualityMetrics.coherenceScore < 70) focusAreas.push('coherence');
  if (qualityMetrics.evidenceQualityScore < 70) focusAreas.push('evidence');
  if (qualityMetrics.clarityScore < 70) focusAreas.push('clarity');

  let estimatedEffort: 'minimal' | 'moderate' | 'substantial' | 'major';
  if (qualityMetrics.overallQualityScore > 85) estimatedEffort = 'minimal';
  else if (qualityMetrics.overallQualityScore > 70) estimatedEffort = 'moderate';
  else if (qualityMetrics.overallQualityScore > 50) estimatedEffort = 'substantial';
  else estimatedEffort = 'major';

  return {
    requiresRevision,
    revisionPriority,
    focusAreas,
    estimatedEffort
  };
}

function generateOverallAssessment(qualityMetrics: any, weaknessCount: number): string {
  if (qualityMetrics.overallQualityScore >= 90) {
    return "Excellent synthesis with high quality across all dimensions";
  } else if (qualityMetrics.overallQualityScore >= 80) {
    return "Good synthesis with minor areas for improvement";
  } else if (qualityMetrics.overallQualityScore >= 70) {
    return "Adequate synthesis with several areas needing attention";
  } else if (qualityMetrics.overallQualityScore >= 60) {
    return "Below average synthesis requiring significant improvements";
  } else {
    return "Poor synthesis requiring major revision and enhancement";
  }
}

// Additional helper functions
function checkLogicalFlow(synthesis: string): boolean {
  const transitionWords = ['therefore', 'however', 'furthermore', 'moreover', 'consequently', 'thus', 'hence'];
  return transitionWords.some(word => synthesis.toLowerCase().includes(word));
}

function countSections(synthesis: string): number {
  const headers = synthesis.match(/#{1,6}\s/g) || [];
  return Math.max(headers.length, synthesis.split('\n\n').length);
}

function calculateAverageSectionLength(synthesis: string): number {
  const sections = synthesis.split('\n\n');
  return sections.reduce((sum, section) => sum + section.length, 0) / sections.length;
}

function calculateEvidenceUtilization(synthesis: string, originalData: string[]): number {
  if (originalData.length === 0) return 0;
  
  let utilizationCount = 0;
  originalData.forEach(data => {
    const keywords = data.split(' ').slice(0, 5);
    if (keywords.some(keyword => synthesis.includes(keyword))) {
      utilizationCount++;
    }
  });
  
  return utilizationCount / originalData.length;
}

function assessClaimSupport(synthesis: string): number {
  const claims = synthesis.split('.').length;
  const supportIndicators = (synthesis.match(/according to|evidence shows|research indicates|data suggests/gi) || []).length;
  return Math.min(1, supportIndicators / (claims * 0.3));
}

function assessPerspectiveBalance(synthesis: string): number {
  const positiveIndicators = (synthesis.match(/benefits|advantages|positive|supports/gi) || []).length;
  const negativeIndicators = (synthesis.match(/challenges|disadvantages|negative|concerns/gi) || []).length;
  const neutralIndicators = (synthesis.match(/however|although|while|whereas/gi) || []).length;
  
  const total = positiveIndicators + negativeIndicators + neutralIndicators;
  if (total === 0) return 0.5;
  
  const balance = 1 - Math.abs((positiveIndicators - negativeIndicators) / total);
  return Math.min(1, balance + (neutralIndicators / total) * 0.5);
}

function assessAnalysisDepth(synthesis: string): number {
  const depthIndicators = (synthesis.match(/analysis|implication|significance|impact|correlation|causation/gi) || []).length;
  return Math.min(1, depthIndicators / (synthesis.length / 200));
}

function assessLogicalConsistency(synthesis: string): boolean {
  // Simple heuristic - check for contradictory terms in close proximity
  const contradictions = [
    ['always', 'never'],
    ['all', 'none'],
    ['increase', 'decrease'],
    ['positive', 'negative']
  ];
  
  return !contradictions.some(([term1, term2]) => {
    const index1 = synthesis.toLowerCase().indexOf(term1);
    const index2 = synthesis.toLowerCase().indexOf(term2);
    return index1 !== -1 && index2 !== -1 && Math.abs(index1 - index2) < 200;
  });
}

function assessCausalChaining(synthesis: string): boolean {
  const causalIndicators = ['because', 'due to', 'results in', 'leads to', 'causes', 'therefore'];
  return causalIndicators.some(indicator => synthesis.toLowerCase().includes(indicator));
}

function assessArgumentStrength(synthesis: string): number {
  const strongIndicators = (synthesis.match(/evidence|proof|research|study|data|analysis/gi) || []).length;
  const weakIndicators = (synthesis.match(/might|possibly|perhaps|maybe|seems/gi) || []).length;
  
  const total = strongIndicators + weakIndicators;
  if (total === 0) return 0.5;
  
  return strongIndicators / total;
}

function detectContradictions(synthesis: string): string[] {
  const contradictions: string[] = [];
  
  // Simple contradiction detection
  if (synthesis.includes('always') && synthesis.includes('never')) {
    contradictions.push("Contains absolute statements that may contradict each other");
  }
  
  if (synthesis.includes('all') && synthesis.includes('none')) {
    contradictions.push("Contains universal quantifiers that may be contradictory");
  }
  
  return contradictions;
}

function identifyEvidenceGaps(synthesis: string, originalData: string[]): string[] {
  const gaps: string[] = [];
  
  // Check if important data sources are underutilized
  originalData.forEach((data, index) => {
    const dataKeywords = data.split(' ').slice(0, 3);
    const mentioned = dataKeywords.some(keyword => synthesis.includes(keyword));
    if (!mentioned) {
      gaps.push(`Data source ${index + 1} appears to be underutilized in synthesis`);
    }
  });
  
  return gaps;
}

function identifyLogicalGaps(synthesis: string): string[] {
  const gaps: string[] = [];
  
  if (!synthesis.includes('therefore') && !synthesis.includes('thus') && !synthesis.includes('consequently')) {
    gaps.push("Lacks clear logical conclusions or inferences");
  }
  
  if (synthesis.split('.').length > 10 && (synthesis.match(/because|since|due to/gi) || []).length < 2) {
    gaps.push("Limited causal reasoning or explanation of relationships");
  }
  
  return gaps;
}

function identifyPerspectiveGaps(synthesis: string, context: string): string[] {
  const gaps: string[] = [];
  
  // Check for missing stakeholder perspectives based on context
  if (context.includes('business') && !synthesis.includes('stakeholder')) {
    gaps.push("Missing stakeholder perspective analysis");
  }
  
  if (context.includes('policy') && !synthesis.includes('impact')) {
    gaps.push("Missing impact assessment from policy perspective");
  }
  
  return gaps;
}

function assessClarityScore(synthesis: string): number {
  const sentences = synthesis.split('.').length;
  const avgSentenceLength = synthesis.length / sentences;
  const complexWords = (synthesis.match(/\w{8,}/g) || []).length;
  
  // Penalize very long sentences and excessive complex words
  let clarityScore = 100;
  if (avgSentenceLength > 25) clarityScore -= 20;
  if (complexWords / sentences > 0.3) clarityScore -= 15;
  
  return Math.max(0, clarityScore);
}

// Main critique function
export async function critiqueSynthesis(input: SynthesisCritiqueLoopInput): Promise<SynthesisCritiqueLoopOutput> {
  try {
    const { synthesis, originalData, analysisContext, previousCritiques = [] } = input;

    // Analyze synthesis structure and content
    const structuralAnalysis = analyzeSynthesisStructure(synthesis);
    const contentAnalysis = analyzeSynthesisContent(synthesis, originalData);
    const logicalAnalysis = analyzeSynthesisLogic(synthesis);
    
    // Identify strengths
    const strengths = identifyStrengths(synthesis, structuralAnalysis, contentAnalysis);
    
    // Identify weaknesses and gaps
    const weaknesses = identifyWeaknesses(synthesis, structuralAnalysis, contentAnalysis, logicalAnalysis);
    const gapAnalysis = performGapAnalysis(synthesis, originalData, analysisContext);
    
    // Generate refinement suggestions
    const refinementSuggestions = generateRefinementSuggestions(weaknesses, gapAnalysis);
    
    // Assess iterative progress
    const iterativeAssessment = assessIterativeProgress(previousCritiques, weaknesses);
    
    // Calculate quality metrics
    const qualityMetrics = calculateQualityMetrics(synthesis, structuralAnalysis, contentAnalysis, logicalAnalysis);
    
    // Generate recommendations
    const recommendations = generateRecommendations(weaknesses, refinementSuggestions, qualityMetrics);
    
    // Determine next steps
    const nextSteps = determineNextSteps(qualityMetrics, iterativeAssessment, previousCritiques.length);

    return {
      critiqueResults: {
        overallAssessment: generateOverallAssessment(qualityMetrics, weaknesses.length),
        strengths,
        weaknesses,
        gapAnalysis,
        refinementSuggestions,
        iterativeImprovements: iterativeAssessment
      },
      qualityMetrics,
      recommendations,
      nextSteps
    };

  } catch (error) {
    console.error('Error in synthesis critique loop analysis:', error);
    return DEFAULT_SYNTHESIS_CRITIQUE_OUTPUT;
  }
}

// Export the flow
export const synthesisCritiqueLoopFlow = ai.defineFlow(
  {
    name: 'critiqueSynthesis',
    inputSchema: SynthesisCritiqueLoopInputSchema,
    outputSchema: SynthesisCritiqueLoopOutputSchema,
  },
  critiqueSynthesis
); 