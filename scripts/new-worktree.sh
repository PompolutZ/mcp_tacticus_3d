#!/usr/bin/env bash
# Usage: scripts/new-worktree.sh <plan>
#        scripts/new-worktree.sh --env-only <plan>
# Creates ../mcp_assist_3d-<plan> on branch <plan> from main, copies .env* files, runs pnpm install.
# --env-only: only copy .env* files into the existing worktree.
set -euo pipefail

env_only=0
if [[ "${1:-}" == "--env-only" ]]; then
  env_only=1
  shift
fi
plan="${1:-}"
if [[ -z "$plan" ]]; then
  echo "usage: $0 [--env-only] <plan>" >&2
  exit 1
fi

common="$(git rev-parse --path-format=absolute --git-common-dir)"
main_dir="$(dirname "$common")"
path="$(dirname "$main_dir")/mcp_assist_3d-$plan"

# Prints paths only, never contents.
copy_env() {
  local src rel
  while IFS= read -r -d '' src; do
    rel="${src#"$main_dir"/}"
    mkdir -p "$path/$(dirname "$rel")"
    cp "$src" "$path/$rel"
    echo "copied $rel"
  done < <(find "$main_dir" \( -name node_modules -o -name .git \) -prune -o -type f -name '.env*' -print0)
}

if [[ $env_only -eq 1 ]]; then
  [[ -d "$path" ]] || { echo "error: worktree $path does not exist" >&2; exit 1; }
  copy_env
  exit 0
fi

[[ -e "$path" ]] && { echo "error: path exists: $path" >&2; exit 1; }
if git -C "$main_dir" show-ref --verify --quiet "refs/heads/$plan"; then
  echo "error: branch exists: $plan" >&2
  exit 1
fi

git -C "$main_dir" worktree add "$path" -b "$plan" main
copy_env
(cd "$path" && pnpm install --frozen-lockfile)
echo "$path"
