# UX system

How the platform looks, reads and behaves. The implementation lives in `packages/ui`
(tokens in `src/styles/globals.css`, components in `src/components`) and is used by
`apps/web`. When this document and the code disagree, fix one of them in the same change.

---

## 1. Principles

1. **Calm and trustworthy.** Warm neutrals, one deep navy, a restrained gold accent, serif
   headings for warmth, generous spacing. No gimmicks, no stock "church" clichés.
2. **Context is always visible.** Every listing says whether it shows the whole church or
   one branch, and every item says where it comes from (church-wide or a branch badge).
3. **Mobile first.** Most visitors use phones. Design at 360 px, enhance up to 1440 px.
4. **Plain, kind language.** Short sentences, no jargon, no blame. Empty states stay
   friendly: _"The feed is quiet for now"_.
5. **Accessible by default.** WCAG 2.2 AA is a requirement, verified by tests (token
   contrast unit tests, axe in every Playwright page test).
6. **Fast.** Server-rendered pages, little client JavaScript, self-hosted fonts, responsive
   images from the media pipeline.

## 2. Foundations

### Colour

All colour comes from semantic tokens; components never use raw hex values or Tailwind's
palette. Themes: light (default), dark, or system (`.light` / `.dark` on `<html>`, else
`prefers-color-scheme`). Components never use `dark:` variants; the tokens change instead.

| Token (Tailwind utility)                                                                   | Use                                                               |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `background`, `surface`, `surface-muted`, `surface-sunken`                                 | Page, cards, subtle fills, wells                                  |
| `foreground`, `muted` (`text-muted`), `subtle` (`text-subtle`)                             | Body text, secondary text, hints                                  |
| `primary` (navy `#1d3354`), `primary-soft`                                                 | Primary actions, active chips; soft highlights                    |
| `link`                                                                                     | Inline links (separate from `primary` so dark mode keeps ≥ 4.5:1) |
| `accent` (gold), `accent-strong`, `accent-soft`                                            | Branch badges, eyebrows, the featured-event rule                  |
| `success`, `warning`, `danger`, `info` (+ `-soft`)                                         | Status and alerts                                                 |
| `border`, `border-strong`, `ring`                                                          | Dividers, control borders, focus rings                            |
| `type-announcement`, `type-news`, `type-event`, `type-sermon`, `type-baptism`, `type-post` | The small coloured label naming a content type                    |

`packages/ui/src/styles/contrast.test.tsx` checks every text/background pair used by the
components in both themes (≥ 4.5:1 for text, ≥ 3:1 for UI boundaries).

### Typography

- **Inter** (variable) for UI and body; **Source Serif 4** for headings, titles of
  content, and long-form article text (`prose-church`). Both self-hosted (ADR-015).
- Base size 16 px (inputs 16 px on phones to prevent zoom). Headings scale from
  `text-3xl` on phones to `text-5xl` on desktop for page titles.
- Long text is set at ~65 characters per line (`ReadingContainer`, `--container-reading`
  42 rem).

### Space, shape, depth, motion

- Tailwind's 4 px spacing scale; page gutters 16 px on phones, container max width 76 rem.
- Radii: `rounded-lg` for controls, `rounded-xl` for cards, `rounded-full` for chips.
- Shadows: `shadow-card` (resting), `shadow-raised` (hover, dialogs' surroundings),
  `shadow-overlay` (menus, sheets).
- Motion is short (150–200 ms, `ease-out-soft`) and disabled under
  `prefers-reduced-motion`.

### Iconography

Lucide icons only, `aria-hidden` when decorative, 16–20 px next to text. **No emoji** in
navigation or labels.

## 3. Components (`@church/ui/*`)

| Component                                                                   | Notes                                                                                                                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`, `buttonVariants`                                                  | `primary`, `secondary`, `soft`, `ghost`, `danger`, `link`; sizes `sm`/`md`/`lg`/`icon`. `loading` shows a spinner and disables. Links styled as buttons use `buttonVariants()` on `<Link>`. |
| `Field`, `Label`, `Input`, `Textarea`, `NativeSelect`, `Checkbox`           | `Field` wires label, description and error (`aria-describedby`, `aria-invalid`). Native `<select>` on purpose (best on phones).                                                             |
| `Alert`                                                                     | `info`, `success`, `warning`, `danger` (danger uses `role="alert"`).                                                                                                                        |
| `Badge`                                                                     | Scope and status labels.                                                                                                                                                                    |
| `Card`, `Container`, `ReadingContainer`, `Separator`, `Skeleton`, `Spinner` | Layout and loading.                                                                                                                                                                         |
| `EmptyState`                                                                | Icon, title, description, action; `headingLevel` when it is the page's main content (not-found).                                                                                            |
| `Dialog`, `Sheet`, `Popover`, `Menu`, `Tabs`, `Toast`                       | Base UI primitives with our styling; focus is trapped and restored. Sheets slide up on phones.                                                                                              |
| `SegmentedNav`, `segmentClass`, `chipClass`                                 | Link-based filters (state lives in the URL).                                                                                                                                                |
| `Avatar`                                                                    | Image with initials fallback.                                                                                                                                                               |

App-level components live in `apps/web/src/components/` (`layout/`, `content/`,
`account/`, `auth/`, `forms/`).

## 4. Patterns

### Navigation

- Desktop: header with primary navigation (Home, Feed, Events, Sermons, News, Baptism,
  Branches), branch switcher, search and account menu.
- Phones: compact header (logo, branch switcher, search, account) and a **bottom tab bar**
  (Home, Feed, Events, Sermons, More). The body reserves space for it, including the
  safe-area inset, so it never covers content.
- Active items use `aria-current="page"`.

### Branch context

- "Global" (the whole church) or one branch, chosen with the branch switcher or the chips
  on the home page. The choice lives in `?branch=<slug>` so views are shareable; the last
  choice is remembered in the `cp_branch` cookie only for defaults (e.g. the baptism form).
- Listings show a context bar: _"Showing Pretoria and church-wide news"_ with a segmented
  filter (Pretoria + church-wide / Pretoria only / Church-wide only).
- Every item shows a **Church-wide** (navy, globe icon) or **branch** (gold, pin icon) badge.

### Content

- Cards: type label, scope badge, pinned/status badges, serif title (the only link; the
  whole card is clickable via a stretched link), summary, one line of metadata.
- Events show a calendar date tile; cancelled events are struck through with a status
  badge and an alert on the detail page. Detail pages offer **Add to calendar** (.ics),
  directions and registration where available.
- Sermons show speaker, date, scripture and length, with an audio/video player on the
  detail page and the transcript as the text alternative.
- Listings are grouped where it helps (events by month) and paginate with **Show more**
  (no infinite scroll, so the footer stays reachable and position is stable).

### States

Every page has: a **loading** skeleton shaped like the content (listing pages only; see
AGENTS.md §6 on status codes), a friendly **empty** state with a next step, an **error**
state with a retry, and a **not-found** page that offers home and search.

### Forms

- One column on phones; related short fields side by side from `sm`.
- Labels above fields, optional fields marked "(optional)" instead of asterisks, hints
  under the field, errors in plain words next to the field **and** summarised in an alert
  at the top on submit.
- Buttons say what they do ("Send request", "Save changes"), stay disabled until the page
  is interactive, and show a spinner while working. Success moves focus to a confirmation.
- Passwords have a show/hide toggle; e-mail and phone fields set `type`, `autocomplete` and
  `inputmode`.

### Writing style

- South African English with en-GB conventions: "e-mail", "programme", "organisation".
- Dates like "Sun 6 Aug 2026", times in 24-hour format ("09:30"), in the branch's time
  zone (Africa/Johannesburg by default). Relative times ("3 hours ago") only for the last
  week.
- Branch names as the church writes them (data-driven); legacy spellings such as
  "Johanessburg" or "PTA" are kept in `branches.legacy_label` and never shown.

## 5. Accessibility checklist

Landmarks (`header`, `nav` with labels, `main#main`, `footer`), a skip link, one `h1` per
page and ordered headings, labelled controls, visible focus rings (`ring` token),
keyboard access for every interaction, `aria-live` feedback for asynchronous results
(toasts, "load more" errors), text alternatives for images and media, touch targets of
at least 24 × 24 px (40 px or more for primary controls), no information conveyed by colour alone, reduced motion
respected, and content readable at 200 % zoom without horizontal scrolling.
