# <agent>.md — artifact template

Copy this structure to `.claude-artifacts/<your-agent-name>.md` when your subtask is done.
Downstream agents parse this file — keep the headings exactly.

```markdown
# <agent> — <subtask id>: <short title>

status: done | blocked | needs-rework
task: <subtask id from plan.md>
depends_on_read: <artifact paths you consumed>

## What was done
<bullet summary of the work, decisions taken, and any deviation from plan.md (with why)>

## Public interface
<the contract downstream agents rely on — exhaustive:
 - database: every table, column, type, relation, exported model/type names, demo credentials
 - backend: every route (method, path, auth/permission, request shape, response shape)
 - frontend: exported components + props, routes added, endpoints consumed>

## Files changed
<path — one-line purpose, per file>

## How to verify
<exact commands + expected results (the reviewer runs these)>

## Notes / gotchas
<anything the next agent or the reviewer must know; empty section allowed>
```
