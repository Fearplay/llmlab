# LLMLab UI mockup prompts

These are the production prompts used with the built-in ImageGen tool. All three images belong to one visual system and depict a 1440 × 900 desktop viewport.

## 01 — Project Dashboard

```text
Use case: ui-mockup
Asset type: high-fidelity desktop web application screen, 1440 × 900 viewport
Primary request: shippable Project Dashboard for "LLMLab", a self-hosted LLM evaluation and AI systems lab
Style/medium: realistic product UI, technical editorial design, precise engineering instrument, not concept art
Composition/framing: full browserless application viewport; 232 px dark ink left sidebar, slim light utility bar, dense 12-column analytical workspace
Color palette: warm off-white canvas #F3F0E8, near-black ink #171A1D, white work surfaces, cobalt blue #275EFE for actions and selected data; green, amber, and red only for status
Typography: crisp IBM Plex Sans with IBM Plex Mono for metrics, identifiers, timestamps, and tabular numbers
Subject: sidebar wordmark "LLMLab" and navigation "Overview", "Experiments", "Datasets", "Prompts", "Providers", "Evaluators", "AI Lab", "Reviews"; project header "Customer Support AI"; visible locale control "EN / CZ"; provenance strip showing "FIXTURE", "OpenAI-compatible", "model-medium", "support-v4", "prompt-v18"; compact aligned metrics "Quality 91.4% +3.5", "Pass rate 89.8%", "Cost / request $0.0041", "p95 latency 1.28 s", "Regression rate 1.8%"; quality trend line; cost-versus-quality scatter plot with a Pareto frontier; recent experiments table; regressions requiring review
Hierarchy: one coherent analytics workspace, strong column alignment, thin dividers, clear evidence path from metric to run to regression
Constraints: render the listed interface text clearly; practical data density; restrained 4–6 px corner radii; thin borders; accessible contrast; no browser chrome; no logos beyond the LLMLab wordmark; no watermark
Avoid: gradients, glassmorphism, neon, glow, decorative blobs, robot imagery, emoji, oversized headings, floating cards, excessive pills, generic four-card SaaS dashboard, default template styling, 3D charts, fake terminal decoration
```

## 02 — Interactive RAG Lab

```text
Use case: ui-mockup
Asset type: high-fidelity desktop web application screen, 1440 × 900 viewport
Primary request: shippable interactive "RAG Pipeline" screen for the same LLMLab product and visual system as the Project Dashboard
Input images: Image 1 is a visual style and application-shell reference only; create a new screen rather than editing it
Style/medium: realistic product UI, technical editorial design, precise engineering instrument, not concept art
Composition/framing: full browserless application viewport; same 232 px dark ink sidebar and light utility bar; three-region analytical layout with configuration on left, inspectable pipeline in center, evidence inspector on right
Color palette: warm off-white canvas #F3F0E8, near-black ink #171A1D, white work surfaces, cobalt blue #275EFE for selected stages; green, amber, and red only for semantic status
Typography: crisp IBM Plex Sans with IBM Plex Mono for code, chunks, scores, timing, tokens, and identifiers
Subject: sidebar wordmark "LLMLab" with "AI Lab" expanded and "RAG Pipeline" selected; locale control "EN / CZ"; top question "What is the refund window for footwear?"; visible mode control with "LOCAL" selected and provider "Ollama"; left configuration fields "Source", "Chunk strategy", "Chunk size 480", "Overlap 80", "Embedding", "Retrieval Hybrid", "Top K 5", "Reranker On", "Generator" and button "Run pipeline"; central horizontal pipeline stages "Parse", "Chunk", "Embed", "Retrieve", "Rerank", "Generate", "Evaluate" with exact stage timings; retrieved chunk stack ranked #1 to #5 with similarity bars; right evidence inspector tabs "Chunk", "Context", "Prompt", "Claims"; selected claim marked "SUPPORTED" and linked to a highlighted source span; compact footer metrics "Faithfulness 0.92", "Context precision 0.88", "Response relevance 0.95", "Total 1.42 s", "Cost local"
Hierarchy: user can trace source to chunk to context to answer without losing the question or provenance; selected Retrieve stage and one selected chunk drive the inspector
Constraints: render listed labels clearly; practical controls and data density; restrained 4–6 px radii; thin borders; accessible contrast; visible LOCAL provenance; no browser chrome; no watermark
Avoid: gradients, glassmorphism, neon, glow, decorative AI motifs, robot imagery, emoji, giant flowchart bubbles, excessive pills, colorful node-editor style, default template styling, invented hidden chain-of-thought
```

## 03 — Run Comparison

```text
Use case: ui-mockup
Asset type: high-fidelity desktop web application screen, 1440 × 900 viewport
Primary request: shippable "Compare runs" screen for the same LLMLab product and visual system as the Project Dashboard and RAG Pipeline
Input images: Image 1 is a visual style and application-shell reference only; create a new screen rather than editing it
Style/medium: realistic product UI, technical editorial design, precise engineering instrument, not concept art
Composition/framing: full browserless application viewport; same 232 px dark ink sidebar and light utility bar; dense comparison workspace with baseline and candidate columns, analytical charts, and paired-case table
Color palette: warm off-white canvas #F3F0E8, near-black ink #171A1D, white work surfaces, cobalt blue #275EFE for candidate and selection, muted gray for baseline; green, amber, and red only for improved, warning, and regression states
Typography: crisp IBM Plex Sans with IBM Plex Mono for metrics, run IDs, deltas, confidence intervals, costs, and timings
Subject: sidebar wordmark "LLMLab" and "Experiments" selected; locale control "EN / CZ"; title "Compare runs"; baseline selector "run_0184 · prompt-v17" and candidate selector "run_0191 · prompt-v18"; visible provenance "FIXTURE · model-medium · support-v4 · 500 cases"; prominent but restrained gate status "QUALITY GATE FAILED" because regression rate exceeds threshold; aligned metric matrix with baseline, candidate, delta and threshold for "Correctness", "Relevance", "Faithfulness", "JSON validity", "Cost / request", "p95 latency", "Regression rate"; paired bootstrap note "95% CI +2.1 to +4.6"; cost-versus-quality scatter with Pareto frontier; horizontal distribution "Improved 54", "Unchanged 421", "Regressed 25"; dense case table columns "Case", "Slice", "Baseline", "Candidate", "Delta", "Finding" with one selected regression; lower side inspector comparing baseline output, candidate output, evaluator evidence, and source context
Hierarchy: baseline and candidate can never be confused; failed gate, metric evidence, distribution, and exact regressed cases form one reading path
Constraints: render listed labels clearly; practical information density; restrained 4–6 px radii; thin borders; accessible contrast; color-independent statuses; no browser chrome; no watermark
Avoid: gradients, glassmorphism, neon, glow, decorative blobs, robot imagery, emoji, oversized headings, floating cards, excessive badges, generic SaaS template, 3D charts, unlabeled magic score
```

### Targeted statistical-consistency pass

The first render mixed an incompatible delta, confidence interval, and p-value. The following edit prompt produced the final saved version.

```text
Use case: precise-object-edit
Input images: Image 1 is the edit target, the LLMLab "Compare runs" UI mockup
Primary request: change only the lower-right "Significance test" panel so its statistics are internally consistent
Text (verbatim): "Significance test", "Paired bootstrap on overall quality (500 cases)", "Δ +3.3 pp", "p = 0.004", "95% CI +2.1 to +4.6", "Statistically significant"
Constraints: preserve every other pixel-level design decision, layout, navigation item, metric table value, chart, case table, selected case, typography, spacing, colors, borders, and application shell; edit only the content inside the Significance test panel; keep the same technical-editorial visual style; no watermark
```
