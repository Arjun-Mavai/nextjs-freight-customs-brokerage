import { describe, it, expect, beforeEach } from 'vitest';
import { DemurrageCalculationEngine } from '../src/lib/detention/demurrage-engine';
import { ManifestIdempotencyGuard } from '../src/lib/idempotency/manifest-guard';
import { BondedWarehouseLedgerJournal } from '../src/lib/store/ledger-journal';

describe('DemurrageCalculationEngine, IdempotencyGuard & LedgerJournal', () => {
  let demurrageEngine: DemurrageCalculationEngine;
  let idempotencyGuard: ManifestIdempotencyGuard;
  let ledgerJournal: BondedWarehouseLedgerJournal;

  beforeEach(() => {
    demurrageEngine = new DemurrageCalculationEngine();
    idempotencyGuard = new ManifestIdempotencyGuard();
    ledgerJournal = new BondedWarehouseLedgerJournal();
  });

  it('grants free days, excludes free-time weekends, and charges tiered demurrage', () => {
    // 2025-02-03 is Monday. 10 calendar days stay through 2025-02-12 (Wednesday).
    const assessment = demurrageEngine.calculateContainerDemurrage({
      containerNumber: 'MSCU1234567',
      manifestId: 'MNF-DEM-3001',
      brokerId: 'mock_broker_atlas_01',
      portCode: 'USLAX',
      equipmentType: 'DRY_40FT_HIGH_CUBE',
      vesselDischargedAtIso: '2025-02-03T08:00:00.000Z',
      gateOutCompletedAtIso: '2025-02-12T17:00:00.000Z',
      settlementCurrency: 'USD',
      customsHoldDaysCount: 0,
      promotionalWaiverCents: 10_000,
    });

    expect(assessment.totalCalendarDaysInPort).toBe(10);
    expect(assessment.grantedFreeDays).toBe(4);
    expect(assessment.chargeableDemurrageDays).toBe(6);
    // 5 days in Tier 1 (5 * 22,000 = 110,000) + 1 day in Tier 2 (31,000) = 141,000 cents
    expect(assessment.grossDemurrageUsdCents).toBe(141_000);
    expect(assessment.netPayableDemurrageUsdCents).toBe(131_000);
  });

  it('verifies HMAC signatures and detects payload digest mismatches on idempotent replay', () => {
    const rawBody = JSON.stringify({ manifestId: 'MNF-99', amount: 5000 });
    const secret = 'YOUR_API_KEY_HERE_DEMO_ATLAS_01';
    const nowMs = 1_740_000_000_000;

    const header = idempotencyGuard.signPayloadHeader(rawBody, secret, nowMs);
    const verify = idempotencyGuard.verifyHmacSignature({
      rawBody,
      signatureHeader: header,
      webhookSigningToken: secret,
      currentTimestampMs: nowMs + 15_000,
    });

    expect(verify.valid).toBe(true);

    const firstLock = idempotencyGuard.evaluateAndLock({
      brokerId: 'mock_broker_atlas_01',
      idempotencyKey: 'idem_key_00001',
      operationPath: '/api/brokers/mock_broker_atlas_01/manifests',
      payload: { manifestId: 'MNF-99', amount: 5000 },
      nowMs,
    });
    expect(firstLock.decision).toBe('PROCEED_NEW_EXECUTION');

    const mismatchAttempt = idempotencyGuard.evaluateAndLock({
      brokerId: 'mock_broker_atlas_01',
      idempotencyKey: 'idem_key_00001',
      operationPath: '/api/brokers/mock_broker_atlas_01/manifests',
      payload: { manifestId: 'MNF-99', amount: 9999 },
      nowMs: nowMs + 1000,
    });
    expect(mismatchAttempt.decision).toBe(
      'REJECT_PAYLOAD_FINGERPRINT_MISMATCH'
    );
  });

  it('tracks ledger balances and resolves full dispute claims accurately', () => {
    ledgerJournal.recordManifestClearanceEntries({
      brokerId: 'mock_broker_atlas_01',
      manifestId: 'MNF-LED-4001',
      currency: 'USD',
      immediateCashDutyCents: 500_000,
      deferredBondedDutyCents: 0,
      demurrageCents: 200_000,
      containerNumber: 'MSCU1234567',
      timestampIso: '2025-03-05T10:00:00.000Z',
    });

    expect(
      ledgerJournal.getBrokerRunningBalanceCents('mock_broker_atlas_01')
    ).toBe(700_000);

    ledgerJournal.openDisputeClaim({
      disputeId: 'DSP-2025-001',
      brokerId: 'mock_broker_atlas_01',
      manifestId: 'MNF-LED-4001',
      containerNumber: 'MSCU1234567',
      category: 'PORT_CRANE_OUTAGE_EXEMPTION',
      currency: 'USD',
      originalAssessedCents: 200_000,
      claimedReductionCents: 50_000,
      reasonNarrative: 'Terminal crane outage prevented scheduled drayage pickup',
      openedAtIso: '2025-03-06T12:00:00.000Z',
    });

    const resolved = ledgerJournal.resolveDisputeClaim({
      disputeId: 'DSP-2025-001',
      brokerId: 'mock_broker_atlas_01',
      approvedReductionCents: 50_000,
      resolutionNotes: 'Verified port operator crane outage log',
      resolvedAtIso: '2025-03-07T15:00:00.000Z',
    });

    expect(resolved.dispute.status).toBe('APPROVED_FULL_CREDIT');
    expect(
      ledgerJournal.getBrokerRunningBalanceCents('mock_broker_atlas_01')
    ).toBe(650_000);
  });
});