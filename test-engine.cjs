const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const c=vm.createContext({crypto});vm.runInContext(['engine.js','validate.js','seed.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n')+'\nthis.C=Cricket;',c);const C=c.C;
let count=0;const eq=(a,b)=>{assert.equal(a,b);count++};
function match(){const m=C.newMatch({teamA:'One',teamB:'Two',playersA:['Alice','Bob','Carol'],playersB:['Dan','Eli','Flo'],overs:1,tossWinner:'A',elected:'bat'});C.startInnings(m,'Alice','Bob','Dan');return m}
function add(m,x){C.addDelivery(m,{type:'run',batRuns:0,bowler:'Dan',striker:C.derive(m,m.innings.length-1).striker,...x});return C.derive(m,m.innings.length-1)}
let m=match(),d=add(m,{type:'bye',batRuns:4});eq(d.runs,4);eq(d.bowlers.Dan.runs,0);eq(d.extras.bye,4);
d=add(m,{type:'nb',batRuns:2});eq(d.runs,7);eq(d.bowlers.Dan.runs,3);eq(d.extras.nb,1);eq(d.batters.Alice.runs,2);eq(d.legal,1);
d=add(m,{wk:{how:'run-out',who:'Bob'}});eq(d.batters.Alice.out,null);eq(d.batters.Bob.out.how,'run-out');eq(d.bowlers.Dan.wickets,0);eq(d.nonStriker,'Carol');
C.undo(m);eq(C.derive(m,0).wickets,0);eq(m.innings[0].striker,'Alice');eq(m.innings[0].nonStriker,'Bob');
m=match();d=add(m,{type:'wd',extraRuns:1});eq(d.striker,'Bob');eq(d.legal,0);eq(d.extras.wd,2);
m=match();for(let i=0;i<6;i++)d=add(m,{batRuns:0});eq(m.status,'break');eq(d.legal,6);C.startInnings(m,'Dan','Eli','Alice');d=add(m,{batRuns:1,bowler:'Alice'});eq(m.status,'done');eq(m.result,'Two won by 2 wickets');C.undo(m);eq(m.status,'live');eq(m.result,null);
eq(C.describe({type:'run',batRuns:0,bowler:'<img>',striker:'<script>'}).includes('<script>'),false);
const seeds=vm.runInContext('buildSeedMatches()',c);for(const seed of seeds){c.validateMatch(seed);count++;}
let invalid=JSON.parse(JSON.stringify(match()));invalid.innings[0].deliveries=Array(3001).fill({});assert.throws(()=>c.validateMatch(invalid));count++;
invalid=JSON.parse(JSON.stringify(match()));invalid.teams.A.players=['same','same'];assert.throws(()=>c.validateMatch(invalid));count++;
console.log(count+' engine and schema checks passed');
