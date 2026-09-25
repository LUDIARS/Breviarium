// @implements SPEC-br-grading
import type {
  DiPaperFact,
  FileFact,
  OmnipotensSummaryFact,
  PlanDocFact,
  RepoArtifactsEvidence,
  RunPlanFact,
  VitiaAuditFact,
} from '../domain/evidence.ts';
import { DI_PAPER_NUMBER } from '../domain/plan-status.ts';
import { asArray, asRecord, num, parseJson, str, strList } from './json-shape.ts';
import { countItemsUnderHeadings, parseFrontMatter } from './markdown-facts.ts';

/** A repository file as read by the adapter. `text` is present only for files whose content is needed. */
export interface RepoFileRaw {
  readonly path: string;
  readonly modifiedAt: string;
  readonly text?: string;
}

export interface RepoArtifactsRaw {
  readonly readme: RepoFileRaw | null;
  readonly productSpec: RepoFileRaw | null;
  readonly featureSpecCount: number;
  /** `spec/plan/NN-*.md` files (03〜26) with their text. */
  readonly plans: readonly RepoFileRaw[];
  readonly summary: RepoFileRaw | null;
  readonly runPlan: RepoFileRaw | null;
  readonly audit: RepoFileRaw | null;
  readonly finalReport: RepoFileRaw | null;
}

export const QUESTION_HEADINGS = /debate questions|questions|論点|問い|gap|ギャップ/i;
export const POSITION_HEADINGS = /positions to test|positions|仮説|hypothes/i;

const PLAN_FILE = /(?:^|\/)(\d{2})-[^/]*\.md$/;

export function planNumber(path: string): number | null {
  const m = PLAN_FILE.exec(path);
  return m ? Number(m[1]) : null;
}

function fact(file: RepoFileRaw): FileFact {
  return { path: file.path, modifiedAt: file.modifiedAt };
}

function planOf(file: RepoFileRaw, number: number): PlanDocFact {
  const status = parseFrontMatter(file.text ?? '')['status'];
  return { ...fact(file), number, status: status ? status.toLowerCase() : null };
}

function diPaperOf(file: RepoFileRaw): DiPaperFact {
  const text = file.text ?? '';
  const fm = parseFrontMatter(text);
  return {
    ...fact(file),
    status: fm['status'] ? fm['status'].toLowerCase() : null,
    updated: fm['updated'] ?? null,
    questionCount: countItemsUnderHeadings(text, QUESTION_HEADINGS),
    positionCount: countItemsUnderHeadings(text, POSITION_HEADINGS),
  };
}

function summaryOf(file: RepoFileRaw): OmnipotensSummaryFact {
  const doc = asRecord(parseJson(file.text ?? ''));
  const overallRecord = asRecord(doc?.['overallAssessment']);
  const score = num(overallRecord?.['score']);
  const maxScore = num(overallRecord?.['maxScore']);
  const vitiaRatios = asArray(doc?.['vitiaScores'])
    .map(asRecord)
    .map((row) => ({ s: num(row?.['score']), m: num(row?.['maxScore']) }))
    .filter((r): r is { s: number; m: number } => r.s !== null && r.m !== null && r.m > 0)
    .map((r) => Math.min(1, Math.max(0, r.s / r.m)));
  return {
    ...fact(file),
    overall: score !== null && maxScore !== null && maxScore > 0 ? { label: str(overallRecord?.['label']), score, maxScore } : null,
    vitiaRatios,
  };
}

function runPlanOf(file: RepoFileRaw): RunPlanFact {
  const doc = asRecord(parseJson(file.text ?? ''));
  return { ...fact(file), resolved: strList(doc?.['resolvedAnalysisIds']), notRequested: strList(doc?.['notRequestedAnalysisIds']) };
}

function auditOf(file: RepoFileRaw): VitiaAuditFact {
  const doc = asRecord(parseJson(file.text ?? ''));
  const lenses = asArray(doc?.['lenses'])
    .map(asRecord)
    .filter((l) => l !== null)
    .map((l) => ({ lens: str(l['lens']) ?? '?', status: str(l['status']) ?? 'unknown', score: num(l['score']) }));
  return { ...fact(file), status: str(doc?.['status']) ?? (doc ? 'unknown' : 'unreadable'), lenses, blockedBy: strList(doc?.['blocked_by']) };
}

/** Normalises the repository's Omnipotens / Vitia / Discutere / foundation artefacts (existence, mtime, a few fields). */
export function extractRepoArtifactsEvidence(raw: RepoArtifactsRaw): RepoArtifactsEvidence {
  const plans: PlanDocFact[] = [];
  let diPaper: DiPaperFact | null = null;
  for (const file of raw.plans) {
    const number = planNumber(file.path);
    if (number === null) continue;
    if (number === DI_PAPER_NUMBER) diPaper = diPaperOf(file);
    else if (number >= 3 && number <= 26) plans.push(planOf(file, number));
  }
  plans.sort((a, b) => a.number - b.number || a.path.localeCompare(b.path));
  return {
    foundation: {
      readme: raw.readme ? fact(raw.readme) : null,
      productSpec: raw.productSpec ? fact(raw.productSpec) : null,
      featureSpecCount: raw.featureSpecCount,
    },
    plans,
    omnipotens: {
      summary: raw.summary ? summaryOf(raw.summary) : null,
      runPlan: raw.runPlan ? runPlanOf(raw.runPlan) : null,
      finalReport: raw.finalReport ? fact(raw.finalReport) : null,
    },
    vitiaAudit: raw.audit ? auditOf(raw.audit) : null,
    diPaper,
  };
}
