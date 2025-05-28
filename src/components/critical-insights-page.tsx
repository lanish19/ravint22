
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { runAnalysisPipelineAction, FullAnalysisResults } from '@/app/actions';
import type { Evidence } from '@/ai/flows/researcher-agent'; // Used for both supporting and counter evidence
import type { PremortermItem } from '@/ai/flows/premortem-agent';
import type { AssumptionItem } from '@/ai/flows/assumption-analyzer-agent';
import type { InformationGapItem } from '@/ai/flows/information-gap-agent';
import type { SynthesisAgentOutput } from '@/ai/flows/synthesis-agent';


import {
  MessageSquare,
  Search,
  SearchX, // New icon for counter-evidence researcher
  ShieldAlert,
  AlertTriangle, 
  Activity, 
  Lightbulb,
  HelpCircle,
  Brain,
  Sigma,
  Info,
  ListChecks,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  EyeOff,
} from 'lucide-react';

const agentInfo = [
  { name: "Responder", icon: MessageSquare, description: "Generates initial comprehensive answer." },
  { name: "Supporting Evidence Researcher", icon: Search, description: "Finds and evaluates evidence supporting the claim." },
  { name: "Counter-Evidence Researcher", icon: SearchX, description: "Finds evidence challenging or contradicting the claim." },
  { name: "Assumption Analyzer", icon: Lightbulb, description: "Identifies hidden assumptions in the answer." },
  { name: "Information Gap Analyzer", icon: HelpCircle, description: "Identifies missing information critical to the answer." },
  { name: "Critic", icon: ShieldAlert, description: "Evaluates logic, evidence quality, and identifies gaps." },
  { name: "Devil's Advocate", icon: AlertTriangle, description: "Generates counterarguments and challenges assumptions." },
  { name: "Premortem Analyzer", icon: Activity, description: "Analyzes potential failure modes of the proposed answer." },
  { name: "Synthesis Agent", icon: Brain, description: "Synthesizes all analyses into a final insight." },
];

export default function CriticalInsightsPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [results, setResults] = useState<FullAnalysisResults | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("initial-response");

  const handleAnalyze = async () => {
    if (!query.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter a question to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setStatusText('Kicking off analysis pipeline...');
    setResults(null);
    setActiveTab("initial-response"); 

    const totalSteps = agentInfo.length;
    let completedSteps = 0;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) { 
          return prev;
        }
        // Simulate progress more realistically based on typical agent completion
        const increment = Math.random() * (90 / totalSteps / 2) + (90 / totalSteps / 3);
        return Math.min(prev + increment, 90);
      });
       // Update status text based on which agent might be running
      if (completedSteps < totalSteps) {
          const currentAgent = agentInfo[completedSteps % totalSteps];
          setStatusText(`Processing: ${currentAgent.name}...`);
      }
      completedSteps++;

    }, 600); // Faster interval for more granular progress/status


    try {
      const analysisResults = await runAnalysisPipelineAction(query);
      clearInterval(interval);
      setResults(analysisResults);
      setProgress(100);
      setStatusText('✅ Analysis complete!');
      toast({
        title: "Analysis Complete",
        description: "Results are now available in the tabs below.",
      });
      if (analysisResults.synthesis && analysisResults.synthesis.summary !== "Final synthesis could not be generated.") {
        setActiveTab("final-synthesis");
      }
    } catch (error: any) {
      clearInterval(interval);
      console.error("Analysis error:", error);
      setProgress(100); 
      const errorMessage = error.message || 'An unexpected error occurred.';
      setStatusText(`❌ Error: ${errorMessage.length > 100 ? errorMessage.substring(0,100) + "..." : errorMessage}`);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const getEvidenceQualityClass = (quality: string) => {
    if (quality.toLowerCase() === 'high') return 'evidence-high';
    if (quality.toLowerCase() === 'moderate') return 'evidence-moderate';
    if (quality.toLowerCase() === 'low') return 'evidence-low';
    return 'bg-muted';
  };

  const getRiskColor = (riskOrImpact: string) => {
    const lowerVal = riskOrImpact.toLowerCase();
    if (lowerVal === "high") return "text-red-500";
    if (lowerVal === "medium") return "text-yellow-500";
    if (lowerVal === "low") return "text-green-500";
    return "text-gray-500";
  };

  const renderEvidenceList = (evidenceList: Evidence[] | undefined, listTitle: string, icon?: React.ElementType) => {
    const IconComponent = icon;
    if (!evidenceList || evidenceList.length === 0) {
      return (
        <>
          {IconComponent && <IconComponent className="mr-2 h-5 w-5 text-muted-foreground" />}
          <p className="text-muted-foreground">No {listTitle.toLowerCase()} found or the respective agent did not return data.</p>
        </>
      );
    }
    return evidenceList.map((ev, index) => (
      <Card key={`${listTitle}-${index}`} className={`mb-4 ${getEvidenceQualityClass(ev.quality)}`}>
        <CardHeader>
          <CardTitle className="text-lg">Evidence for: {ev.claim || "General Claim"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p><strong>Support/Details:</strong> {ev.support}</p>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <p><strong>Quality:</strong> <Badge variant={ev.quality === 'high' ? 'default' : ev.quality === 'moderate' ? 'secondary' : 'destructive'} className="mr-1">{ev.quality}</Badge> | <strong>Source:</strong> {ev.source}</p>
        </CardFooter>
      </Card>
    ));
  };

  const renderPremortemFailures = (failures: PremortermItem[] | undefined) => {
    if (!failures || failures.length === 0) {
      return <p className="text-muted-foreground">No potential failures identified or premortem agent did not run/return data.</p>;
    }
    return (
      <Accordion type="single" collapsible className="w-full">
        {failures.map((item, index) => (
          <AccordionItem value={`item-${index}`} key={index}>
            <AccordionTrigger className="text-base hover:no-underline">
              <div className="flex items-center">
                <span className={`mr-2 ${getRiskColor(item.probability)}`}>
                  {item.probability.toLowerCase().includes('high') ? '🔴' : item.probability.toLowerCase().includes('moderate') ? '🟡' : '🟢'}
                </span>
                {item.failure} <span className="ml-2 text-xs text-muted-foreground">({item.probability})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              <strong>Mitigation:</strong> {item.mitigation}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const renderAssumptions = (assumptions: AssumptionItem[] | undefined) => {
    if (!assumptions || assumptions.length === 0) {
      return <p className="text-muted-foreground">No hidden assumptions identified or assumption analyzer did not run/return data.</p>;
    }
    return assumptions.map((item, index) => (
      <Card key={index} className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <span className={`mr-2 ${getRiskColor(item.risk)}`}>
              {item.risk.toLowerCase() === "high" ? '🔴' : item.risk.toLowerCase() === "medium" ? '🟡' : '🟢'}
            </span>
            Assumption {index + 1}
          </CardTitle>
          <CardDescription>{item.assumption}</CardDescription>
        </CardHeader>
        <CardContent>
          <p><strong>Risk Level:</strong> <span className={getRiskColor(item.risk)}>{item.risk}</span></p>
          <p><strong>Alternative Perspective:</strong> {item.alternative}</p>
        </CardContent>
      </Card>
    ));
  };

  const renderInformationGaps = (gaps: InformationGapItem[] | undefined) => {
    if (!gaps || gaps.length === 0) {
      return (
         <Alert variant="default" className="border-accent/50">
            <Info className="h-4 w-4 text-accent" />
            <AlertTitle>No Information Gaps Identified</AlertTitle>
            <AlertDescription>
              The Information Gap Analyzer did not identify any critical missing pieces of information or did not return data.
            </AlertDescription>
          </Alert>
      );
    }
    return (
      <Accordion type="single" collapsible className="w-full">
        {gaps.map((item, index) => (
          <AccordionItem value={`gap-${index}`} key={index}>
            <AccordionTrigger className="text-base hover:no-underline">
              <div className="flex items-center">
                <span className={`mr-2 ${getRiskColor(item.impact)}`}>
                  {item.impact.toLowerCase() === "high" ? '🔴' : item.impact.toLowerCase() === "medium" ? '🟡' : '🟢'}
                </span>
                {item.gap}
                <span className="ml-2 text-xs text-muted-foreground">(Impact: {item.impact})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              This information gap, if addressed, could {item.impact.toLowerCase()}ly affect the understanding or validity of the answer.
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const renderSynthesis = (synthesis: SynthesisAgentOutput | undefined) => {
    if (!synthesis || synthesis.summary === "Final synthesis could not be generated." || synthesis.summary === "Synthesis could not be fully generated due to processing issues. The analysis may be incomplete.") {
      return (
        <Alert variant="default" className="border-accent text-accent-foreground">
          <Info className="h-4 w-4 text-accent" />
          <AlertTitle className="text-accent-foreground">Synthesis Not Available</AlertTitle>
          <AlertDescription className="text-accent-foreground/80">
            The final AI-driven synthesis could not be generated.
            {synthesis?.summary && synthesis.summary !== "Final synthesis could not be generated." && <p className="mt-2">Agent note: {synthesis.summary}</p>}
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-primary" />
              Overall Synthesis & Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2"><strong>Confidence Level:</strong> <Badge variant={synthesis.confidence.toLowerCase() === 'high' ? 'default' : synthesis.confidence.toLowerCase() === 'medium' ? 'secondary' : 'destructive'}>{synthesis.confidence}</Badge></p>
            <p className="prose prose-sm max-w-none dark:prose-invert">{synthesis.summary}</p>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center"><ThumbsUp className="mr-2 h-5 w-5 text-green-500" />Key Strengths</CardTitle></CardHeader>
            <CardContent>
              {synthesis.keyStrengths.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {synthesis.keyStrengths.map((item, i) => <li key={`strength-${i}`}>{item}</li>)}
                </ul>
              ) : <p className="text-muted-foreground text-sm">No specific strengths highlighted.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center"><ThumbsDown className="mr-2 h-5 w-5 text-red-500" />Key Weaknesses / Risks</CardTitle></CardHeader>
            <CardContent>
              {synthesis.keyWeaknesses.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {synthesis.keyWeaknesses.map((item, i) => <li key={`weakness-${i}`}>{item}</li>)}
                </ul>
              ) : <p className="text-muted-foreground text-sm">No specific weaknesses highlighted.</p>}
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader><CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-blue-500" />Actionable Recommendations</CardTitle></CardHeader>
          <CardContent>
            {synthesis.actionableRecommendations.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {synthesis.actionableRecommendations.map((item, i) => <li key={`recommendation-${i}`}>{item}</li>)}
              </ul>
            ) : <p className="text-muted-foreground text-sm">No specific recommendations provided.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center"><EyeOff className="mr-2 h-5 w-5 text-yellow-500" />Remaining Uncertainties / Gaps</CardTitle></CardHeader>
          <CardContent>
             {synthesis.remainingUncertainties.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {synthesis.remainingUncertainties.map((item, i) => <li key={`uncertainty-${i}`}>{item}</li>)}
                </ul>
              ) : <p className="text-muted-foreground text-sm">No specific uncertainties highlighted.</p>}
          </CardContent>
        </Card>
      </div>
    );
  };


  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="fixed left-0 top-0 z-10 hidden h-screen w-72 flex-col border-r bg-sidebar p-4 shadow-md md:flex">
        <h2 className="mb-2 text-xl font-semibold text-sidebar-foreground flex items-center">
          <Sigma size={24} className="mr-2 text-sidebar-primary" /> Critical Insights AI
        </h2>
        <p className="mb-4 text-xs text-sidebar-foreground/80">Multi-Agent Analysis System</p>
        <div className="mb-4 h-px bg-sidebar-border"></div>
        <h3 className="mb-3 text-sm font-medium text-sidebar-foreground">Active Agents</h3>
        <div className="space-y-3 overflow-y-auto pr-2 flex-grow">
          {agentInfo.map(agent => (
            <div key={agent.name} className="flex items-start p-2 rounded-md hover:bg-sidebar-accent/10 transition-colors">
              <agent.icon size={20} className="mr-3 mt-1 text-sidebar-primary shrink-0" />
              <div>
                <p className="text-xs font-semibold text-sidebar-foreground">{agent.name}</p>
                <p className="text-xs text-sidebar-foreground/70">{agent.description}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex flex-1 flex-col p-6 md:ml-72">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-primary">Critical Thinking Analysis</h1>
          <p className="text-muted-foreground">Enter a query and let the AI agents dissect it.</p>
        </header>

        <Card className="mb-6 shadow-lg">
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Example: What are the main benefits and drawbacks of remote work for software companies?"
                className="h-24 md:col-span-2 text-base"
                disabled={isLoading}
              />
              <Button
                onClick={handleAnalyze}
                disabled={isLoading || !query.trim()}
                className="h-24 text-lg md:col-span-1"
                size="lg"
              >
                {isLoading ? 'Analyzing...' : '🔍 Analyze Query'}
              </Button>
            </div>
            {isLoading && (
              <div className="mt-4">
                <Progress value={progress} className="w-full" />
                <p className="mt-2 text-sm text-center text-muted-foreground">{statusText}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {results && !isLoading && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 mb-4">
              <TabsTrigger value="initial-response">Initial Response</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="critical-analysis">Critical Analysis</TabsTrigger>
              <TabsTrigger value="risk-analysis">Risk Analysis</TabsTrigger>
              <TabsTrigger value="assumptions-gaps">Assumptions & Gaps</TabsTrigger>
              <TabsTrigger value="final-synthesis">Synthesis</TabsTrigger>
              <TabsTrigger value="agent-comms">Orchestrator Log</TabsTrigger>
            </TabsList>

            <TabsContent value="initial-response">
              <Card className="shadow-md">
                <CardHeader><CardTitle>📝 Initial Response</CardTitle></CardHeader>
                <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                  {results.initialAnswer?.answer && results.initialAnswer.answer !== "Initial answer generation failed." ? 
                    <p>{results.initialAnswer.answer}</p> : 
                    <p className="text-muted-foreground">No initial response generated or an error occurred.</p>
                  }
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evidence">
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Search className="mr-2 h-5 w-5 text-green-500" /> Supporting Evidence
                  </CardTitle>
                </CardHeader>
                <CardContent>{renderEvidenceList(results.research, "Supporting Evidence")}</CardContent>
                
                <CardHeader className="mt-6 pt-6 border-t">
                  <CardTitle className="flex items-center">
                    <SearchX className="mr-2 h-5 w-5 text-destructive" /> Counter-Evidence / Alternative Perspectives
                  </CardTitle>
                </CardHeader>
                <CardContent>{renderEvidenceList(results.counterEvidence, "Counter-Evidence")}</CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="critical-analysis">
              <Card className="mb-6 shadow-md">
                <CardHeader><CardTitle>🧐 Critical Analysis</CardTitle></CardHeader>
                <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                  {results.critique && results.critique !== "Critique generation failed." ? 
                    <p>{results.critique}</p> : 
                    <p className="text-muted-foreground">No critique generated or an error occurred.</p>
                  }
                </CardContent>
              </Card>
              <Card className="shadow-md">
                <CardHeader><CardTitle>😈 Devil's Advocate Challenges</CardTitle></CardHeader>
                <CardContent>
                  {results.challenges && results.challenges.length > 0 ? (
                    results.challenges.map((challenge, index) => (
                      <Alert key={index} variant="destructive" className="mb-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Challenge {index + 1}</AlertTitle>
                        <AlertDescription>{challenge}</AlertDescription>
                      </Alert>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No counterarguments generated or an error occurred.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risk-analysis">
              <Card className="shadow-md">
                <CardHeader><CardTitle>⚠️ Premortem Analysis - Potential Failure Modes</CardTitle></CardHeader>
                <CardContent>{renderPremortemFailures(results.premortemAnalysis)}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assumptions-gaps">
              <Card className="mb-6 shadow-md">
                <CardHeader><CardTitle>💭 Hidden Assumptions</CardTitle></CardHeader>
                <CardContent>{renderAssumptions(results.assumptions)}</CardContent>
              </Card>
              <Card className="shadow-md">
                <CardHeader><CardTitle>🧩 Information Gaps</CardTitle></CardHeader>
                <CardContent>{renderInformationGaps(results.informationGaps)}</CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="final-synthesis">
              <Card className="shadow-md">
                <CardHeader><CardTitle>🎯 Final Synthesis</CardTitle></CardHeader>
                <CardContent>{renderSynthesis(results.synthesis)}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agent-comms">
              <Card className="shadow-md">
                <CardHeader><CardTitle>📡 Orchestrator Log</CardTitle></CardHeader>
                <CardContent>
                  {results.orchestrationSummary ? (
                    <div className="space-y-2 text-xs font-mono max-h-96 overflow-y-auto p-2 bg-muted rounded-md whitespace-pre-wrap">
                      {results.orchestrationSummary}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No orchestration summary available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
