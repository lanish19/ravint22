'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input schema for the parallel researcher ensemble
const ParallelResearcherInputSchema = z.object({
  query: z.string().describe('The research query or claim to investigate'),
  researchDepth: z.enum(['surface', 'moderate', 'deep']).default('moderate').describe('Depth of research required'),
  domainFocus: z.array(z.enum(['academic', 'news', 'regulatory', 'industry', 'social_media', 'patents'])).default(['academic', 'news']).describe('Domains to focus research on'),
  evidenceType: z.enum(['supporting', 'counter', 'balanced']).default('balanced').describe('Type of evidence to gather'),
  timeframe: z.enum(['recent', 'historical', 'all']).default('all').describe('Timeframe for evidence'),
});

// Individual evidence item schema
const EvidenceItemSchema = z.object({
  claim: z.string().describe('The specific claim or finding'),
  support: z.string().describe('Supporting details and context'),
  source: z.string().describe('Source of the evidence'),
  quality: z.enum(['high', 'moderate', 'low']).describe('Quality assessment of the evidence'),
  relevance: z.enum(['high', 'moderate', 'low']).describe('Relevance to the query'),
  bias_potential: z.enum(['low', 'moderate', 'high']).describe('Potential for bias in this source'),
  evidenceType: z.enum(['supporting', 'counter', 'neutral']).describe('Type of evidence relative to query'),
  domain: z.enum(['academic', 'news', 'regulatory', 'industry', 'social_media', 'patents']).describe('Domain this evidence comes from'),
  methodology: z.string().optional().describe('Research methodology if applicable'),
  limitations: z.string().optional().describe('Known limitations of this evidence'),
});

// Output schema for the ensemble
const ParallelResearcherOutputSchema = z.object({
  researchSummary: z.object({
    totalSources: z.number().describe('Total number of sources analyzed'),
    supportingEvidence: z.number().describe('Number of supporting evidence pieces'),
    counterEvidence: z.number().describe('Number of counter evidence pieces'),
    neutralEvidence: z.number().describe('Number of neutral evidence pieces'),
    domainCoverage: z.array(z.string()).describe('Domains that were successfully researched'),
    researchQuality: z.enum(['excellent', 'good', 'fair', 'poor']).describe('Overall quality of research results'),
  }).describe('Summary of research effort and coverage'),
  evidenceFindings: z.array(EvidenceItemSchema).describe('All evidence items discovered'),
  supportingEvidence: z.array(EvidenceItemSchema).describe('Evidence that supports the query/claim'),
  counterEvidence: z.array(EvidenceItemSchema).describe('Evidence that contradicts the query/claim'),
  researchGaps: z.array(z.object({
    domain: z.string().describe('Domain where gap exists'),
    gapDescription: z.string().describe('Description of what information is missing'),
    impact: z.enum(['high', 'moderate', 'low']).describe('Impact of this gap on analysis'),
    suggestions: z.string().describe('Suggestions for addressing this gap'),
  })).describe('Identified gaps in research coverage'),
  sourceReliability: z.object({
    highReliability: z.array(z.string()).describe('Sources assessed as highly reliable'),
    moderateReliability: z.array(z.string()).describe('Sources with moderate reliability'),
    lowReliability: z.array(z.string()).describe('Sources with questionable reliability'),
    biasWarnings: z.array(z.object({
      source: z.string(),
      biasType: z.string(),
      severity: z.enum(['high', 'moderate', 'low']),
    })).describe('Warnings about potential source bias'),
  }).describe('Assessment of source reliability and bias'),
});

type ParallelResearcherInput = z.infer<typeof ParallelResearcherInputSchema>;
type ParallelResearcherOutput = z.infer<typeof ParallelResearcherOutputSchema>;

// Default output for error cases
const DEFAULT_OUTPUT: ParallelResearcherOutput = {
  researchSummary: {
    totalSources: 0,
    supportingEvidence: 0,
    counterEvidence: 0,
    neutralEvidence: 0,
    domainCoverage: [],
    researchQuality: 'poor',
  },
  evidenceFindings: [],
  supportingEvidence: [],
  counterEvidence: [],
  researchGaps: [
    {
      domain: 'all',
      gapDescription: 'Research ensemble failed to execute properly',
      impact: 'high',
      suggestions: 'Manual research required across all domains',
    },
  ],
  sourceReliability: {
    highReliability: [],
    moderateReliability: [],
    lowReliability: [],
    biasWarnings: [],
  },
};

// Sub-agent definitions for different research domains
const createDomainResearcher = (domain: string) => {
  const domainSpecificPrompt = {
    academic: `You are an academic research specialist. Focus on peer-reviewed sources, research papers, systematic reviews, and scholarly publications. Prioritize evidence quality, methodology rigor, and citation credibility.`,
    news: `You are a news and current events research specialist. Focus on reputable news sources, investigative journalism, fact-checking organizations, and current developments. Be aware of media bias and source reliability.`,
    regulatory: `You are a regulatory and policy research specialist. Focus on government documents, regulatory filings, policy papers, legal precedents, and official agency publications.`,
    industry: `You are an industry research specialist. Focus on industry reports, market analysis, company publications, trade associations, and professional organizations.`,
    social_media: `You are a social media and public sentiment research specialist. Focus on trending topics, public discourse, expert opinions, and social indicators while being extremely cautious about misinformation.`,
    patents: `You are a patent and intellectual property research specialist. Focus on patent databases, technical documentation, innovation trends, and intellectual property landscapes.`,
  }[domain] || `You are a general research specialist.`;

  return ai.defineFlow(
    {
      name: `${domain}ResearcherAgent`,
      inputSchema: z.object({
        query: z.string(),
        evidenceType: z.enum(['supporting', 'counter', 'balanced']),
        depth: z.enum(['surface', 'moderate', 'deep']),
      }),
      outputSchema: z.array(EvidenceItemSchema),
    },
    async (input) => {
      try {
        const prompt = `${domainSpecificPrompt}

RESEARCH TASK:
Query/Claim: "${input.query}"
Evidence Type Needed: ${input.evidenceType}
Research Depth: ${input.depth}
Domain Focus: ${domain}

INSTRUCTIONS:
1. Search for evidence related to this query in your specialized domain
2. Focus on ${input.evidenceType === 'supporting' ? 'evidence that supports' : input.evidenceType === 'counter' ? 'evidence that contradicts or challenges' : 'all types of evidence for'} the query
3. Assess each piece of evidence for quality, relevance, and potential bias
4. For academic sources: prioritize peer-reviewed, recent publications with strong methodology
5. For news sources: prioritize reputable outlets, fact-checked content, and original reporting
6. For regulatory sources: prioritize official government sources and verified legal documents
7. For industry sources: prioritize authoritative market leaders and established organizations
8. For social media sources: be extremely cautious about verification and note uncertainty
9. For patent sources: focus on granted patents and verified technical documentation

CRITICAL REQUIREMENTS:
- Provide specific, factual evidence with clear sources
- Assess quality honestly (many sources may be moderate or low quality)
- Note potential biases or limitations
- If evidence is thin or poor quality, say so rather than inventing content
- Focus on ${input.depth === 'deep' ? '8-12' : input.depth === 'moderate' ? '4-8' : '2-4'} high-quality findings

Return your findings as an array of evidence items following the schema.`;

        const result = await ai.generate({
          model: 'claude-3-sonnet',
          prompt,
          output: {
            schema: z.array(EvidenceItemSchema),
          },
        });

        const evidence = result.output || [];
        
        // Set domain for all evidence items
        return evidence.map(item => ({
          ...item,
          domain: domain as any,
        }));
        
      } catch (error: any) {
        console.error(`${domain}ResearcherAgent: Error during research`, { error: error.message });
        return [];
      }
    }
  );
};

// Create domain-specific researcher agents
const academicResearcher = createDomainResearcher('academic');
const newsResearcher = createDomainResearcher('news');
const regulatoryResearcher = createDomainResearcher('regulatory');
const industryResearcher = createDomainResearcher('industry');
const socialMediaResearcher = createDomainResearcher('social_media');
const patentsResearcher = createDomainResearcher('patents');

// Map domains to their researcher agents
const domainResearchers = {
  academic: academicResearcher,
  news: newsResearcher,
  regulatory: regulatoryResearcher,
  industry: industryResearcher,
  social_media: socialMediaResearcher,
  patents: patentsResearcher,
};

// Main parallel researcher ensemble
const parallelResearcherEnsemble = ai.defineFlow(
  {
    name: 'parallelResearcherEnsemble',
    inputSchema: ParallelResearcherInputSchema,
    outputSchema: ParallelResearcherOutputSchema,
  },
  async (input: ParallelResearcherInput): Promise<ParallelResearcherOutput> => {
    try {
      console.log('ParallelResearcherEnsemble: Starting multi-domain research', {
        query: input.query.substring(0, 100),
        domains: input.domainFocus,
        evidenceType: input.evidenceType,
        depth: input.researchDepth,
      });

      // Execute research in parallel across specified domains
      const researchPromises = input.domainFocus.map(async (domain) => {
        try {
          const researcher = domainResearchers[domain];
          if (!researcher) {
            console.warn(`ParallelResearcherEnsemble: No researcher available for domain: ${domain}`);
            return { domain, evidence: [] };
          }

          const evidence = await researcher({
            query: input.query,
            evidenceType: input.evidenceType,
            depth: input.researchDepth,
          });

          console.log(`ParallelResearcherEnsemble: ${domain} research completed`, {
            evidenceCount: evidence.length,
          });

          return { domain, evidence };
        } catch (error: any) {
          console.error(`ParallelResearcherEnsemble: Error in ${domain} research`, {
            error: error.message,
          });
          return { domain, evidence: [] };
        }
      });

      const researchResults = await Promise.all(researchPromises);
      
      // Aggregate all evidence
      const allEvidence: z.infer<typeof EvidenceItemSchema>[] = [];
      const successfulDomains: string[] = [];
      
      for (const result of researchResults) {
        if (result.evidence.length > 0) {
          allEvidence.push(...result.evidence);
          successfulDomains.push(result.domain);
        }
      }

      // Categorize evidence
      const supportingEvidence = allEvidence.filter(e => e.evidenceType === 'supporting');
      const counterEvidence = allEvidence.filter(e => e.evidenceType === 'counter');
      const neutralEvidence = allEvidence.filter(e => e.evidenceType === 'neutral');

      // Assess research gaps
      const researchGaps = input.domainFocus
        .filter(domain => !successfulDomains.includes(domain))
        .map(domain => ({
          domain,
          gapDescription: `No reliable evidence found in ${domain} domain`,
          impact: 'moderate' as const,
          suggestions: `Conduct manual ${domain} research or consult domain experts`,
        }));

      // Assess source reliability
      const sourceReliability = {
        highReliability: allEvidence.filter(e => e.quality === 'high').map(e => e.source),
        moderateReliability: allEvidence.filter(e => e.quality === 'moderate').map(e => e.source),
        lowReliability: allEvidence.filter(e => e.quality === 'low').map(e => e.source),
        biasWarnings: allEvidence
          .filter(e => e.bias_potential === 'high')
          .map(e => ({
            source: e.source,
            biasType: `High bias potential in ${e.domain} source`,
            severity: 'moderate' as const,
          })),
      };

      // Assess overall research quality
      const highQualityCount = allEvidence.filter(e => e.quality === 'high').length;
      const totalCount = allEvidence.length;
      const qualityRatio = totalCount > 0 ? highQualityCount / totalCount : 0;
      
      const researchQuality = qualityRatio > 0.6 ? 'excellent' :
                             qualityRatio > 0.4 ? 'good' :
                             qualityRatio > 0.2 ? 'fair' : 'poor';

      const output: ParallelResearcherOutput = {
        researchSummary: {
          totalSources: allEvidence.length,
          supportingEvidence: supportingEvidence.length,
          counterEvidence: counterEvidence.length,
          neutralEvidence: neutralEvidence.length,
          domainCoverage: successfulDomains,
          researchQuality,
        },
        evidenceFindings: allEvidence,
        supportingEvidence,
        counterEvidence,
        researchGaps,
        sourceReliability,
      };

      console.log('ParallelResearcherEnsemble: Research completed', {
        totalEvidence: allEvidence.length,
        domainsSuccessful: successfulDomains.length,
        quality: researchQuality,
      });

      return output;

    } catch (error: any) {
      console.error('ParallelResearcherEnsemble: Critical error during research', {
        error: error.message,
        query: input.query?.substring(0, 100),
      });
      return DEFAULT_OUTPUT;
    }
  }
);

// Export the main function and types
export const runParallelResearcherEnsemble = parallelResearcherEnsemble;
export type { ParallelResearcherInput, ParallelResearcherOutput }; 