# apps/web: notes for agents

Next.js **16** with the App Router, React 19 and Tailwind CSS 4. Much of what you remember
from Next.js 13–15 has changed. The documentation for the installed version ships in
`node_modules/next/dist/docs/` — read the relevant page before using an API.

## Next.js 16 facts that matter here

- **Async request APIs:** `params`, `searchParams`, `cookies()` and `headers()` are
  promises. Page props are typed with the generated globals `PageProps<'/route'>` and
  `LayoutProps<'/route'>` (run `next typegen`, part of `pnpm typecheck`).
- **`proxy.ts` replaces `middleware.ts`** (not used yet; planned for CSP nonces).
- **Turbopack** is the default bundler for `dev` and `build`.
- **Caching:** `fetch` is not cached by default. We opt in per request with
  `next: { revalidate, tags }` (see `src/lib/api/server.ts`) and call `connection()` first
  so nothing is fetched at build time (the API is not running then).
  `revalidateTag(tag, 'max')` takes a second argument in v16.
- **Streaming and status codes:** content inside a Suspense boundary (including
  `loading.tsx`) streams with status 200, so `notFound()`/`redirect()` there become soft.
  Only listing pages have `loading.tsx`, inside route groups such as `events/(list)/`.
- `output: 'standalone'` for the Docker image.

## Layout of `src/`

| Path                                                                                                           | Contents                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `app/(home)`, `app/feed`, `app/events`, `app/news`, `app/sermons`, `app/branches`, `app/baptism`, `app/search` | Public pages                                                                                                   |
| `app/(auth)`                                                                                                   | Sign-in, sign-up, verify e-mail, forgot/reset password (shared centred layout)                                 |
| `app/profile`                                                                                                  | Account area (requires a session; `requireUser()`)                                                             |
| `app/posts/[slug]`, `app/*/[slug]`                                                                             | Detail pages via `loadContent(prefix, slug)` (canonical redirects, legacy ids)                                 |
| `app/sitemap.ts`, `app/robots.ts`                                                                              | SEO                                                                                                            |
| `components/layout`                                                                                            | Header, branch switcher, account menu, tab bar, footer                                                         |
| `components/content`                                                                                           | Cards, badges, detail view, timeline, markdown, JSON-LD                                                        |
| `components/account`, `components/auth`, `components/forms`                                                    | Client forms                                                                                                   |
| `lib/api/server.ts`                                                                                            | `publicApi()` (cached, anonymous), `visitorApi()` (uncached, per visitor), `userApi()` (signed in), `unwrap()` |
| `lib/api/client.ts`                                                                                            | Browser client with CSRF header, `ApiError`, `ensureOk()`                                                      |
| `lib/*`                                                                                                        | Formatting (`format.ts`), context/query helpers, ICS, JSON-LD, safe redirects, session                         |

## Rules

- Server Components by default; `'use client'` only where needed.
- No Server Actions for domain writes (ADR-021): the browser calls the API directly.
- Forms: react-hook-form + the shared Zod schema, `SubmitButton`, `method="post"`,
  server-rendered `defaultValue`s, `applyApiError()` for server errors.
- Client Components rendered on the server must produce identical markup on the client:
  avoid `Date.now()` and locale formatting there (see AGENTS.md §6).
- Tests: unit tests next to the code (`*.test.ts(x)`), E2E in `e2e/` (see AGENTS.md §8).
