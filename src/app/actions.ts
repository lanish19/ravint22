
"use server";

import { orchestrateQuery, type OrchestratorInput, type OrchestratorOutput } from '@/ai/flows/orchestrator-agent';
import type { RespondOutput } from '@/ai/flows/responder-agent';
import type { ResearchEvidenceOutput } from '@/ai/flows/researcher-agent';
import type { ResearchCounterEvidenceOutput } from '@/ai/flows/counter-evidence-researcher-agent'; // New
import type { CritiqueAgentOutput } from '@/ai/flows/critic-agent';
import type { ChallengeOutput } from '@/ai/flows/devils-advocate-agent';
import type { PremortemOutput } from '@/ai/flows/premortem-agent';
import type { AnalyzeAssumptionsOutput } from '@/ai/flows/assumption-analyzer-agent';
import type { InformationGapOutput } from '@/ai/flows/information-gap-agent';
import type { SynthesisAgentOutput } from '@/ai/flows/synthesis-agent';


// This interface aligns with the structure returned by the orchestrator-agent.
export interface FullAnalysisResults {
  initialAnswer: RespondOutput;
  assumptions: AnalyzeAssumptionsOutput;
  research: ResearchEvidenceOutput; // Supporting evidence
  counterEvidence: ResearchCounterEvidenceOutput; // New: Counter-evidence
  critique: CritiqueAgentOutput;
  challenges: ChallengeOutput;
  premortemAnalysis: PremortemOutput;
  informationGaps: InformationGapOutput;
  synthesis: SynthesisAgentOutput;
  orchestrationSummary: string;
}


export async function runAnalysisPipelineAction(query: string): Promise<FullAnalysisResults> {
  console.log(`runAnalysisPipelineAction: Starting for query - ${query.substring(0,100)}...`);
  
  try {
    const orchestratorInput: OrchestratorInput = { query };
    const orchestratorResult: OrchestratorOutput = await orchestrateQuery(orchestratorInput);

    const results: FullAnalysisResults = {
      initialAnswer: orchestratorResult.initialAnswer,
      assumptions: orchestratorResult.assumptions,
      research: orchestratorResult.research,
      counterEvidence: orchestratorResult.counterEvidence, // New
      critique: orchestratorResult.critique,
      challenges: orchestratorResult.challenges,
      premortemAnalysis: orchestratorResult.premortemAnalysis,
      informationGaps: orchestratorResult.informationGaps,
      synthesis: orchestratorResult.synthesis,
      orchestrationSummary: orchestratorResult.finalSummary,
    };
    
    console.log(`runAnalysisPipelineAction: Orchestration successful. Summary: ${results.orchestrationSummary.substring(0,100)}...`);
    return results;

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`runAnalysisPipelineAction: Critical pipeline error - ${errorMessage}`, { query, error });
    
    // Ensure a structured error is thrown if possible, or fallback to a generic message
    const fullErrorMessage = `Pipeline error: ${errorMessage || 'An unexpected error occurred in the analysis pipeline.'}`;
    throw new Error(fullErrorMessage);
  }
}
