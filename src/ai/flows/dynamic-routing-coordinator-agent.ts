'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define input schema
const DynamicRoutingInputSchema = z.object({
  refinedQuery: z.string().describe('The refined query to analyze'),
  initialAnswerText: z.string().describe('The initial answer to analyze'),
  availableAgents: z.array(z.string()).describe('List of available analytical agents').optional().default([
    'AnalyzeAssumptionsAgent',
    'ResearcherAgent',
    'CounterEvidenceResearcherAgent',
    'PremortemAgent',
    'InformationGapAgent',
    'BiasDetectionAgent',
    'CritiqueAgent',
    'DevilsAdvocateAgent'
  ]),
});

// Define output schema
const DynamicRoutingOutputSchema = z.object({
  recommendedAgents: z.array(z.object({
    agentName: z.string().describe('Name of the recommended agent'),
    priority: z.enum(['high', 'medium', 'low']).describe('Execution priority'),
    reasoning: z.string().describe('Why this agent is recommended'),
    suggestedParameters: z.record(z.any()).describe('Suggested parameters for the agent').optional(),
    executionOrder: z.number().describe('Suggested execution order (1-10)'),
  })).describe('List of agents recommended for this specific query/answer'),
  parallelExecutionGroups: z.array(z.array(z.string())).describe('Groups of agents that can be executed in parallel'),
  sequentialDependencies: z.array(z.object({
    dependent: z.string().describe('Agent that depends on another'),
    dependsOn: z.string().describe('Agent that must complete first'),
    reason: z.string().describe('Why this dependency exists'),
  })).describe('Agents that must execute sequentially'),
  analysisStrategy: z.object({
    approach: z.enum(['comprehensive', 'focused', 'minimal', 'exploratory']).describe('Overall analysis approach'),
    reasoning: z.string().describe('Why this approach was chosen'),
    estimatedComplexity: z.enum(['low', 'medium', 'high', 'very_high']).describe('Estimated analysis complexity'),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']).describe('Risk level of the query topic'),
  }).describe('Overall analysis strategy recommendation'),
  optimizations: z.object({
    canSkipAgents: z.array(z.string()).describe('Agents that can be safely skipped for this query'),
    prioritizeAgents: z.array(z.string()).describe('Agents that should be prioritized'),
    resourceAllocation: z.enum(['light', 'standard', 'intensive']).describe('Recommended resource allocation'),
  }).describe('Performance and resource optimizations'),
});

type DynamicRoutingInput = z.infer<typeof DynamicRoutingInputSchema>;
type DynamicRoutingOutput = z.infer<typeof DynamicRoutingOutputSchema>;

// Default output for error cases
const DEFAULT_OUTPUT: DynamicRoutingOutput = {
  recommendedAgents: [
    {
      agentName: 'AnalyzeAssumptionsAgent',
      priority: 'high',
      reasoning: 'Default routing - assumptions analysis is critical for most queries',
      executionOrder: 1,
    },
    {
      agentName: 'ResearcherAgent',
      priority: 'high',
      reasoning: 'Default routing - evidence gathering is essential',
      executionOrder: 2,
    },
    {
      agentName: 'CounterEvidenceResearcherAgent',
      priority: 'medium',
      reasoning: 'Default routing - counter-evidence provides balance',
      executionOrder: 3,
    },
    {
      agentName: 'CritiqueAgent',
      priority: 'medium',
      reasoning: 'Default routing - critique provides quality assurance',
      executionOrder: 4,
    },
  ],
  parallelExecutionGroups: [
    ['AnalyzeAssumptionsAgent', 'ResearcherAgent', 'CounterEvidenceResearcherAgent'],
    ['CritiqueAgent', 'PremortemAgent', 'InformationGapAgent'],
  ],
  sequentialDependencies: [],
  analysisStrategy: {
    approach: 'comprehensive',
    reasoning: 'Default comprehensive analysis for unknown query complexity',
    estimatedComplexity: 'medium',
    riskLevel: 'medium',
  },
  optimizations: {
    canSkipAgents: [],
    prioritizeAgents: ['AnalyzeAssumptionsAgent', 'ResearcherAgent'],
    resourceAllocation: 'standard',
  },
};

// Define the agent
const dynamicRoutingCoordinatorAgent = ai.defineFlow(
  {
    name: 'dynamicRoutingCoordinator',
    inputSchema: DynamicRoutingInputSchema,
    outputSchema: DynamicRoutingOutputSchema,
  },
  async (input: DynamicRoutingInput): Promise<DynamicRoutingOutput> => {
    try {
      console.log('DynamicRoutingCoordinator: Analyzing query and initial answer for optimal routing...');
      
      // Analyze the query and initial answer to determine routing strategy
      const analysisPrompt = `
You are a Dynamic Routing Coordinator for an analytical workflow system. Your task is to analyze the given query and initial answer to determine the optimal routing strategy for subsequent analytical agents.

QUERY: "${input.refinedQuery}"

INITIAL ANSWER: "${input.initialAnswerText}"

AVAILABLE AGENTS:
${input.availableAgents.map(agent => `- ${agent}`).join('\n')}

ANALYSIS FRAMEWORK:

1. **Query Characteristics Analysis:**
   - Complexity level (simple factual, complex analytical, speculative, controversial)
   - Domain specificity (technical, general knowledge, opinion-based)
   - Evidence requirements (high, medium, low)
   - Certainty level of the topic
   - Potential for bias or controversy

2. **Initial Answer Assessment:**
   - Confidence level demonstrated
   - Specificity vs. generality
   - Number of claims made
   - Presence of assumptions
   - Evidence quality
   - Potential gaps or weaknesses

3. **Risk Assessment:**
   - Potential consequences of inaccuracy
   - Controversy level of the topic
   - Stakes involved in the decision
   - Complexity of underlying evidence

ROUTING STRATEGY GUIDELINES:

**High Priority Agents for:**
- AnalyzeAssumptionsAgent: When answer contains many assumptions or speculation
- ResearcherAgent: When evidence gathering is critical
- CounterEvidenceResearcherAgent: For controversial or one-sided topics
- BiasDetectionAgent: For politically sensitive or emotionally charged topics
- CritiqueAgent: When answer quality seems questionable
- InformationGapAgent: When answer seems incomplete or vague
- PremortemAgent: For high-stakes decisions or recommendations
- DevilsAdvocateAgent: For controversial positions or strong claims

**Parallel Execution Opportunities:**
- Evidence gathering agents (Researcher + CounterEvidence)
- Analysis agents (Assumptions + InformationGap + Premortem)
- Quality assurance agents (Critique + BiasDetection)

**Sequential Dependencies:**
- Evidence gathering should complete before detailed critique
- Bias detection should inform subsequent analysis
- Assumptions analysis can inform research priorities

Based on this analysis, provide a comprehensive routing strategy that optimizes for accuracy, efficiency, and thoroughness while considering the specific characteristics of this query and initial answer.
`;

      const result = await ai.generate({
        model: 'claude-3-sonnet',
        prompt: analysisPrompt,
        output: {
          schema: DynamicRoutingOutputSchema,
        },
      });

      const routingDecision = result.output;
      
      if (!routingDecision) {
        console.warn('DynamicRoutingCoordinator: No output generated, using default routing');
        return DEFAULT_OUTPUT;
      }
      
      console.log('DynamicRoutingCoordinator: Generated routing strategy', {
        approach: routingDecision.analysisStrategy.approach,
        recommendedAgents: routingDecision.recommendedAgents.length,
        parallelGroups: routingDecision.parallelExecutionGroups.length,
      });
      
      return routingDecision;
      
    } catch (error: any) {
      console.error('DynamicRoutingCoordinator: Error during routing analysis', { 
        error: error.message,
        query: input.refinedQuery?.substring(0, 100),
      });
      return DEFAULT_OUTPUT;
    }
  }
);

// Export the flow function and types
export const routeAnalyticalAgents = dynamicRoutingCoordinatorAgent;
export type { DynamicRoutingInput, DynamicRoutingOutput }; 