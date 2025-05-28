# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Agent Framework Overview

This project implements a multi-agent AI framework where several specialized AI agents collaborate to analyze a user's query and provide a comprehensive, critically-evaluated response. The framework leverages Genkit for defining AI flows, prompts, and managing interactions between agents. Each agent has a specific role, contributing to a structured analysis pipeline.

### Specialized Agents

The framework consists of the following specialized agents:

*   **Responder Agent (`responder-agent.ts`)**: Provides an initial, direct answer to the user's query.
*   **Assumption Analyzer Agent (`assumption-analyzer-agent.ts`)**: Identifies hidden assumptions within the Responder Agent's answer.
*   **Researcher Agent (`researcher-agent.ts`)**: Gathers supporting evidence for the claims made in the Responder Agent's answer.
*   **Critic Agent (`critic-agent.ts`)**: Critically evaluates the Responder Agent's answer and the evidence provided by the Researcher Agent.
*   **Devil's Advocate Agent (`devils-advocate-agent.ts`)**: Challenges the initial answer and critique by generating counterarguments.
*   **Premortem Agent (`premortem-agent.ts`)**: Analyzes the initial answer to identify potential failure modes and suggests mitigation strategies.

### Orchestrator Agent (`orchestrator-agent.ts`)

The `orchestrator-agent.ts` is the central component that manages the overall workflow of the agent-to-agent analysis. Its key responsibilities include:

*   **Sequencing Agent Calls**: It invokes the specialized agents in a predefined order:
    1.  User Query is passed to the `Responder Agent`.
    2.  The `Responder Agent`'s output is passed to the `Assumption Analyzer Agent`, `Researcher Agent`, and `Premortem Agent`.
    3.  The `Responder Agent`'s output and `Researcher Agent`'s findings are passed to the `Critic Agent`.
    4.  The `Responder Agent`'s output and `Critic Agent`'s critique are passed to the `Devil's Advocate Agent`.
*   **Data Aggregation**: It collects the outputs from all specialized agents and compiles them into a single, comprehensive `OrchestratorOutput` object. This object includes the initial answer, identified assumptions, research findings, critique, counterarguments, and premortem analysis.
*   **Error Handling**: The orchestrator is designed to handle failures gracefully. If the critical `Responder Agent` fails, the process halts. For failures in other, non-critical specialized agents, the orchestrator logs the error and continues the process, ensuring that partial results are still returned. The final output indicates which parts of the analysis might be missing due to such failures.

### Overall Flow of Analysis

The end-to-end analysis process is as follows:

1.  A user submits a query.
2.  The `Orchestrator Agent` receives the query and initiates the analysis pipeline.
3.  It first calls the `Responder Agent` to get an initial answer.
4.  Subsequent specialized agents (Assumption Analyzer, Researcher, Critic, Devil's Advocate, Premortem) are called in sequence, each building upon or critically examining the outputs of previous agents.
5.  The `Orchestrator Agent` gathers all findings.
6.  Finally, the orchestrator returns a structured output that includes the initial answer and the analytical contributions from all participating agents, along with a summary of the process.
