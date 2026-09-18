# LLMLab UI direction

## Product character

LLMLab looks like a precise engineering instrument, not an AI marketing page. Interface takes cues from technical publishing, observability tools, and scientific notebooks: clear hierarchy, visible provenance, dense comparison, and calm surfaces.

Mockups in `design/mockups/` define composition and visual tone. They are not permission to hardcode screenshot layouts.

## Principles

1. **Evidence before decoration.** Give data, source, evaluator, model, mode, and timestamp clear positions.
2. **Comparison before summary.** A total score never hides metric breakdown or individual cases.
3. **State before action.** Users must know whether data is Fixture, Local, or Cloud before starting or trusting a run.
4. **Progressive density.** Summary, chart, table, and evidence form one reading path. Drill-down stays near its parent context.
5. **Observable AI.** Show inputs and observable intermediate outputs. Never display invented reasoning or fake certainty.

## Visual foundation

### Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#F3F0E8` | warm application background |
| `surface` | `#FBFAF6` | primary work surface |
| `surface-subtle` | `#EEEAE1` | grouped controls and table hover |
| `ink` | `#171A1D` | primary text and dark navigation |
| `ink-soft` | `#5F6469` | secondary text |
| `line` | `#D4D0C7` | borders and chart rules |
| `line-strong` | `#A9A59D` | emphasized separators |
| `action` | `#275EFE` | links, selected data, primary action |
| `action-soft` | `#DCE5FF` | selected row or plot range |
| `success` | `#167956` | passed, improved, healthy |
| `warning` | `#A96512` | partial, stale, estimated |
| `danger` | `#BC3D49` | failed, regressed, unsafe |
| `nav` | `#141A20` | sidebar background |
| `nav-muted` | `#98A1AA` | sidebar secondary text |

Semantic color always appears with text, icon, shape, or pattern. Never encode status with color alone.

### Typography

- UI and editorial text: IBM Plex Sans.
- Metrics, identifiers, timestamps, code, prompt text, and tabular numerals: IBM Plex Mono.
- Use local or self-hosted font files when practical. Fallbacks: `Inter`, `Segoe UI`, `sans-serif` and `ui-monospace`, `Consolas`, `monospace`.
- Base body: 14 px / 20 px. Dense table: 13 px / 18 px. Labels: 11–12 px with moderate letter spacing. Page title: 24–28 px, never a marketing hero.
- Use tabular numerals for metrics. Align decimals within comparisons.

### Grid and geometry

- 4 px spacing base. Common steps: 4, 8, 12, 16, 24, 32, 48.
- Desktop sidebar: 232 px. Top utility bar: 56 px.
- Desktop work area uses a 12-column grid with 24 px gutters and 24–32 px outer padding.
- Main content may use full available width up to 1600 px. Analytical tables should not sit in narrow centered columns.
- Border radius: 4 px controls, 6 px panels, 8 px overlays. No pill shapes except tags with short categorical values.
- Borders: 1 px. Shadows only for menus, dialogs, and temporarily elevated inspectors.

## Application shell

- Dark ink sidebar carries wordmark, project switcher, navigation, environment health, and compact settings entry.
- Light top bar carries breadcrumbs, active mode, provider health, locale switch, and the primary contextual action.
- Current project and execution mode remain visible on analytical screens.
- AI Lab navigation groups related modules but never exposes unfinished routes.
- Use one icon family at 16 or 18 px. Icons support labels; they do not replace unfamiliar labels.

## Core components

### Provenance strip

One compact row shows:

- execution mode: Fixture, Local, or Cloud
- provider and model
- dataset, prompt, and evaluator versions
- timestamp and duration
- token and cost availability
- configuration hash or link to complete configuration

Use a bordered strip, not a cloud of pills.

### Metrics

- Group related metrics inside one analytical panel rather than repeating identical cards.
- Always show unit, aggregation, sample count, and comparison basis.
- Show delta beside baseline and candidate values. Use `—` for unavailable values, never zero.
- Quality totals link to metric breakdown and cases.

### Tables

- Sticky header, stable columns, clear row selection, keyboard navigation, visible filters, and URL-backed sort/filter state.
- Keep identifiers and numeric columns compact. Let input/output text receive remaining space.
- Status uses icon + text. Truncated content exposes full text accessibly.
- Row click and explicit action must behave consistently.

### Charts

- Flat fills and thin rules. No gradients, 3D, chart chrome, or decorative animation.
- Direct labels beat detached legends when space permits.
- Tooltips show exact values, units, sample count, and provenance.
- Cost-quality plots identify dominated points and Pareto frontier without claiming a single best model.
- Confidence bands state method and confidence level.

### Forms and actions

- One primary action per region. Secondary actions use quiet buttons or text links.
- Keep labels above controls. Preserve help and validation text without layout jumps.
- Capability-disabled controls state which provider capability is missing.
- Destructive actions require specific confirmation and name the affected entity.

## Reference screens

### Project Dashboard

- Header: project name, concise descriptor, mode/provider strip, `New experiment` action.
- First analytical band: quality/pass rate, cost, p95 latency, and regression rate in one aligned panel.
- Middle: recent quality trend and cost-quality scatter, sharing a baseline/candidate context.
- Lower area: active/recent runs and regressions requiring review.
- Use compact status blocks; avoid four oversized dashboard cards.

### Interactive RAG Lab

- Left column: source, chunking, embedding, retrieval, reranking, generator, and run controls.
- Center: inspectable pipeline with stage timing and status. Selected stage expands without hiding other stages.
- Right column: evidence inspector for chunk text, rank, similarity, assembled context, prompt, answer claim, citation, and evaluator finding.
- Keep the question and mode/provenance visible while inspecting details.
- A run comparison drawer shows parameter changes and metric deltas.

### Run Comparison

- Top: baseline and candidate selectors with complete provenance and quality-gate result.
- Summary: per-metric values and deltas, confidence interval, cost, and latency.
- Middle: quality-cost plot plus improvements/unchanged/regressions distribution.
- Bottom: dense paired-case table with slices and search.
- Case inspector compares input, expected answer, baseline, candidate, evaluator evidence, and retrieved sources.

## Responsive behavior

- At 1024 px, sidebar collapses to icons with accessible tooltips; secondary inspectors become drawers.
- At 390 px, navigation becomes an overlay, metric bands become horizontally scrollable tables, and charts use simplified views.
- Never hide provenance or evaluation status on small screens.
- Preserve compare semantics: baseline precedes candidate in reading and focus order.
- Test long Czech copy and 200% browser zoom.

## Motion and interaction

- Motion explains state change only: 120–180 ms for disclosure and selection.
- Respect `prefers-reduced-motion`.
- Streaming runs update values without shifting the page. Announce meaningful progress through an accessible live region at a restrained frequency.
- Focus remains on the triggering control when drawers or dialogs close.

## Required states

Each feature must design and implement:

- first-use empty state with one useful next action
- seeded fixture state
- local provider unavailable and reconnecting states
- cloud key missing, authentication failed, rate limited, safety blocked, timeout, and provider outage states
- partial run with failed cases
- cancelled and cancel-requested states
- stale price or unavailable cost state
- long prompt, long chunk, large dataset, and no-reference evaluation states
- loading skeleton that matches final geometry

## Anti-vibecode rules

- No gradients, glass panels, glow, blurred color fields, decorative grids, space backgrounds, robot art, emoji, or sparkle icons.
- No huge title with tiny product beneath it.
- No repeated rounded cards with equal visual weight.
- No fake terminal text, random charts, arbitrary percentages, or unlabeled demo data.
- No default component-library styling left untouched.
- No excessive badges. Use badges only for compact categorical state.
- No icon-only actions unless conventional and accessibly named.
- No dead controls, optimistic success without confirmation, or error swallowed into a toast.
- No invented precision. Estimated and judge-derived values are labeled.

## Visual review checklist

- Can a user identify mode, provider, model, dataset version, and run status in five seconds?
- Does every summary expose its evidence or case list?
- Are baseline and candidate impossible to confuse?
- Does the screen still work with long Czech copy and missing values?
- Are semantic colors rare and meaningful?
- Are alignment, column widths, numeric precision, and spacing deliberate?
- Do loading, empty, partial, error, and offline states preserve the layout?
- Does the result feel like one designed product rather than assembled UI snippets?
