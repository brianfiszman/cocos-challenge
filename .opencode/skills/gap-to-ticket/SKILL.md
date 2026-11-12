---
name: Gap to ticket
description: MANDATORY workflow for this repo. Use at the START of every task — before editing any file, before proposing a fix, and whenever the user says "revisá", "arreglá", "hay un bug", "compará con la spec", "no anda", or asks for a review. Enforces the order: read the challenge spec → audit the repo → open one GitHub issue per gap → only then write code. Also use it mid-task the moment a new finding appears, and before claiming something is fixed without an issue number. If a task starts with code and no ticket, this skill was skipped.
---

# Gap → ticket → code

**Hard rule: no code until every gap has an issue.** This is not bureaucracy. An
agent has no memory between sessions; the user should not have to carry the list
of known gaps in their head. If a gap is not a ticket, it will be lost.

This rule exists because it was violated: an audit produced a backlog, and
implementation started in parallel anyway. The backlog then became stale within
minutes. Do not repeat it.

## 0. Read the board first

Before anything else, load the current state. It is cheaper than rediscovering it.

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN";
  gh issue list -R brianfiszman/cocos-challenge --state open --limit 200 \
    --json number,title,labels,milestone'
```

- If the task is already an issue, work on that issue. Do not create a duplicate.
- If the task contradicts an open issue, update the issue instead of opening a new one.

## 1. Read the spec

Source of truth: **https://github.com/cocoscap/cocos-challenge/blob/main/backend-challenge.md**

Read the whole thing. The relevant sections are "Resumen", "Consideraciones
funcionales" and "Consideraciones técnicas". Treat explicit lines as
requirements even when they look like an aside (e.g. `previousClose` for the
daily return).

## 2. Audit the repo against it

For every requirement, record: met / partially met / not met / ambiguous. Pull
evidence, not impressions: `file:line`, the SQL that runs, the response shape.
`grep` is your friend; open the file and read the surrounding code.

## 3. What counts as a gap

Open a ticket for each of these, and only these:

- **spec-gap** — an explicit requirement that is not met, or an ambiguity that
  needs a documented decision.
- **bug** — behavior that is incorrect even if the spec is silent (races,
  silent fallbacks, 500s that should be 4xx, soft-delete leaks).
- **test** — a required behavior with no test that actually executes it.
- **chore** — migrations, seeds, CI, tooling, data consistency.
- **docs** — a decision that exists only in someone's head.
- **feat** — capabilities the project explicitly wants (see the outbox
  milestone), not speculative nice-to-haves.

Not a gap: style preferences with no behavioral consequence, and anything you
cannot point at with a `file:line`.

## 4. Deduplicate before creating

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN";
  gh issue list -R brianfiszman/cocos-challenge --state all --limit 300 --json number,title'
```

Search by keyword, not by exact title. A closed issue may already cover it; in
that case reopen or reference it instead of duplicating.

## 5. Create the ticket

Conventions:

- **Labels**: `type: bug | spec-gap | test | feat | chore | docs` and
  `prio: high | medium | low`.
- **Milestones**: `M0 — Test infrastructure`, `M1 — Spec compliance`,
  `M2 — Correctness`, `M3 — Outbox + Kafka`.
- **Title**: conventional-commit style, e.g. `fix(orders): make cancelOrder atomic`.

Body template:

```markdown
**Context**
What is wrong, in two or three sentences. Why it matters.

**Evidence**
- `path/to/file.ts:42`

**Acceptance criteria**
- [ ] Verifiable statement, not an intention.
- [ ] Test that proves it (if applicable).
```

Create with the repo-scoped token:

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN";
  printf "%s" "$BODY" | gh issue create -R brianfiszman/cocos-challenge \
    --title "..." --body-file - --label "type: bug" --label "prio: high" \
    --milestone "M2 — Correctness"'
```

Add it to the board (project **5**, owner `brianfiszman`) with the classic token,
which is the only one with the `project` scope:

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN_CLASSIC";
  gh project item-add 5 --owner brianfiszman --url <issue-url>'
```

## 6. Report, then implement

1. Tell the user the issue numbers and one line each. Do not ask for permission
   to start; the ticket is the contract.
2. Branch name references the issue: `fix/8-advisory-lock`.
3. Commit body ends with `Closes #8` (or `Refs #8` if partial).
4. Flip any `it.failing` marker in the same commit that fixes the bug.

## 7. Keep this skill current

When the process changes — new milestone, new label, a convention that stops
working — edit this file in the same PR that changes the process. The skill is
part of the codebase, not a note.

## Changelog

- 2026-11-12 — created after the backlog/implementation race. Defines the
  mandatory order and the issue conventions.
