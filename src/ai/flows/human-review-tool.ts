'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// E10: Human Review Tool - Enables human-in-the-loop for critical decisions

const HumanReviewInputSchema = z.object({
  reviewType: z.enum(['critical_decision', 'low_confidence', 'high_risk', 'user_requested']),
  context: z.object({
    query: z.string(),
    currentAnalysis: z.any(),
    confidence: z.object({
      score: z.enum(['High', 'Medium', 'Low']),
      numericScore: z.number().optional(),
      rationale: z.string(),
    }),
    criticalIssues: z.array(z.string()),
    artifacts: z.record(z.string(), z.any()).optional(),
  }),
  reviewRequest: z.object({
    specificQuestions: z.array(z.string()),
    areasNeedingExpertise: z.array(z.string()),
    suggestedActions: z.array(z.string()),
    urgency: z.enum(['immediate', 'high', 'medium', 'low']),
  }),
});
export type HumanReviewInput = z.infer<typeof HumanReviewInputSchema>;

const HumanReviewOutputSchema = z.object({
  reviewCompleted: z.boolean(),
  reviewId: z.string(),
  humanInput: z.object({
    decision: z.enum(['approve', 'reject', 'modify', 'request_more_analysis']).optional(),
    feedback: z.string().optional(),
    modifications: z.record(z.string(), z.any()).optional(),
    additionalGuidance: z.array(z.string()).optional(),
    confidenceAdjustment: z.enum(['increase', 'decrease', 'maintain']).optional(),
  }).optional(),
  nextSteps: z.array(z.string()),
  timestamp: z.string(),
});
export type HumanReviewOutput = z.infer<typeof HumanReviewOutputSchema>;

// Human Review System - Production Ready Interface
// This implementation provides the structure for real integrations
interface ReviewSystemConfig {
  taskQueueUrl?: string;
  notificationEmail?: string;
  timeoutMinutes?: number;
  webhookUrl?: string;
}

interface ReviewSubmission {
  id: string;
  input: HumanReviewInput;
  submittedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'completed' | 'expired' | 'failed';
  result?: HumanReviewOutput['humanInput'];
}

class HumanReviewSystem {
  private config: ReviewSystemConfig;
  private pendingReviews: Map<string, ReviewSubmission> = new Map();
  
  constructor(config: ReviewSystemConfig = {}) {
    // Load from environment if available and merge with provided config
    const envTimeoutMinutes = process.env.REVIEW_TIMEOUT_MINUTES ? parseInt(process.env.REVIEW_TIMEOUT_MINUTES) : undefined;
    
    this.config = {
      timeoutMinutes: envTimeoutMinutes || config.timeoutMinutes || 30,
      taskQueueUrl: process.env.REVIEW_QUEUE_URL || config.taskQueueUrl,
      notificationEmail: process.env.REVIEW_NOTIFICATION_EMAIL || config.notificationEmail,
      webhookUrl: config.webhookUrl,
    };
  }
  
  async submitForReview(input: HumanReviewInput): Promise<string> {
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const submittedAt = new Date();
    const expiresAt = new Date(submittedAt.getTime() + (this.config.timeoutMinutes! * 60 * 1000));
    
    const submission: ReviewSubmission = {
      id: reviewId,
      input,
      submittedAt,
      expiresAt,
      status: 'pending',
    };
    
    this.pendingReviews.set(reviewId, submission);
    
    // Log structured review data
    console.log('HumanReviewSystem: Review submitted', {
      reviewId,
      reviewType: input.reviewType,
      urgency: input.reviewRequest.urgency,
      questionsCount: input.reviewRequest.specificQuestions.length,
      criticalIssuesCount: input.context.criticalIssues.length,
      expiresAt: expiresAt.toISOString(),
    });
    
    // TODO: Production integrations
    await this.notifyReviewers(submission);
    await this.submitToTaskQueue(submission);
    
    return reviewId;
  }
  
  private async notifyReviewers(submission: ReviewSubmission): Promise<void> {
    // TODO: Replace with real notification system
    if (this.config.notificationEmail) {
      console.log('HumanReviewSystem: [TODO] Send email notification', {
        to: this.config.notificationEmail,
        subject: `Human Review Required: ${submission.input.reviewType}`,
        reviewId: submission.id,
        urgency: submission.input.reviewRequest.urgency,
      });
    }
    
    // TODO: Add Slack/Teams/Discord webhook notifications
    if (this.config.webhookUrl) {
      console.log('HumanReviewSystem: [TODO] Send webhook notification', {
        webhook: this.config.webhookUrl,
        reviewId: submission.id,
      });
    }
  }
  
  private async submitToTaskQueue(submission: ReviewSubmission): Promise<void> {
    // TODO: Replace with real task queue (AWS SQS, RabbitMQ, etc.)
    if (this.config.taskQueueUrl) {
      console.log('HumanReviewSystem: [TODO] Submit to task queue', {
        queueUrl: this.config.taskQueueUrl,
        reviewId: submission.id,
        message: {
          reviewId: submission.id,
          type: submission.input.reviewType,
          urgency: submission.input.reviewRequest.urgency,
          questions: submission.input.reviewRequest.specificQuestions,
          expiresAt: submission.expiresAt.toISOString(),
        },
      });
    }
  }
  
  async checkReviewStatus(reviewId: string): Promise<'pending' | 'completed' | 'expired'> {
    const submission = this.pendingReviews.get(reviewId);
    if (!submission) return 'expired';
    
    // Check if expired
    if (new Date() > submission.expiresAt) {
      submission.status = 'expired';
      return 'expired';
    }
    
    // TODO: Check external review system status
    // This would integrate with your review dashboard/API
    
    return submission.status as 'pending' | 'completed' | 'expired';
  }
  
  async getReviewResult(reviewId: string): Promise<HumanReviewOutput['humanInput'] | null> {
    const submission = this.pendingReviews.get(reviewId);
    if (!submission || submission.status !== 'completed') {
      return null;
    }
    
    // TODO: Retrieve from external review system
    // This would fetch the actual human reviewer's input
    
    return submission.result || null;
  }
  
  async expireReview(reviewId: string): Promise<void> {
    const submission = this.pendingReviews.get(reviewId);
    if (submission) {
      submission.status = 'expired';
    }
    
    console.log('HumanReviewSystem: Review expired', {
      reviewId,
      submittedAt: submission?.submittedAt?.toISOString(),
      expiresAt: submission?.expiresAt?.toISOString(),
    });
  }
  
  // Method for external systems to submit review results
  async submitReviewResult(reviewId: string, result: HumanReviewOutput['humanInput']): Promise<boolean> {
    const submission = this.pendingReviews.get(reviewId);
    if (!submission || submission.status !== 'pending') {
      return false;
    }
    
    submission.result = result;
    submission.status = 'completed';
    
    console.log('HumanReviewSystem: Review completed', {
      reviewId,
      decision: result?.decision,
      completedAt: new Date().toISOString(),
    });
    
    return true;
  }
}

const humanReviewSystem = new HumanReviewSystem();

// Function Tool for Human Review
export const humanReviewTool = ai.defineTool({
  name: 'humanReviewTool',
  description: 'Pauses the workflow for human expert review when critical decisions or low confidence situations arise',
  inputSchema: HumanReviewInputSchema,
  outputSchema: HumanReviewOutputSchema,
}, async (input: HumanReviewInput): Promise<HumanReviewOutput> => {
  try {
    // Submit for review
    const reviewId = await humanReviewSystem.submitForReview(input);
    
    // In production, this would:
    // 1. Pause the workflow
    // 2. Wait for human input (with timeout)
    // 3. Resume with human guidance
    
    // For now, we'll simulate immediate response needed
    const status = await humanReviewSystem.checkReviewStatus(reviewId);
    const humanInput = await humanReviewSystem.getReviewResult(reviewId);
    
    if (humanInput) {
      return {
        reviewCompleted: true,
        reviewId,
        humanInput,
        nextSteps: determineNextSteps(humanInput),
        timestamp: new Date().toISOString(),
      };
    }
    
    // No human input yet - workflow should handle this appropriately
    return {
      reviewCompleted: false,
      reviewId,
      humanInput: undefined,
      nextSteps: [
        'Continue with automated analysis at lower confidence',
        'Flag results as pending human review',
        'Provide conservative recommendations',
      ],
      timestamp: new Date().toISOString(),
    };
    
  } catch (error: any) {
    console.error('HumanReviewTool: Error in review process', { error: error.message });
    return {
      reviewCompleted: false,
      reviewId: 'error',
      humanInput: undefined,
      nextSteps: ['Continue with error handling procedures'],
      timestamp: new Date().toISOString(),
    };
  }
});

function determineNextSteps(humanInput: HumanReviewOutput['humanInput']): string[] {
  if (!humanInput) return [];
  
  const steps: string[] = [];
  
  switch (humanInput.decision) {
    case 'approve':
      steps.push('Proceed with current analysis');
      if (humanInput.confidenceAdjustment === 'increase') {
        steps.push('Increase confidence level based on expert validation');
      }
      break;
      
    case 'reject':
      steps.push('Halt current analysis path');
      steps.push('Document rejection reason');
      if (humanInput.additionalGuidance && humanInput.additionalGuidance.length > 0) {
        steps.push('Follow expert guidance for alternative approach');
      }
      break;
      
    case 'modify':
      steps.push('Apply expert modifications to analysis');
      if (humanInput.modifications) {
        steps.push('Update relevant components with expert input');
      }
      steps.push('Re-run affected analysis steps');
      break;
      
    case 'request_more_analysis':
      steps.push('Conduct additional analysis as requested');
      if (humanInput.additionalGuidance) {
        humanInput.additionalGuidance.forEach(guidance => {
          steps.push(`Additional analysis: ${guidance}`);
        });
      }
      break;
  }
  
  if (humanInput.feedback) {
    steps.push('Incorporate expert feedback into final output');
  }
  
  return steps;
}

// Convenience function for triggering human review
export async function requestHumanReview(
  reviewType: HumanReviewInput['reviewType'],
  query: string,
  currentAnalysis: any,
  confidence: HumanReviewInput['context']['confidence'],
  criticalIssues: string[],
  specificQuestions: string[],
  urgency: HumanReviewInput['reviewRequest']['urgency'] = 'medium'
): Promise<HumanReviewOutput> {
  const input: HumanReviewInput = {
    reviewType,
    context: {
      query,
      currentAnalysis,
      confidence,
      criticalIssues,
    },
    reviewRequest: {
      specificQuestions,
      areasNeedingExpertise: identifyExpertiseAreas(criticalIssues),
      suggestedActions: generateSuggestedActions(reviewType, confidence),
      urgency,
    },
  };
  
  return humanReviewTool(input);
}

function identifyExpertiseAreas(criticalIssues: string[]): string[] {
  const areas: string[] = [];
  
  // Simple keyword matching - in production, use more sophisticated analysis
  const issuesText = criticalIssues.join(' ').toLowerCase();
  
  if (issuesText.includes('bias') || issuesText.includes('fairness')) {
    areas.push('Ethics and bias assessment');
  }
  if (issuesText.includes('conflict') || issuesText.includes('contradiction')) {
    areas.push('Conflict resolution and evidence evaluation');
  }
  if (issuesText.includes('risk') || issuesText.includes('failure')) {
    areas.push('Risk assessment and mitigation');
  }
  if (issuesText.includes('assumption') || issuesText.includes('uncertainty')) {
    areas.push('Uncertainty quantification');
  }
  if (issuesText.includes('technical') || issuesText.includes('complex')) {
    areas.push('Domain-specific technical expertise');
  }
  
  return areas.length > 0 ? areas : ['General analytical expertise'];
}

function generateSuggestedActions(
  reviewType: HumanReviewInput['reviewType'],
  confidence: HumanReviewInput['context']['confidence']
): string[] {
  const actions: string[] = [];
  
  switch (reviewType) {
    case 'critical_decision':
      actions.push('Validate critical decision points');
      actions.push('Confirm risk assessment accuracy');
      actions.push('Approve or modify recommendations');
      break;
      
    case 'low_confidence':
      actions.push('Identify missing information sources');
      actions.push('Validate analytical approach');
      actions.push('Provide domain expertise to resolve uncertainties');
      break;
      
    case 'high_risk':
      actions.push('Assess potential negative outcomes');
      actions.push('Validate mitigation strategies');
      actions.push('Approve risk tolerance levels');
      break;
      
    case 'user_requested':
      actions.push('Review analysis completeness');
      actions.push('Validate conclusions against expertise');
      actions.push('Provide additional insights');
      break;
  }
  
  if (confidence.score === 'Low') {
    actions.push('Identify root causes of low confidence');
    actions.push('Suggest additional analysis paths');
  }
  
  return actions;
}
