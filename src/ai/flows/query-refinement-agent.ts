'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// E1: Query Refinement Agent - Analyzes and refines user queries

const QueryRefinementInputSchema = z.object({
  query: z.string().describe('The original user query to be refined'),
});
export type QueryRefinementInput = z.infer<typeof QueryRefinementInputSchema>;

const QueryRefinementOutputSchema = z.object({
  originalQuery: z.string(),
  refinedQuery: z.string().describe('The clarified, unbiased, and well-defined question'),
  refinementReason: z.string().describe('Explanation of why and how the query was refined'),
  identifiedIssues: z.array(z.object({
    issueType: z.enum(['ambiguity', 'vagueness', 'embedded_assumption', 'scope_too_broad', 'scope_too_narrow', 'loaded_question']),
    description: z.string(),
  })),
  clarificationQuestions: z.array(z.string()).describe('Questions that could be asked to further clarify the query'),
});
export type QueryRefinementOutput = z.infer<typeof QueryRefinementOutputSchema>;

// Custom Function Tools for Query Analysis
const questionClassifierTool = ai.defineTool({
  name: 'questionClassifierTool',
  description: 'Analyzes a query to identify ambiguity, vagueness, or embedded assumptions',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    hasAmbiguity: z.boolean(),
    ambiguityDetails: z.array(z.string()).optional(),
    hasVagueness: z.boolean(),
    vaguenessDetails: z.array(z.string()).optional(),
    hasEmbeddedAssumptions: z.boolean(),
    assumptionDetails: z.array(z.string()).optional(),
    isLoadedQuestion: z.boolean(),
    loadedQuestionDetails: z.string().optional(),
  }),
}, async (input: { query: string }) => {
  // This is a mock implementation - in a real system, this could use
  // more sophisticated NLP analysis or call an external service
  const query = input.query.toLowerCase();
  
  const result = {
    hasAmbiguity: false,
    ambiguityDetails: [] as string[],
    hasVagueness: false,
    vaguenessDetails: [] as string[],
    hasEmbeddedAssumptions: false,
    assumptionDetails: [] as string[],
    isLoadedQuestion: false,
    loadedQuestionDetails: undefined as string | undefined,
  };
  
  // Check for ambiguous pronouns
  const ambiguousPronouns = ['it', 'they', 'this', 'that', 'these', 'those'];
  for (const pronoun of ambiguousPronouns) {
    if (query.includes(` ${pronoun} `) && !query.includes(`what ${pronoun}`) && !query.includes(`which ${pronoun}`)) {
      result.hasAmbiguity = true;
      result.ambiguityDetails.push(`Ambiguous use of "${pronoun}" - unclear referent`);
    }
  }
  
  // Check for vague terms
  const vagueTerms = ['good', 'bad', 'better', 'best', 'worst', 'many', 'few', 'some', 'a lot', 'soon', 'recently'];
  for (const term of vagueTerms) {
    if (query.includes(term)) {
      result.hasVagueness = true;
      result.vaguenessDetails.push(`Vague term "${term}" lacks specific criteria or measurement`);
    }
  }
  
  // Check for embedded assumptions
  if (query.includes('why is') || query.includes('why are')) {
    result.hasEmbeddedAssumptions = true;
    result.assumptionDetails.push('Question assumes something is true without establishing it first');
  }
  
  // Check for loaded questions
  const loadedIndicators = ['still', 'already', 'finally', 'even'];
  for (const indicator of loadedIndicators) {
    if (query.includes(indicator)) {
      result.isLoadedQuestion = true;
      result.loadedQuestionDetails = `Contains loaded term "${indicator}" that implies a particular stance`;
      break;
    }
  }
  
  return result;
});

const scopeCheckTool = ai.defineTool({
  name: 'scopeCheckTool',
  description: 'Assesses if the query scope is too broad or too narrow',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    scopeAssessment: z.enum(['appropriate', 'too_broad', 'too_narrow']),
    scopeDetails: z.string(),
    suggestedScopeAdjustment: z.string().optional(),
  }),
}, async (input: { query: string }) => {
  const query = input.query.toLowerCase();
  const wordCount = query.split(' ').length;
  
  // Simple heuristics for scope assessment
  if (wordCount < 5 && (query.includes('everything') || query.includes('all') || query.includes('any'))) {
    return {
      scopeAssessment: 'too_broad' as const,
      scopeDetails: 'Query appears to encompass too wide a range without specific focus',
      suggestedScopeAdjustment: 'Consider narrowing down to specific aspects or examples',
    };
  }
  
  if (wordCount > 30 || (query.match(/and/g) || []).length > 3) {
    return {
      scopeAssessment: 'too_narrow' as const,
      scopeDetails: 'Query contains too many specific conditions or constraints',
      suggestedScopeAdjustment: 'Consider breaking down into separate, focused questions',
    };
  }
  
  return {
    scopeAssessment: 'appropriate' as const,
    scopeDetails: 'Query scope appears reasonable for comprehensive analysis',
    suggestedScopeAdjustment: undefined,
  };
});

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: QueryRefinementOutput = {
  originalQuery: '',
  refinedQuery: '',
  refinementReason: 'Unable to refine query due to processing error',
  identifiedIssues: [],
  clarificationQuestions: [],
};

export async function refineQuery(input: QueryRefinementInput): Promise<QueryRefinementOutput> {
  try {
    QueryRefinementInputSchema.parse(input);
  } catch (e: any) {
    console.error('QueryRefinementAgent: Invalid input', { error: e.message, input });
    return { ...DEFAULT_OUTPUT, originalQuery: input.query || '' };
  }
  
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await queryRefinementFlow(input);
      
      // Validate result
      const validation = QueryRefinementOutputSchema.safeParse(result);
      if (validation.success) {
        return validation.data;
      } else {
        console.warn(`QueryRefinementAgent: Attempt ${attempt + 1}: Output validation failed.`, {
          errors: validation.error.errors,
        });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`QueryRefinementAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
        input: JSON.stringify(input).substring(0, 500),
      });
      
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error('QueryRefinementAgent: Max retries reached. Returning original query.');
        return {
          ...DEFAULT_OUTPUT,
          originalQuery: input.query,
          refinedQuery: input.query, // Return original if refinement fails
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  return {
    ...DEFAULT_OUTPUT,
    originalQuery: input.query,
    refinedQuery: input.query,
  };
}

const queryRefinementPrompt = ai.definePrompt({
  name: 'queryRefinementPrompt',
  input: { 
    schema: z.object({
      query: z.string(),
      classificationResults: z.any(),
      scopeResults: z.any(),
    })
  },
  output: { schema: QueryRefinementOutputSchema },
  prompt: `You are a Query Refinement Agent specializing in clarifying and improving user questions for analytical processing.

Original Query: "{{{query}}}"

Classification Analysis Results:
{{{classificationResults}}}

Scope Analysis Results:
{{{scopeResults}}}

Your task is to:
1. Analyze the original query for issues identified by the tools
2. Create a refined version that is:
   - Clear and unambiguous
   - Free from embedded assumptions
   - Appropriately scoped
   - Neutral and unbiased
   - Specific enough for meaningful analysis

3. Explain your refinements
4. Generate clarification questions that could further improve the query

Guidelines:
- Preserve the original intent while removing problematic elements
- If the query is already well-formed, minimal refinement is acceptable
- Break compound questions into their core question
- Remove loaded language and replace with neutral terms
- Make implicit assumptions explicit
- Define vague terms with specific criteria where possible

Return a JSON object with this structure:
{
  "originalQuery": "The original query text",
  "refinedQuery": "Your improved version of the query",
  "refinementReason": "Explanation of changes made and why",
  "identifiedIssues": [
    {
      "issueType": "ambiguity|vagueness|embedded_assumption|scope_too_broad|scope_too_narrow|loaded_question",
      "description": "Specific description of the issue"
    }
  ],
  "clarificationQuestions": [
    "Question 1 that could help clarify the query further",
    "Question 2..."
  ]
}

Return ONLY the JSON object without any additional text.`,
});

const queryRefinementFlow = ai.defineFlow(
  {
    name: 'queryRefinementFlow',
    inputSchema: QueryRefinementInputSchema,
    outputSchema: QueryRefinementOutputSchema,
  },
  async (input) => {
    // Use the classification and scope tools to analyze the query
    const classificationResults = await questionClassifierTool(input);
    const scopeResults = await scopeCheckTool(input);
    
    const { output } = await queryRefinementPrompt({
      query: input.query,
      classificationResults: JSON.stringify(classificationResults, null, 2),
      scopeResults: JSON.stringify(scopeResults, null, 2),
    });
    
    return output ?? {
      ...DEFAULT_OUTPUT,
      originalQuery: input.query,
      refinedQuery: input.query,
    };
  }
);
