# Issue tracker — how agents read and write work items

**The tracker is `TODO.md`** (local file — no GitHub/Linear). Lightweight: this app has real users but no formal loop.

- **A "ticket" is a checkbox line** in `TODO.md`. "Ready for agent" = the line states a verifiable done-condition. Done = checked, with a one-line note if verification was non-obvious.
- **Create** (`/to-tickets`): append checkbox lines; keep one line = one sitting of work.
- **Declined ideas**: strike through with a short reason — don't delete (the reason is the record).
- Anything touching the live roster/logs data or auth: flag Rudi before building; this app has real users.
