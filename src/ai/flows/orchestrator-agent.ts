'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

import {
  respond,
  RespondInput,
  RespondOutput,
} from './responder-agent';
import {
  analyzeAssumptions,
  AnalyzeAssumptionsInput,
  AnalyzeAssumptionsOutput,
} from './assumption-analyzer-agent';
import {
  researchEvidence,
  ResearchEvidenceInput,
  ResearchEvidenceOutput,
} from './researcher-agent';
import {
  critiqueAgent,
  CritiqueAgentInput,
  CritiqueAgentOutput,
} from './critic-agent';
import {
  challenge,
  ChallengeInput,
  ChallengeOutput,
} from './devils-advocate-agent';
import {
  analyzeFailures,
  PremortermItemInput,
  PremortermItemSchema, // Assuming PremortermItem is the schema for PremortermItemOutput
  PremortermItem,
} from './premortem-agent';

// Input Schema
export const OrchestratorInputSchema = z.object({
  query: z.string(),
});
export type OrchestratorInput = z.infer<typeof OrchestratorInputSchema>;

// Output Schema
export const OrchestratorOutputSchema = z.object({
  initialAnswer: RespondOutput,
  assumptions: AnalyzeAssumptionsOutput,
  research: ResearchEvidenceOutput,
  critique: CritiqueAgentOutput,
  challenges: ChallengeOutput,
  premortemAnalysis: z.array(PremortermItemSchema),
  finalSummary: z.string(),
});
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;

// Orchestrator Flow
export const orchestrateQueryFlow = ai.defineFlow(
  {
    name: 'orchestrateQueryFlow',
    inputSchema: OrchestratorInputSchema,
    outputSchema: OrchestratorOutputSchema,
  },
  async (input: OrchestratorInput): Promise<OrchestratorOutput> => {
    console.log('Orchestrator: Starting flow with input query:', input.query);

    let output: OrchestratorOutput = {
      initialAnswer: { answer: "" },
      assumptions: [],
      research: [],
      critique: "",
      challenges: [],
      premortemAnalysis: [],
      finalSummary: "Orchestration did not complete fully.", // Default summary
    };

    let initialAnswerText = "";

    // 1. Call respond agent
    try {
      const responderOutput: RespondOutput = await respond({ query: input.query });
      output.initialAnswer = responderOutput;
      initialAnswerText = responderOutput.answer;
      if (!initialAnswerText) { // handle case where responder returns empty answer
        console.error('Orchestrator: Responder Agent returned an empty answer.');
        output.finalSummary = "Orchestrator: Responder Agent returned an empty answer. Halting process.";
        return output;
      }
    } catch (error) {
      console.error('Orchestrator: Responder Agent failed. Halting process.', error);
      output.finalSummary = "Orchestrator: Responder Agent failed. Essential first step could not be completed.";
      return output;
    }

    // 2. Call analyzeAssumptions agent
    try {
      const assumptionsOutput: AnalyzeAssumptionsOutput = await analyzeAssumptions({ text: initialAnswerText });
      output.assumptions = assumptionsOutput;
    } catch (error) {
      console.error('Orchestrator: AnalyzeAssumptions Agent failed.', error);
      // Orchestration continues, output.assumptions remains empty array
    }

    // 3. Call researchEvidence agent
    try {
      // Ensure researchFindings is part of the ResearchEvidenceOutput type.
      // The schema for ResearchEvidenceOutput is z.array(EvidenceSchema)
      // which is an array of objects, so researchFindings might be a property of an object within that array,
      // or the array itself. Assuming ResearchEvidenceOutput is the array of findings directly.
      const researchOutput: ResearchEvidenceOutput = await researchEvidence({ claim: initialAnswerText });
      output.research = researchOutput;
    } catch (error) {
      console.error('Orchestrator: ResearchEvidence Agent failed.', error);
      // Orchestration continues, output.research remains empty array
    }

    // 4. Call critiqueAgent
    try {
      // The critique agent expects `evidence` as a string, not an array of objects.
      // We need to map over `output.research` (which is an array of Evidence objects)
      // and join their `support` (or `evidence` if that's the field name) properties.
      // Based on researcher-agent.ts, EvidenceSchema has 'support'
      const evidenceTextForCritique = output.research.map(e => e.support).join('\n');
      const critiqueOutput: CritiqueAgentOutput = await critiqueAgent({
        answer: initialAnswerText,
        evidence: evidenceTextForCritique,
      });
      output.critique = critiqueOutput;
    } catch (error) {
      console.error('Orchestrator: Critique Agent failed.', error);
      // Orchestration continues, output.critique remains empty string
    }

    // 5. Call challenge agent
    try {
      const challengeOutput: ChallengeOutput = await challenge({
        text: initialAnswerText,
        critique: output.critique, // Use the potentially empty critique string
      });
      output.challenges = challengeOutput;
    } catch (error) {
      console.error('Orchestrator: Challenge Agent failed.', error);
      // Orchestration continues, output.challenges remains empty array
    }

    // 6. Call analyzeFailures (premortem) agent
    try {
      const premortemInput: PremortermItemInput = { answer: initialAnswerText }; // Corrected from 'text' to 'answer'
      const premortemAnalysisOutput: PremortermItem[] = await analyzeFailures(premortemInput);
      output.premortemAnalysis = premortemAnalysisOutput;
    } catch (error) {
      console.error('Orchestrator: AnalyzeFailures Agent failed.', error);
      // Orchestration continues, output.premortemAnalysis remains empty array
    }

    // 7. Construct finalSummary
    let summaryParts = [];
    summaryParts.push(`Initial Answer: ${output.initialAnswer.answer}`);
    if (output.assumptions.length > 0) {
      summaryParts.push(`Assumptions: ${JSON.stringify(output.assumptions)}`);
    } else {
      summaryParts.push("Assumptions: Analysis not available or failed.");
    }
    if (output.research.length > 0) {
      summaryParts.push(`Research: ${JSON.stringify(output.research)}`);
    } else {
      summaryParts.push("Research: Analysis not available or failed.");
    }
    if (output.critique) {
      summaryParts.push(`Critique: ${output.critique}`);
    } else {
      summaryParts.push("Critique: Analysis not available or failed.");
    }
    if (output.challenges.length > 0) {
      summaryParts.push(`Challenges: ${JSON.stringify(output.challenges)}`);
    } else {
      summaryParts.push("Challenges: Analysis not available or failed.");
    }
    if (output.premortemAnalysis.length > 0) {
      summaryParts.push(`Potential Failures: ${JSON.stringify(output.premortemAnalysis)}`);
    } else {
      summaryParts.push("Potential Failures: Analysis not available or failed.");
    }
    
    // Check if all agents (excluding responder) completed successfully
    const allSubsequentAgentsCompleted = output.assumptions.length > 0 &&
                                       output.research.length > 0 &&
                                       output.critique !== "" &&
                                       output.challenges.length > 0 &&
                                       output.premortemAnalysis.length > 0;

    if (allSubsequentAgentsCompleted) {
      output.finalSummary = "Orchestration completed successfully with all agents contributing.\n\n" + summaryParts.join('\n\n');
    } else {
       output.finalSummary = "Orchestration completed with partial results due to some agent failures.\n\n" + summaryParts.join('\n\n');
    }
    
    return output;
  }
);

// Exported function to call the flow
export async function orchestrateQuery(
  input: OrchestratorInput
): Promise<OrchestratorOutput> {
  return await orchestrateQueryFlow(input);
}
