/* What the planner does with several projects and their tokens.
 *
 *     node docs/roadmap/pure-planner-connections-test.js
 *
 * **This exists because the thing being stored is a credential.** Every other
 * mistake in that file draws something wrong and can be looked at; a mistake
 * here quietly drops a token, and a fine-grained token cannot be read back --
 * GitHub shows it once, at generation, and an abbreviation ever after. So the
 * cost of losing one is a trip to the settings page and a new one minted,
 * which is exactly the trip v26 was written to stop.
 *
 * Three things are pinned, and they are the three that are easy to get wrong:
 *
 *   - **the upgrade from v25**, which has to find the one project already
 *     stored and keep its token;
 *   - **the old key is never written again**, so putting the old file back
 *     works as well as never having upgraded;
 *   - **adding never substitutes**, which is the whole feature.
 *
 * The functions are lifted out of the page rather than copied. There is no
 * build step and no module system in that file -- one HTML file, no
 * dependencies, deliberately -- so this reads the source, cuts the storage
 * section out and evaluates it. A copy here would pass while the page was
 * broken, which is the only outcome worse than no test.
 */
const fs = require("fs");
const path = require("path");

const PAGE = path.join(__dirname, "index.html");
const src = fs.readFileSync(PAGE, "utf8");

const from = src.indexOf('const CONFIG_KEY = "roadmap.config.v1";');
const mark = src.indexOf("function projectLabel(c) {");
if (from < 0 || mark < 0) {
  console.error("the storage section is not in " + PAGE + " -- was it renamed?");
  process.exit(2);
}
const to = src.indexOf("\n}\n", mark) + 3;
const body = src.slice(from, to);

/* `remembers` lives higher up the file, beside the comment explaining why, and
   is the one binding the section reaches for that is not in it. */
const make = new Function("localStorage", "sessionStorage", `
  let remembers = true;
  ${body}
  return {
    get conns() { return conns; },   set conns(v) { conns = v; },
    get active() { return active; }, set active(v) { active = v; },
    get cfg() { return cfg; },       set cfg(v) { cfg = v; },
    get remembers() { return remembers; },
    DEFAULTS, persist, store, forgetStored, sameProject, projectLabel, connected,
    readVault, tabProject, rememberTab, loadAll,
  };
`);

/* Enough of the Storage interface for the page: the three calls it makes, and
   the map underneath so a test can look at what was actually written. */
function fakeStore(initial = {}) {
  const map = { ...initial };
  return {
    getItem: k => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: k => { delete map[k]; },
    map,
  };
}
/* **A tab, not a browser.** `localStorage` is shared by every tab of an origin
 * and `sessionStorage` is not, which is the entire mechanism v31 turns on --
 * so a test handing both of them one fake store would pass while the page was
 * broken in exactly the reported way. A tab is the shared vault plus a private
 * session store; two tabs are two of the second against one of the first.
 */
function tab(vault, session = fakeStore()) { return make(vault, session); }

const VAULT = "roadmap.connections.v1";
const OLD = "roadmap.config.v1";

let pass = 0;
const problems = [];
function check(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  problems.push(`${label}\n     got  ${g}\n     want ${w}`);
}

// ── the upgrade from v25 ────────────────────────────────────────────────────
//
// One project was stored under the old key with its token. It has to come
// across, or the first thing the new file does is ask for a credential that
// cannot be read back.
{
  const store = fakeStore({ [OLD]: JSON.stringify({
    owner: "Esaijas", repo: "Plain_tracker", branch: "claude/x",
    path: "docs/roadmap.json", message: "m [skip ci]", token: "github_pat_AAA" }) });
  const p = tab(store);
  check("the project stored by v25 is found", p.conns.length, 1);
  check("and it is the one on screen", p.active, 0);
  check("with its token", p.cfg.token, "github_pat_AAA");
  check("so the board connects without being asked anything", p.connected(), "github_pat_AAA");

  // The upgrade must not consume what it read. Left alone, the old key is the
  // project that was connected before v26 -- so rolling the file back works.
  p.cfg = { ...p.cfg, message: "changed after the upgrade" };
  p.store();
  check("the old key is not written again",
        JSON.parse(store.map[OLD]).message, "m [skip ci]");
  check("and the new one carries the change",
        JSON.parse(store.map[VAULT]).list[0].message, "changed after the upgrade");
}

// ── adding a second project does not replace the first ──────────────────────
//
// The whole feature in four lines. A draft is `active` at -1; `store` is the
// only place one joins the list.
{
  const store = fakeStore({ [OLD]: JSON.stringify({
    owner: "a", repo: "one", branch: "main", path: "docs/roadmap.json", token: "TOK-A" }) });
  const p = tab(store);
  p.active = -1;
  p.cfg = { owner: "b", repo: "two", branch: "main",
            path: "docs/roadmap.json", message: "m", token: "TOK-B" };
  p.store();
  check("both projects are held", p.conns.map(c => c.repo), ["one", "two"]);
  check("the first keeps its own token", p.conns[0].token, "TOK-A");
  check("and the new one is the one on screen", p.active, 1);

  // Reopening the page is where a half-written record would show up.
  const again = make(fakeStore(store.map));
  check("both survive a reload", again.conns.map(c => c.repo), ["one", "two"]);
  check("and it reopens on the one last used", again.cfg.token, "TOK-B");
}

// ── typing in a project that is already on a chip ───────────────────────────
//
// Without the lookup in `store` this leaves two chips reading the same name,
// holding two tokens, one of them stale and neither labelled.
{
  const p = make(fakeStore({ [VAULT]: JSON.stringify({ active: 0, list: [
    { owner: "a", repo: "one", branch: "main", path: "docs/roadmap.json",
      message: "m", token: "OLD" }] }) }));
  p.active = -1;
  p.cfg = { owner: "a", repo: "one", branch: "main", path: "docs/roadmap.json",
            message: "m", token: "NEW" };
  p.store();
  check("no second chip appears for the same project", p.conns.length, 1);
  check("and the token typed in is the one kept", p.conns[0].token, "NEW");
}

// ── which fields decide that two projects are the same ──────────────────────
{
  const p = make(fakeStore());
  const base = { owner: "a", repo: "r", branch: "main", path: "d/r.json", message: "m" };
  check("the commit message does not make a new project",
        p.sameProject(base, { ...base, message: "other" }), true);
  check("a different branch does",
        p.sameProject(base, { ...base, branch: "next" }), false);
  check("and so does a different file",
        p.sameProject(base, { ...base, path: "d/other.json" }), false);
}

// ── what a chip is called ───────────────────────────────────────────────────
//
// No name is typed anywhere, so the label has to tell two chips apart by
// itself -- and say only what differs, or the row becomes a table.
{
  const p = make(fakeStore());
  p.conns = [{ owner: "a", repo: "one", branch: "main", path: "p.json" },
             { owner: "b", repo: "two", branch: "main", path: "p.json" }];
  check("two repositories read as themselves",
        p.conns.map(c => p.projectLabel(c)), ["a/one", "b/two"]);

  p.conns = [{ owner: "a", repo: "one", branch: "main", path: "p.json" },
             { owner: "a", repo: "one", branch: "next", path: "p.json" }];
  check("one repository on two branches names the branch",
        p.conns.map(c => p.projectLabel(c)), ["a/one · main", "a/one · next"]);

  p.conns = [{ owner: "a", repo: "one", branch: "main", path: "p.json" },
             { owner: "a", repo: "one", branch: "main", path: "q.json" }];
  check("two files on one branch name the file",
        p.conns.map(c => p.projectLabel(c)), ["a/one · p.json", "a/one · q.json"]);
}

// ── forgetting the device ───────────────────────────────────────────────────
//
// It reaches further than it reads once there are three projects, which is why
// the button asks with a count. It must reach the pre-v26 key too, or a token
// survives a "forget everything" in a place nothing shows it.
{
  const store = fakeStore({
    [OLD]: JSON.stringify({ owner: "a", repo: "one", token: "OLD-TOK" }),
    [VAULT]: JSON.stringify({ active: 0, list: [
      { owner: "a", repo: "one", branch: "main", path: "p.json", token: "T1" },
      { owner: "b", repo: "two", branch: "main", path: "p.json", token: "T2" }] }),
  });
  const p = tab(store);
  p.forgetStored();
  check("nothing is left on screen", p.conns.length, 0);
  check("no token is left in the working copy", p.cfg.token, "");
  check("the new key is gone", VAULT in store.map, false);
  check("and so is the one v25 wrote", OLD in store.map, false);
}

// ── storage that throws ─────────────────────────────────────────────────────
//
// `localStorage` in an opaque origin -- a sandboxed frame, a browser with
// storage switched off -- does not answer empty, it throws on access. The tool
// still has to run; it just cannot remember.
{
  const hostile = {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("SecurityError"); },
    removeItem() { throw new Error("SecurityError"); },
  };
  let p;
  check("loading does not throw", (() => { p = make(hostile); return "fine"; })(), "fine");
  check("and it says it cannot remember", p.remembers, false);
  check("with nothing on screen", p.conns.length, 0);
  p.active = -1;
  p.cfg = { ...p.DEFAULTS, owner: "a", repo: "r", branch: "main", token: "T" };
  check("saving does not throw either",
        (() => { p.store(); return "fine"; })(), "fine");
  check("and the project works for this tab", p.conns.length, 1);
}


// ── two tabs, two projects ──────────────────────────────────────────────────
//
// The fault v31 exists for, reported as: open the planner in a second tab, set
// it up for another project, and the first tab ends up on that project too.
{
  const vault = fakeStore();
  const a = tab(vault);                     // tab one connects a project
  a.cfg = { ...a.DEFAULTS, owner: "a", repo: "one", branch: "main", token: "TOK-A" };
  a.active = -1; a.store();

  const b = tab(vault);                     // tab two opens and adds another
  check("the second tab sees the first tab's project", b.conns.length, 1);
  b.active = -1;
  b.cfg = { ...b.DEFAULTS, owner: "a", repo: "two", branch: "main", token: "TOK-B" };
  b.store();
  check("and now there are two", JSON.parse(vault.map[VAULT]).list.length, 2);
  check("tab two is on the one it just added", b.cfg.repo, "two");

  check("tab one did not move", a.cfg.repo, "one");
  a.loadAll();
  check("and does not move when it reads again", a.cfg.repo, "one");

  // **The write-back that used to delete a token.** Tab one holds a list that
  // was loaded before project two existed, so writing it whole dropped project
  // two and its token -- from a page that cannot show a token twice.
  a.cfg = { ...a.cfg, message: "edited in tab one" };
  a.store();
  const after = JSON.parse(vault.map[VAULT]).list;
  check("both projects survive tab one writing", after.length, 2);
  check("and the other tab's token is intact",
        after.find(c => c.repo === "two").token, "TOK-B");
  check("while tab one's edit landed",
        after.find(c => c.repo === "one").message, "edited in tab one");
}

// ── a tab is pinned to a project, not to a position ─────────────────────────
//
// An index into a list another tab can add to points at whatever moved into
// that slot. The four identifying fields do not move.
{
  const vault = fakeStore();
  const session = fakeStore();
  const a = tab(vault, session);
  a.active = -1;
  a.cfg = { ...a.DEFAULTS, owner: "a", repo: "second", branch: "main", token: "T2" };
  a.store();
  check("this tab pinned the project it is on",
        JSON.parse(session.map["roadmap.tab.v1"]).repo, "second");

  const stored = JSON.parse(vault.map[VAULT]);
  stored.list.unshift({ owner: "a", repo: "first", branch: "main",
                        path: "docs/roadmap.json", token: "T1" });
  stored.active = 0;
  vault.setItem(VAULT, JSON.stringify(stored));

  a.loadAll();
  check("the pinned tab follows the project, not the index", a.cfg.repo, "second");
  check("and the vault's own choice is what a fresh tab opens on",
        tab(vault).cfg.repo, "first");
}

// ── a deletion is the one thing a merge cannot infer ────────────────────────
{
  const vault = fakeStore();
  const a = tab(vault);
  a.active = -1;
  a.cfg = { ...a.DEFAULTS, owner: "a", repo: "one", branch: "main", token: "T1" };
  a.store();
  a.active = -1;
  a.cfg = { ...a.DEFAULTS, owner: "a", repo: "two", branch: "main", token: "T2" };
  a.store();
  const gone = { ...a.conns[0] };
  a.conns = a.conns.filter(c => c.repo !== "one");
  a.active = 0;
  a.persist(gone);
  check("the removed project is gone", JSON.parse(vault.map[VAULT]).list.length, 1);
  check("and it is the right one left",
        JSON.parse(vault.map[VAULT]).list[0].repo, "two");
}

// ── forgetting clears this tab's pin too ────────────────────────────────────
{
  const vault = fakeStore();
  const session = fakeStore();
  const a = tab(vault, session);
  a.active = -1;
  a.cfg = { ...a.DEFAULTS, owner: "a", repo: "one", branch: "main", token: "T" };
  a.store();
  a.forgetStored();
  check("the pin goes with the vault", session.map["roadmap.tab.v1"], undefined);
}

console.log(`${pass + problems.length} checks against the page's own storage`);
problems.forEach(p => console.log("FAIL " + p));
if (problems.length) process.exit(1);
console.log("a token survives the upgrade, a second project does not replace\n  the first, and two tabs hold two projects");
