---
title: "Test Plan — <System Name> <version>"
description: "- Environment: <staging URL / configuration>"
pubDatetime: 2026-11-19T10:00:00Z
featured: false
tags:
  - template
  - documentation
  - testing
---
# Test Plan — <System Name> <version>

> **Guide:** Entry/exit criteria must be approved **before** testing begins and must not change after results are collected.
> Detailed guide: [../02-quy-trinh-phan-mem/07-kiem-thu.md](../02-quy-trinh-phan-mem/07-kiem-thu.md)

| Field | Value |
|-------|-------|
| Document ID | TP-<code> |
| Version | <0.1> |
| Referenced SRS | SRS-<code> version <x.y> |
| Build / commit under test | <tag or SHA> |
| QA lead | <name> |

## 1. Objectives
<...>

## 2. Test Scope

| In Scope | Out of Scope (and rationale) |
|----------|------------------------------|
| <FR/NFR/feature> | <...> — <rationale> |

## 3. Strategy

| Level | What to Test | Automated/Manual | Tool | Owner/Agent |
|-------|--------------|------------------|------|-------------|
| Unit | <...> | Automated | <...> | <...> |
| Integration | <...> | | | |
| System / E2E | <...> | | | |
| Regression | <...> | | | |
| Performance | <NFR-xx> | | | |
| Security | <NFR-xx> | | | |
| UAT | <BR Must> | Manual | | Business users |

## 4. Environment and Data
- Environment: <staging URL / configuration>
- Test data: <source, anonymization method>
- Test accounts by role: <...>

## 5. Entry Criteria
- [ ] <Build deployed to test environment, smoke test passes>
- [ ] <Test cases approved>
- [ ] <...>

## 6. Exit Criteria
- [ ] <100% of High-priority test cases executed>
- [ ] <≥ ...% pass rate>
- [ ] <0 open Critical/High defects>
- [ ] <Performance NFRs met: ...>
- [ ] <Open Medium/Low defects accepted by PO>

## 7. Suspension / Resumption Criteria
- Suspend when: <e.g., login broken, > 30% of tests blocked by a single defect>
- Resume when: <...>

## 8. Defect Management
- Tool: <...>
- Severity definitions: Critical / High / Medium / Low — <link or description>
- Priority triage owner: <PO>

## 9. Traceability

| FR/NFR | Test Case | Type | Result |
|--------|-----------|------|--------|
| FR-01 | TC-001..TC-00x | <...> | *(fill during execution)* |

## 10. Schedule and Resources

| Activity | Start | End | Owner |
|----------|-------|-----|-------|
| <...> | | | |

## 11. Testing Risks
- <...>

## 12. Required Exit Evidence
- [ ] CI link / tool report for build <SHA>
- [ ] Executed / passed / failed / skipped counts (with skip rationale)
- [ ] Completed traceability matrix
- [ ] Load test report
- [ ] Open defects list
- [ ] List of untested items and rationale

## 13. Approval

| Role | Full Name | Decision | Date |
|------|-----------|----------|------|
| QA lead | | | |
| PO | | | |
