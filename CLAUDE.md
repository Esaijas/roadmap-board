# Pure planner — the deployment

This repository is **not** where the planner is written. It holds one file and
exists so GitHub Pages can serve it.

    source      Esaijas/Plain_tracker
                docs/roadmap/pure-planner.html
                branch claude/sports-tracking-android-app-4a05m1

    deployment  Esaijas/roadmap-board
                index.html
                served at https://esaijas.github.io/roadmap-board/

The whole job of a session here is to carry the first into the second.

## Never edit `index.html` here

A fix made in this repository is lost the next time the planner is synced, and
lost **silently** — the sync is a copy, so it overwrites without a conflict and
nothing anywhere says a change was dropped. Every change goes in the source
repository, where the tests and the local checks are.

If something is wrong with the board and the source cannot be reached, say so
and stop. Do not patch the deployed copy "just this once".

## It has to be called `index.html`

Pages serves a directory listing otherwise, and the URL above shows a file
browser rather than the board. The source keeps its own name, where
`pure-planner.html` is what distinguishes it from a README and a config file;
the copy here is renamed on the way in.

## The version is how anybody knows the sync happened

⚙ Settings in the board carries a build string — `v31 · 2026-10-31` — with a
copy button beside it. **A stale deployment and a current one look identical
from outside**: the URL works either way, the board draws either way. The
version is the only answer.

So a sync is finished when the version in the committed `index.html` is newer
than the one it replaced. Check it:

    grep -o 'const VERSION = "[^"]*"' index.html

**If the source's version is the same as the deployed one, the sync is not
done — the source was not bumped.** That is a finding to report, not a reason
to push anyway. A deployment whose version matches the previous one is
indistinguishable from one that never happened, which has already cost a
diagnosis: v23 was live for days while v24 sat in the source repository
carrying the fix for a bug that had already fired on the real board.

## This repository is public, and that is load-bearing

Free-tier Pages will not serve a private repository, so making it private
takes the board offline. If it is ever made private, the URL stops working
and the answer is either GitHub Pro or running the file off disk — not a
workaround here.

## Nothing else goes in here

No plan, no `roadmap.json`, no release documents, no notes. `Plain_tracker` is
**private**, and this repository is public: anything copied across is
published to the open web permanently, and git does not forget. The only file
that crosses is the planner itself, which is a tool and carries nothing about
any project.

The config file (`pure-planner-config.json`) does not belong here either. It
names a repository and is meant to be passed around, but it belongs with the
project it describes.

## No credential, ever

The board takes a fine-grained token pasted by the person using it and keeps it
in their browser's own storage. **Nothing in this repository may contain one**,
and there is nothing here that could legitimately want one — no workflow, no
build, no deploy key. The page is served as a static file and talks to
`api.github.com` from the browser.

The test to apply is the one the source repository uses: *could a stranger
reading this repository act as me?* It is public, so the answer must be no by
construction.

## No workflows

There is no CI here and there should not be. Pages publishes on push, so **a
push is the deploy** — there is nothing for a workflow to add, and a workflow
in a repository whose whole content is one static file is a way for something
to go wrong unattended.

## What a sync looks like

1. Read the source file from `Plain_tracker`.
2. Compare its `VERSION` with the one in `index.html` here. If they match,
   stop and say so.
3. Copy it over `index.html`, byte for byte. No reformatting, no tidying, no
   "while I am here".
4. Commit with the version in the message, e.g. `Deploy Pure planner v31`.
5. Push, then say the URL and the version, and that ⚙ Settings is where to
   confirm it. Pages takes a minute or two.

The commit message takes no `[skip ci]` marker — there is no CI here, and the
marker would only be confusing.
