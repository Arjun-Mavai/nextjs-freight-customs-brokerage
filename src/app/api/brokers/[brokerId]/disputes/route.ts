import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getBrokerageContainer } from '@/lib/store/broker-singleton';
import {
  CreateDisputeInputSchema,
  ResolveDisputeInputSchema,
} from '@/lib/store/ledger-journal';

const DisputeActionPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('OPEN_DISPUTE'),
    payload: CreateDisputeInputSchema.omit({ brokerId: true }),
  }),
  z.object({
    action: z.literal('RESOLVE_DISPUTE'),
    payload: ResolveDisputeInputSchema.omit({ brokerId: true }),
  }),
]);

export async function GET(
  _request: NextRequest,
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

  const disputes = container.ledgerJournal.listBrokerDisputes(brokerId);
  return NextResponse.json(
    {
      brokerId,
      disputedHoldCents: broker.disputedHoldCents,
      disputes,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Request body must be valid JSON' },
      { status: 400 }
    );
  }

  const parsed = DisputeActionPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    if (parsed.data.action === 'OPEN_DISPUTE') {
      const { payload } = parsed.data;
      const result = container.ledgerJournal.openDisputeClaim({
        ...payload,
        brokerId,
      });

      const updatedBroker = container.brokerRegistry.adjustBrokerExposure({
        brokerId,
        dutyDeltaCents: 0,
        demurrageDeltaCents: 0,
        disputedHoldDeltaCents: payload.claimedReductionCents,
        bondEncumbranceDeltaCents: 0,
        timestampIso: payload.openedAtIso,
      });

      return NextResponse.json(
        {
          action: 'OPEN_DISPUTE',
          dispute: result.dispute,
          holdEntry: result.holdEntry,
          brokerDisputedHoldCents: updatedBroker.disputedHoldCents,
        },
        { status: 201 }
      );
    }

    const { payload } = parsed.data;
    const resolution = container.ledgerJournal.resolveDisputeClaim({
      ...payload,
      brokerId,
    });

    const updatedBroker = container.brokerRegistry.adjustBrokerExposure({
      brokerId,
      dutyDeltaCents: -payload.approvedReductionCents,
      demurrageDeltaCents: 0,
      disputedHoldDeltaCents: -resolution.releasedHoldCents,
      bondEncumbranceDeltaCents: 0,
      timestampIso: payload.resolvedAtIso,
    });

    return NextResponse.json(
      {
        action: 'RESOLVE_DISPUTE',
        dispute: resolution.dispute,
        settlementEntry: resolution.settlementEntry,
        brokerDisputedHoldCents: updatedBroker.disputedHoldCents,
      },
      { status: 200 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Dispute operation failed';
    return NextResponse.json(
      { error: 'DISPUTE_OPERATION_ERROR', message },
      { status: 400 }
    );
  }
}