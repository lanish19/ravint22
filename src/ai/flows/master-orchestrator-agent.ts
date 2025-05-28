'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Import all agent functions and types
import { type AnalyzeAssumptionsOutput, analyzeAssumptions } from './assumption-analyzer-agent';
import { type ArgumentReconstructionOutput, reconstructArgument, argumentReconstructionTool } from './argument-reconstruction-agent';
import { type BiasDetectionOutput, detectBiases, biasDetectionTool } from './bias-detection-agent';
import { type ChallengeOutput, challenge } from './devils-advocate-agent';
import { type ConfidenceScoringOutput, scoreConfidence, confidenceScoringTool } from './confidence-scoring-agent';
import { type CounterArgumentIntegrationOutput, integrateCounterArguments, counterArgumentIntegrationTool } from './counter-argument-integration-agent';
import { type ResearchCounterEvidenceOutput, researchCounterEvidence } from './counter-evidence-researcher-agent';
import { type CritiqueAgentOutput, critiqueAgent } from './critic-agent';
import { type DynamicRoutingOutput, routeAnalyticalAgents, dynamicRoutingCoordinatorTool } from './dynamic-routing-coordinator-agent';
import { type FactVerificationOutput, verifyFacts, factVerificationTool } from './fact-verification-loop-agent';
import { type HumanReviewOutput, requestHumanReview } from './human-review-tool';
import { type ImpactAssessmentOutput, assessImpact, impactAssessmentTool } from './impact-assessment-agent';
import { type InformationGapOutput, analyzeInformationGaps } from './information-gap-agent';
import { type InitialAnswerLoopOutput, runInitialAnswerLoop, initialAnswerLoopTool } from './initial-answer-loop-agent';
import { type NuancePreservationOutput, checkNuancePreservation, nuancePreservationTool } from './nuance-preservation-check-agent';
import { type PremortemOutput, analyzeFailures } from './premortem-agent';
import { type QualityCheckOutput, checkQuality, qualityCheckTool } from './quality-check-agent';
import { type QueryRefinementOutput, refineQuery, refineQueryTool } from './query-refinement-agent';
import { type ResearchEvidenceOutput, researchEvidence } from './researcher-agent';
import { type SensitivityAnalysisOutput, analyzeSensitivity, sensitivityAnalysisTool } from './sensitivity-analysis-agent';
import { type SynthesisCritiqueLoopOutput, critiqueSynthesis, synthesisCritiqueLoopTool } from './synthesis-critique-loop-agent';
import { type SynthesisEnsembleOutput, runSynthesisEnsemble, synthesisEnsembleTool } from './synthesis-ensemble-agent';
// Unused imports (kept for schema completeness if genkit flows use them)
import { type RespondOutput, respond } from './responder-agent';
import { type BiasCrossReferencingOutput, crossReferenceBiases } from './bias-cross-referencing-agent';
import { type EvidenceConflictResolutionOutput, resolveEvidenceConflicts } from './evidence-conflict-resolution-agent';
import { type SynthesisAgentOutput, synthesizeAnalysis } from './synthesis-agent';
import { type RedTeamingLoopOutput, runRedTeamingLoop } from './red-teaming-loop-agent';


// === START Local Schema Definitions for Agent Outputs ===
const QueryRefinementOutputSchema = refineQueryTool.outputSchema || z.object({
    originalQuery: z.string(), refinedQuery: z.string(), refinementReason: z.string(),
    identifiedIssues: z.array(z.string()), clarificationQuestions: z.array(z.string()),
});
const InitialAnswerLoopOutputSchema = initialAnswerLoopTool.outputSchema || z.object({
    finalAnswer: z.string(), iterations: z.number(),
    improvementHistory: z.array(z.object({ iteration: z.number(), answer: z.string(), critique: z.string() })),
});
const PlaceholderAssumptionSchema = z.object({ assumption: z.string(), risk: z.enum(['High', 'Medium', 'Low']), impact: z.string() });
const AnalyzeAssumptionsOutputSchema = z.array(PlaceholderAssumptionSchema);
const PlaceholderEvidenceSchema = z.object({ source: z.string(), summary: z.string(), relevance: z.number() });
const ResearchEvidenceOutputSchema = z.array(PlaceholderEvidenceSchema);
const ResearchCounterEvidenceOutputSchema = z.array(PlaceholderEvidenceSchema);
const DynamicRoutingOutputSchema = dynamicRoutingCoordinatorTool.outputSchema || z.object({
    recommendedAgents: z.array(z.object({ agentName: z.string(), priority: z.string(), reasoning: z.string(), executionOrder: z.number() })),
    parallelExecutionGroups: z.array(z.array(z.string())), sequentialDependencies: z.array(z.object({ agent: z.string(), dependsOn: z.array(z.string()) })),
    analysisStrategy: z.object({ approach: z.string(), reasoning: z.string(), estimatedComplexity: z.string(), riskLevel: z.string() }),
    optimizations: z.object({ canSkipAgents: z.array(z.string()), prioritizeAgents: z.array(z.string()), resourceAllocation: z.string() }),
});
const BiasDetectionOutputSchema = biasDetectionTool.outputSchema || z.object({
    detectedBiases: z.array(z.object({ biasType: z.string(), evidence: z.string(), confidence: z.number() })),
    biasAnalysis: z.string(), riskLevel: z.enum(['low', 'medium', 'high']), recommendations: z.array(z.string()),
});
const BiasCrossReferencingOutputSchema = z.object({ reportSummary: z.string(), detailedFindings: z.array(z.object({ biasType: z.string(), sourceAgent: z.string(), finding: z.string(), })), confidenceScore: z.number() });
const EvidenceConflictResolutionOutputSchema = z.object({ identifiedConflicts: z.array(z.object({ conflictDescription: z.string(), evidenceIds: z.array(z.string()), resolutionStrategy: z.string(), })), resolutionAnalysis: z.string(), synthesisGuidance: z.string(), });
const ArgumentReconstructionOutputSchema = argumentReconstructionTool.outputSchema || z.object({
    balancedBrief: z.object({ neutralSummary: z.string(), keyPositions: z.array(z.string()), majorCritiques: z.array(z.string()), counterPositions: z.array(z.string()), unresolved: z.array(z.string()) }),
    reconstructionApproach: z.string(), biasCheckResults: z.object({ anchoringBiasRisk: z.string(), mitigationApplied: z.array(z.string()) }),
});
const CounterArgumentIntegrationOutputSchema = counterArgumentIntegrationTool.outputSchema || z.object({
    pressureTestedBrief: z.object({ integratedSummary: z.string(), claimsAndCounterclaims: z.array(z.object({ claim: z.string(), counterClaim: z.string() })), revisedPositions: z.array(z.string()), strengthenedPoints: z.array(z.string()), invalidatedPoints: z.array(z.string()) }),
    integrationMetrics: z.object({ counterEvidenceAddressed: z.number(), challengesIntegrated: z.number(), positionsRevised: z.number() }),
    integrationQuality: z.string(),
});
const ImpactAssessmentOutputSchema = impactAssessmentTool.outputSchema || z.object({
    impactAssessments: z.object({ overallImpactSummary: z.string(), criticalGapImpacts: z.array(z.object({ gap: z.string(), impact: z.string() })), criticalAssumptionImpacts: z.array(z.object({ assumption: z.string(), impact: z.string() })), compoundedRisks: z.array(z.string()) }),
    recommendedActions: z.array(z.string()), confidenceCeiling: z.object({ maxConfidenceGivenGaps: z.string(), reasoning: z.string() }),
});
const QualityScoresSchema = z.object({ critiqueQuality: z.number().optional(), biasDetectionQuality: z.number().optional(), researchQuality: z.number().optional() });

const QualityCheckOutputSchema = qualityCheckTool.outputSchema || z.object({
    overallQuality: z.object({ averageScore: z.number(), category: z.string(), summary: z.string() }),
    componentQuality: z.object({ 
        critiqueQuality: QualityScoresSchema.shape.critiqueQuality.optional(), 
        biasDetectionQuality: QualityScoresSchema.shape.biasDetectionQuality.optional(), 
        researchQuality: QualityScoresSchema.shape.researchQuality.optional(), 
        counterResearchQuality: z.object({ score: z.number(), category: z.string(), reasoning: z.string(), specificIssues: z.array(z.string()), recommendations: z.array(z.string()) }).optional(),
        assumptionsQuality: z.object({ score: z.number(), category: z.string(), reasoning: z.string(), specificIssues: z.array(z.string()), recommendations: z.array(z.string()) }).optional()
    }),
    qualityFactors: z.object({ strengthFactors: z.array(z.string()), weaknessFactors: z.array(z.string()), criticalIssues: z.array(z.string()) }),
    recommendations: z.object({ immediateActions: z.array(z.string()), synthesisGuidance: z.string(), confidenceAdjustments: z.array(z.string()) }),
});
const ConfidenceScoringOutputSchema = confidenceScoringTool.outputSchema || z.object({
    overallConfidence: z.object({ score: z.string(), numericScore: z.number(), rationale: z.string() }),
    componentScores: z.unknown(), confidenceFactors: z.unknown(), recommendations: z.unknown(),
});
const SensitivityAnalysisOutputSchema = sensitivityAnalysisTool.outputSchema || z.object({
    overallRobustness: z.object({ score: z.number(), category: z.string(), summary: z.string() }),
    scenarioTests: z.array(z.unknown()), assumptionSensitivity: z.array(z.unknown()), conclusionStability: z.array(z.unknown()),
    riskAssessment: z.unknown(), recommendations: z.unknown(),
});
const SynthesisEnsembleOutputSchema = synthesisEnsembleTool.outputSchema || z.object({
    individualPerspectives: z.array(z.unknown()),
    metaSynthesis: z.object({ confidence: z.string(), summary: z.string(), keyStrengths: z.array(z.string()), keyWeaknesses: z.array(z.string()), howCounterEvidenceWasAddressed: z.array(z.string()), actionableRecommendations: z.array(z.string()), remainingUncertainties: z.array(z.string()), perspectiveDivergence: z.string(), synthesisApproach: z.string() }),
    errorHandling: z.object({ criticalFailuresDetected: z.boolean(), failureImpactDescription: z.string() }),
});
const FactVerificationOutputSchema = factVerificationTool.outputSchema || z.object({
  verificationSummary: z.object({ totalClaims: z.number(), verifiedClaims: z.number(), contradictedClaims: z.number(), unverifiedClaims: z.number(), overallReliability: z.string(), averageConfidence: z.number() }),
  claimVerifications: z.array(z.unknown()), verificationConcerns: z.unknown(), recommendations: z.unknown(), verificationMetrics: z.unknown(),
});
const NuancePreservationOutputSchema = nuancePreservationTool.outputSchema || z.object({
  preservationSummary: z.object({ totalNuances: z.number(), preservedNuances: z.number(), partiallyPreservedNuances: z.number(), lostNuances: z.number(), distortedNuances: z.number(), overallPreservationScore: z.number(), preservationCategory: z.string() }),
  nuanceAnalysis: z.array(z.unknown()), preservationConcerns: z.unknown(), recommendations: z.unknown(), nuanceMetrics: z.unknown(),
});
// === END Local Schema Definitions ===

const ErrorInfoSchema = z.object({
  agent: z.string(), error: z.string(), timestamp: z.string(),
  recoveryAttempted: z.boolean().default(false), recoveryStrategy: z.string().optional(),
  phase: z.string().optional(), inputSummary: z.string().optional(),
  attempt: z.number().optional(), isCriticalFailure: z.boolean().optional().default(false),
});
export type ErrorInfo = z.infer<typeof ErrorInfoSchema>;

function getDefaultOutputForAgent(agentName: string): any { 
  const defaults = {
    'AnalyzeAssumptionsAgent': [] as AnalyzeAssumptionsOutput, 
    'ResearcherAgent': [] as ResearchEvidenceOutput, 
    'CounterEvidenceResearcherAgent': [] as ResearchCounterEvidenceOutput,
    'PremortemAgent': [] as PremortemOutput, 
    'InformationGapAgent': [] as InformationGapOutput,
    'BiasDetectionAgent': { detectedBiases: [], biasAnalysis: '', riskLevel: 'low' as const, recommendations: [] } as BiasDetectionOutput,
    'CritiqueAgent': '' as CritiqueAgentOutput,
    'EvidenceConflictResolutionAgent': { identifiedConflicts: [], resolutionAnalysis: '', synthesisGuidance: 'Unable to analyze conflicts' } as EvidenceConflictResolutionOutput,
  };
  return defaults[agentName as keyof typeof defaults] || {} as any;
}

const SessionStateSchema = z.object({
  originalQuery: z.string(),
  refinedQuery: QueryRefinementOutputSchema.shape.refinedQuery.optional(),
  initialAnswerText: InitialAnswerLoopOutputSchema.shape.finalAnswer.optional(),
  assumptions: AnalyzeAssumptionsOutputSchema.optional(),
  aggregatedSupportingResearch: ResearchEvidenceOutputSchema.optional(),
  aggregatedCounterResearch: ResearchCounterEvidenceOutputSchema.optional(),
  routingDecision: DynamicRoutingOutputSchema.optional(),
  potentialBiases: BiasDetectionOutputSchema.optional(),
  crossReferencedBiasReport: BiasCrossReferencingOutputSchema.optional(),
  conflictResolutionAnalysis: EvidenceConflictResolutionOutputSchema.optional(),
  stressTestedArgument: z.string().optional(),
  balancedBrief: ArgumentReconstructionOutputSchema.shape.balancedBrief.optional(),
  pressureTestedBrief: CounterArgumentIntegrationOutputSchema.shape.pressureTestedBrief.optional(),
  impactAssessments: ImpactAssessmentOutputSchema.shape.impactAssessments.optional(),
  qualityScores: QualityScoresSchema.optional(),
  overallConfidence: ConfidenceScoringOutputSchema.shape.overallConfidence.optional(),
  sensitivityAnalysisReport: SensitivityAnalysisOutputSchema.optional(),
  draftSynthesisOutput: SynthesisEnsembleOutputSchema.optional(),
  factCheckedSynthesisOutput: FactVerificationOutputSchema.optional(),
  nuancePreservationReport: NuancePreservationOutputSchema.optional(),
  finalRefinedSynthesisOutput: SynthesisEnsembleOutputSchema.shape.metaSynthesis.optional(),
  errorsEncountered: z.array(ErrorInfoSchema).default([]),
  artifacts: z.record(z.string(), z.unknown()).default({}),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

const MasterOrchestratorInputSchema = z.object({
  query: z.string(), enableHumanReview: z.boolean().default(false),
  confidenceThresholdForHumanReview: z.enum(['High', 'Medium', 'Low']).default('Low'),
  maxRetries: z.number().default(3),
});
export type MasterOrchestratorInput = z.infer<typeof MasterOrchestratorInputSchema>;

const MasterOrchestratorOutputSchema = z.object({
  success: z.boolean(),
  finalSynthesis: SynthesisEnsembleOutputSchema.shape.metaSynthesis.optional(),
  sessionState: SessionStateSchema,
  humanReviewRequired: z.boolean().default(false),
  humanReviewReason: z.string().optional(),
});
export type MasterOrchestratorOutput = z.infer<typeof MasterOrchestratorOutputSchema>;

export class AgentExecutionError extends Error {
  constructor(
    message: string, public agentName: string, public originalError: any,
    public attempt: number, public phase: string | undefined,
    public isCritical: boolean | undefined, public isCircuitOpen: boolean = false,
  ) { super(message); this.name = 'AgentExecutionError'; }
}

interface AgentCircuitState {
  failures: number; consecutiveFailures: number; lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

class ErrorHandlingAndRecoveryCoordinator {
  private maxRetries: number;
  private agentStates = new Map<string, AgentCircuitState>();
  private failureThreshold: number;
  private resetTimeout: number;
  
  constructor(maxRetries: number = 3, failureThreshold: number = 3, resetTimeout: number = 30000) {
    this.maxRetries = maxRetries; this.failureThreshold = failureThreshold; this.resetTimeout = resetTimeout;
  }
  
  async callAgentWithRecovery<TInput, TOutput>(
    agentName: string, agentFn: (input: TInput) => Promise<TOutput>, input: TInput,
    defaultOutput: TOutput,
    options?: { criticalAgent?: boolean; backupAgentFn?: (input: TInput) => Promise<TOutput>; validateOutput?: (output: TOutput) => boolean; phase?: string; }
  ): Promise<TOutput> {
    if (!this.agentStates.has(agentName)) {
      this.agentStates.set(agentName, { failures: 0, consecutiveFailures: 0, lastFailureTime: 0, state: 'CLOSED' });
    }
    const agentCircuitState = this.agentStates.get(agentName)!;
    const isCriticalAgent = !!options?.criticalAgent;

    if (agentCircuitState.state === 'OPEN') {
      if (Date.now() - agentCircuitState.lastFailureTime < this.resetTimeout) {
        const openErrorMsg = `Circuit for ${agentName} is OPEN. Not attempting call.`;
        console.warn(`MasterOrchestrator: [${options?.phase || 'N/A'}] Agent: ${agentName}. ${openErrorMsg}`);
        throw new AgentExecutionError(openErrorMsg, agentName, new Error(openErrorMsg), 0, options?.phase, isCriticalAgent, true);
      } else {
        agentCircuitState.state = 'HALF_OPEN';
        console.log(`MasterOrchestrator: [${options?.phase || 'N/A'}] Circuit for ${agentName} transitioned to HALF_OPEN.`);
      }
    }
    
    let lastCaughtError: Error | null = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        if (agentCircuitState.state === 'OPEN') { 
            const openRetryErrorMsg = `Circuit for ${agentName} became OPEN during retries. Aborting attempt ${attempt + 1}.`;
            console.warn(`MasterOrchestrator: [${options?.phase || 'N/A'}] Agent: ${agentName}. ${openRetryErrorMsg}`);
            throw new AgentExecutionError(openRetryErrorMsg, agentName, lastCaughtError || new Error(openRetryErrorMsg), attempt + 1, options?.phase, isCriticalAgent, true);
        }
        console.log(`MasterOrchestrator: [${options?.phase || 'N/A'}] Calling ${agentName} (Attempt ${attempt + 1}/${this.maxRetries}, Circuit: ${agentCircuitState.state})...`);
        const result = await agentFn(input);
        if (options?.validateOutput && !options.validateOutput(result)) { throw new Error(`Output validation failed for ${agentName}`); }
        if (agentCircuitState.state === 'HALF_OPEN') {
          agentCircuitState.state = 'CLOSED'; agentCircuitState.consecutiveFailures = 0;
          console.log(`MasterOrchestrator: [${options?.phase || 'N/A'}] Circuit for ${agentName} transitioned to CLOSED after successful call in HALF_OPEN.`);
        } else if (agentCircuitState.state === 'CLOSED') { agentCircuitState.consecutiveFailures = 0; }
        console.log(`MasterOrchestrator: [${options?.phase || 'N/A'}] ${agentName} successful.`);
        return result;
      } catch (error: any) {
        lastCaughtError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastCaughtError.message;
        agentCircuitState.failures++; agentCircuitState.lastFailureTime = Date.now();
        const inputSummary = JSON.stringify(input).substring(0, 100);
        if (agentCircuitState.state === 'HALF_OPEN') {
          agentCircuitState.state = 'OPEN'; agentCircuitState.consecutiveFailures++; 
          console.error(`MasterOrchestrator: [${options?.phase || 'N/A'}] Agent: ${agentName} failed in HALF_OPEN state. Circuit transitioning to OPEN. Attempt ${attempt + 1}. Error: ${errorMessage}`, { inputSummary, timestamp: new Date().toISOString() });
        } else if (agentCircuitState.state === 'CLOSED') {
          agentCircuitState.consecutiveFailures++;
          if (agentCircuitState.consecutiveFailures >= this.failureThreshold) {
            agentCircuitState.state = 'OPEN';
            console.warn(`MasterOrchestrator: [${options?.phase || 'N/A'}] Circuit for ${agentName} transitioned to OPEN after ${agentCircuitState.consecutiveFailures} consecutive failures. Attempt ${attempt + 1}. Error: ${errorMessage}`, { inputSummary, timestamp: new Date().toISOString() });
          } else {
            console.error(`MasterOrchestrator: [${options?.phase || 'N/A'}] Agent: ${agentName} failed on attempt ${attempt + 1}. Error: ${errorMessage}`, { inputSummary, timestamp: new Date().toISOString() });
          }
        }
        if (agentCircuitState.state === 'OPEN' || attempt === this.maxRetries - 1) {
          const finalErrorMessage = agentCircuitState.state === 'OPEN' ? `Circuit for ${agentName} is now OPEN. ${errorMessage}` : errorMessage;
          throw new AgentExecutionError(finalErrorMessage, agentName, lastCaughtError, attempt + 1, options?.phase, isCriticalAgent, agentCircuitState.state === 'OPEN');
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    const fallbackErrorMsg = `Agent ${agentName} exhausted retries unexpectedly. Last error: ${lastCaughtError?.message || 'N/A'}`;
    throw new AgentExecutionError(fallbackErrorMsg, agentName, lastCaughtError || new Error("Unknown error after exhausting retries"), this.maxRetries, options?.phase, isCriticalAgent, agentCircuitState.state === 'OPEN');
  }
  
  saveArtifact(currentArtifacts: Readonly<Record<string, unknown>>, name: string, data: any): Record<string, unknown> {
    console.log(`MasterOrchestrator: [Artifact] Saving artifact '${name}'`); 
    return { ...currentArtifacts, [name]: data };
  }
}

async function _executePhase1_QueryIntakeAndInitialAnswer(
  currentSessionState: Readonly<SessionState>, errorCoordinator: ErrorHandlingAndRecoveryCoordinator,
  parsedInput: MasterOrchestratorInput ): Promise<SessionState> {
  const phaseName = 'Phase1_QueryIntakeAndInitialAnswer';
  let newSessionState: SessionState = { ...currentSessionState };
  let currentErrors: ErrorInfo[] = [...(newSessionState.errorsEncountered || [])];
  let currentArtifacts: Record<string, unknown> = { ...(newSessionState.artifacts || {}) };

  console.log(`MasterOrchestrator: [${phaseName}] Starting...`);
  const defaultQueryRefinementOutput: QueryRefinementOutput = { originalQuery: newSessionState.originalQuery, refinedQuery: newSessionState.originalQuery, refinementReason: 'Query refinement failed due to an error.', identifiedIssues: [], clarificationQuestions: [] };
  const defaultInitialAnswerLoopOutput: InitialAnswerLoopOutput = { finalAnswer: 'Initial answer generation failed due to an error.', iterations: 0, improvementHistory: [] };

  let queryRefinementOutput: QueryRefinementOutput = defaultQueryRefinementOutput;
  try {
    queryRefinementOutput = await errorCoordinator.callAgentWithRecovery('QueryRefinementAgent', refineQuery, { query: newSessionState.originalQuery }, defaultQueryRefinementOutput, { phase: phaseName });
  } catch (e: any) {
    const errorEntry: ErrorInfo = {
      agent: e instanceof AgentExecutionError ? e.agentName : 'QueryRefinementAgent_Catch', error: e.message, timestamp: new Date().toISOString(), recoveryAttempted: true, recoveryStrategy: 'default_output_used',
      phase: e instanceof AgentExecutionError ? e.phase : phaseName, inputSummary: JSON.stringify({ query: newSessionState.originalQuery }).substring(0, 100),
      attempt: e instanceof AgentExecutionError ? e.attempt : undefined, isCriticalFailure: e instanceof AgentExecutionError ? e.isCritical : false,
    };
    currentErrors = [...currentErrors, errorEntry];
  }
  newSessionState = { ...newSessionState, refinedQuery: queryRefinementOutput.refinedQuery };
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'query_refinement', queryRefinementOutput);
  
  let initialAnswerLoopOutput: InitialAnswerLoopOutput = defaultInitialAnswerLoopOutput;
  try {
    const refinedQueryForLoop = newSessionState.refinedQuery || newSessionState.originalQuery;
    initialAnswerLoopOutput = await errorCoordinator.callAgentWithRecovery('InitialAnswerLoopAgent', runInitialAnswerLoop,
      { refinedQuery: refinedQueryForLoop, maxIterations: 3 }, defaultInitialAnswerLoopOutput,
      { criticalAgent: true, validateOutput: (output) => !!(output.finalAnswer && output.finalAnswer.trim() !== ''), phase: phaseName }
    );
  } catch (e: any) {
    const errorEntry: ErrorInfo = {
      agent: e instanceof AgentExecutionError ? e.agentName : 'InitialAnswerLoopAgent_Catch', error: e.message, timestamp: new Date().toISOString(), recoveryAttempted: true, recoveryStrategy: 'default_output_used',
      phase: e instanceof AgentExecutionError ? e.phase : phaseName, inputSummary: JSON.stringify({ refinedQuery: newSessionState.refinedQuery }).substring(0, 100),
      attempt: e instanceof AgentExecutionError ? e.attempt : undefined, isCriticalFailure: true,
    };
    currentErrors = [...currentErrors, errorEntry];
  }
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'initial_answer_loop', initialAnswerLoopOutput);
  newSessionState = { ...newSessionState, initialAnswerText: initialAnswerLoopOutput.finalAnswer, artifacts: currentArtifacts, errorsEncountered: currentErrors };

  console.log(`MasterOrchestrator: [${phaseName}] Completed.`);
  return newSessionState;
}

async function _executePhase2_EvidenceGatheringAndAnalysis(
  currentSessionState: Readonly<SessionState>, errorCoordinator: ErrorHandlingAndRecoveryCoordinator
): Promise<SessionState> {
  const phaseName = 'Phase2_EvidenceGatheringAndAnalysis';
  let newSessionState: SessionState = { ...currentSessionState };
  let currentArtifacts = newSessionState.artifacts || {};
  let currentErrors: ErrorInfo[] = [...(newSessionState.errorsEncountered || [])];

  console.log(`MasterOrchestrator: [${phaseName}] Starting...`);
  const defaultRoutingDecision: DynamicRoutingOutput = { recommendedAgents: [{ agentName: 'AnalyzeAssumptionsAgent', priority: 'high', reasoning: 'Default routing', executionOrder: 1 }], parallelExecutionGroups: [], sequentialDependencies: [], analysisStrategy: { approach: 'comprehensive', reasoning: 'Default', estimatedComplexity: 'medium', riskLevel: 'medium' }, optimizations: { canSkipAgents: [], prioritizeAgents: [], resourceAllocation: 'standard' }};

  let routingDecision: DynamicRoutingOutput = defaultRoutingDecision;
  try {
    routingDecision = await errorCoordinator.callAgentWithRecovery('DynamicRoutingCoordinatorAgent', routeAnalyticalAgents,
      { refinedQuery: newSessionState.refinedQuery, initialAnswerText: newSessionState.initialAnswerText, availableAgents: ['AnalyzeAssumptionsAgent', 'ResearcherAgent', 'CounterEvidenceResearcherAgent', 'PremortemAgent', 'InformationGapAgent'] },
      defaultRoutingDecision, { phase: phaseName }
    );
  } catch (e: any) {
    const errorEntry: ErrorInfo = {
      agent: e instanceof AgentExecutionError ? e.agentName : 'DynamicRoutingCoordinatorAgent_Catch', error: e.message, timestamp: new Date().toISOString(), recoveryAttempted: true, recoveryStrategy: 'default_output_used',
      phase: e instanceof AgentExecutionError ? e.phase : phaseName, inputSummary: `Refined Query: ${String(newSessionState.refinedQuery).substring(0,50)}...`, 
      attempt: e instanceof AgentExecutionError ? e.attempt : undefined, isCriticalFailure: e instanceof AgentExecutionError ? e.isCritical : false,
    };
    currentErrors = [...currentErrors, errorEntry];
  }
  newSessionState = { ...newSessionState, routingDecision: routingDecision };
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'routing_decision', routingDecision);
  
  console.log(`MasterOrchestrator: [${phaseName}] Using routing strategy: ${routingDecision.analysisStrategy.approach}`);
  
  const processSettledResult = <T>(settledResult: PromiseSettledResult<T>, agentName: string, defaultOutput: T, inputSummaryContext: string): T => {
    if (settledResult.status === 'fulfilled') { return settledResult.value; }
    else {
      const e = settledResult.reason; currentErrors.push({ 
        agent: e instanceof AgentExecutionError ? e.agentName : `${agentName}_SettledCatch`, error: e.message, timestamp: new Date().toISOString(), recoveryAttempted: true, 
        recoveryStrategy: 'default_output_used', phase: phaseName, inputSummary: inputSummaryContext, 
        attempt: e instanceof AgentExecutionError ? e.attempt : undefined, isCriticalFailure: e instanceof AgentExecutionError ? e.isCritical : false });
      return defaultOutput;
    }
  };

  const agentExecutionPromises = [
    errorCoordinator.callAgentWithRecovery('AnalyzeAssumptionsAgent', analyzeAssumptions, { answer: newSessionState.initialAnswerText }, getDefaultOutputForAgent('AnalyzeAssumptionsAgent') as AnalyzeAssumptionsOutput, { phase: phaseName }),
    errorCoordinator.callAgentWithRecovery('ResearcherAgent', researchEvidence, { claim: newSessionState.initialAnswerText }, getDefaultOutputForAgent('ResearcherAgent') as ResearchEvidenceOutput, { phase: phaseName }),
    errorCoordinator.callAgentWithRecovery('CounterEvidenceResearcherAgent', researchCounterEvidence, { claim: newSessionState.initialAnswerText }, getDefaultOutputForAgent('CounterEvidenceResearcherAgent') as ResearchCounterEvidenceOutput, { phase: phaseName }),
    errorCoordinator.callAgentWithRecovery('PremortemAgent', analyzeFailures, { answer: newSessionState.initialAnswerText }, getDefaultOutputForAgent('PremortemAgent') as PremortemOutput, { phase: phaseName }),
    errorCoordinator.callAgentWithRecovery('InformationGapAgent', analyzeInformationGaps, { answer: newSessionState.initialAnswerText }, getDefaultOutputForAgent('InformationGapAgent') as InformationGapOutput, { phase: phaseName }),
  ];
  const [assumptionsResult, researchResult, counterEvidenceResult, premortemResult, informationGapsResult] = await Promise.allSettled(agentExecutionPromises);

  const finalAssumptionsResult = processSettledResult(assumptionsResult, 'AnalyzeAssumptionsAgent', getDefaultOutputForAgent('AnalyzeAssumptionsAgent') as AnalyzeAssumptionsOutput, `Answer: ${String(newSessionState.initialAnswerText).substring(0,50)}...`);
  const finalResearchResult = processSettledResult(researchResult, 'ResearcherAgent', getDefaultOutputForAgent('ResearcherAgent') as ResearchEvidenceOutput, `Claim: ${String(newSessionState.initialAnswerText).substring(0,50)}...`);
  const finalCounterEvidenceResult = processSettledResult(counterEvidenceResult, 'CounterEvidenceResearcherAgent', getDefaultOutputForAgent('CounterEvidenceResearcherAgent') as ResearchCounterEvidenceOutput, `Claim: ${String(newSessionState.initialAnswerText).substring(0,50)}...`);
  const finalPremortemResult = processSettledResult(premortemResult, 'PremortemAgent', getDefaultOutputForAgent('PremortemAgent') as PremortemOutput, `Answer: ${String(newSessionState.initialAnswerText).substring(0,50)}...`);
  const finalInformationGapsResult = processSettledResult(informationGapsResult, 'InformationGapAgent', getDefaultOutputForAgent('InformationGapAgent') as InformationGapOutput, `Answer: ${String(newSessionState.initialAnswerText).substring(0,50)}...`);
  
  newSessionState = {
    ...newSessionState, assumptions: finalAssumptionsResult, aggregatedSupportingResearch: finalResearchResult,
    aggregatedCounterResearch: finalCounterEvidenceResult, errorsEncountered: currentErrors, artifacts: currentArtifacts,
  };
  currentArtifacts = errorCoordinator.saveArtifact(newSessionState.artifacts, `${phaseName}_premortem_analysis_results`, finalPremortemResult);
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, `${phaseName}_information_gap_results`, finalInformationGapsResult);
  newSessionState = { ...newSessionState, artifacts: currentArtifacts };
  console.log(`MasterOrchestrator: [${phaseName}] Completed.`);
  return newSessionState;
}

async function _executePhase3_InDepthAnalysisAndChallenge(
  currentSessionState: Readonly<SessionState>, errorCoordinator: ErrorHandlingAndRecoveryCoordinator,
  researchResultIn: Readonly<ResearchEvidenceOutput> | undefined, counterEvidenceResultIn: Readonly<ResearchCounterEvidenceOutput> | undefined
): Promise<SessionState> { 
  const phaseName = 'Phase3_InDepthAnalysisAndChallenge';
  let newSessionState: SessionState = { ...currentSessionState };
  let currentArtifacts = newSessionState.artifacts || {};
  let currentErrors: ErrorInfo[] = [...(newSessionState.errorsEncountered || [])];

  console.log(`MasterOrchestrator: [${phaseName}] Starting (Parallel Optimization)...`);
  const defaultBiasDetectionOutput = getDefaultOutputForAgent('BiasDetectionAgent') as BiasDetectionOutput;
  const defaultCritiqueOutput = getDefaultOutputForAgent('CritiqueAgent') as CritiqueAgentOutput;
  const defaultChallengeOutput: ChallengeOutput = getDefaultOutputForAgent('DevilsAdvocateAgent') as ChallengeOutput || []; 
  const defaultPremortemOutput = getDefaultOutputForAgent('PremortemAgent') as PremortemOutput;

  const processSettledResult = <T>(settledResult: PromiseSettledResult<T>, agentName: string, defaultOutput: T, inputSummaryContext: string): T => {
    if (settledResult.status === 'fulfilled') { return settledResult.value; }
    else {
      const e = settledResult.reason; currentErrors.push({ 
        agent: e instanceof AgentExecutionError ? e.agentName : `${agentName}_SettledCatch`, error: e.message, timestamp: new Date().toISOString(), recoveryAttempted: true, 
        recoveryStrategy: 'default_output_used', phase: phaseName, inputSummary: inputSummaryContext, 
        attempt: e instanceof AgentExecutionError ? e.attempt : undefined, isCriticalFailure: e instanceof AgentExecutionError ? e.isCritical : false });
      return defaultOutput;
    }
  };

  const agentCalls = [
    errorCoordinator.callAgentWithRecovery('BiasDetectionAgent', detectBiases, { initialAnswerText: newSessionState.initialAnswerText, aggregatedSupportingResearch: researchResultIn, aggregatedCounterResearch: counterEvidenceResultIn }, defaultBiasDetectionOutput, { phase: phaseName }),
    errorCoordinator.callAgentWithRecovery('CritiqueAgent', critiqueAgent, { answer: newSessionState.initialAnswerText, evidence: researchResultIn || [] }, defaultCritiqueOutput, { phase: phaseName }),
    errorCoordinator.callAgentWithRecovery('DevilsAdvocateAgent', challenge, { answer: newSessionState.initialAnswerText, critique: (currentArtifacts['critique_phase3'] as CritiqueAgentOutput) || '' }, defaultChallengeOutput, { phase: phaseName }),
    errorCoordinator.callAgentWithRecovery('PremortemAgent', analyzeFailures, { answer: newSessionState.initialAnswerText }, defaultPremortemOutput, { phase: phaseName }),
  ];
  const results = await Promise.allSettled(agentCalls);
  const finalBiasDetectionOutput = processSettledResult(results[0], 'BiasDetectionAgent', defaultBiasDetectionOutput, `InitialAnswer: ${String(newSessionState.initialAnswerText).substring(0,50)}...`);
  const finalCritiqueOutput = processSettledResult(results[1], 'CritiqueAgent', defaultCritiqueOutput, `InitialAnswer: ${String(newSessionState.initialAnswerText).substring(0,50)}...`);
  const finalChallengeOutput = processSettledResult(results[2], 'DevilsAdvocateAgent', defaultChallengeOutput, `InitialAnswer: ${String(newSessionState.initialAnswerText).substring(0,50)}...`);
  const finalPremortemOutput = processSettledResult(results[3], 'PremortemAgent', defaultPremortemOutput, `InitialAnswer: ${String(newSessionState.initialAnswerText).substring(0,50)}...`);
  
  newSessionState = { ...newSessionState, potentialBiases: finalBiasDetectionOutput, errorsEncountered: currentErrors };
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'bias_detection', finalBiasDetectionOutput);
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'critique_phase3', finalCritiqueOutput); 
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'challenge_phase3', finalChallengeOutput);
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'premortem_phase3', finalPremortemOutput);
  newSessionState = { ...newSessionState, artifacts: currentArtifacts };
  console.log(`MasterOrchestrator: [${phaseName}] Completed.`);
  return newSessionState;
}

async function _executePhase4_PreSynthesisStructuringAndQA(
  currentSessionState: Readonly<SessionState>, errorCoordinator: ErrorHandlingAndRecoveryCoordinator,
  critiqueOutputFromPhase3: Readonly<CritiqueAgentOutput> | undefined, challengeOutputFromPhase3: Readonly<ChallengeOutput> | undefined, 
  counterEvidenceResultFromPhase2: Readonly<ResearchCounterEvidenceOutput> | undefined, informationGapsResultFromPhase2: Readonly<InformationGapOutput> | undefined, 
  assumptionsResultFromPhase2: Readonly<AnalyzeAssumptionsOutput> | undefined, researchResultFromPhase2: Readonly<ResearchEvidenceOutput> | undefined 
): Promise<SessionState> { 
  const phaseName = 'Phase4_PreSynthesisStructuringAndQA';
  let newSessionState: SessionState = { ...currentSessionState };
  let currentArtifacts = newSessionState.artifacts || {};
  let currentErrors: ErrorInfo[] = [...(newSessionState.errorsEncountered || [])];

  const processAgentError = (e: any, agentName: string, inputSummary: string, isCritical = false): void => {
    const errorEntry: ErrorInfo = {
      agent: e instanceof AgentExecutionError ? e.agentName : `${agentName}_Call`, error: e.message, timestamp: new Date().toISOString(), 
      recoveryAttempted: true, recoveryStrategy: 'default_output_used', phase: phaseName, inputSummary, 
      attempt: e instanceof AgentExecutionError ? e.attempt : undefined, isCriticalFailure: e instanceof AgentExecutionError ? (e.isCritical || isCritical) : isCritical,
    };
    currentErrors = [...currentErrors, errorEntry];
  };

  const defaultArgReconstructionOutput: ArgumentReconstructionOutput = { balancedBrief: { neutralSummary: 'Default: Unable to reconstruct argument', keyPositions: [], majorCritiques: [], counterPositions: [], unresolved: [] }, reconstructionApproach: 'Default: Reconstruction failed', biasCheckResults: { anchoringBiasRisk: 'high', mitigationApplied: [] } };
  let argumentReconstructionOutput = defaultArgReconstructionOutput;
  try { argumentReconstructionOutput = await errorCoordinator.callAgentWithRecovery('ArgumentReconstructionAgent', reconstructArgument, { initialAnswerText: newSessionState.initialAnswerText, stressTestedArgument: newSessionState.stressTestedArgument, critiqueOutput: critiqueOutputFromPhase3, challengeOutput: challengeOutputFromPhase3, aggregatedCounterResearch: counterEvidenceResultFromPhase2 }, defaultArgReconstructionOutput, { phase: phaseName });
  } catch (e: any) { processAgentError(e, 'ArgumentReconstructionAgent', `InitialAnswer: ${String(newSessionState.initialAnswerText).substring(0,50)}...`); }
  newSessionState = { ...newSessionState, balancedBrief: argumentReconstructionOutput.balancedBrief };
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'argument_reconstruction', argumentReconstructionOutput);

  const defaultCounterArgIntegrationOutput: CounterArgumentIntegrationOutput = { pressureTestedBrief: { integratedSummary: 'Default: Unable to integrate counter-arguments', claimsAndCounterclaims: [], revisedPositions: [], strengthenedPoints: [], invalidatedPoints: [] }, integrationMetrics: { counterEvidenceAddressed: 0, challengesIntegrated: 0, positionsRevised: 0 }, integrationQuality: 'minimal' };
  let counterArgumentIntegrationOutput = defaultCounterArgIntegrationOutput;
  try { counterArgumentIntegrationOutput = await errorCoordinator.callAgentWithRecovery('CounterArgumentIntegrationAgent', integrateCounterArguments, { balancedBrief: newSessionState.balancedBrief, aggregatedCounterResearch: counterEvidenceResultFromPhase2, challengeOutput: challengeOutputFromPhase3 }, defaultCounterArgIntegrationOutput, { phase: phaseName });
  } catch (e: any) { processAgentError(e, 'CounterArgumentIntegrationAgent', `BalancedBrief available: ${!!newSessionState.balancedBrief}`); }
  newSessionState = { ...newSessionState, pressureTestedBrief: counterArgumentIntegrationOutput.pressureTestedBrief };
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'counter_argument_integration', counterArgumentIntegrationOutput);

  const defaultImpactAssessmentOutput: ImpactAssessmentOutput = { impactAssessments: { overallImpactSummary: 'Default: Unable to assess impact', criticalGapImpacts: [], criticalAssumptionImpacts: [], compoundedRisks: [] }, recommendedActions: [], confidenceCeiling: { maxConfidenceGivenGaps: 'Low', reasoning: 'Impact assessment failed by default' } };
  let impactAssessmentOutput = defaultImpactAssessmentOutput;
  try { impactAssessmentOutput = await errorCoordinator.callAgentWithRecovery('ImpactAssessmentAgent', assessImpact, { informationGaps: informationGapsResultFromPhase2, assumptions: assumptionsResultFromPhase2 }, defaultImpactAssessmentOutput, { phase: phaseName });
  } catch (e: any) { processAgentError(e, 'ImpactAssessmentAgent', `Gaps/Assumptions available`); }
  newSessionState = { ...newSessionState, impactAssessments: impactAssessmentOutput.impactAssessments };
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'impact_assessment', impactAssessmentOutput);

  const defaultQualityCheckOutput: QualityCheckOutput = { overallQuality: { averageScore: 0, category: 'poor', summary: 'Default: Quality check failed' }, componentQuality: { critiqueQuality: { score: 0, category: 'poor', reasoning: 'Default', specificIssues: [], recommendations: [] }, biasDetectionQuality: { score: 0, category: 'poor', reasoning: 'Default', specificIssues: [], recommendations: [] }, researchQuality: { score: 0, category: 'poor', reasoning: 'Default', specificIssues: [], recommendations: [] }, counterResearchQuality: { score: 0, category: 'poor', reasoning: 'Default', specificIssues: [], recommendations: [] }, assumptionsQuality: { score: 0, category: 'poor', reasoning: 'Default', specificIssues: [], recommendations: [] } }, qualityFactors: { strengthFactors: [], weaknessFactors: ['Default: Quality assessment failed'], criticalIssues: [] }, recommendations: { immediateActions: [], synthesisGuidance: [], confidenceAdjustments: [] } };
  let qualityCheckOutput = defaultQualityCheckOutput;
  try { qualityCheckOutput = await errorCoordinator.callAgentWithRecovery('QualityCheckAgent', checkQuality, { critiqueOutput: critiqueOutputFromPhase3, biasDetectionOutput: newSessionState.crossReferencedBiasReport, researchOutput: researchResultFromPhase2, counterResearchOutput: counterEvidenceResultFromPhase2, assumptionsOutput: assumptionsResultFromPhase2 }, defaultQualityCheckOutput, { phase: phaseName });
  } catch (e: any) { processAgentError(e, 'QualityCheckAgent', `Critique/BiasReport available`); }
  newSessionState = { ...newSessionState, qualityScores: { critiqueQuality: qualityCheckOutput.componentQuality.critiqueQuality?.score, biasDetectionQuality: qualityCheckOutput.componentQuality.biasDetectionQuality?.score, researchQuality: qualityCheckOutput.componentQuality.researchQuality?.score }};
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'quality_check', qualityCheckOutput);
  
  const defaultConfidenceScoringOutput: ConfidenceScoringOutput = { overallConfidence: { score: 'Low', numericScore: 0, rationale: 'Default: Confidence scoring failed' }, componentScores: { evidenceQuality: { score: 0, breakdown: { highQualityEvidence:0, moderateQualityEvidence:0,lowQualityEvidence:0}, reasoning: 'Default' }, evidenceBalance: { score: 0, supportToCounterRatio: 'N/A', reasoning: 'Default' }, biasManagement: { score: 0, identifiedBiases:0, addressedBiases:0, reasoning: 'Default' }, uncertaintyHandling: { score: 0, criticalGaps:0, riskyAssumptions:0, reasoning: 'Default' }, analyticalRigor: { score: 0, critiqueQuality:'weak', conflictResolution:'minimal', reasoning: 'Default' } }, confidenceFactors: { strengthFactors: [], weaknessFactors: ['Default: Confidence assessment failed'], criticalLimitations: [] }, recommendations: { toIncreaseConfidence: [], minimumRequirementsForHighConfidence: [] } };
  let confidenceScoringOutput = defaultConfidenceScoringOutput;
  try { confidenceScoringOutput = await errorCoordinator.callAgentWithRecovery('ConfidenceScoringAgent', scoreConfidence, { pressureTestedBrief: newSessionState.pressureTestedBrief, aggregatedSupportingResearch: researchResultFromPhase2, aggregatedCounterResearch: counterEvidenceResultFromPhase2, critiqueOutput: critiqueOutputFromPhase3, biasReport: newSessionState.crossReferencedBiasReport, conflictResolutionAnalysis: newSessionState.conflictResolutionAnalysis, impactAssessments: newSessionState.impactAssessments, qualityScores: newSessionState.qualityScores }, defaultConfidenceScoringOutput, { phase: phaseName });
  } catch (e: any) { processAgentError(e, 'ConfidenceScoringAgent', `PressureTestedBrief/QualityScores available`); }
  newSessionState = { ...newSessionState, overallConfidence: confidenceScoringOutput.overallConfidence };
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'confidence_scoring', confidenceScoringOutput);

  const defaultSensitivityAnalysisOutput: SensitivityAnalysisOutput = { overallRobustness: { score: 0, category: 'very_fragile', summary: 'Default: Sensitivity analysis failed' }, scenarioTests: [], assumptionSensitivity: [], conclusionStability: [], riskAssessment: { highRiskScenarios: [], lowRiskScenarios: [], criticalAssumptions: [], robustnessConcerns: [] }, recommendations: { strengthenAssumptions: [], additionalResearch: [], confidenceAdjustments: [], contingencyPlanning: [] } };
  let sensitivityAnalysisOutput = defaultSensitivityAnalysisOutput;
  try {
    const keyAssumptionsForSensitivity = Array.isArray(assumptionsResultFromPhase2) ? assumptionsResultFromPhase2.map((item: any) => ({ assumption: item.assumption, confidence: (item.risk === 'High' ? 'Low' : item.risk === 'Medium' ? 'Medium' : 'High') as 'High' | 'Medium' | 'Low', impact: item.risk, riskLevel: item.risk })) : [];
    sensitivityAnalysisOutput = await errorCoordinator.callAgentWithRecovery('SensitivityAnalysisAgent', analyzeSensitivity, { originalConclusions: [newSessionState.initialAnswerText!], keyAssumptions: keyAssumptionsForSensitivity, synthesisEvidence: researchResultFromPhase2 }, defaultSensitivityAnalysisOutput, { phase: phaseName });
  } catch (e: any) { processAgentError(e, 'SensitivityAnalysisAgent', `InitialAnswerText available`); }
  newSessionState = { ...newSessionState, sensitivityAnalysisReport: sensitivityAnalysisOutput, artifacts: currentArtifacts, errorsEncountered: currentErrors };
  currentArtifacts = errorCoordinator.saveArtifact(newSessionState.artifacts, 'sensitivity_analysis', sensitivityAnalysisOutput);
  newSessionState = { ...newSessionState, artifacts: currentArtifacts }; 
  
  console.log(`MasterOrchestrator: [${phaseName}] Completed.`);
  return newSessionState;
}

async function _executePhase5_SynthesisVerificationAndRefinement(
  currentSessionState: Readonly<SessionState>, errorCoordinator: ErrorHandlingAndRecoveryCoordinator,
  researchResultFromPhase2: Readonly<ResearchEvidenceOutput> | undefined, 
  counterEvidenceResultFromPhase2: Readonly<ResearchCounterEvidenceOutput> | undefined, 
  qualityCheckOutputFromPhase4: Readonly<QualityCheckOutput> | undefined 
): Promise<SessionState> {
  const phaseName = 'Phase5_SynthesisVerificationAndRefinement';
  let newSessionState: SessionState = { ...currentSessionState };
  let currentArtifacts = newSessionState.artifacts || {};
  let currentErrors: ErrorInfo[] = [...(newSessionState.errorsEncountered || [])];
  const processAgentError = (e: any, agentName: string, inputSummary: string, isCritical = false): void => {
    const errorEntry: ErrorInfo = {
      agent: e instanceof AgentExecutionError ? e.agentName : `${agentName}_Call`, error: e.message, timestamp: new Date().toISOString(), recoveryAttempted: true, recoveryStrategy: 'default_output_used',
      phase: phaseName, inputSummary, attempt: e instanceof AgentExecutionError ? e.attempt : undefined, isCriticalFailure: e instanceof AgentExecutionError ? (e.isCritical || isCritical) : isCritical,
    };
    currentErrors = [...currentErrors, errorEntry];
  };

  const defaultSynthesisEnsembleOutput: SynthesisEnsembleOutput = { individualPerspectives: [], metaSynthesis: { confidence: 'Low', summary: 'Default: Synthesis ensemble failed', keyStrengths: [], keyWeaknesses: [], howCounterEvidenceWasAddressed: [], actionableRecommendations: [], remainingUncertainties: [], perspectiveDivergence: 'N/A', synthesisApproach: 'Failed' }, errorHandling: { criticalFailuresDetected: true, failureImpactDescription: 'Default: Synthesis ensemble failed' }};
  let synthesisEnsembleOutput = defaultSynthesisEnsembleOutput;
  try { synthesisEnsembleOutput = await errorCoordinator.callAgentWithRecovery('SynthesisEnsembleAgent', runSynthesisEnsemble, { pressureTestedBrief: JSON.stringify(newSessionState.pressureTestedBrief), balancedBrief: JSON.stringify(newSessionState.balancedBrief), initialAnswerText: newSessionState.initialAnswerText, impactAssessments: JSON.stringify(newSessionState.impactAssessments), overallConfidence: newSessionState.overallConfidence, aggregatedSupportingResearch: researchResultFromPhase2, aggregatedCounterResearch: counterEvidenceResultFromPhase2, conflictResolutionAnalysis: newSessionState.conflictResolutionAnalysis, sensitivityAnalysisReport: newSessionState.sensitivityAnalysisReport, errorsEncountered: newSessionState.errorsEncountered?.map(e => ({ agent: e.agent, error: e.error })) || [] }, defaultSynthesisEnsembleOutput, { phase: phaseName });
  } catch (e: any) { processAgentError(e, 'SynthesisEnsembleAgent', `Briefs/Reports available`); }
  newSessionState = { ...newSessionState, draftSynthesisOutput: synthesisEnsembleOutput, finalRefinedSynthesisOutput: synthesisEnsembleOutput.metaSynthesis };
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'synthesis_ensemble', synthesisEnsembleOutput);

  const defaultFactVerificationOutput: FactVerificationOutput = getDefaultOutputForAgent('FactVerificationLoopAgent') as FactVerificationOutput || { verificationSummary: { totalClaims: 0, verifiedClaims: 0, contradictedClaims: 0, unverifiedClaims: 0, overallReliability: 'unknown', averageConfidence: 0 }, claimVerifications: [], verificationConcerns: { criticalIssues: [], moderateIssues: [], methodologyLimitations: [], dataQualityIssues: [] }, recommendations: { immediateActions: [], additionalVerification: [], confidenceAdjustments: [], claimModifications: [] }, verificationMetrics: { totalVerificationAttempts: 0, averageAttemptsPerClaim: 0, successfulVerificationRate: 0, evidenceQualityDistribution: { high:0, medium:0, low:0, unknown:0 } }};
  let factVerificationOutput = defaultFactVerificationOutput;
  try { factVerificationOutput = await errorCoordinator.callAgentWithRecovery('FactVerificationLoopAgent', verifyFacts, { claims: [{ claim: newSessionState.finalRefinedSynthesisOutput?.summary || '', importance: 'high' as const, claimType: 'factual' as const, source: 'synthesis' }], verificationDepth: 'standard' as const, availableEvidence: [researchResultFromPhase2, counterEvidenceResultFromPhase2].filter(Boolean) as (ResearchEvidenceOutput | ResearchCounterEvidenceOutput)[] }, defaultFactVerificationOutput, { phase: phaseName });
  } catch (e: any) { processAgentError(e, 'FactVerificationLoopAgent', `Synthesis summary available`); }
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'fact_verification', factVerificationOutput);
  newSessionState = { ...newSessionState, factCheckedSynthesisOutput: factVerificationOutput };

  const defaultNuancePreservationOutput: NuancePreservationOutput = getDefaultOutputForAgent('NuancePreservationCheckAgent') as NuancePreservationOutput || { preservationSummary: { totalNuances: 0, preservedNuances: 0, partiallyPreservedNuances: 0, lostNuances: 0, distortedNuances: 0, overallPreservationScore: 0, preservationCategory: 'unknown'}, nuanceAnalysis: [], preservationConcerns: { criticalLosses:[], significantDistortions:[], contextualShifts:[], oversimplifications:[] }, recommendations: { immediateRevisions:[], addMissingNuances:[], clarifyAmbiguities:[], strengthenQualifications:[] }, nuanceMetrics: { nuancesByType:{}, preservationRateByImportance:{ critical:0, high:0, medium:0, low:0}, distortionRisk:'unknown', contextualAccuracy:0}};
  let nuancePreservationOutput = defaultNuancePreservationOutput;
  try { nuancePreservationOutput = await errorCoordinator.callAgentWithRecovery('NuancePreservationCheckAgent', checkNuancePreservation, { originalContent: newSessionState.initialAnswerText || '', synthesizedContent: newSessionState.finalRefinedSynthesisOutput?.summary || '', contextualFactors: [], analysisDepth: 'moderate' as const }, defaultNuancePreservationOutput, { phase: phaseName });
  } catch (e: any) { processAgentError(e, 'NuancePreservationCheckAgent', `InitialAnswer/Synthesis available`); }
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'nuance_preservation', nuancePreservationOutput);
  newSessionState = { ...newSessionState, nuancePreservationReport: nuancePreservationOutput };

  const defaultSynthesisCritiqueOutput: SynthesisCritiqueLoopOutput = { critiqueResults: { overallAssessment: 'Default: Synthesis critique failed', strengths: [], weaknesses: [], gapAnalysis:{ evidenceGaps:[], logicalGaps:[], perspectiveGaps:[]}, refinementSuggestions: [], iterativeImprovements: { currentIteration: 1, convergenceAssessment: 'Analysis incomplete', recommendNextIteration: false, stoppingCriteria: { qualityThresholdMet:false, diminishingReturns:false,maxIterationsReached:false}}}, qualityMetrics: { completenessScore:0, coherenceScore:0, evidenceQualityScore:0, clarityScore:0, balanceScore:0, overallQualityScore:0}, recommendations:{immediateActions:[], structuralChanges:[], contentEnhancements:[], methodologyImprovements:[]}, nextSteps: { requiresRevision:true, revisionPriority:'high', focusAreas:['error_resolution'], estimatedEffort:'substantial'}};
  let synthesisCritiqueOutput = defaultSynthesisCritiqueOutput;
  try { synthesisCritiqueOutput = await errorCoordinator.callAgentWithRecovery('SynthesisCritiqueLoopAgent', critiqueSynthesis, { synthesis: newSessionState.finalRefinedSynthesisOutput?.summary || '', originalData: [newSessionState.initialAnswerText || ''], analysisContext: JSON.stringify({ qualityCheck: qualityCheckOutputFromPhase4, factVerification: factVerificationOutput, nuancePreservation: nuancePreservationOutput }), previousCritiques: [] }, defaultSynthesisCritiqueOutput, { phase: phaseName });
  } catch (e: any) { processAgentError(e, 'SynthesisCritiqueLoopAgent', `Synthesis/Context available`); }
  
  const updatedSummary = synthesisCritiqueOutput.critiqueResults?.refinedSynthesis || newSessionState.finalRefinedSynthesisOutput?.summary;
  const updatedConfidence = synthesisCritiqueOutput.qualityMetrics?.overallQualityScore ? String(synthesisCritiqueOutput.qualityMetrics.overallQualityScore) : newSessionState.finalRefinedSynthesisOutput?.confidence;
  newSessionState = { ...newSessionState, finalRefinedSynthesisOutput: { ...(newSessionState.finalRefinedSynthesisOutput || defaultSynthesisEnsembleOutput.metaSynthesis), summary: updatedSummary || newSessionState.finalRefinedSynthesisOutput?.summary || '', confidence: updatedConfidence || newSessionState.finalRefinedSynthesisOutput?.confidence || 'Low', remainingUncertainties: [...(newSessionState.finalRefinedSynthesisOutput?.remainingUncertainties || []), ...(synthesisCritiqueOutput.critiqueResults?.weaknesses?.map(w => `Critique Weakness: ${w}`) || []), 'Synthesis critique process output considered for refinement'].filter(Boolean) as string[]}};
  currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'synthesis_critique_loop_output', synthesisCritiqueOutput);
  newSessionState = { ...newSessionState, artifacts: currentArtifacts, errorsEncountered: currentErrors };
  console.log(`MasterOrchestrator: [${phaseName}] Completed.`);
  return newSessionState;
}

async function _executePhase6_HumanReviewAndFinalization(
  currentSessionState: Readonly<SessionState>, errorCoordinator: ErrorHandlingAndRecoveryCoordinator, 
  parsedInput: MasterOrchestratorInput, 
  synthesisEnsembleOutputFromPhase5: Readonly<SynthesisEnsembleOutput> | undefined
): Promise<SessionState & { humanReviewRequired: boolean; humanReviewReason: string; humanReviewResult: HumanReviewOutput | null; }> {
  const phaseName = 'Phase6_HumanReviewAndFinalization';
  let newSessionState: SessionState = { ...currentSessionState };
  let currentArtifacts = newSessionState.artifacts || {}; 
  let currentErrors: ErrorInfo[] = [...(newSessionState.errorsEncountered || [])];

  console.log(`MasterOrchestrator: [${phaseName}] Starting...`);
  let humanReviewRequired = false; let humanReviewReason = ''; let humanReviewResult: HumanReviewOutput | null = null;
  const synthesisForReview = synthesisEnsembleOutputFromPhase5 || { metaSynthesis: { confidence: 'Low', summary: 'N/A due to prior failure', keyStrengths: [], keyWeaknesses:['Prior phase failed'], howCounterEvidenceWasAddressed:[], actionableRecommendations:[], remainingUncertainties:['Prior phase failed'], perspectiveDivergence:'N/A', synthesisApproach:'Failed' }, individualPerspectives: [], errorHandling: { criticalFailuresDetected: true, failureImpactDescription: 'Prior phase failed'}};

  if (parsedInput.enableHumanReview) {
    const confidenceLevels = { 'High': 3, 'Medium': 2, 'Low': 1 };
    const thresholdLevel = confidenceLevels[parsedInput.confidenceThresholdForHumanReview];
    const actualLevel = confidenceLevels[synthesisForReview.metaSynthesis.confidence as keyof typeof confidenceLevels] || 1;
    if (actualLevel <= thresholdLevel) {
      humanReviewRequired = true; humanReviewReason = `Confidence level (${synthesisForReview.metaSynthesis.confidence}) is at or below threshold (${parsedInput.confidenceThresholdForHumanReview})`;
    }
    const criticalErrorsInSession = (newSessionState.errorsEncountered || []).filter(e => e.isCriticalFailure || e.agent?.includes('Critical') || e.error?.includes('Critical'));
    if (criticalErrorsInSession.length > 0) {
      humanReviewRequired = true; const existingReason = humanReviewReason ? `${existingReason}. ` : '';
      humanReviewReason = `${existingReason}Critical errors encountered: ${criticalErrorsInSession.map(e => `${e.agent}: ${String(e.error).substring(0,50)}...`).join('; ')}`;
    }
    if (humanReviewRequired) {
      const criticalIssuesForReview = [humanReviewReason, ...(newSessionState.errorsEncountered || []).filter(e => e.isCriticalFailure || e.error?.includes('Critical')).map(e => `${e.agent} (${e.phase || 'N/A'}): ${e.error}`)];
      const specificQuestions = ['Should the analysis proceed despite the identified issues?', 'Are there alternative approaches to address the gaps?', 'What additional data sources should be considered?'];
      if (synthesisForReview.metaSynthesis.confidence === 'Low') { specificQuestions.push('What specific actions would increase confidence?'); }
      try {
        humanReviewResult = await requestHumanReview(synthesisForReview.metaSynthesis.confidence === 'Low' ? 'low_confidence' : 'critical_decision', newSessionState.originalQuery, synthesisForReview, { score: synthesisForReview.metaSynthesis.confidence, rationale: `Synthesis confidence: ${synthesisForReview.metaSynthesis.confidence}. Summary: ${synthesisForReview.metaSynthesis.summary}` }, criticalIssuesForReview, specificQuestions, criticalErrorsInSession.length > 0 ? 'high' : 'medium');
        currentArtifacts = errorCoordinator.saveArtifact(currentArtifacts, 'human_review_output', humanReviewResult);
      } catch (hrError: any) {
        const hrErrorMessage = hrError instanceof Error ? hrError.message : String(hrError);
        const errorEntry: ErrorInfo = { agent: 'HumanReviewTool', error: hrErrorMessage, timestamp: new Date().toISOString(), recoveryAttempted: false, phase: phaseName, inputSummary: 'Human review inputs', isCriticalFailure: true, attempt: 1 };
        currentErrors = [...currentErrors, errorEntry];
        humanReviewReason = humanReviewReason ? `${humanReviewReason} AND Human Review Tool itself failed.` : `Human Review Tool failed: ${hrErrorMessage}`;
      }
    }
  }
  newSessionState = { ...newSessionState, artifacts: currentArtifacts, errorsEncountered: currentErrors };
  console.log(`MasterOrchestrator: [${phaseName}] Completed.`);
  return { ...newSessionState, humanReviewRequired, humanReviewReason, humanReviewResult };
}

export async function orchestrateWithMaster(input: MasterOrchestratorInput): Promise<MasterOrchestratorOutput> {
  const orchestratorPhase = "MasterOrchestrator_Setup";
  const parsedInput = MasterOrchestratorInputSchema.safeParse(input);

  if (!parsedInput.success) {
    const inputErrorMsg = `Invalid input: ${parsedInput.error.message}`;
    console.error(`MasterOrchestrator: [${orchestratorPhase}] Invalid input. Error: ${inputErrorMsg}`, { inputSummary: JSON.stringify(input).substring(0,100), errorDetails: parsedInput.error.flatten(), timestamp: new Date().toISOString() });
    const errorSessionState: SessionState = {
        originalQuery: input.query || 'Invalid Query (Not Provided)', refinedQuery: undefined, initialAnswerText: undefined, assumptions: undefined, aggregatedSupportingResearch: undefined,
        aggregatedCounterResearch: undefined, routingDecision: undefined, potentialBiases: undefined, crossReferencedBiasReport: undefined,
        conflictResolutionAnalysis: undefined, stressTestedArgument: undefined, balancedBrief: undefined, pressureTestedBrief: undefined,
        impactAssessments: undefined, qualityScores: undefined, overallConfidence: undefined, sensitivityAnalysisReport: undefined,
        draftSynthesisOutput: undefined, factCheckedSynthesisOutput: undefined, nuancePreservationReport: undefined, finalRefinedSynthesisOutput: undefined,
        errorsEncountered: [{ agent: 'MasterOrchestrator_InputValidation', error: inputErrorMsg, timestamp: new Date().toISOString(), recoveryAttempted: false, phase: orchestratorPhase, inputSummary: JSON.stringify(input).substring(0,100), attempt: 1, isCriticalFailure: true, }],
        artifacts: {},
    };
    return { success: false, sessionState: errorSessionState, humanReviewRequired: false };
  }
  
  let currentSessionState: SessionState = {
    originalQuery: parsedInput.data.query, refinedQuery: undefined, initialAnswerText: undefined, assumptions: undefined, aggregatedSupportingResearch: undefined,
    aggregatedCounterResearch: undefined, routingDecision: undefined, potentialBiases: undefined, crossReferencedBiasReport: undefined,
    conflictResolutionAnalysis: undefined, stressTestedArgument: undefined, balancedBrief: undefined, pressureTestedBrief: undefined,
    impactAssessments: undefined, qualityScores: undefined, overallConfidence: undefined, sensitivityAnalysisReport: undefined,
    draftSynthesisOutput: undefined, factCheckedSynthesisOutput: undefined, nuancePreservationReport: undefined, finalRefinedSynthesisOutput: undefined,
    errorsEncountered: [], artifacts: {},
  };
  
  const errorCoordinator = new ErrorHandlingAndRecoveryCoordinator(parsedInput.data.maxRetries, 3, 30000);
  
  try {
    console.log(`MasterOrchestrator: [${orchestratorPhase}] Starting enhanced analytical workflow for query: "${parsedInput.data.query.substring(0, 50)}..."`);

    currentSessionState = await _executePhase1_QueryIntakeAndInitialAnswer(currentSessionState, errorCoordinator, parsedInput.data);
    currentSessionState = await _executePhase2_EvidenceGatheringAndAnalysis(currentSessionState, errorCoordinator);
    
    const researchResultFromState = currentSessionState.aggregatedSupportingResearch;
    const counterEvidenceResultFromState = currentSessionState.aggregatedCounterResearch;
    const assumptionsResultFromState = currentSessionState.assumptions;
    const informationGapsResultFromPhase2 = currentSessionState.artifacts['Phase2_EvidenceGatheringAndAnalysis_information_gap_results'] as InformationGapOutput | undefined;

    currentSessionState = await _executePhase3_InDepthAnalysisAndChallenge(currentSessionState, errorCoordinator, researchResultFromState, counterEvidenceResultFromState);
    const critiqueResultFromPhase3 = currentSessionState.artifacts['critique_phase3'] as CritiqueAgentOutput | undefined;
    const challengeResultFromPhase3 = currentSessionState.artifacts['challenge_phase3'] as ChallengeOutput | undefined;

    currentSessionState = await _executePhase4_PreSynthesisStructuringAndQA(currentSessionState, errorCoordinator, critiqueResultFromPhase3, challengeResultFromPhase3, counterEvidenceResultFromState, informationGapsResultFromPhase2, assumptionsResultFromState, researchResultFromState );
    const qualityCheckOutputFromPhase4 = currentSessionState.artifacts['quality_check'] as QualityCheckOutput | undefined;

    currentSessionState = await _executePhase5_SynthesisVerificationAndRefinement(currentSessionState, errorCoordinator, researchResultFromState, counterEvidenceResultFromState, qualityCheckOutputFromPhase4);
    const synthesisEnsembleOutputFromState = currentSessionState.draftSynthesisOutput;

    const phase6FullResult = await _executePhase6_HumanReviewAndFinalization(currentSessionState, errorCoordinator, parsedInput.data, synthesisEnsembleOutputFromState);
    
    currentSessionState = { 
        originalQuery: phase6FullResult.originalQuery, refinedQuery: phase6FullResult.refinedQuery, initialAnswerText: phase6FullResult.initialAnswerText,
        assumptions: phase6FullResult.assumptions, aggregatedSupportingResearch: phase6FullResult.aggregatedSupportingResearch, aggregatedCounterResearch: phase6FullResult.aggregatedCounterResearch,
        routingDecision: phase6FullResult.routingDecision, potentialBiases: phase6FullResult.potentialBiases, crossReferencedBiasReport: phase6FullResult.crossReferencedBiasReport,
        conflictResolutionAnalysis: phase6FullResult.conflictResolutionAnalysis, stressTestedArgument: phase6FullResult.stressTestedArgument,
        balancedBrief: phase6FullResult.balancedBrief, pressureTestedBrief: phase6FullResult.pressureTestedBrief, impactAssessments: phase6FullResult.impactAssessments,
        qualityScores: phase6FullResult.qualityScores, overallConfidence: phase6FullResult.overallConfidence, sensitivityAnalysisReport: phase6FullResult.sensitivityAnalysisReport,
        draftSynthesisOutput: phase6FullResult.draftSynthesisOutput, factCheckedSynthesisOutput: phase6FullResult.factCheckedSynthesisOutput,
        nuancePreservationReport: phase6FullResult.nuancePreservationReport, finalRefinedSynthesisOutput: phase6FullResult.finalRefinedSynthesisOutput,
        errorsEncountered: phase6FullResult.errorsEncountered, artifacts: phase6FullResult.artifacts 
    };
    
    console.log(`MasterOrchestrator: [MasterOrchestrator_Completion] Workflow completed. Success: true. Human Review Required: ${phase6FullResult.humanReviewRequired}`);
    return {
      success: true, finalSynthesis: currentSessionState.finalRefinedSynthesisOutput, 
      sessionState: currentSessionState,
      humanReviewRequired: phase6FullResult.humanReviewRequired,
      humanReviewReason: phase6FullResult.humanReviewReason,
    };
  } catch (error: any) { 
    const criticalFailureMsg = `Critical failure in orchestration: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`MasterOrchestrator: [MasterOrchestrator_GlobalCatch] ${criticalFailureMsg}`, { errorDetails: error, timestamp: new Date().toISOString() });
    const finalErrorEntry: ErrorInfo = {
      agent: 'MasterOrchestrator_GlobalCatch', error: criticalFailureMsg, timestamp: new Date().toISOString(),
      recoveryAttempted: false, phase: 'MasterOrchestrator_GlobalCatch',
      inputSummary: `Original Query: ${currentSessionState.originalQuery.substring(0,100)}...`, attempt: 1, isCriticalFailure: true,
    };
    currentSessionState = { ...currentSessionState, errorsEncountered: [...(currentSessionState.errorsEncountered || []), finalErrorEntry] };
    console.log(`MasterOrchestrator: [MasterOrchestrator_Completion] Workflow completed. Success: false due to critical error. Human Review Required: ${parsedInput.data.enableHumanReview}`);
    return { success: false, sessionState: currentSessionState, humanReviewRequired: parsedInput.data.enableHumanReview, humanReviewReason: criticalFailureMsg };
  }
}

export const masterOrchestratorFlow = ai.defineFlow(
  { name: 'masterOrchestratorFlow', inputSchema: MasterOrchestratorInputSchema, outputSchema: MasterOrchestratorOutputSchema },
  orchestrateWithMaster
);

import { toolAuditSystem } from './tool-audit-system';
import { workflowMetricsSystem } from './workflow-metrics-system';
import { quickSystemHealthCheck, type ValidationFrameworkOutput } from './agent-validation-framework';
// const toolAuditSystem = new ToolAuditSystem();
// const workflowMetrics = new WorkflowMetricsSystem();
