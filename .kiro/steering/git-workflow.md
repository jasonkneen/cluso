# Git Workflow and Branching Strategy

## Branch Structure

### Main Branches
- `main` - Production-ready code, always deployable
- Feature branches merge directly to `main` via pull requests

### Branch Naming Convention
```
feature/description-of-feature    # New features
fix/description-of-bug           # Bug fixes
hotfix/critical-issue            # Urgent production fixes
refactor/component-name          # Code refactoring
docs/documentation-update        # Documentation changes
test/test-description            # Test additions/changes
```

### Examples
- `feature/claude-oauth-integration`
- `fix/webview-injection-crash`
- `refactor/ai-chat-hook-v2`
- `hotfix/memory-leak-audio-context`

## Commit Message Format

Follow conventional commits specification:

```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code formatting, no logic changes
- `refactor` - Code restructuring without behavior changes
- `test` - Test additions or modifications
- `chore` - Build process, dependency updates

### Scopes (project-specific)
- `electron` - Electron main process changes
- `renderer` - React/UI changes
- `hooks` - Custom hook changes
- `ai-sdk` - AI SDK integration
- `oauth` - Authentication changes
- `mcp` - MCP server integration
- `voice` - Voice/audio features
- `webview` - Browser inspector/webview

### Examples
```
feat(hooks): add useAIChatV2 with streaming support

fix(electron): resolve IPC handler memory leak

refactor(ai-sdk): migrate to unified provider interface

chore(deps): upgrade @ai-sdk/anthropic to v2.0.50
```

## Pull Request Guidelines

### PR Title Format
Same as commit message format: `type(scope): description`

### PR Description Template
```markdown
## Summary
Brief description of changes (1-3 sentences)

## Changes
- Bullet point list of specific changes
- Include file paths where helpful

## Testing
- How to test these changes
- Any manual testing steps required

## Related Issues
Fixes #issue-number (if applicable)

## Screenshots
(if UI changes)
```

### PR Checklist
Before requesting review:
- [ ] Tests pass locally (`npm run test`)
- [ ] TypeScript compiles without errors
- [ ] No console errors in browser
- [ ] Electron build works (`npm run electron:dev`)
- [ ] Code follows project standards
- [ ] Self-reviewed the diff

### Review Process
1. At least one approval required before merge
2. Automated checks must pass
3. Squash and merge to keep history clean
4. Delete branch after merge

## Commit Best Practices

### Atomic Commits
- Each commit should represent one logical change
- Commit should compile and run without errors
- Related changes should be in the same commit

### When to Commit
- After completing a discrete piece of work
- Before switching context
- Before significant refactoring
- After successful test runs

### What NOT to Commit
- Build artifacts (`dist/`, `release/`)
- Node modules (`node_modules/`)
- Environment files (`.env.local`, `oauth-config.json`)
- IDE settings (`.idea/`, `.vscode/` unless shared)
- OS files (`.DS_Store`, `Thumbs.db`)

## Release Process

### Version Numbering
Follow semantic versioning: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes, backward compatible

### Release Steps
1. Update version in `package.json`
2. Update changelog (if maintained)
3. Create release commit: `chore: release v1.2.3`
4. Tag the release: `git tag v1.2.3`
5. Build production artifacts: `npm run electron:build`

## Git Commands Reference

### Daily Workflow
```bash
# Start new feature
git checkout main
git pull origin main
git checkout -b feature/my-feature

# Stage and commit changes
git add .
git commit -m "feat(scope): description"

# Push to remote
git push -u origin feature/my-feature

# Create PR via GitHub CLI
gh pr create --title "feat(scope): description" --body "..."
```

### Syncing with Main
```bash
# Rebase feature branch on main
git fetch origin
git rebase origin/main

# If conflicts, resolve then:
git rebase --continue
```

### Stashing Changes
```bash
# Save work in progress
git stash push -m "WIP: description"

# List stashes
git stash list

# Apply and remove stash
git stash pop

# Apply specific stash
git stash apply stash@{1}
```
