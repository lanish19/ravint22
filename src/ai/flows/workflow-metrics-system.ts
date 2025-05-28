'use server';

import { z } from 'genkit';

// Workflow phase metrics schema
const PhaseMetricsSchema = z.object({
  phaseName: z.string().describe('Name of the workflow phase'),
  phaseId: z.string().describe('Unique identifier for the phase'),
  startTime: z.string().describe('ISO timestamp when phase started'),
  endTime: z.string().optional().describe('ISO timestamp when phase ended'),
  duration: z.number().optional().describe('Phase duration in milliseconds'),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']).describe('Current phase status'),
  agentsInvolved: z.array(z.string()).describe('List of agents that participated in this phase'),
  inputSize: z.number().optional().describe('Size of input data in characters/bytes'),
  outputSize: z.number().optional().describe('Size of output data in characters/bytes'),
  errorCount: z.number().default(0).describe('Number of errors encountered in this phase'),
  retryCount: z.number().default(0).describe('Number of retries attempted'),
  qualityScore: z.number().optional().describe('Quality assessment score (0-100)'),
  confidence: z.number().optional().describe('Confidence level (0-100)'),
  memoryUsage: z.number().optional().describe('Peak memory usage in MB'),
  toolUsage: z.array(z.object({
    toolName: z.string(),
    callCount: z.number(),
    totalDuration: z.number(),
    successRate: z.number(),
  })).default([]).describe('Tool usage statistics for this phase'),
});

const WorkflowSessionMetricsSchema = z.object({
  sessionId: z.string().describe('Unique session identifier'),
  workflowType: z.string().describe('Type of workflow being executed'),
  startTime: z.string().describe('Session start timestamp'),
  endTime: z.string().optional().describe('Session end timestamp'),
  totalDuration: z.number().optional().describe('Total session duration in milliseconds'),
  status: z.enum(['initializing', 'running', 'completed', 'failed', 'cancelled']).describe('Overall session status'),
  phases: z.array(PhaseMetricsSchema).describe('Metrics for each phase in the workflow'),
  overallQuality: z.number().optional().describe('Overall quality score (0-100)'),
  overallConfidence: z.number().optional().describe('Overall confidence level (0-100)'),
  totalAgentsUsed: z.number().default(0).describe('Total number of unique agents used'),
  totalErrors: z.number().default(0).describe('Total number of errors across all phases'),
  totalRetries: z.number().default(0).describe('Total number of retries across all phases'),
  inputQuery: z.string().optional().describe('Original input query'),
  outputSummary: z.string().optional().describe('Brief summary of final output'),
  resourceUsage: z.object({
    peakMemoryMB: z.number().optional(),
    totalAPICallsMade: z.number().default(0),
    totalTokensUsed: z.number().default(0),
    estimatedCostUSD: z.number().optional(),
  }).optional().describe('Resource usage statistics'),
  performanceInsights: z.array(z.object({
    type: z.enum(['bottleneck', 'optimization', 'warning', 'success']),
    message: z.string(),
    phase: z.string().optional(),
    impact: z.enum(['low', 'medium', 'high']),
    recommendation: z.string().optional(),
  })).default([]).describe('Performance insights and recommendations'),
});

type PhaseMetrics = z.infer<typeof PhaseMetricsSchema>;
type WorkflowSessionMetrics = z.infer<typeof WorkflowSessionMetricsSchema>;

// Workflow metrics tracking system
class WorkflowMetricsSystem {
  private sessions: Map<string, WorkflowSessionMetrics> = new Map();
  private currentPhase: Map<string, string> = new Map(); // sessionId -> currentPhaseId
  private phaseStartTimes: Map<string, number> = new Map(); // phaseId -> startTime
  private maxSessionHistory: number = 100;

  constructor(options: { maxSessionHistory?: number } = {}) {
    this.maxSessionHistory = options.maxSessionHistory ?? 100;
  }

  // Initialize a new workflow session
  public startSession(sessionId: string, workflowType: string, inputQuery?: string): WorkflowSessionMetrics {
    const session: WorkflowSessionMetrics = {
      sessionId,
      workflowType,
      startTime: new Date().toISOString(),
      status: 'initializing',
      phases: [],
      totalAgentsUsed: 0,
      totalErrors: 0,
      totalRetries: 0,
      inputQuery,
      resourceUsage: {
        totalAPICallsMade: 0,
        totalTokensUsed: 0,
      },
      performanceInsights: [],
    };

    this.sessions.set(sessionId, session);
    
    // Cleanup old sessions if limit exceeded
    if (this.sessions.size > this.maxSessionHistory) {
      const oldestSessionId = Array.from(this.sessions.keys())[0];
      this.sessions.delete(oldestSessionId);
    }

    console.log('WorkflowMetricsSystem: Session started', {
      sessionId,
      workflowType,
      queryLength: inputQuery?.length,
    });

    return session;
  }

  // Start a new phase within a session
  public startPhase(sessionId: string, phaseName: string, phaseId?: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn('WorkflowMetricsSystem: Session not found for phase start', { sessionId, phaseName });
      return phaseId || `${phaseName}_${Date.now()}`;
    }

    const actualPhaseId = phaseId || `${phaseName}_${Date.now()}`;
    const now = new Date();
    
    const phaseMetrics: PhaseMetrics = {
      phaseName,
      phaseId: actualPhaseId,
      startTime: now.toISOString(),
      status: 'running',
      agentsInvolved: [],
      errorCount: 0,
      retryCount: 0,
      toolUsage: [],
    };

    session.phases.push(phaseMetrics);
    session.status = 'running';
    this.currentPhase.set(sessionId, actualPhaseId);
    this.phaseStartTimes.set(actualPhaseId, now.getTime());

    console.log('WorkflowMetricsSystem: Phase started', {
      sessionId,
      phaseName,
      phaseId: actualPhaseId,
    });

    return actualPhaseId;
  }

  // Complete a phase
  public completePhase(
    sessionId: string, 
    phaseId: string, 
    status: 'completed' | 'failed' | 'skipped' = 'completed',
    qualityScore?: number,
    confidence?: number
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn('WorkflowMetricsSystem: Session not found for phase completion', { sessionId, phaseId });
      return;
    }

    const phase = session.phases.find(p => p.phaseId === phaseId);
    if (!phase) {
      console.warn('WorkflowMetricsSystem: Phase not found for completion', { sessionId, phaseId });
      return;
    }

    const endTime = new Date();
    const startTime = this.phaseStartTimes.get(phaseId);
    
    phase.endTime = endTime.toISOString();
    phase.status = status;
    phase.duration = startTime ? endTime.getTime() - startTime : undefined;
    phase.qualityScore = qualityScore;
    phase.confidence = confidence;

    // Update session totals
    session.totalErrors += phase.errorCount;
    session.totalRetries += phase.retryCount;

    // Performance insights for slow phases
    if (phase.duration && phase.duration > 30000) { // 30 seconds
      session.performanceInsights.push({
        type: 'bottleneck',
        message: `Phase ${phase.phaseName} took ${Math.round(phase.duration / 1000)}s to complete`,
        phase: phase.phaseName,
        impact: phase.duration > 60000 ? 'high' : 'medium',
        recommendation: 'Consider optimizing this phase or running sub-agents in parallel',
      });
    }

    // Quality insights
    if (qualityScore !== undefined && qualityScore < 60) {
      session.performanceInsights.push({
        type: 'warning',
        message: `Phase ${phase.phaseName} produced low quality results (${qualityScore}/100)`,
        phase: phase.phaseName,
        impact: 'medium',
        recommendation: 'Review agent prompts and consider additional validation',
      });
    }

    console.log('WorkflowMetricsSystem: Phase completed', {
      sessionId,
      phaseId,
      phaseName: phase.phaseName,
      duration: phase.duration,
      status,
      qualityScore,
    });

    // Clear current phase tracking
    if (this.currentPhase.get(sessionId) === phaseId) {
      this.currentPhase.delete(sessionId);
    }
    this.phaseStartTimes.delete(phaseId);
  }

  // Record agent usage in current phase
  public recordAgentUsage(sessionId: string, agentName: string, phaseId?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const targetPhaseId = phaseId || this.currentPhase.get(sessionId);
    if (!targetPhaseId) return;

    const phase = session.phases.find(p => p.phaseId === targetPhaseId);
    if (!phase) return;

    if (!phase.agentsInvolved.includes(agentName)) {
      phase.agentsInvolved.push(agentName);
    }

    // Update session total unique agents
    const sessionAgents = new Set(session.phases.flatMap(p => p.agentsInvolved));
    session.totalAgentsUsed = sessionAgents.size;
  }

  // Record tool usage in current phase
  public recordToolUsage(
    sessionId: string, 
    toolName: string, 
    duration: number, 
    success: boolean,
    phaseId?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const targetPhaseId = phaseId || this.currentPhase.get(sessionId);
    if (!targetPhaseId) return;

    const phase = session.phases.find(p => p.phaseId === targetPhaseId);
    if (!phase) return;

    let toolUsage = phase.toolUsage.find(t => t.toolName === toolName);
    if (!toolUsage) {
      toolUsage = {
        toolName,
        callCount: 0,
        totalDuration: 0,
        successRate: 0,
      };
      phase.toolUsage.push(toolUsage);
    }

    toolUsage.callCount++;
    toolUsage.totalDuration += duration;
    toolUsage.successRate = ((toolUsage.successRate * (toolUsage.callCount - 1)) + (success ? 1 : 0)) / toolUsage.callCount;

    // Update session resource usage
    if (session.resourceUsage) {
      session.resourceUsage.totalAPICallsMade++;
    }
  }

  // Record an error in the current phase
  public recordError(sessionId: string, errorMessage: string, agentName?: string, phaseId?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const targetPhaseId = phaseId || this.currentPhase.get(sessionId);
    if (!targetPhaseId) return;

    const phase = session.phases.find(p => p.phaseId === targetPhaseId);
    if (!phase) return;

    phase.errorCount++;
    
    // Add performance insight for errors
    session.performanceInsights.push({
      type: 'warning',
      message: `Error in ${phase.phaseName}${agentName ? ` (${agentName})` : ''}: ${errorMessage.substring(0, 100)}`,
      phase: phase.phaseName,
      impact: 'medium',
      recommendation: 'Review error handling and consider backup strategies',
    });

    console.log('WorkflowMetricsSystem: Error recorded', {
      sessionId,
      phaseId: targetPhaseId,
      phaseName: phase.phaseName,
      agentName,
      errorCount: phase.errorCount,
    });
  }

  // Record a retry in the current phase
  public recordRetry(sessionId: string, agentName?: string, phaseId?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const targetPhaseId = phaseId || this.currentPhase.get(sessionId);
    if (!targetPhaseId) return;

    const phase = session.phases.find(p => p.phaseId === targetPhaseId);
    if (!phase) return;

    phase.retryCount++;

    console.log('WorkflowMetricsSystem: Retry recorded', {
      sessionId,
      phaseId: targetPhaseId,
      phaseName: phase.phaseName,
      agentName,
      retryCount: phase.retryCount,
    });
  }

  // Complete a workflow session
  public completeSession(
    sessionId: string, 
    status: 'completed' | 'failed' | 'cancelled' = 'completed',
    outputSummary?: string,
    overallQuality?: number,
    overallConfidence?: number
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn('WorkflowMetricsSystem: Session not found for completion', { sessionId });
      return;
    }

    const endTime = new Date();
    const startTime = new Date(session.startTime);
    
    session.endTime = endTime.toISOString();
    session.status = status;
    session.totalDuration = endTime.getTime() - startTime.getTime();
    session.outputSummary = outputSummary;
    session.overallQuality = overallQuality;
    session.overallConfidence = overallConfidence;

    // Generate final performance insights
    const completedPhases = session.phases.filter(p => p.status === 'completed');
    const failedPhases = session.phases.filter(p => p.status === 'failed');
    
    if (failedPhases.length > 0) {
      session.performanceInsights.push({
        type: 'warning',
        message: `${failedPhases.length} out of ${session.phases.length} phases failed`,
        impact: 'high',
        recommendation: 'Review failed phases and improve error handling',
      });
    }

    if (session.totalDuration && session.totalDuration > 300000) { // 5 minutes
      session.performanceInsights.push({
        type: 'bottleneck',
        message: `Workflow took ${Math.round(session.totalDuration / 60000)} minutes to complete`,
        impact: 'medium',
        recommendation: 'Consider parallelizing more operations or optimizing slow phases',
      });
    }

    if (overallQuality !== undefined && overallQuality >= 80) {
      session.performanceInsights.push({
        type: 'success',
        message: `High quality output achieved (${overallQuality}/100)`,
        impact: 'low',
        recommendation: 'Current configuration is working well',
      });
    }

    console.log('WorkflowMetricsSystem: Session completed', {
      sessionId,
      status,
      totalDuration: session.totalDuration,
      phasesCompleted: completedPhases.length,
      phasesFailed: failedPhases.length,
      overallQuality,
    });
  }

  // Get session metrics
  public getSessionMetrics(sessionId: string): WorkflowSessionMetrics | null {
    return this.sessions.get(sessionId) || null;
  }

  // Get performance summary across all sessions
  public getPerformanceSummary(): {
    totalSessions: number;
    averageDuration: number;
    successRate: number;
    mostUsedAgents: Array<{ agent: string; usage: number }>;
    commonBottlenecks: Array<{ phase: string; avgDuration: number; frequency: number }>;
    qualityTrends: Array<{ session: string; quality: number; timestamp: string }>;
  } {
    const sessions = Array.from(this.sessions.values());
    const completedSessions = sessions.filter(s => s.status === 'completed');
    
    const totalSessions = sessions.length;
    const averageDuration = completedSessions.length > 0 
      ? completedSessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0) / completedSessions.length
      : 0;
    const successRate = totalSessions > 0 ? (completedSessions.length / totalSessions) * 100 : 0;

    // Agent usage analysis
    const agentUsage: Record<string, number> = {};
    sessions.forEach(session => {
      session.phases.forEach(phase => {
        phase.agentsInvolved.forEach(agent => {
          agentUsage[agent] = (agentUsage[agent] || 0) + 1;
        });
      });
    });
    const mostUsedAgents = Object.entries(agentUsage)
      .map(([agent, usage]) => ({ agent, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10);

    // Bottleneck analysis
    const phasePerformance: Record<string, { durations: number[]; count: number }> = {};
    sessions.forEach(session => {
      session.phases.forEach(phase => {
        if (phase.duration) {
          if (!phasePerformance[phase.phaseName]) {
            phasePerformance[phase.phaseName] = { durations: [], count: 0 };
          }
          phasePerformance[phase.phaseName].durations.push(phase.duration);
          phasePerformance[phase.phaseName].count++;
        }
      });
    });
    const commonBottlenecks = Object.entries(phasePerformance)
      .map(([phase, data]) => ({
        phase,
        avgDuration: data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length,
        frequency: data.count,
      }))
      .filter(item => item.avgDuration > 10000) // Only phases taking >10 seconds
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);

    // Quality trends
    const qualityTrends = sessions
      .filter(s => s.overallQuality !== undefined)
      .map(s => ({
        session: s.sessionId,
        quality: s.overallQuality!,
        timestamp: s.startTime,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    return {
      totalSessions,
      averageDuration,
      successRate,
      mostUsedAgents,
      commonBottlenecks,
      qualityTrends,
    };
  }

  // Export all metrics data
  public exportMetrics(): {
    sessions: WorkflowSessionMetrics[];
    summary: {
      totalSessions: number;
      averageDuration: number;
      successRate: number;
      mostUsedAgents: Array<{ agent: string; usage: number }>;
      commonBottlenecks: Array<{ phase: string; avgDuration: number; frequency: number }>;
      qualityTrends: Array<{ session: string; quality: number; timestamp: string }>;
    };
  } {
    return {
      sessions: Array.from(this.sessions.values()),
      summary: this.getPerformanceSummary(),
    };
  }

  // Clear old sessions
  public clearOldSessions(beforeDate: Date): number {
    let cleared = 0;
    const sessionEntries = Array.from(this.sessions.entries());
    for (const [sessionId, session] of sessionEntries) {
      if (new Date(session.startTime) < beforeDate) {
        this.sessions.delete(sessionId);
        cleared++;
      }
    }
    console.log(`WorkflowMetricsSystem: Cleared ${cleared} old sessions`);
    return cleared;
  }
}

// Global instance
export const workflowMetricsSystem = new WorkflowMetricsSystem({
  maxSessionHistory: 100,
});

// Helper function to create metrics tracker for a session
export function createSessionMetrics(sessionId: string, workflowType: string, inputQuery?: string) {
  return {
    session: workflowMetricsSystem.startSession(sessionId, workflowType, inputQuery),
    startPhase: (phaseName: string, phaseId?: string) => 
      workflowMetricsSystem.startPhase(sessionId, phaseName, phaseId),
    completePhase: (phaseId: string, status?: 'completed' | 'failed' | 'skipped', qualityScore?: number, confidence?: number) =>
      workflowMetricsSystem.completePhase(sessionId, phaseId, status, qualityScore, confidence),
    recordAgent: (agentName: string, phaseId?: string) =>
      workflowMetricsSystem.recordAgentUsage(sessionId, agentName, phaseId),
    recordTool: (toolName: string, duration: number, success: boolean, phaseId?: string) =>
      workflowMetricsSystem.recordToolUsage(sessionId, toolName, duration, success, phaseId),
    recordError: (errorMessage: string, agentName?: string, phaseId?: string) =>
      workflowMetricsSystem.recordError(sessionId, errorMessage, agentName, phaseId),
    recordRetry: (agentName?: string, phaseId?: string) =>
      workflowMetricsSystem.recordRetry(sessionId, agentName, phaseId),
    complete: (status?: 'completed' | 'failed' | 'cancelled', outputSummary?: string, overallQuality?: number, overallConfidence?: number) =>
      workflowMetricsSystem.completeSession(sessionId, status, outputSummary, overallQuality, overallConfidence),
    getMetrics: () => workflowMetricsSystem.getSessionMetrics(sessionId),
  };
}

export type { PhaseMetrics, WorkflowSessionMetrics }; 