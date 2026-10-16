#!/usr/bin/env bash
# Usage: scripts/remove-worktree.sh <plan>
# Removes ../mcp_assist_3d-<plan> and deletes branch <plan>. No force: git refuses if dirty or unmerged.
set -euo pipefail

plan="${1:-}"
if [[ -z "$plan" ]]; then
  echo "usage: $0 <plan>" >&2
  exit 1
fi

common="$(git rev-parse --path-format=absolute --git-common-dir)"
main_dir="$(dirname "$common")"
path="$(dirname "$main_dir")/mcp_assist_3d-$plan"

git -C "$main_dir" worktree remove "$path" || {
  echo "error: could not remove worktree $path (dirty or missing?)" >&2
  exit 1
}
git -C "$main_dir" branch -d "$plan" || {
  echo "error: branch $plan not deleted (unmerged? fast-forward main first)" >&2
  exit 1
}
echo "removed $path and branch $plan"
