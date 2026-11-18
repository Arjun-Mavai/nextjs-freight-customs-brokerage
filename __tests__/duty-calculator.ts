import { describe, it, expect } from 'vitest';
import { CustomsDutyCalculator } from '../src/lib/tariffs/duty-calculator';

describe('CustomsDutyCalculator', () => {
  const calculator = new CustomsDutyCalculator();

  it('calculates ad-valorem, specific weight duty, MPF, and HMF for standard import entry', () => {
    const result = calculator.assessManifestDuties({
      manifestId: 'MNF-DUTY-2001',
      brokerId: 'mock_broker_atlas_01',
      corridor: 'CN_US_TRANSPACIFIC',
      settlementCurrency: 'USD',
      entryDateIso: '2025-03-01T10:00:00.000Z',
      portOfEntryCode: 'USLAX',
      isBondedWarehouseEntry: false,
      lineItems: [
        {
          lineId: 'LINE-01',
          hsCode: '847150',
          description: 'Rack server chassis units',
          countryOfOriginIso2: 'CN',
          fobValueMinorUnits: 2_000_000, // $20,000.00
          oceanFreightMinorUnits: 150_000, // $1,500.00
          marineInsuranceMinorUnits: 50_000, // $500.00 -> Total CIF = $22,000.00 (2,200,000 cents)
          sourceCurrency: 'USD',
          netWeightKg: 250,
          grossWeightKg: 280,
          quantityUnits: 10,
          claimedAgreement: 'NONE',
          certificateOfOriginVerified: false,
        },
      ],
    });

    expect(result.totalCifValuationCents).toBe(2_200_000);
    // 4.00% of 2,200,000 = 88,000 cents + 250kg * 120 cents = 30,000 cents -> 118,000 cents
    expect(result.totalBaseDutyCents).toBe(118_000);
    expect(result.deferredBondedDutyCents).toBe(0);
    expect(result.immediateCashDutyCents).toBe(result.totalPayableDutyCents);
  });

  it('defers base duty when manifest is marked as a bonded warehouse entry', () => {
    const result = calculator.assessManifestDuties({
      manifestId: 'MNF-DUTY-2002',
      brokerId: 'mock_broker_atlas_01',
      corridor: 'CN_US_TRANSPACIFIC',
      settlementCurrency: 'USD',
      entryDateIso: '2025-03-02T10:00:00.000Z',
      portOfEntryCode: 'USLAX',
      isBondedWarehouseEntry: true,
      lineItems: [
        {
          lineId: 'LINE-01',
          hsCode: '720851',
          description: 'Flat-rolled steel plates',
          countryOfOriginIso2: 'CN',
          fobValueMinorUnits: 5_000_000,
          oceanFreightMinorUnits: 400_000,
          marineInsuranceMinorUnits: 100_000,
          sourceCurrency: 'USD',
          netWeightKg: 1000,
          grossWeightKg: 1050,
          quantityUnits: 50,
          claimedAgreement: 'NONE',
          certificateOfOriginVerified: false,
        },
      ],
    });

    expect(result.deferredBondedDutyCents).toBe(result.totalBaseDutyCents);
    expect(result.immediateCashDutyCents).toBe(
      result.totalAntiDumpingAndCvdCents + result.totalPortAndProcessingFeesCents
    );
  });

  it('converts foreign currency CIF values into broker settlement currency', () => {
    const conversion = calculator.convertCurrencyCents(100_000, 'EUR', 'USD');
    expect(conversion.convertedCents).toBe(108_000);
    expect(conversion.appliedRate).toBe(1.08);
  });
});