import { describe, it, expect, beforeEach } from 'vitest';
import { BrokerTenantRegistry } from '@/lib/tenants/broker-registry';

describe('BrokerTenantRegistry', () => {
  let registry: BrokerTenantRegistry;

  beforeEach(() => {
    registry = new BrokerTenantRegistry();
  });

  it('loads default synthetic brokers with isolated state clones', () => {
    const atlas = registry.getBroker('mock_broker_atlas_01');
    expect(atlas).toBeDefined();
    expect(atlas?.status).toBe('ACTIVE');
    expect(atlas?.settlementCurrency).toBe('USD');
  });

  it('approves credit and surety bond reservation for an eligible active broker', () => {
    const result = registry.reserveCreditForManifest({
      brokerId: 'mock_broker_atlas_01',
      manifestId: 'MNF-TEST-1001',
      dutyAmountCents: 2_000_000,
      estimatedDemurrageCents: 300_000,
      corridor: 'CN_US_TRANSPACIFIC',
      operationType: 'STANDARD_IMPORT_ENTRY',
      requestedAtIso: '2025-03-10T12:00:00.000Z',
    });

    expect(result.approved).toBe(true);
    expect(result.appliedCollateralRatio).toBe(1.0);

    const updated = registry.getBroker('mock_broker_atlas_01');
    expect(updated?.currentUtilizedCreditCents).toBe(14_500_000);
    expect(updated?.unsettledDemurrageCents).toBe(750_000);
  });

  it('rejects manifest clearance when corridor is unauthorized for the broker', () => {
    const result = registry.reserveCreditForManifest({
      brokerId: 'mock_broker_meridian_02',
      manifestId: 'MNF-TEST-1002',
      dutyAmountCents: 100_000,
      estimatedDemurrageCents: 0,
      corridor: 'CN_US_TRANSPACIFIC',
      operationType: 'STANDARD_IMPORT_ENTRY',
      requestedAtIso: '2025-03-10T12:00:00.000Z',
    });

    expect(result.approved).toBe(false);
    expect(result.rejectionCode).toBe('CORRIDOR_UNAUTHORIZED');
  });

  it('blocks new import declarations when broker is on CREDIT_HOLD', () => {
    const result = registry.reserveCreditForManifest({
      brokerId: 'mock_broker_vanguard_04',
      manifestId: 'MNF-TEST-1003',
      dutyAmountCents: 50_000,
      estimatedDemurrageCents: 0,
      corridor: 'CN_US_TRANSPACIFIC',
      operationType: 'STANDARD_IMPORT_ENTRY',
      requestedAtIso: '2025-03-10T12:00:00.000Z',
    });

    expect(result.approved).toBe(false);
    expect(result.rejectionCode).toBe('STATUS_PROHIBITED');
  });

  it('records audit events when transitioning broker account status', () => {
    const updated = registry.transitionBrokerStatus({
      brokerId: 'mock_broker_atlas_01',
      targetStatus: 'RESTRICTED_AUDIT',
      actorId: 'compliance_officer_01',
      reason: 'Scheduled quarterly customs bond verification',
      timestampIso: '2025-03-12T09:00:00.000Z',
    });

    expect(updated.status).toBe('RESTRICTED_AUDIT');
    const trail = registry.getAuditTrail('mock_broker_atlas_01');
    expect(trail).toHaveLength(1);
    expect(trail[0].previousStatus).toBe('ACTIVE');
    expect(trail[0].nextStatus).toBe('RESTRICTED_AUDIT');
  });
});