#!/usr/bin/env bash
# git post-receive hook for the bare repository on the server.
#
# Installed as /srv/church-platform.git/hooks/post-receive. Pushing `main` here updates the
# working clone in APP_DIR and deploys it; other branches are stored but change nothing.
#
#   git remote add production root@<host>:/srv/church-platform.git
#   git push production main
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/church-platform}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

while read -r _old new ref; do
  branch="${ref#refs/heads/}"
  if [ "$branch" != "$DEPLOY_BRANCH" ]; then
    echo "Received $branch; only $DEPLOY_BRANCH deploys."
    continue
  fi
  echo "Updating $APP_DIR to $new"
  # APP_DIR is an ordinary clone whose origin is this bare repository, so the deploy script
  # can read the revision it is building. Clear the hook's own git environment first.
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_QUARANTINE_PATH -u GIT_INDEX_FILE bash -c "
    set -euo pipefail
    git -C '$APP_DIR' fetch --quiet origin '$DEPLOY_BRANCH'
    git -C '$APP_DIR' reset --hard --quiet '$new'
    '$APP_DIR/infra/deploy/deploy.sh'
  "
done
