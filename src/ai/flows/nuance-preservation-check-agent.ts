'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// F4 Part 4: Nuance Preservation Check Agent - Ensures important nuances and subtleties are preserved

const NuancePreservationInputSchema = z.object({
  originalContent: z.string().describe('Original content to analyze for nuances'),
  synthesizedContent: z.string().describe('Synthesized content to check against original'),
  contextualFactors: z.array(z.object({
    factor: z.string(),
    importance: z.enum(['critical', 'high', 'medium', 'low']),
    description: z.string(),
  })).describe('Important contextual factors to preserve'),
  analysisDepth: z.enum(['surface', 'moderate', 'deep']).describe('Depth of nuance analysis'),
});

export type NuancePreservationInput = z.infer<typeof NuancePreservationInputSchema>;

const NuanceElementSchema = z.object({
  nuanceType: z.enum([
    'qualification', 'exception', 'context_dependency', 'uncertainty_expression',
    'temporal_limitation', 'scope_limitation', 'conditional_statement', 'degree_variation',
    'perspective_distinction', 'methodological_caveat', 'data_limitation', 'interpretive_note'
  ]),
  originalText: z.string(),
  location: z.string().describe('Where in original content this nuance appears'),
  importance: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string(),
  preservationStatus: z.enum(['fully_preserved', 'partially_preserved', 'lost', 'distorted']),
  synthesizedEquivalent: z.string().optional(),
  impactAssessment: z.object({
    meaningChange: z.enum(['none', 'minor', 'moderate', 'significant', 'major']),
    accuracyImpact: z.enum(['none', 'minor', 'moderate', 'significant', 'major']),
    misleadingPotential: z.enum(['none', 'low', 'moderate', 'high', 'very_high']),
  }),
});

export type NuanceElement = z.infer<typeof NuanceElementSchema>;

const NuancePreservationOutputSchema = z.object({
  preservationSummary: z.object({
    totalNuances: z.number(),
    preservedNuances: z.number(),
    partiallyPreservedNuances: z.number(),
    lostNuances: z.number(),
    distortedNuances: z.number(),
    overallPreservationScore: z.number().min(0).max(100),
    preservationCategory: z.enum(['excellent', 'good', 'fair', 'poor', 'very_poor']),
  }),
  nuanceAnalysis: z.array(NuanceElementSchema),
  preservationConcerns: z.object({
    criticalLosses: z.array(z.string()),
    significantDistortions: z.array(z.string()),
    contextualShifts: z.array(z.string()),
    oversimplifications: z.array(z.string()),
  }),
  recommendations: z.object({
    immediateRevisions: z.array(z.string()),
    addMissingNuances: z.array(z.string()),
    clarifyAmbiguities: z.array(z.string()),
    strengthenQualifications: z.array(z.string()),
  }),
  nuanceMetrics: z.object({
    nuancesByType: z.record(z.number()),
    preservationRateByImportance: z.object({
      critical: z.number(),
      high: z.number(),
      medium: z.number(),
      low: z.number(),
    }),
    distortionRisk: z.enum(['very_low', 'low', 'moderate', 'high', 'very_high']),
    contextualAccuracy: z.number().min(0).max(100),
  }),
});

export type NuancePreservationOutput = z.infer<typeof NuancePreservationOutputSchema>;

// Default output for error cases
const DEFAULT_NUANCE_OUTPUT: NuancePreservationOutput = {
  preservationSummary: {
    totalNuances: 0,
    preservedNuances: 0,
    partiallyPreservedNuances: 0,
    lostNuances: 0,
    distortedNuances: 0,
    overallPreservationScore: 0,
    preservationCategory: 'very_poor',
  },
  nuanceAnalysis: [],
  preservationConcerns: {
    criticalLosses: ['Nuance analysis failed'],
    significantDistortions: ['Unable to assess nuance preservation'],
    contextualShifts: ['Analysis system error'],
    oversimplifications: ['Cannot evaluate synthesis quality'],
  },
  recommendations: {
    immediateRevisions: ['Manual nuance review required'],
    addMissingNuances: ['Implement manual nuance checking'],
    clarifyAmbiguities: ['Review original content manually'],
    strengthenQualifications: ['Add appropriate qualifications manually'],
  },
  nuanceMetrics: {
    nuancesByType: {},
    preservationRateByImportance: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    distortionRisk: 'very_high',
    contextualAccuracy: 0,
  },
};

// Nuance detection functions
function detectQualifications(text: string): NuanceElement[] {
  const qualificationIndicators = [
    'however', 'but', 'although', 'while', 'whereas', 'except', 'unless',
    'provided that', 'subject to', 'with the exception of', 'notwithstanding'
  ];

  const nuances: NuanceElement[] = [];
  
  qualificationIndicators.forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b[^.]*[.]`, 'gi');
    const matches = text.match(regex);
    
    if (matches) {
      matches.forEach(match => {
        nuances.push({
          nuanceType: 'qualification',
          originalText: match.trim(),
          location: `Contains "${indicator}" qualification`,
          importance: 'medium',
          description: `Qualification statement that modifies the main claim`,
          preservationStatus: 'lost', // Will be assessed later
          impactAssessment: {
            meaningChange: 'moderate',
            accuracyImpact: 'moderate',
            misleadingPotential: 'moderate',
          },
        });
      });
    }
  });

  return nuances;
}

function detectUncertaintyExpressions(text: string): NuanceElement[] {
  const uncertaintyIndicators = [
    'may', 'might', 'could', 'possibly', 'potentially', 'likely', 'probably',
    'appears to', 'seems to', 'suggests that', 'indicates that', 'uncertain',
    'unclear', 'ambiguous', 'approximately', 'roughly', 'around', 'about'
  ];

  const nuances: NuanceElement[] = [];
  
  uncertaintyIndicators.forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b[^.]*[.]`, 'gi');
    const matches = text.match(regex);
    
    if (matches) {
      matches.forEach(match => {
        nuances.push({
          nuanceType: 'uncertainty_expression',
          originalText: match.trim(),
          location: `Contains "${indicator}" uncertainty expression`,
          importance: 'high',
          description: `Expression of uncertainty or probability`,
          preservationStatus: 'lost', // Will be assessed later
          impactAssessment: {
            meaningChange: 'significant',
            accuracyImpact: 'significant',
            misleadingPotential: 'high',
          },
        });
      });
    }
  });

  return nuances;
}

function detectConditionalStatements(text: string): NuanceElement[] {
  const conditionalIndicators = [
    'if', 'when', 'only if', 'provided', 'assuming', 'given that',
    'in the event that', 'on condition that', 'contingent upon'
  ];

  const nuances: NuanceElement[] = [];
  
  conditionalIndicators.forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b[^.]*[.]`, 'gi');
    const matches = text.match(regex);
    
    if (matches) {
      matches.forEach(match => {
        nuances.push({
          nuanceType: 'conditional_statement',
          originalText: match.trim(),
          location: `Contains "${indicator}" conditional`,
          importance: 'high',
          description: `Conditional statement that limits applicability`,
          preservationStatus: 'lost', // Will be assessed later
          impactAssessment: {
            meaningChange: 'significant',
            accuracyImpact: 'significant',
            misleadingPotential: 'high',
          },
        });
      });
    }
  });

  return nuances;
}

function detectScopeTemporalLimitations(text: string): NuanceElement[] {
  const scopeIndicators = [
    'in this context', 'for this study', 'within this framework', 'limited to',
    'specifically', 'particularly', 'only applies to', 'restricted to'
  ];

  const temporalIndicators = [
    'currently', 'at present', 'as of', 'during', 'between', 'from',
    'until', 'before', 'after', 'historically', 'recently', 'temporarily'
  ];

  const nuances: NuanceElement[] = [];

  [...scopeIndicators, ...temporalIndicators].forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b[^.]*[.]`, 'gi');
    const matches = text.match(regex);
    
    if (matches) {
      matches.forEach(match => {
        const isScope = scopeIndicators.includes(indicator);
        nuances.push({
          nuanceType: isScope ? 'scope_limitation' : 'temporal_limitation',
          originalText: match.trim(),
          location: `Contains "${indicator}" ${isScope ? 'scope' : 'temporal'} limitation`,
          importance: 'medium',
          description: `${isScope ? 'Scope' : 'Temporal'} limitation that bounds the claim`,
          preservationStatus: 'lost', // Will be assessed later
          impactAssessment: {
            meaningChange: 'moderate',
            accuracyImpact: 'moderate',
            misleadingPotential: 'moderate',
          },
        });
      });
    }
  });

  return nuances;
}

function detectDegreeVariations(text: string): NuanceElement[] {
  const degreeIndicators = [
    'very', 'extremely', 'highly', 'significantly', 'substantially', 'markedly',
    'slightly', 'somewhat', 'moderately', 'partially', 'largely', 'mostly',
    'primarily', 'mainly', 'generally', 'typically', 'usually', 'often'
  ];

  const nuances: NuanceElement[] = [];
  
  degreeIndicators.forEach(indicator => {
    const regex = new RegExp(`\\b${indicator}\\b[^.]*[.]`, 'gi');
    const matches = text.match(regex);
    
    if (matches) {
      matches.forEach(match => {
        nuances.push({
          nuanceType: 'degree_variation',
          originalText: match.trim(),
          location: `Contains "${indicator}" degree modifier`,
          importance: 'medium',
          description: `Degree modifier that affects the strength of the claim`,
          preservationStatus: 'lost', // Will be assessed later
          impactAssessment: {
            meaningChange: 'minor',
            accuracyImpact: 'minor',
            misleadingPotential: 'low',
          },
        });
      });
    }
  });

  return nuances;
}

// Preservation assessment functions
function assessNuancePreservation(nuance: NuanceElement, synthesizedContent: string): NuanceElement {
  const keywords = extractKeywords(nuance.originalText);
  let preservationStatus: NuanceElement['preservationStatus'] = 'lost';
  let synthesizedEquivalent: string | undefined;

  // Check for direct preservation
  if (synthesizedContent.toLowerCase().includes(nuance.originalText.toLowerCase())) {
    preservationStatus = 'fully_preserved';
    synthesizedEquivalent = nuance.originalText;
  } else {
    // Check for partial preservation via keywords
    const foundKeywords = keywords.filter(keyword => 
      synthesizedContent.toLowerCase().includes(keyword.toLowerCase())
    );

    if (foundKeywords.length >= keywords.length * 0.7) {
      preservationStatus = 'partially_preserved';
      synthesizedEquivalent = `Partially preserved via: ${foundKeywords.join(', ')}`;
    } else if (foundKeywords.length > 0) {
      preservationStatus = 'partially_preserved';
      synthesizedEquivalent = `Limited preservation via: ${foundKeywords.join(', ')}`;
    }

    // Check for distortion (opposite meaning)
    const oppositeIndicators = getOppositeIndicators(nuance.nuanceType);
    const hasOpposite = oppositeIndicators.some(indicator =>
      synthesizedContent.toLowerCase().includes(indicator.toLowerCase())
    );

    if (hasOpposite) {
      preservationStatus = 'distorted';
      synthesizedEquivalent = 'Distorted with opposite meaning';
    }
  }

  return {
    ...nuance,
    preservationStatus,
    synthesizedEquivalent,
  };
}

function extractKeywords(text: string): string[] {
  // Extract meaningful keywords from the nuance text
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'that', 'this', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'];
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .slice(0, 5); // Take top 5 keywords
}

function getOppositeIndicators(nuanceType: NuanceElement['nuanceType']): string[] {
  const oppositeMap: Record<string, string[]> = {
    'uncertainty_expression': ['certainly', 'definitely', 'absolutely', 'without doubt'],
    'qualification': ['always', 'never', 'all', 'none', 'completely'],
    'conditional_statement': ['unconditionally', 'always applies', 'in all cases'],
    'temporal_limitation': ['permanently', 'always', 'forever', 'indefinitely'],
    'scope_limitation': ['universally', 'in all contexts', 'everywhere'],
    'degree_variation': ['completely', 'absolutely', 'totally', 'entirely'],
  };

  return oppositeMap[nuanceType] || [];
}

export async function checkNuancePreservation(input: NuancePreservationInput): Promise<NuancePreservationOutput> {
  try {
    console.log('NuancePreservationAgent: Starting nuance preservation analysis...');

    if (!input.originalContent || !input.synthesizedContent) {
      console.warn('NuancePreservationAgent: Missing content for analysis');
      return {
        ...DEFAULT_NUANCE_OUTPUT,
        preservationConcerns: {
          ...DEFAULT_NUANCE_OUTPUT.preservationConcerns,
          criticalLosses: ['Missing original or synthesized content'],
        },
      };
    }

    // Detect all types of nuances in original content
    let detectedNuances: NuanceElement[] = [];

    if (input.analysisDepth !== 'surface') {
      detectedNuances = detectedNuances.concat(detectQualifications(input.originalContent));
      detectedNuances = detectedNuances.concat(detectUncertaintyExpressions(input.originalContent));
      detectedNuances = detectedNuances.concat(detectConditionalStatements(input.originalContent));
    }

    if (input.analysisDepth === 'deep') {
      detectedNuances = detectedNuances.concat(detectScopeTemporalLimitations(input.originalContent));
      detectedNuances = detectedNuances.concat(detectDegreeVariations(input.originalContent));
    }

    // Add contextual factors as nuances
    input.contextualFactors.forEach(factor => {
      detectedNuances.push({
        nuanceType: 'context_dependency',
        originalText: factor.description,
        location: 'Contextual factor',
        importance: factor.importance,
        description: factor.factor,
        preservationStatus: 'lost', // Will be assessed
        impactAssessment: {
          meaningChange: factor.importance === 'critical' ? 'major' : factor.importance === 'high' ? 'significant' : 'moderate',
          accuracyImpact: factor.importance === 'critical' ? 'major' : factor.importance === 'high' ? 'significant' : 'moderate',
          misleadingPotential: factor.importance === 'critical' ? 'very_high' : factor.importance === 'high' ? 'high' : 'moderate',
        },
      });
    });

    // Assess preservation for each nuance
    const assessedNuances = detectedNuances.map(nuance => 
      assessNuancePreservation(nuance, input.synthesizedContent)
    );

    // Calculate preservation statistics
    const totalNuances = assessedNuances.length;
    const preservedNuances = assessedNuances.filter(n => n.preservationStatus === 'fully_preserved').length;
    const partiallyPreservedNuances = assessedNuances.filter(n => n.preservationStatus === 'partially_preserved').length;
    const lostNuances = assessedNuances.filter(n => n.preservationStatus === 'lost').length;
    const distortedNuances = assessedNuances.filter(n => n.preservationStatus === 'distorted').length;

    // Calculate preservation score
    const preservationScore = totalNuances > 0 ? 
      (preservedNuances * 100 + partiallyPreservedNuances * 50) / totalNuances : 100;

    let preservationCategory: NuancePreservationOutput['preservationSummary']['preservationCategory'];
    if (preservationScore >= 90) preservationCategory = 'excellent';
    else if (preservationScore >= 75) preservationCategory = 'good';
    else if (preservationScore >= 60) preservationCategory = 'fair';
    else if (preservationScore >= 40) preservationCategory = 'poor';
    else preservationCategory = 'very_poor';

    // Identify concerns
    const criticalLosses = assessedNuances
      .filter(n => n.importance === 'critical' && (n.preservationStatus === 'lost' || n.preservationStatus === 'distorted'))
      .map(n => `Critical nuance lost: ${n.description}`);

    const significantDistortions = assessedNuances
      .filter(n => n.preservationStatus === 'distorted')
      .map(n => `Distorted nuance: ${n.description}`);

    const contextualShifts = assessedNuances
      .filter(n => n.nuanceType === 'context_dependency' && n.preservationStatus !== 'fully_preserved')
      .map(n => `Context shift: ${n.description}`);

    const oversimplifications = assessedNuances
      .filter(n => ['qualification', 'conditional_statement'].includes(n.nuanceType) && n.preservationStatus === 'lost')
      .map(n => `Oversimplification: ${n.description}`);

    // Generate recommendations
    const immediateRevisions = criticalLosses.length > 0 ? 
      [`Address ${criticalLosses.length} critical nuance losses`] : [];

    const addMissingNuances = assessedNuances
      .filter(n => n.preservationStatus === 'lost' && n.importance !== 'low')
      .slice(0, 3)
      .map(n => `Add missing nuance: ${n.description}`);

    const clarifyAmbiguities = assessedNuances
      .filter(n => n.preservationStatus === 'partially_preserved')
      .slice(0, 3)
      .map(n => `Clarify partial preservation: ${n.description}`);

    const strengthenQualifications = assessedNuances
      .filter(n => n.nuanceType === 'qualification' && n.preservationStatus !== 'fully_preserved')
      .slice(0, 3)
      .map(n => `Strengthen qualification: ${n.description}`);

    // Calculate metrics
    const nuancesByType: Record<string, number> = {};
    assessedNuances.forEach(n => {
      nuancesByType[n.nuanceType] = (nuancesByType[n.nuanceType] || 0) + 1;
    });

    const preservationRateByImportance = {
      critical: calculatePreservationRate(assessedNuances.filter(n => n.importance === 'critical')),
      high: calculatePreservationRate(assessedNuances.filter(n => n.importance === 'high')),
      medium: calculatePreservationRate(assessedNuances.filter(n => n.importance === 'medium')),
      low: calculatePreservationRate(assessedNuances.filter(n => n.importance === 'low')),
    };

    let distortionRisk: NuancePreservationOutput['nuanceMetrics']['distortionRisk'];
    const distortionRate = distortedNuances / Math.max(totalNuances, 1);
    if (distortionRate >= 0.3) distortionRisk = 'very_high';
    else if (distortionRate >= 0.2) distortionRisk = 'high';
    else if (distortionRate >= 0.1) distortionRisk = 'moderate';
    else if (distortionRate > 0) distortionRisk = 'low';
    else distortionRisk = 'very_low';

    const contextualAccuracy = Math.max(0, preservationScore - (distortionRate * 50));

    const result: NuancePreservationOutput = {
      preservationSummary: {
        totalNuances,
        preservedNuances,
        partiallyPreservedNuances,
        lostNuances,
        distortedNuances,
        overallPreservationScore: Math.round(preservationScore),
        preservationCategory,
      },
      nuanceAnalysis: assessedNuances,
      preservationConcerns: {
        criticalLosses: criticalLosses.length > 0 ? criticalLosses : ['No critical nuance losses identified'],
        significantDistortions: significantDistortions.length > 0 ? significantDistortions : ['No significant distortions identified'],
        contextualShifts: contextualShifts.length > 0 ? contextualShifts : ['No problematic contextual shifts identified'],
        oversimplifications: oversimplifications.length > 0 ? oversimplifications : ['No concerning oversimplifications identified'],
      },
      recommendations: {
        immediateRevisions: immediateRevisions.length > 0 ? immediateRevisions : ['No immediate revisions needed'],
        addMissingNuances: addMissingNuances.length > 0 ? addMissingNuances : ['No missing nuances to add'],
        clarifyAmbiguities: clarifyAmbiguities.length > 0 ? clarifyAmbiguities : ['No ambiguities to clarify'],
        strengthenQualifications: strengthenQualifications.length > 0 ? strengthenQualifications : ['No qualifications to strengthen'],
      },
      nuanceMetrics: {
        nuancesByType,
        preservationRateByImportance,
        distortionRisk,
        contextualAccuracy: Math.round(contextualAccuracy),
      },
    };

    console.log('NuancePreservationAgent: Analysis completed', {
      totalNuances,
      preservationScore: Math.round(preservationScore),
      category: preservationCategory,
      criticalLosses: criticalLosses.length,
    });

    return result;

  } catch (error: any) {
    console.error('NuancePreservationAgent: Error in nuance preservation analysis', { error: error.message });
    return DEFAULT_NUANCE_OUTPUT;
  }
}

function calculatePreservationRate(nuances: NuanceElement[]): number {
  if (nuances.length === 0) return 100;
  
  const preserved = nuances.filter(n => n.preservationStatus === 'fully_preserved').length;
  const partial = nuances.filter(n => n.preservationStatus === 'partially_preserved').length;
  
  return Math.round((preserved * 100 + partial * 50) / nuances.length);
}

// Export the flow for use in orchestration
export const nuancePreservationFlow = ai.defineFlow(
  {
    name: 'nuancePreservationFlow',
    inputSchema: NuancePreservationInputSchema,
    outputSchema: NuancePreservationOutputSchema,
  },
  checkNuancePreservation
); 