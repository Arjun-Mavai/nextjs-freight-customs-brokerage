import { z } from 'zod';
import { CurrencyIsoCode, TradeCorridorCode } from '../tenants/broker-registry';

export type HsChapterCategory =
  | 'ELECTRONICS_SEMICONDUCTORS'
  | 'INDUSTRIAL_MACHINERY'
  | 'TEXTILES_APPAREL'
  | 'AUTOMOTIVE_COMPONENTS'
  | 'AGRICULTURAL_PRODUCE'
  | 'STEEL_ALUMINUM_METALS'
  | 'PHARMACEUTICAL_MEDICAL';

export type PreferentialTradeAgreement =
  | 'NONE'
  | 'USMCA_NAFTA_CERTIFIED'
  | 'EU_UK_TCA_ORIGIN'
  | 'ASEAN_FTA_FORM_D'
  | 'CPTPP_CERTIFIED_ORIGIN';

export interface HsTariffScheduleEntry {
  hsCode: string; // 6-digit standard code e.g. "854231"
  description: string;
  category: HsChapterCategory;
  adValoremRateBps: number; // 100 bps = 1.00%
  specificDutyCentsPerKg: number;
  antiDumpingSurchargeBps: number;
  countervailingDutyBps: number;
  eligibleAgreements: PreferentialTradeAgreement[];
  preferentialReductionFactor: number; // e.g. 0.0 means 100% duty-free under FTA, 0.5 means 50% reduction
  requiresImportLicense: boolean;
}

export interface ManifestLineItemInput {
  lineId: string;
  hsCode: string;
  description: string;
  countryOfOriginIso2: string;
  fobValueMinorUnits: number; // In source currency cents/minor units
  oceanFreightMinorUnits: number;
  marineInsuranceMinorUnits: number;
  sourceCurrency: CurrencyIsoCode;
  netWeightKg: number;
  grossWeightKg: number;
  quantityUnits: number;
  claimedAgreement: PreferentialTradeAgreement;
  certificateOfOriginVerified: boolean;
}

export interface CustomsManifestDutyInput {
  manifestId: string;
  brokerId: string;
  corridor: TradeCorridorCode;
  settlementCurrency: CurrencyIsoCode;
  entryDateIso: string;
  portOfEntryCode: string;
  isBondedWarehouseEntry: boolean;
  lineItems: ManifestLineItemInput[];
}

export interface CalculatedLineItemDuty {
  lineId: string;
  hsCode: string;
  category: HsChapterCategory;
  cifValueSettlementCents: number;
  appliedFxRate: number;
  baseAdValoremDutyCents: number;
  specificWeightDutyCents: number;
  antiDumpingDutyCents: number;
  countervailingDutyCents: number;
  merchandiseProcessingFeeCents: number;
  harborMaintenanceFeeCents: number;
  deMinimisExemptApplied: boolean;
  preferentialAgreementApplied: boolean;
  totalLineDutyAndTaxCents: number;
}

export interface ManifestDutyAssessmentResult {
  manifestId: string;
  brokerId: string;
  settlementCurrency: CurrencyIsoCode;
  totalCifValuationCents: number;
  totalBaseDutyCents: number;
  totalAntiDumpingAndCvdCents: number;
  totalPortAndProcessingFeesCents: number;
  totalPayableDutyCents: number;
  deferredBondedDutyCents: number;
  immediateCashDutyCents: number;
  lineAssessments: CalculatedLineItemDuty[];
  warnings: string[];
}

export const ManifestLineItemSchema = z.object({
  lineId: z.string().min(1),
  hsCode: z.string().regex(/^\d{6}$/, 'HS code must be a 6-digit numeric string'),
  description: z.string().min(2),
  countryOfOriginIso2: z.string().length(2),
  fobValueMinorUnits: z.number().int().nonnegative(),
  oceanFreightMinorUnits: z.number().int().nonnegative(),
  marineInsuranceMinorUnits: z.number().int().nonnegative(),
  sourceCurrency: z.enum(['USD', 'EUR', 'GBP', 'SGD', 'JPY', 'CAD']),
  netWeightKg: z.number().positive(),
  grossWeightKg: z.number().positive(),
  quantityUnits: z.number().int().positive(),
  claimedAgreement: z.enum([
    'NONE',
    'USMCA_NAFTA_CERTIFIED',
    'EU_UK_TCA_ORIGIN',
    'ASEAN_FTA_FORM_D',
    'CPTPP_CERTIFIED_ORIGIN',
  ]),
  certificateOfOriginVerified: z.boolean(),
});

export const CustomsManifestDutyInputSchema = z.object({
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
  settlementCurrency: z.enum(['USD', 'EUR', 'GBP', 'SGD', 'JPY', 'CAD']),
  entryDateIso: z.string().datetime(),
  portOfEntryCode: z.string().min(3).max(10),
  isBondedWarehouseEntry: z.boolean(),
  lineItems: z.array(ManifestLineItemSchema).min(1),
});

/**
 * Standard Harmonized System (HS) Tariff Schedule table.
 */
export const DEFAULT_HS_TARIFF_SCHEDULE: Readonly<
  Record<string, HsTariffScheduleEntry>
> = {
  '854231': {
    hsCode: '854231',
    description: 'Electronic integrated circuits: processors and controllers',
    category: 'ELECTRONICS_SEMICONDUCTORS',
    adValoremRateBps: 250, // 2.50%
    specificDutyCentsPerKg: 0,
    antiDumpingSurchargeBps: 1500, // 15.00%
    countervailingDutyBps: 0,
    eligibleAgreements: ['USMCA_NAFTA_CERTIFIED', 'CPTPP_CERTIFIED_ORIGIN'],
    preferentialReductionFactor: 0.0,
    requiresImportLicense: false,
  },
  '847150': {
    hsCode: '847150',
    description: 'Automatic data processing machines and rack server units',
    category: 'INDUSTRIAL_MACHINERY',
    adValoremRateBps: 400, // 4.00%
    specificDutyCentsPerKg: 120, // $1.20 / kg
    antiDumpingSurchargeBps: 0,
    countervailingDutyBps: 0,
    eligibleAgreements: [
      'USMCA_NAFTA_CERTIFIED',
      'EU_UK_TCA_ORIGIN',
      'CPTPP_CERTIFIED_ORIGIN',
    ],
    preferentialReductionFactor: 0.0,
    requiresImportLicense: false,
  },
  '620342': {
    hsCode: '620342',
    description: 'Woven cotton trousers and industrial workwear',
    category: 'TEXTILES_APPAREL',
    adValoremRateBps: 1650, // 16.50%
    specificDutyCentsPerKg: 45, // $0.45 / kg
    antiDumpingSurchargeBps: 0,
    countervailingDutyBps: 300, // 3.00%
    eligibleAgreements: ['USMCA_NAFTA_CERTIFIED', 'ASEAN_FTA_FORM_D'],
    preferentialReductionFactor: 0.25, // 75% discount, 25% of base rate remains
    requiresImportLicense: false,
  },
  '870830': {
    hsCode: '870830',
    description: 'Brakes and servo-brakes and parts thereof for motor vehicles',
    category: 'AUTOMOTIVE_COMPONENTS',
    adValoremRateBps: 600, // 6.00%
    specificDutyCentsPerKg: 85,
    antiDumpingSurchargeBps: 800, // 8.00%
    countervailingDutyBps: 200, // 2.00%
    eligibleAgreements: ['USMCA_NAFTA_CERTIFIED', 'EU_UK_TCA_ORIGIN'],
    preferentialReductionFactor: 0.0,
    requiresImportLicense: false,
  },
  '720851': {
    hsCode: '720851',
    description: 'Flat-rolled products of iron or non-alloy steel, plates > 10mm',
    category: 'STEEL_ALUMINUM_METALS',
    adValoremRateBps: 1000, // 10.00%
    specificDutyCentsPerKg: 210, // $2.10 / kg
    antiDumpingSurchargeBps: 2500, // 25.00% Section 232 / Anti-dumping
    countervailingDutyBps: 500, // 5.00%
    eligibleAgreements: ['USMCA_NAFTA_CERTIFIED'],
    preferentialReductionFactor: 0.5,
    requiresImportLicense: true,
  },
  '300490': {
    hsCode: '300490',
    description: 'Medicaments consisting of mixed or unmixed products for retail',
    category: 'PHARMACEUTICAL_MEDICAL',
    adValoremRateBps: 150, // 1.50%
    specificDutyCentsPerKg: 0,
    antiDumpingSurchargeBps: 0,
    countervailingDutyBps: 0,
    eligibleAgreements: [
      'USMCA_NAFTA_CERTIFIED',
      'EU_UK_TCA_ORIGIN',
      'CPTPP_CERTIFIED_ORIGIN',
    ],
    preferentialReductionFactor: 0.0,
    requiresImportLicense: true,
  },
  '090121': {
    hsCode: '090121',
    description: 'Roasted coffee, not decaffeinated, bulk industrial sacks',
    category: 'AGRICULTURAL_PRODUCE',
    adValoremRateBps: 320, // 3.20%
    specificDutyCentsPerKg: 30,
    antiDumpingSurchargeBps: 0,
    countervailingDutyBps: 0,
    eligibleAgreements: ['ASEAN_FTA_FORM_D', 'USMCA_NAFTA_CERTIFIED'],
    preferentialReductionFactor: 0.0,
    requiresImportLicense: false,
  },
};

/**
 * Deterministic reference exchange rates relative to USD (1.00 USD in minor units).
 * Note: JPY is a zero-decimal currency in standard ISO, but internal minor units here
 * are normalized to USD cents using fixed conversion ratios.
 */
const FX_RATES_TO_USD: Readonly<Record<CurrencyIsoCode, number>> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  SGD: 0.74,
  CAD: 0.73,
  JPY: 0.0067,
};

/**
 * De-minimis threshold in USD cents ($800.00 = 80,000 cents).
 * Shipments whose aggregate valuation is at or below this threshold are exempt from base duty.
 */
export const DE_MINIMIS_THRESHOLD_USD_CENTS = 80_000;

/**
 * Merchandise Processing Fee (MPF) parameters in USD cents:
 * 0.3464% (34.64 bps) of CIF value, subject to a per-manifest floor ($31.67) and cap ($614.35).
 */
export const MPF_RATE_BPS = 34.64;
export const MPF_MIN_USD_CENTS = 3_167;
export const MPF_MAX_USD_CENTS = 61_435;

/**
 * Harbor Maintenance Fee (HMF) rate: 0.125% (12.5 bps) of CIF value.
 */
export const HMF_RATE_BPS = 12.5;

export class CustomsDutyCalculator {
  private readonly tariffSchedule: Record<string, HsTariffScheduleEntry>;

  constructor(
    customSchedule: Readonly<
      Record<string, HsTariffScheduleEntry>
    > = DEFAULT_HS_TARIFF_SCHEDULE
  ) {
    this.tariffSchedule = { ...customSchedule };
  }

  /**
   * Converts an amount from a source currency to a target settlement currency using cross-rates.
   */
  public convertCurrencyCents(
    amountMinorUnits: number,
    fromCurrency: CurrencyIsoCode,
    toCurrency: CurrencyIsoCode
  ): { convertedCents: number; appliedRate: number } {
    if (fromCurrency === toCurrency) {
      return { convertedCents: amountMinorUnits, appliedRate: 1.0 };
    }

    const fromToUsd = FX_RATES_TO_USD[fromCurrency];
    const toToUsd = FX_RATES_TO_USD[toCurrency];

    if (!fromToUsd || !toToUsd) {
      throw new Error(
        `Unsupported currency conversion pair: ${fromCurrency} -> ${toCurrency}`
      );
    }

    const crossRate = fromToUsd / toToUsd;
    const convertedCents = Math.round(amountMinorUnits * crossRate);

    return {
      convertedCents,
      appliedRate: Number(crossRate.toFixed(6)),
    };
  }

  /**
   * Validates whether a claimed Preferential Trade Agreement is valid for the given corridor and HS entry.
   */
  public isPreferentialOriginValid(
    line: ManifestLineItemInput,
    scheduleEntry: HsTariffScheduleEntry,
    corridor: TradeCorridorCode
  ): boolean {
    if (
      line.claimedAgreement === 'NONE' ||
      !line.certificateOfOriginVerified
    ) {
      return false;
    }

    if (!scheduleEntry.eligibleAgreements.includes(line.claimedAgreement)) {
      return false;
    }

    if (
      line.claimedAgreement === 'USMCA_NAFTA_CERTIFIED' &&
      corridor !== 'MX_US_NAFTA'
    ) {
      return false;
    }

    if (
      line.claimedAgreement === 'EU_UK_TCA_ORIGIN' &&
      corridor !== 'EU_UK_CHANNEL' &&
      corridor !== 'US_EU_ATLANTIC'
    ) {
      return false;
    }

    if (
      line.claimedAgreement === 'ASEAN_FTA_FORM_D' &&
      corridor !== 'SG_IN_MALACCA'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Computes full customs duties, trade remedies (AD/CVD), and port fees for a manifest.
   */
  public assessManifestDuties(
    rawInput: CustomsManifestDutyInput
  ): ManifestDutyAssessmentResult {
    const parsed = CustomsManifestDutyInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(
        `Invalid customs manifest payload: ${parsed.error.issues
          .map((i) => i.message)
          .join(', ')}`
      );
    }

    const input = parsed.data;
    const warnings: string[] = [];
    const lineAssessments: CalculatedLineItemDuty[] = [];

    let totalCifValuationCents = 0;
    let totalBaseDutyCents = 0;
    let totalAntiDumpingAndCvdCents = 0;
    let totalPortAndProcessingFeesCents = 0;

    const deMinimisInSettlementCents = this.convertCurrencyCents(
      DE_MINIMIS_THRESHOLD_USD_CENTS,
      'USD',
      input.settlementCurrency
    ).convertedCents;

    for (const line of input.lineItems) {
      const schedule = this.tariffSchedule[line.hsCode];
      if (!schedule) {
        throw new Error(
          `Unrecognized Harmonized System (HS) code ${line.hsCode} on line ${line.lineId}`
        );
      }

      if (line.grossWeightKg < line.netWeightKg) {
        warnings.push(
          `Line ${line.lineId}: grossWeightKg (${line.grossWeightKg}) is less than netWeightKg (${line.netWeightKg})`
        );
      }

      const rawCifMinorUnits =
        line.fobValueMinorUnits +
        line.oceanFreightMinorUnits +
        line.marineInsuranceMinorUnits;

      const { convertedCents: cifSettlementCents, appliedRate } =
        this.convertCurrencyCents(
          rawCifMinorUnits,
          line.sourceCurrency,
          input.settlementCurrency
        );

      totalCifValuationCents += cifSettlementCents;

      // Subtle bug 1: De-minimis exemption is evaluated per line item instead of
      // across the aggregate manifest CIF total, allowing split-line manifests to evade duty!
      const isDeMinimisExempt = cifSettlementCents <= deMinimisInSettlementCents;

      const preferentialApplied = this.isPreferentialOriginValid(
        line,
        schedule,
        input.corridor
      );

      const reductionMultiplier = preferentialApplied
        ? schedule.preferentialReductionFactor
        : 1.0;

      let baseAdValoremDutyCents = 0;
      let specificWeightDutyCents = 0;
      let antiDumpingDutyCents = 0;
      let countervailingDutyCents = 0;

      if (!isDeMinimisExempt) {
        const rawAdValoremCents =
          (cifSettlementCents * schedule.adValoremRateBps) / 10_000;
        baseAdValoremDutyCents = Math.round(
          rawAdValoremCents * reductionMultiplier
        );

        const rawSpecificUsdCents = Math.round(
          line.netWeightKg * schedule.specificDutyCentsPerKg
        );
        const specificInSettlement = this.convertCurrencyCents(
          rawSpecificUsdCents,
          'USD',
          input.settlementCurrency
        ).convertedCents;

        specificWeightDutyCents = Math.round(
          specificInSettlement * reductionMultiplier
        );

        // Subtle bug 2: Preferential Trade Agreements (FTAs) only reduce general MFN
        // ad-valorem and specific duties, NEVER punitive Anti-Dumping (AD) or Countervailing (CVD)
        // trade remedy duties. However, reductionMultiplier is mistakenly applied to AD Duty here!
        antiDumpingDutyCents = Math.round(
          ((cifSettlementCents * schedule.antiDumpingSurchargeBps) / 10_000) *
            reductionMultiplier
        );

        countervailingDutyCents = Math.round(
          (cifSettlementCents * schedule.countervailingDutyBps) / 10_000
        );
      }

      const mpfRawCents = Math.round(
        (cifSettlementCents * MPF_RATE_BPS) / 10_000
      );
      const hmfCents = isDeMinimisExempt
        ? 0
        : Math.round((cifSettlementCents * HMF_RATE_BPS) / 10_000);

      const mpfMinSettlement = this.convertCurrencyCents(
        MPF_MIN_USD_CENTS,
        'USD',
        input.settlementCurrency
      ).convertedCents;
      const mpfMaxSettlement = this.convertCurrencyCents(
        MPF_MAX_USD_CENTS,
        'USD',
        input.settlementCurrency
      ).convertedCents;

      const merchandiseProcessingFeeCents = isDeMinimisExempt
        ? 0
        : Math.min(mpfMaxSettlement, Math.max(mpfMinSettlement, mpfRawCents));

      const totalLineDutyAndTaxCents =
        baseAdValoremDutyCents +
        specificWeightDutyCents +
        antiDumpingDutyCents +
        countervailingDutyCents +
        merchandiseProcessingFeeCents +
        hmfCents;

      totalBaseDutyCents += baseAdValoremDutyCents + specificWeightDutyCents;
      totalAntiDumpingAndCvdCents +=
        antiDumpingDutyCents + countervailingDutyCents;
      totalPortAndProcessingFeesCents +=
        merchandiseProcessingFeeCents + hmfCents;

      lineAssessments.push({
        lineId: line.lineId,
        hsCode: line.hsCode,
        category: schedule.category,
        cifValueSettlementCents: cifSettlementCents,
        appliedFxRate: appliedRate,
        baseAdValoremDutyCents,
        specificWeightDutyCents,
        antiDumpingDutyCents,
        countervailingDutyCents,
        merchandiseProcessingFeeCents,
        harborMaintenanceFeeCents: hmfCents,
        deMinimisExemptApplied: isDeMinimisExempt,
        preferentialAgreementApplied: preferentialApplied,
        totalLineDutyAndTaxCents,
      });
    }

    const totalPayableDutyCents =
      totalBaseDutyCents +
      totalAntiDumpingAndCvdCents +
      totalPortAndProcessingFeesCents;

    // For bonded warehouse entries, base customs duties are deferred until withdrawal,
    // whereas port maintenance/processing fees and punitive AD/CVD remedies are payable on entry.
    const deferredBondedDutyCents = input.isBondedWarehouseEntry
      ? totalBaseDutyCents
      : 0;
    const immediateCashDutyCents =
      totalPayableDutyCents - deferredBondedDutyCents;

    return {
      manifestId: input.manifestId,
      brokerId: input.brokerId,
      settlementCurrency: input.settlementCurrency,
      totalCifValuationCents,
      totalBaseDutyCents,
      totalAntiDumpingAndCvdCents,
      totalPortAndProcessingFeesCents,
      totalPayableDutyCents,
      deferredBondedDutyCents,
      immediateCashDutyCents,
      lineAssessments,
      warnings,
    };
  }
}