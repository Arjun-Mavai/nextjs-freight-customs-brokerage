import { z } from 'zod';
import { CurrencyIsoCode } from '../tenants/broker-registry';

export type LedgerEntryType =
  | 'DUTY_ASSESSMENT_DEBIT'
  | 'BONDED_DEFERRAL_HOLD'
  | 'DEMURRAGE_ACCRUAL_DEBIT'
  | 'DISPUTE_HOLD_RESERVE'
  | 'DISPUTE_CREDIT_ADJUSTMENT'
  | 'DISPUTE_REJECTED_RELEASE'
  | 'CASH_SETTLEMENT_PAYMENT';

export type DisputeStatus =
  | 'OPEN_UNDER_REVIEW'
  | 'APPROVED_FULL_CREDIT'
  | 'APPROVED_PARTIAL_CREDIT'
  | 'REJECTED_UPHELD';

export type DisputeCategory =
  | 'TARIFF_MISCLASSIFICATION'
  | 'PREFERENTIAL_FTA_RETROACTIVE'
  | 'PORT_CRANE_OUTAGE_EXEMPTION'
  | 'CUSTOMS_HOLD_DELAY_WAIVER'
  | 'DUPLICATE_CONTAINER_BILLING';

export interface LedgerJournalEntry {
  entryId: string;
  sequenceNumber: number;
  brokerId: string;
  manifestId: string;
  containerNumber?: string;
  disputeId?: string;
  entryType: LedgerEntryType;
  currency: CurrencyIsoCode;
  signedAmountCents: number; // Positive increases broker obligation, negative reduces obligation
  runningBalanceCents: number;
  description: string;
  createdAtIso: string;
  metadata: Record<string, string | number | boolean>;
}

export interface CustomsDisputeRecord {
  disputeId: string;
  brokerId: string;
  manifestId: string;
  containerNumber?: string;
  category: DisputeCategory;
  status: DisputeStatus;
  currency: CurrencyIsoCode;
  originalAssessedCents: number;
  claimedReductionCents: number;
  approvedReductionCents: number;
  reasonNarrative: string;
  resolutionNotes?: string;
  openedAtIso: string;
  resolvedAtIso?: string;
}

export interface BrokerLedgerSummary {
  brokerId: string;
  currency: CurrencyIsoCode;
  totalDutyDebitsCents: number;
  totalBondedDeferredCents: number;
  totalDemurrageDebitsCents: number;
  totalDisputeCreditsCents: number;
  activeDisputeHoldCents: number;
  netOutstandingBalanceCents: number;
  entryCount: number;
}

export const CreateDisputeInputSchema = z.object({
  disputeId: z.string().min(6).max(64),
  brokerId: z.string().min(4),
  manifestId: z.string().min(6),
  containerNumber: z
    .string()
    .regex(/^[A-Z]{4}\d{7}$/)
    .optional(),
  category: z.enum([
    'TARIFF_MISCLASSIFICATION',
    'PREFERENTIAL_FTA_RETROACTIVE',
    'PORT_CRANE_OUTAGE_EXEMPTION',
    'CUSTOMS_HOLD_DELAY_WAIVER',
    'DUPLICATE_CONTAINER_BILLING',
  ]),
  currency: z.enum(['USD', 'EUR', 'GBP', 'SGD', 'JPY', 'CAD']),
  originalAssessedCents: z.number().int().positive(),
  claimedReductionCents: z.number().int().positive(),
  reasonNarrative: z.string().min(10).max(500),
  openedAtIso: z.string().datetime(),
});

export const ResolveDisputeInputSchema = z.object({
  disputeId: z.string().min(6),
  brokerId: z.string().min(4),
  approvedReductionCents: z.number().int().nonnegative(),
  resolutionNotes: z.string().min(5).max(500),
  resolvedAtIso: z.string().datetime(),
});

export class BondedWarehouseLedgerJournal {
  private readonly entries: LedgerJournalEntry[] = [];
  private readonly disputes: Map<string, CustomsDisputeRecord> = new Map();
  private sequenceCounter = 1000;

  private nextSequence(): number {
    this.sequenceCounter += 1;
    return this.sequenceCounter;
  }

  public getBrokerRunningBalanceCents(brokerId: string): number {
    let balance = 0;
    for (const entry of this.entries) {
      if (entry.brokerId === brokerId) {
        balance += entry.signedAmountCents;
      }
    }
    return balance;
  }

  /**
   * Appends a new immutable financial entry to the ledger journal.
   */
  public appendEntry(params: {
    brokerId: string;
    manifestId: string;
    containerNumber?: string;
    disputeId?: string;
    entryType: LedgerEntryType;
    currency: CurrencyIsoCode;
    signedAmountCents: number;
    description: string;
    createdAtIso: string;
    metadata?: Record<string, string | number | boolean>;
  }): LedgerJournalEntry {
    const seq = this.nextSequence();
    const priorBalance = this.getBrokerRunningBalanceCents(params.brokerId);
    const nextBalance = priorBalance + params.signedAmountCents;

    const entry: LedgerJournalEntry = {
      entryId: `led_${seq}_${params.brokerId}`,
      sequenceNumber: seq,
      brokerId: params.brokerId,
      manifestId: params.manifestId,
      containerNumber: params.containerNumber,
      disputeId: params.disputeId,
      entryType: params.entryType,
      currency: params.currency,
      signedAmountCents: params.signedAmountCents,
      runningBalanceCents: nextBalance,
      description: params.description,
      createdAtIso: params.createdAtIso,
      metadata: params.metadata ? { ...params.metadata } : {},
    };

    this.entries.push(entry);
    return { ...entry, metadata: { ...entry.metadata } };
  }

  /**
   * Records both immediate duty debits, deferred bonded holds, and container demurrage charges.
   */
  public recordManifestClearanceEntries(params: {
    brokerId: string;
    manifestId: string;
    currency: CurrencyIsoCode;
    immediateCashDutyCents: number;
    deferredBondedDutyCents: number;
    demurrageCents: number;
    containerNumber?: string;
    timestampIso: string;
  }): LedgerJournalEntry[] {
    const created: LedgerJournalEntry[] = [];

    if (params.immediateCashDutyCents > 0) {
      created.push(
        this.appendEntry({
          brokerId: params.brokerId,
          manifestId: params.manifestId,
          entryType: 'DUTY_ASSESSMENT_DEBIT',
          currency: params.currency,
          signedAmountCents: params.immediateCashDutyCents,
          description: `Immediate customs duty and port fee assessment for manifest ${params.manifestId}`,
          createdAtIso: params.timestampIso,
          metadata: { bondedDeferred: false },
        })
      );
    }

    if (params.deferredBondedDutyCents > 0) {
      created.push(
        this.appendEntry({
          brokerId: params.brokerId,
          manifestId: params.manifestId,
          entryType: 'BONDED_DEFERRAL_HOLD',
          currency: params.currency,
          signedAmountCents: params.deferredBondedDutyCents,
          description: `Bonded warehouse deferred base duty reservation for manifest ${params.manifestId}`,
          createdAtIso: params.timestampIso,
          metadata: { bondedDeferred: true },
        })
      );
    }

    if (params.demurrageCents > 0) {
      created.push(
        this.appendEntry({
          brokerId: params.brokerId,
          manifestId: params.manifestId,
          containerNumber: params.containerNumber,
          entryType: 'DEMURRAGE_ACCRUAL_DEBIT',
          currency: params.currency,
          signedAmountCents: params.demurrageCents,
          description: `Port container detention and demurrage charge for manifest ${params.manifestId}`,
          createdAtIso: params.timestampIso,
          metadata: {
            containerNumber: params.containerNumber ?? 'UNSPECIFIED',
          },
        })
      );
    }

    return created;
  }

  /**
   * Opens a formal customs tariff or port demurrage dispute and places the claimed amount in dispute hold.
   */
  public openDisputeClaim(
    rawInput: z.infer<typeof CreateDisputeInputSchema>
  ): {
    dispute: CustomsDisputeRecord;
    holdEntry: LedgerJournalEntry;
  } {
    const parsed = CreateDisputeInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(
        `Invalid dispute claim input: ${parsed.error.issues
          .map((i) => i.message)
          .join(', ')}`
      );
    }

    const input = parsed.data;
    if (this.disputes.has(input.disputeId)) {
      throw new Error(`Dispute ID ${input.disputeId} already exists`);
    }

    if (input.claimedReductionCents > input.originalAssessedCents) {
      throw new Error(
        `Claimed reduction (${input.claimedReductionCents}) cannot exceed original assessed amount (${input.originalAssessedCents})`
      );
    }

    const dispute: CustomsDisputeRecord = {
      disputeId: input.disputeId,
      brokerId: input.brokerId,
      manifestId: input.manifestId,
      containerNumber: input.containerNumber,
      category: input.category,
      status: 'OPEN_UNDER_REVIEW',
      currency: input.currency,
      originalAssessedCents: input.originalAssessedCents,
      claimedReductionCents: input.claimedReductionCents,
      approvedReductionCents: 0,
      reasonNarrative: input.reasonNarrative,
      openedAtIso: input.openedAtIso,
    };

    this.disputes.set(dispute.disputeId, dispute);

    // Note: A dispute hold reserve has 0 impact on net obligation until adjudicated,
    // but tracks the disputed hold amount in metadata for reconciliation.
    const holdEntry = this.appendEntry({
      brokerId: input.brokerId,
      manifestId: input.manifestId,
      containerNumber: input.containerNumber,
      disputeId: input.disputeId,
      entryType: 'DISPUTE_HOLD_RESERVE',
      currency: input.currency,
      signedAmountCents: 0,
      description: `Dispute ${input.disputeId} opened (${input.category}) claiming ${input.claimedReductionCents} cents`,
      createdAtIso: input.openedAtIso,
      metadata: {
        claimedReductionCents: input.claimedReductionCents,
        originalAssessedCents: input.originalAssessedCents,
      },
    });

    return {
      dispute: { ...dispute },
      holdEntry,
    };
  }

  /**
   * Adjudicates and resolves an open dispute claim, posting credit adjustments if approved.
   */
  public resolveDisputeClaim(
    rawInput: z.infer<typeof ResolveDisputeInputSchema>
  ): {
    dispute: CustomsDisputeRecord;
    settlementEntry: LedgerJournalEntry;
    releasedHoldCents: number;
  } {
    const parsed = ResolveDisputeInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(
        `Invalid dispute resolution payload: ${parsed.error.issues
          .map((i) => i.message)
          .join(', ')}`
      );
    }

    const input = parsed.data;
    const dispute = this.disputes.get(input.disputeId);
    if (!dispute) {
      throw new Error(`Dispute ${input.disputeId} not found`);
    }

    if (dispute.brokerId !== input.brokerId) {
      throw new Error(
        `Dispute ${input.disputeId} does not belong to broker ${input.brokerId}`
      );
    }

    if (dispute.status !== 'OPEN_UNDER_REVIEW') {
      throw new Error(
        `Dispute ${input.disputeId} is already resolved with status ${dispute.status}`
      );
    }

    if (input.approvedReductionCents > dispute.claimedReductionCents) {
      throw new Error(
        `Approved reduction (${input.approvedReductionCents}) cannot exceed claimed reduction (${dispute.claimedReductionCents})`
      );
    }

    let nextStatus: DisputeStatus = 'REJECTED_UPHELD';
    if (input.approvedReductionCents === dispute.claimedReductionCents) {
      nextStatus = 'APPROVED_FULL_CREDIT';
    } else if (input.approvedReductionCents > 0) {
      nextStatus = 'APPROVED_PARTIAL_CREDIT';
    }

    dispute.status = nextStatus;
    dispute.approvedReductionCents = input.approvedReductionCents;
    dispute.resolutionNotes = input.resolutionNotes;
    dispute.resolvedAtIso = input.resolvedAtIso;

    const entryType: LedgerEntryType =
      input.approvedReductionCents > 0
        ? 'DISPUTE_CREDIT_ADJUSTMENT'
        : 'DISPUTE_REJECTED_RELEASE';

    const settlementEntry = this.appendEntry({
      brokerId: dispute.brokerId,
      manifestId: dispute.manifestId,
      containerNumber: dispute.containerNumber,
      disputeId: dispute.disputeId,
      entryType,
      currency: dispute.currency,
      signedAmountCents: -input.approvedReductionCents,
      description: `Dispute ${dispute.disputeId} adjudicated (${nextStatus}): credited ${input.approvedReductionCents} cents`,
      createdAtIso: input.resolvedAtIso,
      metadata: {
        claimedReductionCents: dispute.claimedReductionCents,
        approvedReductionCents: input.approvedReductionCents,
      },
    });

    // Subtle bug: When a dispute is resolved (even partially or rejected), the ENTIRE
    // original claimedReductionCents hold should be released from disputedHoldCents.
    // However, this returns only input.approvedReductionCents when > 0, leaving the unapproved
    // remainder permanently stuck in the broker's disputedHoldCents!
    const releasedHoldCents =
      input.approvedReductionCents > 0
        ? input.approvedReductionCents
        : dispute.claimedReductionCents;

    return {
      dispute: { ...dispute },
      settlementEntry,
      releasedHoldCents,
    };
  }

  public getDispute(disputeId: string): CustomsDisputeRecord | undefined {
    const found = this.disputes.get(disputeId);
    return found ? { ...found } : undefined;
  }

  public listBrokerDisputes(brokerId: string): CustomsDisputeRecord[] {
    return Array.from(this.disputes.values())
      .filter((d) => d.brokerId === brokerId)
      .map((d) => ({ ...d }));
  }

  public listBrokerEntries(brokerId: string): LedgerJournalEntry[] {
    return this.entries
      .filter((e) => e.brokerId === brokerId)
      .map((e) => ({ ...e, metadata: { ...e.metadata } }));
  }

  public getBrokerLedgerSummary(
    brokerId: string,
    currency: CurrencyIsoCode
  ): BrokerLedgerSummary {
    const brokerEntries = this.entries.filter((e) => e.brokerId === brokerId);
    let totalDutyDebitsCents = 0;
    let totalBondedDeferredCents = 0;
    let totalDemurrageDebitsCents = 0;
    let totalDisputeCreditsCents = 0;

    for (const entry of brokerEntries) {
      if (entry.entryType === 'DUTY_ASSESSMENT_DEBIT') {
        totalDutyDebitsCents += entry.signedAmountCents;
      } else if (entry.entryType === 'BONDED_DEFERRAL_HOLD') {
        totalBondedDeferredCents += entry.signedAmountCents;
      } else if (entry.entryType === 'DEMURRAGE_ACCRUAL_DEBIT') {
        totalDemurrageDebitsCents += entry.signedAmountCents;
      } else if (entry.entryType === 'DISPUTE_CREDIT_ADJUSTMENT') {
        totalDisputeCreditsCents += Math.abs(entry.signedAmountCents);
      }
    }

    let activeDisputeHoldCents = 0;
    for (const disp of this.disputes.values()) {
      if (
        disp.brokerId === brokerId &&
        disp.status === 'OPEN_UNDER_REVIEW'
      ) {
        activeDisputeHoldCents += disp.claimedReductionCents;
      }
    }

    return {
      brokerId,
      currency,
      totalDutyDebitsCents,
      totalBondedDeferredCents,
      totalDemurrageDebitsCents,
      totalDisputeCreditsCents,
      activeDisputeHoldCents,
      netOutstandingBalanceCents: this.getBrokerRunningBalanceCents(brokerId),
      entryCount: brokerEntries.length,
    };
  }
}