# The Clashers Hub: Concept Documentation

This folder is the project's source of truth for **what we build and why**,
written before and alongside the code. Change a decision here first, then
change the code; a PR that changes behavior without changing the matching
doc here is incomplete ([08 §"Definition of done" #5](./08-roadmap.md)).

## Reading order

| # | Document | Answers |
|---|---|---|
| 00 | [Overview](./00-overview.md) | What the product is, who it's for, what is explicitly out of scope |
| 01 | [Tech stack](./01-tech-stack.md) | React Native for Web + Vite + a thin serverless API tier, all free |
| 02 | [Requirements](./02-requirements-tracker.md) | The full specification with status: stakeholders, UR / FR / NFR / SR, acceptance criteria, constraints, assumptions, and the task board |
| 03 | [Features list](./03-features-list.md) | Prioritized features, screens, URL map, the two golden paths |
| 04 | [API strategy](./04-api-strategy.md) | Talking to the game API safely: proxy, caching, throttling, key hygiene |
| 05 | [Scoring engines](./05-scoring-engines.md) | The math: rushed analysis, donation balance, war efficiency, compare |
| 06 | [Data flow & caching](./06-data-flow-and-caching.md) | Request lifecycle, cache layers, state matrix, the no-database decision |
| 07 | [Design language](./07-design-language.md) | Tokens, layout rules, component kit, accessibility |
| 08 | [Roadmap](./08-roadmap.md) | Milestones, team split, risk register, definition of done |
| 09 | [Coding standards](./09-coding-standards.md) | The STD rules: naming, file placement, components, styles, state, errors, and the review checklist |

## Conventions

- Every doc states a **decision and its rationale**, never just the choice.
- Priorities: **P0** must ship, **P1** should ship, **P2** stretch, cut
  without guilt.
- Requirement IDs ([02](./02-requirements-tracker.md)) and feature IDs
  ([03](./03-features-list.md)) are stable once assigned; keep the numbering.
