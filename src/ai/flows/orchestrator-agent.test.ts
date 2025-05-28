
import { orchestrateQuery, type OrchestratorInput, type OrchestratorOutput } from './orchestrator-agent';
import { respond, RespondOutput, type RespondInput } from './responder-agent';
import { analyzeAssumptions, AnalyzeAssumptionsOutput, type AnalyzeAssumptionsInput } from './assumption-analyzer-agent';
import { researchEvidence, ResearchEvidenceOutput, type ResearchEvidenceInput } from './researcher-agent';
import { researchCounterEvidence, ResearchCounterEvidenceOutput, type ResearchCounterEvidenceInput } from './counter-evidence-researcher-agent'; // New
import { critiqueAgent, CritiqueAgentOutput, type CritiqueAgentInput } from './critic-agent';
import { challenge, ChallengeOutput, type ChallengeInput } from './devils-advocate-agent';
import { analyzeFailures, PremortemOutput, type PremortermItemInput } from './premortem-agent';
import { analyzeInformationGaps, InformationGapOutput, type InformationGapInput } from './information-gap-agent';
import { synthesizeAnalysis, SynthesisAgentOutput, type SynthesisAgentInput } from './synthesis-agent';


// Mocking the individual agent modules
jest.mock('./responder-agent');
jest.mock('./assumption-analyzer-agent');
jest.mock('./researcher-agent');
jest.mock('./counter-evidence-researcher-agent'); // New
jest.mock('./critic-agent');
jest.mock('./devils-advocate-agent');
jest.mock('./premortem-agent');
jest.mock('./information-gap-agent');
jest.mock('./synthesis-agent');

// Helper to cast mocks to jest.Mock for type safety
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> => fn as jest.MockedFunction<T>;

describe('orchestrateQuery', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

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


  beforeEach(() => {
    // Reset mocks before each test
    mocked(respond).mockReset();
    mocked(analyzeAssumptions).mockReset();
    mocked(researchEvidence).mockReset();
    mocked(researchCounterEvidence).mockReset(); // New
    mocked(critiqueAgent).mockReset();
    mocked(challenge).mockReset();
    mocked(analyzeFailures).mockReset();
    mocked(analyzeInformationGaps).mockReset();
    mocked(synthesizeAnalysis).mockReset();

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  test('should call all agents in sequence and return aggregated results on successful execution', async () => {
    const input: OrchestratorInput = { query: 'Test query' };

    const mockRespondOutput: RespondOutput = { answer: 'Test Answer' };
    const mockAnalyzeAssumptionsOutput: AnalyzeAssumptionsOutput = [{ assumption: 'Test Assumption', risk: 'Low', alternative: 'Test Alt' }];
    const mockResearchEvidenceOutput: ResearchEvidenceOutput = [{ claim: 'Test Claim', support: 'Test Support', quality: 'high', source: 'Test Source' }];
    const mockCounterEvidenceOutput: ResearchCounterEvidenceOutput = [{ claim: 'Counter Claim', support: 'Counter Support', quality: 'moderate', source: 'Counter Source'}]; // New
    const mockCritiqueAgentOutput: CritiqueAgentOutput = 'Test Critique';
    const mockChallengeOutput: ChallengeOutput = ['Test Challenge'];
    const mockAnalyzeFailuresOutput: PremortemOutput = [{ failure: 'Test Failure', probability: 'Low', mitigation: 'Test Mitigation' }];
    const mockInformationGapOutput: InformationGapOutput = [{ gap: 'Test Gap', impact: 'Medium' }];
    const mockSynthesisOutput: SynthesisAgentOutput = {
        confidence: 'High', 
        summary: 'Synthesized summary', 
        keyStrengths: ['Strength'], 
        keyWeaknesses: ['Weakness'], 
        actionableRecommendations: ['Action'], 
        remainingUncertainties: ['Uncertainty']
    };

    mocked(respond).mockResolvedValueOnce(mockRespondOutput);
    mocked(analyzeAssumptions).mockResolvedValueOnce(mockAnalyzeAssumptionsOutput);
    mocked(researchEvidence).mockResolvedValueOnce(mockResearchEvidenceOutput);
    mocked(researchCounterEvidence).mockResolvedValueOnce(mockCounterEvidenceOutput); // New
    mocked(critiqueAgent).mockResolvedValueOnce(mockCritiqueAgentOutput);
    mocked(challenge).mockResolvedValueOnce(mockChallengeOutput);
    mocked(analyzeFailures).mockResolvedValueOnce(mockAnalyzeFailuresOutput);
    mocked(analyzeInformationGaps).mockResolvedValueOnce(mockInformationGapOutput);
    mocked(synthesizeAnalysis).mockResolvedValueOnce(mockSynthesisOutput);


    const result = await orchestrateQuery(input);

    expect(mocked(respond)).toHaveBeenCalledTimes(1);
    expect(mocked(respond)).toHaveBeenCalledWith({ query: 'Test query' } as RespondInput);

    expect(mocked(analyzeAssumptions)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeAssumptions)).toHaveBeenCalledWith({ answer: 'Test Answer' } as AnalyzeAssumptionsInput);

    expect(mocked(researchEvidence)).toHaveBeenCalledTimes(1);
    expect(mocked(researchEvidence)).toHaveBeenCalledWith({ claim: 'Test Answer' } as ResearchEvidenceInput);

    expect(mocked(researchCounterEvidence)).toHaveBeenCalledTimes(1); // New
    expect(mocked(researchCounterEvidence)).toHaveBeenCalledWith({ claim: 'Test Answer' } as ResearchCounterEvidenceInput); // New
    
    expect(mocked(analyzeFailures)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeFailures)).toHaveBeenCalledWith({ answer: 'Test Answer' } as PremortermItemInput);
    
    expect(mocked(analyzeInformationGaps)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeInformationGaps)).toHaveBeenCalledWith({ answer: 'Test Answer' } as InformationGapInput);

    expect(mocked(critiqueAgent)).toHaveBeenCalledTimes(1);
    expect(mocked(critiqueAgent)).toHaveBeenCalledWith({ answer: 'Test Answer', evidence: mockResearchEvidenceOutput } as CritiqueAgentInput);
    
    expect(mocked(challenge)).toHaveBeenCalledTimes(1);
    expect(mocked(challenge)).toHaveBeenCalledWith({ answer: 'Test Answer', critique: 'Test Critique' } as ChallengeInput);


    expect(mocked(synthesizeAnalysis)).toHaveBeenCalledTimes(1);
    expect(mocked(synthesizeAnalysis)).toHaveBeenCalledWith({
        initialAnswer: mockRespondOutput,
        assumptions: mockAnalyzeAssumptionsOutput,
        evidence: mockResearchEvidenceOutput,
        counterEvidence: mockCounterEvidenceOutput, // New
        critique: mockCritiqueAgentOutput,
        challenges: mockChallengeOutput,
        potentialFailures: mockAnalyzeFailuresOutput,
        informationGaps: mockInformationGapOutput,
    } as SynthesisAgentInput);


    expect(result.initialAnswer).toEqual(mockRespondOutput);
    expect(result.assumptions).toEqual(mockAnalyzeAssumptionsOutput);
    expect(result.research).toEqual(mockResearchEvidenceOutput);
    expect(result.counterEvidence).toEqual(mockCounterEvidenceOutput); // New
    expect(result.critique).toEqual(mockCritiqueAgentOutput);
    expect(result.challenges).toEqual(mockChallengeOutput);
    expect(result.premortemAnalysis).toEqual(mockAnalyzeFailuresOutput);
    expect(result.informationGaps).toEqual(mockInformationGapOutput);
    expect(result.synthesis).toEqual(mockSynthesisOutput);
    expect(result.finalSummary).toContain('Orchestration completed successfully');
  });

  test('should stop execution and return default responder output if responder agent fails', async () => {
    const input: OrchestratorInput = { query: 'Test query for responder failure' };
    const responderError = new Error('Responder Failure');
    mocked(respond).mockRejectedValueOnce(responderError);

    const result = await orchestrateQuery(input);

    expect(mocked(respond)).toHaveBeenCalledTimes(1);
    expect(mocked(respond)).toHaveBeenCalledWith({ query: 'Test query for responder failure' } as RespondInput);

    expect(mocked(analyzeAssumptions)).not.toHaveBeenCalled();
    expect(mocked(researchEvidence)).not.toHaveBeenCalled();
    expect(mocked(researchCounterEvidence)).not.toHaveBeenCalled(); // New
    expect(mocked(critiqueAgent)).not.toHaveBeenCalled();
    expect(mocked(challenge)).not.toHaveBeenCalled();
    expect(mocked(analyzeFailures)).not.toHaveBeenCalled();
    expect(mocked(analyzeInformationGaps)).not.toHaveBeenCalled();
    expect(mocked(synthesizeAnalysis)).not.toHaveBeenCalled();
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('Orchestrator: Responder Agent failed critically.', expect.objectContaining({ error: responderError.message }));
    expect(result.initialAnswer).toEqual(defaultRespondOutput);
    expect(result.assumptions).toEqual(defaultAssumptionsOutput);
    expect(result.research).toEqual(defaultResearchOutput);
    expect(result.counterEvidence).toEqual(defaultCounterResearchOutput); // New
    expect(result.critique).toBe(defaultCritiqueOutput);
    expect(result.challenges).toEqual(defaultChallengeOutput);
    expect(result.premortemAnalysis).toEqual(defaultPremortemOutput);
    expect(result.informationGaps).toEqual(defaultInformationGapOutput);
    expect(result.synthesis).toEqual(defaultSynthesisOutput);
    expect(result.finalSummary).toContain('Orchestrator: Critical failure in Responder Agent: Responder Failure. Process halted.');
  });

  test('should continue execution and use default for failed non-critical agent (e.g., analyzeAssumptions)', async () => {
    const input: OrchestratorInput = { query: 'Test query for assumptions failure' };
    const assumptionsError = new Error('Assumptions Failure');

    const mockRespondOutput: RespondOutput = { answer: 'Test Answer for partial' };
    const mockResearchEvidenceOutput: ResearchEvidenceOutput = [{ claim: 'Test Claim 2', support: 'Test Support 2', quality: 'moderate', source: 'Test Source 2' }];
    const mockCounterEvidenceOutput: ResearchCounterEvidenceOutput = []; // New, assuming it runs successfully or defaults
    const mockCritiqueAgentOutput: CritiqueAgentOutput = 'Test Critique 2';
    const mockChallengeOutput: ChallengeOutput = ['Test Challenge 2'];
    const mockAnalyzeFailuresOutput: PremortemOutput = [{ failure: 'Test Failure 2', probability: 'High', mitigation: 'Test Mitigation 2' }];
    const mockInformationGapOutput: InformationGapOutput = [{ gap: 'Gap for partial', impact: 'Low' }];
    const mockSynthesisOutput: SynthesisAgentOutput = { confidence: 'Low', summary: 'Partial synthesis', keyStrengths: [], keyWeaknesses: [], actionableRecommendations: [], remainingUncertainties: [] };


    mocked(respond).mockResolvedValueOnce(mockRespondOutput);
    mocked(analyzeAssumptions).mockRejectedValueOnce(assumptionsError); // This one fails
    mocked(researchEvidence).mockResolvedValueOnce(mockResearchEvidenceOutput);
    mocked(researchCounterEvidence).mockResolvedValueOnce(mockCounterEvidenceOutput); // New
    mocked(critiqueAgent).mockResolvedValueOnce(mockCritiqueAgentOutput);
    mocked(challenge).mockResolvedValueOnce(mockChallengeOutput);
    mocked(analyzeFailures).mockResolvedValueOnce(mockAnalyzeFailuresOutput);
    mocked(analyzeInformationGaps).mockResolvedValueOnce(mockInformationGapOutput);
    mocked(synthesizeAnalysis).mockResolvedValueOnce(mockSynthesisOutput); // Synthesis should still run

    const result = await orchestrateQuery(input);

    expect(mocked(respond)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeAssumptions)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeAssumptions)).toHaveBeenCalledWith({ answer: 'Test Answer for partial' } as AnalyzeAssumptionsInput);
    
    expect(mocked(researchEvidence)).toHaveBeenCalledTimes(1);
    expect(mocked(researchCounterEvidence)).toHaveBeenCalledTimes(1); // New
    expect(mocked(critiqueAgent)).toHaveBeenCalledTimes(1);
    expect(mocked(challenge)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeFailures)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeInformationGaps)).toHaveBeenCalledTimes(1);
    expect(mocked(synthesizeAnalysis)).toHaveBeenCalledTimes(1);


    expect(consoleErrorSpy).toHaveBeenCalledWith('Orchestrator: AnalyzeAssumptions Agent failed. Using default output.', expect.objectContaining({ error: assumptionsError.message }));
    
    expect(result.initialAnswer).toEqual(mockRespondOutput);
    expect(result.assumptions).toEqual(defaultAssumptionsOutput); // Should be default
    expect(result.research).toEqual(mockResearchEvidenceOutput);
    expect(result.counterEvidence).toEqual(mockCounterEvidenceOutput); // New
    expect(result.critique).toEqual(mockCritiqueAgentOutput);
    expect(result.challenges).toEqual(mockChallengeOutput);
    expect(result.premortemAnalysis).toEqual(mockAnalyzeFailuresOutput);
    expect(result.informationGaps).toEqual(mockInformationGapOutput);
    expect(result.synthesis).toEqual(mockSynthesisOutput); // Synthesis output should be present

    expect(result.finalSummary).toContain('Orchestration completed with partial results');
    expect(result.finalSummary).toContain('Assumptions: Analysis unavailable or failed.');
  });
   test('should return error summary if input validation fails in orchestrateQuery', async () => {
    const input: any = { invalidQueryField: 'Test query for input validation' }; // Invalid input
    
    const result = await orchestrateQuery(input as OrchestratorInput);

    expect(mocked(respond)).not.toHaveBeenCalled();
    expect(result.finalSummary).toContain('Orchestrator: Invalid input provided.');
    expect(result.finalSummary).toContain("Expected string, received undefined"); // Specific Zod error message for query
    expect(result.initialAnswer).toEqual(defaultRespondOutput); // Should return default structure
    expect(result.counterEvidence).toEqual(defaultCounterResearchOutput); // New
    expect(consoleErrorSpy).toHaveBeenCalledWith('Orchestrator: Invalid input to orchestrateQuery', expect.any(Object));
  });
});
