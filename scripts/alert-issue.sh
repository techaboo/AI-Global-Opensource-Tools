#!/usr/bin/env bash
# Opens (or comments on) one tracking issue per workflow when a run needs a human,
# so an autonomous pipeline never fails silently.
# Usage: scripts/alert-issue.sh <marker> <title> <message>
set -euo pipefail
marker="<!-- alert:$1 -->"; title="$2"; message="$3"
run="${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
body="$(printf '%s\n%s\n\nRun: %s' "$marker" "$message" "$run")"
number="$(gh issue list --state open --limit 100 --json number,body \
  --jq "[.[] | select(.body | contains(\"$marker\"))][0].number // empty")"
if [ -n "$number" ]; then
  # One comment per half day is enough; an hourly job must not flood the issue.
  recent="$(gh issue view "$number" --json updatedAt --jq '(now - (.updatedAt | fromdateiso8601)) < 43200')"
  if [ "$recent" = true ]; then echo "Alert issue #$number was updated recently; not commenting again."; exit 0; fi
  gh issue comment "$number" --body "$body"
else
  gh issue create --title "$title" --body "$body"
fi
