import {analyzeSeries} from '../series.js';

const trendStates = {
  consistent: 'supported-trend', mixed: 'mixed-evidence',
  'not-detected': 'not-detected', insufficient: 'insufficient'
};

export function seriesFinding(series) {
  const {annual, coverage, trend, robust, verdict} = analyzeSeries(series);
  const {provenance, geo, variable, support} = series;
  const isPower = provenance.kind === 'nasa-power';
  const findingStatus = trendStates[verdict.level];
  return {
    question: 'trend', id: series.id, location: series.label, variable: variable.code,
    value: trend?.slopePerDecade ?? null, direction: Math.sign(trend?.slopePerDecade ?? 0),
    unit: variable.unit,
    period: {
      start: coverage.expectedFirstYear ?? coverage.firstYear,
      end: coverage.expectedLastYear ?? coverage.lastYear,
      fittedStart: annual[0]?.year ?? null, fittedEnd: annual.at(-1)?.year ?? null
    },
    spatialSupport: support, coordinates: geo, coverage,
    sourceMode: provenance.sourceMode ?? (provenance.authenticated === false ? 'user-imported' : 'unknown'),
    sourceName: provenance.source, retrievedAt: provenance.retrievedAt ?? null,
    capturedAt: provenance.capturedAt ?? null,
    findingStatus, meaning: findingStatus,
    evidenceStrength: {
      classicalP: trend?.pValue ?? null, rankP: robust?.pValue ?? null,
      rankDirection: Math.sign(robust?.senSlopePerDecade ?? 0),
      confidenceInterval: trend ? [trend.ciLowPerDecade, trend.ciHighPerDecade] : null,
      serialDependenceFlag: Boolean(verdict.dependenceFlag)
    },
    nonClaims: isPower ? ['grid-only', 'no-causation', 'no-forecast'] : ['no-causation', 'no-forecast'],
    nextVerification: isPower ? 'independent-observations' : 'source-metadata',
    sourceRefs: [provenance.url, provenance.archive?.run].filter(Boolean),
    expertEvidenceLink: provenance.sourceMode === 'snapshot' ? '#verify' : '#verify-investigation'
  };
}

export function comparisonFinding(comparison, reference, other, {postSelected = false} = {}) {
  const {paired, contrast} = comparison;
  const hac = contrast?.hac;
  const interval = hac ? [hac.ciLowPerDecade, hac.ciHighPerDecade] : null;
  let findingStatus = 'difference-supported';
  if (!paired) findingStatus = 'incompatible';
  else if (!contrast) findingStatus = 'insufficient';
  else if (postSelected) findingStatus = 'exploratory-selected';
  else if (!interval) findingStatus = 'unavailable-inference';
  else if (interval[0] <= 0 && interval[1] >= 0) findingStatus = 'difference-not-established';
  const value = contrast?.classical.slopePerDecade ?? null;
  const provenance = [reference.provenance, other.provenance];
  return {
    question: 'paired-difference', referenceId: reference.id, otherId: other.id,
    findingStatus, meaning: findingStatus, value, direction: Math.sign(value ?? 0),
    unit: paired ? reference.variable.unit : null,
    period: contrast ? {start: contrast.years[0], end: contrast.years.at(-1)} : null,
    spatialSupport: [reference.support, other.support],
    sourceMode: provenance.map(p => p.sourceMode ?? (p.authenticated === false ? 'user-imported' : 'unknown')),
    evidenceStrength: {confidenceInterval: interval, p: hac?.pValue ?? null, sharedYears: contrast?.n ?? null},
    nonClaims: ['no-equality', 'no-causation', 'no-forecast'],
    nextVerification: 'independent-observations',
    sourceRefs: provenance.map(p => p.url).filter(Boolean),
    retrievedAt: provenance.map(p => p.retrievedAt ?? null),
    capturedAt: provenance.map(p => p.capturedAt ?? null),
    expertEvidenceLink: provenance.every(p => p.sourceMode === 'snapshot') ? '#verify' : '#verify-investigation', reasons: comparison.reasons
  };
}

export function evidenceState({state, dirty = false, finding = null}) {
  if (state === 'error') return 'request-failed';
  if (dirty || state === 'idle') return 'stale-query';
  if (!finding) return state === 'loading' ? 'loading' : 'unavailable-inference';
  return finding.sourceMode === 'snapshot' ? 'dated-snapshot' : finding.findingStatus;
}
