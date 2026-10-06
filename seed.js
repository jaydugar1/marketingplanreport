// One-time: convert the original report's embedded data into the compact format
const fs=require('fs');
const A=JSON.parse(fs.readFileSync('data/original-accounts.json')),P=JSON.parse(fs.readFileSync('data/original-plans.json'));
const PROC=['Bariatric','Cardiac','ENT','Gallbladder','General','Minor_General','GI_excl_colonoscopies','GYN','Hernia','Interventional_Pain','Joint_Replacement','OP_Ortho','Spine','Thyroid','Urology','Preventative_Colonoscopies','Diagnostic_Colonoscopies','Infusions'];
fs.writeFileSync('data/accounts.json',JSON.stringify(A.map(a=>[a.Id,a.Name,a.Type,a.Eligible_Employees__c??null,a.Region__c??null,a.CCD__c==='Voluntary'&&PROC.every(p=>a[p+'__c']==='Not Covered')?1:0])));
fs.writeFileSync('data/plans.json',JSON.stringify(P.map(p=>[p.Id,p.Account__c,p.Client_Tier__c,p.Eligible_Employees__c??null,p.Marketing_Channel_Approval_Status__c,p.ID_Card_Approval_Status__c,p.Testing_Program__c,p.Marketing_Campaign_Start_Date__c,p.Marketing_Campaign_End_Date__c,p.Marketing_Campaign_Year__c])));
fs.writeFileSync('data/meta.json',JSON.stringify({pulledAt:'2026-10-02T18:00:00Z'}));
