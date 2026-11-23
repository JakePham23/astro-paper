---
title: "SRS — <System Name>"
description: "- Document purpose: <...>"
pubDatetime: 2026-11-19T11:00:00Z
featured: false
tags:
  - template
  - documentation
---
# SRS — <System Name>

> **Guide:** Replace all `<...>` placeholders. Every FR/NFR must have an ID and trace back to a BR. Every NFR must include a measurable number and verification method.
> Detailed guide: [../02-quy-trinh-phan-mem/02-yeu-cau-srs-prd.md](../02-quy-trinh-phan-mem/02-yeu-cau-srs-prd.md)

| Field | Value |
|-------|-------|
| Document ID | SRS-<code> |
| Version | <0.1> |
| Referenced BRD | BRD-<code> version <x.y> |
| Status | Draft / Pending Approval / Approved |
| Author | <name> (agent-assisted: <yes/no>) |

## 1. Introduction
- Document purpose: <...>
- System scope (summary from BRD): <...>
- Intended audience: <...>

## 2. Overview
- Users and roles: <...>
- Operating environment: <...>
- Design/technology constraints: <...>
- Assumptions and dependencies: <...>

## 3. Functional Requirements

| ID | Requirement ("The system shall …") | BR Trace | Priority | Notes |
|----|------------------------------------|----------|----------|-------|
| FR-01 | <...> | BR-01 | Must | <...> |

### 3.1 State Model
> Mandatory for stateful entities. Also list state transitions that are **not** allowed.

```mermaid
stateDiagram-v2
    [*] --> <STATE_1>
    <STATE_1> --> <STATE_2>: <event>
```

### 3.2 Business Rules

| ID | Rule | Confirmed by (person, date) |
|----|------|-----------------------------|
| RULE-01 | <...> | <...> |

## 4. Non-Functional Requirements

| ID | Category | Requirement (quantified) | Verification Method | Trace |
|----|----------|--------------------------|---------------------|-------|
| NFR-01 | Performance | <...> | <...> | BR-xx |
| NFR-02 | Security | <...> | <...> | |
| NFR-03 | Availability | <...> | <...> | |
| NFR-04 | Recovery (RPO/RTO) | <...> | <...> | |
| NFR-05 | Maintainability | <...> | <...> | |
| NFR-06 | Compliance / personal data | <...> | <...> | |

## 5. User Stories and Acceptance Criteria

### US-01 — <title>
**As a** <role>, **I want** <action>, **so that** <value>. *(FR-xx, BR-xx)*

- **AC-01.1** (happy path) — *Given* <...>, *When* <...>, *Then* <...>.
- **AC-01.2** (invalid input) — *Given* <...>, *When* <...>, *Then* <...>.
- **AC-01.3** (unauthorized) — *Given* <...>, *When* <...>, *Then* <...>.
- **AC-01.4** (boundary / concurrency) — *Given* <...>, *When* <...>, *Then* <...>.

## 6. External Interfaces
- User interface: <...>
- External system interfaces: <...>

## 7. Data
- Core entities and sensitive data: <...>
- Retention period: <...>

## 8. Prioritization (MoSCoW)

| Must | Should | Could | Won't (this release) |
|------|--------|-------|----------------------|
| <...> | <...> | <...> | <...> |

## 9. Traceability Matrix

| BR | FR/NFR | Story/AC | Design | Test Case |
|----|--------|----------|--------|-----------|
| BR-01 | FR-01 | US-01 | *(fill at G3)* | *(fill at G6)* |

## 10. Open Questions and Author-Inferred Assumptions
- [ ] <...>

## 11. Approval and Version History

| Role | Full Name | Decision | Date |
|------|-----------|----------|------|
| PO | <...> | | |

| Version | Date | Editor | Changes |
|---------|------|--------|---------|
| 0.1 | <...> | <...> | Initial draft |
