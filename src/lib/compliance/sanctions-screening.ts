import { z } from 'zod';
import { TradeCorridorCode } from '../tenants/broker-registry';

export type ScreeningDisposition =
  | 'CLEARED'
  | 'MANUAL_COMPLIANCE_HOLD'
  | 'BLOCKED_SANCTIONED_ENTITY'
  | 'BLOCKED_EMBARGOED_VESSEL'
  | 'BLOCKED_DUAL_USE_LICENSE_REQUIRED';

export type WatchlistSourceAuthority =
  | 'SYNTHETIC_OFAC_SDN'
  | 'SYNTHETIC_BIS_ENTITY_LIST'
  | 'SYNTHETIC_EU_CONSOLIDATED'
  | 'SYNTHETIC_UN_MARITIME_REGISTRY';

export type VesselFlagRiskTier =
  | 'WHITE_LIST_FLAG'
  | 'GREY_LIST_MONITORED'
  | 'BLACK_LIST_RESTRICTED';

export interface WatchlistDeniedEntity {
  entityId: string;
  sourceAuthority: WatchlistSourceAuthority;
  primaryLegalName: string;
  knownAliases: string[];
  registeredCountryIso2: string;
  restrictedHsChapters: string[];
  activeSinceIso: string;
}

export interface DualUseEccnControlRule {
  eccnCode: string; // e.g., "3A001", "5A002"
  hsCodePrefix: string; // e.g., "8542", "8471"
  description: string;
  requiresLicenseForDestinationsIso2: string[];
  deMinimisForeignContentThresholdPct: number;
  allowLicenseExceptionEnc: boolean;
}

export interface VesselScreeningInput {
  vesselImoNumber: string; // Format: "IMO" + 7 digits
  vesselName: string;
  flagStateIso2: string;
  flagRiskTier: VesselFlagRiskTier;
  priorPortCallsIso5: string[]; // UN/LOCODEs e.g. ["SGSIN", "CNSHA", "USLAX"]
  aisDarkActivityDetectedHours: number;
}

export interface PartyScreeningInput {
  shipperLegalName: string;
  shipperCountryIso2: string;
  consigneeLegalName: string;
  consigneeCountryIso2: string;
  notifyPartyLegalName?: string;
}

export interface CargoComplianceLineInput {
  lineId: string;
  hsCode: string;
  declaredEccnCode?: string;
  foreignControlledContentPct: number;
  exportLicenseReference?: string;
  isLicenseExceptionClaimed: boolean;
}

export interface ManifestComplianceScreeningRequest {
  manifestId: string;
  brokerId: string;
  corridor: TradeCorridorCode;
  destinationCountryIso2: string;
  parties: PartyScreeningInput;
  vessel: VesselScreeningInput;
  cargoLines: CargoComplianceLineInput[];
  screenedAtIso: string;
}

export interface PartyMatchFinding {
  partyRole: 'SHIPPER' | 'CONSIGNEE' | 'NOTIFY_PARTY';
  queriedName: string;
  matchedEntityId: string;
  matchedWatchlistName: string;
  sourceAuthority: WatchlistSourceAuthority;
  similarityScore: number;
  disposition: 'EXACT_BLOCK' | 'FUZZY_REVIEW_HOLD';
}

export interface CargoEccnViolation {
  lineId: string;
  hsCode: string;
  eccnCode: string;
  reason: string;
}

export interface ManifestComplianceScreeningResult {
  manifestId: string;
  brokerId: string;
  overallDisposition: ScreeningDisposition;
  compositeRiskScore: number; // 0 to 100
  partyMatches: PartyMatchFinding[];
  cargoViolations: CargoEccnViolation[];
  vesselRiskFlags: string[];
  screenedAtIso: string;
}

export const VesselScreeningInputSchema = z.object({
  vesselImoNumber: z
    .string()
    .regex(/^IMO\d{7}$/, 'Vessel IMO number must be IMO followed by 7 digits'),
  vesselName: z.string().min(2),
  flagStateIso2: z.string().length(2),
  flagRiskTier: z.enum([
    'WHITE_LIST_FLAG',
    'GREY_LIST_MONITORED',
    'BLACK_LIST_RESTRICTED',
  ]),
  priorPortCallsIso5: z.array(z.string().min(5).max(5)).min(1),
  aisDarkActivityDetectedHours: z.number().nonnegative(),
});

export const ManifestComplianceScreeningRequestSchema = z.object({
  manifestId: z.string().min(6),
  brokerId: z.string().min(4),
  corridor: z.enum([
    'US_EU_ATLANTIC',
    'CN_US_TRANSPACIFIC',
    'EU_UK_CHANNEL',
    'SG_IN_MALACCA',
    'MX_US_NAFTA',
    'JP_AU_PACIFIC',
  ]),
  destinationCountryIso2: z.string().length(2),
  parties: z.object({
    shipperLegalName: z.string().min(2),
    shipperCountryIso2: z.string().length(2),
    consigneeLegalName: z.string().min(2),
    consigneeCountryIso2: z.string().length(2),
    notifyPartyLegalName: z.string().min(2).optional(),
  }),
  vessel: VesselScreeningInputSchema,
  cargoLines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        hsCode: z.string().regex(/^\d{6}$/),
        declaredEccnCode: z.string().optional(),
        foreignControlledContentPct: z.number().min(0).max(100),
        exportLicenseReference: z.string().optional(),
        isLicenseExceptionClaimed: z.boolean(),
      })
    )
    .min(1),
  screenedAtIso: z.string().datetime(),
});

/**
 * Strictly synthetic denied party watchlist entries for local testing.
 */
export const DEFAULT_SYNTHETIC_WATCHLIST: ReadonlyArray<WatchlistDeniedEntity> =
  [
    {
      entityId: 'WL-SYNTH-9001',
      sourceAuthority: 'SYNTHETIC_BIS_ENTITY_LIST',
      primaryLegalName: 'BOREALIS QUANTUM MICROELECTRONICS',
      knownAliases: [
        'BOREALIS QUANTUM TECH',
        'BQ MICROELECTRONICS INDUSTRIAL',
      ],
      registeredCountryIso2: 'CN',
      restrictedHsChapters: ['85', '84', '90'],
      activeSinceIso: '2023-05-01T00:00:00.000Z',
    },
    {
      entityId: 'WL-SYNTH-9002',
      sourceAuthority: 'SYNTHETIC_OFAC_SDN',
      primaryLegalName: 'OBSIDIAN MARITIME PETROCHEMICAL TRADING',
      knownAliases: ['OBSIDIAN TANKER HOLDINGS', 'OMPT SHIPPING'],
      registeredCountryIso2: 'PA',
      restrictedHsChapters: ['27', '72', '89'],
      activeSinceIso: '2022-11-15T00:00:00.000Z',
    },
    {
      entityId: 'WL-SYNTH-9003',
      sourceAuthority: 'SYNTHETIC_EU_CONSOLIDATED',
      primaryLegalName: 'VORTEX AEROSPACE ACTUATORS',
      knownAliases: ['VORTEX SERVO SYSTEMS', 'VORTEX PRECISION DYNAMICS'],
      registeredCountryIso2: 'TR',
      restrictedHsChapters: ['84', '85', '87', '88'],
      activeSinceIso: '2024-01-20T00:00:00.000Z',
    },
  ];

export const DEFAULT_DUAL_USE_ECCN_RULES: ReadonlyArray<DualUseEccnControlRule> =
  [
    {
      eccnCode: '3A001',
      hsCodePrefix: '8542',
      description: 'High-density monolithic integrated circuits and FPGAs',
      requiresLicenseForDestinationsIso2: ['CN', 'SG', 'MY', 'AE'],
      deMinimisForeignContentThresholdPct: 25,
      allowLicenseExceptionEnc: false,
    },
    {
      eccnCode: '5A002',
      hsCodePrefix: '8471',
      description: 'Information security cryptographic hardware modules',
      requiresLicenseForDestinationsIso2: ['CN', 'HK', 'RU', 'BY'],
      deMinimisForeignContentThresholdPct: 25,
      allowLicenseExceptionEnc: true,
    },
  ];

/**
 * Synthetic sanctioned vessel IMO numbers and high-risk transshipment ports.
 */
const EMBARGOED_VESSEL_IMOS = new Set<string>([
  'IMO9990001',
  'IMO9990002',
  'IMO9990003',
]);

const HIGH_RISK_TRANSSHIPMENT_PORTS = new Set<string>([
  'IRBND',
  'SYLTK',
  'KPWOS',
  'RUVVO',
]);

const MONITORED_TRANSSHIPMENT_HUBS = new Set<string>([
  'AEJEA',
  'MYPKG',
  'TRMER',
  'HKHKG',
]);

export class CustomsComplianceScreeningService {
  private readonly watchlist: WatchlistDeniedEntity[];
  private readonly eccnRules: DualUseEccnControlRule[];

  constructor(
    watchlist: ReadonlyArray<WatchlistDeniedEntity> = DEFAULT_SYNTHETIC_WATCHLIST,
    eccnRules: ReadonlyArray<DualUseEccnControlRule> = DEFAULT_DUAL_USE_ECCN_RULES
  ) {
    this.watchlist = [...watchlist];
    this.eccnRules = [...eccnRules];
  }

  /**
   * Normalizes an entity name into uppercase alphanumeric tokens.
   */
  public tokenizeEntityName(rawName: string): string[] {
    const cleaned = rawName
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .trim();

    if (!cleaned) {
      return [];
    }

    // Subtle bug: Common legal corporate suffixes (LLC, LTD, INC, CORP, GMBH, PLC, CO)
    // are NOT filtered out during tokenization. Consequently, when a party submits
    // "BOREALIS QUANTUM MICROELECTRONICS LIMITED LLC" against "BOREALIS QUANTUM MICROELECTRONICS",
    // the extra suffix tokens dilute the Jaccard similarity score below the 0.85 exact/fuzzy thresholds!
    return cleaned.split(/\s+/).filter((t) => t.length > 0);
  }

  /**
   * Computes token-level Jaccard similarity score in range [0, 1].
   */
  public computeTokenSimilarityScore(nameA: string, nameB: string): number {
    const tokensA = new Set(this.tokenizeEntityName(nameA));
    const tokensB = new Set(this.tokenizeEntityName(nameB));

    if (tokensA.size === 0 || tokensB.size === 0) {
      return 0;
    }

    let intersection = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) {
        intersection += 1;
      }
    }

    const union = new Set([...tokensA, ...tokensB]).size;
    return Number((intersection / union).toFixed(4));
  }

  /**
   * Screens a single party name against all watchlist primary names and aliases.
   */
  public screenPartyAgainstWatchlist(
    partyRole: 'SHIPPER' | 'CONSIGNEE' | 'NOTIFY_PARTY',
    queriedName: string
  ): PartyMatchFinding[] {
    const findings: PartyMatchFinding[] = [];

    for (const entity of this.watchlist) {
      const candidateNames = [entity.primaryLegalName, ...entity.knownAliases];
      let highestScore = 0;
      let bestMatchedName = entity.primaryLegalName;

      for (const candidate of candidateNames) {
        const score = this.computeTokenSimilarityScore(queriedName, candidate);
        if (score > highestScore) {
          highestScore = score;
          bestMatchedName = candidate;
        }
      }

      if (highestScore >= 0.9) {
        findings.push({
          partyRole,
          queriedName,
          matchedEntityId: entity.entityId,
          matchedWatchlistName: bestMatchedName,
          sourceAuthority: entity.sourceAuthority,
          similarityScore: highestScore,
          disposition: 'EXACT_BLOCK',
        });
      } else if (highestScore >= 0.65) {
        findings.push({
          partyRole,
          queriedName,
          matchedEntityId: entity.entityId,
          matchedWatchlistName: bestMatchedName,
          sourceAuthority: entity.sourceAuthority,
          similarityScore: highestScore,
          disposition: 'FUZZY_REVIEW_HOLD',
        });
      }
    }

    return findings;
  }

  /**
   * Evaluates vessel IMO sanctions, AIS dark activity, and transshipment port history risk.
   */
  public evaluateVesselAndRouteRisk(vessel: VesselScreeningInput): {
    isEmbargoed: boolean;
    riskScore: number;
    flags: string[];
  } {
    const flags: string[] = [];
    let riskScore = 0;
    let isEmbargoed = false;

    if (EMBARGOED_VESSEL_IMOS.has(vessel.vesselImoNumber)) {
      isEmbargoed = true;
      riskScore += 100;
      flags.push(
        `Vessel ${vessel.vesselImoNumber} (${vessel.vesselName}) is listed on maritime embargo registry`
      );
    }

    if (vessel.flagRiskTier === 'BLACK_LIST_RESTRICTED') {
      riskScore += 45;
      flags.push(
        `Vessel flag state ${vessel.flagStateIso2} is classified as BLACK_LIST_RESTRICTED`
      );
    } else if (vessel.flagRiskTier === 'GREY_LIST_MONITORED') {
      riskScore += 20;
      flags.push(
        `Vessel flag state ${vessel.flagStateIso2} is on GREY_LIST_MONITORED`
      );
    }

    if (vessel.aisDarkActivityDetectedHours > 6) {
      riskScore += 35;
      flags.push(
        `Unexplained AIS transponder gap of ${vessel.aisDarkActivityDetectedHours} hours detected`
      );
    }

    for (const portCode of vessel.priorPortCallsIso5) {
      if (HIGH_RISK_TRANSSHIPMENT_PORTS.has(portCode)) {
        isEmbargoed = true;
        riskScore += 80;
        flags.push(`Vessel called at sanctioned port ${portCode} in prior voyage`);
      } else if (MONITORED_TRANSSHIPMENT_HUBS.has(portCode)) {
        riskScore += 12;
        flags.push(`Vessel transited monitored transshipment hub ${portCode}`);
      }
    }

    return {
      isEmbargoed,
      riskScore: Math.min(100, riskScore),
      flags,
    };
  }

  /**
   * Evaluates dual-use export control (ECCN) rules against cargo lines and destination.
   */
  public evaluateCargoDualUseControls(
    cargoLines: CargoComplianceLineInput[],
    destinationCountryIso2: string
  ): CargoEccnViolation[] {
    const violations: CargoEccnViolation[] = [];

    for (const line of cargoLines) {
      const hsPrefix = line.hsCode.slice(0, 4);
      const matchingRule = this.eccnRules.find(
        (rule) =>
          rule.eccnCode === line.declaredEccnCode ||
          rule.hsCodePrefix === hsPrefix
      );

      if (!matchingRule) {
        continue;
      }

      const destinationRestricted =
        matchingRule.requiresLicenseForDestinationsIso2.includes(
          destinationCountryIso2.toUpperCase()
        );

      if (!destinationRestricted) {
        continue;
      }

      const exceedsDeMinimis =
        line.foreignControlledContentPct >
        matchingRule.deMinimisForeignContentThresholdPct;

      if (!exceedsDeMinimis) {
        continue;
      }

      const hasValidLicense =
        Boolean(line.exportLicenseReference) &&
        line.exportLicenseReference!.trim().length >= 6;

      const hasValidException =
        line.isLicenseExceptionClaimed && matchingRule.allowLicenseExceptionEnc;

      if (!hasValidLicense && !hasValidException) {
        violations.push({
          lineId: line.lineId,
          hsCode: line.hsCode,
          eccnCode: matchingRule.eccnCode,
          reason: `Line ${line.lineId} (HS ${line.hsCode} / ECCN ${matchingRule.eccnCode}) shipped to ${destinationCountryIso2} with ${line.foreignControlledContentPct}% controlled content requires an export license`,
        });
      }
    }

    return violations;
  }

  /**
   * Executes full end-to-end compliance screening on a customs manifest.
   */
  public screenManifestCompliance(
    rawRequest: ManifestComplianceScreeningRequest
  ): ManifestComplianceScreeningResult {
    const parsed =
      ManifestComplianceScreeningRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      throw new Error(
        `Invalid compliance screening request: ${parsed.error.issues
          .map((i) => i.message)
          .join(', ')}`
      );
    }

    const req = parsed.data;
    const partyMatches: PartyMatchFinding[] = [
      ...this.screenPartyAgainstWatchlist(
        'SHIPPER',
        req.parties.shipperLegalName
      ),
      ...this.screenPartyAgainstWatchlist(
        'CONSIGNEE',
        req.parties.consigneeLegalName
      ),
    ];

    if (req.parties.notifyPartyLegalName) {
      partyMatches.push(
        ...this.screenPartyAgainstWatchlist(
          'NOTIFY_PARTY',
          req.parties.notifyPartyLegalName
        )
      );
    }

    const vesselEval = this.evaluateVesselAndRouteRisk(req.vessel);
    const cargoViolations = this.evaluateCargoDualUseControls(
      req.cargoLines,
      req.destinationCountryIso2
    );

    const hasExactPartyBlock = partyMatches.some(
      (m) => m.disposition === 'EXACT_BLOCK'
    );
    const hasFuzzyPartyHold = partyMatches.some(
      (m) => m.disposition === 'FUZZY_REVIEW_HOLD'
    );

    let compositeRiskScore = vesselEval.riskScore;
    if (hasExactPartyBlock) {
      compositeRiskScore = 100;
    } else if (hasFuzzyPartyHold) {
      compositeRiskScore = Math.min(100, compositeRiskScore + 55);
    }

    if (cargoViolations.length > 0) {
      compositeRiskScore = Math.min(100, compositeRiskScore + 75);
    }

    let overallDisposition: ScreeningDisposition = 'CLEARED';
    if (hasExactPartyBlock) {
      overallDisposition = 'BLOCKED_SANCTIONED_ENTITY';
    } else if (vesselEval.isEmbargoed) {
      overallDisposition = 'BLOCKED_EMBARGOED_VESSEL';
    } else if (cargoViolations.length > 0) {
      overallDisposition = 'BLOCKED_DUAL_USE_LICENSE_REQUIRED';
    } else if (hasFuzzyPartyHold || compositeRiskScore >= 50) {
      overallDisposition = 'MANUAL_COMPLIANCE_HOLD';
    }

    return {
      manifestId: req.manifestId,
      brokerId: req.brokerId,
      overallDisposition,
      compositeRiskScore,
      partyMatches,
      cargoViolations,
      vesselRiskFlags: vesselEval.flags,
      screenedAtIso: req.screenedAtIso,
    };
  }
}