---
title: "Knowledge Base: Multi-Agent Claude Code and Software Engineering Process"
description: "Internal documentation to (1) use Claude Code CLI with worktrees, workflows, prompts, and multiple agents; (2) understand the software engineering process from BRD to release deeply enough to approve agent-authored deliverables."
pubDatetime: 2026-11-16T18:00:00Z
featured: true
tags:
  - overview
  - knowledge-base
---
# Knowledge Base: Multi-Agent Claude Code and Software Engineering Process

Internal documentation to (1) use Claude Code CLI with worktrees, workflows, prompts, and multiple agents; (2) understand the software engineering process from BRD to release deeply enough to **approve** deliverables written by agents.

Reference version: Claude Code 2.1.329, dated 2026-11-20. Commands and flags may change — verify with `claude --help`.

## Structure

```
knowledge/
├── README.md                          ← you are here
├── 01-claude-cli-multi-agent/         Part 1: tooling
│   ├── 01-cli-co-ban.md               commands, flags, permission modes, sessions
│   ├── 02-worktree.md                 git worktree, claude -w, parallel execution
│   ├── 03-subagent.md                 subagents, custom agents, background sessions
│   ├── 04-workflow.md                 multi-agent orchestration workflows
│   ├── 05-prompt.md                   writing prompts and delegation briefs
│   └── 06-mo-hinh-phoi-hop.md         coordination models + quick command reference
├── 02-quy-trinh-phan-mem/             Part 2: BRD → release process
│   ├── 00-tong-quan.md                lifecycle, gates G0–G8, traceability, RACI
│   ├── 01-brd.md
│   ├── 02-yeu-cau-srs-prd.md
│   ├── 03-thiet-ke.md
│   ├── 04-lap-ke-hoach.md
│   ├── 05-phat-trien.md
│   ├── 06-code-review.md
│   ├── 07-kiem-thu.md
│   ├── 08-release.md
│   ├── 09-checklist-phe-duyet.md      ★ most important for reviewers/approvers
│   └── 10-thuat-ngu.md
├── 03-ap-dung-voi-agent/
│   └── README.md                      what agents do at each stage, what you approve
├── 04-mau/                            document templates for agents to fill in
│   ├── brd-template.md
│   ├── srs-template.md
│   ├── adr-template.md
│   ├── test-plan-template.md
│   ├── release-checklist-template.md
│   └── approval-record-template.md    approval record for a single gate
├── 05-backend-senior/                 Part 5: senior backend engineering (see 00-README.md)
│   ├── 01–04  authentication, session/token, authorization, account module
│   ├── 05–06  posts + moderation module, quiz + grading module
│   ├── 07–08  database design, API design
│   ├── 09–12  million-user scale, Kafka/messaging, security, observability
│   └── 13     ★ checklist for reviewing agent-written backend code
├── 06-database-chuyen-sau/            Part 6: DBA-level databases (PostgreSQL, Redis, DB selection)
├── 07-he-thong-server/                Part 7: Linux, networking, LB, Docker, Kubernetes, CI/CD, incidents
├── 08-aws-cloud/                      Part 8: AWS deep dive (IAM, VPC, compute, storage, security, FinOps)
└── 09-rag-agent-code-intelligence/    Part 9: RAG, codebase-aware agents (Tree-sitter, graphs, A2A/MCP, governance)
```

Each part includes a `00-README.md` (table of contents) and a review checklist file at the end.

## Reading Paths

| Goal | Read |
|---|---|
| Getting started with Claude CLI | 01-cli-co-ban → 05-prompt |
| Running parallel tasks | 02-worktree → 03-subagent → 06-mo-hinh-phoi-hop |
| Large-scale orchestration | 04-workflow |
| Understanding the process to approve deliverables | 02/00-tong-quan → 01 … 08 → **09-checklist-phe-duyet** |
| Delegating tasks to agents by SDLC stage | 03-ap-dung-voi-agent/README |
| Templates for agents to fill out | 04-mau/ |
| Senior backend engineering | 05-backend-senior/00-README → 13-checklist-review-backend |
| Database deep dive | 06-database-chuyen-sau/00-README → 12-checklist-review-database |
| Servers and infrastructure | 07-he-thong-server/00-README → 09-checklist-review-ha-tang |
| AWS Cloud | 08-aws-cloud/00-README → 13-checklist-review-aws |
| Building RAG / code-intelligence agents | 09-rag-agent-code-intelligence/00-README → 11-checklist-review-he-thong-agent |

## Running Example

The Part 2 documents share a single running example: **an internal leave request management system**, illustrating how a requirement flows from BRD → FR → design → testing → release.
