---
name: Stacked PRs
description: Use whenever pushing, opening, retargeting, merging or cleaning up pull requests in this repo. Covers branch-per-issue, stacked bases, the PR body, bottom-up merge order, why a stack uses --merge and not squash/rebase, the base-branch deletion trap that closed #35, post-merge verification, and the rule that merging needs explicit user approval.
---

# Stacked PRs and merge ritual

**Merging is a separate decision.** A ticket authorizes implementation, not
merge. Wait for the user's explicit go-ahead before merging or deleting
branches.

## 1. Branch and PR shape

- One issue per branch: `type/N-slug` (e.g. `fix/9-cancel-order-atomic`).
- Start from `main` unless the branch is intentionally stacked:
  `git checkout main && git pull --ff-only && git checkout -b type/N-slug`.
  Creating a branch from the current feature branch by accident adds the
  previous issue's commit to the new PR (this happened with PR #41).
- A PR that does not depend on another: base `main`.
- A PR that depends on another: base the previous PR's branch. Stack only when
  there is a real dependency; otherwise base on `main`.
- Keep each PR to its issue. No drive-by changes.
- Issues and PRs share numbering in GitHub. Say "issue #N" or "PR #N" when the
  distinction matters.

PR body template:

```markdown
## Problem
The incorrect behavior and why it matters.

## Fix
What changed and the invariant it preserves.

## Tests
The failing test, the before/after, and the gates that pass.

Closes #N
```

## 2. Before merging

- [ ] The user approved the merge.
- [ ] The PR is `MERGEABLE`.
- [ ] `gh pr view <n> --json files` shows only the files of that PR. If the
      diff includes the previous PR, the stack is misbased.
- [ ] The gates pass on the branch: `tsc`, `lint`, `test`, `test:e2e`, and
      `test:functional` when DB behavior changed.

## 3. Merge order

1. Merge the base PR first, bottom-up.
2. Use `--merge`, **not** `--squash` or `--rebase`, for a stack. Squash and
   rebase create new SHAs; the next PR's merge base becomes the old commit and
   its diff re-includes the previous PR. Merge commits preserve ancestry.
3. **Never delete a branch that is the base of an open PR.** Merging #34 with
   `--delete-branch` deleted `test/functional-order-suite`, and GitHub closed
   #35 two seconds later. Use one of:
   - do not pass `--delete-branch` while dependents are open; delete the old
     base after the dependent merges; or
   - retarget each dependent to `main` first (`gh pr edit <pr> --base main`),
     verify `MERGEABLE`, then delete.
4. After merging A, wait until B's base is the intended branch and
   `mergeable: MERGEABLE` before merging B.
5. Delete only the last PR's branch with `--delete-branch`; delete any
   leftovers manually.

## 4. If a PR was closed by a base deletion

Reopening requires the base branch to exist. Two options:

- recreate the old base at its commit
  (`git push origin <sha>:refs/heads/<branch>`), reopen the PR, retarget it to
  `main`, then delete the temporary branch; or
- open a replacement PR from the same head. This is what we did: #35 was
  closed, #37 was merged.
- Leave a note in the closed PR pointing at the replacement so the trail is
  clear.

## 5. After merge

```sh
git checkout main
git pull --ff-only
npx tsc --noEmit
yarn lint
yarn test
yarn test:e2e
yarn test:functional
```

- Confirm the issues are closed (`Closes #N`) and the board items are `Done`.
  `Closes #N` only auto-closes when the PR merges into the default branch; for a
  PR merged into a stacked base, close the issue manually after the stack lands
  on `main`.
- Delete local and remote branches that are no longer bases.
- Never force-push `main` or a branch under review.

## 6. Commands

Create a PR:

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN";
  gh pr create -R brianfiszman/cocos-challenge \
    --base main --head <branch> --title "..." --body-file -'
```

Merge and clean up:

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN";
  gh pr merge <number> -R brianfiszman/cocos-challenge --merge --delete-branch'
```

Retarget a dependent before deleting its base:

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN";
  gh pr edit <number> -R brianfiszman/cocos-challenge --base main;
  gh pr view <number> -R brianfiszman/cocos-challenge \
    --json state,baseRefName,mergeable'
```

## 7. Keep this skill current

When a merge goes wrong, add the failure signature and the safe procedure here
in the same PR that fixes the process. The base-branch trap above came from a
real incident; future ones should too.

## Changelog

- 2026-11-12 — created after #35 was closed by deleting the base branch of the
  stack. Defines the bottom-up merge order, `--merge`, the base-branch rule and
  the post-merge gates.
