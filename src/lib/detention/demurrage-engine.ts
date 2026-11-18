import { z } from 'zod';
import { CurrencyIsoCode } from '../tenants/broker-registry';

export type ContainerEquipmentType =
  | 'DRY_20FT_STANDARD'
  | 'DRY_40FT_HIGH_CUBE'
  | 'REEFER_40FT_TEMPERATURE_CONTROLLED'
  | 'ISO_TANK_HAZMAT'
  | 'FLAT_RACK_OVERSIZE';

export type PortExemptionReason =
  | 'PORT_HOLIDAY'
  | 'SEVERE_WEATHER_FORCE_MAJEURE'
  | 'TERMINAL_CRANE_OUTAGE'
  | 'CUSTOMS_INTENSIVE_XRAY_HOLD';

export interface PortCalendarExemptionDay {
  dateYmd: string; // "YYYY-MM-DD" in UTC
  portCode: string;
  reason: PortExemptionReason;
  appliesDuringFreeTime: boolean;
  appliesDuringPenaltyPhase: boolean;
}

export interface EquipmentDemurrageRateCard {
  equipmentType: ContainerEquipmentType;
  standardFreeDays: number;
  weekendCountsDuringFreeTime: boolean;
  weekendCountsDuringPenalty: boolean;
  tier1DaysRange: [number, number]; // e.g., chargeable day 1 to 5
  tier1DailyRateUsdCents: number;
  tier2DaysRange: [number, number]; // e.g., chargeable day 6 to 10
  tier2DailyRateUsdCents: number;
  tier3DailyRateUsdCents: number; // chargeable day 11+
  reeferPowerPlugDailyUsdCents: number;
}

export interface ContainerStayInput {
  containerNumber: string; // ISO 6346 format e.g. "MSCU1234567"
  manifestId: string;
  brokerId: string;
  portCode: string;
  equipmentType: ContainerEquipmentType;
  vesselDischargedAtIso: string;
  gateOutCompletedAtIso: string;
  settlementCurrency: CurrencyIsoCode;
  customsHoldDaysCount: number;
  promotionalWaiverCents: number;
}

export interface DailyDemurrageBreakdown {
  dateYmd: string;
  daySequenceIndex: number;
  isWeekend: boolean;
  exemptionApplied?: PortExemptionReason;
  status: 'FREE_TIME' | 'EXEMPT_DAY' | 'TIER_1' | 'TIER_2' | 'TIER_3';
  chargeableIndex: number;
  baseDemurrageUsdCents: number;
  auxiliaryReeferUsdCents: number;
  totalDayUsdCents: number;
}

export interface ContainerDemurrageAssessment {
  containerNumber: string;
  manifestId: string;
  brokerId: string;
  equipmentType: ContainerEquipmentType;
  totalCalendarDaysInPort: number;
  grantedFreeDays: number;
  exemptDaysCount: number;
  chargeableDemurrageDays: number;
  grossDemurrageUsdCents: number;
  auxiliaryReeferTotalUsdCents: number;
  appliedWaiverUsdCents: number;
  netPayableDemurrageUsdCents: number;
  dailySchedule: DailyDemurrageBreakdown[];
}

export const ContainerStayInputSchema = z.object({
  containerNumber: z
    .string()
    .regex(/^[A-Z]{4}\d{7}$/, 'Container number must match ISO 6346 (4 letters + 7 digits)'),
  manifestId: z.string().min(6),
  brokerId: z.string().min(4),
  portCode: z.string().min(3).max(10),
  equipmentType: z.enum([
    'DRY_20FT_STANDARD',
    'DRY_40FT_HIGH_CUBE',
    'REEFER_40FT_TEMPERATURE_CONTROLLED',
    'ISO_TANK_HAZMAT',
    'FLAT_RACK_OVERSIZE',
  ]),
  vesselDischargedAtIso: z.string().datetime(),
  gateOutCompletedAtIso: z.string().datetime(),
  settlementCurrency: z.enum(['USD', 'EUR', 'GBP', 'SGD', 'JPY', 'CAD']),
  customsHoldDaysCount: z.number().int().nonnegative(),
  promotionalWaiverCents: z.number().int().nonnegative(),
});

export const DEFAULT_EQUIPMENT_RATE_CARDS: Readonly<
  Record<ContainerEquipmentType, EquipmentDemurrageRateCard>
> = {
  DRY_20FT_STANDARD: {
    equipmentType: 'DRY_20FT_STANDARD',
    standardFreeDays: 4,
    weekendCountsDuringFreeTime: false,
    weekendCountsDuringPenalty: true,
    tier1DaysRange: [1, 5],
    tier1DailyRateUsdCents: 16_500, // $165.00/day
    tier2DaysRange: [6, 10],
    tier2DailyRateUsdCents: 24_000, // $240.00/day
    tier3DailyRateUsdCents: 35_000, // $350.00/day
    reeferPowerPlugDailyUsdCents: 0,
  },
  DRY_40FT_HIGH_CUBE: {
    equipmentType: 'DRY_40FT_HIGH_CUBE',
    standardFreeDays: 4,
    weekendCountsDuringFreeTime: false,
    weekendCountsDuringPenalty: true,
    tier1DaysRange: [1, 5],
    tier1DailyRateUsdCents: 22_000, // $220.00/day
    tier2DaysRange: [6, 10],
    tier2DailyRateUsdCents: 31_000, // $310.00/day
    tier3DailyRateUsdCents: 44_000, // $440.00/day
    reeferPowerPlugDailyUsdCents: 0,
  },
  REEFER_40FT_TEMPERATURE_CONTROLLED: {
    equipmentType: 'REEFER_40FT_TEMPERATURE_CONTROLLED',
    standardFreeDays: 3,
    weekendCountsDuringFreeTime: false,
    weekendCountsDuringPenalty: true,
    tier1DaysRange: [1, 4],
    tier1DailyRateUsdCents: 38_000, // $380.00/day
    tier2DaysRange: [5, 8],
    tier2DailyRateUsdCents: 52_000, // $520.00/day
    tier3DailyRateUsdCents: 70_000, // $700.00/day
    reeferPowerPlugDailyUsdCents: 9_500, // $95.00/day shore power
  },
  ISO_TANK_HAZMAT: {
    equipmentType: 'ISO_TANK_HAZMAT',
    standardFreeDays: 2,
    weekendCountsDuringFreeTime: true,
    weekendCountsDuringPenalty: true,
    tier1DaysRange: [1, 3],
    tier1DailyRateUsdCents: 45_000, // $450.00/day
    tier2DaysRange: [4, 7],
    tier2DailyRateUsdCents: 65_000, // $650.00/day
    tier3DailyRateUsdCents: 90_000, // $900.00/day
    reeferPowerPlugDailyUsdCents: 0,
  },
  FLAT_RACK_OVERSIZE: {
    equipmentType: 'FLAT_RACK_OVERSIZE',
    standardFreeDays: 3,
    weekendCountsDuringFreeTime: false,
    weekendCountsDuringPenalty: true,
    tier1DaysRange: [1, 5],
    tier1DailyRateUsdCents: 32_000, // $320.00/day
    tier2DaysRange: [6, 10],
    tier2DailyRateUsdCents: 46_000, // $460.00/day
    tier3DailyRateUsdCents: 62_000, // $620.00/day
    reeferPowerPlugDailyUsdCents: 0,
  },
};

export const DEFAULT_PORT_EXEMPTIONS: ReadonlyArray<PortCalendarExemptionDay> = [
  {
    dateYmd: '2025-01-01',
    portCode: 'USLAX',
    reason: 'PORT_HOLIDAY',
    appliesDuringFreeTime: true,
    appliesDuringPenaltyPhase: false,
  },
  {
    dateYmd: '2025-01-20',
    portCode: 'USLAX',
    reason: 'PORT_HOLIDAY',
    appliesDuringFreeTime: true,
    appliesDuringPenaltyPhase: false,
  },
  {
    dateYmd: '2025-02-14',
    portCode: 'USLAX',
    reason: 'SEVERE_WEATHER_FORCE_MAJEURE',
    appliesDuringFreeTime: true,
    appliesDuringPenaltyPhase: true,
  },
  {
    dateYmd: '2025-02-15',
    portCode: 'USLAX',
    reason: 'TERMINAL_CRANE_OUTAGE',
    appliesDuringFreeTime: true,
    appliesDuringPenaltyPhase: true,
  },
  {
    dateYmd: '2025-01-01',
    portCode: 'NLRTM',
    reason: 'PORT_HOLIDAY',
    appliesDuringFreeTime: true,
    appliesDuringPenaltyPhase: false,
  },
];

export class DemurrageCalculationEngine {
  private readonly rateCards: Record<
    ContainerEquipmentType,
    EquipmentDemurrageRateCard
  >;
  private readonly portExemptions: PortCalendarExemptionDay[];

  constructor(
    rateCards: Readonly<
      Record<ContainerEquipmentType, EquipmentDemurrageRateCard>
    > = DEFAULT_EQUIPMENT_RATE_CARDS,
    portExemptions: ReadonlyArray<PortCalendarExemptionDay> = DEFAULT_PORT_EXEMPTIONS
  ) {
    this.rateCards = { ...rateCards };
    this.portExemptions = [...portExemptions];
  }

  /**
   * Enumerates UTC calendar days (`YYYY-MM-DD`) inclusive between start and end timestamps.
   */
  public enumerateUtcCalendarDays(
    startIso: string,
    endIso: string
  ): Array<{ dateYmd: string; isWeekend: boolean }> {
    const startMs = Date.parse(startIso);
    const endMs = Date.parse(endIso);

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      throw new Error('Invalid ISO timestamp provided for container stay');
    }

    if (endMs < startMs) {
      throw new Error(
        `gateOutCompletedAtIso (${endIso}) cannot precede vesselDischargedAtIso (${startIso})`
      );
    }

    const startDate = new Date(startMs);
    const cursor = Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    );

    const endDate = new Date(endMs);
    const lastDayUtc = Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate()
    );

    const days: Array<{ dateYmd: string; isWeekend: boolean }> = [];
    const oneDayMs = 86_400_000;

    for (let current = cursor; current <= lastDayUtc; current += oneDayMs) {
      const dt = new Date(current);
      const dayOfWeek = dt.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dateYmd = dt.toISOString().slice(0, 10);
      days.push({ dateYmd, isWeekend });
    }

    return days;
  }

  private findPortExemption(
    portCode: string,
    dateYmd: string
  ): PortCalendarExemptionDay | undefined {
    return this.portExemptions.find(
      (ex) => ex.portCode === portCode && ex.dateYmd === dateYmd
    );
  }

  /**
   * Resolves the daily demurrage rate and tier label for a specific chargeable day index (1-based).
   */
  public resolveTierForChargeableDay(
    rateCard: EquipmentDemurrageRateCard,
    chargeableDayIndex: number
  ): {
    tier: 'TIER_1' | 'TIER_2' | 'TIER_3';
    dailyRateUsdCents: number;
  } {
    if (
      chargeableDayIndex >= rateCard.tier1DaysRange[0] &&
      chargeableDayIndex <= rateCard.tier1DaysRange[1]
    ) {
      return {
        tier: 'TIER_1',
        dailyRateUsdCents: rateCard.tier1DailyRateUsdCents,
      };
    }

    if (
      chargeableDayIndex >= rateCard.tier2DaysRange[0] &&
      chargeableDayIndex <= rateCard.tier2DaysRange[1]
    ) {
      return {
        tier: 'TIER_2',
        dailyRateUsdCents: rateCard.tier2DailyRateUsdCents,
      };
    }

    return {
      tier: 'TIER_3',
      dailyRateUsdCents: rateCard.tier3DailyRateUsdCents,
    };
  }

  /**
   * Calculates full container detention and demurrage schedule, exemptions, and net payable charges.
   */
  public calculateContainerDemurrage(
    rawInput: ContainerStayInput
  ): ContainerDemurrageAssessment {
    const parsed = ContainerStayInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new Error(
        `Invalid container stay input: ${parsed.error.issues
          .map((i) => i.message)
          .join(', ')}`
      );
    }

    const input = parsed.data;
    const rateCard = this.rateCards[input.equipmentType];
    if (!rateCard) {
      throw new Error(`Missing rate card for equipment ${input.equipmentType}`);
    }

    const calendarDays = this.enumerateUtcCalendarDays(
      input.vesselDischargedAtIso,
      input.gateOutCompletedAtIso
    );

    const dailySchedule: DailyDemurrageBreakdown[] = [];
    let freeDaysConsumed = 0;
    let exemptDaysCount = 0;
    let chargeableDemurrageDays = 0;
    let grossDemurrageUsdCents = 0;
    let auxiliaryReeferTotalUsdCents = 0;

    for (let i = 0; i < calendarDays.length; i++) {
      const { dateYmd, isWeekend } = calendarDays[i];
      const daySequenceIndex = i + 1;
      const inFreeTimeWindow = freeDaysConsumed < rateCard.standardFreeDays;
      const portExemption = this.findPortExemption(input.portCode, dateYmd);

      // Check if weekend is excluded during free time
      if (
        inFreeTimeWindow &&
        isWeekend &&
        !rateCard.weekendCountsDuringFreeTime
      ) {
        exemptDaysCount++;
        dailySchedule.push({
          dateYmd,
          daySequenceIndex,
          isWeekend,
          status: 'EXEMPT_DAY',
          chargeableIndex: 0,
          baseDemurrageUsdCents: 0,
          auxiliaryReeferUsdCents: 0,
          totalDayUsdCents: 0,
        });
        continue;
      }

      // Check if port holiday or force majeure exemption applies
      if (portExemption) {
        const applies = inFreeTimeWindow
          ? portExemption.appliesDuringFreeTime
          : portExemption.appliesDuringPenaltyPhase;

        if (applies) {
          exemptDaysCount++;
          dailySchedule.push({
            dateYmd,
            daySequenceIndex,
            isWeekend,
            exemptionApplied: portExemption.reason,
            status: 'EXEMPT_DAY',
            chargeableIndex: 0,
            baseDemurrageUsdCents: 0,
            auxiliaryReeferUsdCents: 0,
            totalDayUsdCents: 0,
          });
          continue;
        }
      }

      if (inFreeTimeWindow) {
        freeDaysConsumed++;
        dailySchedule.push({
          dateYmd,
          daySequenceIndex,
          isWeekend,
          status: 'FREE_TIME',
          chargeableIndex: 0,
          baseDemurrageUsdCents: 0,
          auxiliaryReeferUsdCents: 0,
          totalDayUsdCents: 0,
        });
        continue;
      }

      // Penalty phase: check if weekend is exempt during penalty phase
      if (isWeekend && !rateCard.weekendCountsDuringPenalty) {
        exemptDaysCount++;
        dailySchedule.push({
          dateYmd,
          daySequenceIndex,
          isWeekend,
          status: 'EXEMPT_DAY',
          chargeableIndex: 0,
          baseDemurrageUsdCents: 0,
          auxiliaryReeferUsdCents: 0,
          totalDayUsdCents: 0,
        });
        continue;
      }

      chargeableDemurrageDays++;
      const { tier, dailyRateUsdCents } = this.resolveTierForChargeableDay(
        rateCard,
        chargeableDemurrageDays
      );

      const reeferPlugCents = rateCard.reeferPowerPlugDailyUsdCents;
      const totalDayUsdCents = dailyRateUsdCents + reeferPlugCents;

      grossDemurrageUsdCents += dailyRateUsdCents;
      auxiliaryReeferTotalUsdCents += reeferPlugCents;

      dailySchedule.push({
        dateYmd,
        daySequenceIndex,
        isWeekend,
        status: tier,
        chargeableIndex: chargeableDemurrageDays,
        baseDemurrageUsdCents: dailyRateUsdCents,
        auxiliaryReeferUsdCents: reeferPlugCents,
        totalDayUsdCents,
      });
    }

    // Subtle bug: promotionalWaiverCents can reduce netPayableDemurrageUsdCents,
    // and customsHoldDaysCount is supposed to deduct from chargeable penalty days (or credit back Tier 1 rate),
    // but customsHoldDaysCount is completely ignored in the final net calculation!
    const totalGrossAndReeferCents =
      grossDemurrageUsdCents + auxiliaryReeferTotalUsdCents;
    const appliedWaiverUsdCents = Math.min(
      totalGrossAndReeferCents,
      input.promotionalWaiverCents
    );
    const netPayableDemurrageUsdCents =
      totalGrossAndReeferCents - appliedWaiverUsdCents;

    return {
      containerNumber: input.containerNumber,
      manifestId: input.manifestId,
      brokerId: input.brokerId,
      equipmentType: input.equipmentType,
      totalCalendarDaysInPort: calendarDays.length,
      grantedFreeDays: freeDaysConsumed,
      exemptDaysCount,
      chargeableDemurrageDays,
      grossDemurrageUsdCents,
      auxiliaryReeferTotalUsdCents,
      appliedWaiverUsdCents,
      netPayableDemurrageUsdCents,
      dailySchedule,
    };
  }
}