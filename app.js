/* SILLY POINT — UI + sync layer. */

const LS_KEY = "sillypoint.v1";
const BROKER = "wss://broker.emqx.io:8084/mqtt";
const TOPIC = id => "sillypoint/match/" + id;

/* ———— store ———— */
function loadStore() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const sample = buildSeedMatch();
  const store = { matches: { [sample.id]: sample }, seeded: true };
  localStorage.setItem(LS_KEY, JSON.stringify(store));
  return store;
}
let store = loadStore();
function saveStore() { localStorage.setItem(LS_KEY, JSON.stringify(store)); }
function getMatch(id) { return store.matches[id]; }
function putMatch(m) { store.matches[m.id] = m; saveStore(); }

/* ———— helpers ———— */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(msg) {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ———— sync ———— */
let mqttClient = null, mqttOk = false, lastSeen = 0;
const bus = "BroadcastChannel" in window ? new BroadcastChannel("sillypoint") : null;

function syncInit(matchId, onRemote) {
  const pill = $("#conn-pill");
  pill.hidden = false;
  const setConn = (live, label) => {
    pill.classList.toggle("live", live);
    $("#conn-text").textContent = label;
  };
  if (typeof mqtt !== "undefined") {
    try {
      mqttClient = mqtt.connect(BROKER, { reconnectPeriod: 4000, connectTimeout: 8000 });
      mqttClient.on("connect", () => {
        mqttOk = true;
        mqttClient.subscribe(TOPIC(matchId));
        setConn(true, "linked");
      });
      mqttClient.on("message", (topic, payload) => {
        try {
          const remote = JSON.parse(payload.toString());
          if (remote && remote.id === matchId) { lastSeen = Date.now(); setConn(true, "live"); onRemote(remote); }
        } catch (e) {}
      });
      mqttClient.on("close", () => { mqttOk = false; setConn(false, "reconnecting…"); });
      mqttClient.on("error", () => { mqttOk = false; setConn(false, "offline"); });
    } catch (e) { setConn(false, "offline"); }
  } else setConn(false, "offline");
  if (bus) bus.onmessage = ev => {
    const remote = ev.data;
    if (remote && remote.id === matchId) { lastSeen = Date.now(); setConn(true, "live (this browser)"); onRemote(remote); }
  };
  setInterval(() => {
    if (lastSeen && Date.now() - lastSeen > 90000) setConn(mqttOk, mqttOk ? "linked" : "offline");
  }, 15000);
}
function publish(match) {
  putMatch(match);
  const payload = JSON.stringify(match);
  try { if (mqttClient && mqttOk) mqttClient.publish(TOPIC(match.id), payload, { retain: true }); } catch (e) {}
  if (bus) bus.postMessage(match);
}

/* ———— router ———— */
function route() {
  const h = location.hash || "#/";
  const [_, page, id] = h.split("/");
  if (page === "new") return renderSetup();
  if (page === "score" && getMatch(id)) return renderScorer(getMatch(id));
  if (page === "watch" && (getMatch(id) || id)) return renderWatch(id);
  if (page === "card" && getMatch(id)) return renderScorecardPage(getMatch(id));
  return renderHome();
}
window.addEventListener("hashchange", route);

/* ———— home ———— */
function renderHome() {
  closeModal();
  const matches = Object.values(store.matches).sort((a, b) => b.created.localeCompare(a.created));
  $("#app").innerHTML = `
    <div class="home-hero">
      <h1>Score it ball by ball.<br>Everyone else <em>watches it live.</em></h1>
      <p>One person scores the match from the boundary rope. Friends, teammates and the group chat open a link and see every ball as it lands — no app, no account, no sign-up.</p>
      <div class="home-actions">
        <a class="btn" href="#/new">Start a match</a>
        <button class="btn ghost" id="watch-by-id">Watch with a link</button>
      </div>
    </div>
    <hr class="rule">
    ${store.seeded ? `<div class="sample-banner"><span class="tag">Sample match</span>The finished game below is demo content so you can open a real scorecard. <button class="linklike" id="wipe-sample" style="margin-left:auto">Remove it</button></div>` : ""}
    <div class="home-grid">
      <div class="card">
        <div class="card-head"><span class="card-title">Matches on this device</span><span class="card-aside">${matches.length}</span></div>
        ${matches.length === 0 ? `<div class="card-body"><div class="empty"><div class="big">No matches yet.</div>Start one and it lives here.</div></div>` : ""}
        ${matches.map(m => {
          const d1 = m.innings[0] ? Cricket.derive(m, 0) : null;
          const d2 = m.innings[1] ? Cricket.derive(m, 1) : null;
          const scoreLine = m.innings.map((inn, i) => {
            const d = Cricket.derive(m, i);
            return `${m.teams[inn.bat].name} ${d.runs}/${d.wickets} (${d.overStr})`;
          }).join(" · ");
          const live = m.status === "live" || m.status === "break";
          return `<a class="match-row" href="#/card/${m.id}">
            ${live ? `<span class="live-pill">Live</span>` : ""}
            <span class="match-teams">${esc(m.teams.A.name)} v ${esc(m.teams.B.name)}</span>
            <span class="match-meta">${m.totalOvers} overs${m.sample ? " · sample" : ""}</span>
            <span class="match-score">${esc(m.result || scoreLine)}</span>
          </a>`;
        }).join("")}
      </div>
      <div class="card">
        <div class="card-head"><span class="card-title">How it works</span></div>
        <div class="card-body" style="font-size:14.5px; line-height:1.75">
          <p><b>1.</b> Set the teams, overs and toss. Thirty seconds.</p>
          <p style="margin-top:8px"><b>2.</b> Score from the pad — runs, wides, no-balls, wickets. The scorecard writes itself.</p>
          <p style="margin-top:8px"><b>3.</b> Share the watch link. Every ball publishes live to whoever opens it, on any phone, anywhere.</p>
          <p style="margin-top:8px"><b>4.</b> Cricket first. Other sports later.</p>
        </div>
      </div>
    </div>`;
  $("#watch-by-id").addEventListener("click", () => {
    const v = prompt("Paste the watch link or match ID:");
    if (!v) return;
    const m = v.match(/#\/watch\/([\w-]+)/) || v.match(/([\w-]+)$/);
    if (m) location.hash = "#/watch/" + m[1];
  });
  const w = $("#wipe-sample");
  if (w) w.addEventListener("click", () => {
    delete store.matches["sample-tusker-uniworld"];
    store.seeded = false; saveStore(); renderHome();
  });
}

/* ———— setup ———— */
function renderSetup() {
  $("#app").innerHTML = `
    <p class="kicker">New match</p>
    <h1 style="font-family:var(--serif);font-weight:300;font-size:40px;margin:8px 0 24px">Set the game.</h1>
    <div class="setup-grid">
      <div class="card"><div class="card-head"><span class="card-title">Team one</span></div><div class="card-body">
        <div class="field"><label>Team name</label><input id="ta-name" placeholder="Tusker XI"></div>
        <div class="field"><label>Players — one per line, batting order</label>
          <textarea id="ta-players" rows="6" placeholder="Leave blank for generic Player 1–11"></textarea>
          <div class="players-hint">Eleven is a full side; fewer works too.</div></div>
      </div></div>
      <div class="card"><div class="card-head"><span class="card-title">Team two</span></div><div class="card-body">
        <div class="field"><label>Team name</label><input id="tb-name" placeholder="Uniworld Strikers"></div>
        <div class="field"><label>Players — one per line, batting order</label>
          <textarea id="tb-players" rows="6"></textarea></div>
      </div></div>
    </div>
    <div class="card" style="margin-top:18px"><div class="card-head"><span class="card-title">Format & toss</span></div><div class="card-body">
      <div class="setup-grid" style="grid-template-columns:1fr 1fr 1fr">
        <div class="field"><label>Overs</label><select id="f-overs">${[5, 6, 8, 10, 12, 15, 20].map(o => `<option ${o === 8 ? "selected" : ""}>${o}</option>`).join("")}</select></div>
        <div class="field"><label>Toss won by</label><select id="f-toss"><option value="A">Team one</option><option value="B">Team two</option></select></div>
        <div class="field"><label>Elected to</label><select id="f-elect"><option value="bat">Bat</option><option value="bowl">Bowl</option></select></div>
      </div>
      <button class="btn" id="create-match" style="margin-top:6px">Create the match</button>
    </div></div>`;
  $("#create-match").addEventListener("click", () => {
    const names = (id, fb) => {
      const lines = $(id).value.split("\n").map(s => s.trim()).filter(Boolean);
      return lines.length ? lines.slice(0, 15) : Array.from({ length: 11 }, (_, i) => fb + " " + (i + 1));
    };
    const m = Cricket.newMatch({
      teamA: $("#ta-name").value.trim() || "Team One",
      teamB: $("#tb-name").value.trim() || "Team Two",
      playersA: names("#ta-players", "Player"),
      playersB: names("#tb-players", "Player"),
      overs: +$("#f-overs").value,
      tossWinner: $("#f-toss").value,
      elected: $("#f-elect").value
    });
    putMatch(m);
    location.hash = "#/score/" + m.id;
  });
}

/* ———— shared bits ———— */
function bugHTML(m) {
  const innIdx = m.innings.length - 1;
  const inn = m.innings[innIdx];
  const d = Cricket.derive(m, innIdx);
  const tgt = Cricket.target(m);
  const ballsLeft = m.totalOvers * 6 - d.legal;
  const need = tgt ? tgt - d.runs : null;
  return `<div class="bug">
    <div class="bug-innings-label">${innIdx === 0 ? "First innings" : "Second innings"} · ${m.totalOvers}-over match</div>
    <div class="bug-main">
      <span class="bug-team">${esc(m.teams[inn.bat].name)}</span>
      <span class="bug-score">${d.runs}<span style="opacity:.55">/${d.wickets}</span></span>
      <span class="bug-overs">${d.overStr} ov</span>
    </div>
    <div class="bug-sub">
      <span class="rr">CRR ${d.runRate.toFixed(2)}</span>
      ${tgt && !inn.complete ? `<span class="bug-target">Need ${need} off ${ballsLeft} balls${ballsLeft > 0 ? " · RRR " + (need / (ballsLeft / 6)).toFixed(2) : ""}</span>` : ""}
      ${innIdx === 0 && d1Done(m) ? `` : ""}
      ${inn.complete && innIdx === 0 ? `<span class="bug-target">Innings closed · target ${d.runs + 1}</span>` : ""}
      ${m.result ? `<span class="bug-target">${esc(m.result)}</span>` : ""}
    </div>
    <div class="this-over">${d.thisOver.map(b => `<span class="ball-dot ${b.cls}">${esc(b.token)}</span>`).join("")}</div>
  </div>`;
}
function d1Done(m) { return m.innings[0] && m.innings[0].complete; }

function stripHTML(m) {
  const inn = m.innings[m.innings.length - 1];
  const d = Cricket.derive(m, m.innings.length - 1);
  const fig = n => {
    const b = d.batters[n];
    return b ? `${b.runs}${b.out ? "" : "*"} (${b.balls})` : "—";
  };
  const bl = d.bowlers[inn.currentBowler];
  const oversFig = bl ? `${Math.floor(bl.balls / 6)}.${bl.balls % 6}-${bl.runs}-${bl.wickets}` : "0-0-0";
  return `<div class="strip">
    <div class="strip-cell"><div class="strip-label">Striker</div>
      <div class="strip-name"><span class="strike-dot"></span>${esc(d.striker)}</div><div class="strip-fig">${fig(d.striker)}</div></div>
    <div class="strip-cell"><div class="strip-label">Non-striker</div>
      <div class="strip-name">${esc(d.nonStriker)}</div><div class="strip-fig">${fig(d.nonStriker)}</div></div>
    <div class="strip-cell"><div class="strip-label">Bowling</div>
      <div class="strip-name">${esc(inn.currentBowler)}</div><div class="strip-fig">${oversFig} (ov-runs-wkts)</div></div>
  </div>`;
}

function scorecardHTML(m, innIdx) {
  if (!m.innings[innIdx]) return `<div class="empty"><div class="big">Innings not started.</div></div>`;
  const inn = m.innings[innIdx];
  const d = Cricket.derive(m, innIdx);
  const bowlKey = Cricket.bowlingKey(inn);
  const ext = d.extras;
  const extTotal = ext.wd + ext.nb + ext.bye + ext.lb;
  const howOut = b => {
    if (!b.out) return "not out";
    const h = b.out.how;
    const bw = b.out.bowler || "";
    return { bowled: "b " + bw, caught: (bw ? "c † b " + bw : "caught"), lbw: "lbw b " + bw, stumped: "st † b " + bw, "hit-wicket": "hit wicket b " + bw, "run-out": "run out" }[h] || h;
  };
  return `
    <p class="kicker" style="margin-bottom:10px">${esc(m.teams[inn.bat].name)} — ${d.runs}/${d.wickets} (${d.overStr} ov)</p>
    <table class="card-table">
      <tr><th>Batter</th><th></th><th class="num">R</th><th class="num">B</th><th class="num">4s</th><th class="num">6s</th></tr>
      ${d.order.map(n => {
        const b = d.batters[n];
        return `<tr class="${b.out ? "" : "notout"}"><td class="batter-name">${esc(n)}${b.onStrike ? " ●" : ""}</td>
          <td class="dismissal">${howOut(b)}</td>
          <td class="num">${b.runs}</td><td class="num">${b.balls}</td><td class="num">${b.fours}</td><td class="num">${b.sixes}</td></tr>`;
      }).join("")}
      <tr class="totals-row"><td>Extras</td><td class="dismissal">wd ${ext.wd} · nb ${ext.nb} · b ${ext.bye} · lb ${ext.lb}</td><td class="num" colspan="4">${extTotal}</td></tr>
      <tr class="totals-row"><td>Total</td><td></td><td class="num" colspan="4">${d.runs}/${d.wickets} · ${d.overStr} ov · RR ${d.runRate.toFixed(2)}</td></tr>
    </table>
    ${d.yetToBat.length ? `<p style="font-family:var(--mono);font-size:11px;color:var(--ink-3);padding:10px 10px 0">Yet to bat: ${d.yetToBat.map(esc).join(", ")}</p>` : ""}
    <table class="card-table" style="margin-top:18px">
      <tr><th>Bowler</th><th class="num">O</th><th class="num">R</th><th class="num">W</th><th class="num">Econ</th></tr>
      ${Object.entries(d.bowlers).map(([n, b]) => `<tr>
        <td class="batter-name">${esc(n)}</td>
        <td class="num">${Math.floor(b.balls / 6)}.${b.balls % 6}</td>
        <td class="num">${b.runs}</td><td class="num">${b.wickets}</td>
        <td class="num">${b.balls ? (b.runs / (b.balls / 6)).toFixed(1) : "—"}</td></tr>`).join("")}
    </table>
    ${d.fow.length ? `<div class="fow-line"><span class="kicker">Fall of wickets</span><br>${d.fow.map(f => `${f.score}/${f.n} (${esc(f.batter)})`).join(" · ")}</div>` : ""}`;
}

/* ———— scorer console ———— */
let scorerView = "pad";
function renderScorer(m) {
  const innIdx = m.innings.length - 1;
  const inn = m.innings[innIdx];

  if (m.status === "done") { location.hash = "#/card/" + m.id; return; }

  if (m.innings.length === 0 || innIdx < 0) {
    return openersFlow(m, true);
  }
  if (m.status === "break") {
    $("#app").innerHTML = `
      ${bugHTML(m)}
      <div class="result-card" style="margin-top:18px">
        <h2>Innings break.</h2>
        <p>${esc(m.teams[inn.bat].name)} ${Cricket.derive(m, innIdx).runs}/${Cricket.derive(m, innIdx).wickets} — target ${Cricket.derive(m, innIdx).runs + 1} in ${m.totalOvers} overs.</p>
        <div class="result-actions">
          <button class="btn" id="start-inn2">Start the chase</button>
          <a class="btn ghost" href="#/card/${m.id}">Full scorecard</a>
        </div>
      </div>`;
    $("#start-inn2").addEventListener("click", () => openersFlow(m, false));
    return;
  }

  const d = Cricket.derive(m, innIdx);
  const overJustDone = d.legal > 0 && d.legal % 6 === 0 && !inn.complete;

  $("#app").innerHTML = `
    ${m.sample ? `<div class="sample-banner"><span class="tag">Sample match</span>This is demo content. <button class="linklike" id="wipe-sample2" style="margin-left:auto">Remove it</button></div>` : ""}
    ${bugHTML(m)}
    ${stripHTML(m)}
    <div class="scorecard-tabs">
      <button class="chip ${scorerView === "pad" ? "on" : ""}" data-v="pad">Scoring pad</button>
      <button class="chip ${scorerView === "card" ? "on" : ""}" data-v="card">Scorecard</button>
    </div>
    ${scorerView === "pad" ? padHTML(m, d) : `<div class="card"><div class="card-body">${scorecardHTML(m, innIdx)}</div></div>`}
    <div class="share-box">
      <span class="kicker">Watch link</span>
      <span class="share-url">${location.origin}${location.pathname}#/watch/${m.id}</span>
      <button class="btn small ghost" id="copy-link">Copy</button>
    </div>`;

  $$(".scorecard-tabs .chip").forEach(c => c.addEventListener("click", () => { scorerView = c.dataset.v; renderScorer(m); }));
  $("#copy-link").addEventListener("click", () => {
    navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/watch/${m.id}`);
    toast("Watch link copied");
  });
  const w2 = $("#wipe-sample2");
  if (w2) w2.addEventListener("click", () => { delete store.matches[m.id]; store.seeded = false; saveStore(); location.hash = "#/"; });
  if (scorerView === "pad") bindPad(m, d);
  if (overJustDone) bowlerFlow(m);

  syncInitOnce(m.id);
}

let syncReady = false;
function syncInitOnce(id) {
  if (syncReady) return;
  syncReady = true;
  syncInit(id, remote => {
    const local = getMatch(id);
    if (JSON.stringify(remote) !== JSON.stringify(local)) { putMatch(remote); route(); }
  });
}

function padHTML(m, d) {
  const inn = m.innings[m.innings.length - 1];
  if (inn.complete) return `<div class="empty"><div class="big">Innings closed.</div></div>`;
  return `<div class="pad">
    <div class="pad-section">
      <div class="pad-label">Runs off the bat</div>
      <div class="run-grid">
        ${[0, 1, 2, 3, 4, 5, 6].map(r => `<button class="run-btn r${r}" data-runs="${r}">${r}</button>`).join("")}
      </div>
    </div>
    <div class="pad-section">
      <div class="pad-label">Extras</div>
      <div class="extra-grid">
        <button class="extra-btn" data-extra="wd">Wide</button>
        <button class="extra-btn" data-extra="nb">No ball</button>
        <button class="extra-btn" data-extra="bye">Bye</button>
        <button class="extra-btn" data-extra="lb">Leg bye</button>
      </div>
      <div class="mod-row" id="extra-runs-row" hidden>
        <span class="kicker" id="extra-runs-label">Runs</span>
        <span id="extra-runs-chips"></span>
      </div>
    </div>
    <div class="pad-section">
      <button class="wicket-btn" id="wk-btn">Wicket</button>
    </div>
    <div class="pad-actions">
      <button class="btn ghost small" id="undo-ball">Undo last ball</button>
      <button class="btn ghost small" id="end-innings">Close innings</button>
    </div>
  </div>`;
}

function bindPad(m, d) {
  const inn = m.innings[m.innings.length - 1];
  const commit = del => {
    del.bowler = inn.currentBowler;
    del.striker = d.striker;
    if (del.wk && del.wk.how !== "run-out") del.wk.bowler = inn.currentBowler;
    Cricket.addDelivery(m, del);
    publish(m);
    renderScorer(m);
  };
  $$(".run-btn").forEach(b => b.addEventListener("click", () =>
    commit({ type: "run", batRuns: +b.dataset.runs })));

  const extraRow = $("#extra-runs-row"), chips = $("#extra-runs-chips"), lab = $("#extra-runs-label");
  $$(".extra-btn").forEach(b => b.addEventListener("click", () => {
    const kind = b.dataset.extra;
    extraRow.hidden = false;
    if (kind === "wd") {
      lab.textContent = "Extra runs beyond the wide";
      chips.innerHTML = [0, 1, 2, 3].map(r => `<button class="chip" data-r="${r}">${r === 0 ? "none" : "+" + r}</button>`).join("");
    } else if (kind === "nb") {
      lab.textContent = "Runs off the bat";
      chips.innerHTML = [0, 1, 2, 3, 4, 6].map(r => `<button class="chip" data-r="${r}">${r}</button>`).join("");
    } else {
      lab.textContent = kind === "bye" ? "Byes" : "Leg byes";
      chips.innerHTML = [1, 2, 3, 4].map(r => `<button class="chip" data-r="${r}">${r}</button>`).join("");
    }
    $$("#extra-runs-chips .chip").forEach(c => c.addEventListener("click", () => {
      const r = +c.dataset.r;
      if (kind === "wd") commit({ type: "wd", batRuns: 0, extraRuns: r });
      else if (kind === "nb") commit({ type: "nb", batRuns: r });
      else commit({ type: kind, batRuns: r });
    }));
  }));

  $("#wk-btn").addEventListener("click", () => wicketFlow(m, d, commit));
  $("#undo-ball").addEventListener("click", () => {
    if (Cricket.undo(m)) { publish(m); renderScorer(m); toast("Last ball removed"); }
  });
  $("#end-innings").addEventListener("click", () => {
    if (!confirm("Close this innings?")) return;
    inn.complete = true;
    Cricket.checkResult(m);
    publish(m);
    renderScorer(m);
  });
}

/* ———— modals ———— */
function modal(html) {
  closeModal();
  const o = document.createElement("div");
  o.className = "overlay"; o.id = "sp-modal";
  o.innerHTML = `<div class="sheet">${html}</div>`;
  document.body.appendChild(o);
  o.addEventListener("click", e => { if (e.target === o && !o.dataset.locked) closeModal(); });
  return o;
}
function closeModal() { $("#sp-modal")?.remove(); }

function openersFlow(m, first) {
  const batKey = first ? Cricket.battingFirstKey(m) : (Cricket.battingFirstKey(m) === "A" ? "B" : "A");
  const bowlKey = batKey === "A" ? "B" : "A";
  const bat = m.teams[batKey], bowl = m.teams[bowlKey];
  const o = modal(`
    <div class="sheet-head"><h3>${first ? "Open the match" : "Start the chase"}</h3></div>
    <div class="sheet-body">
      <div class="field"><label>Striker — ${esc(bat.name)}</label><select id="of-s">${bat.players.map(p => `<option>${esc(p)}</option>`).join("")}</select></div>
      <div class="field"><label>Non-striker</label><select id="of-ns">${bat.players.map((p, i) => `<option ${i === 1 ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></div>
      <div class="field"><label>Opening bowler — ${esc(bowl.name)}</label><select id="of-b">${bowl.players.map(p => `<option>${esc(p)}</option>`).join("")}</select></div>
      <div class="sheet-actions"><button class="btn" id="of-go">Play</button></div>
    </div>`);
  o.dataset.locked = "1";
  $("#of-go").addEventListener("click", () => {
    const s = $("#of-s").value, ns = $("#of-ns").value;
    if (s === ns) { toast("Striker and non-striker must differ"); return; }
    Cricket.startInnings(m, s, ns, $("#of-b").value);
    publish(m);
    closeModal();
    location.hash = "#/score/" + m.id;
    renderScorer(m);
  });
  if (!$("#app").innerHTML.trim()) $("#app").innerHTML = `<div class="empty"><div class="big">Setting the field…</div></div>`;
}

function bowlerFlow(m) {
  const inn = m.innings[m.innings.length - 1];
  const bowlKey = Cricket.bowlingKey(inn);
  const bowl = m.teams[bowlKey];
  const d = Cricket.derive(m, m.innings.length - 1);
  const o = modal(`
    <div class="sheet-head"><h3>Over ${Math.floor(d.legal / 6)} done. Next bowler?</h3></div>
    <div class="sheet-body">
      <div class="field"><label>Cannot be ${esc(d.lastBowler)} (just bowled)</label>
        <select id="bf-b">${bowl.players.filter(p => p !== d.lastBowler).map(p => `<option>${esc(p)}</option>`).join("")}</select></div>
      <div class="sheet-actions"><button class="btn" id="bf-go">Bowl</button></div>
    </div>`);
  o.dataset.locked = "1";
  $("#bf-go").addEventListener("click", () => {
    inn.currentBowler = $("#bf-b").value;
    publish(m); closeModal(); renderScorer(m);
  });
}

function wicketFlow(m, d, commit) {
  const o = modal(`
    <div class="sheet-head"><h3>Wicket</h3><button class="linklike" onclick="document.getElementById('sp-modal').remove()">Cancel</button></div>
    <div class="sheet-body">
      <div class="field"><label>How</label>
        <div class="wk-grid">
          ${["bowled", "caught", "lbw", "stumped", "hit-wicket", "run-out"].map((h, i) => `<button class="wk-opt ${i === 0 ? "on" : ""}" data-h="${h}">${h}</button>`).join("")}
        </div></div>
      <div class="field" id="wk-who-field" hidden><label>Who is out</label>
        <select id="wk-who"><option value="striker">${esc(d.striker)} (striker)</option><option value="nonstriker">${esc(d.nonStriker)} (non-striker)</option></select></div>
      <div class="field" id="wk-runs-field" hidden><label>Runs completed before the run out</label>
        <select id="wk-runs">${[0, 1, 2, 3].map(r => `<option>${r}</option>`).join("")}</select></div>
      <div class="sheet-actions"><button class="btn danger" id="wk-go">Confirm wicket</button></div>
    </div>`);
  let how = "bowled";
  $$(".wk-opt", o).forEach(b => b.addEventListener("click", () => {
    $$(".wk-opt", o).forEach(x => x.classList.remove("on"));
    b.classList.add("on"); how = b.dataset.h;
    const ro = how === "run-out";
    $("#wk-who-field").hidden = !ro;
    $("#wk-runs-field").hidden = !ro;
  }));
  $("#wk-go").addEventListener("click", () => {
    let who = d.striker, batRuns = 0;
    if (how === "run-out") {
      who = $("#wk-who").value === "striker" ? d.striker : d.nonStriker;
      batRuns = +$("#wk-runs").value;
    }
    // non-striker run-out: engine replaces striker; to keep it simple we treat
    // a non-striker run-out by swapping first
    if (who === d.nonStriker) {
      const inn = m.innings[m.innings.length - 1];
      [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
    }
    closeModal();
    commit({ type: "run", batRuns, wk: { how, who } });
  });
}

/* ———— watch view ———— */
let watchId = null;
function renderWatch(id) {
  closeModal();
  const m = getMatch(id);
  if (watchId !== id) { watchId = id; syncReady = false; }
  syncInitOnceWatch(id);

  if (!m) {
    $("#app").innerHTML = `
      <div class="watch-banner"><span class="live-pill">Waiting</span>
        <span class="watch-note">Listening for this match. When the scorer starts, it appears here live.</span></div>
      <div class="empty"><div class="big">No signal yet.</div>
        Keep this tab open — the first ball lands here the moment it's scored.<br><br>
        <span style="font-family:var(--mono);font-size:11px">match ${esc(id)}</span></div>`;
    return;
  }
  const innIdx = m.innings.length - 1;
  const inn = m.innings[innIdx];
  const feed = inn ? inn.deliveries.slice(-14).reverse() : [];
  const d = inn ? Cricket.derive(m, innIdx) : null;
  $("#app").innerHTML = `
    <div class="watch-banner">
      <span class="live-pill">${m.status === "done" ? "Result" : "Live"}</span>
      <span class="watch-note">${esc(m.teams.A.name)} v ${esc(m.teams.B.name)} · ${m.totalOvers} overs · updates itself</span>
    </div>
    ${m.innings.length ? bugHTML(m) : `<div class="empty"><div class="big">Toss done, first ball soon.</div></div>`}
    ${m.innings.length ? stripHTML(m) : ""}
    <div class="scorecard-tabs">
      <button class="chip ${scorerView === "pad" ? "on" : ""}" data-v="pad">Ball by ball</button>
      <button class="chip ${scorerView === "card" ? "on" : ""}" data-v="card">Scorecard</button>
    </div>
    ${scorerView === "card" && m.innings.length
      ? `<div class="card"><div class="card-body">${scorecardHTML(m, innIdx)}${m.innings.length > 1 ? `<hr class="rule">${scorecardHTML(m, 0)}` : ""}</div></div>`
      : `<div class="commentary">
          ${feed.length === 0 ? `<div class="empty"><div class="big">First ball soon.</div></div>` : ""}
          ${feed.map(del => {
            const overNum = Math.floor((inn.deliveries.indexOf(del)) / 6);
            return `<div class="commentary-item"><span class="commentary-ball">${overNum + 1}.${(inn.deliveries.slice(0, inn.deliveries.indexOf(del) + 1).filter(x => x.type !== "wd" && x.type !== "nb").length - 1) % 6 + 1}</span><span class="commentary-text">${Cricket.describe(del)}</span></div>`;
          }).join("")}
        </div>`}
    ${m.result ? `<div class="result-card" style="margin-top:22px"><h2>${esc(m.result)}</h2></div>` : ""}`;
  $$(".scorecard-tabs .chip").forEach(c => c.addEventListener("click", () => { scorerView = c.dataset.v; renderWatch(id); }));
}
function syncInitOnceWatch(id) {
  if (syncReady) return;
  syncReady = true;
  syncInit(id, remote => { putMatch(remote); renderWatch(id); });
}

/* ———— scorecard page ———— */
function renderScorecardPage(m) {
  $("#app").innerHTML = `
    <div class="watch-banner">
      ${m.status === "live" || m.status === "break" ? `<span class="live-pill">Live</span>` : ""}
      <span class="watch-note">${esc(m.teams.A.name)} v ${esc(m.teams.B.name)} · ${m.totalOvers} overs · ${new Date(m.created).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
    </div>
    ${m.innings.length ? bugHTML(m) : ""}
    ${m.result ? `<div class="result-card" style="margin:18px 0"><h2>${esc(m.result)}</h2></div>` : ""}
    ${m.innings.map((inn, i) => `<div class="card" style="margin-top:16px"><div class="card-body">${scorecardHTML(m, i)}</div></div>`).join("")}
    <div class="result-actions" style="margin-top:24px">
      ${m.status !== "done" ? `<a class="btn" href="#/score/${m.id}">Open the scorer</a>` : ""}
      <a class="btn ghost" href="#/watch/${m.id}">Watch view</a>
      <a class="btn ghost" href="#/">All matches</a>
    </div>
    <div class="share-box">
      <span class="kicker">Watch link</span>
      <span class="share-url">${location.origin}${location.pathname}#/watch/${m.id}</span>
      <button class="btn small ghost" onclick="navigator.clipboard?.writeText('${location.origin}${location.pathname}#/watch/${m.id}')">Copy</button>
    </div>`;
}

route();
