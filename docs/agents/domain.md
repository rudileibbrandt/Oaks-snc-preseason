# Domain context — read before exploring

1. `CLAUDE.md` (root) — architecture, data models, conventions, the ISO-week rule (critical).
2. `services/programData.ts` — the hardcoded 4-day program; `types.ts` — core interfaces; `utils/weekUtils.ts` — all week math.
3. **This app has real users** (Oaks athletes + coaches on the live Firebase project). Destructive data changes and auth changes need Rudi's explicit go-ahead — data here is NOT disposable, unlike the Gainline pilot.
4. Ubiquitous language: Player, WorkoutLog, WorkoutDay (see Data Models in CLAUDE.md). A "week" is always ISO 8601 via weekUtils.
