'use server';
/**
 * @fileOverview Final Synthesis AI agent.
 * This agent takes inputs from all other analytical agents and produces a final synthesized insight.
 *
 * - synthesizeAnalysis - Function to trigger the synthesis process.
 * - SynthesisAgentInput - The input type for the synthesizeAnalysis function.
 * - SynthesisAgentOutput - The return type for the synthesizeAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Import types from other agents to define the input structure
import type { RespondOutput } from './responder-agent';
import type { AnalyzeAssumptionsOutput } from './assumption-analyzer-agent';
import type { ResearchEvidenceOutput } from './researcher-agent'; // Used for supporting evidence
import type { ResearchCounterEvidenceOutput } from './counter-evidence-researcher-agent'; // New: Used for counter evidence
import type { CritiqueAgentOutput } from './critic-agent';
import type { ChallengeOutput } from './devils-advocate-agent';
import type { PremortemOutput } from './premortem-agent';
import type { InformationGapOutput } from './information-gap-agent';

// Local Zod schemas for imported types for SynthesisAgentInputSchema
const LocalRespondOutputSchema = z.object({
  answer: z.string(),
});
const LocalAssumptionItemSchema = z.object({
  assumption: z.string(),
  risk: z.enum(['High', 'Medium', 'Low']),
  alternative: z.string(),
});
const LocalAnalyzeAssumptionsOutputSchema = z.array(LocalAssumptionItemSchema);

const LocalEvidenceSchema = z.object({ // Reusable for both supporting and counter-evidence
  claim: z.string(),
  support: z.string(),
  quality: z.enum(['high', 'moderate', 'low']),
  source: z.string(),
});
const LocalResearchEvidenceOutputSchema = z.array(LocalEvidenceSchema);
const LocalResearchCounterEvidenceOutputSchema = z.array(LocalEvidenceSchema); // New

const LocalCritiqueAgentOutputSchema = z.string();
const LocalChallengeOutputSchema = z.array(z.string());
const LocalPremortermItemSchema = z.object({
  failure: z.string(),
  probability: z.string(),
  mitigation: z.string(),
});
const LocalPremortemOutputSchema = z.array(LocalPremortermItemSchema);

const LocalInformationGapItemSchema = z.object({
  gap: z.string(),
  impact: z.enum(['High', 'Medium', 'Low']),
});
const LocalInformationGapOutputSchema = z.array(LocalInformationGapItemSchema);


const SynthesisAgentInputSchema = z.object({
  initialAnswer: LocalRespondOutputSchema.describe('The initial answer provided by the Responder Agent.'),
  assumptions: LocalAnalyzeAssumptionsOutputSchema.describe('Identified hidden assumptions and their risks.'),
  evidence: LocalResearchEvidenceOutputSchema.describe('Supporting evidence collected for the initial answer.'),
  counterEvidence: LocalResearchCounterEvidenceOutputSchema.describe('Evidence that challenges or contradicts the initial answer, or supports alternative perspectives.'), // New
  critique: LocalCritiqueAgentOutputSchema.describe('Critical analysis of the initial answer and evidence.'),
  challenges: LocalChallengeOutputSchema.describe('Counterarguments and challenges to the initial answer.'),
  potentialFailures: LocalPremortemOutputSchema.describe('Potential failure modes identified by premortem analysis.'),
  informationGaps: LocalInformationGapOutputSchema.describe('Identified critical informationGaps related to the answer.'),
});
export type SynthesisAgentInput = z.infer<typeof SynthesisAgentInputSchema>;

const SynthesisAgentOutputSchema = z.object({
  confidence: z.enum(['High', 'Medium', 'Low']).describe('Overall confidence in the refined answer/advice based on all analyses.'),
  summary: z.string().describe('A concise summary of the synthesized findings, integrating all agent perspectives.'),
  keyStrengths: z.array(z.string()).describe('Aspects of the initial answer that are well-supported or strengthened by the analysis.'),
  keyWeaknesses: z.array(z.string()).describe('Aspects of the initial answer that are weak, challenged, or have significant risks (considering counter-evidence).'), // Updated description
  actionableRecommendations: z.array(z.string()).describe('Specific, actionable recommendations based on the synthesis.'),
  remainingUncertainties: z.array(z.string()).describe('Key uncertainties or information gaps that still exist after analysis, incorporating insights from the information gap analysis and counter-evidence.'), // Updated description
});
export type SynthesisAgentOutput = z.infer<typeof SynthesisAgentOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: SynthesisAgentOutput = {
  confidence: 'Medium',
  summary: "Synthesis could not be fully generated due to processing issues. The analysis may be incomplete.",
  keyStrengths: [],
  keyWeaknesses: [],
  actionableRecommendations: [],
  remainingUncertainties: ["Full synthesis was not possible."],
};

export async function synthesizeAnalysis(input: SynthesisAgentInput): Promise<SynthesisAgentOutput> {
  try {
    SynthesisAgentInputSchema.parse(input);
  } catch (e: any) {
    console.error('SynthesisAgent: Invalid input', { error: e.message, input: JSON.stringify(input).substring(0, 200) + "..." });
    return DEFAULT_OUTPUT;
  }

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await synthesisAgentInternalFlow(input);

      let parsedOutput = result;
      if (typeof result === 'string') {
        try {
          parsedOutput = JSON.parse(result);
        } catch (parseError) {
          console.warn(`SynthesisAgent: Attempt ${attempt + 1}: Output was a string but not valid JSON. Retrying if possible.`, { stringOutput: result, error: parseError });
          if (attempt < RETRY_ATTEMPTS - 1) continue;
          parsedOutput = DEFAULT_OUTPUT;
        }
      }

      const validation = SynthesisAgentOutputSchema.safeParse(parsedOutput);
      if (validation.success) {
        return validation.data;
      } else {
        console.warn(`SynthesisAgent: Attempt ${attempt + 1}: Output validation failed. Retrying if possible.`, { errors: validation.error.errors, outputReceived: parsedOutput });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
        return DEFAULT_OUTPUT;
      }

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`SynthesisAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
        input: JSON.stringify(input).substring(0,500),
        timestamp: new Date().toISOString()
      });
      if (errorMessage.includes("INVALID_ARGUMENT") && (errorMessage.includes("Expected object, got null") || Object.values(DEFAULT_OUTPUT).some(val => errorMessage.includes(String(val))))) {
         console.warn(`SynthesisAgent: Attempt ${attempt + 1}: Genkit schema validation failed (null for object or specific field). Retrying.`);
         if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        console.warn(`SynthesisAgent: Max retries reached for schema validation output. Returning default.`);
        return DEFAULT_OUTPUT;
      }
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error(`SynthesisAgent: Max retries reached. Returning default output.`);
        return DEFAULT_OUTPUT;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  console.error("SynthesisAgent: Reached end of function unexpectedly. Returning default.");
  return DEFAULT_OUTPUT;
}

const synthesisAgentPrompt = ai.definePrompt({
  name: 'synthesisAgentPrompt',
  input: {schema: SynthesisAgentInputSchema},
  output: {schema: SynthesisAgentOutputSchema},
  prompt: `You are a master synthesis AI agent. Your task is to integrate findings from multiple specialized AI agents into a cohesive and insightful final analysis.

Here are the inputs you've received:

1.  **Initial Answer (from Responder Agent):**
    \`\`\`text
    {{{initialAnswer.answer}}}
    \`\`\`

2.  **Identified Assumptions (from Assumption Analyzer):**
    {{#if assumptions.length}}
    {{#each assumptions}}
    - Assumption: "{{this.assumption}}" (Risk: {{this.risk}}) - Alternative: "{{this.alternative}}"
    {{/each}}
    {{else}}
    - No specific assumptions provided.
    {{/if}}

3.  **Supporting Evidence (from Researcher Agent):**
    {{#if evidence.length}}
    {{#each evidence}}
    - Evidence for "{{this.claim}}": "{{this.support}}" (Quality: {{this.quality}}, Source: {{this.source}})
    {{/each}}
    {{else}}
    - No specific supporting evidence provided.
    {{/if}}

4.  **Counter-Evidence / Alternative Perspectives (from Counter-Evidence Researcher):**
    {{#if counterEvidence.length}}
    {{#each counterEvidence}}
    - Counter-Evidence regarding "{{this.claim}}": "{{this.support}}" (Quality: {{this.quality}}, Source: {{this.source}})
    {{/each}}
    {{else}}
    - No specific counter-evidence provided.
    {{/if}}

5.  **Critical Analysis (from Critic Agent):**
    \`\`\`text
    {{{critique}}}
    \`\`\`

6.  **Devil's Advocate Challenges (from Devil's Advocate Agent):**
    {{#if challenges.length}}
    {{#each challenges}}
    - Challenge: "{{this}}"
    {{/each}}
    {{else}}
    - No specific challenges provided.
    {{/if}}

7.  **Potential Failure Modes (from Premortem Agent):**
    {{#if potentialFailures.length}}
    {{#each potentialFailures}}
    - Failure Mode: "{{this.failure}}" (Probability: {{this.probability}}) - Mitigation: "{{this.mitigation}}"
    {{/each}}
    {{else}}
    - No specific potential failures provided.
    {{/if}}

8.  **Identified Information Gaps (from Information Gap Analyzer):**
    {{#if informationGaps.length}}
    {{#each informationGaps}}
    - Information Gap: "{{this.gap}}" (Impact: {{this.impact}})
    {{/each}}
    {{else}}
    - No specific information gaps provided.
    {{/if}}

Based on all the above information, provide a comprehensive synthesis. Your output MUST be a JSON object with the following structure:

{
  "confidence": "High|Medium|Low", // Overall confidence in the refined answer/advice, considering all analyses including counter-evidence.
  "summary": "Concise synthesized summary, integrating all perspectives including counter-evidence...",
  "keyStrengths": ["Well-supported aspect 1...", "Strengthened point 2..."],
  "keyWeaknesses": ["Weak aspect 1 (e.g., challenged by counter-evidence)...", "Contradicted point 2...", "Significant risk area..."],
  "actionableRecommendations": ["Recommendation 1...", "Recommendation 2..."],
  "remainingUncertainties": ["Uncertainty 1 (incorporating identified gaps and conflicting evidence)...", "Information gap 2...", "Impact of counter-evidence on X..."]
}

Instructions for your synthesis:
- Evaluate the overall confidence in the initial answer, considering all critiques, supporting evidence, counter-evidence, and identified gaps.
- Write a concise summary that integrates the most important insights from all agents, including how counter-evidence impacts the initial claims.
- Identify key strengths of the initial answer, backed by evidence or robust assumptions.
- Identify key weaknesses, drawing from critiques, challenges, counter-evidence, high-risk assumptions, lack of evidence, or significant information gaps.
- Formulate actionable recommendations. These could be to refine the answer, seek more information (especially based on identified gaps or to resolve conflicting evidence), or proceed with caution.
- Highlight any remaining uncertainties or critical information gaps that still exist after analysis. Explicitly consider the 'Information Gaps' input and any conflicts arising from 'Counter-Evidence' when formulating this.

Return ONLY a valid JSON object with the exact structure shown above. Do not include any explanatory text before or after the JSON.
`,
});

const synthesisAgentInternalFlow = ai.defineFlow(
  {
    name: 'synthesisAgentInternalFlow',
    inputSchema: SynthesisAgentInputSchema,
    outputSchema: SynthesisAgentOutputSchema,
  },
  async (input) => {
    const {output} = await synthesisAgentPrompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);
