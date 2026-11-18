import { z } from 'zod';

export type BrokerAccountStatus =
  | 'ACTIVE'
  | 'CREDIT_HOLD'
  | 'BOND_SUSPENDED'
  | 'RESTRICTED_AUDIT'
  | 'DECOMMISSIONED';

export type TradeCorridorCode =
  | 'US_EU_ATLANTIC'
  | 'CN_US_TRANSPACIFIC'
  | 'EU_UK_CHANNEL'
  | 'SG_IN_MALACCA'
  | 'MX_US_NAFTA'
  | 'JP_AU_PACIFIC';

export type ClearanceOperationType =
  | 'STANDARD_IMPORT_ENTRY'
  | 'BONDED_WAREHOUSE_DEPOSIT'
  | 'IN_TRANSIT_TRANSSHIPMENT'
  | 'MANIFEST_AMENDMENT'
  | 'DUTY_DRAWBACK_CLAIM'
  | 'DEMURRAGE_DISPUTE_SETTLEMENT';

export type CurrencyIsoCode = 'USD' | 'EUR' | 'GBP' | 'SGD' | 'JPY' | 'CAD';

export interface SuretyBondPolicy {
  bondReferenceId: string;
  underwriterCode: string;
  maximumLiabilityCents: number;
  encumberedLiabilityCents: number;
  effectiveFromIso: string;
  expiresAtIso: string;
  continuousBond: boolean;
}

export interface BrokerRateLimitPolicy {
  maxManifestsPerMinute: number;
  maxConcurrentCalculations: number;
  burstAllowance: number;
}

export interface BrokerTenantProfile {
  brokerId: string;
  legalEntityName: string;
  customsFilerCode: string;
  contactEmail: string;
  status: BrokerAccountStatus;
  settlementCurrency: CurrencyIsoCode;
  creditLimitCents: number;
  currentUtilizedCreditCents: number;
  unsettledDemurrageCents: number;
  disputedHoldCents: number;
  suretyBond: SuretyBondPolicy;
  authorizedCorridors: TradeCorridorCode[];
  rateLimitPolicy: BrokerRateLimitPolicy;
  webhookSigningToken: string;
  tierLevel: 'TIER_1_ENTERPRISE' | 'TIER_2_REGIONAL' | 'TIER_3_STANDARD';
  createdAtIso: string;
  updatedAtIso: string;
}

export interface CreditReservationRequest {
  brokerId: string;
  manifestId: string;
  dutyAmountCents: number;
  estimatedDemurrageCents: number;
  corridor: TradeCorridorCode;
  operationType: ClearanceOperationType;
  requestedAtIso: string;
}

export interface CreditReservationResult {
  approved: boolean;
  brokerId: string;
  manifestId: string;
  rejectionCode?:
    | 'BROKER_NOT_FOUND'
    | 'STATUS_PROHIBITED'
    | 'CORRIDOR_UNAUTHORIZED'
    | 'CREDIT_LIMIT_EXCEEDED'
    | 'SURETY_BOND_EXPIRED'
    | 'SURETY_BOND_INSUFFICIENT';
  reason?: string;
  remainingCreditCents: number;
  remainingBondLiabilityCents: number;
  appliedCollateralRatio: number;
}

export interface BrokerAuditEvent {
  eventId: string;
  brokerId: string;
  previousStatus: BrokerAccountStatus;
  nextStatus: BrokerAccountStatus;
  actorId: string;
  reason: string;
  timestampIso: string;
}

export const BrokerIdSchema = z
  .string()
  .min(4)
  .max(64)
  .regex(/^[a-z0-9_-]+$/i, 'Invalid broker identifier format');

export const CreditReservationRequestSchema = z.object({
  brokerId: BrokerIdSchema,
  manifestId: z.string().min(6).max(80),
  dutyAmountCents: z.number().int().nonnegative(),
  estimatedDemurrageCents: z.number().int().nonnegative(),
  corridor: z.enum([
    'US_EU_ATLANTIC',
    'CN_US_TRANSPACIFIC',
    'EU_UK_CHANNEL',
    'SG_IN_MALACCA',
    'MX_US_NAFTA',
    'JP_AU_PACIFIC',
  ]),
  operationType: z.enum([
    'STANDARD_IMPORT_ENTRY',
    'BONDED_WAREHOUSE_DEPOSIT',
    'IN_TRANSIT_TRANSSHIPMENT',
    'MANIFEST_AMENDMENT',
    'DUTY_DRAWBACK_CLAIM',
    'DEMURRAGE_DISPUTE_SETTLEMENT',
  ]),
  requestedAtIso: z.string().datetime(),
});

export const DEFAULT_SYNTHETIC_BROKERS: ReadonlyArray<BrokerTenantProfile> = [
  {
    brokerId: 'mock_broker_atlas_01',
    legalEntityName: 'Atlas Harbor Synthetic Logistics LLC',
    customsFilerCode: 'F-901',
    contactEmail: 'example1@example.com',
    status: 'ACTIVE',
    settlementCurrency: 'USD',
    creditLimitCents: 50_000_000,
    currentUtilizedCreditCents: 12_500_000,
    unsettledDemurrageCents: 450_000,
    disputedHoldCents: 150_000,
    suretyBond: {
      bondReferenceId: 'BOND-DEMO-0001',
      underwriterCode: 'UW-SYNTH-ALPHA',
      maximumLiabilityCents: 100_000_000,
      encumberedLiabilityCents: 20_000_000,
      effectiveFromIso: '2024-01-01T00:00:00.000Z',
      expiresAtIso: '2028-12-31T23:59:59.000Z',
      continuousBond: true,
    },
    authorizedCorridors: [
      'CN_US_TRANSPACIFIC',
      'US_EU_ATLANTIC',
      'MX_US_NAFTA',
    ],
    rateLimitPolicy: {
      maxManifestsPerMinute: 120,
      maxConcurrentCalculations: 25,
      burstAllowance: 40,
    },
    webhookSigningToken: 'YOUR_API_KEY_HERE_DEMO_ATLAS_01',
    tierLevel: 'TIER_1_ENTERPRISE',
    createdAtIso: '2024-02-10T08:30:00.000Z',
    updatedAtIso: '2025-01-15T14:20:00.000Z',
  },
  {
    brokerId: 'mock_broker_meridian_02',
    legalEntityName: 'Meridian Freight Synthetic Clearing Corp',
    customsFilerCode: 'F-442',
    contactEmail: 'example2@example.com',
    status: 'ACTIVE',
    settlementCurrency: 'EUR',
    creditLimitCents: 15_000_000,
    currentUtilizedCreditCents: 13_800_000,
    unsettledDemurrageCents: 900_000,
    disputedHoldCents: 350_000,
    suretyBond: {
      bondReferenceId: 'BOND-DEMO-0002',
      underwriterCode: 'UW-SYNTH-BETA',
      maximumLiabilityCents: 30_000_000,
      encumberedLiabilityCents: 18_500_000,
      effectiveFromIso: '2024-06-01T00:00:00.000Z',
      expiresAtIso: '2027-06-01T00:00:00.000Z',
      continuousBond: true,
    },
    authorizedCorridors: ['US_EU_ATLANTIC', 'EU_UK_CHANNEL'],
    rateLimitPolicy: {
      maxManifestsPerMinute: 60,
      maxConcurrentCalculations: 10,
      burstAllowance: 15,
    },
    webhookSigningToken: 'YOUR_API_KEY_HERE_DEMO_MERIDIAN_02',
    tierLevel: 'TIER_2_REGIONAL',
    createdAtIso: '2024-06-12T10:00:00.000Z',
    updatedAtIso: '2025-01-18T09:15:00.000Z',
  },
  {
    brokerId: 'mock_broker_solstice_03',
    legalEntityName: 'Solstice Bonded Port Agency Demo Ltd',
    customsFilerCode: 'F-719',
    contactEmail: 'example3@example.com',
    status: 'RESTRICTED_AUDIT',
    settlementCurrency: 'USD',
    creditLimitCents: 8_000_000,
    currentUtilizedCreditCents: 4_200_000,
    unsettledDemurrageCents: 600_000,
    disputedHoldCents: 200_000,
    suretyBond: {
      bondReferenceId: 'BOND-DEMO-0003',
      underwriterCode: 'UW-SYNTH-GAMMA',
      maximumLiabilityCents: 12_000_000,
      encumberedLiabilityCents: 6_000_000,
      effectiveFromIso: '2023-01-01T00:00:00.000Z',
      expiresAtIso: '2026-12-31T23:59:59.000Z',
      continuousBond: false,
    },
    authorizedCorridors: ['SG_IN_MALACCA', 'JP_AU_PACIFIC'],
    rateLimitPolicy: {
      maxManifestsPerMinute: 30,
      maxConcurrentCalculations: 5,
      burstAllowance: 5,
    },
    webhookSigningToken: 'YOUR_API_KEY_HERE_DEMO_SOLSTICE_03',
    tierLevel: 'TIER_3_STANDARD',
    createdAtIso: '2023-11-05T11:45:00.000Z',
    updatedAtIso: '2025-01-20T16:40:00.000Z',
  },
  {
    brokerId: 'mock_broker_vanguard_04',
    legalEntityName: 'Vanguard Pacific Synthetic Forwarding Inc',
    customsFilerCode: 'F-884',
    contactEmail: 'example4@example.com',
    status: 'CREDIT_HOLD',
    settlementCurrency: 'USD',
    creditLimitCents: 20_000_000,
    currentUtilizedCreditCents: 19_600_000,
    unsettledDemurrageCents: 1_200_000,
    disputedHoldCents: 0,
    suretyBond: {
      bondReferenceId: 'BOND-DEMO-0004',
      underwriterCode: 'UW-SYNTH-ALPHA',
      maximumLiabilityCents: 40_000_000,
      encumberedLiabilityCents: 38_000_000,
      effectiveFromIso: '2024-03-01T00:00:00.000Z',
      expiresAtIso: '2027-03-01T00:00:00.000Z',
      continuousBond: true,
    },
    authorizedCorridors: ['CN_US_TRANSPACIFIC', 'JP_AU_PACIFIC'],
    rateLimitPolicy: {
      maxManifestsPerMinute: 45,
      maxConcurrentCalculations: 8,
      burstAllowance: 10,
    },
    webhookSigningToken: 'YOUR_API_KEY_HERE_DEMO_VANGUARD_04',
    tierLevel: 'TIER_2_REGIONAL',
    createdAtIso: '2024-03-15T12:00:00.000Z',
    updatedAtIso: '2025-02-01T08:00:00.000Z',
  },
];

const OPERATION_BOND_COLLATERAL_MULTIPLIERS: Record<
  ClearanceOperationType,
  number
> = {
  STANDARD_IMPORT_ENTRY: 1.0,
  BONDED_WAREHOUSE_DEPOSIT: 1.25,
  IN_TRANSIT_TRANSSHIPMENT: 1.5,
  MANIFEST_AMENDMENT: 1.0,
  DUTY_DRAWBACK_CLAIM: 0.5,
  DEMURRAGE_DISPUTE_SETTLEMENT: 0.0,
};

const ALLOWED_STATUS_TRANSITIONS: Record<
  BrokerAccountStatus,
  ReadonlyArray<BrokerAccountStatus>
> = {
  ACTIVE: ['CREDIT_HOLD', 'BOND_SUSPENDED', 'RESTRICTED_AUDIT', 'DECOMMISSIONED'],
  CREDIT_HOLD: ['ACTIVE', 'BOND_SUSPENDED', 'RESTRICTED_AUDIT', 'DECOMMISSIONED'],
  BOND_SUSPENDED: ['ACTIVE', 'CREDIT_HOLD', 'DECOMMISSIONED'],
  RESTRICTED_AUDIT: ['ACTIVE', 'CREDIT_HOLD', 'BOND_SUSPENDED', 'DECOMMISSIONED'],
  DECOMMISSIONED: [],
};

export class BrokerTenantRegistry {
  private readonly brokers: Map<string, BrokerTenantProfile> = new Map();
  private readonly auditTrail: BrokerAuditEvent[] = [];

  constructor(
    initialProfiles: ReadonlyArray<BrokerTenantProfile> = DEFAULT_SYNTHETIC_BROKERS
  ) {
    for (const profile of initialProfiles) {
      this.brokers.set(profile.brokerId, this.cloneProfile(profile));
    }
  }

  private cloneProfile(profile: BrokerTenantProfile): BrokerTenantProfile {
    return {
      ...profile,
      suretyBond: { ...profile.suretyBond },
      authorizedCorridors: [...profile.authorizedCorridors],
      rateLimitPolicy: { ...profile.rateLimitPolicy },
    };
  }

  public getBroker(brokerId: string): BrokerTenantProfile | undefined {
    const found = this.brokers.get(brokerId);
    return found ? this.cloneProfile(found) : undefined;
  }

  public listBrokers(): BrokerTenantProfile[] {
    return Array.from(this.brokers.values()).map((b) => this.cloneProfile(b));
  }

  public getAuditTrail(brokerId?: string): BrokerAuditEvent[] {
    if (!brokerId) {
      return [...this.auditTrail];
    }
    return this.auditTrail.filter((evt) => evt.brokerId === brokerId);
  }

  public canClearCustomsDeclaration(
    broker: BrokerTenantProfile,
    operationType: ClearanceOperationType
  ): { allowed: boolean; reason?: string } {
    if (broker.status === 'DECOMMISSIONED') {
      return {
        allowed: false,
        reason: 'Broker account is permanently decommissioned',
      };
    }

    if (broker.status === 'BOND_SUSPENDED') {
      if (operationType === 'DEMURRAGE_DISPUTE_SETTLEMENT') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason:
          'Customs surety bond is suspended; no duty-bearing operations allowed',
      };
    }

    if (broker.status === 'CREDIT_HOLD') {
      if (
        operationType === 'DUTY_DRAWBACK_CLAIM' ||
        operationType === 'DEMURRAGE_DISPUTE_SETTLEMENT'
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason:
          'Broker is on credit hold; new import declarations and warehouse deposits are blocked',
      };
    }

    if (broker.status === 'RESTRICTED_AUDIT') {
      if (
        operationType === 'STANDARD_IMPORT_ENTRY' ||
        operationType === 'BONDED_WAREHOUSE_DEPOSIT'
      ) {
        return {
          allowed: false,
          reason:
            'Broker is under restricted customs audit; primary import entries are frozen',
        };
      }
      return { allowed: true };
    }

    return { allowed: true };
  }

  public calculateAvailableCreditCents(broker: BrokerTenantProfile): number {
    const totalExposureCents =
      broker.currentUtilizedCreditCents +
      broker.unsettledDemurrageCents -
      broker.disputedHoldCents;

    return Math.max(0, broker.creditLimitCents - totalExposureCents);
  }

  public validateSuretyBondCapacity(
    broker: BrokerTenantProfile,
    requiredBondExposureCents: number,
    referenceTimestampIso: string
  ): { valid: boolean; reason?: string; remainingBondCents: number } {
    const refTime = Date.parse(referenceTimestampIso);
    const effectiveFrom = Date.parse(broker.suretyBond.effectiveFromIso);
    const expiresAt = Date.parse(broker.suretyBond.expiresAtIso);

    const remainingBondCents = Math.max(
      0,
      broker.suretyBond.maximumLiabilityCents -
        broker.suretyBond.encumberedLiabilityCents
    );

    if (
      Number.isNaN(refTime) ||
      refTime < effectiveFrom ||
      refTime > expiresAt
    ) {
      return {
        valid: false,
        reason: `Surety bond ${broker.suretyBond.bondReferenceId} is outside its active validity window`,
        remainingBondCents,
      };
    }

    if (requiredBondExposureCents > remainingBondCents) {
      return {
        valid: false,
        reason: `Required bond exposure (${requiredBondExposureCents} cents) exceeds remaining surety capacity (${remainingBondCents} cents)`,
        remainingBondCents,
      };
    }

    return {
      valid: true,
      remainingBondCents: remainingBondCents - requiredBondExposureCents,
    };
  }

  public reserveCreditForManifest(
    rawRequest: CreditReservationRequest
  ): CreditReservationResult {
    const parsed = CreditReservationRequestSchema.safeParse(rawRequest);
    if (!parsed.success) {
      throw new Error(
        `Invalid credit reservation payload: ${parsed.error.issues
          .map((i) => i.message)
          .join(', ')}`
      );
    }

    const request = parsed.data;
    const broker = this.brokers.get(request.brokerId);

    if (!broker) {
      return {
        approved: false,
        brokerId: request.brokerId,
        manifestId: request.manifestId,
        rejectionCode: 'BROKER_NOT_FOUND',
        reason: `Broker ${request.brokerId} is not registered`,
        remainingCreditCents: 0,
        remainingBondLiabilityCents: 0,
        appliedCollateralRatio: 0,
      };
    }

    const statusCheck = this.canClearCustomsDeclaration(
      broker,
      request.operationType
    );
    if (!statusCheck.allowed) {
      return {
        approved: false,
        brokerId: broker.brokerId,
        manifestId: request.manifestId,
        rejectionCode: 'STATUS_PROHIBITED',
        reason: statusCheck.reason,
        remainingCreditCents: this.calculateAvailableCreditCents(broker),
        remainingBondLiabilityCents: Math.max(
          0,
          broker.suretyBond.maximumLiabilityCents -
            broker.suretyBond.encumberedLiabilityCents
        ),
        appliedCollateralRatio: 0,
      };
    }

    if (!broker.authorizedCorridors.includes(request.corridor)) {
      return {
        approved: false,
        brokerId: broker.brokerId,
        manifestId: request.manifestId,
        rejectionCode: 'CORRIDOR_UNAUTHORIZED',
        reason: `Broker ${broker.brokerId} is not authorized for corridor ${request.corridor}`,
        remainingCreditCents: this.calculateAvailableCreditCents(broker),
        remainingBondLiabilityCents: Math.max(
          0,
          broker.suretyBond.maximumLiabilityCents -
            broker.suretyBond.encumberedLiabilityCents
        ),
        appliedCollateralRatio: 0,
      };
    }

    const collateralRatio =
      OPERATION_BOND_COLLATERAL_MULTIPLIERS[request.operationType] ?? 1.0;
    const totalCreditNeededCents =
      request.dutyAmountCents + request.estimatedDemurrageCents;
    const requiredBondExposureCents = Math.round(
      request.dutyAmountCents * collateralRatio
    );

    const availableCreditCents = this.calculateAvailableCreditCents(broker);
    if (totalCreditNeededCents > availableCreditCents) {
      return {
        approved: false,
        brokerId: broker.brokerId,
        manifestId: request.manifestId,
        rejectionCode: 'CREDIT_LIMIT_EXCEEDED',
        reason: `Requested credit (${totalCreditNeededCents} cents) exceeds available credit (${availableCreditCents} cents)`,
        remainingCreditCents: availableCreditCents,
        remainingBondLiabilityCents: Math.max(
          0,
          broker.suretyBond.maximumLiabilityCents -
            broker.suretyBond.encumberedLiabilityCents
        ),
        appliedCollateralRatio: collateralRatio,
      };
    }

    const bondCheck = this.validateSuretyBondCapacity(
      broker,
      requiredBondExposureCents,
      request.requestedAtIso
    );

    if (!bondCheck.valid) {
      const isExpired = bondCheck.reason?.includes('validity window');
      return {
        approved: false,
        brokerId: broker.brokerId,
        manifestId: request.manifestId,
        rejectionCode: isExpired
          ? 'SURETY_BOND_EXPIRED'
          : 'SURETY_BOND_INSUFFICIENT',
        reason: bondCheck.reason,
        remainingCreditCents: availableCreditCents,
        remainingBondLiabilityCents: bondCheck.remainingBondCents,
        appliedCollateralRatio: collateralRatio,
      };
    }

    broker.currentUtilizedCreditCents += request.dutyAmountCents;
    broker.unsettledDemurrageCents += request.estimatedDemurrageCents;
    broker.suretyBond.encumberedLiabilityCents += requiredBondExposureCents;
    broker.updatedAtIso = request.requestedAtIso;

    return {
      approved: true,
      brokerId: broker.brokerId,
      manifestId: request.manifestId,
      remainingCreditCents: this.calculateAvailableCreditCents(broker),
      remainingBondLiabilityCents: Math.max(
        0,
        broker.suretyBond.maximumLiabilityCents -
          broker.suretyBond.encumberedLiabilityCents
      ),
      appliedCollateralRatio: collateralRatio,
    };
  }

  public adjustBrokerExposure(params: {
    brokerId: string;
    dutyDeltaCents: number;
    demurrageDeltaCents: number;
    disputedHoldDeltaCents: number;
    bondEncumbranceDeltaCents: number;
    timestampIso: string;
  }): BrokerTenantProfile {
    const broker = this.brokers.get(params.brokerId);
    if (!broker) {
      throw new Error(`Broker ${params.brokerId} not found`);
    }

    broker.currentUtilizedCreditCents = Math.max(
      0,
      broker.currentUtilizedCreditCents + params.dutyDeltaCents
    );
    broker.unsettledDemurrageCents = Math.max(
      0,
      broker.unsettledDemurrageCents + params.demurrageDeltaCents
    );
    broker.disputedHoldCents = Math.max(
      0,
      broker.disputedHoldCents + params.disputedHoldDeltaCents
    );
    broker.suretyBond.encumberedLiabilityCents = Math.max(
      0,
      broker.suretyBond.encumberedLiabilityCents +
        params.bondEncumbranceDeltaCents
    );
    broker.updatedAtIso = params.timestampIso;

    return this.cloneProfile(broker);
  }

  public transitionBrokerStatus(params: {
    brokerId: string;
    targetStatus: BrokerAccountStatus;
    actorId: string;
    reason: string;
    timestampIso: string;
  }): BrokerTenantProfile {
    const broker = this.brokers.get(params.brokerId);
    if (!broker) {
      throw new Error(`Broker ${params.brokerId} not found`);
    }

    if (broker.status === params.targetStatus) {
      return this.cloneProfile(broker);
    }

    const allowedTargets = ALLOWED_STATUS_TRANSITIONS[broker.status] ?? [];
    if (!allowedTargets.includes(params.targetStatus)) {
      throw new Error(
        `Invalid broker status transition from ${broker.status} to ${params.targetStatus}`
      );
    }

    const previousStatus = broker.status;
    broker.status = params.targetStatus;
    broker.updatedAtIso = params.timestampIso;

    this.auditTrail.push({
      eventId: `aud_${broker.brokerId}_${this.auditTrail.length + 1}`,
      brokerId: broker.brokerId,
      previousStatus,
      nextStatus: params.targetStatus,
      actorId: params.actorId,
      reason: params.reason,
      timestampIso: params.timestampIso,
    });

    return this.cloneProfile(broker);
  }

  public evaluateMarginCallStatus(
    brokerId: string,
    timestampIso: string
  ): { changed: boolean; profile: BrokerTenantProfile } {
    const broker = this.brokers.get(brokerId);
    if (!broker) {
      throw new Error(`Broker ${brokerId} not found`);
    }

    const totalExposure =
      broker.currentUtilizedCreditCents +
      broker.unsettledDemurrageCents +
      broker.disputedHoldCents;

    const utilizationRatio =
      broker.creditLimitCents > 0 ? totalExposure / broker.creditLimitCents : 1;

    if (broker.status === 'ACTIVE' && utilizationRatio >= 0.95) {
      const updated = this.transitionBrokerStatus({
        brokerId,
        targetStatus: 'CREDIT_HOLD',
        actorId: 'system_margin_monitor',
        reason: `Credit utilization reached ${(utilizationRatio * 100).toFixed(2)}%`,
        timestampIso,
      });
      return { changed: true, profile: updated };
    }

    if (broker.status === 'CREDIT_HOLD' && utilizationRatio <= 0.8) {
      const updated = this.transitionBrokerStatus({
        brokerId,
        targetStatus: 'ACTIVE',
        actorId: 'system_margin_monitor',
        reason: `Credit utilization recovered to ${(utilizationRatio * 100).toFixed(2)}%`,
        timestampIso,
      });
      return { changed: true, profile: updated };
    }

    return { changed: false, profile: this.cloneProfile(broker) };
  }
}