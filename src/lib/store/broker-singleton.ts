import { BrokerTenantRegistry } from '../tenants/broker-registry';
import { CustomsDutyCalculator } from '../tariffs/duty-calculator';
import { DemurrageCalculationEngine } from '../detention/demurrage-engine';
import { ManifestIdempotencyGuard } from '../idempotency/manifest-guard';
import { BondedWarehouseLedgerJournal } from './ledger-journal';

export interface FreightBrokerageRuntimeContainer {
  brokerRegistry: BrokerTenantRegistry;
  dutyCalculator: CustomsDutyCalculator;
  demurrageEngine: DemurrageCalculationEngine;
  idempotencyGuard: ManifestIdempotencyGuard;
  ledgerJournal: BondedWarehouseLedgerJournal;
  bootstrappedAtIso: string;
}

const globalForBrokerage = globalThis as unknown as {
  __freightBrokerageContainer?: FreightBrokerageRuntimeContainer;
};

export function createFreshBrokerageContainer(): FreightBrokerageRuntimeContainer {
  const brokerRegistry = new BrokerTenantRegistry();
  const dutyCalculator = new CustomsDutyCalculator();
  const demurrageEngine = new DemurrageCalculationEngine();
  const idempotencyGuard = new ManifestIdempotencyGuard();
  const ledgerJournal = new BondedWarehouseLedgerJournal();

  // Seed initial baseline ledger postings so the dashboard and queries have realistic state
  ledgerJournal.recordManifestClearanceEntries({
    brokerId: 'mock_broker_atlas_01',
    manifestId: 'MNF-SYNTH-2025-0001',
    currency: 'USD',
    immediateCashDutyCents: 1_250_000,
    deferredBondedDutyCents: 0,
    demurrageCents: 450_000,
    containerNumber: 'MSCU1234567',
    timestampIso: '2025-01-15T10:00:00.000Z',
  });

  ledgerJournal.recordManifestClearanceEntries({
    brokerId: 'mock_broker_meridian_02',
    manifestId: 'MNF-SYNTH-2025-0002',
    currency: 'EUR',
    immediateCashDutyCents: 840_000,
    deferredBondedDutyCents: 540_000,
    demurrageCents: 900_000,
    containerNumber: 'MAEU7654321',
    timestampIso: '2025-01-18T09:15:00.000Z',
  });

  return {
    brokerRegistry,
    dutyCalculator,
    demurrageEngine,
    idempotencyGuard,
    ledgerJournal,
    bootstrappedAtIso: '2025-02-01T00:00:00.000Z',
  };
}

export function getBrokerageContainer(): FreightBrokerageRuntimeContainer {
  if (!globalForBrokerage.__freightBrokerageContainer) {
    globalForBrokerage.__freightBrokerageContainer =
      createFreshBrokerageContainer();
  }
  return globalForBrokerage.__freightBrokerageContainer;
}

export function resetBrokerageContainerForTests(): FreightBrokerageRuntimeContainer {
  globalForBrokerage.__freightBrokerageContainer =
    createFreshBrokerageContainer();
  return globalForBrokerage.__freightBrokerageContainer;
}