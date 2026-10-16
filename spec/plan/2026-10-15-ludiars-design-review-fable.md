---
title: LUDIARS 9-tool design review — Breviarium
type: plan
status: proposed
updated: 2026-10-17
---

# Breviarium: preserve evidence meaning while reducing collection cost

## Ownership and verified findings

Br owns derived project summaries and refresh snapshots, not source work status,
requirements, architectural decisions or review authorization. Actio owns tasks;
Pf owns specifications; An owns code analysis; Rv owns reviews/merge; Cc coordinates;
Augur owns test planning/evidence; Genius supplies judgment; Cf owns game adoption.
Values BR-UX-1..5 in spec/ux/product.md require useful, honest evidence summaries.
Snapshot dataFetchedAt must continue to describe the last successful data; a failed
attempt updates attemptedAt/error without turning old data into fresh success.

Reviewed main eff7060: src/adapters/config/load-config.ts,
src/adapters/sources/revisor-source.ts, src/inspections/domain/merged-prs.ts,
tests/adapters/http-app.test.ts, tests/shared/contracts.test.ts, spec/ux/product.md.

The handoff's Revisor bottleneck is in the source adapter, not the pure merged-PR
selection policy. It performs repo list, PR list, up to five PR shows, and version
show serially. A CLI attempt has a 60-second timeout; that is an upper bound per
call, not a measured refresh duration. The serialization explicitly protects
Revisor's database, so parallelizing those calls without an owner contract is unsafe.

The positive configuration tests passed Windows drive paths to node:path.isAbsolute.
Those strings are relative on POSIX. Implemented platform-native temporary fixture
paths in the existing configuration and HTTP tests, preserving strict absolute-path
validation and the health-response path-leak rejection. No files or CLI processes
are created by constructing these paths. Runtime behavior and access policy stay intact.

## Ordered proposals and acceptance

1. Rv should provide one bounded, versioned summary projection for a repository,
   including registration, selected merged-PR evidence and version. Br consumes it
   through its existing adapter boundary. Acceptance: fewer CLI/database openings,
   equivalent risk/An-gate semantics, explicit partial failure, unchanged last-good data.
2. An should expose declared membership coverage separately from inferred domains.
   Acceptance: unclassified anchors remain visible and coverage has a denominator;
   unavailable analysis does not become a clean architecture result.
3. Pf/Augur evidence should retain executed/skipped/uncovered distinctions and source
   revision. Actio state remains a reference rather than a second editable task store.
4. Keep public Br projections separate from private Genius cards and task bodies.
   Share an access-verification contract only after checking Br's dependency-free
   runtime constraint; do not silently add authentication dependencies.

## Validation and recovery

Source inspection and git diff --check performed. Existing behavioral tests were
updated in the same change; session test execution and service startup were not
authorized and were not run. Review execution belongs to Revisor. No performance
measurement or human UX acceptance is claimed. Revert the two fixture changes and
this proposal to recover; no state migration or restart is required.
