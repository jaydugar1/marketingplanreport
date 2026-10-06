# Refreshing the Marketing Plan Report

Project folder: `C:\Users\jay.dugar\Claude Code\Marketing Approvals Tool`
Output: `MarketingPlanReport.html` (standalone, open in any browser; it auto-reloads every 15 min).

Data comes only from Salesforce (`Account`, `Account_Marketing_Plan__c`) via the Salesforce connector's `soqlQuery`.
Monday is intentionally not used. All business rules (tiers, off-cycle, cancer-only, channel partners, overrides) live in `template.html`.

## Incremental refresh (default)

1. `T0` = current UTC time (`date -u +%Y-%m-%dT%H:%M:%SZ`). `LAST` = `pulledAt` in `data/meta.json`.
2. Run these SOQL queries (substitute LAST for `<LAST>`):
   - **Accounts changed**
     `SELECT Id, Name, Type, Eligible_Employees__c, Region__c FROM Account WHERE SystemModstamp > <LAST> AND (Type IN ('Client - Live','Client - Implementing') OR Id = '001VP000006VX2fYAG')`
     -> write `data/delta-accounts.json` as `[[Id, Name, Type, EE|null, Region|null], ...]`
   - **Departed accounts** (changed accounts that are no longer clients but have plans)
     `SELECT Id FROM Account WHERE SystemModstamp > <LAST> AND Type NOT IN ('Client - Live','Client - Implementing') AND Id != '001VP000006VX2fYAG' AND Id IN (SELECT Account__c FROM Account_Marketing_Plan__c)`
     -> write `data/departed-ids.json` as `["Id", ...]` (overwrite every run; `[]` if none)
   - **Plans changed**
     `SELECT Id, Account__c, Client_Tier__c, Eligible_Employees__c, Marketing_Channel_Approval_Status__c, ID_Card_Approval_Status__c, Testing_Program__c, Marketing_Campaign_Start_Date__c, Marketing_Campaign_End_Date__c, Marketing_Campaign_Year__c FROM Account_Marketing_Plan__c WHERE SystemModstamp > <LAST>`
     -> write `data/delta-plans.json` as `[[Id, Account__c, Tier|null, EE|null, Channel|null, IdCard|null, Testing|null, Start, End, Year], ...]`
   - **Cancer-only accounts** (always the full list, overwrite)
     `SELECT Id FROM Account WHERE Type IN ('Client - Live','Client - Implementing') AND CCD__c = 'Voluntary' AND Bariatric__c = 'Not Covered' AND Cardiac__c = 'Not Covered' AND ENT__c = 'Not Covered' AND Gallbladder__c = 'Not Covered' AND General__c = 'Not Covered' AND Minor_General__c = 'Not Covered' AND GI_excl_colonoscopies__c = 'Not Covered' AND GYN__c = 'Not Covered' AND Hernia__c = 'Not Covered' AND Interventional_Pain__c = 'Not Covered' AND Joint_Replacement__c = 'Not Covered' AND OP_Ortho__c = 'Not Covered' AND Spine__c = 'Not Covered' AND Thyroid__c = 'Not Covered' AND Urology__c = 'Not Covered' AND Preventative_Colonoscopies__c = 'Not Covered' AND Diagnostic_Colonoscopies__c = 'Not Covered' AND Infusions__c = 'Not Covered'`
     -> write `data/cancer-ids.json` as `["Id", ...]`
   Copy values exactly as returned (use `null` for null). Do not invent or alter values.
3. `node merge.js <T0>` — upserts, drops departed accounts, rebuilds `MarketingPlanReport.html`, and prints `{accounts, plansInWindow, ...}`.

## Drift check (every run, after step 3)

Run `SELECT COUNT() FROM Account WHERE Type IN ('Client - Live','Client - Implementing') OR Id = '001VP000006VX2fYAG'` and
`SELECT COUNT() FROM Account_Marketing_Plan__c WHERE (Marketing_Campaign_Start_Date__c >= 2026-11-01 AND Marketing_Campaign_Start_Date__c < 2027-11-01) OR (Marketing_Campaign_End_Date__c >= 2027-01-01 AND Marketing_Campaign_End_Date__c <= 2027-12-31)`.
They must equal `accounts` and `plansInWindow` from merge.js. If either differs (deleted records, missed changes), do a **full resync**:
pull all rows with the same queries minus the `SystemModstamp` filter (page by Name / Id range if the connector truncates), write them to the delta files, and run `node merge.js <T0> --full`.
Re-check counts. If they still differ, report the mismatch instead of publishing silently.

## Files
- `template.html` — original report app with data placeholders. `build.js` — fills template -> `MarketingPlanReport.html`.
- `data/accounts.json`, `data/plans.json`, `data/meta.json` — current compact snapshot. `data/original-*.json` — 10/2/2026 seed (reference only).
- `split.js`, `seed.js` — one-time conversion from the original HTML (not needed for refreshes).
- `node serve.js` — local viewer at http://localhost:8123.
