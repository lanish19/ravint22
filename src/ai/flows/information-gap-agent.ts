'use server';
/**
 * @fileOverview Information Gap Analyzer AI agent.
 * This agent identifies critical missing pieces of information or unanswered questions
 * related to a given answer.
 *
 * - analyzeInformationGaps - Function to trigger the information gap analysis.
 * - InformationGapInput - The input type for the analyzeInformationGaps function.
 * - InformationGapOutput - The return type for the analyzeInformationGaps function.
 * - InformationGapItem - The type for a single identified information gap.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InformationGapInputSchema = z.object({
  answer: z.string().describe('The answer to analyze for information gaps.'),
});
export type InformationGapInput = z.infer<typeof InformationGapInputSchema>;

const InformationGapItemSchema = z.object({
  gap: z.string().describe("A specific piece of missing information or an unanswered question critical to fully evaluating the answer."),
  impact: z.enum(['High', 'Medium', 'Low']).describe("The potential impact of this information gap on the answer's validity or completeness."),
});
export type InformationGapItem = z.infer<typeof InformationGapItemSchema>;

const InformationGapOutputSchema = z.array(InformationGapItemSchema);
export type InformationGapOutput = z.infer<typeof InformationGapOutputSchema>;

const RETRY_ATTEMPTS = 3;
const DEFAULT_OUTPUT: InformationGapOutput = [];

export async function analyzeInformationGaps(input: InformationGapInput): Promise<InformationGapOutput> {
  try {
    InformationGapInputSchema.parse(input);
  } catch (e: any) {
    console.error('InformationGapAgent: Invalid input', { error: e.message, input });
    return DEFAULT_OUTPUT;
  }

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await informationGapInternalFlow(input);
      
      let parsedOutput = result;
      if (typeof result === 'string') {
        try {
          parsedOutput = JSON.parse(result);
        } catch (parseError) {
          console.warn(`InformationGapAgent: Attempt ${attempt + 1}: Output was a string but not valid JSON. Retrying if possible.`, { stringOutput: result, error: parseError });
          if (attempt < RETRY_ATTEMPTS - 1) continue;
          parsedOutput = DEFAULT_OUTPUT;
        }
      }
      
      const validation = InformationGapOutputSchema.safeParse(parsedOutput);
      if (validation.success) {
        return validation.data;
      } else {
        console.warn(`InformationGapAgent: Attempt ${attempt + 1}: Output validation failed. Retrying if possible.`, { errors: validation.error.errors, outputReceived: parsedOutput });
        if (attempt < RETRY_ATTEMPTS - 1) continue;
        return DEFAULT_OUTPUT;
      }

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`InformationGapAgent: Attempt ${attempt + 1} failed.`, {
        error: errorMessage,
        input: JSON.stringify(input).substring(0,500),
        timestamp: new Date().toISOString()
      });
      if (errorMessage.includes("INVALID_ARGUMENT") && errorMessage.includes("Expected array, got null")) {
         console.warn(`InformationGapAgent: Attempt ${attempt + 1}: Genkit schema validation failed (null for array). Retrying.`);
         if (attempt < RETRY_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
        console.warn(`InformationGapAgent: Max retries reached for null array output. Returning default.`);
        return DEFAULT_OUTPUT;
      }
      if (attempt === RETRY_ATTEMPTS - 1) {
        console.error(`InformationGapAgent: Max retries reached. Returning default output.`);
        return DEFAULT_OUTPUT;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  console.error("InformationGapAgent: Reached end of function unexpectedly. Returning default.");
  return DEFAULT_OUTPUT;
}

const prompt = ai.definePrompt({
  name: 'informationGapPrompt',
  input: {schema: InformationGapInputSchema},
  output: {schema: InformationGapOutputSchema},
  prompt: `You are an expert information gap analyzer. Given the following answer, your task is to identify critical missing pieces of information or unanswered questions that, if known, would significantly affect the understanding, validity, or completeness of the answer.

Answer: "{{{answer}}}"

For each identified gap, assess its potential impact (High, Medium, or Low) on the answer's overall quality and reliability.
Focus on identifying 3-5 key information gaps.

Return your findings as a JSON array of objects. Each object in the array must conform to the following structure:
{
  "gap": "A specific piece of missing information or an unanswered question critical to fully evaluating the answer.",
  "impact": "High|Medium|Low" // The potential impact of this information gap.
}

Example:
[
  {
    "gap": "What is the specific timeframe being considered for these effects?",
    "impact": "High"
  },
  {
    "gap": "Are there any peer-reviewed studies that contradict these findings?",
    "impact": "Medium"
  },
  {
    "gap": "What is the sample size of the study mentioned?",
    "impact": "Low"
  }
]

Return ONLY a valid JSON array with the exact structure shown above. Do not include any explanatory text before or after the JSON.`,
});

const informationGapInternalFlow = ai.defineFlow(
  {
    name: 'informationGapInternalFlow',
    inputSchema: InformationGapInputSchema,
    outputSchema: InformationGapOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output ?? DEFAULT_OUTPUT;
  }
);

