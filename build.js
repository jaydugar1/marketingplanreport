// Builds MarketingPlanReport.html from template.html + data/accounts.json + data/plans.json
// accounts.json: [[Id, Name, Type, EligibleEmployees|null, Region|null, cancerOnly(0/1)], ...]
// plans.json:    [[Id, AccountId, Tier|null, EE|null, ChannelStatus, IdCardStatus, Testing, Start, End, Year], ...]
// meta.json:     { "pulledAt": "ISO timestamp" }
const fs=require('fs'),path=require('path');
const dir=__dirname, rd=f=>JSON.parse(fs.readFileSync(path.join(dir,'data',f),'utf8'));
const PROC=['Bariatric','Cardiac','ENT','Gallbladder','General','Minor_General','GI_excl_colonoscopies','GYN','Hernia','Interventional_Pain','Joint_Replacement','OP_Ortho','Spine','Thyroid','Urology','Preventative_Colonoscopies','Diagnostic_Colonoscopies','Infusions'];
const accounts=rd('accounts.json').map(([Id,Name,Type,ee,Region,co])=>{
  const o={Id,Name,Type,Eligible_Employees__c:ee,Region__c:Region};
  PROC.forEach(p=>o[p+'__c']=co?'Not Covered':null);
  o.CCD__c=co?'Voluntary':null; return o;});
const plans=rd('plans.json').map(([Id,a,tier,ee,ch,idc,tp,s,e,y])=>({Id,Account__c:a,Client_Tier__c:tier,Eligible_Employees__c:ee,
  Marketing_Channel_Approval_Status__c:ch,ID_Card_Approval_Status__c:idc,Testing_Program__c:tp,
  Marketing_Campaign_Start_Date__c:s,Marketing_Campaign_End_Date__c:e,Marketing_Campaign_Year__c:y}));
const meta=rd('meta.json');
const js=o=>JSON.stringify(o).replace(/</g,'\u003c');
let html=fs.readFileSync(path.join(dir,'template.html'),'utf8')
  .replace('"__PULLED__"',()=>js(meta.pulledAt)).replace('__ACCOUNTS__',()=>js(accounts)).replace('__PLANS__',()=>js(plans))
  .replace('c.toLocaleDateString()','c.toLocaleString()')
  .replace('ask Claude to refresh for a newer pull','auto-refreshes daily');
html=html.replace('</head>','<meta http-equiv="refresh" content="900"></head>'); // reload page every 15 min to pick up new snapshots
fs.writeFileSync(path.join(dir,'MarketingPlanReport.html'),html);
fs.writeFileSync(path.join(dir,'index.html'),html); // Vercel/static hosts serve index.html at the site root
console.log(`Built MarketingPlanReport.html: ${accounts.length} accounts, ${plans.length} plans, pulled ${meta.pulledAt}`);
