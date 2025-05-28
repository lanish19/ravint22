
'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
// Import type from researcher-agent, but EvidenceSchema will be defined locally for CritiqueAgentInputSchema
import type { Evidence } from './researcher-agent';

// Define EvidenceSchema locally for use in CritiqueAgentInputSchema
const LocalEvidenceSchema = z.object({
  claim: z.string().describe('Specific aspect of the claim being supported'),
  support: z.string().describe('Detailed evidence with statistics, studies, or expert consensus'),
  quality: z.enum(['high', 'moderate', 'low']).describe('Quality of the evidence'),
  source: z.string().describe('Credible source citation (journal, institution, etc.)'),
});

const CritiqueAgentInputSchema = z.object({
  answer: z.string().describe('The answer to be analyzed.'),
  evidence: z.array(LocalEvidenceSchema).describe('The supporting evidence for the answer.'),
});
export type CritiqueAgentInput = z.infer<typeof CritiqueAgentInputSchema>;

const CritiqueAgentOutputSchema = z.string().describe('The critical analysis of the answer and evidence.');
export type CritiqueAgentOutput = z.infer<typeof CritiqueAgentOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: CritiqueAgentOutput = "Critical analysis could not be generated due to processing issues.";

export async function critiqueAgent(input: CritiqueAgentInput): Promise<CritiqueAgentOutput> {
  try {
    CritiqueAgentInputSchema.parse(input);
  } catch (e: any) {
    console.error('CriticAgent: Invalid input', { error: e.message, input });
    return DEFAULT_OUTPUT;
  }
  
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await critiqueAgentInternalFlow(input); 

      if (typeof result === 'string') {
        return result; 
      } else if (result === null || result === undefined) {
        console.warn(`CriticAgent: Attempt ${attempt + 1}: LLM returned null/undefined output. Retrying if possible.`);
         if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        return DEFAULT_OUTPUT;
      } else {
        console.warn(`CriticAgent: Attempt ${attempt + 1}: LLM returned non-string output, attempting to stringify. Output type: ${typeof result}`, {outputReceived: result});
        const stringified = String(result);
        // Check if stringifying resulted in something meaningful, otherwise it might be "[object Object]"
        if (stringified && stringified !== "[object Object]") {
            return stringified;
        }
        if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        return DEFAULT_OUTPUT;
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`CriticAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
        input: JSON.stringify(input).substring(0,500),
        timestamp: new Date().toISOString()
      });

      if (errorMessage.includes("INVALID_ARGUMENT") && errorMessage.includes("Expected string, got null")) {
        console.warn(`CriticAgent: Attempt ${attempt + 1}: Genkit schema validation failed (null for string). Retrying.`);
        if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        console.warn(`CriticAgent: Max retries reached for null string output. Returning default.`);
        return DEFAULT_OUTPUT;
      }
      
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error(`CriticAgent: Max retries reached. Returning default output.`);
        return DEFAULT_OUTPUT;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  console.error("CriticAgent: Reached end of function unexpectedly. Returning default.");
  return DEFAULT_OUTPUT;
}

const critiqueAgentPrompt = ai.definePrompt({
  name: 'critiqueAgentPrompt',
  input: {schema: CritiqueAgentInputSchema},
  output: {schema: CritiqueAgentOutputSchema}, 
  prompt: `You are a critical analysis agent specializing in identifying logical flaws and cognitive biases. Analyze this answer and its supporting evidence:

ANSWER: "{{answer}}"

EVIDENCE:
{{#each evidence}}
- {{this.claim}}: {{this.support}} (Quality: {{this.quality}}, Source: {{this.source}})
{{/each}}

Provide a critical analysis that:
1. Identifies logical flaws or inconsistencies
2. **EXPLICITLY identifies specific cognitive biases** such as:
   - Anchoring bias (over-reliance on first information)
   - Confirmation bias (seeking only supporting evidence)
   - Availability heuristic (overweighting easily recalled info)
   - Authority bias (over-relying on expert opinions)
   - Selection bias (cherry-picking evidence)
   - Framing effects (influenced by presentation)
   - Consider if any of these biases were passed from upstream agents
3. Evaluates the strength and potential bias in the evidence selection
4. Highlights missing perspectives or counter-evidence
5. Questions unstated assumptions and their potential bias
6. Assesses whether the answer shows overconfidence or underconfidence

For each bias identified, explain:
- Which specific bias is present
- Where it appears in the answer or evidence
- How it might affect the conclusion
- How to mitigate it

Be thorough but constructive. Your goal is to strengthen the analysis by making biases explicit, not just to tear it down.

Return your analysis as a plain text string. Do not wrap it in JSON or any other format.`,
});

const critiqueAgentInternalFlow = ai.defineFlow(
  {
    name: 'critiqueAgentInternalFlow',
    inputSchema: CritiqueAgentInputSchema,
    outputSchema: CritiqueAgentOutputSchema,
  },
  async (input): Promise<string> => {
    const {output} = await critiqueAgentPrompt(input);
    if (typeof output === 'string') {
      return output;
    }
    // If Genkit validation fails and output is null for a string schema, 
    // or if it's not a string for some reason.
    console.warn('critiqueAgentInternalFlow: prompt output was not a string or was null. Returning empty string.', {outputReceived: output});
    return ""; // Ensure empty string for null/undefined, as per schema validation fix.
  }
);
