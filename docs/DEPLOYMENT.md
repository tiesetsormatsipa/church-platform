# Deployment

How the Church Platform runs in production, and how a change gets there.

Production today is `https://church.techtursolutions.com` on a shared VPS that also hosts
several unrelated sites. Everything belonging to this platform runs in Docker under the
compose project `church-platform`, binds only to the loopback interface, and is reached
through the host's existing Nginx.

---

## 1. What runs where

| Service    | Image                                     | Reachable at                       |
| ---------- | ----------------------------------------- | ---------------------------------- |
| `web`      | built from `infra/docker/Dockerfile` (web) | `127.0.0.1:3500` → Nginx `/`       |
| `api`      | … (api)                                    | `127.0.0.1:4400` → Nginx `/api`, `/socket.io` |
| `worker`   | … (worker)                                 | no port; consumes the queues       |
| `migrate`  | … (migrate)                                | one-shot, runs `prisma migrate deploy` |
| `postgres` | `postgres:18-alpine`                       | compose network only               |
| `redis`    | `redis:7-alpine`                           | compose network only               |
| `storage`  | `rustfs/rustfs:1.0.0`                      | `127.0.0.1:9100` → Nginx `/media`  |
| `mail`     | `axllent/mailpit` (profile `mailsink`)     | `127.0.0.1:8026`, see §5           |

Paths on the server:

| Path                       | What                                                      |
| -------------------------- | --------------------------------------------------------- |
| `/srv/church-platform.git` | Bare repository; its `post-receive` hook deploys.          |
| `/srv/church-platform`     | The working clone that is built and run.                   |
| `/srv/church-platform.env` | Configuration and secrets, `chmod 600`. **Never in git.**  |
| `/var/lock/church-deploy.lock` | Serialises concurrent deploys.                        |

---

## 2. First-time setup

```bash
ssh root@<host>
mkdir -p /srv && cd /srv
git init --bare --initial-branch=main church-platform.git
git clone /srv/church-platform.git church-platform
cd church-platform && git remote add github https://github.com/<owner>/church-platform.git
```

Push the code, then install the hook and the environment file:

```bash
# on your machine
git remote add production root@<host>:/srv/church-platform.git
git push production main
```

```bash
# on the server
cp /srv/church-platform/infra/deploy/post-receive.sh /srv/church-platform.git/hooks/post-receive
chmod +x /srv/church-platform.git/hooks/post-receive /srv/church-platform/infra/deploy/*.sh
```

Write `/srv/church-platform.env` (see §3), then Nginx:

```bash
cp /srv/church-platform/infra/nginx/church.conf /etc/nginx/sites-available/church
ln -sf /etc/nginx/sites-available/church /etc/nginx/sites-enabled/church
nginx -t && systemctl reload nginx
```

TLS comes from Certbot. For a new domain:
`certbot --nginx -d church.techtursolutions.com`.

Finally seed the organisation and roles once:

```bash
cd /srv/church-platform
docker compose -f infra/docker/compose.prod.yml --env-file /srv/church-platform.env \
  run --rm -e DATABASE_URL="postgresql://church:<password>@postgres:5432/church" \
  migrate pnpm --filter @church/database exec node dist/seed/cli.js
```

---

## 3. Configuration

`/srv/church-platform.env`, read by compose with `--env-file`. Generate every secret on the
server (`openssl rand -base64 48`) so it never travels through a terminal history or a chat.

| Variable                                     | Meaning                                                      |
| -------------------------------------------- | ------------------------------------------------------------ |
| `APP_ORIGIN`                                 | Public origin. E-mail links and the CSRF origin check use it. |
| `POSTGRES_PASSWORD`                          | Database password (the URL is assembled from it).             |
| `INTERNAL_API_TOKEN`                         | Lets the web server name the visitor's IP to the API (ADR-024). |
| `REVALIDATE_SECRET`                          | Shared by worker and web for `/internal/revalidate`.          |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`   | Object storage credentials.                                   |
| `SMTP_*`, `MAIL_FROM`, `MAIL_PROVIDER`       | Outgoing e-mail, see §5.                                      |
| `WEB_PORT`, `API_PORT`, `S3_PORT`            | Loopback ports Nginx proxies to. Change if they clash.        |
| `WORKER_CONCURRENCY`                         | Jobs processed at once per queue (default 5).                 |
| `API_DOCS_ENABLED`                           | Leave `false`; `/api/docs` is a development tool.             |

The API and worker validate their environment at start-up and refuse to run with anything
missing or malformed, so a typo fails the deploy rather than producing a half-configured site.

---

## 4. Deploying a change

**Any of these runs the same `infra/deploy/deploy.sh`**, which takes a lock, builds the
images, runs `prisma migrate deploy` through the one-shot `migrate` service, restarts the
services and waits for their health checks.

1. **Push to the server** (works with no GitHub involvement at all):

   ```bash
   git push production main
   ```

2. **Push to GitHub.** The server polls `github/main` every two minutes and deploys anything
   new. Enable it once:

   ```bash
   cp /srv/church-platform/infra/deploy/systemd/church-deploy-poll.* /etc/systemd/system/
   systemctl daemon-reload && systemctl enable --now church-deploy-poll.timer
   ```

   It only ever fast-forwards: if `main` is rewritten, it refuses and says so, rather than
   deploying a history nobody reviewed.

3. **GitHub Actions** (`.github/workflows/deploy.yml`) does the same over SSH when the repo
   has `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER` and `DEPLOY_KNOWN_HOSTS` secrets. Use a
   deploy key made for this, not a personal key. Redundant with the poller: keep whichever
   you prefer.

Deploying by hand, e.g. to skip a rebuild:

```bash
ssh root@<host> '/srv/church-platform/infra/deploy/deploy.sh --no-build'
```

### Rolling back

```bash
ssh root@<host>
cd /srv/church-platform
git reset --hard <previous-commit>
./infra/deploy/deploy.sh
```

Migrations are not rolled back automatically. Any migration that is unsafe to leave in place
needs a new forward migration.

---

## 5. E-mail

The worker sends every transactional message. Without a provider it delivers to the bundled
Mailpit **catch-all**, so nothing is lost and nothing leaves the server, but **real people
never receive their verification links**. Read the inbox over a tunnel:

```bash
ssh -L 8026:127.0.0.1:8026 root@<host>   # then open http://localhost:8026
```

To switch to a real provider, edit `/srv/church-platform.env`:

```
SMTP_HOST=smtp.provider.example
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<username>
SMTP_PASSWORD=<password>
MAIL_FROM="First Church <no-reply@yourdomain>"
```

then redeploy and drop `--profile mailsink`. Nothing else changes. Set SPF, DKIM and DMARC
for the sending domain, or the mail will land in spam.

---

## 6. Operations

```bash
cd /srv/church-platform
C="docker compose -f infra/docker/compose.prod.yml --env-file /srv/church-platform.env"

$C ps                        # what is running and healthy
$C logs -f --tail=100 api    # or web, worker
$C restart worker
curl -s localhost:4400/api/health/ready   # database, redis, storage
```

### Backups

`prisma migrate deploy` never drops data, but take backups anyway:

```bash
$C exec -T postgres pg_dump -U church church | gzip > church-$(date +%F).sql.gz
```

Restore into a **fresh** database and point the stack at it; never restore over a running
one. Object storage lives in the `church-platform_storage` Docker volume; back it up with
`docker run --rm -v church-platform_storage:/data -v $PWD:/out alpine tar czf /out/storage.tgz /data`.

### Health

Every service except the worker has a Docker health check, and `deploy.sh` fails the deploy
if anything is still unhealthy after three minutes. The worker has no HTTP surface; check it
with `$C logs worker` and by watching queue depth (`/api/health/ready` reports the stores).

---

## 7. Things to know about this particular server

- It is **shared with other sites**. Ports 3000, 3001, 3010, 3100, 3101, 3200, 3201, 3400,
  4000, 4010, 4200 and 4300 were already taken, which is why this stack uses 3500/4400/9100.
  Check with `ss -ltn` before changing a port.
- The host runs its own PostgreSQL, Redis, MySQL and Meilisearch for those other sites. This
  platform deliberately uses **its own** containerised Postgres and Redis and touches none of
  them.
- The previous Flask application for this domain is archived (source, uploads, MySQL dump,
  Nginx block and systemd unit) outside this repository. Its service is stopped, not deleted:
  `systemctl start church` and restoring the old Nginx block brings it back.
