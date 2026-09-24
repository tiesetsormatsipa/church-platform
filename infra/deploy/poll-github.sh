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
local_rev="$(git rev-parse HEAD)"
remote_rev="$(git rev-parse "$REMOTE/$BRANCH")"

if [ "$local_rev" = "$remote_rev" ]; then
  exit 0
fi

# Only move forward: never deploy a rewritten history automatically.
if ! git merge-base --is-ancestor "$local_rev" "$remote_rev"; then
  echo "Refusing to deploy: $REMOTE/$BRANCH ($remote_rev) is not a descendant of the deployed $local_rev." >&2
  echo 'Deploy by hand after checking what changed.' >&2
  exit 1
fi

echo "New commit on $REMOTE/$BRANCH: $(git log -1 --pretty='%h %s' "$remote_rev")"
git reset --hard --quiet "$remote_rev"
exec "$APP_DIR/infra/deploy/deploy.sh"
