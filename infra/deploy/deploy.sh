#!/usr/bin/env bash
# Build and start the production stack from the checkout in APP_DIR.
#
# Called by the git post-receive hook (`git push production main`), by the GitHub Actions
# workflow over SSH, and by the polling timer. Safe to run concurrently: a lock file makes
# a second deploy wait rather than build over the first.
#
# Usage: infra/deploy/deploy.sh [--no-build]
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/church-platform}"
ENV_FILE="${ENV_FILE:-/srv/church-platform.env}"
COMPOSE_FILE="$APP_DIR/infra/docker/compose.prod.yml"
LOCK_FILE="${LOCK_FILE:-/var/lock/church-deploy.lock}"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31mdeploy failed:\033[0m %s\n' "$*" >&2; exit 1; }

[ -d "$APP_DIR" ] || fail "APP_DIR $APP_DIR does not exist"
[ -f "$ENV_FILE" ] || fail "environment file $ENV_FILE is missing"
[ -f "$COMPOSE_FILE" ] || fail "compose file $COMPOSE_FILE is missing"

exec 9>"$LOCK_FILE"
if ! flock -w 900 9; then fail 'another deploy is still running after 15 minutes'; fi

cd "$APP_DIR"
REVISION="$(git rev-parse --short HEAD)"
log "Deploying $REVISION ($(git log -1 --pretty=%s))"

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

if [ "${1:-}" != '--no-build' ]; then
  log 'Building images'
  compose build
fi

# The one-shot migrate service runs `prisma migrate deploy` and must succeed before the
# applications are replaced; `up` below waits on it (service_completed_successfully).
log 'Applying database migrations'
compose run --rm migrate

log 'Starting services'
compose up -d --remove-orphans

log 'Waiting for health checks'
deadline=$((SECONDS + 180))
while [ $SECONDS -lt $deadline ]; do
  unhealthy="$(compose ps --format '{{.Service}} {{.Health}}' | awk '$2 != "" && $2 != "healthy" {print $1}' || true)"
  [ -z "$unhealthy" ] && break
  sleep 5
done
[ -n "${unhealthy:-}" ] && fail "services did not become healthy: $unhealthy"

log 'Removing unused images'
docker image prune -f >/dev/null 2>&1 || true

printf '%s\n' "$REVISION" > "$APP_DIR/.deployed-revision"
log "Deployed $REVISION"
