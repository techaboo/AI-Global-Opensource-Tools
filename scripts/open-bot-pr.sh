#!/usr/bin/env bash
# Turns catalog changes in the working tree into an auto-merging PR, then waits
# until it has actually merged. Branch protection on main requires the CI checks,
# so a bad bot change can never land: the run fails and the PR stays open.
# Exits 0 when there is nothing to do or the change is on main.
# Usage: scripts/open-bot-pr.sh <branch> <title>
set -euo pipefail
branch="$1"; title="$2"
wait_seconds="${MERGE_WAIT_SECONDS:-900}"

if git diff --quiet -- src/data/catalog.json; then
  echo "No catalog changes; no PR needed."
  exit 0
fi

npm run validate:catalog

# GitHub answers with transient 5xx errors often enough to matter.
retry() {
  local attempt
  for attempt in 1 2 3 4; do
    "$@" && return 0
    echo "Attempt $attempt failed: $*" >&2
    sleep $((attempt * 15))
  done
  return 1
}
pr_state() { gh pr list --head "$branch" --state all --limit 1 --json state,headRefOid --jq ".[] | select(.headRefOid == \"$head\") | .state"; }

git switch -C "$branch"
git add src/data/catalog.json
git commit -m "$title"
head="$(git rev-parse HEAD)"
retry git push --force origin "$branch"

body="Automated by \`${GITHUB_WORKFLOW:-bot}\` run ${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}. Auto-merges once required CI checks pass."
open_or_update() {
  # A failed create can still have created the PR, so look before each attempt.
  if [ -n "$(gh pr list --head "$branch" --state open --json number --jq '.[].number')" ]; then
    gh pr edit "$branch" --title "$title" --body "$body"
  else
    gh pr create --base main --head "$branch" --title "$title" --body "$body"
  fi
}
retry open_or_update

enable_merge() { [ "$(pr_state)" = MERGED ] || gh pr merge "$branch" --squash --auto --delete-branch; }
retry enable_merge

deadline=$((SECONDS + wait_seconds))
while [ "$SECONDS" -lt "$deadline" ]; do
  state="$(pr_state || true)"
  case "$state" in
    MERGED) echo "Merged into main."; exit 0 ;;
    CLOSED) echo "::error::PR for $branch was closed without merging."; exit 1 ;;
  esac
  # Anything but a positive count (no checks yet, API error) means keep waiting.
  failed="$(gh pr checks "$branch" --required --json bucket --jq '[.[] | select(.bucket == "fail")] | length' 2>/dev/null || true)"
  if [[ "$failed" =~ ^[1-9][0-9]*$ ]]; then
    echo "::error::A required check failed on $branch; nothing was merged."
    exit 1
  fi
  sleep 20
done
echo "::error::PR for $branch did not merge within ${wait_seconds}s."
exit 1
