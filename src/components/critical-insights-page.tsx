"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { runAnalysisPipelineAction, FullAnalysisResults, AgentCommunicationLogEntry } from '@/app/actions';
import type { Evidence } from '@/ai/flows/researcher-agent';
import type { PremortermItem } from '@/ai/flows/premortem-agent';
import type { AnalyzeAssumptionsOutput } from '@/ai/flows/assumption-analyzer-agent';

import {
  MessageSquare,
  Search,
  ShieldAlert,
  AlertTriangle, // Used for Devil's Advocate
  Activity, // Used for Premortem
  Lightbulb,
  Puzzle,
  Brain,
  ChevronRight,
  Info,
  Sigma
} from 'lucide-react';

const agentInfo = [
  { name: "Responder", icon: MessageSquare, description: "Generates initial comprehensive answer." },
  { name: "Researcher", icon: Search, description: "Finds and evaluates supporting evidence." },
  { name: "Critic", icon: ShieldAlert, description: "Evaluates logic, evidence quality, and identifies gaps." },
  { name: "Devil's Advocate", icon: AlertTriangle, description: "Generates counterarguments and challenges assumptions." },
  { name: "Premortem Analyzer", icon: Activity, description: "Analyzes potential failure modes of the proposed answer." },
  { name: "Assumption Analyzer", icon: Lightbulb, description: "Identifies hidden assumptions in the answer." },
  { name: "Information Gap Analyzer", icon: Puzzle, description: "Identifies missing information critical to the answer. (Genkit flow pending)" },
  { name: "Synthesis Agent", icon: Brain, description: "Synthesizes all analyses into a final insight. (Genkit flow pending)" },
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
    setActiveTab("initial-response"); // Reset to first tab

    // Simulate initial progress before server action call
    await new Promise(resolve => setTimeout(resolve, 100));
    setProgress(10); // Initial small progress
    setStatusText('Sending query to agents...');

    try {
      // This is a long-running action. Progress will jump after this.
      const analysisResults = await runAnalysisPipelineAction(query);
      setResults(analysisResults);
      setProgress(100);
      setStatusText('✅ Analysis complete!');
      toast({
        title: "Analysis Complete",
        description: "Results are now available in the tabs below.",
      });
    } catch (error: any) {
      console.error("Analysis error:", error);
      setProgress(100); // Mark as complete even on error to stop loading bar
      setStatusText(`❌ Error: ${error.message || 'An unexpected error occurred.'}`);
      toast({
        title: "Analysis Failed",
        description: error.message || "An unexpected error occurred during analysis.",
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

  const getRiskColor = (risk: string) => {
    const lowerRisk = risk.toLowerCase();
    if (lowerRisk === "high") return "text-red-500";
    if (lowerRisk === "medium") return "text-yellow-500";
    if (lowerRisk === "low") return "text-green-500";
    return "text-gray-500";
  };

  const renderEvidence = (evidenceList: Evidence[] | undefined) => {
    if (!evidenceList || evidenceList.length === 0) {
      return <p className="text-muted-foreground">No evidence found or researcher agent did not run.</p>;
    }
    return evidenceList.map((ev, index) => (
      <Card key={index} className={`mb-4 ${getEvidenceQualityClass(ev.quality)}`}>
        <CardHeader>
          <CardTitle className="text-lg">Evidence {index + 1}: {ev.claim}</CardTitle>
        </CardHeader>
        <CardContent>
          <p><strong>Support:</strong> {ev.support}</p>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <p><strong>Quality:</strong> {ev.quality} | <strong>Source:</strong> {ev.source}</p>
        </CardFooter>
      </Card>
    ));
  };

  const renderPremortemFailures = (failures: PremortermItem[] | undefined) => {
    if (!failures || failures.length === 0) {
      return <p className="text-muted-foreground">No potential failures identified or premortem agent did not run.</p>;
    }
    return (
      <Accordion type="single" collapsible className="w-full">
        {failures.map((item, index) => (
          <AccordionItem value={`item-${index}`} key={index}>
            <AccordionTrigger className="text-base hover:no-underline">
              <div className="flex items-center">
                <span className={`mr-2 ${item.probability.toLowerCase().includes('high') ? 'text-red-500' : item.probability.toLowerCase().includes('moderate') ? 'text-yellow-500' : 'text-green-500'}`}>
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

  const renderAssumptions = (assumptions: AnalyzeAssumptionsOutput | undefined) => {
    if (!assumptions || assumptions.length === 0) {
      return <p className="text-muted-foreground">No hidden assumptions identified or assumption analyzer agent did not run.</p>;
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
            <div key={agent.name} className="flex items-start p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors">
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
              <TabsTrigger value="agent-comms">Agent Log</TabsTrigger>
            </TabsList>

            <TabsContent value="initial-response">
              <Card className="shadow-md">
                <CardHeader><CardTitle>📝 Initial Response</CardTitle></CardHeader>
                <CardContent className="prose prose-sm max-w-none">
                  {results.initialAnswer ? <p>{results.initialAnswer}</p> : <p className="text-muted-foreground">No initial response generated.</p>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evidence">
              <Card className="shadow-md">
                <CardHeader><CardTitle>🔍 Supporting Evidence</CardTitle></CardHeader>
                <CardContent>{renderEvidence(results.evidence)}</CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="critical-analysis">
              <Card className="mb-6 shadow-md">
                <CardHeader><CardTitle>🧐 Critical Analysis</CardTitle></CardHeader>
                <CardContent className="prose prose-sm max-w-none">
                  {results.critique ? <p>{results.critique}</p> : <p className="text-muted-foreground">No critique generated.</p>}
                </CardContent>
              </Card>
              <Card className="shadow-md">
                <CardHeader><CardTitle>😈 Devil's Advocate Challenges</CardTitle></CardHeader>
                <CardContent>
                  {results.counterArguments && results.counterArguments.length > 0 ? (
                    results.counterArguments.map((challenge, index) => (
                      <Alert key={index} variant="destructive" className="mb-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Challenge {index + 1}</AlertTitle>
                        <AlertDescription>{challenge}</AlertDescription>
                      </Alert>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No counterarguments generated.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risk-analysis">
              <Card className="shadow-md">
                <CardHeader><CardTitle>⚠️ Premortem Analysis - Potential Failure Modes</CardTitle></CardHeader>
                <CardContent>{renderPremortemFailures(results.premortermFailures)}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assumptions-gaps">
              <Card className="mb-6 shadow-md">
                <CardHeader><CardTitle>💭 Hidden Assumptions</CardTitle></CardHeader>
                <CardContent>{renderAssumptions(results.assumptions)}</CardContent>
              </Card>
              <Card className="shadow-md">
                <CardHeader><CardTitle>🧩 Information Gaps</CardTitle></CardHeader>
                <CardContent>
                  <Alert variant="default" className="border-accent text-accent-foreground">
                    <Info className="h-4 w-4 text-accent" />
                    <AlertTitle className="text-accent-foreground">Feature Pending</AlertTitle>
                    <AlertDescription className="text-accent-foreground/80">
                      Identifying information gaps requires a specific Genkit AI flow ('InformationGapAgent') which is not currently available in the provided `src/ai/flows`.
                      This section would normally list critical pieces of missing information.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="final-synthesis">
              <Card className="shadow-md">
                <CardHeader><CardTitle>🎯 Final Synthesis</CardTitle></CardHeader>
                <CardContent>
                  <Alert variant="default" className="mb-6 border-accent text-accent-foreground">
                     <Info className="h-4 w-4 text-accent" />
                    <AlertTitle className="text-accent-foreground">Feature Pending</AlertTitle>
                    <AlertDescription className="text-accent-foreground/80">
                      A comprehensive AI-driven synthesis requires a specific Genkit AI flow ('SynthesisAgent') which is not currently available in `src/ai/flows`.
                      Below is a summary of key metrics from the analysis. A full synthesis would provide deeper insights on confidence, best/least supported aspects, key nuances, and conditions where the advice might be wrong.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="metric-card p-4 rounded-lg shadow">
                      <p className="text-sm text-muted-foreground">Initial Answer Word Count</p>
                      <p className="text-2xl font-bold">{results.initialAnswer?.split(' ').length || 0}</p>
                    </div>
                    <div className="metric-card p-4 rounded-lg shadow">
                      <p className="text-sm text-muted-foreground">Evidence Pieces Found</p>
                      <p className="text-2xl font-bold">{results.evidence?.length || 0}</p>
                    </div>
                    <div className="metric-card p-4 rounded-lg shadow">
                      <p className="text-sm text-muted-foreground">Counterarguments</p>
                      <p className="text-2xl font-bold">{results.counterArguments?.length || 0}</p>
                    </div>
                    <div className="metric-card p-4 rounded-lg shadow">
                      <p className="text-sm text-muted-foreground">Potential Failures</p>
                      <p className="text-2xl font-bold">{results.premortermFailures?.length || 0}</p>
                    </div>
                    <div className="metric-card p-4 rounded-lg shadow">
                      <p className="text-sm text-muted-foreground">Assumptions Identified</p>
                      <p className="text-2xl font-bold">{results.assumptions?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agent-comms">
              <Card className="shadow-md">
                <CardHeader><CardTitle>📡 Agent Communication Log</CardTitle></CardHeader>
                <CardContent>
                  {results.communicationLog && results.communicationLog.length > 0 ? (
                    <div className="space-y-2 text-xs font-mono max-h-96 overflow-y-auto p-2 bg-muted rounded-md">
                      {results.communicationLog.map((log, index) => (
                        <p key={index}>
                          <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                          <span className="text-primary font-semibold">{log.agent}</span>: {log.action}
                          {log.details && <span className="text-muted-foreground/70"> - {log.details}</span>}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No communication log available.</p>
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
