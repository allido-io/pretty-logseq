#!/usr/bin/env bash
# Reads a PR's changed files (one repo-relative path per line) on stdin and prints:
#   true  -> at least one path a human must merge, or no input at all
#   false -> nothing gated; the PR may auto-merge
# .github/workflows/auto-merge.yml runs the copy on main, so a PR can't edit
# this list to let itself through. Ambiguity resolves to "true".
set -uo pipefail

GATED='^(\.github/|scripts/ci/|\.claude/|CLAUDE\.md$|package\.json$|pnpm-lock\.yaml$|manifest\.json$)'

files="$(cat)"
# Here-string, not a pipe: under pipefail, grep -q exiting early could SIGPIPE
# the writer and turn a match into a miss on a long file list.
if [ -z "${files//[[:space:]]/}" ] || grep -qE "$GATED" <<< "$files"; then
  echo true
else
  echo false
fi
