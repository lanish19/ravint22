'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Import all agent functions and types
import { respond, type RespondOutput } from './responder-agent';
import { analyzeAssumptions, type AnalyzeAssumptionsOutput } from './assumption-analyzer-agent';
import { researchEvidence, type ResearchEvidenceOutput } from './researcher-agent';
import { researchCounterEvidence, type ResearchCounterEvidenceOutput } from './counter-evidence-researcher-agent';
import { critiqueAgent, type CritiqueAgentOutput } from './critic-agent';
import { challenge, type ChallengeOutput } from './devils-advocate-agent';
import { analyzeFailures, type PremortemOutput } from './premortem-agent';
import { analyzeInformationGaps, type InformationGapOutput } from './information-gap-agent';
import { synthesizeAnalysis, type SynthesisAgentOutput } from './synthesis-agent';

// Import new agents
import { refineQuery, type QueryRefinementOutput } from './query-refinement-agent';
import { runInitialAnswerLoop, type InitialAnswerLoopOutput } from './initial-answer-loop-agent';
import { detectBiases, type BiasDetectionOutput } from './bias-detection-agent';
import { crossReferenceBiases, type BiasCrossReferencingOutput } from './bias-cross-referencing-agent';
import { resolveEvidenceConflicts, type EvidenceConflictResolutionOutput } from './evidence-conflict-resolution-agent';
import { runSynthesisEnsemble, type SynthesisEnsembleOutput } from './synthesis-ensemble-agent';
import { reconstructArgument, type ArgumentReconstructionOutput } from './argument-reconstruction-agent';
import { integrateCounterArguments, type CounterArgumentIntegrationOutput } from './counter-argument-integration-agent';
import { assessImpact, type ImpactAssessmentOutput } from './impact-assessment-agent';
import { scoreConfidence, type ConfidenceScoringOutput } from './confidence-scoring-agent';
import { runRedTeamingLoop, type RedTeamingLoopOutput } from './red-teaming-loop-agent';
import { requestHumanReview, type HumanReviewOutput } from './human-review-tool';
import { checkQuality, type QualityCheckOutput } from './quality-check-agent';
import { analyzeSensitivity, type SensitivityAnalysisOutput } from './sensitivity-analysis-agent';
import { verifyFacts, type FactVerificationOutput } from './fact-verification-loop-agent';
import { checkNuancePreservation, type NuancePreservationOutput } from './nuance-preservation-check-agent';
import { critiqueSynthesis, type SynthesisCritiqueLoopOutput } from './synthesis-critique-loop-agent';
import { routeAnalyticalAgents, type DynamicRoutingOutput } from './dynamic-routing-coordinator-agent';

// Enhanced Error Information Schema
const ErrorInfoSchema = z.object({
  agent: z.string(),
  error: z.string(),
  timestamp: z.string(),
  recoveryAttempted: z.boolean().default(false),
  recoveryStrategy: z.string().optional(),
});

// Helper function to get default outputs for agents
function getDefaultOutputForAgent(agentName: string): any {
  const defaults = {
    'AnalyzeAssumptionsAgent': [],
    'ResearcherAgent': [],
    'CounterEvidenceResearcherAgent': [],
    'PremortemAgent': [],
    'InformationGapAgent': [],
    'BiasDetectionAgent': {
      detectedBiases: [],
      biasAnalysis: '',
      riskLevel: 'low' as const,
      recommendations: [],
    },
    'CritiqueAgent': '',
    'EvidenceConflictResolutionAgent': {
      identifiedConflicts: [],
      resolutionAnalysis: '',
      synthesisGuidance: 'Unable to analyze conflicts',
    },
  };
  return defaults[agentName as keyof typeof defaults] || {};
}

// Session State Schema - Standardized state management
const SessionStateSchema = z.object({
  // Original query and refined query
  originalQuery: z.string(),
  refinedQuery: z.string().optional(),
  
  // Phase 1 outputs
  initialAnswerText: z.string().optional(),
  
  // Phase 2 outputs
  assumptions: z.any().optional(),
  aggregatedSupportingResearch: z.any().optional(),
  aggregatedCounterResearch: z.any().optional(),
  routingDecision: z.any().optional(),
  
  // Phase 3 outputs
  potentialBiases: z.any().optional(),
  crossReferencedBiasReport: z.any().optional(),
  conflictResolutionAnalysis: z.any().optional(),
  stressTestedArgument: z.string().optional(),
  
  // Phase 4 outputs
  balancedBrief: z.any().optional(),
  pressureTestedBrief: z.any().optional(),
  impactAssessments: z.any().optional(),
  qualityScores: z.any().optional(),
  overallConfidence: z.any().optional(),
  sensitivityAnalysisReport: z.any().optional(),
  
  // Phase 5 outputs
  draftSynthesisOutput: z.any().optional(),
  factCheckedSynthesisOutput: z.any().optional(),
  nuancePreservationReport: z.any().optional(),
  finalRefinedSynthesisOutput: z.any().optional(),
  
  // Error tracking
  errorsEncountered: z.array(ErrorInfoSchema).default([]),
  
  // Artifacts tracking
  artifacts: z.record(z.string(), z.any()).default({}),
});

export type SessionState = z.infer<typeof SessionStateSchema>;

// Master Orchestrator Input/Output Schemas
const MasterOrchestratorInputSchema = z.object({
  query: z.string(),
  // Optional configuration
  enableHumanReview: z.boolean().default(false),
  confidenceThresholdForHumanReview: z.enum(['High', 'Medium', 'Low']).default('Low'),
  maxRetries: z.number().default(3),
});

export type MasterOrchestratorInput = z.infer<typeof MasterOrchestratorInputSchema>;

const MasterOrchestratorOutputSchema = z.object({
  success: z.boolean(),
  finalSynthesis: z.any().optional(),
  sessionState: SessionStateSchema,
  humanReviewRequired: z.boolean().default(false),
  humanReviewReason: z.string().optional(),
});

export type MasterOrchestratorOutput = z.infer<typeof MasterOrchestratorOutputSchema>;

// Error Handling & Recovery Coordinator (E15 & F10)
class ErrorHandlingAndRecoveryCoordinator {
  private maxRetries: number;
  
  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }
  
  async callAgentWithRecovery<TInput, TOutput>(
    agentName: string,
    agentFn: (input: TInput) => Promise<TOutput>,
    input: TInput,
    defaultOutput: TOutput,
    sessionState: SessionState,
    options?: {
      criticalAgent?: boolean;
      backupAgentFn?: (input: TInput) => Promise<TOutput>;
      validateOutput?: (output: TOutput) => boolean;
    }
  ): Promise<TOutput> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`MasterOrchestrator: Calling ${agentName} (Attempt ${attempt + 1})...`);
        
        const result = await agentFn(input);
        
        // Validate output if validator provided
        if (options?.validateOutput && !options.validateOutput(result)) {
          throw new Error(`Output validation failed for ${agentName}`);
        }
        
        console.log(`MasterOrchestrator: ${agentName} successful.`);
        return result;
        
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;
        
        console.error(`MasterOrchestrator: ${agentName} failed on attempt ${attempt + 1}.`, {
          error: errorMessage,
          input: JSON.stringify(input).substring(0, 200),
        });
        
        // Add error to session state
        sessionState.errorsEncountered.push({
          agent: agentName,
          error: errorMessage,
          timestamp: new Date().toISOString(),
          recoveryAttempted: true,
          recoveryStrategy: attempt < this.maxRetries - 1 ? 'retry' : 'default',
        });
        
        // If not the last attempt, wait with exponential backoff
        if (attempt < this.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
      }
    }
    
    // Try backup agent if provided
    if (options?.backupAgentFn) {
      try {
        console.log(`MasterOrchestrator: Attempting backup agent for ${agentName}...`);
        const backupResult = await options.backupAgentFn(input);
        
        sessionState.errorsEncountered[sessionState.errorsEncountered.length - 1].recoveryStrategy = 'backup_agent';
        return backupResult;
      } catch (backupError: any) {
        console.error(`MasterOrchestrator: Backup agent for ${agentName} also failed.`, {
          error: backupError.message,
        });
      }
    }
    
    // If critical agent and all recovery failed, throw error for escalation
    if (options?.criticalAgent) {
      throw new Error(`Critical agent ${agentName} failed after all recovery attempts: ${lastError?.message}`);
    }
    
    // Return default output for non-critical agents
    console.warn(`MasterOrchestrator: Returning default output for ${agentName}.`);
    return defaultOutput;
  }
  
  saveArtifact(sessionState: SessionState, name: string, data: any) {
    // F8 Part 2: Structured Logging/Artifacts
    sessionState.artifacts[name] = data;
    console.log(`MasterOrchestrator: Saved artifact '${name}'`);
  }
}

// Master Orchestrator Agent Implementation
export async function orchestrateWithMaster(
  input: MasterOrchestratorInput
): Promise<MasterOrchestratorOutput> {
  // Validate input
  const parsedInput = MasterOrchestratorInputSchema.safeParse(input);
  if (!parsedInput.success) {
    console.error('MasterOrchestrator: Invalid input', { error: parsedInput.error.flatten(), input });
    return {
      success: false,
      sessionState: {
        originalQuery: input.query || '',
        refinedQuery: undefined,
        errorsEncountered: [{
          agent: 'MasterOrchestrator',
          error: `Invalid input: ${parsedInput.error.message}`,
          timestamp: new Date().toISOString(),
          recoveryAttempted: false,
        }],
        artifacts: {},
      } as SessionState,
      humanReviewRequired: false,
    };
  }
  
  // Initialize session state
  const sessionState: SessionState = {
    originalQuery: parsedInput.data.query,
    refinedQuery: undefined,
    errorsEncountered: [],
    artifacts: {},
  };
  
  // Initialize error handling coordinator
  const errorCoordinator = new ErrorHandlingAndRecoveryCoordinator(parsedInput.data.maxRetries);
  
  try {
    console.log('MasterOrchestrator: Starting enhanced analytical workflow...');
    
    // === PHASE 1: Query Intake & Initial Answer Formulation ===
    console.log('MasterOrchestrator: Phase 1 - Query Intake & Initial Answer Formulation');
    
    // E1: Query Refinement
    const queryRefinementOutput = await errorCoordinator.callAgentWithRecovery(
      'QueryRefinementAgent',
      refineQuery,
      { query: sessionState.originalQuery },
      {
        originalQuery: sessionState.originalQuery,
        refinedQuery: sessionState.originalQuery,
        refinementReason: 'Query refinement failed',
        identifiedIssues: [],
        clarificationQuestions: [],
      },
      sessionState
    );
    
    sessionState.refinedQuery = queryRefinementOutput.refinedQuery;
    errorCoordinator.saveArtifact(sessionState, 'query_refinement', queryRefinementOutput);
    
    // E4: Initial Answer Generation Loop
    const initialAnswerLoopOutput = await errorCoordinator.callAgentWithRecovery(
      'InitialAnswerLoopAgent',
      runInitialAnswerLoop,
      { refinedQuery: sessionState.refinedQuery, maxIterations: 3 },
      {
        finalAnswer: 'Initial answer generation failed',
        iterations: 0,
        improvementHistory: [],
      },
      sessionState,
      {
        criticalAgent: true,
        validateOutput: (output) => !!(output.finalAnswer && output.finalAnswer.trim() !== ''),
      }
    );
    
    sessionState.initialAnswerText = initialAnswerLoopOutput.finalAnswer;
    errorCoordinator.saveArtifact(sessionState, 'initial_answer_loop', initialAnswerLoopOutput);
    
    // === PHASE 2: Evidence Gathering & Multi-Perspective Analysis ===
    console.log('MasterOrchestrator: Phase 2 - Evidence Gathering & Analysis');
    
    // E3: Dynamic Routing Coordinator - Intelligently determine which analytical agents to call
    const routingDecision = await errorCoordinator.callAgentWithRecovery(
      'DynamicRoutingCoordinatorAgent',
      routeAnalyticalAgents,
      {
        refinedQuery: sessionState.refinedQuery,
        initialAnswerText: sessionState.initialAnswerText,
        availableAgents: [
          'AnalyzeAssumptionsAgent',
          'ResearcherAgent', 
          'CounterEvidenceResearcherAgent',
          'PremortemAgent',
          'InformationGapAgent',
          'BiasDetectionAgent',
          'CritiqueAgent',
          'EvidenceConflictResolutionAgent'
        ],
      },
      {
        recommendedAgents: [
          {
            agentName: 'AnalyzeAssumptionsAgent',
            priority: 'high',
            reasoning: 'Default routing - assumptions analysis is critical for most queries',
            executionOrder: 1,
          },
          {
            agentName: 'ResearcherAgent',
            priority: 'high',
            reasoning: 'Default routing - evidence gathering is essential',
            executionOrder: 2,
          },
        ],
        parallelExecutionGroups: [
          ['AnalyzeAssumptionsAgent', 'ResearcherAgent', 'CounterEvidenceResearcherAgent'],
        ],
        sequentialDependencies: [],
        analysisStrategy: {
          approach: 'comprehensive',
          reasoning: 'Default comprehensive analysis due to routing failure',
          estimatedComplexity: 'medium',
          riskLevel: 'medium',
        },
        optimizations: {
          canSkipAgents: [],
          prioritizeAgents: ['AnalyzeAssumptionsAgent', 'ResearcherAgent'],
          resourceAllocation: 'standard',
        },
      },
      sessionState
    );
    
    sessionState.routingDecision = routingDecision;
    errorCoordinator.saveArtifact(sessionState, 'routing_decision', routingDecision);
    
    console.log('MasterOrchestrator: Using routing strategy', {
      approach: routingDecision.analysisStrategy.approach,
      complexity: routingDecision.analysisStrategy.estimatedComplexity,
      agents: routingDecision.recommendedAgents.length,
    });
    
    // Execute Phase 2 based on routing decision - run agents in parallel with routing optimization
    console.log('MasterOrchestrator: Phase 2 - Evidence Gathering (Dynamic Routing)');
    
    // Use routing decision to determine execution approach, but keep existing parallel structure for reliability
    console.log('MasterOrchestrator: Using routing strategy', {
      approach: routingDecision.analysisStrategy.approach,
      complexity: routingDecision.analysisStrategy.estimatedComplexity,
      agents: routingDecision.recommendedAgents.length,
    });
    
    const [assumptionsResult, researchResult, counterEvidenceResult, premortemResult, informationGapsResult] = 
      await Promise.all([
        errorCoordinator.callAgentWithRecovery(
          'AnalyzeAssumptionsAgent',
          analyzeAssumptions,
          { answer: sessionState.initialAnswerText },
          getDefaultOutputForAgent('AnalyzeAssumptionsAgent'),
          sessionState
        ),
        errorCoordinator.callAgentWithRecovery(
          'ResearcherAgent',
          researchEvidence,
          { claim: sessionState.initialAnswerText },
          getDefaultOutputForAgent('ResearcherAgent'),
          sessionState
        ),
        errorCoordinator.callAgentWithRecovery(
          'CounterEvidenceResearcherAgent',
          researchCounterEvidence,
          { claim: sessionState.initialAnswerText },
          getDefaultOutputForAgent('CounterEvidenceResearcherAgent'),
          sessionState
        ),
        errorCoordinator.callAgentWithRecovery(
          'PremortemAgent',
          analyzeFailures,
          { answer: sessionState.initialAnswerText },
          getDefaultOutputForAgent('PremortemAgent'),
          sessionState
        ),
        errorCoordinator.callAgentWithRecovery(
          'InformationGapAgent',
          analyzeInformationGaps,
          { answer: sessionState.initialAnswerText },
          getDefaultOutputForAgent('InformationGapAgent'),
          sessionState
        ),
      ]);
    
    // === PHASE 3: In-Depth Analysis, Challenge, and Bias Mitigation ===
    console.log('MasterOrchestrator: Phase 3 - In-Depth Analysis & Challenge (Parallel Optimization)');
    
    // Parallel execution optimization - Independent analysis agents can run concurrently
    const [biasDetectionOutput, critiqueResult, challengeResult, premortemAnalysis] = 
      await Promise.all([
        // E2: Bias Detection - Can run in parallel as it only needs initial inputs
        errorCoordinator.callAgentWithRecovery(
          'BiasDetectionAgent',
          detectBiases,
          {
            initialAnswerText: sessionState.initialAnswerText,
            aggregatedSupportingResearch: researchResult,
            aggregatedCounterResearch: counterEvidenceResult,
          },
          [],
          sessionState
        ),
        
        // Run critique in parallel - independent analysis
        errorCoordinator.callAgentWithRecovery(
          'CritiqueAgent',
          critiqueAgent,
          { 
            answer: sessionState.initialAnswerText,
            evidence: researchResult || []
          },
          'Critique generation failed.',
          sessionState
        ),
        
        // Run challenge in parallel - independent analysis
        errorCoordinator.callAgentWithRecovery(
          'DevilsAdvocateAgent',
          challenge,
          { 
            answer: sessionState.initialAnswerText,
            critique: '',
          },
          [],
          sessionState
        ),
        
        // Run premortem in parallel - independent analysis
        errorCoordinator.callAgentWithRecovery(
          'PremortemAgent',
          analyzeFailures,
          { answer: sessionState.initialAnswerText },
          [],
          sessionState
        ),
    ]);
    
    sessionState.potentialBiases = biasDetectionOutput;
    errorCoordinator.saveArtifact(sessionState, 'bias_detection', biasDetectionOutput);
    errorCoordinator.saveArtifact(sessionState, 'critique', critiqueResult);
    errorCoordinator.saveArtifact(sessionState, 'challenge', challengeResult);
    errorCoordinator.saveArtifact(sessionState, 'premortem', premortemAnalysis);
    
    // === PHASE 4: Pre-Synthesis Structuring & Quality Assurance ===
    console.log('MasterOrchestrator: Phase 4 - Pre-Synthesis Structuring');
    
    // F2 Part 1: Argument Reconstruction - Create neutral balanced brief
    const argumentReconstructionOutput = await errorCoordinator.callAgentWithRecovery(
      'ArgumentReconstructionAgent',
      reconstructArgument,
      {
        initialAnswerText: sessionState.initialAnswerText,
        stressTestedArgument: sessionState.stressTestedArgument,
        critiqueOutput: critiqueResult,
        challengeOutput: challengeResult,
        aggregatedCounterResearch: counterEvidenceResult,
      },
      {
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
      },
      sessionState
    );
    
    sessionState.balancedBrief = argumentReconstructionOutput.balancedBrief;
    errorCoordinator.saveArtifact(sessionState, 'argument_reconstruction', argumentReconstructionOutput);
    
    // F3 Part 1: Counter-Argument Integration - Deeply integrate counter-evidence
    const counterArgumentIntegrationOutput = await errorCoordinator.callAgentWithRecovery(
      'CounterArgumentIntegrationAgent',
      integrateCounterArguments,
      {
        balancedBrief: sessionState.balancedBrief,
        aggregatedCounterResearch: counterEvidenceResult,
        challengeOutput: challengeResult,
      },
      {
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
      },
      sessionState
    );
    
    sessionState.pressureTestedBrief = counterArgumentIntegrationOutput.pressureTestedBrief;
    errorCoordinator.saveArtifact(sessionState, 'counter_argument_integration', counterArgumentIntegrationOutput);
    
    // F6 Part 1: Impact Assessment - Assess consequences of gaps and assumptions
    const impactAssessmentOutput = await errorCoordinator.callAgentWithRecovery(
      'ImpactAssessmentAgent',
      assessImpact,
      {
        informationGaps: informationGapsResult,
        assumptions: assumptionsResult,
      },
      {
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
      },
      sessionState
    );
    
    sessionState.impactAssessments = impactAssessmentOutput.impactAssessments;
    errorCoordinator.saveArtifact(sessionState, 'impact_assessment', impactAssessmentOutput);
    
    // F4 Part 1: Quality Check - Evaluate quality/confidence of upstream agent outputs
    const qualityCheckOutput = await errorCoordinator.callAgentWithRecovery(
      'QualityCheckAgent',
      checkQuality,
      {
        critiqueOutput: critiqueResult,
        biasDetectionOutput: sessionState.crossReferencedBiasReport,
        researchOutput: researchResult,
        counterResearchOutput: counterEvidenceResult,
        assumptionsOutput: assumptionsResult,
      },
      {
        overallQuality: {
          averageScore: 0,
          category: 'poor',
          summary: 'Quality check failed',
        },
        componentQuality: {
          critiqueQuality: { score: 0, category: 'poor', reasoning: 'Assessment failed', specificIssues: ['Assessment failed'], recommendations: ['Manual review required'] },
          biasDetectionQuality: { score: 0, category: 'poor', reasoning: 'Assessment failed', specificIssues: ['Assessment failed'], recommendations: ['Manual review required'] },
          researchQuality: { score: 0, category: 'poor', reasoning: 'Assessment failed', specificIssues: ['Assessment failed'], recommendations: ['Manual review required'] },
          counterResearchQuality: { score: 0, category: 'poor', reasoning: 'Assessment failed', specificIssues: ['Assessment failed'], recommendations: ['Manual review required'] },
          assumptionsQuality: { score: 0, category: 'poor', reasoning: 'Assessment failed', specificIssues: ['Assessment failed'], recommendations: ['Manual review required'] },
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
      },
      sessionState
    );

    sessionState.qualityScores = {
      critiqueQuality: qualityCheckOutput.componentQuality.critiqueQuality.score,
      biasDetectionQuality: qualityCheckOutput.componentQuality.biasDetectionQuality.score,
      researchQuality: qualityCheckOutput.componentQuality.researchQuality.score,
    };
    errorCoordinator.saveArtifact(sessionState, 'quality_check', qualityCheckOutput);
    
    // E7: Confidence Scoring - Transparent confidence assessment
    const confidenceScoringOutput = await errorCoordinator.callAgentWithRecovery(
      'ConfidenceScoringAgent',
      scoreConfidence,
      {
        pressureTestedBrief: sessionState.pressureTestedBrief,
        aggregatedSupportingResearch: researchResult,
        aggregatedCounterResearch: counterEvidenceResult,
        critiqueOutput: critiqueResult,
        biasReport: sessionState.crossReferencedBiasReport,
        conflictResolutionAnalysis: sessionState.conflictResolutionAnalysis,
        impactAssessments: sessionState.impactAssessments,
        qualityScores: sessionState.qualityScores,
      },
      {
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
      },
      sessionState
    );
    
    sessionState.overallConfidence = confidenceScoringOutput.overallConfidence;
    errorCoordinator.saveArtifact(sessionState, 'confidence_scoring', confidenceScoringOutput);
    
    // E13: Sensitivity Analysis - Test robustness of conclusions under different assumptions
    const sensitivityAnalysisOutput = await errorCoordinator.callAgentWithRecovery(
      'SensitivityAnalysisAgent',
      analyzeSensitivity,
      {
        originalConclusions: [sessionState.initialAnswerText],
        keyAssumptions: assumptionsResult.map((item: any) => ({
          assumption: item.assumption,
          confidence: (item.risk === 'High' ? 'Low' : item.risk === 'Medium' ? 'Medium' : 'High') as 'High' | 'Medium' | 'Low',
          impact: item.risk,
          riskLevel: item.risk,
        })),
        synthesisEvidence: researchResult,
      },
      {
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
      },
      sessionState
    );

    sessionState.sensitivityAnalysisReport = sensitivityAnalysisOutput;
    errorCoordinator.saveArtifact(sessionState, 'sensitivity_analysis', sensitivityAnalysisOutput);
    
    // === PHASE 5: Synthesis, Verification & Refinement ===
    console.log('MasterOrchestrator: Phase 5 - Synthesis & Refinement');
    
    // E14/F7: Synthesis Ensemble - Multi-perspective synthesis
    const synthesisEnsembleOutput = await errorCoordinator.callAgentWithRecovery(
      'SynthesisEnsembleAgent',
      runSynthesisEnsemble,
      {
        pressureTestedBrief: JSON.stringify(sessionState.pressureTestedBrief),
        balancedBrief: JSON.stringify(sessionState.balancedBrief),
        initialAnswerText: sessionState.initialAnswerText,
        impactAssessments: JSON.stringify(sessionState.impactAssessments),
        overallConfidence: sessionState.overallConfidence,
        aggregatedSupportingResearch: researchResult,
        aggregatedCounterResearch: counterEvidenceResult,
        conflictResolutionAnalysis: sessionState.conflictResolutionAnalysis,
        sensitivityAnalysisReport: sessionState.sensitivityAnalysisReport,
        errorsEncountered: sessionState.errorsEncountered.map(e => ({
          agent: e.agent,
          error: e.error,
        })),
      },
      {
        individualPerspectives: [],
        metaSynthesis: {
          confidence: 'Low',
          summary: 'Synthesis ensemble failed',
          keyStrengths: [],
          keyWeaknesses: ['Synthesis failed'],
          howCounterEvidenceWasAddressed: [],
          actionableRecommendations: [],
          remainingUncertainties: ['Synthesis could not be completed'],
          perspectiveDivergence: 'Unable to analyze',
          synthesisApproach: 'Failed',
        },
        errorHandling: {
          criticalFailuresDetected: true,
          failureImpactDescription: 'Synthesis ensemble failed',
        },
      },
      sessionState
    );
    
    sessionState.draftSynthesisOutput = synthesisEnsembleOutput;
    sessionState.finalRefinedSynthesisOutput = synthesisEnsembleOutput.metaSynthesis;
    errorCoordinator.saveArtifact(sessionState, 'synthesis_ensemble', synthesisEnsembleOutput);
    
    // F5: Fact Verification Loop - Iteratively verify key facts and claims for accuracy
    const factVerificationOutput = await errorCoordinator.callAgentWithRecovery(
      'FactVerificationLoopAgent',
      verifyFacts,
      {
        claims: [{
          claim: synthesisEnsembleOutput.metaSynthesis.summary,
          importance: 'high' as const,
          claimType: 'factual' as const,
          source: 'synthesis',
        }],
        verificationDepth: 'standard' as const,
        availableEvidence: [researchResult, counterEvidenceResult],
      },
      {
        verificationSummary: {
          totalClaims: 0,
          verifiedClaims: 0,
          contradictedClaims: 0,
          unverifiedClaims: 0,
          overallReliability: 'very_low',
          averageConfidence: 0,
        },
        claimVerifications: [],
        verificationConcerns: {
          criticalIssues: ['Fact verification failed'],
          moderateIssues: ['Unable to process claims'],
          methodologyLimitations: ['Verification system error'],
          dataQualityIssues: ['No data available for verification'],
        },
        recommendations: {
          immediateActions: ['Manual fact verification required'],
          additionalVerification: ['Implement manual verification process'],
          confidenceAdjustments: ['Significantly reduce confidence due to verification failure'],
          claimModifications: ['Review all claims manually'],
        },
        verificationMetrics: {
          totalVerificationAttempts: 0,
          averageAttemptsPerClaim: 0,
          successfulVerificationRate: 0,
          evidenceQualityDistribution: {
            high: 0,
            medium: 0,
            low: 0,
            unknown: 1,
          },
        },
      },
      sessionState
    );
    
    errorCoordinator.saveArtifact(sessionState, 'fact_verification', factVerificationOutput);
    
    // F8 Part 1: Nuance Preservation Check - Ensure important nuances and subtleties are preserved
    const nuancePreservationOutput = await errorCoordinator.callAgentWithRecovery(
      'NuancePreservationCheckAgent',
      checkNuancePreservation,
      {
        originalContent: sessionState.initialAnswerText,
        synthesizedContent: synthesisEnsembleOutput.metaSynthesis.summary,
        contextualFactors: [],
        analysisDepth: 'moderate' as const,
      },
      {
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
      },
      sessionState
    );
    
    errorCoordinator.saveArtifact(sessionState, 'nuance_preservation', nuancePreservationOutput);
    
    // F9: Synthesis Critique Loop - Iteratively critique and refine the synthesis
    const synthesisCritiqueOutput = await errorCoordinator.callAgentWithRecovery(
      'SynthesisCritiqueLoopAgent',
      critiqueSynthesis,
      {
        synthesis: synthesisEnsembleOutput.metaSynthesis.summary,
        originalData: [sessionState.initialAnswerText],
        analysisContext: JSON.stringify({
          qualityCheck: qualityCheckOutput,
          factVerification: factVerificationOutput,
          nuancePreservation: nuancePreservationOutput,
        }),
        previousCritiques: [],
      },
      {
        critiqueResults: {
          overallAssessment: 'Synthesis critique failed',
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
            convergenceAssessment: 'Analysis incomplete',
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
          immediateActions: ['Manual synthesis review required'],
          structuralChanges: ['Complete critique process manually'],
          contentEnhancements: ['Lower confidence due to incomplete critique'],
          methodologyImprovements: [],
        },
        nextSteps: {
          requiresRevision: true,
          revisionPriority: 'high',
          focusAreas: ['error_resolution'],
          estimatedEffort: 'substantial'
        },
      },
      sessionState
    );
    
    // Update final synthesis with improved version - use the original synthesis since critique failed
    sessionState.finalRefinedSynthesisOutput = {
      ...synthesisEnsembleOutput.metaSynthesis,
      summary: synthesisEnsembleOutput.metaSynthesis.summary,
      confidence: synthesisEnsembleOutput.metaSynthesis.confidence,
      remainingUncertainties: [
        ...synthesisEnsembleOutput.metaSynthesis.remainingUncertainties,
        'Synthesis critique process incomplete'
      ],
    };
    
    errorCoordinator.saveArtifact(sessionState, 'synthesis_critique', synthesisCritiqueOutput);
    
    // === PHASE 6: Human Review & Finalization ===
    console.log('MasterOrchestrator: Phase 6 - Final Review');
    
    // E10: Human-in-the-Loop
    let humanReviewRequired = false;
    let humanReviewReason = '';
    let humanReviewResult: HumanReviewOutput | null = null;
    
    // Check if human review is needed based on confidence or errors
    if (parsedInput.data.enableHumanReview) {
      const confidenceLevels = { 'High': 3, 'Medium': 2, 'Low': 1 };
      const thresholdLevel = confidenceLevels[parsedInput.data.confidenceThresholdForHumanReview];
      const actualLevel = confidenceLevels[synthesisEnsembleOutput.metaSynthesis.confidence];
      
      if (actualLevel <= thresholdLevel) {
        humanReviewRequired = true;
        humanReviewReason = `Confidence level (${synthesisEnsembleOutput.metaSynthesis.confidence}) is at or below threshold (${parsedInput.data.confidenceThresholdForHumanReview})`;
      }
      
      // Also check for critical errors
      const criticalErrors = sessionState.errorsEncountered.filter(e => 
        e.agent.includes('Critical') || e.error.includes('Critical')
      );
      
      if (criticalErrors.length > 0) {
        humanReviewRequired = true;
        humanReviewReason = `Critical errors encountered: ${criticalErrors.map(e => e.agent).join(', ')}`;
      }
      
      // Trigger human review if needed
      if (humanReviewRequired) {
        console.log('MasterOrchestrator: Triggering human review...');
        
        const criticalIssues = [
          humanReviewReason,
          ...sessionState.errorsEncountered
            .filter(e => e.error.includes('Critical'))
            .map(e => `${e.agent}: ${e.error}`),
        ];
        
        const specificQuestions = [
          'Should the analysis proceed despite the identified issues?',
          'Are there alternative approaches to address the gaps?',
          'What additional data sources should be considered?',
        ];
        
        if (synthesisEnsembleOutput.metaSynthesis.confidence === 'Low') {
          specificQuestions.push('What specific actions would increase confidence?');
        }
        
        humanReviewResult = await requestHumanReview(
          synthesisEnsembleOutput.metaSynthesis.confidence === 'Low' ? 'low_confidence' : 'critical_decision',
          sessionState.originalQuery,
          synthesisEnsembleOutput,
          {
            score: synthesisEnsembleOutput.metaSynthesis.confidence,
            rationale: `Synthesis confidence: ${synthesisEnsembleOutput.metaSynthesis.confidence}. Summary: ${synthesisEnsembleOutput.metaSynthesis.summary}`,
          },
          criticalIssues,
          specificQuestions,
          criticalErrors.length > 0 ? 'high' : 'medium'
        );
        
        errorCoordinator.saveArtifact(sessionState, 'human_review', humanReviewResult);
      }
    }
    
    return {
      success: true,
      finalSynthesis: synthesisEnsembleOutput.metaSynthesis,
      sessionState,
      humanReviewRequired,
      humanReviewReason,
    };
    
  } catch (error: any) {
    console.error('MasterOrchestrator: Critical failure in orchestration', { error: error.message });
    
    sessionState.errorsEncountered.push({
      agent: 'MasterOrchestrator',
      error: error.message,
      timestamp: new Date().toISOString(),
      recoveryAttempted: false,
    });
    
    return {
      success: false,
      sessionState,
      humanReviewRequired: parsedInput.data.enableHumanReview,
      humanReviewReason: 'Critical orchestration failure',
    };
  }
}

// Export the flow for use in server actions
export const masterOrchestratorFlow = ai.defineFlow(
  {
    name: 'masterOrchestratorFlow',
    inputSchema: MasterOrchestratorInputSchema,
    outputSchema: MasterOrchestratorOutputSchema,
  },
  orchestrateWithMaster
);

// Enhanced Tool Use Auditing & Control System (E8)
import { toolAuditSystem } from './tool-audit-system';

// Enhanced Workflow Metrics System (E6)
import { workflowMetricsSystem } from './workflow-metrics-system';

// Agent Validation Framework for System Health Monitoring
import { quickSystemHealthCheck, type ValidationFrameworkOutput } from './agent-validation-framework';

// Initialize systems - these should be initialized properly
// const toolAuditSystem = new ToolAuditSystem();
// const workflowMetrics = new WorkflowMetricsSystem();
