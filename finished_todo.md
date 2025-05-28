# Ravint22 ADK Multi-Agent Workflow Enhancement Plan: TODO

This document outlines the tasks required to integrate 25 enhancements and fixes into the existing Ravint22 codebase, transforming it into a more robust, flexible, and analytically sound multi-agent system using Google's ADK. The goal is to clearly define what needs to change, how, and why, enabling an AI coder to implement these modifications effectively.

---
## I. Overarching Architectural Changes

### 1. Implement `MasterOrchestratorAgent`
   - **What:** Create a new central agent (e.g., `master-orchestrator-agent.ts`) that will manage the main phases of the workflow. This agent will likely be a `SequentialAgent` or a `CustomAgent` if more complex control flow is needed.
   - **How:**
     - Define the sequence of phases (Query Intake, Evidence Gathering, In-Depth Analysis, Pre-Synthesis, Synthesis, Human Review) as steps or sub-agents within this orchestrator.
     - Integrate the `ErrorHandlingAndRecoveryCoordinator` logic (E15) directly into this agent's execution flow for managing sub-agent calls.
   - **Why:** To provide a clear, centralized control point for the entire analytical process, improving modularity and manageability. To embed robust error handling at the highest level[cite: 79, 83].
   - **Changes from Ravint22:** This will likely replace the existing top-level orchestration logic in `orchestrator-agent.ts` or `orchestrateQueryFlow`.

### 2. Standardize State Management
   - **What:** Ensure all inter-agent data passing relies consistently on `session.state`.
   - **How:**
     - Review all existing and new agents to ensure their inputs are read from and outputs are written to `session.state` using clearly defined keys.
     - Define standardized schemas (e.g., using Zod) for complex objects stored in `session.state` to ensure consistency.
   - **Why:** To create a transparent and reliable way for agents to share information and maintain context throughout the workflow[cite: 74].

---
## II. System-Wide Foundational Enhancements (Phase 0 Implementation)

These tasks involve setting up practices and features that apply across multiple agents or the entire system.

### 1. Integrate Error Handling & Recovery (E15 & F10)
   - **What:** Implement the `ErrorHandlingAndRecoveryCoordinator` logic within the `MasterOrchestratorAgent`.
   - **How:**
     - For each agent/sub-workflow called by the `MasterOrchestratorAgent`:
       - Wrap the call in a `try-catch` block.
       - Upon error or detection of default/failure output values (from `session.state`), log the error.
       - Implement strategies like `check_previous_result`[cite: 82, 148]:
         - Attempt retries with original or modified parameters.
         - Call a designated backup agent (if applicable for that step).
         - If critical failures persist, prepare data and escalate to the `HumanReviewTool` (E10).
       - Aggregate `errorsEncounteredInfo` and pass this structured error report to subsequent agents, especially the `SynthesisEnsemble`[cite: 141, 143, 144]. The `SynthesisEnsemble`'s prompt will be modified to explicitly handle these error reports, explaining which analyses failed and how this impacts confidence[cite: 145, 146].
   - **Why:** To make the workflow resilient to partial failures, ensuring that it can recover, provide partial results, or escalate appropriately, rather than failing entirely[cite: 79, 83, 84]. To address potential "default output" contamination in the final synthesis[cite: 140, 141, 142].
   - **Changes from Ravint22:** Enhances the existing `callAgent` helper's `try-catch` by adding more sophisticated recovery and aggregation logic.

### 2. Implement Enhanced Tool Use Auditing & Control (E8)
   - **What:** Apply `before_tool_callback` and `after_tool_callback` to all relevant `LlmAgent`s.
   - **How:**
     - Identify all existing and new `LlmAgent`s that use tools (e.g., `QueryRefinementAgent`, new Researcher sub-agents, `FactVerificationAgent`).
     - For each:
       - Implement `before_tool_callback` [cite: 46] to:
         - Log the exact queries/inputs being sent to tools.
         - Optionally, validate or sanitize tool inputs.
       - Implement `after_tool_callback` [cite: 47] to:
         - Log raw results from tools.
         - Check for tool-specific errors.
         - Optionally, cache results for frequently used tools with identical inputs.
       - Ensure callbacks use the `ToolContext` [cite: 48, 127] if they need to interact with `session.state`.
   - **Why:** To increase transparency in tool operations, improve robustness by catching tool errors early, and potentially enhance efficiency through caching[cite: 48].
   - **Changes from Ravint22:** Adds new callback registrations to existing and new tool-using agents.

### 3. Establish Structured Evaluation Practices (E9 & F4 Part 2)
   - **What:** Set up ADK's built-in evaluation capabilities.
   - **How:**
     - For each key agent (especially new specialized agents like `BiasDetectionAgent`, `ConfidenceScoringAgent`, etc.) and for the end-to-end workflow:
       - Create `evaluation.test.json` files[cite: 51].
       - Define evaluation cases with:
         - Sample user queries/inputs.
         - Expected intermediate tool uses (if applicable).
         - Expected intermediate agent responses.
         - Expected final responses/outputs[cite: 52].
     - Integrate `AgentEvaluator.evaluate()` [cite: 53] into a testing script or CI/CD pipeline.
   - **Why:** To ensure analytical rigor, detect regressions when agent instructions or models are updated, and provide a quantitative way to measure improvements in accuracy, bias reduction, and clarity over time[cite: 50, 54, 112].
   - **Changes from Ravint22:** Introduces a new testing and evaluation framework alongside the existing codebase.

### 4. Implement Structured Logging/Artifacts (F8 Part 2)
   - **What:** Ensure all agents save their detailed outputs as ADK artifacts.
   - **How:**
     - For every agent in the workflow (existing and new):
       - At the end of its execution, use `context.save_artifact("artifact_name.json", agent_output_data)` to save its complete, detailed output (not just the data passed to `session.state`). The artifact name should be unique and identifiable.
   - **Why:** To create a comprehensive audit trail for the entire analytical process and to make detailed data available for cross-checking by specialized agents like `NuancePreservationCheckAgent` [cite: 133] or for human review.
   - **Changes from Ravint22:** Adds `context.save_artifact` calls to all agents.

### 5. Strengthen `CritiqueAgent` Instructions (F1 Part 2)
   - **What:** Enhance the prompts of all critique-style agents.
   - **How:**
     - Identify all agents that perform a critique function (this includes the new `QuickCritiqueAgent` in E4, any existing primary `CritiqueAgent` from Ravint22, and the new `SynthesisCritiqueAgent` in F9).
     - Modify their `instruction` prompts to:
       - Explicitly task them with identifying and highlighting specific cognitive biases (e.g., "Consider if anchoring bias is present due to X," "Evaluate for confirmation bias in the evidence selection").
       - Emphasize the importance of looking for biases passed from upstream agents or present in the provided inputs[cite: 89, 90].
       - Potentially suggest specific techniques for bias identification.
   - **Why:** To make bias detection a more active and consistent part of the critique process throughout the workflow[cite: 90, 91].
   - **Changes from Ravint22:** Modifies the instruction strings for existing critique agents and sets a standard for new ones.

---
## III. Phased Workflow Implementation

The `MasterOrchestratorAgent` will execute these phases sequentially.

### Phase 1: Query Intake & Initial Answer Formulation

#### 1.1. Create `QueryRefinementAgent` (E1)
   - **File:** e.g., `query-refinement-agent.ts`
   - **Type:** `LlmAgent` with `tools`.
   - **Functionality:**
     - Input: User's initial query from `session.state`.
     - Define and implement two custom `FunctionTool`s:
       - `QuestionClassifierTool`: Analyzes the query to identify ambiguity, vagueness, or embedded assumptions[cite: 3].
       - `ScopeCheckTool`: Assesses if the query's scope is too broad or too narrow[cite: 4].
     - The agent's `instruction` will guide it to use these tools to interact with the user (or simulate interaction) to clarify the query.
     - Output: A refined, unbiased, and well-defined question written to `session.state.refinedQuery`.
   - **Why:** To ensure the entire downstream process operates on a clear and actionable question, improving accuracy and relevance[cite: 2, 5].
   - **Changes from Ravint22:** Introduces a new agent at the beginning of the workflow. The `ResponderAgent` (or equivalent) will now consume `refinedQuery`.

#### 1.2. Implement `InitialAnswerGenerationLoop` (E4)
   - **File:** e.g., `initial-answer-loop-agent.ts` (this will be a `LoopAgent` definition)
   - **Type:** `LoopAgent`.
   - **Functionality:**
     - Input: `session.state.refinedQuery`.
     - Configure the `LoopAgent` [cite: 19, 21] with:
       - `GeneratorAgent`: An `LlmAgent` (this could be your existing `ResponderAgent` from Ravint22, adapted to take `refinedQuery`). Its purpose is to generate an `initialAnswerText`[cite: 20, 22].
       - `QuickCritiqueAgent`: A new, lightweight `LlmAgent` designed for rapid feedback on the `initialAnswerText`. Its `instruction` should focus on clarity, directness, and obvious flaws[cite: 20, 22].
     - The loop should continue for `max_iterations` or until the `QuickCritiqueAgent` signals satisfaction (e.g., by returning an event with `escalate=True` in its output, which the `LoopAgent`'s `exit_condition` function can check)[cite: 23].
     - Intermediate states (current answer, critique) managed within the loop via `session.state` or internal loop state variables[cite: 24].
     - Output: `session.state.initialAnswerText` (the refined version).
   - **Why:** To improve the quality of the initial answer early, potentially reducing downstream workload and error severity[cite: 24].
   - **Changes from Ravint22:** Wraps the `ResponderAgent` (or its equivalent) in a new `LoopAgent` with a new `QuickCritiqueAgent`.

---
### Phase 2: Evidence Gathering & Multi-Perspective Analysis

This phase will be orchestrated by the `MasterOrchestratorAgent`, which might call the `DynamicRoutingCoordinatorAgent` (E3) if implemented, or directly manage the sequence/parallel execution of the agents below.

#### 2.1. Create `DynamicRoutingCoordinatorAgent` (E3) (Optional but Recommended)
   - **File:** e.g., `dynamic-routing-coordinator-agent.ts`
   - **Type:** `LlmAgent` with `AgentTool`.
   - **Functionality:**
     - Input: `session.state.refinedQuery`, `session.state.initialAnswerText`.
     - The agent's `instruction` will be to analyze the inputs and decide which subsequent analytical specialist agents (e.g., `AnalyzeAssumptionsAgent`, `InformationGapAgent`, `ResearcherEnsemble`) to call, and potentially in what order or if some can be skipped[cite: 13, 15].
     - Uses `AgentTool` to invoke these specialist agents. For instance, if the `initialAnswerText` is highly speculative, it might prioritize `AnalyzeAssumptionsAgent` and `InformationGapAgent`[cite: 16].
     - Specialist agents invoked will read their specific inputs from and write their outputs to `session.state`.
   - **Why:** Adds flexibility and efficiency by tailoring the analytical process to the problem's characteristics, potentially saving resources[cite: 17].
   - **Changes from Ravint22:** If your current `orchestrateQueryFlow` calls a fixed set of analytical agents (like `Promise.all` for assumptions, research, etc.), this agent would replace that static block with dynamic, LLM-driven decision-making[cite: 18].

#### 2.2. Implement `ResearcherEnsemble` (Combines E5 & E11)
   - **Refactor `ResearcherAgent` & `CounterEvidenceResearcherAgent` (E5):**
     - **Files:** Modify existing researcher agent files or create new ones if significantly different (e.g., `parallel-researcher-agent.ts`).
     - **Type:** Convert existing researcher agents into `ParallelAgent`s[cite: 26, 41].
     - **Functionality:**
       - Each `ParallelAgent` (one for supporting evidence, one for counter-evidence) will have `sub_agents`[cite: 27, 46].
       - These sub-agents will be `LlmAgent`s, each specialized for a particular data source or search methodology (e.g., `AcademicSearchAgent`, `NewsSearchAgent`, `InternalDocsSearchAgent`).
       - Each sub-agent uses appropriate tools (e.g., `GoogleSearchTool`[cite: 28, 123], or custom tools for specific databases/APIs).
       - Results from sub-agents are written to `session.state` with distinct keys for later aggregation (e.g., `session.state.academicSearchResults`, `session.state.newsSearchResults`)[cite: 29, 74]. The main `ParallelAgent` will then aggregate these into the final `ResearchEvidenceOutputSchema` or `ResearchCounterEvidenceOutputSchema`[cite: 31].
   - **Integrate `DynamicToolSelectionAgent` logic (E11) within each researcher sub-agent:**
     - **Functionality:** For each specialized researcher sub-agent (e.g., `AcademicSearchAgent`), its `LlmAgent` `instruction` will be enhanced to dynamically choose the most appropriate tool from a provided `Toolset` based on the specific research sub-task it's handling.
     - **ADK Leverage:** Define and use `Toolsets` (e.g., `GoogleSearchToolset` containing `GoogleSearchTool`[cite: 64, 123], `VertexAiSearchToolset` containing `VertexAiSearchTool`[cite: 64], or custom `MCPToolset`s [cite: 64, 148]).
   - **Why (E5):** To speed up evidence gathering and allow for more specialized and effective search strategies[cite: 30].
   - **Why (E11):** To optimize evidence gathering for quality and relevance by selecting the best tool/data source for any given claim or research angle[cite: 65, 66].
   - **Changes from Ravint22:** Significant refactor of existing researcher agents. If they are monolithic, they will be decomposed. Introduces the concept of toolsets for more dynamic tool use.

---
### Phase 3: In-Depth Analysis, Challenge, and Bias Mitigation

#### 3.1. Create `BiasDetectionAgent` (E2)
   - **File:** e.g., `bias-detection-agent.ts`
   - **Type:** `LlmAgent`.
   - **Functionality:**
     - Input: `session.state.initialAnswerText`, `session.state.aggregatedSupportingResearch`, `session.state.aggregatedCounterResearch`.
     - `instruction` [cite: 8] will be heavily prompted with definitions, examples, and indicators of common cognitive biases (e.g., confirmation bias, availability heuristic, anchoring bias)[cite: 7].
     - The agent's task is to identify and list potential biases present in the inputs.
     - Output: `session.state.potentialBiases` (e.g., an array of objects, each detailing a bias, its location, and an explanation)[cite: 10, 12].
   - **Why:** To explicitly address and flag potential biases early in the process, enabling subsequent agents to consider and mitigate them[cite: 7, 10].
   - **Changes from Ravint22:** Introduces a new specialized agent.

#### 3.2. Create `BiasCrossReferencingAgent` (F1 Part 1)
   - **File:** e.g., `bias-cross-referencing-agent.ts`
   - **Type:** `LlmAgent`.
   - **Functionality:**
     - Input: `session.state.potentialBiases` (from E2), `session.state.initialAnswerText`, outputs from critique agents (e.g., from E4's `QuickCritiqueAgent` or other primary critique agents), `session.state.aggregatedCounterResearch`.
     - `instruction` [cite: 88] will guide the agent to compare the identified biases against the critiques and counter-evidence to:
       - Flag any biases that appear unaddressed by critiques.
       - Identify points where the initial answer or main arguments seem to contradict the bias report or ignore flagged biases.
     - Output: `session.state.crossReferencedBiasReport` (detailing unaddressed or conflicting bias issues).
   - **Why:** To ensure that identified biases are not just noted but actively considered and addressed in the analytical flow, preventing bias propagation[cite: 85, 87, 88].
   - **Changes from Ravint22:** Introduces a new specialized agent.

#### 3.3. Create `EvidenceConflictResolutionAgent` (E12)
   - **File:** e.g., `evidence-conflict-resolution-agent.ts`
   - **Type:** `LlmAgent`.
   - **Functionality:**
     - Input: `session.state.aggregatedSupportingResearch`, `session.state.aggregatedCounterResearch` (specifically, lists of `LocalEvidenceSchema` items from `session.state` [cite: 68, 74]).
     - `instruction` [cite: 68] will focus the agent on identifying pairs or sets of directly conflicting pieces of evidence.
     - The agent should attempt to explain the discrepancy, assess the relative reliability, or suggest how the conflict impacts the analysis.
     - Output: `session.state.conflictResolutionAnalysis` (e.g., a list of identified conflicts and their analyses).
   - **Why:** To help the `SynthesisAgent` more intelligently integrate or account for contradictions, improving accuracy and reducing bias from simply "louder" evidence[cite: 67, 69].
   - **Changes from Ravint22:** Introduces a new specialized agent to handle a sophisticated analytical step.

#### 3.4. Implement `IterativeRedTeamingLoop` (E6)
   - **File:** e.g., `red-teaming-loop-agent.ts` (this will be a `LoopAgent` definition)
   - **Type:** `LoopAgent`.
   - **Functionality:**
     - Input: The current main argument/answer (e.g., `session.state.initialAnswerText` or a refined version).
     - Configure the `LoopAgent` [cite: 34, 48] with:
       - `ArgumentRefinementAgent`: An `LlmAgent` (could be a modified `ResponderAgent` or a new agent focused on refining an existing argument based on challenges)[cite: 35].
       - `DevilsAdvocateAgent`: An `LlmAgent` (representing your existing `challenge` function) whose `instruction` is to critically challenge the current argument. This agent could be invoked via `AgentTool` if it's defined as a standalone callable agent.
     - The loop continues for `max_iterations` or until the challenges generated by `DevilsAdvocateAgent` become weak or are successfully rebutted by the `ArgumentRefinementAgent`[cite: 37].
     - Shared state (evolving argument, challenges) managed via `session.state`[cite: 38, 74].
     - Output: `session.state.stressTestedArgument`.
   - **Why:** To create a more robust and stress-tested final analysis by systematically attempting to find and address flaws[cite: 32, 33, 39]. This can be an optional, deeper analysis phase[cite: 40].
   - **Changes from Ravint22:** Converts a potentially single-run `DevilsAdvocateAgent` or `challenge` function into an iterative loop with an argument refinement component.

---
### Phase 4: Pre-Synthesis Structuring & Quality Assurance

#### 4.1. Create `ArgumentReconstructionAgent` (F2 Part 1)
   - **File:** e.g., `argument-reconstruction-agent.ts`
   - **Type:** `LlmAgent` or `SequentialAgent`.
   - **Functionality:**
     - Input: `session.state.initialAnswerText` (or `stressTestedArgument` if E6 ran), outputs from critique agents, `DevilsAdvocateAgent` challenges, and `session.state.aggregatedCounterResearch`.
     - Task: To generate a *neutral summary of the state of the argument* (a "balanced brief")[cite: 94, 95].
     - If an `LlmAgent`[cite: 27, 96]: `instruction` will focus on neutrality and balanced representation of all viewpoints.
     - If a `SequentialAgent`[cite: 36, 96]: It would have sub-agents to summarize the initial answer, then counter-evidence, then critiques into separate fields, which are then combined into the brief[cite: 96]. Results stored in `session.state`[cite: 74, 96].
     - Output: `session.state.balancedBrief`.
   - **Why:** To counteract anchoring bias in the `SynthesisAgent` by providing a structured, neutral starting point rather than the raw initial answer[cite: 92, 93, 95].
   - **Changes from Ravint22:** Introduces a new agent to preprocess inputs for the synthesis stage. The `SynthesisAgent` prompt will be updated to work from this `balancedBrief`[cite: 97].

#### 4.2. Create `CounterArgumentIntegrationAgent` (F3 Part 1)
   - **File:** e.g., `counter-argument-integration-agent.ts`
   - **Type:** `LlmAgent`.
   - **Functionality:**
     - Input: `session.state.balancedBrief` (from F2), `session.state.aggregatedCounterResearch`, and `DevilsAdvocateAgent` challenges.
     - `instruction` [cite: 103] will give this agent the sole task of generating a revised version of the `balancedBrief` that *explicitly incorporates or refutes* the counterarguments and challenges[cite: 100, 101, 102].
     - Output: `session.state.pressureTestedBrief`[cite: 104].
   - **Why:** To ensure that counter-evidence and challenges are deeply integrated into the main line of argument before synthesis, not just superficially acknowledged[cite: 99, 100].
   - **Changes from Ravint22:** Adds another specialized preprocessing agent before synthesis.

#### 4.3. Create `ImpactAssessmentAgent` (F6 Part 1)
   - **File:** e.g., `impact-assessment-agent.ts`
   - **Type:** `LlmAgent`.
   - **Functionality:**
     - Input: Outputs from `InformationGapAgent` (especially high-impact gaps) and `AnalyzeAssumptionsAgent` (especially high-risk assumptions).
     - `instruction` [cite: 121, 27] will guide the agent to explicitly describe the potential consequences for the overall analysis if these identified gaps remain unfilled or critical assumptions prove false[cite: 119, 120].
     - Output: `session.state.impactAssessments` (textual output).
   - **Why:** To ensure the `SynthesisAgent` doesn't just list gaps/assumptions but understands and conveys their *impact* on confidence and recommendations[cite: 118, 121].
   - **Changes from Ravint22:** Introduces a new agent to add depth to uncertainty handling. The `SynthesisAgentInputSchema` will be updated to accept this[cite: 122].

#### 4.4. Create `QualityCheckAgent` (F4 Part 1)
   - **File:** e.g., `quality-check-agent.ts`
   - **Type:** `LlmAgent` or `CustomAgent` (could also use `after_agent_callback` [cite: 110] on other agents, but a dedicated agent provides more focused logic).
   - **Functionality:**
     - Input: Outputs from key upstream analytical agents (e.g., `CritiqueAgent`, `BiasDetectionAgent`, `ResearcherEnsemble`).
     - Task: To score the quality/confidence of each upstream agent's output[cite: 108]. For example, assess if a critique is specific, actionable, and well-supported[cite: 109].
     - If an `LlmAgent`[cite: 27, 110]: `instruction` guides quality assessment based on defined criteria.
     - If a `CustomAgent`[cite: 54, 110]: Implements a rubric for scoring.
     - Quality scores saved to `session.state` (e.g., `session.state.critiqueQualityScore`)[cite: 74, 111].
   - **Why:** To prevent the `SynthesisAgent` from giving undue weight to poorly reasoned or low-quality inputs from upstream agents[cite: 106, 107]. The `SynthesisAgent` can then be instructed to weigh inputs accordingly[cite: 111].
   - **Changes from Ravint22:** Adds a new quality control agent.

#### 4.5. Create `ConfidenceScoringAgent` (E7)
   - **File:** e.g., `confidence-scoring-agent.ts`
   - **Type:** `LlmAgent` or `CustomAgent`.
   - **Functionality:**
     - Input: `session.state.pressureTestedBrief`, aggregated evidence, critiques, bias reports (E2, F1), `session.state.impactAssessments` (F6), `session.state.qualityScores` (F4).
     - Task: To evaluate all these inputs and assign an overall confidence score for the analysis, *including a detailed rationale*[cite: 41, 42].
     - If a `CustomAgent`[cite: 54]: Implements a specific scoring rubric based on evidence quality, unmitigated risks, severity of information gaps, etc.[cite: 42].
     - Output: `session.state.overallConfidence` (containing score and rationale).
   - **Why:** To provide a more transparent, auditable, and potentially objective basis for the confidence level in the final synthesis[cite: 43, 44].
   - **Changes from Ravint22:** If confidence is currently just a field in `SynthesisAgent`, this externalizes and elaborates the scoring process.

#### 4.6. Create `SensitivityAnalysisAgent` (E13)
   - **File:** e.g., `sensitivity-analysis-agent.ts`
   - **Type:** `CustomAgent` or `LlmAgent` with tools.
   - **Functionality:**
     - Input: Key assumptions (from `AnalyzeAssumptionsAgent`), key evidence, `session.state.overallConfidence`. (May be triggered if confidence is low or certain assumptions are flagged as critical and uncertain).
     - Task: To assess how robust conclusions are to changes in underlying assumptions or key pieces of evidence[cite: 70, 71].
     - If an `LlmAgent`[cite: 27, 71]: Could be instructed to re-run a simplified version of the core reasoning if an assumption (from `KeyAssumptionsCheckAgent` output, which should be part of `AnalyzeAssumptionsAgent` or a similar agent) is "flipped."
     - If a `CustomAgent`[cite: 54, 72]: Could orchestrate targeted re-evaluations by other agents (e.g., a simplified synthesis) based on modified inputs stored temporarily or fetched from `session.state`[cite: 72, 74].
     - Output: `session.state.sensitivityAnalysisReport` (describing how stable conclusions are).
   - **Why:** Adds depth to the final summary by explicitly stating the stability and limitations of the conclusions[cite: 73].
   - **Changes from Ravint22:** Introduces a new, advanced analytical agent.

---
### Phase 5: Synthesis, Verification & Refinement

#### 5.1. Implement `SynthesisEnsemble` (E14 / F7 - Merged)
   - **File:** e.g., `synthesis-ensemble-agent.ts` (this will be a `ParallelAgent` definition)
   - **This combines `MultiModelSynthesisAgent` (E14) and `Multi-PerspectiveSynthesisTechnique` (F7).**
   - **Type:** `ParallelAgent`.
   - **Functionality:**
     - Input: `session.state.pressureTestedBrief`, `session.state.impactAssessments`, `session.state.overallConfidence`, `session.state.aggregatedSupportingResearch`, `session.state.aggregatedCounterResearch`, `session.state.conflictResolutionAnalysis`, `session.state.sensitivityAnalysisReport` (if available), and the aggregated error report from the `MasterOrchestratorAgent` (E15/F10).
     - The `ParallelAgent` [cite: 41, 76, 124] will have `sub_agents` [cite: 69, 76] that are `LlmAgent`s[cite: 27, 75].
     - Each sub-agent (`SynthesizerInstanceAgent`) will be configured to produce a draft synthesis:
       - Some instances might use different LLM models (if LiteLLM [cite: 76, 125] is integrated) or different versions of the same model.
       - Other instances (or all, if using a single model) will use critically different `instruction` prompts (e.g., one emphasizing "most likely" outcome, another "worst-case," another "most optimistic but plausible," one focusing on areas of high agreement, another on areas of high disagreement)[cite: 125].
     - **Prompt Engineering (F2 Part 2):** All `SynthesizerInstanceAgent` prompts will be explicitly instructed to:
       - Give equal or appropriately weighted consideration to challenging information (counter-evidence, critiques, negative findings from specialist agents).
       - Work primarily from the `pressureTestedBrief`, incorporating `impactAssessments` and `overallConfidence` rationale directly into their synthesis[cite: 98].
     - **Handling Failures (F10 Part 2):** Prompts will include instructions on how to behave if the aggregated error report indicates significant failures in upstream data generation (e.g., "If critical inputs are missing or based on errors, state that a comprehensive synthesis is not possible and detail which analyses failed and why this impacts confidence.")[cite: 145, 146].
     - **Schema Refinement (F3 Part 2):** The output schema for each `SynthesizerInstanceAgent` (and thus for the `MetaSynthesisAgent`) must include a field like `howCounterEvidenceWasAddressed: z.array(z.string())` to force articulation on this point[cite: 105].
     - Draft syntheses from each instance are written to `session.state`[cite: 74, 77, 126].
     - A final `MetaSynthesisAgent` (another `LlmAgent`)[cite: 77, 126]:
       - Input: The diverse draft syntheses from `session.state`.
       - Task: To review these parallel drafts and produce the ultimate `SynthesisAgentOutput`. This could involve blending perspectives, selecting the most robust draft based on predefined criteria, or highlighting key differences.
     - Output: `session.state.draftSynthesisOutput` (the output of the `MetaSynthesisAgent`).
   - **Why:** To mitigate single-model bias, enhance objectivity, and produce a more robust and well-rounded final synthesis by considering multiple "perspectives" or "models"[cite: 75, 78, 123, 127].
   - **Changes from Ravint22:** Replaces a potentially single `SynthesisAgent` with a more complex parallel processing ensemble. Requires significant prompt engineering for the synthesizer instances and the meta-synthesizer.

#### 5.2. Implement `FactVerificationLoop` (F5)
   - **File:** e.g., `fact-verification-loop-agent.ts` (this will be a `LoopAgent` definition)
   - **Type:** `LoopAgent` managing a `FactVerificationAgent`.
   - **Functionality:**
     - Input: `session.state.draftSynthesisOutput`.
     - `FactVerificationAgent` (sub-agent of the loop):
       - **Type:** `LlmAgent` with `tools`.
       - **Task:** To extract key factual claims, statistics, or crucial pieces of information from the `draftSynthesisOutput` (especially from summary and actionable recommendations sections)[cite: 114].
       - **ADK Leverage:** Uses tools like `GoogleSearchTool` [cite: 115, 123] or custom `FunctionTool`s [cite: 115] to verify these claims against external sources or the original evidence base loaded from `session.state` (or artifacts)[cite: 115, 74].
       - Output: A list of verified claims and a list of identified inaccuracies/unverified claims.
     - **Loop Logic (F5 Part 2):**
       - The `LoopAgent` [cite: 48, 116] checks the output of `FactVerificationAgent`.
       - If inaccuracies are found, the loop sends the `draftSynthesisOutput` and the list of errors back to the `SynthesisEnsemble` (specifically, the `MetaSynthesisAgent` might be best suited, or a new specialized `CorrectionAgent`) for revision.
       - The loop continues until the `FactVerificationAgent` passes all claims or `max_iterations` are hit[cite: 117].
     - Output: `session.state.factCheckedSynthesisOutput`.
   - **Why:** To mitigate LLM hallucination or factual inaccuracies introduced during the synthesis process, ensuring the final output is grounded in verifiable facts[cite: 113, 114].
   - **Changes from Ravint22:** Adds a new verification and refinement loop after the initial synthesis.

#### 5.3. Create `NuancePreservationCheckAgent` (F8 Part 1)
   - **File:** e.g., `nuance-preservation-check-agent.ts`
   - **Type:** `LlmAgent`.
   - **Functionality:**
     - Input: `session.state.factCheckedSynthesisOutput`, and detailed outputs of key upstream agents (e.g., full critique texts, lists of assumptions with risks, detailed bias reports). These detailed outputs should be loaded from saved artifacts[cite: 133].
     - `instruction` [cite: 130, 132, 27] will prompt the agent to compare the summary, key strengths/weaknesses sections of the synthesis against the detailed upstream reports.
     - Task: To identify if any critical nuances, important caveats, high-impact details (e.g., a "High" risk assumption that was downplayed), or significant unresolved conflicts were lost, oversimplified, or underrepresented in the synthesis[cite: 130, 131].
     - Output: `session.state.nuancePreservationReport`. Findings could optionally trigger a refinement step by sending the report and synthesis back to the `SynthesisEnsemble` or `MetaSynthesisAgent`.
   - **Why:** To counteract oversimplification or loss of crucial detail during the aggregation and summarization inherent in synthesis[cite: 128, 129].
   - **Changes from Ravint22:** Introduces a new agent focused on the qualitative aspect of information representation.

#### 5.4. Implement `SynthesisCritiqueLoop` (F9)
   - **File:** e.g., `synthesis-critique-loop-agent.ts` (this will be a `LoopAgent` definition)
   - **Type:** `LoopAgent` managing a `SynthesisCritiqueAgent`.
   - **Functionality:**
     - Input: `session.state.factCheckedSynthesisOutput` (or the output from nuance check if that triggers refinement).
     - `SynthesisCritiqueAgent` (sub-agent of the loop):
       - **Type:** `LlmAgent`.
       - **Task:** To act as an adversarial challenger specifically for the *synthesized output itself*[cite: 134, 136]. (Remember F1 Part 2: Strengthen Critique Agent instructions applies here too).
       - **ADK Leverage:** `instruction` [cite: 138, 27] guides it to look for logical flaws in how inputs were integrated, remaining inconsistencies, overstated confidence, or if the synthesis failed to adequately address key challenges or uncertainties from earlier stages[cite: 137]. This explicitly follows the Review/Critique MAS pattern[cite: 93, 138].
       - Output: A critique of the synthesis.
     - **Loop Logic (F9 Part 2):**
       - The `LoopAgent` [cite: 48, 139] takes the critique.
       - If significant issues are raised, it sends the synthesis and the critique back to the `SynthesisEnsemble` (likely the `MetaSynthesisAgent`) for further refinement.
       - Loop continues until critique is minimal or `max_iterations`.
     - Output: `session.state.finalRefinedSynthesisOutput`.
   - **Why:** To ensure the synthesis process itself is critically evaluated and refined, rather than just the inputs to it[cite: 134, 135].
   - **Changes from Ravint22:** Adds a final adversarial critique and refinement loop specifically for the synthesis output.

---
### Phase 6: Human Review & Finalization (Optional & Conditional)

#### 6.1. Implement `HumanInTheLoopAgent` (E10)
   - **File:** Logic can be part of `MasterOrchestratorAgent` or a dedicated `conditional-hitl-agent.ts`.
   - **Type:** Can be an `LlmAgent` instructed to decide if HITL is needed and then call a tool, or simpler conditional logic in the `MasterOrchestratorAgent`.
   - **Functionality:**
     - Trigger Conditions:
       - High-impact information gaps identified by `ImpactAssessmentAgent` (F6).
       - Low confidence score from `ConfidenceScoringAgent` (E7).
       - Critical, unrecoverable failures escalated by `ErrorHandlingAndRecoveryCoordinator` (E15).
       - Specific user request for human review.
     - If triggered:
       - The agent (or orchestrator) calls a `HumanReviewTool`.
       - **`HumanReviewTool`** (custom `FunctionTool` [cite: 57, 94, 115]):
         - Pauses the agent workflow.
         - Packages relevant data (e.g., `session.state.finalRefinedSynthesisOutput`, key uncertainties, source documents/artifacts) and sends it to an external system for human review (e.g., a task queue, email, dedicated UI)[cite: 57].
         - The tool then waits (asynchronously) for the human's input/approval. This might involve long polling or a callback mechanism depending on the external system.
         - `ToolContext` [cite: 62, 127] can be used by the tool to manage the state of the human review task (e.g., storing a task ID).
     - Output: The human expert's input, validation, or approval. This input would then be used to finalize the report (e.g., by the `MasterOrchestratorAgent` simply passing it along) or could potentially trigger further minor revisions by the `SynthesisEnsemble` if specific changes are requested by the human.
   - **Why:** To combine AI's analytical breadth and speed with human expert depth, judgment, and accountability, especially for sensitive, ambiguous, or high-stakes analyses[cite: 56, 60].
   - **Changes from Ravint22:** Introduces a significant new capability for optional human oversight and intervention. Requires definition of the `HumanReviewTool` and integration points for its triggering.

This detailed TODO list should provide the AI coder with a clear roadmap for implementing these 25 enhancements into your Ravint22 codebase. Each point details the specific agent or logic, its ADK type, its purpose, how it leverages ADK, its expected inputs/outputs, why it's being changed/added, and how it impacts the existing Ravint22 structure.