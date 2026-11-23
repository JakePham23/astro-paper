---
title: "Release Checklist — <System Name> v<MAJOR.MINOR.PATCH>"
description: "- [ ] <Login works>"
pubDatetime: 2026-11-19T12:00:00Z
featured: false
tags:
  - template
  - documentation
  - checklist
  - release
---
# Release Checklist — <System Name> v<MAJOR.MINOR.PATCH>

> **Guide:** Fill in before the Go/No-go meeting. Every row must record evidence (link, SHA, confirmer). Any "No" item requires a rationale and risk owner.
> Detailed guide: [../02-quy-trinh-phan-mem/08-release.md](../02-quy-trinh-phan-mem/08-release.md)

| Field | Value |
|-------|-------|
| Version | v<...> |
| Tag / commit | <tag> / <SHA> |
| Artefact | <package / image name + digest> |
| Planned deploy window | <YYYY-MM-DD HH:MM> |
| Strategy | Big bang / Blue-green / Canary / Feature flag |
| Release manager | <name> |
| Post-deploy on-call | <name, internal contact> |

## 1. Prerequisites

| # | Item | Yes/No | Evidence |
|---|------|:------:|----------|
| 1 | G6 test exit approved | | <approval record> |
| 2 | G7 UAT approved | | <approval record> |
| 3 | Released artefact = tested artefact (same digest) | | <...> |
| 4 | Version follows SemVer, tag points to correct commit | | <...> |
| 5 | Changelog and release notes approved | | <link> |
| 6 | Open bugs listed and accepted | | <list + risk owner> |
| 7 | Security / Legal sign-off (if personal data changed) | | <...> |

## 2. Data and Infrastructure

| # | Item | Yes/No | Evidence |
|---|------|:------:|----------|
| 1 | Backward-compatible migration (expand–contract) | | <...> |
| 2 | Pre-deploy backup taken, restore verified | | <...> |
| 3 | Production config/secrets ready (not stored in repo) | | <...> |
| 4 | Feature flags set to correct initial state | | <...> |

## 3. Rollback Plan

| Item | Details |
|------|---------|
| Trigger conditions | <e.g., 5xx > 2% for 10 min; corrupted business data> |
| Decision maker | <...> |
| Steps | 1. <...> 2. <...> 3. <...> |
| Estimated duration | <≤ ... minutes> |
| Rehearsed | Yes / No — date <...>, environment <...> |
| Handling data created during incident | <...> |

## 4. Communication

| # | Item | Yes/No |
|---|------|:------:|
| 1 | Users notified in advance of window and changes | |
| 2 | Support team has release notes and FAQ | |
| 3 | Incident reporting channel announced | |

## 5. Post-Deploy Smoke Tests

- [ ] <Login works>
- [ ] <Health check returns 200>
- [ ] <Core business flow passes with test account>
- [ ] <Logs show no unexpected new errors>
- [ ] <Test data cleaned up>

## 6. Monitoring (First 24–72 Hours)

| Metric | Alert Threshold | Owner |
|--------|-----------------|-------|
| <error rate> | <...> | <...> |
| <p95 latency> | <...> | <...> |
| <business metric> | <...> | <...> |

## 7. Go/No-go Decision

| Role | Full Name | Vote (Go / No-go / Conditional Go) |
|------|-----------|------------------------------------|
| Release manager | | |
| PO | | |
| QA lead | | |
| Dev lead | | |
| Operations | | |

**Final decision:** Go / Conditional Go / No-go
**Conditions (if any):** <...>
**Signed by:** <...> — <YYYY-MM-DD HH:MM>
