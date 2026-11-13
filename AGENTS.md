# AGENTS

Before editing any file in this repository, load the `gap-to-ticket` skill
(`.opencode/skills/gap-to-ticket/SKILL.md`).

The order is fixed: read the challenge spec, audit the repo, open one GitHub
issue per gap, and only then write code. Every fix starts with a failing test.
If you are about to change code and cannot name the issue it belongs to, stop
and create it first.

Before pushing, opening, retargeting or merging a PR, load the `stacked-prs`
skill (`.opencode/skills/stacked-prs/SKILL.md`). Merging needs the user's
explicit approval.

Before writing or debugging a DB-backed test, load the `functional-testing`
skill (`.opencode/skills/functional-testing/SKILL.md`). Unit and e2e tests must
stay database-free.

Spec: https://github.com/cocoscap/cocos-challenge/blob/main/backend-challenge.md
Board: https://github.com/users/brianfiszman/projects/5
