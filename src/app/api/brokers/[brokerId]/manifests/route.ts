import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBrokerageContainer } from '@/lib/store/broker-singleton';
import { CustomsManifestDutyInputSchema } from '@/lib/tariffs/duty-calculator';
import { ContainerStayInputSchema } from '@/lib/detention/demurrage-engine';

const SubmitManifestRequestSchema = z.object({
  manifestId: z.string().min(6),
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
  entryDateIso: z.string().datetime(),
  portOfEntryCode: z.string().min(3).max(10),
  isBondedWarehouseEntry: z.boolean(),
  lineItems: CustomsManifestDutyInputSchema.shape.lineItems,
  containerStay: ContainerStayInputSchema.omit({
    brokerId: true,
    manifestId: true,
    settlementCurrency: true,
  }).optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ brokerId: string }> }
) {
  const { brokerId } = await context.params;
  const container = getBrokerageContainer();

  const broker = container.brokerRegistry.getBroker(brokerId);
  if (!broker) {
    return NextResponse.json(
      { error: 'BROKER_NOT_FOUND', message: `Broker ${brokerId} does not exist` },
      { status: 404 }
    );
  }

  const ledgerSummary = container.ledgerJournal.getBrokerLedgerSummary(
    brokerId,
    broker.settlementCurrency
  );
  const recentEntries = container.ledgerJournal.listBrokerEntries(brokerId);

  return NextResponse.json(
    {
      broker: {
        brokerId: broker.brokerId,
        legalEntityName: broker.legalEntityName,
        status: broker.status,
        settlementCurrency: broker.settlementCurrency,
        creditLimitCents: broker.creditLimitCents,
        currentUtilizedCreditCents: broker.currentUtilizedCreditCents,
        unsettledDemurrageCents: broker.unsettledDemurrageCents,
        disputedHoldCents: broker.disputedHoldCents,
        availableCreditCents:
          container.brokerRegistry.calculateAvailableCreditCents(broker),
      },
      ledgerSummary,
      recentEntries,
    },
    { status: 200 }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ brokerId: string }> }
) {
  const { brokerId } = await context.params;
  const container = getBrokerageContainer();

  const broker = container.brokerRegistry.getBroker(brokerId);
  if (!broker) {
    return NextResponse.json(
      { error: 'BROKER_NOT_FOUND', message: `Broker ${brokerId} not found` },
      { status: 404 }
    );
  }

  const idempotencyKey = request.headers.get('x-idempotency-key');
  if (!idempotencyKey) {
    return NextResponse.json(
      {
        error: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Header x-idempotency-key is required for manifest submissions',
      },
      { status: 400 }
    );
  }

  const rawBodyText = await request.text();
  const signatureHeader = request.headers.get('x-broker-signature');
  const nowMs = Date.now();

  if (signatureHeader) {
    const sigCheck = container.idempotencyGuard.verifyHmacSignature({
      rawBody: rawBodyText,
      signatureHeader,
      webhookSigningToken: broker.webhookSigningToken,
      currentTimestampMs: nowMs,
    });

    if (!sigCheck.valid) {
      return NextResponse.json(
        {
          error: sigCheck.errorCode ?? 'INVALID_SIGNATURE',
          message: sigCheck.reason,
        },
        { status: 401 }
      );
    }
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  const validation = SubmitManifestRequestSchema.safeParse(parsedJson);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: 'VALIDATION_ERROR',
        issues: validation.error.issues,
      },
      { status: 422 }
    );
  }

  const payload = validation.data;
  const operationPath = `/api/brokers/${brokerId}/manifests`;

  const idempOutcome = container.idempotencyGuard.evaluateAndLock({
    brokerId,
    idempotencyKey,
    operationPath,
    payload,
    nowMs,
  });

  if (idempOutcome.decision === 'REPLAY_CACHED_RESPONSE') {
    return NextResponse.json(idempOutcome.entry.cachedResponse, {
      status: idempOutcome.entry.httpStatusCode ?? 200,
      headers: { 'x-idempotent-replay': 'true' },
    });
  }

  if (idempOutcome.decision === 'REJECT_PAYLOAD_FINGERPRINT_MISMATCH') {
    return NextResponse.json(
      {
        error: 'IDEMPOTENCY_KEY_REUSE_MISMATCH',
        message: idempOutcome.reason,
      },
      { status: 409 }
    );
  }

  if (idempOutcome.decision === 'REJECT_CONFLICT_IN_PROGRESS') {
    return NextResponse.json(
      {
        error: 'IDEMPOTENCY_IN_PROGRESS',
        message: idempOutcome.reason,
      },
      { status: 409 }
    );
  }

  try {
    const dutyAssessment = container.dutyCalculator.assessManifestDuties({
      manifestId: payload.manifestId,
      brokerId,
      corridor: payload.corridor,
      settlementCurrency: broker.settlementCurrency,
      entryDateIso: payload.entryDateIso,
      portOfEntryCode: payload.portOfEntryCode,
      isBondedWarehouseEntry: payload.isBondedWarehouseEntry,
      lineItems: payload.lineItems,
    });

    const demurrageAssessment = payload.containerStay
      ? container.demurrageEngine.calculateContainerDemurrage({
          ...payload.containerStay,
          brokerId,
          manifestId: payload.manifestId,
          settlementCurrency: broker.settlementCurrency,
        })
      : undefined;

    const estimatedDemurrageCents =
      demurrageAssessment?.netPayableDemurrageUsdCents ?? 0;

    const reservation = container.brokerRegistry.reserveCreditForManifest({
      brokerId,
      manifestId: payload.manifestId,
      dutyAmountCents: dutyAssessment.totalPayableDutyCents,
      estimatedDemurrageCents,
      corridor: payload.corridor,
      operationType: payload.operationType,
      requestedAtIso: payload.entryDateIso,
    });

    if (!reservation.approved) {
      container.idempotencyGuard.markRetryableFailure({
        brokerId,
        idempotencyKey,
        nowMs,
      });

      return NextResponse.json(
        {
          approved: false,
          rejectionCode: reservation.rejectionCode,
          reason: reservation.reason,
          dutyAssessment,
          demurrageAssessment,
        },
        { status: 403 }
      );
    }

    const ledgerEntries =
      container.ledgerJournal.recordManifestClearanceEntries({
        brokerId,
        manifestId: payload.manifestId,
        currency: broker.settlementCurrency,
        immediateCashDutyCents: dutyAssessment.immediateCashDutyCents,
        deferredBondedDutyCents: dutyAssessment.deferredBondedDutyCents,
        demurrageCents: estimatedDemurrageCents,
        containerNumber: payload.containerStay?.containerNumber,
        timestampIso: payload.entryDateIso,
      });

    const responsePayload = {
      approved: true,
      manifestId: payload.manifestId,
      brokerId,
      reservation,
      dutyAssessment,
      demurrageAssessment,
      ledgerEntries,
    };

    container.idempotencyGuard.commitSuccess({
      brokerId,
      idempotencyKey,
      httpStatusCode: 201,
      responseBody: responsePayload,
      nowMs,
    });

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (err) {
    container.idempotencyGuard.markRetryableFailure({
      brokerId,
      idempotencyKey,
      nowMs,
    });

    const message =
      err instanceof Error ? err.message : 'Unexpected manifest processing error';
    return NextResponse.json(
      { error: 'MANIFEST_PROCESSING_FAILED', message },
      { status: 500 }
    );
  }
}