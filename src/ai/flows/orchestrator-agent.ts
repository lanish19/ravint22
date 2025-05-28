
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Import functions and types from agent files
import { respond, type RespondOutput } from './responder-agent';
import { analyzeAssumptions, type AnalyzeAssumptionsOutput } from './assumption-analyzer-agent';
import { researchEvidence, type ResearchEvidenceOutput } from './researcher-agent';
import { researchCounterEvidence, type ResearchCounterEvidenceOutput } from './counter-evidence-researcher-agent'; // New
import { critiqueAgent, type CritiqueAgentOutput } from './critic-agent';
import { challenge, type ChallengeOutput } from './devils-advocate-agent';
import { analyzeFailures, type PremortemOutput } from './premortem-agent';
import { analyzeInformationGaps, type InformationGapOutput } from './information-gap-agent';
import { synthesizeAnalysis, type SynthesisAgentOutput } from './synthesis-agent';


// Locally defined Zod schemas matching structure of agent outputs for OrchestratorOutputSchema
const LocalRespondOutputSchema = z.object({
  answer: z.string().describe('A comprehensive, well-reasoned answer to the question.'),
});

const LocalAssumptionItemSchema = z.object({
  assumption: z.string().describe('Hidden assumption being made'),
  risk: z.enum(['High', 'Medium', 'Low']).describe('The level of risk associated with the assumption.'),
  alternative: z.string().describe('Alternative perspective that challenges this assumption'),
});
const LocalAnalyzeAssumptionsOutputSchema = z.array(LocalAssumptionItemSchema);

const LocalEvidenceSchema = z.object({ // This schema is used for both supporting and counter-evidence
  claim: z.string().describe('Specific aspect of the claim being supported/challenged'),
  support: z.string().describe('Detailed evidence with statistics, studies, or expert consensus'),
  quality: z.enum(['high', 'moderate', 'low']).describe('Quality of the evidence'),
  source: z.string().describe('Credible source citation (journal, institution, etc.)'),
});
const LocalResearchEvidenceOutputSchema = z.array(LocalEvidenceSchema);
const LocalResearchCounterEvidenceOutputSchema = z.array(LocalEvidenceSchema); // New

const LocalCritiqueAgentOutputSchema = z.string().describe('The critical analysis of the answer and evidence.');

const LocalChallengeOutputSchema = z.array(z.string()).describe('A list of counterarguments.');

const LocalPremortermItemSchema = z.object({
  failure: z.string().describe('Specific way this could fail'),
  probability: z.string().describe('High (60-80%)|Moderate (30-60%)|Low (10-30%)'),
  mitigation: z.string().describe('Concrete steps to prevent or handle this failure'),
});
const LocalPremortemOutputSchema = z.array(LocalPremortermItemSchema);

const LocalInformationGapItemSchema = z.object({
  gap: z.string().describe("A specific piece of missing information or an unanswered question critical to fully evaluating the answer."),
  impact: z.enum(['High', 'Medium', 'Low']).describe("The potential impact of this information gap on the answer's validity or completeness."),
});
const LocalInformationGapOutputSchema = z.array(LocalInformationGapItemSchema);


const LocalSynthesisAgentOutputSchema = z.object({
  confidence: z.enum(['High', 'Medium', 'Low']).describe('Overall confidence in the refined answer/advice based on all analyses.'),
  summary: z.string().describe('A concise summary of the synthesized findings, integrating all agent perspectives.'),
  keyStrengths: z.array(z.string()).describe('Aspects of the initial answer that are well-supported or strengthened by the analysis.'),
  keyWeaknesses: z.array(z.string()).describe('Aspects of the initial answer that are weak, challenged, or have significant risks.'),
  actionableRecommendations: z.array(z.string()).describe('Specific, actionable recommendations based on the synthesis.'),
  remainingUncertainties: z.array(z.string()).describe('Key uncertainties or information gaps that still exist after analysis.'),
});


// Input Schema for the Orchestrator itself (now local)
const OrchestratorInputSchema = z.object({
  query: z.string(),
});
// Exported type for orchestrator input
export type OrchestratorInput = z.infer<typeof OrchestratorInputSchema>;


// Output Schema for the Orchestrator, using local schema definitions (now local)
const OrchestratorOutputSchema = z.object({
  initialAnswer: LocalRespondOutputSchema,
  assumptions: LocalAnalyzeAssumptionsOutputSchema,
  research: LocalResearchEvidenceOutputSchema,
  counterEvidence: LocalResearchCounterEvidenceOutputSchema, // New
  critique: LocalCritiqueAgentOutputSchema,
  challenges: LocalChallengeOutputSchema,
  premortemAnalysis: LocalPremortemOutputSchema,
  informationGaps: LocalInformationGapOutputSchema,
  synthesis: LocalSynthesisAgentOutputSchema,
  finalSummary: z.string(),
});

// Output type for Orchestrator, using imported agent types
export type OrchestratorOutput = {
  initialAnswer: RespondOutput;
  assumptions: AnalyzeAssumptionsOutput;
  research: ResearchEvidenceOutput;
  counterEvidence: ResearchCounterEvidenceOutput; // New
  critique: CritiqueAgentOutput;
  challenges: ChallengeOutput;
  premortemAnalysis: PremortemOutput;
  informationGaps: InformationGapOutput;
  synthesis: SynthesisAgentOutput;
  finalSummary: string;
};


// Default values for graceful degradation
const defaultRespondOutput: RespondOutput = { answer: "Initial answer generation failed." };
const defaultAssumptionsOutput: AnalyzeAssumptionsOutput = [];
const defaultResearchOutput: ResearchEvidenceOutput = [];
const defaultCounterResearchOutput: ResearchCounterEvidenceOutput = []; // New
const defaultCritiqueOutput: CritiqueAgentOutput = "Critique generation failed.";
const defaultChallengeOutput: ChallengeOutput = [];
const defaultPremortemOutput: PremortemOutput = [];
const defaultInformationGapOutput: InformationGapOutput = [];
const defaultSynthesisOutput: SynthesisAgentOutput = {
  confidence: 'Medium',
  summary: "Final synthesis could not be generated.",
  keyStrengths: [],
  keyWeaknesses: [],
  actionableRecommendations: [],
  remainingUncertainties: ["Synthesis step failed or was skipped."],
};


// Orchestrator Flow (now local)
const orchestrateQueryFlow = ai.defineFlow(
  {
    name: 'orchestrateQueryFlow',
    inputSchema: OrchestratorInputSchema,
    outputSchema: OrchestratorOutputSchema,
  },
  async (input: OrchestratorInput): Promise<OrchestratorOutput> => {
    console.log(`Orchestrator: Starting flow with query: "${input.query.substring(0, 50)}..."`);

    let output: OrchestratorOutput = {
      initialAnswer: defaultRespondOutput,
      assumptions: defaultAssumptionsOutput,
      research: defaultResearchOutput,
      counterEvidence: defaultCounterResearchOutput, // New
      critique: defaultCritiqueOutput,
      challenges: defaultChallengeOutput,
      premortemAnalysis: defaultPremortemOutput,
      informationGaps: defaultInformationGapOutput,
      synthesis: defaultSynthesisOutput,
      finalSummary: "Orchestration started but did not complete fully.",
    };

    let initialAnswerText = "";
    let errorsEncounteredInfo: { agent: string, error: string }[] = [];


    try {
      console.log('Orchestrator: Calling Responder Agent...');
      const responderOutput = await respond({ query: input.query });
      if (responderOutput && responderOutput.answer && responderOutput.answer.trim() !== "" && responderOutput.answer !== defaultRespondOutput.answer) {
        output.initialAnswer = responderOutput;
        initialAnswerText = responderOutput.answer;
        console.log('Orchestrator: Responder Agent successful.');
      } else {
        throw new Error(responderOutput?.answer || "Responder Agent returned empty or invalid answer.");
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Orchestrator: Responder Agent failed critically.', { error: errorMessage, input: input.query.substring(0,100) });
      errorsEncounteredInfo.push({ agent: 'Responder Agent', error: errorMessage });
      output.finalSummary = `Orchestrator: Critical failure in Responder Agent: ${errorMessage}. Process halted.`;
      return output;
    }

    async function callAgent<TInput, TOutput>(
      agentName: string,
      agentFn: (input: TInput) => Promise<TOutput>,
      agentInput: TInput,
      defaultOutputVal: TOutput,
      errorStore: { agent: string, error: string }[]
    ): Promise<TOutput> {
      try {
        console.log(`Orchestrator: Calling ${agentName}...`);
        const result = await agentFn(agentInput);
        console.log(`Orchestrator: ${agentName} successful.`);
        return result ?? defaultOutputVal;
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Orchestrator: ${agentName} failed. Using default output.`, { error: errorMessage, input: JSON.stringify(agentInput).substring(0,100) });
        errorStore.push({ agent: agentName, error: errorMessage });
        return defaultOutputVal;
      }
    }

    const [assumptionsResult, researchResult, counterEvidenceResult, premortemResult, informationGapsResult] = await Promise.all([
      callAgent(
        "AnalyzeAssumptions Agent",
        analyzeAssumptions,
        { answer: initialAnswerText },
        defaultAssumptionsOutput,
        errorsEncounteredInfo
      ),
      callAgent(
        "ResearchEvidence Agent (Supporting)",
        researchEvidence,
        { claim: initialAnswerText },
        defaultResearchOutput,
        errorsEncounteredInfo
      ),
      callAgent( // New
        "CounterEvidenceResearch Agent",
        researchCounterEvidence,
        { claim: initialAnswerText },
        defaultCounterResearchOutput,
        errorsEncounteredInfo
      ),
      callAgent(
        "AnalyzeFailures Agent (Premortem)",
        analyzeFailures,
        { answer: initialAnswerText },
        defaultPremortemOutput,
        errorsEncounteredInfo
      ),
      callAgent(
        "InformationGap Agent",
        analyzeInformationGaps,
        { answer: initialAnswerText },
        defaultInformationGapOutput,
        errorsEncounteredInfo
      )
    ]);
    output.assumptions = assumptionsResult;
    output.research = researchResult;
    output.counterEvidence = counterEvidenceResult; // New
    output.premortemAnalysis = premortemResult;
    output.informationGaps = informationGapsResult;
    
    output.critique = await callAgent(
      "Critique Agent",
      critiqueAgent,
      // Critique agent might benefit from counter-evidence too, but for now, based on its original design.
      { answer: initialAnswerText, evidence: output.research }, 
      defaultCritiqueOutput,
      errorsEncounteredInfo
    );

    output.challenges = await callAgent(
      "Challenge Agent",
      challenge,
      { answer: initialAnswerText, critique: output.critique },
      defaultChallengeOutput,
      errorsEncounteredInfo
    );
    
    output.synthesis = await callAgent(
        "Synthesis Agent",
        synthesizeAnalysis,
        {
            initialAnswer: output.initialAnswer,
            assumptions: output.assumptions,
            evidence: output.research,
            counterEvidence: output.counterEvidence, // New
            critique: output.critique,
            challenges: output.challenges,
            potentialFailures: output.premortemAnalysis,
            informationGaps: output.informationGaps,
        },
        defaultSynthesisOutput,
        errorsEncounteredInfo
    );
    
    let summaryParts = [];
    if (output.initialAnswer && output.initialAnswer.answer !== defaultRespondOutput.answer) {
      summaryParts.push(`Initial Answer: Provided.`);
    } else {
      summaryParts.push(`Initial Answer: Failed or not provided.`);
    }
    
    const checkAgentResult = <T>(data: T | T[], defaultVal: T | T[], name: string): string => {
      if (Array.isArray(data) && Array.isArray(defaultVal)) {
        return data.length > 0 && JSON.stringify(data) !== JSON.stringify(defaultVal) ? `${name}: ${data.length} items found.` : `${name}: Analysis unavailable or failed.`;
      }
      if (typeof data === 'object' && data !== null && typeof defaultVal === 'object' && defaultVal !== null) {
        const dataString = JSON.stringify(data);
        const defaultString = JSON.stringify(defaultVal);
        return dataString !== defaultString ? `${name}: Provided.` : `${name}: Analysis unavailable or failed.`;
      }
      return data && data !== defaultVal ? `${name}: Provided.` : `${name}: Analysis unavailable or failed.`;
    };

    summaryParts.push(checkAgentResult(output.assumptions, defaultAssumptionsOutput, "Assumptions"));
    summaryParts.push(checkAgentResult(output.research, defaultResearchOutput, "Supporting Evidence"));
    summaryParts.push(checkAgentResult(output.counterEvidence, defaultCounterResearchOutput, "Counter Evidence")); // New
    summaryParts.push(checkAgentResult(output.critique, defaultCritiqueOutput, "Critique"));
    summaryParts.push(checkAgentResult(output.challenges, defaultChallengeOutput, "Challenges"));
    summaryParts.push(checkAgentResult(output.premortemAnalysis, defaultPremortemOutput, "Potential Failures"));
    summaryParts.push(checkAgentResult(output.informationGaps, defaultInformationGapOutput, "Information Gaps"));
    summaryParts.push(checkAgentResult(output.synthesis, defaultSynthesisOutput, "Final Synthesis"));
    
    if (errorsEncounteredInfo.length > 0) {
      const errorDetails = errorsEncounteredInfo.map(e => `  - ${e.agent}: ${e.error.substring(0,100)}...`).join('\n');
      output.finalSummary = `Orchestration completed with partial results due to one or more agent failures.\n\nSummary of Available Data:\n${summaryParts.join('\n')}\n\nErrors Encountered:\n${errorDetails}`;
    } else {
      output.finalSummary = "Orchestration completed successfully with all agents contributing.\n\nSummary of Data:\n" + summaryParts.join('\n');
    }
    
    console.log('Orchestrator: Flow completed.');
    return output;
  }
);

// Exported function to call the flow by other server components/actions
export async function orchestrateQuery(
  input: OrchestratorInput
): Promise<OrchestratorOutput> {
  // Validate input using the local schema
  const parsedInput = OrchestratorInputSchema.safeParse(input);
  if (!parsedInput.success) {
    console.error('Orchestrator: Invalid input to orchestrateQuery', { error: parsedInput.error.flatten(), input });
    // Construct a default/error OrchestratorOutput
    return {
      initialAnswer: defaultRespondOutput,
      assumptions: defaultAssumptionsOutput,
      research: defaultResearchOutput,
      counterEvidence: defaultCounterResearchOutput, // New
      critique: defaultCritiqueOutput,
      challenges: defaultChallengeOutput,
      premortemAnalysis: defaultPremortemOutput,
      informationGaps: defaultInformationGapOutput,
      synthesis: defaultSynthesisOutput,
      finalSummary: `Orchestrator: Invalid input provided. ${parsedInput.error.message}`,
    };
  }
  return await orchestrateQueryFlow(parsedInput.data);
}
