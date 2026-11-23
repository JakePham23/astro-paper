---
title: "Approval Record — <Gate> — <Artefact Name>"
description: "Red flags detected: None / <list>"
pubDatetime: 2026-11-19T14:00:00Z
featured: false
tags:
  - template
  - documentation
---
# Approval Record — <Gate> — <Artefact Name>

> **Guide:** One record per gate approval. Approval is valid only for the exact version / commit listed below; any subsequent change to the artefact requires re-approval.
> An agent may pre-fill the "Inputs" and "Evidence" sections, but the "Decision" section must be filled only by the human approver.
> Guide: [../02-quy-trinh-phan-mem/09-checklist-phe-duyet.md](../02-quy-trinh-phan-mem/09-checklist-phe-duyet.md)

## 1. Metadata

| Field | Value |
|-------|-------|
| Record ID | APR-<project-code>-<number> |
| Gate | G0 / G1 / G2 / G3 / G4 / G5 / G6 / G7 / G8 |
| Approved artefact | <BRD / SRS / design / plan / PR #… / test report / release …> |
| Path | <file path or PR link> |
| Version / commit SHA | <...> |
| Author / agent | <name> / <agent, model, session if applicable> |
| Approver | <full name, role> |
| Consulted | <...> |
| Approval date | <YYYY-MM-DD> |
| Merged gates (if any) | <e.g., G2–G4 merged for bug fix BUG-112> |

## 2. Evidence Reviewed

> Be specific: what and where. Never write "reviewed document".

| # | Evidence | Location (link / file / SHA) | Verification result |
|---|----------|------------------------------|---------------------|
| 1 | <e.g., CI run on commit abc1234> | <link> | <248 pass, 0 fail, 2 skip (reason: …)> |
| 2 | <e.g., BR→FR traceability matrix> | <file:section> | <12/12 Must BRs covered> |
| 3 | <e.g., spot-check of baseline metric sources> | <...> | <matched / mismatched> |

## 3. Checklist Results

| Checklist | "Yes" count / total | "No" items and acceptance rationale |
|-----------|---------------------|-------------------------------------|
| General checklist ([09](../02-quy-trinh-phan-mem/09-checklist-phe-duyet.md)) | <.../8> | <...> |
| Gate-specific checklist | <.../...> | <...> |

**Red flags detected:** None / <list>

## 4. Decision

- [ ] **Approve**
- [ ] **Approve with conditions**
- [ ] **Reject**

**Rationale:** <...>

### Conditions (when Approve with conditions)

| # | Condition | Owner | Due date | Re-verification method |
|---|-----------|-------|----------|------------------------|
| 1 | <...> | <...> | <...> | <...> |

### Required Actions for Resubmission (when Reject)

1. <...>

## 5. Accepted Risks
> Known risks accepted to proceed, and who accepted them.

| Risk | Accepted by | Notes |
|------|-------------|-------|
| <...> | <...> | <...> |

## 6. Sign-off

| Role | Full Name | Signature / Confirmation | Date |
|------|-----------|--------------------------|------|
| Approver | | | |
| <Consulted> | | | |
