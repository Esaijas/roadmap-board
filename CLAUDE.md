# Pure planner — standing rules

A kanban board for a release plan, in one HTML file. No build step, no
dependencies, no CDN, no framework, no server. It talks to `api.github.com`
and nothing else. `README.md` says what it does; this says what keeps getting
decided wrongly.

**This repository is the whole of it.** It came out of Pure Tracker's
repository the first time a second project connected to it, which was the
trigger written down when it was put there.

## The file you edit is the file being served

`index.html` is the source **and** the deployment: GitHub Pages serves this
repository at `https://esaijas.github.io/roadmap-board/`, so a push is a
release to everybody using it. There is no staging copy and nothing to upload.

That is the good shape and it has one cost worth naming: **a regression here is
a regression on every project at once**, within a reload. There is no project
that gets it later and could have warned the others. So the tests run before
the push, every time, not after.

    node pure-planner-test.js
    node pure-planner-connections-test.js

They read this file and evaluate the real functions out of it rather than
holding a copy — a copy passes while the page is broken, which is the only
outcome worse than no test.

## Bump the version in the same commit as the change

⚙ Settings carries `const VERSION = "v34 · 2026-11-01"`, with a copy button.
**A stale deployment and a current one are indistinguishable from outside**:
the URL works either way, the board draws either way, and the only answer is
that string. There is no build step to bump it for you, which is the price of
having no build step.

The question to ask when diagnosing anything is never "does the URL work" but
"what does ⚙ Settings say". v23 was once live for days while v24 sat
undeployed carrying the fix for a bug that had already fired on the real
board.

## One deployment, many projects — and one browser, many tabs

Every project connects to this same page; what differs is the repository it
reads. So the projects already share a version and always did.

**A tab holds its own project and the browser holds the list.** The project a
tab is showing lives in `sessionStorage`, which is per tab; the projects and
their tokens live in `localStorage`, which is per origin. Keeping the first in
the second is the v31 bug: two tabs for two projects both ended up on the same
one. And a tab that writes the project list back whole deletes whatever
another tab added — tokens included, from a page that cannot show a token
twice — so every write re-reads and merges.

**`localStorage` is per origin, so a copy opened off disk and the Pages one
know nothing about each other.** Each wants its own token. That is a feature
rather than a fault: one token per machine means a lost laptop is one token to
revoke.

## The digest is a contract with every project that stamps a plan

`planSignature` computes what goes in a release's `planned` field, and the
board reads it back to decide whether a column says *Plan* or *Replan*. A
project whose own tooling writes a stamp — Pure Tracker's `tools/planstamp.py`
does — has a second implementation of this hash, in another language, in
another repository.

**This one is the authority.** Where they differ, the other is wrong.

So: a change to `planSignature` regenerates `digest-vectors.json` and has to be
carried to every project that stamps. They check themselves against it and
fail loudly until it arrives.

The vectors exist because the two had already drifted, silently, for months:
`charCodeAt` reads sixteen bits at a time, so a character outside the Basic
Multilingual Plane is two iterations here and was one in the Python. Any
ticket with an emoji in its title was unstampable and nothing said so.

## Nothing about any project belongs here

No plan, no `roadmap.json`, no release documents, no config file naming a
repository. This repository is **public** and the projects using it are not;
anything copied across is published permanently and git does not forget.

A config file (`pure-planner-config.json`) belongs with the project it
describes. **It never carries a token** — it exists to be committed and passed
around, and the token is per person and per device.

## No credential, ever, and nothing that could want one

The board takes a fine-grained token pasted by the person using it and keeps it
in their own browser. There is no workflow here, no build, no deploy key, and
no reason for any of them — Pages publishes on push.

The test to apply: **could a stranger reading this repository act as me?** It
is public, so the answer has to be no by construction.

## Public, and that is load-bearing

Free-tier Pages will not serve a private repository. Making this one private
takes the board offline for every project at once; the answers are GitHub Pro
or opening the file off disk, not a workaround.

## Taking it into use on a new project

1. Open the URL.
2. Drop that project's `pure-planner-config.json` on the panel — it fills
   owner, repository, branch, file and commit message.
3. Paste a fine-grained token: **that repository only**, Contents read and
   write, and **Repository access naming it**. That last control is above the
   permission list, it defaults to *Public repositories*, and against a
   private repository the default 404s every call while the permissions below
   read exactly right. It cost an afternoon.

## Models and effort

- The main session and the expert subagents (the agents in .claude/agents/)
  use Opus.
- Mechanical tasks go to general-purpose subagents running Sonnet: running
  pipelines or scripts over full data, listing files, reading logs, fixing
  failing tests.
- Do not use Haiku or Fable.
- Model routing: the lead chooses the model and reasoning effort for every
  delegated task. Use this table:

  | Kind of work | Model | Effort |
  |---|---|---|
  | Method design, architecture, validation design, reviews, decisions, anything customers or the owner see | Opus | high |
  | Implementing a clearly specified work package with tests | Opus; Sonnet when the spec names files, functions and tests concretely | medium |
  | Mechanical work: running pipelines, regenerating data, screenshots, reading logs, listing files | Sonnet | low or medium |
  | Haiku, Fable | not used | – |

- **Fixing a failing test is not mechanical work in this repository.** The
  tests evaluate the page's own functions, so a red test almost always means
  `index.html` is broken — on every project at once, within a reload. Route
  it as a change to the page (Opus), not as mechanical work, and fix the page
  rather than the test: a test edited until it passes is the copy that passes
  while the page is broken.
- Every plan's work-package table has a "Model / effort" column, so the owner
  can review and change the choice before the run.
- Cost is driven more by context size than by model: give each subagent exact
  file paths and a precise question, and let it read only what it needs.
- Run long commands (full test suite, full-data runs) in the background or
  with explicit timeouts, so an agent does not stall waiting on them.
- Use this table instead of a separate "router" agent; a router would cost
  more context than it saves.
