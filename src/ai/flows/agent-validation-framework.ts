import { z } from 'zod';

// Agent Validation Result Schemas
const AgentValidationResultSchema = z.object({
  agentName: z.string(),
  status: z.enum(['pass', 'fail', 'warning']),
  testResults: z.array(z.object({
    testName: z.string(),
    passed: z.boolean(),
    errorMessage: z.string().optional(),
    executionTime: z.number(),
    details: z.any().optional(),
  })),
  overallScore: z.number().min(0).max(100),
  recommendations: z.array(z.string()),
});

const ValidationFrameworkOutputSchema = z.object({
  validationSummary: z.object({
    totalAgents: z.number(),
    passedAgents: z.number(),
    failedAgents: z.number(),
    warningAgents: z.number(),
    overallSystemHealth: z.enum(['excellent', 'good', 'fair', 'poor']),
    systemReliabilityScore: z.number().min(0).max(100),
  }),
  agentResults: z.array(AgentValidationResultSchema),
  systemRecommendations: z.array(z.string()),
  criticalIssues: z.array(z.string()),
  performanceMetrics: z.object({
    averageResponseTime: z.number(),
    fastestAgent: z.string(),
    slowestAgent: z.string(),
    timeoutCount: z.number(),
  }),
});

export type AgentValidationResult = z.infer<typeof AgentValidationResultSchema>;
export type ValidationFrameworkOutput = z.infer<typeof ValidationFrameworkOutputSchema>;

// Agent Test Definitions
interface AgentTestCase {
  testName: string;
  input: any;
  expectedOutputType: string;
  timeout: number;
  critical: boolean;
}

// Comprehensive agent test suite
const AGENT_TEST_SUITES: Record<string, AgentTestCase[]> = {
  'QueryRefinementAgent': [
    {
      testName: 'Basic Query Refinement',
      input: { originalQuery: 'What is AI?' },
      expectedOutputType: 'object',
      timeout: 5000,
      critical: true,
    },
    {
      testName: 'Complex Query Refinement',
      input: { originalQuery: 'How does climate change impact global economic stability through supply chain disruptions and what are the most effective mitigation strategies?' },
      expectedOutputType: 'object',
      timeout: 10000,
      critical: false,
    },
  ],
  'ResponderAgent': [
    {
      testName: 'Simple Question Response',
      input: { query: 'What is the capital of France?' },
      expectedOutputType: 'object',
      timeout: 8000,
      critical: true,
    },
    {
      testName: 'Complex Analysis Request',
      input: { query: 'Analyze the potential implications of quantum computing on cybersecurity' },
      expectedOutputType: 'object',
      timeout: 15000,
      critical: false,
    },
  ],
  'AnalyzeAssumptionsAgent': [
    {
      testName: 'Assumption Extraction',
      input: { answer: 'Electric vehicles are better for the environment because they produce no emissions.' },
      expectedOutputType: 'array',
      timeout: 7000,
      critical: true,
    },
  ],
  'ResearcherAgent': [
    {
      testName: 'Evidence Research',
      input: { claim: 'Solar energy is cost-effective for residential use' },
      expectedOutputType: 'array',
      timeout: 12000,
      critical: true,
    },
  ],
  'CounterEvidenceResearcherAgent': [
    {
      testName: 'Counter Evidence Research',
      input: { claim: 'Remote work increases productivity' },
      expectedOutputType: 'array',
      timeout: 12000,
      critical: true,
    },
  ],
  'BiasDetectionAgent': [
    {
      testName: 'Bias Detection',
      input: {
        initialAnswerText: 'All politicians are corrupt and cannot be trusted',
        aggregatedSupportingResearch: [],
        aggregatedCounterResearch: [],
      },
      expectedOutputType: 'array',
      timeout: 8000,
      critical: true,
    },
  ],
  'CritiqueAgent': [
    {
      testName: 'Answer Critique',
      input: {
        answer: 'Climate change is not real because it was cold yesterday',
        evidence: [],
      },
      expectedOutputType: 'string',
      timeout: 8000,
      critical: true,
    },
  ],
  'PremortemAgent': [
    {
      testName: 'Failure Analysis',
      input: { answer: 'Investing all savings in cryptocurrency is a safe financial strategy' },
      expectedOutputType: 'array',
      timeout: 8000,
      critical: true,
    },
  ],
  'InformationGapAgent': [
    {
      testName: 'Gap Identification',
      input: { answer: 'Artificial intelligence will solve all healthcare problems within 5 years' },
      expectedOutputType: 'array',
      timeout: 8000,
      critical: true,
    },
  ],
  'SynthesisEnsembleAgent': [
    {
      testName: 'Multi-Perspective Synthesis',
      input: {
        initialAnswerText: 'Renewable energy is the best solution for climate change',
        assumptions: [],
        supportingEvidence: [],
        counterEvidence: [],
        critique: 'Test critique',
        challenges: [],
        premortemAnalysis: [],
        informationGaps: [],
        errorsEncountered: [],
      },
      expectedOutputType: 'object',
      timeout: 20000,
      critical: true,
    },
  ],
};

export class AgentValidationFramework {
  private agentRegistry: Map<string, Function> = new Map();
  private validationResults: AgentValidationResult[] = [];

  constructor() {
    // Initialize agent registry - would be populated with actual agent functions
    this.initializeAgentRegistry();
  }

  private initializeAgentRegistry(): void {
    // This would be populated with actual agent imports
    // For now, we'll create a mock registry structure
    console.log('AgentValidationFramework: Initializing agent registry...');
  }

  async validateAgent(agentName: string, testSuite: AgentTestCase[]): Promise<AgentValidationResult> {
    console.log(`AgentValidationFramework: Validating ${agentName}...`);
    
    const testResults = [];
    let totalScore = 0;
    let testCount = 0;

    for (const testCase of testSuite) {
      const startTime = Date.now();
      let passed = false;
      let errorMessage: string | undefined;
      let executionTime = 0;

      try {
        // Simulate agent execution with timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Test timeout')), testCase.timeout)
        );

        // Mock agent execution - in real implementation, would call actual agents
        const executionPromise = this.simulateAgentExecution(agentName, testCase.input);
        
        const result = await Promise.race([executionPromise, timeoutPromise]);
        executionTime = Date.now() - startTime;

        // Validate result type
        passed = this.validateResultType(result, testCase.expectedOutputType);
        if (!passed) {
          errorMessage = `Expected ${testCase.expectedOutputType}, got ${typeof result}`;
        }

      } catch (error: any) {
        executionTime = Date.now() - startTime;
        passed = false;
        errorMessage = error.message;
      }

      testResults.push({
        testName: testCase.testName,
        passed,
        errorMessage,
        executionTime,
        details: { critical: testCase.critical },
      });

      // Scoring: critical tests worth more
      const testWeight = testCase.critical ? 2 : 1;
      if (passed) {
        totalScore += 20 * testWeight;
      }
      testCount += testWeight;
    }

    const overallScore = testCount > 0 ? Math.round(totalScore / testCount) : 0;
    const status = overallScore >= 80 ? 'pass' : overallScore >= 60 ? 'warning' : 'fail';

    const recommendations = this.generateRecommendations(testResults, agentName);

    return {
      agentName,
      status,
      testResults,
      overallScore,
      recommendations,
    };
  }

  private async simulateAgentExecution(agentName: string, input: any): Promise<any> {
    // Mock implementation - in real version would call actual agents
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
    
    // Simulate different response types based on expected output
    const mockResponses = {
      array: [],
      object: { result: 'mock result' },
      string: 'mock string response',
    };

    // Simulate occasional failures
    if (Math.random() < 0.1) {
      throw new Error('Simulated agent failure');
    }

    return mockResponses.object;
  }

  private validateResultType(result: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'array':
        return Array.isArray(result);
      case 'object':
        return typeof result === 'object' && result !== null && !Array.isArray(result);
      case 'string':
        return typeof result === 'string';
      default:
        return false;
    }
  }

  private generateRecommendations(testResults: any[], agentName: string): string[] {
    const recommendations = [];
    const failedTests = testResults.filter(t => !t.passed);
    const slowTests = testResults.filter(t => t.executionTime > 10000);

    if (failedTests.length > 0) {
      recommendations.push(`Fix ${failedTests.length} failing test(s) for ${agentName}`);
    }

    if (slowTests.length > 0) {
      recommendations.push(`Optimize performance for ${agentName} - slow execution detected`);
    }

    const criticalFailures = failedTests.filter(t => t.details?.critical);
    if (criticalFailures.length > 0) {
      recommendations.push(`CRITICAL: Address ${criticalFailures.length} critical test failure(s) immediately`);
    }

    if (recommendations.length === 0) {
      recommendations.push(`${agentName} is performing well - consider additional edge case testing`);
    }

    return recommendations;
  }

  async runFullSystemValidation(): Promise<ValidationFrameworkOutput> {
    console.log('AgentValidationFramework: Starting full system validation...');
    
    this.validationResults = [];
    const performanceMetrics = {
      totalExecutionTime: 0,
      agentTimes: [] as { name: string; time: number }[],
      timeoutCount: 0,
    };

    // Validate each agent with its test suite
    for (const [agentName, testSuite] of Object.entries(AGENT_TEST_SUITES)) {
      const startTime = Date.now();
      
      try {
        const result = await this.validateAgent(agentName, testSuite);
        this.validationResults.push(result);
        
        const agentTime = Date.now() - startTime;
        performanceMetrics.agentTimes.push({ name: agentName, time: agentTime });
        performanceMetrics.totalExecutionTime += agentTime;
        
      } catch (error: any) {
        console.error(`AgentValidationFramework: Failed to validate ${agentName}:`, error.message);
        performanceMetrics.timeoutCount++;
        
        // Add failed validation result
        this.validationResults.push({
          agentName,
          status: 'fail',
          testResults: [{
            testName: 'Agent Initialization',
            passed: false,
            errorMessage: error.message,
            executionTime: Date.now() - startTime,
          }],
          overallScore: 0,
          recommendations: ['Fix agent initialization or import issues'],
        });
      }
    }

    // Calculate system metrics
    const passedAgents = this.validationResults.filter(r => r.status === 'pass').length;
    const failedAgents = this.validationResults.filter(r => r.status === 'fail').length;
    const warningAgents = this.validationResults.filter(r => r.status === 'warning').length;
    const totalAgents = this.validationResults.length;

    const systemReliabilityScore = totalAgents > 0 
      ? Math.round((passedAgents * 100 + warningAgents * 60) / totalAgents)
      : 0;

    const overallSystemHealth = 
      systemReliabilityScore >= 90 ? 'excellent' :
      systemReliabilityScore >= 75 ? 'good' :
      systemReliabilityScore >= 60 ? 'fair' : 'poor';

    // Performance calculations
    const averageResponseTime = performanceMetrics.agentTimes.length > 0
      ? performanceMetrics.totalExecutionTime / performanceMetrics.agentTimes.length
      : 0;

    const fastestAgent = performanceMetrics.agentTimes.length > 0
      ? performanceMetrics.agentTimes.reduce((a, b) => a.time < b.time ? a : b).name
      : 'none';

    const slowestAgent = performanceMetrics.agentTimes.length > 0
      ? performanceMetrics.agentTimes.reduce((a, b) => a.time > b.time ? a : b).name
      : 'none';

    // Generate system recommendations
    const systemRecommendations = this.generateSystemRecommendations();
    const criticalIssues = this.identifyCriticalIssues();

    return {
      validationSummary: {
        totalAgents,
        passedAgents,
        failedAgents,
        warningAgents,
        overallSystemHealth,
        systemReliabilityScore,
      },
      agentResults: this.validationResults,
      systemRecommendations,
      criticalIssues,
      performanceMetrics: {
        averageResponseTime,
        fastestAgent,
        slowestAgent,
        timeoutCount: performanceMetrics.timeoutCount,
      },
    };
  }

  private generateSystemRecommendations(): string[] {
    const recommendations = [];
    const failedAgents = this.validationResults.filter(r => r.status === 'fail');
    const slowAgents = this.validationResults.filter(r => 
      r.testResults.some(t => t.executionTime > 15000)
    );

    if (failedAgents.length > 0) {
      recommendations.push(`Priority 1: Fix ${failedAgents.length} failing agent(s): ${failedAgents.map(a => a.agentName).join(', ')}`);
    }

    if (slowAgents.length > 0) {
      recommendations.push(`Performance: Optimize ${slowAgents.length} slow agent(s) for better response times`);
    }

    const avgScore = this.validationResults.length > 0
      ? this.validationResults.reduce((sum, r) => sum + r.overallScore, 0) / this.validationResults.length
      : 0;

    if (avgScore < 70) {
      recommendations.push('System reliability is below optimal - consider comprehensive agent review');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is performing well - continue regular validation monitoring');
    }

    return recommendations;
  }

  private identifyCriticalIssues(): string[] {
    const issues = [];
    
    const criticalFailures = this.validationResults.filter(r => 
      r.status === 'fail' && r.testResults.some(t => t.details?.critical && !t.passed)
    );

    criticalFailures.forEach(agent => {
      issues.push(`CRITICAL: ${agent.agentName} failing critical functionality tests`);
    });

    const timeoutAgents = this.validationResults.filter(r =>
      r.testResults.some(t => t.errorMessage?.includes('timeout'))
    );

    if (timeoutAgents.length > 2) {
      issues.push('CRITICAL: Multiple agents experiencing timeout issues - system may be overloaded');
    }

    return issues;
  }

  // Utility method for continuous monitoring
  async quickHealthCheck(): Promise<{ status: string; score: number; issues: string[] }> {
    console.log('AgentValidationFramework: Performing quick health check...');
    
    // Run simplified tests on critical agents only
    const criticalAgents = ['ResponderAgent', 'AnalyzeAssumptionsAgent', 'ResearcherAgent', 'SynthesisEnsembleAgent'];
    const quickResults = [];

    for (const agentName of criticalAgents) {
      if (AGENT_TEST_SUITES[agentName]) {
        const firstTest = AGENT_TEST_SUITES[agentName][0]; // Run only first test
        const result = await this.validateAgent(agentName, [firstTest]);
        quickResults.push(result);
      }
    }

    const avgScore = quickResults.length > 0
      ? quickResults.reduce((sum, r) => sum + r.overallScore, 0) / quickResults.length
      : 0;

    const issues = quickResults
      .filter(r => r.status === 'fail')
      .map(r => `${r.agentName}: ${r.testResults[0]?.errorMessage || 'Unknown error'}`);

    const status = avgScore >= 80 ? 'healthy' : avgScore >= 60 ? 'warning' : 'critical';

    return { status, score: Math.round(avgScore), issues };
  }
}

// Export validation function for easy integration
export async function validateAgentSystem(): Promise<ValidationFrameworkOutput> {
  const framework = new AgentValidationFramework();
  return await framework.runFullSystemValidation();
}

// Export quick health check for monitoring
export async function quickSystemHealthCheck(): Promise<{ status: string; score: number; issues: string[] }> {
  const framework = new AgentValidationFramework();
  return await framework.quickHealthCheck();
} 