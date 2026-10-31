# Pure planner

A kanban board for a release plan, in **one HTML file**. Releases are columns,
each carrying its question, the argument for it and its gate; the work in a
release is cards you drag between them. It reads and writes a single JSON file
in a GitHub repository, so a person and an assistant can both edit the same
plan and see each other's changes.

No build step, no dependencies, no CDN, no framework, no server. It talks to
`api.github.com` and nothing else.

## Which build is this

**⚙ Settings carries one**, with a copy button beside it: `v29 · 2026-09-12`,
the count of commits that changed the file and the date of the last. Compare it
before wondering whether an upload took — a page served from a static host
looks identical whether or not the copy behind it is the one you meant.

Whoever edits the file bumps it. There is no build step to do it for you, which
is the price of a tool with no build step.

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

1. **Take a copy of `index.html`.** Anywhere — another repo, a folder,
   a phone. There is nothing to install. See *Where to open it from* above.
   Rename it `index.html` if you serve it from GitHub Pages and want the bare
   directory URL; the descriptive name is for the copy that lives in somebody's
   Downloads folder among four other things called `index.html`.
2. **Mint a fine-grained GitHub token**: that repository only, **Contents:
   read and write**. Nothing else. Revoke it whenever you like.
3. **Open it and press ⚙**, paste the token, then give it the owner, the repo
   and the branch. Or **drop in a config file** and skip the three fields; see
   below.
4. **If the file is not there it offers to create it**, with one empty release,
   so you never meet a blank page.

**The file and the commit message are not on the panel.** They are answered
once per project and then never touched, so they come from the config file or
from the defaults — `docs/roadmap.json`, and a message ending `[skip ci]`. See
*The commit message setting* below, which is the one that bites if a project
needs a different answer: change it in the config file and drop that in.

Nothing about any one project is compiled in. Point it somewhere else and it
manages that project instead.

## The config file

Five of the six settings are the same for everybody working on a project. Put
them in a file called **`pure-planner-config.json`**, commit it beside the
plan, and the answer to *"how do I get the board?"* becomes **open it and drop
this in** rather than a table of values to retype.

```json
{
  "pureplanner": 1,
  "owner": "octocat",
  "repo": "my-project",
  "branch": "main",
  "path": "docs/roadmap.json",
  "message": "Roadmap: update from the board [skip ci]"
}
```

**There is a dashed drop zone at the top of the settings panel**, and another
on the first-run panel before anything is configured. Anywhere on either panel
accepts a drop — the zone is where it says so — and **clicking it opens a file
chooser**, which is how this works on a phone, where there is nothing to drag
from.

Write one by hand — it is six lines and five of them are copied off the
repository's own page. There used to be a **Save a config file** button on the
settings panel and it was removed: composing a config is a once-per-project
job, and that panel is opened for the token, which is a per-person and
per-device one.

`"pureplanner": 1` is what makes it a config file rather than any other JSON.
The file it will be dropped next to is `roadmap.json`, which is also JSON and
would otherwise parse happily and configure the board to nothing.

**It never carries the token, and this is not negotiable.** A config file is
made to be committed, mailed and pasted into chats — that is the entire point
of it — so a format that *may* carry a credential is a format whose purpose is
moving credentials around. The token is typed once per browser and stays there.
The test to apply is the one this tool's first project applies to its own
Android build: **could a stranger holding this file act as me?** No — it names
a repository, which is not a secret from anybody who can already read it.

Dropping a config while there are unsaved edits **saves them to the project you
are leaving first**, then switches. A drop is most likely a few seconds after
you stopped editing, which is exactly the window the debounce holds open.

**A dropped config adds a project rather than replacing the one you are on.**
See below.

## More than one project at a time

⚙ Settings shows **a row of the projects this browser knows**, each one holding
its own token. Click a name to switch; the board reloads from that repository.
**Add another project** clears the fields for a new one, and the cross on a
name forgets it and its token. Nothing is written until you press *Connect*, so
adding one and changing your mind costs nothing.

A name is `owner/repo`. Two projects in the same repository — a second branch,
a second file — get whichever of those differs added on the end, and nothing
else.

**Each token stays with its project, and that is the point rather than a
detail.** A fine-grained token names the repository it was minted for; against
any other repository it answers 404 to every call, which is also what a missing
file answers. So one token box shared between two projects was a wrong
diagnosis waiting to happen, and dropping a config for a second project used to
walk straight into it.

**Working from two computers never needed this.** Settings live in the
browser's own storage, which is per origin and per machine, so each computer
has always kept a token of its own and neither knows about the other. Mint one
token per computer if you like — then losing a laptop is one token to revoke
rather than all of them. What this row is for is **one browser against two
repositories**, which used to mean pasting a token again every time you
switched, from a page GitHub will not show you twice.

*Forget this device* still means the whole device: every project, every token.
It asks with a count when there is more than one.

## When it says it cannot see the repository

**The board asks the token who it is before it asks about the repository**,
because a private repository answers 404 to a request GitHub does not
recognise as anybody at all — the same 404 it gives somebody real who has not
been granted access. One status, three situations, and listing all three is
what four rounds of this look like.

So there are three different answers now:

- **"GitHub refused the token itself"** — mistyped, expired or revoked. A token
  that is merely short of permissions is refused differently.
- **"this token belongs to the GitHub account X"** — it was minted while signed
  in as somebody else. This one is otherwise invisible: the token's own settings
  page reads perfectly, because it *is* correct, for another account.
- **"the token works and belongs to X, but cannot see …"** — now it really is
  the Repository access list, the Resource owner, or the spelling.

Requests also skip the browser cache. GitHub marks some answers cacheable for a
minute, and the browser does not know a credential changed — so a refusal could
be replayed after the token was fixed, which is a loop with no way out of it
from the screen.

## The commit message setting

Saves are commits. The default message ends with **`[skip ci]`**, which tells
GitHub Actions not to run a workflow for it.

**That default exists because of a real cost.** Pure Tracker's `build.yml` is
`on: push: branches: ["**"]`, so without the marker every drag of a card would
start an Android build — a job that takes minutes and produces an APK nobody
asked for.

Your project may use different CI, may want saves to trigger something, or may
have no CI at all. So it is a setting rather than a constant — **set in the
config file**, not on the panel, because it is answered once and then left
alone for the life of the project.

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
      "planned": "9040c387",
      "items": [
        { "short": "Audit the wake lock",
          "title": "Audit the wake lock on every exit path",
          "body": "…", "done": false }
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

`planned` is the one field not meant to be typed. It is a digest of the items'
titles and bodies, written when you click the plan chip, and comparing it to
the items as they are now is how the column tells **Plan** from **Replan**. A
hand-written file simply leaves it out and reads **New**, which is the honest
answer for a file nobody has planned against yet.

`locked` is set by the padlock on a column, for the release being built right
now. **It freezes the number as well as the contents**, and the number is the
point: ids here follow position, so a column inserted elsewhere renames the one
under construction — silently, because the work is going on somewhere else
against a number the board no longer has. A locked column refuses edits, drags
and ticks, and the board refuses any insert, delete or column drag **at or to
the left of it**; everything to its right stays free. Clear it by clicking the
padlock again, or let shipping clear it — `shipped` freezes an id for good, so
the normal path needs no housekeeping.

It is in the file rather than in the browser so that whoever is doing the
implementing can see it too. **It binds the board, not the file**: a run still
has to write that release's document and mark it shipped, so this is a seatbelt
against an accidental drag rather than a vault.

## What it does

- **Drag a card** between releases, or within one, to reorder
- **Drag a column** to move a release earlier or later — **the numbers follow**.
  Within a major the minors run 1, 2, 3 in board order; an id ending `.0` opens
  a major and everything to its right joins it until the next one. **The major
  is counted, not read**: which one a `.0` opens comes from how many have opened
  to its left, so dragging a major leftwards renumbers it and everything past
  it. Mentions of a release in other columns' text are rewritten with it, so a
  renumbering does not leave the prose around it lying. **Shipped releases are
  never touched** — their ids have been reported against and are facts rather
  than positions.
- **Edit anything in place** — click the text and it becomes a field. Nothing
  is ever edited in a dialog; the only two sheets are settings, and confirming
  something you cannot undo. **Typing an id is the other way to renumber**:
  give a column `R5.0` and it opens a major, and everything to its right
  follows. The id's hit area is the number itself — the rest of that row drags
  the column
- **Tick an item done**; the column head counts `3 of 6`
- **Open a card** with the caret for the whole of it. An item may carry a short
  `short` beside its `title`: the card shows the handle so a column can be
  scanned, and opening it shows the title in full — line breaks and bullet
  lists intact — with the notes under it. An item with no `short` shows its
  title, exactly as before
- **Say whether the plan is current** — the column head carries **New** (no
  plan done yet), **Replan** (a ticket has been added, changed or removed since
  the last plan, so replanning is needed) or **Plan** (every ticket is
  planned). Click it to stamp, click a stamped one to clear. Ticking items off
  and reordering a column do not move it — neither is a ticket changing, and
  neither is a renumbering: dragging a column rewrites release numbers inside
  item bodies, and a planned release stays planned across that
- **Add a release** with the `+` between two columns; **delete** one with the
  `×` on its head, which names what goes with it first
- **Grab-pan** the board by dragging its background, with a mouse. On touch the
  browser's own scrolling is used instead, because reimplementing momentum and
  rubber-banding is a losing game
- **Set how wide a column is.** **Drag the space between two columns** to give
  the one on its left a width of its own — a column full of paragraphs can be
  wide while the rest stay narrow. Every column stays between 240 and 620 px,
  so one can be made awkward but never lost, and dragging is the way back.
  Widths are kept in the browser rather than in the plan: a laptop and a wide
  monitor want different answers, and so do two people on one board
- **Keep shipped releases in a rail** down the side — hide it, reveal it,
  scroll it — so a long history does not eat the width

## What it deliberately does not do

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

**Numbering releases at all** is a habit rather than a requirement. The tool
renumbers what it can parse as `<prefix><major>.<minor>` and leaves everything
else exactly as written — a project whose releases are called *Spring*,
*Summer* and *Autumn* drags them around and nothing is renamed, which is the
tool staying out of the way.

**Shipped releases folded into the rail** is this project's habit too.

There used to be a **cut line** flag beside it, marking the first item a
release drops if it runs long. It is gone. The judgement it recorded was real
and is still worth writing down — but a sentence in the item's body says it
better than a flag does, because the flag could only say *which* one and never
*why*, which is the half somebody needs when the moment to drop it arrives.

One consequence worth knowing before you meet it: a major holding more than
nine releases produces `R1.10` and `R1.11`, which read awkwardly beside `R1.1`.
It is unambiguous — ids are labels in a fixed order, not decimals to compare —
but if it bothers you, the fix is to open a new major earlier rather than to
change the numbering.

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

**Here.** This repository is the planner: `index.html` is the source and the
file GitHub Pages serves, so editing it is releasing it and there is nothing
to upload.

It began inside Pure Tracker's repository, because that was the only project
using it, with a named trigger for moving out — *the first time a second
project connects to it for real*. That happened, so it moved. Being one
dependency-free file, it took an afternoon, as predicted.

What stayed behind is the part that was never the tool: each project keeps its
own `roadmap.json` and its own `pure-planner-config.json`, and a project whose
tooling stamps a plan keeps its own copy of that — see the digest contract in
`CLAUDE.md`.
