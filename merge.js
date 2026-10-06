// Merge Salesforce delta pulls into data/*.json, then rebuild the report.
// Usage: node merge.js <pulledAtISO> [--full]
//   data/delta-accounts.json  [[Id,Name,Type,EE,Region], ...]
//   data/delta-plans.json     [[Id,AccountId,Tier,EE,Channel,IdCard,Testing,Start,End,Year], ...]
//   data/departed-ids.json    [Id, ...]  (changed accounts whose Type is no longer a client type; removed from the report)
//   data/cancer-ids.json      [Id, ...]  (all client accounts where CCD=Voluntary and every procedure = Not Covered)
// --full: delta files are the COMPLETE set (replace instead of upsert), used for periodic reconciliation.
const fs=require('fs'),path=require('path');
const D=f=>path.join(__dirname,'data',f), rd=(f,d)=>fs.existsSync(D(f))?JSON.parse(fs.readFileSync(D(f),'utf8')):d;
const pulledAt=process.argv[2]; if(!pulledAt||isNaN(Date.parse(pulledAt))){console.error('need ISO pulledAt');process.exit(1);}
const full=process.argv.includes('--full');
const CLIENT=new Set(['Client - Live','Client - Implementing']), OVERRIDES=new Set(['001VP000006VX2fYAG']);
const keep=a=>CLIENT.has(a[2])||OVERRIDES.has(a[0]);
const upsert=(base,delta)=>{const m=new Map(full?[]:base.map(r=>[r[0],r]));delta.forEach(r=>m.set(r[0],r));return [...m.values()];};
const cancer=new Set(rd('cancer-ids.json',[]));
const departed=new Set(rd('departed-ids.json',[])); // accounts whose Type moved out of the client types (Terming, Former Client, ...)
let accounts=upsert(rd('accounts.json',[]).map(a=>a.slice(0,5)),rd('delta-accounts.json',[])).filter(a=>keep(a)&&!departed.has(a[0])).map(a=>[...a.slice(0,5),cancer.has(a[0])?1:0]);
let plans=upsert(rd('plans.json',[]),rd('delta-plans.json',[]));
fs.writeFileSync(D('accounts.json'),JSON.stringify(accounts));
fs.writeFileSync(D('plans.json'),JSON.stringify(plans));
fs.writeFileSync(D('meta.json'),JSON.stringify({pulledAt}));
// counts for drift checks against SOQL COUNT() (same window as the report's 2027 filter)
const inWin=p=>(p[7]&&p[7]>='2026-11-01'&&p[7]<'2027-11-01')||(p[8]&&p[8]>='2027-01-01'&&p[8]<='2027-12-31');
console.log(JSON.stringify({accounts:accounts.length,plansInWindow:plans.filter(inWin).length,plansTotal:plans.length,cancerOnly:accounts.filter(a=>a[5]).length}));
require('child_process').execFileSync('node',[path.join(__dirname,'build.js')],{stdio:'inherit'});
