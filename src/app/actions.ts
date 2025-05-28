"use server";

import { respond, RespondOutput } from '@/ai/flows/responder-agent';
import { researchEvidence, Evidence, ResearchEvidenceOutput } from '@/ai/flows/researcher-agent';
import { critiqueAgent, CritiqueAgentOutput } from '@/ai/flows/critic-agent';
import { challenge, ChallengeOutput } from '@/ai/flows/devils-advocate-agent';
import { analyzeFailures, PremortermItem, PremortermItemInput } from '@/ai/flows/premortem-agent';
import { analyzeAssumptions, AnalyzeAssumptionsOutput, AnalyzeAssumptionsInput } from '@/ai/flows/assumption-analyzer-agent';

export interface AgentCommunicationLogEntry {
  timestamp: string;
  agent: string;
  action: string;
  details?: string;
}

export interface FullAnalysisResults {
  initialAnswer?: string;
  evidence?: Evidence[];
  critique?: string;
  counterArguments?: string[];
  premortermFailures?: PremortermItem[];
  assumptions?: AnalyzeAssumptionsOutput;
  communicationLog: AgentCommunicationLogEntry[];
}

export async function runAnalysisPipelineAction(query: string): Promise<FullAnalysisResults> {
  const communicationLog: AgentCommunicationLogEntry[] = [];
  const results: Partial<FullAnalysisResults> = {};

  const logStep = (agent: string, action: string, details?: string) => {
    communicationLog.push({ timestamp: new Date().toISOString(), agent, action, details });
  };

  try {
    logStep("System", "Analysis Pipeline Started", `Query: ${query.substring(0,50)}...`);

    // Step 1: Initial Response
    logStep("ResponderAgent", "Generating initial response...");
    const responderOutput: RespondOutput = await respond({ query });
    results.initialAnswer = responderOutput.answer;
    logStep("ResponderAgent", "Initial response generated.", `Length: ${results.initialAnswer?.length} chars`);

    if (!results.initialAnswer) {
      throw new Error("ResponderAgent failed to generate an initial answer.");
    }

    // Step 2: Evidence Research
    logStep("ResearcherAgent", "Researching evidence for the initial answer...");
    const researchOutput: ResearchEvidenceOutput = await researchEvidence({ claim: results.initialAnswer });
    results.evidence = researchOutput;
    logStep("ResearcherAgent", "Evidence research complete.", `Found ${results.evidence?.length} pieces of evidence`);
    
    if (!results.evidence) { // researchOutput can be an empty array, which is valid.
        results.evidence = []; // Ensure it's an array.
        logStep("ResearcherAgent", "No evidence found, but process continued.");
    }

    // Step 3: Critical Analysis
    logStep("CriticAgent", "Critiquing the answer and evidence...");
    const critiqueOutput: CritiqueAgentOutput = await critiqueAgent({ answer: results.initialAnswer, evidence: results.evidence });
    results.critique = critiqueOutput;
    logStep("CriticAgent", "Critique generated.", `Length: ${results.critique?.length} chars`);

    if (!results.critique) {
      throw new Error("CriticAgent failed to generate a critique.");
    }

    // Step 4: Devil's Advocate
    logStep("DevilsAdvocateAgent", "Generating challenges...");
    const challengeOutput: ChallengeOutput = await challenge({ answer: results.initialAnswer, critique: results.critique });
    results.counterArguments = challengeOutput;
    logStep("DevilsAdvocateAgent", "Challenges generated.", `${results.counterArguments?.length} counterarguments`);
    
    if (!results.counterArguments) { // challengeOutput can be an empty array.
        results.counterArguments = [];
        logStep("DevilsAdvocateAgent", "No counterarguments generated, but process continued.");
    }

    // Step 5: Premortem Analysis
    logStep("PremortermAgent", "Analyzing potential failures...");
    const premortemInput: PremortermItemInput = { answer: results.initialAnswer };
    const premortemOutput: PremortermItem[] = await analyzeFailures(premortemInput);
    results.premortermFailures = premortemOutput;
    logStep("PremortermAgent", "Failure analysis complete.", `${results.premortermFailures?.length} potential failures`);

    if (!results.premortermFailures) {
        results.premortermFailures = [];
        logStep("PremortermAgent", "No failures identified, but process continued.");
    }

    // Step 6: Assumption Analysis
    logStep("AssumptionAnalyzerAgent", "Analyzing hidden assumptions...");
    const assumptionInput: AnalyzeAssumptionsInput = { answer: results.initialAnswer };
    const assumptionOutput: AnalyzeAssumptionsOutput = await analyzeAssumptions(assumptionInput);
    results.assumptions = assumptionOutput;
    logStep("AssumptionAnalyzerAgent", "Assumption analysis complete.", `${results.assumptions?.length} assumptions`);

    if (!results.assumptions) {
        results.assumptions = [];
        logStep("AssumptionAnalyzerAgent", "No assumptions identified, but process continued.");
    }

    logStep("System", "Analysis Pipeline Completed Successfully.");

  } catch (error: any) {
    console.error("Pipeline Error:", error);
    logStep("System", "Analysis Pipeline Failed", error.message);
    // Re-throw the error to be caught by the client component
    throw new Error(`Pipeline error: ${error.message || 'An unexpected error occurred in the analysis pipeline.'}`);
  } finally {
    results.communicationLog = communicationLog;
  }

  return results as FullAnalysisResults;
}
