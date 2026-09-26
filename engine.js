/* SILLY POINT — cricket engine.
   A match is data; everything shown is derived by replaying deliveries. */

const Cricket = (() => {

  function newMatch({ teamA, teamB, playersA, playersB, overs, tossWinner, elected }) {
    const id = "m" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    return {
      id, v: 1,
      created: new Date().toISOString(),
      teams: {
        A: { name: teamA, players: playersA },
        B: { name: teamB, players: playersB }
      },
      totalOvers: overs,
      toss: { winner: tossWinner, elected },
      status: "setup", // setup -> live -> break -> live -> done
      innings: [],
      result: null
    };
  }

  function battingFirstKey(match) {
    const w = match.toss.winner;
    return match.toss.elected === "bat" ? w : (w === "A" ? "B" : "A");
  }

  function startInnings(match, striker, nonStriker, bowler) {
    const batKey = match.innings.length === 0 ? battingFirstKey(match) : (battingFirstKey(match) === "A" ? "B" : "A");
    match.innings.push({
      bat: batKey,
      deliveries: [],
      striker, nonStriker,
      currentBowler: bowler,
      complete: false
    });
    match.status = "live";
  }

  function bowlingKey(inn) { return inn.bat === "A" ? "B" : "A"; }

  // Replay one innings and derive everything.
  function derive(match, innIdx) {
    const inn = match.innings[innIdx];
    const batTeam = match.teams[inn.bat];
    const bowlTeam = match.teams[bowlingKey(inn)];
    const out = {
      runs: 0, wickets: 0, legal: 0, extras: { wd: 0, nb: 0, bye: 0, lb: 0 },
      batters: {}, order: [], bowlers: {},
      fow: [], thisOver: [], oversDone: 0,
      striker: inn.striker, nonStriker: inn.nonStriker,
      complete: inn.complete
    };
    const usedBatters = new Set([inn.striker, inn.nonStriker]);
    let striker = inn.striker, nonStriker = inn.nonStriker;

    const batter = n => {
      if (!out.batters[n]) { out.batters[n] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: null }; out.order.push(n); }
      return out.batters[n];
    };
    const bowler = n => {
      if (!out.bowlers[n]) out.bowlers[n] = { balls: 0, runs: 0, wickets: 0 };
      return out.bowlers[n];
    };

    let legalThisOver = 0;
    let lastBowler = inn.currentBowler;

    for (const d of inn.deliveries) {
      lastBowler = d.bowler;
      const B = batter(striker), W = bowler(d.bowler);
      const isWd = d.type === "wd", isNb = d.type === "nb";
      const legal = !isWd && !isNb;

      let totalRuns = 0;
      if (d.type === "run") totalRuns = d.batRuns;
      else if (isWd) totalRuns = 1 + (d.extraRuns || 0);
      else if (isNb) totalRuns = 1 + d.batRuns;
      else totalRuns = d.batRuns; // bye / legbye

      out.runs += totalRuns;
      W.runs += totalRuns;
      if (legal) { W.balls++; B.balls++; out.legal++; legalThisOver++; }
      if (isWd) out.extras.wd += totalRuns;
      if (isNb) out.extras.nb += totalRuns;
      if (d.type === "bye") out.extras.bye += totalRuns;
      if (d.type === "lb") out.extras.lb += totalRuns;

      if (d.type === "run" || isNb) {
        B.runs += d.batRuns;
        if (d.batRuns === 4) B.fours++;
        if (d.batRuns === 6) B.sixes++;
      }

      // token for this-over display
      let token;
      if (d.wk) token = "W";
      else if (isWd) token = (d.extraRuns ? (1 + d.extraRuns) : 1) + "wd";
      else if (isNb) token = d.batRuns ? d.batRuns + "nb" : "nb";
      else if (d.type === "bye") token = d.batRuns + "b";
      else if (d.type === "lb") token = d.batRuns + "lb";
      else token = String(d.batRuns);
      out.thisOver.push({ token, cls: d.wk ? "wk" : (isWd || isNb || d.type === "bye" || d.type === "lb" ? "ex" : (d.batRuns === 4 ? "b4" : d.batRuns === 6 ? "b6" : "")) });

      if (d.wk) {
        out.wickets++;
        W.wickets++;
        B.out = d.wk;
        out.fow.push({ score: out.runs, n: out.wickets, batter: striker });
        // next batter: first unused in team order
        const nxt = batTeam.players.find(p => !usedBatters.has(p)) || ("No. " + (usedBatters.size + 1));
        usedBatters.add(nxt);
        striker = nxt;
      }

      // strike rotation
      const strikeRuns = (d.type === "run" || isNb || d.type === "bye" || d.type === "lb") ? d.batRuns : 0;
      if (strikeRuns % 2 === 1) [striker, nonStriker] = [nonStriker, striker];

      if (legalThisOver === 6) {
        [striker, nonStriker] = [nonStriker, striker];
        out.oversDone++;
        legalThisOver = 0;
        out.thisOver = [];
      }
    }

    out.striker = striker;
    out.nonStriker = nonStriker;
    out.yetToBat = batTeam.players.filter(p => !usedBatters.has(p));
    out.lastBowler = lastBowler;
    out.batters[striker] && (out.batters[striker].onStrike = true);

    // innings completion
    const maxWkts = Math.min(batTeam.players.length - 1, 10);
    out.allOut = out.wickets >= maxWkts;
    out.oversUp = out.legal >= match.totalOvers * 6;
    out.overStr = Math.floor(out.legal / 6) + "." + (out.legal % 6);
    out.runRate = out.legal > 0 ? (out.runs / (out.legal / 6)) : 0;
    return out;
  }

  function target(match) {
    if (match.innings.length < 2) return null;
    return derive(match, 0).runs + 1;
  }

  function checkResult(match) {
    if (match.innings.length === 0) return;
    const d1 = derive(match, 0);
    const inn1 = match.innings[0];
    if (!inn1.complete && (d1.allOut || d1.oversUp)) inn1.complete = true;
    if (!inn1.complete) return;

    if (match.innings.length === 1) { match.status = "break"; return; }

    const d2 = derive(match, 1);
    const inn2 = match.innings[1];
    const tgt = d1.runs + 1;
    const batKey2 = inn2.bat;
    const name = k => match.teams[k].name;
    if (d2.runs >= tgt) {
      inn2.complete = true;
      match.status = "done";
      match.result = `${name(batKey2)} won by ${Math.min(match.teams[batKey2].players.length - 1, 10) - d2.wickets} wickets`;
    } else if (d2.allOut || d2.oversUp) {
      inn2.complete = true;
      match.status = "done";
      if (d2.runs === tgt - 1) match.result = "Match tied";
      else match.result = `${name(batKey2 === "A" ? "B" : "A")} won by ${tgt - 1 - d2.runs} runs`;
    }
  }

  function addDelivery(match, d) {
    const inn = match.innings[match.innings.length - 1];
    inn.deliveries.push(d);
    checkResult(match);
  }

  function undo(match) {
    const inn = match.innings[match.innings.length - 1];
    if (!inn.deliveries.length) return false;
    inn.deliveries.pop();
    inn.complete = false;
    if (match.status === "done") { match.status = "live"; match.result = null; }
    if (match.status === "break") match.status = "live";
    return true;
  }

  // plain-language ball description for the watch feed
  function describe(d, names) {
    const bowler = d.bowler.split(" ").map(p => p[0]).join(". ").replace("..", ".") + " to " + d.striker;
    if (d.wk) {
      const hows = { bowled: "BOWLED HIM", caught: "OUT, caught", lbw: "OUT, leg before", stumped: "OUT, stumped", "hit-wicket": "OUT, hit wicket", "run-out": "OUT, run out" };
      return `<b>WICKET.</b> ${bowler} — ${hows[d.wk.how] || "out"}. ${d.wk.who} goes.`;
    }
    if (d.type === "wd") return `${bowler} — <b>wide</b>${d.extraRuns ? ", " + d.extraRuns + " more" : ""}.`;
    if (d.type === "nb") return `${bowler} — <b>no ball</b>${d.batRuns ? ", " + d.batRuns + " off the bat" : ""}.`;
    if (d.type === "bye") return `${bowler} — ${d.batRuns} bye${d.batRuns > 1 ? "s" : ""}.`;
    if (d.type === "lb") return `${bowler} — ${d.batRuns} leg bye${d.batRuns > 1 ? "s" : ""}.`;
    const shots = { 0: "no run, solid defence", 1: "worked away for <b>one</b>", 2: "two runs, good running", 3: "<b>three</b>, they ran hard", 4: "<b>FOUR.</b> Finds the fence", 6: "<b>SIX.</b> That is enormous" };
    return `${bowler} — ${shots[d.batRuns] || d.batRuns + " runs"}.`;
  }

  return { newMatch, startInnings, derive, addDelivery, undo, target, checkResult, battingFirstKey, bowlingKey, describe };
})();
