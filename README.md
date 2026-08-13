# Pure planner

A kanban board for a release plan, in **one HTML file**. Releases are columns,
each carrying its question, the argument for it and its gate; the work in a
release is cards you drag between them. It reads and writes a single JSON file
in a GitHub repository, so a person and an assistant can both edit the same
plan and see each other's changes.

No build step, no dependencies, no CDN, no framework, no server. It talks to
`api.github.com` and nothing else.

## Where to open it from

**Anywhere that allows an ordinary outbound request.** GitHub Pages, a file on
disk opened straight in the browser, `python3 -m http.server` — all fine. The
GitHub API answers cross-origin requests from any origin, including the `null`
one a `file://` page has.

**A published Claude artifact will not work**, and this is worth stating
plainly because it looks like it should. The viewer wraps the page in a content
policy that blocks every request to an external host, so the call to
`api.github.com` never leaves — `fetch` throws before there is any status to
read. The board says so rather than blaming your network, but there is no
setting that fixes it and no capability that can be granted. An artifact is a
preview of the board, not the board.

## Plugging in a project

1. **Take a copy of `index.html`.** Anywhere — another repo, a folder, a
   phone. There is nothing to install. See *Where to open it from* above.
   It is named `index.html` here because that is what GitHub Pages serves at a
   bare directory URL; a copy going into somebody's Downloads folder is worth
   renaming to `pure-planner.html`, where four other things are called
   `index.html` already.
2. **Mint a fine-grained GitHub token**: that repository only, **Contents:
   read and write**. Nothing else. Revoke it whenever you like.
3. **Open it and press ⚙**, then give it the owner, the repo, the branch, and
   the path you want the data kept at — `docs/roadmap.json` is the convention.
4. **If the file is not there it offers to create it**, with one empty release,
   so you never meet a blank page.
5. **Check the commit message.** See below — this is the one setting that
   bites if you skip it.

Nothing about any one project is compiled in. Point it somewhere else and it
manages that project instead.

## The commit message setting

Saves are commits. The default message ends with **`[skip ci]`**, which tells
GitHub Actions not to run a workflow for it.

**That default exists because of a real cost.** Pure Tracker's `build.yml` is
`on: push: branches: ["**"]`, so without the marker every drag of a card would
start an Android build — a job that takes minutes and produces an APK nobody
asked for.

Your project may use different CI, may want saves to trigger something, or may
have no CI at all. So it is a field rather than a constant.

## The data

```jsonc
{
  "title": "Pure Tracker",
  "releases": [
    { "id": "R1.4",
      "question": "Does a recording survive the phone trying to kill it?",
      "size": "M",
      "prose": "…why this release exists…",
      "gate":  "…how you would know it worked…",
      "items": [
        { "title": "Audit the wake lock on every exit path",
          "body": "…", "cutLine": false, "done": false }
      ] },

    // A shipped release keeps only enough to be a spine on the board.
    { "id": "R1.05", "question": "Can I run the gates from the phone?",
      "shipped": true }
  ]
}
```

**Array order is the order.** There are no `order` fields, no item ids and no
foreign keys — dragging moves an entry in an array, and there is nothing that
can fall out of step with anything else. You can hand-write your first file in
a text editor in about a minute.

Every field except `id` is optional.

## What it does

- **Drag a card** between releases, or within one, to reorder
- **Drag a column** to move a release earlier or later
- **Edit anything in place** — click the text and it becomes a field. Nothing
  is ever edited in a dialog; the only two sheets are settings, and confirming
  something you cannot undo
- **Tick an item done**; the column head counts `3 of 6`
- **Add a release** with the `+` between two columns; **delete** one with the
  `×` on its head, which names what goes with it first
- **Grab-pan** the board by dragging its background, with a mouse. On touch the
  browser's own scrolling is used instead, because reimplementing momentum and
  rubber-banding is a losing game
- **Keep shipped releases in a rail** down the side — hide it, reveal it,
  scroll it — so a long history does not eat the width

## What it deliberately does not do

- **No renumbering.** Inserting between two numeric ids proposes the one in
  between — `R1.1` and `R1.2` give you `R1.15` — but a release keeps its id for
  life and dragging never renames anything. Identity and position are separate
  things, and a plan whose numbers move under you cannot be referred to.
- **No nesting.** A release has items; items have no children. Sub-tasks go in
  an item's body as a `- [ ]` checklist.
- **No GitHub issues.** Items live in the JSON. One record, no sync, nothing
  that can disagree with itself.
- **No accounts, no server, no analytics.** The token is yours, stays in your
  browser, and is the only credential involved. Somewhere that forbids storage
  — a sandboxed frame, a browser with it switched off — it says so and works
  for the session anyway, rather than failing to load.

## Conventions that are Pure Tracker's, not the tool's

Worth separating so another project knows what it may ignore.

**Insert-numbering** (`R1.15` between `R1.1` and `R1.2`), the **cut line** flag
marking the first thing a release drops if it runs long, and **shipped releases
folded into the rail** are all this project's habits. The tool offers them and
requires none of them. A project that calls its releases *Spring*, *Summer* and *Autumn*
simply gets no proposed id when it inserts one, which is the tool staying out
of the way.

## Two-way editing

`roadmap.json` is the one record. **Saving is debounced** a few seconds after
you stop, so the window in which two people can clash is seconds rather than
however long a tab was open.

Writes carry the file's blob SHA, so a save based on a stale copy is **rejected
rather than allowed to clobber**. When that happens the board stops, says what
changed, and offers reload or overwrite. It never picks a winner for you —
catching a conflict and resolving one are different problems, and only the
first has a right answer.

The board re-checks the file when the tab regains focus, and `↻` forces it.
There is no polling: a phone should not wake every thirty seconds to ask a
question whose answer is almost always no.

## Where this lives

Here, and served from here by GitHub Pages. **This repository is public and
holds nothing but the tool** — no owner, no repository name, no path, no token.
That is what makes publishing it harmless, and it is the same test the project
that built it applies to its own APK: *could a stranger holding this act as
me?* They open it and find empty fields.

It was in that project's own repository until the day it needed a URL. A
published page could not reach `api.github.com`, and Pages was the only route
to something openable on a phone — but Pages on a private repository publishes
everything beside it, so the tool moved out and the plan stayed behind. The
move was the one that had always been intended; only the reason was different.

**Pure Tracker is its first user, not its owner.** Its plan lives in its own
private repository and is read from here over the authenticated API. Nothing
about it is served by this site.
