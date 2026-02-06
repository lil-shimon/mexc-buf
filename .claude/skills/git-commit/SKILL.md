---
name: git-commit
description: Automate creating well-structured git commits and pushing to remote. Trigger when user wants to commit changes, create commits, push code, save work to git, or finalize changes.
---

# Git Commit Workflow

Automate git commits with context-aware file grouping and clean history.

## Workflow Steps

1. **Review changes**: Run `git status` and `git diff` to understand all modifications on the current branch.

2. **Group files by context**: Identify files that share the same purpose or change context.
   - Implementation files have different context than test files
   - Configuration changes are separate from code changes
   - Do not mix unrelated changes in a single commit

3. **Stage related files**: Add only files with the same context using `git add <file1> <file2> ...`
   - Multiple files can be staged together if they share context
   - Keep commits focused and small

4. **Create commit**: Write a clear commit message without prefix
   - No conventional commit prefixes required
   - Focus on describing the change clearly
   - Keep commits small enough to understand changes quickly when reviewed later

5. **Repeat steps 2-4**: Continue until all changes are committed in logical groups.

6. **Push to remote**: Run `git push` to sync changes to remote repository.

## Key Rules

- Group files by shared context or purpose
- No commit message prefix required
- Small, focused commits for quick review
- Never stage unrelated changes together
