import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isImplementationFile, membershipCoverage } from '../../src/inspections/domain/membership-coverage.ts';

const domain = (...pathPatterns: string[]) => ({ pathPatterns });

describe('membership coverage (anatomia/domain-coverage)', () => {
  it('counts the implementation files a declared pathPattern matches, and those it does not', () => {
    const files = ['src/inspections/grading.ts', 'src/adapters/http/router.ts', 'server/app.py', 'modules/core/lib.rs', 'README.md', 'package.json'];
    const coverage = membershipCoverage(files, [domain('(^|/)src/inspections/(?:.*/)?[^/]+$'), domain('(^|/)src/adapters/')]);
    assert.deepEqual(coverage, { domains: 2, pathPatterns: 2, invalidPatterns: 0, implementationFiles: 4, matchedFiles: 2 });
  });

  it('keeps tests, documents and other extensions out of the denominator', () => {
    const excluded = [
      'tests/inspections/grading.test.ts',
      'test/unit.js',
      'src/__tests__/a.tsx',
      'Assets/Tests/PlayerTests.cs',
      'Game.Tests/Movement.cs',
      'e2e/login.ts',
      'spec/feature/grading.md',
      'spec/tools/generate.ts',
      'docs/example.py',
      'src/router.test.ts',
      'src/router.spec.tsx',
      'pkg/server_test.go',
      'tools/test_build.py',
      'src/styles.css',
      'src/data.json',
      'Makefile',
    ];
    for (const file of excluded) assert.equal(isImplementationFile(file), false, file);
    const counted = ['src/a.ts', 'src/b.tsx', 'bin/c.mjs', 'lib/d.cjs', 'e.js', 'f.py', 'Assets/Scripts/G.cs', 'h.cpp', 'h.h', 'h.hpp', 'i.rs', 'j.go', 'src/types.d.ts', 'src/Main.CPP', 'src/contest.ts'];
    for (const file of counted) assert.equal(isImplementationFile(file), true, file);
    const coverage = membershipCoverage([...excluded, 'src/a.ts'], [domain('.*')]);
    assert.deepEqual({ files: coverage.implementationFiles, matched: coverage.matchedFiles }, { files: 1, matched: 1 });
  });

  it('matches like Anatomia: a JS regular expression without flags over the `/` path', () => {
    const coverage = membershipCoverage(['src\\a\\x.ts', 'src/a/x.ts', 'src/A/y.ts', 'lib/src/a/z.ts'], [domain('src/a/')]);
    assert.deepEqual({ files: coverage.implementationFiles, matched: coverage.matchedFiles }, { files: 3, matched: 2 });
  });

  it('counts an invalid regular expression without using it, and matches nothing when no pattern compiles', () => {
    const mixed = membershipCoverage(['src/a.ts', 'lib/b.ts'], [domain('(^|/)src/', '([unclosed'), domain('*bad')]);
    assert.deepEqual(mixed, { domains: 2, pathPatterns: 1, invalidPatterns: 2, implementationFiles: 2, matchedFiles: 1 });
    const broken = membershipCoverage(['src/a.ts'], [domain('([unclosed')]);
    assert.deepEqual({ patterns: broken.pathPatterns, invalid: broken.invalidPatterns, matched: broken.matchedFiles }, { patterns: 0, invalid: 1, matched: 0 });
  });

  it('with no declaration there is nothing to match (the inspection shows `—`)', () => {
    assert.deepEqual(membershipCoverage(['src/a.ts'], []), { domains: 0, pathPatterns: 0, invalidPatterns: 0, implementationFiles: 1, matchedFiles: 0 });
    assert.deepEqual(membershipCoverage([], [domain('src/')]), { domains: 1, pathPatterns: 1, invalidPatterns: 0, implementationFiles: 0, matchedFiles: 0 });
  });
});
