import { NextResponse } from 'next/server';
import { getBrokerageContainer } from '@/lib/store/broker-singleton';

export async function GET() {
  const container = getBrokerageContainer();
  const brokers = container.brokerRegistry.listBrokers();

  const activeBrokersCount = brokers.filter((b) => b.status === 'ACTIVE').length;
  const restrictedOrHoldCount = brokers.filter(
    (b) => b.status !== 'ACTIVE'
  ).length;

  return NextResponse.json(
    {
      status: 'ok',
      service: 'nextjs-freight-customs-brokerage',
      bootstrappedAtIso: container.bootstrappedAtIso,
      metrics: {
        registeredBrokers: brokers.length,
        activeBrokersCount,
        restrictedOrHoldCount,
      },
    },
    { status: 200 }
  );
}