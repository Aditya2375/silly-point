/* Validate snapshots before persistence or rendering. Public sync is untrusted. */
function validateMatch(m) {
  const bad = () => {throw new Error('Invalid match snapshot')};
  const obj = x => x && typeof x === 'object' && !Array.isArray(x);
  const text = (x,n=100) => typeof x === 'string' && x.length>0 && x.length<=n;
  const key = x => x === 'A' || x === 'B';
  const integer = (x,a,b) => Number.isInteger(x) && x>=a && x<=b;
  if(!obj(m)||m.v!==1||!text(m.id,80)||!/^[a-zA-Z0-9-]+$/.test(m.id)||!text(m.created,40)||!Number.isFinite(Date.parse(m.created))||!obj(m.teams)||!integer(m.totalOvers,1,50)||!obj(m.toss)||!key(m.toss.winner)||!['bat','bowl'].includes(m.toss.elected)||!['setup','live','break','done'].includes(m.status)||!Array.isArray(m.innings)||m.innings.length>2||!(m.result===null||text(m.result,300)))bad();
  const team = t => {
    if(!obj(t)||!text(t.name)||!Array.isArray(t.players)||t.players.length<2||t.players.length>15||t.players.some(p=>!text(p,80))||new Set(t.players).size!==t.players.length)bad();
    return {name:t.name,players:[...t.players]};
  };
  const teams={A:team(m.teams.A),B:team(m.teams.B)};
  const first = m.toss.elected==='bat'?m.toss.winner:(m.toss.winner==='A'?'B':'A');
  const innings=m.innings.map((inn,i)=>{
    if(!obj(inn)||!key(inn.bat)||inn.bat!==(i===0?first:(first==='A'?'B':'A'))||!Array.isArray(inn.deliveries)||inn.deliveries.length>3000||typeof inn.complete!=='boolean')bad();
    const bat=teams[inn.bat].players,bowl=teams[inn.bat==='A'?'B':'A'].players;
    if(!bat.includes(inn.striker)||!bat.includes(inn.nonStriker)||inn.striker===inn.nonStriker||!bowl.includes(inn.currentBowler))bad();
    return {bat:inn.bat,striker:inn.striker,nonStriker:inn.nonStriker,currentBowler:inn.currentBowler,complete:inn.complete,deliveries:inn.deliveries.map(d=>{
      if(!obj(d)||!['run','wd','nb','bye','lb'].includes(d.type)||!integer(d.batRuns,0,6)||!bowl.includes(d.bowler)||!bat.includes(d.striker)||!(d.extraRuns==null||integer(d.extraRuns,0,6)))bad();
      const clean={type:d.type,batRuns:d.batRuns,bowler:d.bowler,striker:d.striker};
      if(d.extraRuns!=null)clean.extraRuns=d.extraRuns;
      if(d.wk!=null){if(!obj(d.wk)||!['bowled','caught','lbw','stumped','hit-wicket','run-out'].includes(d.wk.how)||!bat.includes(d.wk.who)||(d.type!=='run'&&d.wk.how!=='run-out'))bad();clean.wk={how:d.wk.how,who:d.wk.who};if(d.wk.bowler!=null){if(!bowl.includes(d.wk.bowler))bad();clean.wk.bowler=d.wk.bowler;}}
      return clean;
    })};
  });
  return {v:1,id:m.id,created:m.created,teams,totalOvers:m.totalOvers,toss:{winner:m.toss.winner,elected:m.toss.elected},status:m.status,innings,result:m.result};
}
