export const COMMODITYNODE_EDITORIAL_STATES = [
  'draft',
  'machine_extracted',
  'needs_sources',
  'needs_rights',
  'needs_editor',
  'needs_review',
  'approved',
  'published',
  'superseded',
  'corrected',
  'retracted',
] as const;

export type CommodityNodeEditorialState = (typeof COMMODITYNODE_EDITORIAL_STATES)[number];

export const COMMODITYNODE_REVIEW_ACTIONS = [
  'request_sources',
  'request_rights',
  'send_to_editor',
  'submit_for_review',
  'approve',
  'publish',
  'supersede',
  'correct',
  'retract',
] as const;

export type CommodityNodeReviewAction = (typeof COMMODITYNODE_REVIEW_ACTIONS)[number];

export interface CommodityNodeEditorialEvidence {
  id: string;
  url: string;
  publisher: string;
  kind: 'authoritative_primary' | 'company_primary' | 'independent_secondary';
  locator: string;
}

export interface CommodityNodeEditorialClaim {
  id: string;
  text: string;
  evidenceIds: readonly string[];
}

export interface CommodityNodeEditorialGraphCandidate {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  direction: 'positive' | 'negative' | 'mixed' | 'conditional';
  condition: string | null;
  invalidation: string | null;
  evidenceIds: readonly string[];
}

export interface CommodityNodeEditorialCandidate {
  id: string;
  title: string;
  state: CommodityNodeEditorialState;
  isFixture: boolean;
  materiality: 'minor' | 'notable' | 'material' | 'critical';
  occurredAt: string;
  location: {
    id: string;
    label: string;
    countryCode: string;
    latitude: number;
    longitude: number;
  } | null;
  entityIds: readonly string[];
  claims: readonly CommodityNodeEditorialClaim[];
  evidence: readonly CommodityNodeEditorialEvidence[];
  graphCandidates: readonly CommodityNodeEditorialGraphCandidate[];
  unknowns: readonly string[];
  rightsIssues: readonly string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface CommodityNodeEditorialAssessment {
  approvable: boolean;
  blockers: readonly string[];
  warnings: readonly string[];
  evidenceCoverage: {
    linkedClaims: number;
    totalClaims: number;
    sourceHosts: readonly string[];
    hasAuthoritativePrimary: boolean;
  };
}

export interface CommodityNodeEditorialDecision {
  candidateId: string;
  action: CommodityNodeReviewAction;
  fromState: CommodityNodeEditorialState;
  toState: CommodityNodeEditorialState;
  reviewer: string;
  note: string;
  decidedAt: string;
}

const TRANSITIONS: Readonly<
  Record<CommodityNodeEditorialState, Partial<Record<CommodityNodeReviewAction, CommodityNodeEditorialState>>>
> = {
  draft: { send_to_editor: 'needs_editor' },
  machine_extracted: {
    request_sources: 'needs_sources',
    request_rights: 'needs_rights',
    send_to_editor: 'needs_editor',
  },
  needs_sources: { send_to_editor: 'needs_editor' },
  needs_rights: { send_to_editor: 'needs_editor' },
  needs_editor: {
    request_sources: 'needs_sources',
    request_rights: 'needs_rights',
    submit_for_review: 'needs_review',
  },
  needs_review: {
    request_sources: 'needs_sources',
    request_rights: 'needs_rights',
    send_to_editor: 'needs_editor',
    approve: 'approved',
  },
  approved: { publish: 'published', send_to_editor: 'needs_editor' },
  published: { supersede: 'superseded', correct: 'corrected', retract: 'retracted' },
  superseded: {},
  corrected: { publish: 'published', retract: 'retracted' },
  retracted: {},
};

export function allowedCommodityNodeEditorialActions(
  state: CommodityNodeEditorialState,
): readonly CommodityNodeReviewAction[] {
  return Object.keys(TRANSITIONS[state]) as CommodityNodeReviewAction[];
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
}

export function assessCommodityNodeEditorialCandidate(
  candidate: CommodityNodeEditorialCandidate,
): CommodityNodeEditorialAssessment {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const evidenceIds = new Set(candidate.evidence.map((item) => item.id));
  const sourceHosts = [
    ...new Set(candidate.evidence.map((item) => new URL(item.url).hostname.toLowerCase())),
  ].sort();
  const hasAuthoritativePrimary = candidate.evidence.some(
    (item) => item.kind === 'authoritative_primary',
  );
  let linkedClaims = 0;

  if (candidate.isFixture) blockers.push('Fixture records cannot be approved or published.');
  if (!validDate(candidate.occurredAt)) blockers.push('An exact event date is required.');
  if (!candidate.location) {
    blockers.push('An exact reviewed location is required.');
  } else {
    if (!candidate.location.id.trim() || !candidate.location.label.trim()) {
      blockers.push('The location must have a stable id and reader-facing label.');
    }
    if (!/^[A-Z]{2}$/.test(candidate.location.countryCode)) {
      blockers.push('The location requires a two-letter country code.');
    }
    if (
      !Number.isFinite(candidate.location.latitude)
      || candidate.location.latitude < -90
      || candidate.location.latitude > 90
      || !Number.isFinite(candidate.location.longitude)
      || candidate.location.longitude < -180
      || candidate.location.longitude > 180
    ) {
      blockers.push('The reviewed coordinates are outside geographic bounds.');
    }
  }
  if (candidate.entityIds.length === 0) blockers.push('At least one resolved entity is required.');
  if (candidate.claims.length === 0) blockers.push('At least one reviewable claim is required.');
  if (candidate.evidence.length === 0) blockers.push('At least one exact evidence record is required.');
  if (candidate.unknowns.length === 0) blockers.push('Known unknowns must be recorded.');
  if (candidate.rightsIssues.length > 0) blockers.push('Open rights issues must be resolved.');

  for (const claim of candidate.claims) {
    if (claim.text.trim().length < 20) blockers.push(`Claim ${claim.id} is too short.`);
    if (claim.evidenceIds.length === 0) {
      blockers.push(`Claim ${claim.id} has no evidence.`);
      continue;
    }
    const unknownEvidence = claim.evidenceIds.filter((id) => !evidenceIds.has(id));
    if (unknownEvidence.length > 0) {
      blockers.push(`Claim ${claim.id} references unknown evidence: ${unknownEvidence.join(', ')}.`);
    } else {
      linkedClaims += 1;
    }
  }

  for (const item of candidate.evidence) {
    const url = new URL(item.url);
    if (url.protocol !== 'https:') blockers.push(`Evidence ${item.id} must use HTTPS.`);
    if (!item.locator.trim()) blockers.push(`Evidence ${item.id} needs an exact locator.`);
  }

  for (const edge of candidate.graphCandidates) {
    if (edge.sourceEntityId === edge.targetEntityId) {
      blockers.push(`Graph candidate ${edge.id} cannot be self-referential.`);
    }
    if (edge.evidenceIds.length === 0) {
      blockers.push(`Graph candidate ${edge.id} needs evidence.`);
    }
    if (edge.direction === 'conditional' && !edge.condition?.trim()) {
      blockers.push(`Conditional graph candidate ${edge.id} needs a condition.`);
    }
    if (!edge.invalidation?.trim()) {
      warnings.push(`Graph candidate ${edge.id} has no invalidation rule.`);
    }
  }

  if (
    (candidate.materiality === 'material' || candidate.materiality === 'critical')
    && !hasAuthoritativePrimary
    && sourceHosts.length < 2
  ) {
    blockers.push('Material events require authoritative primary evidence or source diversity.');
  }
  if (!candidate.reviewedBy || !candidate.reviewedAt) {
    warnings.push('A named reviewer and timestamp are required before final publication.');
  }

  return {
    approvable: blockers.length === 0,
    blockers,
    warnings,
    evidenceCoverage: {
      linkedClaims,
      totalClaims: candidate.claims.length,
      sourceHosts,
      hasAuthoritativePrimary,
    },
  };
}

export function transitionCommodityNodeEditorialCandidate(
  candidate: CommodityNodeEditorialCandidate,
  input: {
    action: CommodityNodeReviewAction;
    reviewer: string;
    note: string;
    decidedAt: string;
  },
): CommodityNodeEditorialDecision {
  const toState = TRANSITIONS[candidate.state][input.action];
  if (!toState) {
    throw new Error(
      `[commoditynode-editorial] ${input.action} is not allowed from ${candidate.state}`,
    );
  }
  if (input.reviewer.trim().length < 3) {
    throw new Error('[commoditynode-editorial] reviewer identity is required');
  }
  if (input.note.trim().length < 12) {
    throw new Error('[commoditynode-editorial] decision note must explain the review');
  }
  if (!Number.isFinite(Date.parse(input.decidedAt))) {
    throw new Error('[commoditynode-editorial] decision timestamp is invalid');
  }
  if (input.action === 'approve' || input.action === 'publish') {
    const assessment = assessCommodityNodeEditorialCandidate(candidate);
    if (!assessment.approvable) {
      throw new Error(
        `[commoditynode-editorial] publication gate failed: ${assessment.blockers.join(' ')}`,
      );
    }
  }

  return {
    candidateId: candidate.id,
    action: input.action,
    fromState: candidate.state,
    toState,
    reviewer: input.reviewer.trim(),
    note: input.note.trim(),
    decidedAt: input.decidedAt,
  };
}
