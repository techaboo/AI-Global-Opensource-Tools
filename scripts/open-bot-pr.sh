#!/usr/bin/env bash
# Turns catalog changes in the working tree into an auto-merging PR.
# Branch protection on main requires the CI checks, so a bad bot change can
# never land: it just sits as a failed PR. Exits 0 when there is nothing to do.
# Usage: scripts/open-bot-pr.sh <branch> <title>
set -euo pipefail
branch="$1"; title="$2"

if git diff --quiet -- src/data/catalog.json; then
  echo "No catalog changes; no PR needed."
  exit 0
fi

npm run validate:catalog

git switch -C "$branch"
git add src/data/catalog.json
git commit -m "$title"
git push --force origin "$branch"

body="Automated by \`${GITHUB_WORKFLOW:-bot}\` run ${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}. Auto-merges once required CI checks pass."
if gh pr view "$branch" --json state -q .state 2>/dev/null | grep -q OPEN; then
  gh pr edit "$branch" --title "$title" --body "$body"
else
  gh pr create --base main --head "$branch" --title "$title" --body "$body"
fi
gh pr merge "$branch" --squash --auto --delete-branch
