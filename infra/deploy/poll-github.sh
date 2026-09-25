#!/usr/bin/env bash
# Deploy whatever is on GitHub's `main`, if it differs from what is deployed.
#
# This is the GitHub-Actions-free path to "push to main means deploy": a systemd timer runs
# this every two minutes, so a push to GitHub reaches the server without any CI minutes,
# runner or stored deploy key. It only ever fast-forwards to the tracked remote branch.
#
# Usage: infra/deploy/poll-github.sh   (see docs/DEPLOYMENT.md §6)
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/church-platform}"
REMOTE="${DEPLOY_REMOTE:-github}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$APP_DIR"

git remote get-url "$REMOTE" >/dev/null 2>&1 || {
  echo "No '$REMOTE' remote in $APP_DIR; nothing to poll." >&2
  exit 0
}

git fetch --quiet "$REMOTE" "$BRANCH"
remote_rev="$(git rev-parse "$REMOTE/$BRANCH")"
head_rev="$(git rev-parse HEAD)"

# What is actually running, not merely what is checked out: a deploy that was interrupted
# after the checkout would otherwise look complete and production would stay behind for good.
deployed_rev=''
if [ -s "$APP_DIR/.deployed-revision" ]; then
  deployed_rev="$(git rev-parse "$(cat "$APP_DIR/.deployed-revision")" 2>/dev/null || true)"
fi
[ -n "$deployed_rev" ] || deployed_rev="$head_rev"

if [ "$deployed_rev" = "$remote_rev" ]; then
  exit 0
fi

# Only move forward: never deploy a rewritten history automatically.
if ! git merge-base --is-ancestor "$deployed_rev" "$remote_rev"; then
  echo "Refusing to deploy: $REMOTE/$BRANCH ($remote_rev) is not a descendant of the deployed $deployed_rev." >&2
  echo 'Deploy by hand after checking what changed.' >&2
  exit 1
fi

echo "Deploying $REMOTE/$BRANCH: $(git log -1 --pretty='%h %s' "$remote_rev") (running: ${deployed_rev:0:7})"
git reset --hard --quiet "$remote_rev"
exec "$APP_DIR/infra/deploy/deploy.sh"
