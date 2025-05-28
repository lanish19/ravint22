'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { respond, type RespondOutput } from './responder-agent';

// E4: Initial Answer Generation Loop - Iterative refinement with quick critique

const InitialAnswerLoopInputSchema = z.object({
  refinedQuery: z.string().describe('The refined query from QueryRefinementAgent'),
  maxIterations: z.number().default(3),
});
export type InitialAnswerLoopInput = z.infer<typeof InitialAnswerLoopInputSchema>;

const InitialAnswerLoopOutputSchema = z.object({
  finalAnswer: z.string().describe('The refined initial answer after iterative improvement'),
  iterations: z.number().describe('Number of iterations performed'),
  improvementHistory: z.array(z.object({
    iteration: z.number(),
    answer: z.string(),
    critique: z.string(),
    improvements: z.array(z.string()),
  })),
});
export type InitialAnswerLoopOutput = z.infer<typeof InitialAnswerLoopOutputSchema>;

// Quick Critique Agent - Lightweight critique for rapid feedback
const QuickCritiqueOutputSchema = z.object({
  overallQuality: z.enum(['excellent', 'good', 'needs_improvement', 'poor']),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  specificImprovements: z.array(z.string()),
  isSatisfactory: z.boolean().describe('Whether the answer meets quality standards'),
});
type QuickCritiqueOutput = z.infer<typeof QuickCritiqueOutputSchema>;

const quickCritiquePrompt = ai.definePrompt({
  name: 'quickCritiquePrompt',
  input: { 
    schema: z.object({
      query: z.string(),
      answer: z.string(),
      iteration: z.number(),
    })
  },
  output: { schema: QuickCritiqueOutputSchema },
  prompt: `You are a Quick Critique Agent providing rapid feedback on answer quality.

Query: "{{{query}}}"

Current Answer (Iteration {{{iteration}}}):
{{{answer}}}

Provide a quick but insightful critique focusing on:
1. Clarity and directness
2. Completeness of addressing the query
3. Logical flow and structure
4. Obvious flaws or missing elements
5. Actionable improvements

Be constructive and specific. Focus on the most impactful improvements.

Return a JSON object with this structure:
{
  "overallQuality": "excellent|good|needs_improvement|poor",
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "specificImprovements": ["Specific improvement 1", "Specific improvement 2"],
  "isSatisfactory": true/false
}

Return ONLY the JSON object.`,
});

async function quickCritique(query: string, answer: string, iteration: number): Promise<QuickCritiqueOutput> {
  try {
    const { output } = await quickCritiquePrompt({ query, answer, iteration });
    return output ?? {
      overallQuality: 'needs_improvement',
      strengths: [],
      weaknesses: ['Unable to generate critique'],
      specificImprovements: [],
      isSatisfactory: false,
    };
  } catch (error) {
    console.error('QuickCritiqueAgent: Error generating critique', { error });
    return {
      overallQuality: 'needs_improvement',
      strengths: [],
      weaknesses: ['Critique generation failed'],
      specificImprovements: [],
      isSatisfactory: false,
    };
  }
}

// Answer Refinement Agent - Takes critique and improves the answer
const answerRefinementPrompt = ai.definePrompt({
  name: 'answerRefinementPrompt',
  input: {
    schema: z.object({
      query: z.string(),
      previousAnswer: z.string(),
      critique: QuickCritiqueOutputSchema,
      iteration: z.number(),
    })
  },
  output: { schema: z.object({ refinedAnswer: z.string() }) },
  prompt: `You are refining an answer based on critique feedback.

Query: "{{{query}}}"

Previous Answer:
{{{previousAnswer}}}

Critique Feedback:
- Overall Quality: {{{critique.overallQuality}}}
- Strengths: {{#each critique.strengths}}- {{this}}{{/each}}
- Weaknesses: {{#each critique.weaknesses}}- {{this}}{{/each}}
- Specific Improvements Needed: {{#each critique.specificImprovements}}- {{this}}{{/each}}

Your task is to:
1. Maintain the strengths identified
2. Address each weakness
3. Implement the specific improvements suggested
4. Ensure the refined answer is clearer and more complete

Guidelines:
- Keep the same general structure if it works well
- Be more specific where the critique indicates vagueness
- Add missing information if gaps were identified
- Improve clarity and flow
- Maintain appropriate length (2-3 paragraphs)

Return a JSON object with this structure:
{
  "refinedAnswer": "Your improved answer here"
}

Return ONLY the JSON object.`,
});

async function refineAnswer(
  query: string, 
  previousAnswer: string, 
  critique: QuickCritiqueOutput,
  iteration: number
): Promise<string> {
  try {
    const { output } = await answerRefinementPrompt({
      query,
      previousAnswer,
      critique,
      iteration,
    });
    return output?.refinedAnswer ?? previousAnswer;
  } catch (error) {
    console.error('AnswerRefinementAgent: Error refining answer', { error });
    return previousAnswer; // Return previous answer if refinement fails
  }
}

const DEFAULT_OUTPUT: InitialAnswerLoopOutput = {
  finalAnswer: 'Unable to generate initial answer',
  iterations: 0,
  improvementHistory: [],
};

export async function runInitialAnswerLoop(input: InitialAnswerLoopInput): Promise<InitialAnswerLoopOutput> {
  try {
    InitialAnswerLoopInputSchema.parse(input);
  } catch (e: any) {
    console.error('InitialAnswerLoopAgent: Invalid input', { error: e.message, input });
    return DEFAULT_OUTPUT;
  }
  
  const improvementHistory: InitialAnswerLoopOutput['improvementHistory'] = [];
  let currentAnswer = '';
  let iteration = 0;
  
  try {
    // Generate initial answer using the existing ResponderAgent
    console.log('InitialAnswerLoopAgent: Generating initial answer...');
    const initialResponse = await respond({ query: input.refinedQuery });
    currentAnswer = initialResponse.answer;
    
    // Run the improvement loop
    for (iteration = 1; iteration <= input.maxIterations; iteration++) {
      console.log(`InitialAnswerLoopAgent: Iteration ${iteration} - Critiquing answer...`);
      
      // Get critique
      const critique = await quickCritique(input.refinedQuery, currentAnswer, iteration);
      
      // Record history
      const historyEntry = {
        iteration,
        answer: currentAnswer,
        critique: `Quality: ${critique.overallQuality}. Weaknesses: ${critique.weaknesses.join(', ')}`,
        improvements: critique.specificImprovements,
      };
      improvementHistory.push(historyEntry);
      
      // Check if answer is satisfactory
      if (critique.isSatisfactory || critique.overallQuality === 'excellent') {
        console.log(`InitialAnswerLoopAgent: Answer satisfactory after ${iteration} iteration(s)`);
        break;
      }
      
      // If this is the last iteration, don't refine
      if (iteration === input.maxIterations) {
        console.log('InitialAnswerLoopAgent: Max iterations reached');
        break;
      }
      
      // Refine the answer based on critique
      console.log(`InitialAnswerLoopAgent: Refining answer based on critique...`);
      const refinedAnswer = await refineAnswer(
        input.refinedQuery,
        currentAnswer,
        critique,
        iteration
      );
      
      // Check if refinement actually changed the answer
      if (refinedAnswer === currentAnswer) {
        console.log('InitialAnswerLoopAgent: No changes made in refinement, ending loop');
        break;
      }
      
      currentAnswer = refinedAnswer;
    }
    
    return {
      finalAnswer: currentAnswer,
      iterations: iteration,
      improvementHistory,
    };
    
  } catch (error: any) {
    console.error('InitialAnswerLoopAgent: Error in answer generation loop', {
      error: error.message,
      iteration,
    });
    
    // If we have any answer at all, return it
    if (currentAnswer) {
      return {
        finalAnswer: currentAnswer,
        iterations: iteration,
        improvementHistory,
      };
    }
    
    return DEFAULT_OUTPUT;
  }
}

// Define the flow for use in orchestration
export const initialAnswerLoopFlow = ai.defineFlow(
  {
    name: 'initialAnswerLoopFlow',
    inputSchema: InitialAnswerLoopInputSchema,
    outputSchema: InitialAnswerLoopOutputSchema,
  },
  runInitialAnswerLoop
);
