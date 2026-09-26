/* Sample match — a finished 8-over hostel-turf game so the product
   opens with history in it. Clearly marked sample; deletable. */

function buildSeedMatch() {
  const A = { name: "Tusker XI", players: ["Arjun Nair", "Dev Patel", "Kiran Rao", "Aditya K", "Rohit Menon", "Sanjay Iyer", "Vikram Joshi", "Nikhil Das", "Farhan Ali", "Tejas Kulkarni", "Manav Shah"] };
  const B = { name: "Uniworld Strikers", players: ["Rahul Verma", "Ishaan Gupta", "Zaid Khan", "Pranav Hegde", "Arnav Singh", "Karthik R", "Dhruv Malhotra", "Sameer Khan", "Yash Thakur", "Abhay Nair", "Ritvik Sen"] };
  const m = Cricket.newMatch({
    teamA: A.name, teamB: B.name, playersA: A.players, playersB: B.players,
    overs: 8, tossWinner: "A", elected: "bat"
  });
  m.id = "sample-tusker-uniworld";
  m.created = "2026-09-20T17:30:00+05:30";
  m.sample = true;

  // deterministic PRNG
  let s = 42;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  const wkTypes = ["bowled", "caught", "caught", "lbw", "run-out", "stumped"];
  function playInnings(match, batPlayers, bowlPlayers, aggression) {
    Cricket.startInnings(match, batPlayers[0], batPlayers[1], bowlPlayers[bowlPlayers.length - 1]);
    let bowlerIdx = bowlPlayers.length - 1;
    let legal = 0;
    while (true) {
      const d = Cricket.derive(match, match.innings.length - 1);
      if (d.allOut || d.oversUp || (match.innings.length === 2 && d.runs >= Cricket.target(match))) break;
      // choose new bowler each over
      if (d.legal > 0 && d.legal % 6 === 0 && legal !== d.legal) {
        legal = d.legal;
        let ni = Math.floor(rnd() * (bowlPlayers.length - 1));
        if (bowlPlayers[ni] === d.lastBowler) ni = (ni + 1) % (bowlPlayers.length - 1);
        bowlerIdx = ni;
        match.innings[match.innings.length - 1].currentBowler = bowlPlayers[bowlerIdx];
      }
      const inn = match.innings[match.innings.length - 1];
      const r = rnd();
      let del;
      if (r < 0.055) del = { type: "wd", batRuns: 0, extraRuns: rnd() < 0.2 ? 1 : 0, bowler: inn.currentBowler, striker: d.striker };
      else if (r < 0.085) del = { type: "nb", batRuns: rnd() < 0.3 ? 1 : 0, bowler: inn.currentBowler, striker: d.striker };
      else if (r < 0.11) del = { type: "bye", batRuns: 1 + (rnd() < 0.2 ? 1 : 0), bowler: inn.currentBowler, striker: d.striker };
      else if (r < 0.11 + (0.055 * aggression)) {
        const who = d.striker;
        del = { type: "run", batRuns: 0, bowler: inn.currentBowler, striker: d.striker, wk: { how: pick(wkTypes), who } };
      } else {
        const weights = [0.34, 0.26, 0.08, 0.01, 0.105, 0.01, 0.085 * aggression]; // 0,1,2,3,4,5,6
        let cum = 0, choice = 0;
        const rr = rnd();
        const totalW = weights.reduce((a, b) => a + b, 0);
        for (let i = 0; i < weights.length; i++) { cum += weights[i] / totalW; if (rr <= cum) { choice = i; break; } }
        del = { type: "run", batRuns: choice, bowler: inn.currentBowler, striker: d.striker };
      }
      Cricket.addDelivery(match, del);
      if (match.status === "done") break;
    }
    match.innings[match.innings.length - 1].complete = true;
  }

  playInnings(m, A.players, B.players, 0.9);
  if (m.status !== "done") {
    playInnings(m, B.players, A.players, 1.0);
  }
  Cricket.checkResult(m);
  return m;
}
