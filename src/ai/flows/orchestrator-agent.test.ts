import { orchestrateQueryFlow, OrchestratorInput, OrchestratorOutput } from './orchestrator-agent';
import { respond, RespondOutput } from './responder-agent';
import { analyzeAssumptions, AnalyzeAssumptionsOutput } from './assumption-analyzer-agent';
import { researchEvidence, ResearchEvidenceOutput, Evidence } from './researcher-agent';
import { critiqueAgent, CritiqueAgentOutput } from './critic-agent';
import { challenge, ChallengeOutput } from './devils-advocate-agent';
import { analyzeFailures, PremortermItem, PremortermItemInput } from './premortem-agent';

// Mocking the individual agent modules
jest.mock('./responder-agent', () => ({
  respond: jest.fn(),
}));
jest.mock('./assumption-analyzer-agent', () => ({
  analyzeAssumptions: jest.fn(),
}));
jest.mock('./researcher-agent', () => ({
  researchEvidence: jest.fn(),
}));
jest.mock('./critic-agent', () => ({
  critiqueAgent: jest.fn(),
}));
jest.mock('./devils-advocate-agent', () => ({
  challenge: jest.fn(),
}));
jest.mock('./premortem-agent', () => ({
  analyzeFailures: jest.fn(),
}));

// Helper to cast mocks to jest.Mock for type safety
const mocked = <T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> => fn as jest.MockedFunction<T>;

describe('orchestrateQueryFlow', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks before each test
    mocked(respond).mockReset();
    mocked(analyzeAssumptions).mockReset();
    mocked(researchEvidence).mockReset();
    mocked(critiqueAgent).mockReset();
    mocked(challenge).mockReset();
    mocked(analyzeFailures).mockReset();

    // Spy on console.error and console.log to check for error messages if needed
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
    const mockCritiqueAgentOutput: CritiqueAgentOutput = 'Test Critique';
    const mockChallengeOutput: ChallengeOutput = ['Test Challenge'];
    const mockAnalyzeFailuresOutput: PremortermItem[] = [{ failure: 'Test Failure', probability: 'Low', mitigation: 'Test Mitigation' }];

    mocked(respond).mockResolvedValueOnce(mockRespondOutput);
    mocked(analyzeAssumptions).mockResolvedValueOnce(mockAnalyzeAssumptionsOutput);
    mocked(researchEvidence).mockResolvedValueOnce(mockResearchEvidenceOutput);
    mocked(critiqueAgent).mockResolvedValueOnce(mockCritiqueAgentOutput);
    mocked(challenge).mockResolvedValueOnce(mockChallengeOutput);
    mocked(analyzeFailures).mockResolvedValueOnce(mockAnalyzeFailuresOutput);

    const result = await orchestrateQueryFlow(input);

    expect(mocked(respond)).toHaveBeenCalledTimes(1);
    expect(mocked(respond)).toHaveBeenCalledWith({ query: 'Test query' });

    expect(mocked(analyzeAssumptions)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeAssumptions)).toHaveBeenCalledWith({ text: 'Test Answer' });

    expect(mocked(researchEvidence)).toHaveBeenCalledTimes(1);
    expect(mocked(researchEvidence)).toHaveBeenCalledWith({ claim: 'Test Answer' });

    expect(mocked(critiqueAgent)).toHaveBeenCalledTimes(1);
    expect(mocked(critiqueAgent)).toHaveBeenCalledWith({ answer: 'Test Answer', evidence: 'Test Support' });

    expect(mocked(challenge)).toHaveBeenCalledTimes(1);
    expect(mocked(challenge)).toHaveBeenCalledWith({ text: 'Test Answer', critique: 'Test Critique' });

    expect(mocked(analyzeFailures)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeFailures)).toHaveBeenCalledWith({ answer: 'Test Answer' });

    expect(result.initialAnswer).toEqual(mockRespondOutput);
    expect(result.assumptions).toEqual(mockAnalyzeAssumptionsOutput);
    expect(result.research).toEqual(mockResearchEvidenceOutput);
    expect(result.critique).toEqual(mockCritiqueAgentOutput);
    expect(result.challenges).toEqual(mockChallengeOutput);
    expect(result.premortemAnalysis).toEqual(mockAnalyzeFailuresOutput);
    expect(result.finalSummary).toContain('Orchestration completed successfully');
    expect(result.finalSummary).toContain('Test Answer');
    expect(result.finalSummary).toContain('Test Assumption');
    expect(result.finalSummary).toContain('Test Support');
    expect(result.finalSummary).toContain('Test Critique');
    expect(result.finalSummary).toContain('Test Challenge');
    expect(result.finalSummary).toContain('Test Failure');
  });

  test('should stop execution and return partial results if responder agent fails', async () => {
    const input: OrchestratorInput = { query: 'Test query for responder failure' };
    const responderError = new Error('Responder Failure');
    mocked(respond).mockRejectedValueOnce(responderError);

    const result = await orchestrateQueryFlow(input);

    expect(mocked(respond)).toHaveBeenCalledTimes(1);
    expect(mocked(respond)).toHaveBeenCalledWith({ query: 'Test query for responder failure' });

    expect(mocked(analyzeAssumptions)).not.toHaveBeenCalled();
    expect(mocked(researchEvidence)).not.toHaveBeenCalled();
    expect(mocked(critiqueAgent)).not.toHaveBeenCalled();
    expect(mocked(challenge)).not.toHaveBeenCalled();
    expect(mocked(analyzeFailures)).not.toHaveBeenCalled();
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('Orchestrator: Responder Agent failed. Halting process.', responderError);
    expect(result.initialAnswer).toEqual({ answer: '' }); // Default initial value
    expect(result.assumptions).toEqual([]);
    expect(result.research).toEqual([]);
    expect(result.critique).toBe('');
    expect(result.challenges).toEqual([]);
    expect(result.premortemAnalysis).toEqual([]);
    expect(result.finalSummary).toContain('Orchestrator: Responder Agent failed. Essential first step could not be completed.');
  });

  test('should continue execution and return partial results if a non-critical agent (e.g., analyzeAssumptions) fails', async () => {
    const input: OrchestratorInput = { query: 'Test query for assumptions failure' };
    const assumptionsError = new Error('Assumptions Failure');

    const mockRespondOutput: RespondOutput = { answer: 'Test Answer for partial' };
    // researchEvidence, critiqueAgent, challenge, analyzeFailures will be called
    const mockResearchEvidenceOutput: ResearchEvidenceOutput = [{ claim: 'Test Claim 2', support: 'Test Support 2', quality: 'moderate', source: 'Test Source 2' }];
    const mockCritiqueAgentOutput: CritiqueAgentOutput = 'Test Critique 2';
    const mockChallengeOutput: ChallengeOutput = ['Test Challenge 2'];
    const mockAnalyzeFailuresOutput: PremortermItem[] = [{ failure: 'Test Failure 2', probability: 'High', mitigation: 'Test Mitigation 2' }];


    mocked(respond).mockResolvedValueOnce(mockRespondOutput);
    mocked(analyzeAssumptions).mockRejectedValueOnce(assumptionsError); // This one fails
    mocked(researchEvidence).mockResolvedValueOnce(mockResearchEvidenceOutput);
    mocked(critiqueAgent).mockResolvedValueOnce(mockCritiqueAgentOutput);
    mocked(challenge).mockResolvedValueOnce(mockChallengeOutput);
    mocked(analyzeFailures).mockResolvedValueOnce(mockAnalyzeFailuresOutput);

    const result = await orchestrateQueryFlow(input);

    expect(mocked(respond)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeAssumptions)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeAssumptions)).toHaveBeenCalledWith({ text: 'Test Answer for partial' });
    
    expect(mocked(researchEvidence)).toHaveBeenCalledTimes(1);
    expect(mocked(critiqueAgent)).toHaveBeenCalledTimes(1);
    expect(mocked(challenge)).toHaveBeenCalledTimes(1);
    expect(mocked(analyzeFailures)).toHaveBeenCalledTimes(1);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Orchestrator: AnalyzeAssumptions Agent failed.', assumptionsError);
    
    expect(result.initialAnswer).toEqual(mockRespondOutput);
    expect(result.assumptions).toEqual([]); // Should be default empty value
    expect(result.research).toEqual(mockResearchEvidenceOutput);
    expect(result.critique).toEqual(mockCritiqueAgentOutput);
    expect(result.challenges).toEqual(mockChallengeOutput);
    expect(result.premortemAnalysis).toEqual(mockAnalyzeFailuresOutput);

    expect(result.finalSummary).toContain('Orchestration completed with partial results');
    expect(result.finalSummary).toContain('Test Answer for partial');
    expect(result.finalSummary).toContain('Assumptions: Analysis not available or failed.');
    expect(result.finalSummary).toContain('Test Support 2'); // From research
    expect(result.finalSummary).toContain('Test Critique 2'); // From critique
  });
});
