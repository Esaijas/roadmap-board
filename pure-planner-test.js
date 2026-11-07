/* What `rewriteReferences` in index.html may and may not touch.
 *
 *     node docs/roadmap/pure-planner-test.js
 *
 * **This exists because the same function silently corrupted the board twice
 * in one evening**, and neither fault showed up as an error: the ids came out
 * right, the columns drew, and the prose underneath had been quietly pointed
 * at the wrong releases. A renumber is the one operation here that edits text
 * nobody asked it to edit, so it is the one that needs pinning.
 *
 * The function is lifted out of the page rather than duplicated. There is no
 * build step and no module system in that file -- it is one HTML file with no
 * dependencies, deliberately -- so this reads the source, cuts the function
 * out by name and evaluates it. A copy of the function here would pass while
 * the page was broken, which is the only outcome worse than no test.
 */
const fs = require("fs");
const path = require("path");

const PAGE = path.join(__dirname, "index.html");
const src = fs.readFileSync(PAGE, "utf8");

const start = src.indexOf("function rewriteReferences(renames) {");
if (start < 0) {
  console.error("rewriteReferences is not in " + PAGE + " -- was it renamed?");
  process.exit(2);
}
const end = src.indexOf("\n}\n", start);
const body = src.slice(start, end + 3);

let DATA;
// eslint-disable-next-line no-eval
const rewriteReferences = eval(`(${body.replace(
  "function rewriteReferences", "function rewriteReferences")})`);
const rewrite = (d, renames) => { DATA = d; return rewriteReferences(renames); };

/* `renumber` is lifted the same way, and for the same reason: it is the other
   half of a renumber and a copy here would pass while the page was broken.
   It leans on `parseId` and `locked`, so those come across as well -- cutting
   them out by name rather than rewriting them, so a change to any of the three
   reaches this file. */
function lift(name, opener) {
  const i = src.indexOf(opener);
  if (i < 0) {
    console.error(`${name} is not in ${PAGE} -- was it renamed?`);
    process.exit(2);
  }
  const j = src.indexOf("\n}\n", i);
  return src.slice(i, j + 3);
}
/* An IIFE rather than a parenthesised list: `(a; b; c)` is not an
   expression. Direct `eval`, so the lifted `renumber` closes over the `DATA`
   below rather than looking for a global one. */
/* `ID_RE` is a `const` beside `parseId`, so it comes across too -- lifted by
   its declaration rather than retyped, for the same reason as the functions. */
function liftConst(name) {
  const m = new RegExp("^const " + name + " = .*$", "m").exec(src);
  if (!m) { console.error(`${name} is not in ${PAGE} -- was it renamed?`); process.exit(2); }
  return m[0];
}

// eslint-disable-next-line no-eval
const renumber = eval("(function () {\n" + [
  liftConst("ID_RE"),
  lift("parseId", "function parseId(id) {"),
  lift("locked", "function locked(rel) {"),
  lift("minorValue", "function minorValue(minor, minors) {"),
  lift("renumber", "function renumber(list = DATA.releases) {"),
].join("\n") + "\nreturn renumber;\n})()");
const number = d => { DATA = d; return renumber(); };
const ids = d => d.releases.map(r => r.id);

let pass = 0;
const problems = [];
function check(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else problems.push(`${label}\n     got  ${g}\n     want ${w}`);
}

/* A board with the shape both faults needed: a shipped release, an unshipped
 * one whose old id collides with it, and a sentence containing a measurement
 * that reads like an id. */
const board = () => ({ releases: [
  { id: "R4.1", shipped: true, prose: "the Drive backup", gate: "", items: [
      { title: "t", body: "as R4.1 established, and R4.3 will use it" }] },
  { id: "R4.3", shipped: false, prose: "cannot start until R4.1 has shipped",
    gate: "", items: [
      { title: "t", body: "a 4.9 km line underneath a 5.0 km number" }] },
  { id: "R7.0", shipped: false, prose: "see R7.0 and R4.1", gate: "", items: [] },
]});

// ── the ordinary case still works ───────────────────────────────────────────
{
  const d = board();
  const r = rewrite(d, { "R7.0": "R8.0" });
  check("an ordinary rename moves its mentions", r.moved, 1);
  check("and holds nothing back", r.held, []);
  check("the text is updated", d.releases[2].prose, "see R8.0 and R4.1");
}

// ── an old id a shipped release still carries ───────────────────────────────
//
// The fault that inverted a dependency. Renaming an unshipped column off R4.1
// used to rewrite *every* R4.1 on the board, including the ones meaning the
// shipped release -- which are facts about a release document, a generated
// gate list and verdicts stored on a phone.
{
  const d = board();
  const r = rewrite(d, { "R4.1": "R4.3" });
  check("a number a shipped release has rewrites nothing", r.moved, 0);
  check("and it says which one it held", r.held, ["R4.1"]);
  check("the shipped release's own mention is intact",
        d.releases[0].items[0].body, "as R4.1 established, and R4.3 will use it");
  check("the inverted dependency cannot happen",
        d.releases[1].prose, "cannot start until R4.1 has shipped");
}

// ── an id with no prefix is not a reference ─────────────────────────────────
//
// `ID_RE` allows an empty prefix, so `5.0` is a legal column id -- and every
// measurement in the board matching it is a false positive. A shipped ticket
// reading "a 4.9 km line underneath a 5.0 km number" became "a R5.0 km number".
{
  const d = board();
  const r = rewrite(d, { "5.0": "R5.0" });
  check("a bare numeric id rewrites nothing", r.moved, 0);
  check("and it says so", r.held, ["5.0"]);
  check("the measurement survives",
        d.releases[1].items[0].body, "a 4.9 km line underneath a 5.0 km number");
}

// ── a mixed batch does the safe half rather than nothing ────────────────────
{
  const d = board();
  const r = rewrite(d, { "R7.0": "R8.0", "R4.1": "R4.3", "5.0": "R5.0" });
  check("a mixed batch moves only the safe one", r.moved, 1);
  check("and holds both of the others", r.held.slice().sort(), ["5.0", "R4.1"]);
  check("the safe rename is applied", d.releases[2].prose, "see R8.0 and R4.1");
  check("the measurement is still safe",
        d.releases[1].items[0].body, "a 4.9 km line underneath a 5.0 km number");
}

// ── the lookahead the old version got right, still right ────────────────────
//
// Most references sit at the end of a sentence, and a version number is not an
// id. Both were already handled; a fix that broke either would be a trade.
{
  const d = { releases: [{ id: "R2.0", shipped: false,
    prose: "moved here from R1.15.", gate: "", items: [
      { title: "t", body: "version 1.05.305 is not an id" }] }] };
  rewrite(d, { "R1.15": "R1.2" });
  check("a reference at a full stop still moves",
        d.releases[0].prose, "moved here from R1.2.");
  check("a version number is not an id",
        d.releases[0].items[0].body, "version 1.05.305 is not an id");
}

/* ── a release being built keeps its number ───────────────────────────────────
 *
 * **The number is the half of a lock that matters.** A column under
 * implementation has its id written into a release document, into `gates.py`,
 * into generated Kotlin and into every commit message of the run -- and the
 * ids here follow *position*, so an insert three columns away renames it. The
 * rename is silent from the inside: the work carries on against a number the
 * board no longer has. That nearly happened: one column went R8.4, R8.5, R8.6
 * in two days as columns were inserted and split beside it.
 */
const queue = () => ({ releases: [
  { id: "R8.0", shipped: true, prose: "", gate: "", items: [] },
  { id: "R8.1", shipped: false, prose: "", gate: "", items: [] },
  { id: "R8.2", shipped: false, prose: "", gate: "", items: [] },
  { id: "R8.3", shipped: false, prose: "", gate: "", items: [] },
] });

{
  const d = queue();
  number(d);
  check("with nothing locked, position names them", ids(d), ["R8.0", "R8.1", "R8.2", "R8.3"]);
}

// The one this exists for: a column inserted in front of a locked release.
{
  const d = queue();
  d.releases[2].locked = true;                       // R8.2 is being built
  d.releases.splice(1, 0, { id: "R8.9", shipped: false, prose: "", gate: "", items: [] });
  number(d);
  check("the locked release keeps its number through an insert before it",
        d.releases[3].id, "R8.2");
  check("and the column after it does not land on the same number",
        d.releases[4].id, "R8.3");
}

/* **The duplicate this prevents, stated as a test rather than as a comment.**
   Skipping a locked release -- which is all a shipped one needs, because it
   leaves the board -- would leave the counter where it was and hand the next
   column the same id. */
{
  const d = queue();
  d.releases[2].locked = true;
  number(d);
  check("no two releases share an id", new Set(ids(d)).size, ids(d).length);
}

// Everything to its right still numbers from position, which is the whole
// point of allowing work there.
{
  const d = queue();
  d.releases[1].locked = true;                       // R8.1 is being built
  d.releases.push({ id: "R9.9", shipped: false, prose: "", gate: "", items: [] });
  number(d);
  check("a column added on the right takes the next number",
        ids(d), ["R8.0", "R8.1", "R8.2", "R8.3", "R8.4"]);
}

// A locked release that has also shipped is simply shipped: `shipped` already
// freezes an id for good, and the lock must not become a second mechanism.
{
  const d = queue();
  d.releases[0].locked = true;
  d.releases.splice(1, 0, { id: "R8.9", shipped: false, prose: "", gate: "", items: [] });
  number(d);
  check("a shipped release is not renumbered whether it is locked or not",
        d.releases[0].id, "R8.0");
  check("and the queue behind it still starts where it should",
        d.releases[1].id, "R8.1");
}

// ── what a shipped minor is worth ───────────────────────────────────────────
//
// The board counts minors as whole numbers -- R0.9, R0.10, R0.11 -- and used to
// *read* a shipped two-digit minor as a decimal, so a shipped R0.10 counted as
// 1.0, below R0.9, and the next column was handed R0.10 again. The old decimal
// ids still have to keep their place: R1.05 between R1.0 and R1.1, R0.85
// between R0.8 and R0.9.
const rel = (id, more = {}) => ({ id, prose: "", gate: "", items: [], ...more });
const shipped = id => rel(id, { shipped: true });
{
  const d = { releases: [shipped("R0.8"), shipped("R0.9"), shipped("R0.10"), rel("R0.11")] };
  number(d);
  check("after a shipped R0.10 comes R0.11, not a second R0.10",
        ids(d), ["R0.8", "R0.9", "R0.10", "R0.11"]);
}
{
  const d = { releases: [shipped("R0.9"), rel("R0.10"), rel("R0.11")] };
  number(d);
  check("an unbuilt R0.10 after a shipped R0.9 keeps its number",
        ids(d), ["R0.9", "R0.10", "R0.11"]);
}
// Counting on, one shipped release at a time, as far as anybody will go.
{
  const got = [], want = [];
  for (let n = 1; n <= 25; n++) {
    const d = { releases: [] };
    for (let k = 0; k < n; k++) d.releases.push(shipped(`R3.${k}`));
    d.releases.push(rel("R3.99"));
    number(d);
    got.push(d.releases[n].id); want.push(`R3.${n}`);
  }
  check("shipping R3.0 to R3.24 in turn, the next one is always one more", got, want);
}
{
  const d = { releases: [shipped("R1.0"), shipped("R1.05"), rel("R1.7")] };
  number(d);
  check("an old decimal id keeps its place: after R1.0 and R1.05 comes R1.1",
        d.releases[2].id, "R1.1");
}
{
  const d = { releases: [shipped("R0.8"), shipped("R0.85"), shipped("R0.9"), rel("R0.4")] };
  number(d);
  check("R0.85 sits between R0.8 and R0.9, so the next is R0.10",
        d.releases[3].id, "R0.10");
}
{
  const d = { releases: [shipped("R2.0"), shipped("R2.1"), rel("R2.9")] };
  number(d);
  check("a plain R2.1 is one, not a tenth: the next is R2.2", d.releases[2].id, "R2.2");
}
{
  const d = { releases: [shipped("R0.9"), rel("R0.10", { locked: true }), rel("R0.5")] };
  number(d);
  check("a locked R0.10 keeps its number and the next column is R0.11",
        ids(d), ["R0.9", "R0.10", "R0.11"]);
}

// ── a plan the board must not renumber ──────────────────────────────────────
//
// `planFault` is what stops the board putting an out-of-turn edit "right" on
// its next save. Lifted with everything it leans on, so a change to any of
// them reaches this file. Every case is a real way a plan file got, or could
// get, into that state from outside the board.
// eslint-disable-next-line no-eval
const planFault = eval("(function () {\n" + [
  liftConst("ID_RE"),
  lift("parseId", "function parseId(id) {"),
  lift("locked", "function locked(rel) {"),
  lift("minorValue", "function minorValue(minor, minors) {"),
  lift("renumber", "function renumber(list = DATA.releases) {"),
  lift("planFault", "function planFault(list = DATA.releases) {"),
].join("\n") + "\nreturn planFault;\n})()");
{
  check("a plan shipped in order is fine",
        planFault([shipped("R8.0"), shipped("R8.1"), rel("R8.2", { locked: true }), rel("R9.0")]), null);
  check("a board with nothing numbered is fine",
        planFault([rel("Spring"), rel("Summer", { shipped: true }), rel("Autumn")]), null);
  check("a shipped R0.10 followed by R0.11 is fine",
        planFault([shipped("R0.9"), shipped("R0.10"), rel("R0.11"), rel("R1.0")]), null);
  check("a release shipped out of turn is named, with what to move",
        planFault([shipped("R6.1"), rel("R6.2"), rel("R7.0"), shipped("R8.0"), rel("R8.1")]),
        "R8.0 is shipped but R6.2, to its left, is not — in the plan file, move R8.0 to"
        + " just after the last shipped release");
  check("a release added in front of the locked one would take its number",
        planFault([shipped("R8.5"), rel("R8.2"), rel("R8.6", { locked: true }), rel("R9.0")]),
        "R8.2 would be renumbered to R8.6, which R8.6 already is — in the plan file,"
        + " move R8.2 to the right of it");
  check("a locked release passed by a shipped one is said, not renumbered",
        planFault([shipped("R8.5"), shipped("R9.0"), rel("R8.6", { locked: true }), rel("R9.1")]),
        "R8.6 is locked, but R9.0 has already shipped with a higher number — ship R8.6"
        + " or unlock it before anything is renumbered");
  check("two shipped releases with one name are said",
        planFault([shipped("R4.0"), shipped("R4.0"), rel("R4.1")]),
        "two releases are called R4.0 in the plan file — rename one");
  check("a stale number the board can fix is not a fault",
        planFault([shipped("R8.5"), rel("R3.0"), rel("R3.1")]), null);
}

// ── the writing guide ───────────────────────────────────────────────────────
//
// One text, in two places: the board shows `WRITING_GUIDE`, and README.md
// carries it between two markers. They are compared here rather than trusted
// to stay alike, and the board's own reading of it is pinned.
{
  const m = /const WRITING_GUIDE = `\n([\s\S]*?)`;/.exec(src);
  const readme = fs.readFileSync(path.join(__dirname, "README.md"), "utf8");
  const r = /<!-- guide -->\n([\s\S]*?)\n<!-- \/guide -->/.exec(readme);
  check("the README carries the board's writing guide word for word",
        r && r[1].trim(), m && m[1].trim());
  // eslint-disable-next-line no-eval
  const guideBlocks = eval(`(${lift("guideBlocks", "function guideBlocks(text) {")})`);
  const blocks = guideBlocks(m ? m[1] : "");
  check("the guide reads as four headed sections",
        blocks.filter(b => b.heading).map(b => b.heading),
        ["Who it is for", "How to write", "A release (a column)", "A ticket (a card)"]);
  const items = blocks.filter(b => b.list).flatMap(b => b.list);
  check("a wrapped line stays part of its item, so none is lost or split",
        [items.length, items.every(t => t.startsWith("**"))], [13, true]);
}

// ── where a shipped release's notes are ─────────────────────────────────────
//
// `notesPattern` and `notesFind` decide which rows in the rail open something,
// and what. Lifted like the rest. The cases that matter most are the ones that
// must come back null: a row is clickable only when these say where the file
// is. The names below are made up -- no project's own naming belongs here.
// eslint-disable-next-line no-eval
const { notesPattern, notesFind } = eval("(function () {\n" + [
  lift("notesPattern", "function notesPattern(pattern) {"),
  lift("notesFind", "function notesFind(pattern, id, names) {"),
].join("\n") + "\nreturn { notesPattern, notesFind };\n})()");
{
  const dated = "docs/notes/Sample App {id} release notes *.pdf";
  const folder = [
    "R0.6.md",
    "Sample App R0.6 release notes 31-10-2026.pdf",
    "Sample App R0.6.1 release notes 02-11-2026.pdf",
  ];
  check("a name built from the id alone is found",
        notesFind("docs/releases/{id}.pdf", "R1.05", ["R1.04.md", "R1.05.pdf"]),
        { dir: "docs/releases", name: "R1.05.pdf", path: "docs/releases/R1.05.pdf" });
  check("a date the board cannot know is matched by *",
        notesFind(dated, "R0.6", folder),
        { dir: "docs/notes", name: "Sample App R0.6 release notes 31-10-2026.pdf",
          path: "docs/notes/Sample App R0.6 release notes 31-10-2026.pdf" });
  check("R0.6.1 gets its own file",
        notesFind(dated, "R0.6.1", folder).name,
        "Sample App R0.6.1 release notes 02-11-2026.pdf");
  check("R0.6 does not take R0.6.1's file when its own is missing",
        notesFind(dated, "R0.6", folder.slice(2)), null);
  check("the id is matched literally -- its dot is not a wildcard",
        notesFind(dated, "R0.6", ["Sample App R0x6 release notes 31-10-2026.pdf"]), null);
  check("a release with no file opens nothing",
        notesFind(dated, "R0.5", folder), null);
  check("a plan without a pattern opens nothing",
        notesFind(undefined, "R1.05", ["R1.05.pdf"]), null);
  check("{id} in the folder is refused, so one listing covers every release",
        notesPattern("docs/{id}/notes.pdf"), null);
  check("* in the folder is refused for the same reason",
        notesPattern("docs/*/{id}.pdf"), null);
  check("anything but a PDF is refused -- it would open as this page's origin",
        notesPattern("docs/releases/{id}.html"), null);
  check("a leading slash and the repository root both work",
        notesFind("/{id}.pdf", "R2", ["R2.pdf"]), { dir: "", name: "R2.pdf", path: "R2.pdf" });
  check("an id with a slash in it cannot reach into another folder",
        notesFind("docs/releases/{id}.pdf", "R1/../secret", ["R1/../secret.pdf"]), null);
}

console.log(`${pass + problems.length} checks against the page's own functions`);
problems.forEach(p => console.log("FAIL " + p));
if (problems.length) process.exit(1);
console.log("a shipped number and a bare number are both left alone");
console.log("a locked release keeps its number, and nothing else takes it");
console.log("release notes open only where the plan says, and only as a PDF");
console.log("nothing unbuilt is numbered at or below a shipped release");
console.log("the writing guide is one text, in the board and in the README");
