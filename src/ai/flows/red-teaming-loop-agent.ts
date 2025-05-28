'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { challenge } from './devils-advocate-agent';

// E6: Iterative Red Teaming Loop - Stress tests arguments through iterative challenges

const RedTeamingLoopInputSchema = z.object({
  initialArgument: z.string(),
  maxIterations: z.number().default(3),
});
export type RedTeamingLoopInput = z.infer<typeof RedTeamingLoopInputSchema>;

const RedTeamingLoopOutputSchema = z.object({
  stressTestedArgument: z.string(),
  iterations: z.number(),
  improvementHistory: z.array(z.object({
    iteration: z.number(),
    argument: z.string(),
    challenges: z.array(z.string()),
    refinements: z.array(z.string()),
    strengthScore: z.number().min(0).max(100),
  })),
  finalStrengthAssessment: z.object({
    overallStrength: z.enum(['very_strong', 'strong', 'moderate', 'weak']),
    survivingChallenges: z.array(z.string()),
    addressedChallenges: z.array(z.string()),
    robustnessScore: z.number().min(0).max(100),
  }),
});
export type RedTeamingLoopOutput = z.infer<typeof RedTeamingLoopOutputSchema>;

// Argument Refinement Agent for the loop
const argumentRefinementPrompt = ai.definePrompt({
  name: 'redTeamArgumentRefinementPrompt',
  input: {
    schema: z.object({
      currentArgument: z.string(),
      challenges: z.array(z.string()),
      iteration: z.number(),
    })
  },
  output: { 
    schema: z.object({ 
      refinedArgument: z.string(),
      refinements: z.array(z.string()),
      strengthScore: z.number(),
    })
  },
  prompt: `You are refining an argument to address challenges from a Devil's Advocate.

Current Argument:
{{{currentArgument}}}

Challenges (Iteration {{{iteration}}}):
{{#each challenges}}
- {{this}}
{{/each}}

Your task is to:
1. Address each challenge by strengthening the argument
2. Add necessary nuance, evidence, or qualifications
3. Maintain the core position while acknowledging valid criticisms
4. Make the argument more robust against future challenges

Guidelines:
- Don't simply dismiss challenges - integrate valid points
- Strengthen weak areas identified by challenges
- Add specific evidence or reasoning where needed
- Maintain clarity while adding robustness

Score the strength of your refined argument (0-100) based on:
- How well it addresses the challenges
- Overall logical coherence
- Evidence quality
- Resilience to criticism

Return a JSON object:
{
  "refinedArgument": "Your strengthened argument",
  "refinements": ["Specific refinement 1", "Specific refinement 2"],
  "strengthScore": 0-100
}

Return ONLY the JSON object.`,
});

async function refineArgumentAgainstChallenges(
  currentArgument: string,
  challenges: string[],
  iteration: number
): Promise<{ refinedArgument: string; refinements: string[]; strengthScore: number }> {
  try {
    const { output } = await argumentRefinementPrompt({
      currentArgument,
      challenges,
      iteration,
    });
    return output ?? {
      refinedArgument: currentArgument,
      refinements: ['Unable to refine'],
      strengthScore: 50,
    };
  } catch (error) {
    console.error('RedTeamingLoop: Error refining argument', { error });
    return {
      refinedArgument: currentArgument,
      refinements: ['Refinement failed'],
      strengthScore: 50,
    };
  }
}

// Challenge Assessment to determine if we should continue
const challengeAssessmentPrompt = ai.definePrompt({
  name: 'challengeAssessmentPrompt',
  input: {
    schema: z.object({
      challenges: z.array(z.string()),
      previousChallenges: z.array(z.string()),
    })
  },
  output: { 
    schema: z.object({ 
      challengeStrength: z.enum(['strong', 'moderate', 'weak']),
      newChallengesFound: z.boolean(),
      continueIterating: z.boolean(),
    })
  },
  prompt: `Assess the strength and novelty of challenges to determine if red-teaming should continue.

Current Challenges:
{{#each challenges}}
- {{this}}
{{/each}}

Previous Challenges:
{{#each previousChallenges}}
- {{this}}
{{/each}}

Determine:
1. Are the current challenges strong, moderate, or weak?
2. Are there genuinely new challenges, or are they repetitive?
3. Should we continue iterating (true) or stop (false)?

Return a JSON object:
{
  "challengeStrength": "strong|moderate|weak",
  "newChallengesFound": true/false,
  "continueIterating": true/false
}

Return ONLY the JSON object.`,
});

const DEFAULT_OUTPUT: RedTeamingLoopOutput = {
  stressTestedArgument: '',
  iterations: 0,
  improvementHistory: [],
  finalStrengthAssessment: {
    overallStrength: 'weak',
    survivingChallenges: [],
    addressedChallenges: [],
    robustnessScore: 0,
  },
};

export async function runRedTeamingLoop(input: RedTeamingLoopInput): Promise<RedTeamingLoopOutput> {
  try {
    RedTeamingLoopInputSchema.parse(input);
  } catch (e: any) {
    console.error('RedTeamingLoopAgent: Invalid input', { error: e.message });
    return { ...DEFAULT_OUTPUT, stressTestedArgument: input.initialArgument || '' };
  }
  
  const improvementHistory: RedTeamingLoopOutput['improvementHistory'] = [];
  let currentArgument = input.initialArgument;
  let allPreviousChallenges: string[] = [];
  let iteration = 0;
  
  try {
    console.log('RedTeamingLoopAgent: Starting iterative red-teaming...');
    
    for (iteration = 1; iteration <= input.maxIterations; iteration++) {
      console.log(`RedTeamingLoopAgent: Iteration ${iteration} - Generating challenges...`);
      
      // Generate challenges using Devil's Advocate
      const challengeResult = await challenge({
        answer: currentArgument,
        critique: '', // Red teaming doesn't need prior critique
      });
      
      const currentChallenges = challengeResult;
      
      // Assess if we should continue
      if (iteration > 1) {
        const { output: assessment } = await challengeAssessmentPrompt({
          challenges: currentChallenges,
          previousChallenges: allPreviousChallenges,
        });
        
        if (assessment && !assessment.continueIterating) {
          console.log('RedTeamingLoopAgent: Challenges are weak or repetitive, ending loop');
          break;
        }
      }
      
      // Refine argument to address challenges
      console.log(`RedTeamingLoopAgent: Refining argument based on ${currentChallenges.length} challenges...`);
      const refinementResult = await refineArgumentAgainstChallenges(
        currentArgument,
        currentChallenges,
        iteration
      );
      
      // Record history
      improvementHistory.push({
        iteration,
        argument: currentArgument,
        challenges: currentChallenges,
        refinements: refinementResult.refinements,
        strengthScore: refinementResult.strengthScore,
      });
      
      // Update for next iteration
      currentArgument = refinementResult.refinedArgument;
      allPreviousChallenges = [...allPreviousChallenges, ...currentChallenges];
      
      // Check if argument is strong enough
      if (refinementResult.strengthScore >= 85) {
        console.log(`RedTeamingLoopAgent: Argument reached high strength (${refinementResult.strengthScore}), ending loop`);
        break;
      }
    }
    
    // Final strength assessment
    const allChallenges = improvementHistory.flatMap(h => h.challenges);
    const uniqueChallenges = Array.from(new Set(allChallenges));
    const addressedChallenges = improvementHistory
      .flatMap(h => h.refinements)
      .filter(r => r !== 'Unable to refine' && r !== 'Refinement failed');
    
    const finalScore = improvementHistory.length > 0 
      ? improvementHistory[improvementHistory.length - 1].strengthScore
      : 50;
    
    const overallStrength: RedTeamingLoopOutput['finalStrengthAssessment']['overallStrength'] = 
      finalScore >= 80 ? 'very_strong' :
      finalScore >= 60 ? 'strong' :
      finalScore >= 40 ? 'moderate' : 'weak';
    
    return {
      stressTestedArgument: currentArgument,
      iterations: iteration,
      improvementHistory,
      finalStrengthAssessment: {
        overallStrength,
        survivingChallenges: uniqueChallenges.slice(-3), // Last few challenges
        addressedChallenges: addressedChallenges.slice(0, 5), // First few addressed
        robustnessScore: finalScore,
      },
    };
    
  } catch (error: any) {
    console.error('RedTeamingLoopAgent: Error in red-teaming loop', {
      error: error.message,
      iteration,
    });
    
    // Return what we have so far
    return {
      stressTestedArgument: currentArgument,
      iterations: iteration,
      improvementHistory,
      finalStrengthAssessment: {
        overallStrength: 'weak',
        survivingChallenges: [],
        addressedChallenges: [],
        robustnessScore: 0,
      },
    };
  }
}

// Define the flow
export const redTeamingLoopFlow = ai.defineFlow(
  {
    name: 'redTeamingLoopFlow',
    inputSchema: RedTeamingLoopInputSchema,
    outputSchema: RedTeamingLoopOutputSchema,
  },
  runRedTeamingLoop
);
