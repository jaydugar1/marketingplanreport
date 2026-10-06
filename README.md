# 2027 Account Marketing Plan Report

A standalone dashboard showing, for the 2027 plan year, where each LanternCare client stands on **Marketing Channel approval**, **ID Card approval**, and **Testing Program** approval, grouped by tier and client segment. Data comes from **Salesforce**; the page refreshes **daily** on weekdays.

> **Data sensitivity:** the generated report and `data/` contain client names, eligible-employee counts and approval statuses. Keep the GitHub repo **private** and put the hosted site behind authentication (e.g. Vercel Authentication / password protection).

---

## Contents

1. [What it shows](#what-it-shows)
2. [How it works](#how-it-works)
3. [Sources of data (Salesforce)](#sources-of-data-salesforce)
4. [Business rules](#business-rules)
5. [Sources of code](#sources-of-code)
6. [Repository layout](#repository-layout)
7. [Data file formats](#data-file-formats)
8. [Refreshing the data](#refreshing-the-data)
9. [Running and building locally](#running-and-building-locally)
10. [Hosting on Vercel](#hosting-on-vercel)
11. [Known limitations](#known-limitations)
12. [Changing the rules or the look](#changing-the-rules-or-the-look)

---

## What it shows

- **Tabs:** Tier 1, Tier 2, Tier 3, Entire BoB (book of business), Implementing Clients, Cancer-Only, Channel Partners, Off-Cycle Clients.
- **Summary strip:** clients in the group, total eligible employees (EEs), how many have a 2027 marketing plan started, and a note when clients are missing an EE count.
- **View toggle:** **% of EEs** (weighted by eligible employees) or **# of Clients**.
- **Three approval cards:** Marketing Channel Approval, ID Card Approval (hidden on the Cancer-Only tab), Testing Program.
- **Client Detail table:** one row per client with colour-coded status badges. Channel Partners and Off-Cycle tabs add a "Reason" column.
- **Footnote:** an in-page explanation of how groups are built (kept in sync with the rules below).

Names marked with `*` are manual overrides (see [Business rules](#manual-overrides)).

## How it works

```
Salesforce ──(Claude + Salesforce connector, daily scheduled task)──► data/*.json
                                                                          │
template.html (React app + rules) ──► node build.js ◄────────────────────┘
                                          │
                                          ▼
                              MarketingPlanReport.html   (single self-contained file)
                                          │
                              git commit/push ──► Vercel static hosting
```

1. A **scheduled task** (Claude desktop app, "Scheduled" section) runs on weekdays at ~7:15 AM local time. It follows [REFRESH.md](REFRESH.md): queries Salesforce for records changed since the last pull, writes small delta files, and runs `node merge.js`.
2. `merge.js` upserts the deltas into `data/accounts.json` / `data/plans.json`, removes accounts that are no longer clients, flags cancer-only accounts, and calls `build.js`.
3. `build.js` injects the data into `template.html` and writes `MarketingPlanReport.html`. All filtering and calculation happens **in the browser** when the page loads, so the HTML is fully static.
4. Each run ends with a **drift check**: record counts are compared against Salesforce `COUNT()` queries; a mismatch triggers a full resync, and if it still doesn't match the previous file is left in place.

Only changed records are pulled each day (Salesforce `SystemModstamp`), which keeps the refresh small and avoids re-transcribing the whole dataset.

## Sources of data (Salesforce)

Salesforce is the **only** data source. Monday.com is intentionally **not** used (several Salesforce fields "sync to Monday", so Monday is a downstream copy).

### `Account` (standard object)

| Field | Used for |
|---|---|
| `Id`, `Name` | Client identity / display name |
| `Type` | Scope: `Client - Live` and `Client - Implementing` only (plus a manual override) |
| `Eligible_Employees__c` | EE count fallback when the plan has none |
| `Region__c` | `Channel Partner` value flags channel-partner accounts |
| `CCD__c` + 18 procedure fields: `Bariatric__c`, `Cardiac__c`, `ENT__c`, `Gallbladder__c`, `General__c`, `Minor_General__c`, `GI_excl_colonoscopies__c`, `GYN__c`, `Hernia__c`, `Interventional_Pain__c`, `Joint_Replacement__c`, `OP_Ortho__c`, `Spine__c`, `Thyroid__c`, `Urology__c`, `Preventative_Colonoscopies__c`, `Diagnostic_Colonoscopies__c`, `Infusions__c` | **Cancer-only** test: `CCD__c = 'Voluntary'` and all 18 procedure fields `= 'Not Covered'`. Evaluated in SOQL; only a 0/1 flag is stored. |

### `Account_Marketing_Plan__c` (custom object, "Account Marketing Plan")

| Field | Used for |
|---|---|
| `Account__c` | Join to Account |
| `Client_Tier__c` | Tier 1 / 2 / 3 |
| `Eligible_Employees__c` | EE count (preferred over the Account value) |
| `Marketing_Channel_Approval_Status__c` | Marketing Channel card |
| `ID_Card_Approval_Status__c` | ID Card card |
| `Testing_Program__c` | Testing Program card |
| `Marketing_Campaign_Start_Date__c`, `Marketing_Campaign_End_Date__c`, `Marketing_Campaign_Year__c` | Selecting the 2027 plan; off-cycle detection |

Salesforce access is through the **Salesforce connector** in Claude (`soqlQuery`). There is no stored credential in this repo.

## Business rules

All rules live in `template.html` (search for `cd(` for group membership and `td(` for the join).

### Population
Start from every Account with `Type` = `Client - Implementing` or `Client - Live`, then left-join the account's 2027 marketing plan if one exists. Accounts **without** a 2027 plan stay in every count and show **No 2027 Plan**.

### Which plan counts as "2027"
A plan record is a 2027 plan if its start date is in `[2026-11-01, 2027-11-01)`, **or** its end date falls in 2027. If an account has several, plans that start in that window win, then the most recent start date.

### Group membership
| Tab | Rule |
|---|---|
| Tier 1 / 2 / 3 | Plan `Client_Tier__c` matches; excludes channel partners, off-cycle plans, cancer-only |
| Implementing Clients | `Type = Client - Implementing`; same exclusions. May overlap with a Tier tab (intended). |
| Entire BoB | Everyone except channel partners, off-cycle plans, cancer-only |
| Cancer-Only | Cancer-only accounts (holding area, never in Tier / Implementing / Off-Cycle) |
| Channel Partners | `Region__c = 'Channel Partner'`, no other filtering (can overlap Cancer-Only / Off-Cycle) |
| Off-Cycle Clients | Plan start date `2027-03-01`–`2027-11-01` or `2026-11-01`–`2026-12-31`, and not cancer-only |

### Status normalisation
- **Marketing Channel:** all approved variants (Email, Print, Email+Print, and their *Quarterly Approval* equivalents) → **Approved**; `Declined` → Declined; blank/other → **Pending**.
- **ID Card:** `Pending`, `ID Approved`, `At Risk`, `Declined`, `Declined: Approved Alternative`; blank/other → Pending.
- **Testing Program:** `Approved`, `Test-by-Test Approval`, `Declined`; blank/other → Pending.

### Manual overrides
Hard-coded in the template, not Salesforce:
- `001VP000006VX2fYAG` (**Curative**, `Active Partner`) is forced in as `Client - Live`, `Tier 1`. Remove once the Salesforce record is corrected.
- Excluded test/placeholder accounts: `0014x00000K2cE0AAJ`, `0014x000022IAgKAAW`, `0014x000022IAq0AAG`, `001VP00000JdtzNYAR`.

### Calculations
- % of EEs = sum of EEs in a bucket ÷ sum of EEs for all clients **that have an EE count**. Clients missing an EE count are excluded from % of EEs but still counted in # of Clients.

## Sources of code

| Component | Origin |
|---|---|
| **Report UI and rules** (`template.html`) | Derived from the exported report `MarketingPlanReport 1 (1).html`, a Claude-generated React artifact with a Salesforce snapshot dated **2026-10-02**. The app code (layout, colours, grouping logic, status mapping) is unchanged except for three header tweaks made by `build.js`: it shows date **and time** of the pull, says "auto-refreshes daily", and adds a 15-minute `<meta refresh>`. The embedded data was replaced by placeholders. |
| **React 19.2.5** (`react`, `react-dom`, `scheduler`) | Bundled inside the original export (MIT License, © Meta Platforms, Inc.). Not installed via npm. License text is preserved at the end of `template.html`. |
| `split.js` | One-time script (Claude-authored) that split the original export into `template.html` and JSON data. |
| `seed.js` | One-time script (Claude-authored) that converted the original data into the compact JSON format. |
| `build.js`, `merge.js`, `serve.js` | Claude-authored Node scripts for this project. No third-party dependencies (Node built-ins only). |
| `REFRESH.md`, scheduled task `refresh-marketing-plan-report` | Claude-authored runbook and Claude desktop scheduled task. |

Node.js 20+ is expected (developed on v24).

## Repository layout

```
MarketingPlanReport.html   Generated output (committed so Vercel can serve it)
template.html              React app + rules with __ACCOUNTS__ / __PLANS__ / __PULLED__ placeholders
build.js                   template + data  ->  MarketingPlanReport.html
merge.js                   Upserts Salesforce deltas into data/ and rebuilds
REFRESH.md                 Exact SOQL + steps the scheduled task follows
serve.js                   Tiny local server (http://localhost:8123)
split.js, seed.js          One-time conversion scripts from the original export
vercel.json                Hosting config (root rewrite, no-cache, noindex)
data/
  accounts.json            Current accounts snapshot (compact)
  plans.json               Current plan snapshot (compact)
  meta.json                { "pulledAt": ISO timestamp }
  cancer-ids.json          Account IDs flagged cancer-only
  delta-*.json, departed-ids.json, original-*.json   Working files (git-ignored)
```

## Data file formats

`data/accounts.json` — `[Id, Name, Type, EligibleEmployees|null, Region|null, cancerOnly(0|1)]`

`data/plans.json` — `[Id, AccountId, Tier|null, EE|null, ChannelStatus|null, IdCardStatus|null, Testing|null, StartDate, EndDate, Year]`

The compact arrays are expanded back to the original object shape by `build.js` so the React code needs no changes. For cancer-only accounts it writes `CCD__c = 'Voluntary'` and every procedure field `= 'Not Covered'`; for others those fields are null.

## Refreshing the data

- **Automatic:** the scheduled task described above (weekdays ~7:15 AM, only while the Claude desktop app is open; it runs on next launch if it was closed).
- **Manual:** open this folder in Claude Code and ask it to "follow REFRESH.md", or use "Run now" on the task in the desktop app's Scheduled section.
- **Full resync:** `node merge.js <ISO timestamp> --full` with complete (unfiltered) delta files; see the drift-check section in [REFRESH.md](REFRESH.md).

## Running and building locally

```bash
node build.js        # rebuild MarketingPlanReport.html from data/
node serve.js        # view at http://localhost:8123
```

No `npm install` is needed.

## Hosting on Vercel

1. Create a **private** GitHub repo and push this folder.
2. In Vercel, **Add New → Project**, import the repo. Framework preset: **Other**; no build command; output directory is the repo root.
3. Enable **Vercel Authentication** (or password protection) on the project before sharing the URL.
4. The daily refresh commits and pushes the updated `data/` and `MarketingPlanReport.html`; Vercel redeploys automatically on each push.

`vercel.json` serves the report at `/`, disables caching, and sets `X-Robots-Tag: noindex`.

## Known limitations

- Refresh depends on the Claude desktop app being open on the scheduling machine.
- The page is a snapshot of the last refresh (shown in the header); it is not live against Salesforce.
- Manual overrides and excluded account IDs are hard-coded in `template.html`.
- Deleted Salesforce records are only detected by the drift check, which then triggers a full resync.
- No Monday.com integration (see [Sources of data](#sources-of-data-salesforce)).

## Changing the rules or the look

Edit `template.html` (minified React; the app code is near the end of the file, after `KC=`), then run `node build.js`. Group logic is in the `cd` function, plan selection in `td`, status mapping in `QC` / `WC` / `$C`, and colours in `na`, `D_`, `Up`, `Bp`, `Jp`. Always compare against Salesforce counts after a rule change.
