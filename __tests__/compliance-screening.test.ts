import { describe, it, expect } from 'vitest';
import { CustomsComplianceScreeningService } from '@/lib/compliance/sanctions-screening';

describe('CustomsComplianceScreeningService', () => {
  const screeningService = new CustomsComplianceScreeningService();

  it('clears a compliant manifest with white-list vessel and non-restricted cargo', () => {
    const result = screeningService.screenManifestCompliance({
      manifestId: 'MNF-CMP-5001',
      brokerId: 'mock_broker_atlas_01',
      corridor: 'US_EU_ATLANTIC',
      destinationCountryIso2: 'DE',
      parties: {
        shipperLegalName: 'PACIFIC COAST SYNTHETIC LOGISTICS',
        shipperCountryIso2: 'US',
        consigneeLegalName: 'HAMBURG INDUSTRIAL DISTRIBUTION',
        consigneeCountryIso2: 'DE',
      },
      vessel: {
        vesselImoNumber: 'IMO9123456',
        vesselName: 'MV NORTHERN HORIZON',
        flagStateIso2: 'SG',
        flagRiskTier: 'WHITE_LIST_FLAG',
        priorPortCallsIso5: ['USNYC', 'NLRTM', 'DEHAM'],
        aisDarkActivityDetectedHours: 0,
      },
      cargoLines: [
        {
          lineId: 'LINE-01',
          hsCode: '090121',
          foreignControlledContentPct: 0,
          isLicenseExceptionClaimed: false,
        },
      ],
      screenedAtIso: '2025-03-10T10:00:00.000Z',
    });

    expect(result.overallDisposition).toBe('CLEARED');
    expect(result.partyMatches).toHaveLength(0);
    expect(result.cargoViolations).toHaveLength(0);
  });

  it('blocks manifest when consignee matches synthetic BIS entity watchlist', () => {
    const result = screeningService.screenManifestCompliance({
      manifestId: 'MNF-CMP-5002',
      brokerId: 'mock_broker_atlas_01',
      corridor: 'CN_US_TRANSPACIFIC',
      destinationCountryIso2: 'CN',
      parties: {
        shipperLegalName: 'SILICON VALLEY WAFER DEMO SYSTEMS',
        shipperCountryIso2: 'US',
        consigneeLegalName: 'BOREALIS QUANTUM MICROELECTRONICS',
        consigneeCountryIso2: 'CN',
      },
      vessel: {
        vesselImoNumber: 'IMO9234567',
        vesselName: 'MV PACIFIC STAR',
        flagStateIso2: 'PA',
        flagRiskTier: 'WHITE_LIST_FLAG',
        priorPortCallsIso5: ['USLAX', 'CNSHA'],
        aisDarkActivityDetectedHours: 0,
      },
      cargoLines: [
        {
          lineId: 'LINE-01',
          hsCode: '854231',
          declaredEccnCode: '3A001',
          foreignControlledContentPct: 40,
          exportLicenseReference: 'LIC-SYNTH-8801',
          isLicenseExceptionClaimed: false,
        },
      ],
      screenedAtIso: '2025-03-10T11:00:00.000Z',
    });

    expect(result.overallDisposition).toBe('BLOCKED_SANCTIONED_ENTITY');
    expect(result.partyMatches).toHaveLength(1);
    expect(result.partyMatches[0].matchedEntityId).toBe('WL-SYNTH-9001');
  });

  it('flags dual-use ECCN cargo violation when restricted destination lacks export license', () => {
    const result = screeningService.screenManifestCompliance({
      manifestId: 'MNF-CMP-5003',
      brokerId: 'mock_broker_atlas_01',
      corridor: 'CN_US_TRANSPACIFIC',
      destinationCountryIso2: 'CN',
      parties: {
        shipperLegalName: 'APEX SERVER CHASSIS DEMO',
        shipperCountryIso2: 'US',
        consigneeLegalName: 'SHENZHEN CLOUD INFRASTRUCTURE DEMO',
        consigneeCountryIso2: 'CN',
      },
      vessel: {
        vesselImoNumber: 'IMO9345678',
        vesselName: 'MV OCEAN CARRIER',
        flagStateIso2: 'SG',
        flagRiskTier: 'WHITE_LIST_FLAG',
        priorPortCallsIso5: ['USLAX', 'CNYTN'],
        aisDarkActivityDetectedHours: 0,
      },
      cargoLines: [
        {
          lineId: 'LINE-01',
          hsCode: '854231',
          declaredEccnCode: '3A001',
          foreignControlledContentPct: 35,
          isLicenseExceptionClaimed: false,
        },
      ],
      screenedAtIso: '2025-03-10T12:00:00.000Z',
    });

    expect(result.overallDisposition).toBe('BLOCKED_DUAL_USE_LICENSE_REQUIRED');
    expect(result.cargoViolations).toHaveLength(1);
    expect(result.cargoViolations[0].eccnCode).toBe('3A001');
  });
});