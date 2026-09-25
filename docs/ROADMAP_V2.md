# Roadmap v2: what the church actually asked for

Captured 2026-09-25 from the owner, in his own terms, so that nothing is lost between
sessions. `HANDOVER.md` tracks progress; this file is the specification.

---

## 1. Geography: one tree, not three levels

The owner described "Global → country → main branch → sub branch", and then a case that
breaks a fixed four-level model: **Namibia falls under South Africa, and specifically under
Johannesburg**, with a single branch of its own (Windhoek).

So the model is **one self-referencing branch tree of arbitrary depth**, with country as an
attribute of each branch rather than a level of its own:

```
Global (the organisation)
└── South Africa
    ├── Johannesburg          MAIN
    │   ├── Pretoria          SUB
    │   ├── Durban            SUB   ("does not currently stand on its own")
    │   └── Windhoek (NA)     SUB   ← a Namibian branch under a South African parent
    └── Cape Town             MAIN
        ├── Kimberley         SUB
        ├── Upington          SUB
        ├── Springbok         SUB
        └── Victoria West     SUB
```

Consequences, and why this shape was chosen:

- "Namibia falls under South Africa" is not a separate relationship to maintain: it is what
  the tree already says, because Windhoek's parent is a South African branch. A country's
  oversight is simply the country of its branches' ancestors.
- Statistics roll up the tree (branch → its sub-branches → … ) **and** group by country,
  and the two answers can legitimately differ. Both are useful: "how many were baptised in
  Namibia" and "how many under Johannesburg's oversight, Windhoek included".
- Content inheritance follows the same tree: Windhoek sees its own content, Johannesburg's,
  and the church-wide content, which is what "they rely on our content" means.
- A country becomes "available on the platform" simply by having at least one branch.

**Open question for the owner.** He first called Johannesburg, Cape Town _and Durban_ the
main branches, then corrected himself: Durban does not stand on its own and sits under
Johannesburg. The correction is what is implemented; say if that is wrong.

## 2. Baptism is a statistic, not a page

This replaces the whole baptism-enquiry feature built in phase 6.

- **Remove:** the public `/baptism` page, the enquiry form, the `baptism_requests` table and
  its API module, the admin baptism inbox, the two baptism e-mail templates and the
  `baptismRequestReceived` notification job. The church does not run baptism days and takes
  no applications: _"people that normally want to be baptised all they have to do is show up
  at church during service, and once service is over, they will call out to ask if anyone
  wants to be baptised, and then they will be baptised, then that number will be added."_
- **Add:** a running count of people baptised, recorded per branch, that aggregates up the
  tree and by period. A branch adds to its number; South Africa's total is the sum of its
  branches; the global total is the sum of the countries.
- **Show it on the home page.** In the owner's words this is _"something really meaningful to
  the church"_, so it belongs where people will see it, with a year-to-date figure and the
  ability to see the total for a chosen year.

Baptism _stories_ remain an ordinary content type; only the enquiry flow goes.

## 3. The globe

An interactive Earth as the way into the church's geography.

- Countries that have branches are highlighted; clicking one opens it.
- Branches show as dots in that country's colour: **main branches a larger dot, sub-branches
  a smaller one**. Branch names appear as the viewer zooms in.
- Search by town or city name.
- Clicking a branch shows its live information: location, how many saints worship there, its
  baptism number, and who to contact — _"people in charge … like their picture and names
  along them, just properly arranged"_ — which matters for someone visiting from another
  branch.

## 4. Sermons and songs

- **Songs**: a new section, _"give it the Spotify system"_ — a player, continuous playback,
  playlists, artwork.
- **Sermons**: filter by **language**, by **date** (a from–to range, or just a month or a
  year), and by place.
- **Place-aware by default, without moving house.** The country you chose feeds you that
  country's sermons and songs first. You can look at another country's or branch's content
  without changing where you belong, and you can choose "all".
- **TOG (Truth Of God)** is a standalone section: the headquarters' sermons and songs from
  the overseer, Apostle Pastor Gino Jennings.
- **Holy Convocation** is a second standalone section: sermons and choir songs recorded while
  the Apostle travels the world. Content there feeds both the sermons and the songs pages.

## 5. People, roles and portals

- A **hierarchy** of authority: Super Admin → Main Admin → Admin → … , _"where the lower you
  go the lesser authority you have"_. Today's roles are a flat set of permission bundles;
  they need an explicit rank so that one administrator cannot act on a more senior one.
- **Auxiliary teams**: members appointed by an admin to a specific job — posting sermons,
  posting songs, and so on — with rights limited to that job and usually to their branch.

## 6. Messaging

Port the messaging from the old platform: conversations with participants and messages, and
a context per conversation (it had `personal | store | jobs`). Keep `personal` and `jobs`;
`store` waits for the marketplace.

## 7. Jobs

A board where members post openings for other members. _"People should obviously apply to
post jobs"_, and **every job posted or edited is reviewed and approved before anyone else
sees it** — the same submit → review → publish workflow the content module already has.

## 8. Explicitly deferred

- **Marketplace / store.** The old platform had products, orders, carts, reviews and merchant
  KYC. The owner: _"I had marketplace, but for now, don't create it, some other time."_

## 9. Carried over from the old platform

Things the old Flask app had that the rewrite should not lose:

| Old                                                               | Where it lands                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| `branches.parent_id` hierarchy                                    | Already present as `parentBranchId`.                    |
| `service_schedule` JSON                                           | `branch_schedules` (typed rows).                        |
| `calendar_data` JSON (one-off changes, e.g. "no evening service") | **Missing.** Branch calendar exceptions.                |
| `history_text`, `history_image`                                   | **Missing.** Branch history.                            |
| `banner_image`                                                    | `coverMediaId`.                                         |
| `member_count`                                                    | Derived from memberships, and shown on the branch card. |
| `map_url`                                                         | `mapsUrl`.                                              |
| Post visibility `public / members / leaders`                      | **Missing.** Content is public or unpublished.          |
| Post status `draft / pending / published / archived`              | Already present.                                        |
| `users.baptised`                                                  | `profiles.baptism_date`.                                |
| Messaging                                                         | §6.                                                     |
| Jobs (a stub template only)                                       | §7.                                                     |
| Store                                                             | §8, deferred.                                           |
