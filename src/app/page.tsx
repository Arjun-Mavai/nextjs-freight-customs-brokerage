import { getBrokerageContainer } from '@/lib/store/broker-singleton';
import { DEFAULT_HS_TARIFF_SCHEDULE } from '@/lib/tariffs/duty-calculator';

export default function FreightCustomsBrokerageDashboard() {
  const container = getBrokerageContainer();
  const brokers = container.brokerRegistry.listBrokers();
  const hsEntries = Object.values(DEFAULT_HS_TARIFF_SCHEDULE);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Cross-Border Freight & Customs Brokerage Clearing Hub
          </h1>
          <p className="text-slate-400 mt-2">
            Multi-tenant customs tariff calculation, surety bond encumbrance, port
            container demurrage engine, and bonded warehouse ledger.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-200">
            Registered Customs Broker Tenants (Synthetic Profiles)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {brokers.map((broker) => {
              const availableCents =
                container.brokerRegistry.calculateAvailableCreditCents(broker);
              return (
                <div
                  key={broker.brokerId}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-sky-400">
                      {broker.brokerId}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-200">
                      {broker.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium">{broker.legalEntityName}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Credit Limit</span>
                      {(broker.creditLimitCents / 100).toLocaleString()}{' '}
                      {broker.settlementCurrency}
                    </div>
                    <div>
                      <span className="text-slate-500 block">Available Credit</span>
                      {(availableCents / 100).toLocaleString()}{' '}
                      {broker.settlementCurrency}
                    </div>
                    <div>
                      <span className="text-slate-500 block">Surety Bond ID</span>
                      {broker.suretyBond.bondReferenceId}
                    </div>
                    <div>
                      <span className="text-slate-500 block">Corridors</span>
                      {broker.authorizedCorridors.join(', ')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-200">
            Harmonized System (HS) Tariff Schedule Reference
          </h2>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3">HS Code</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Ad-Valorem (bps)</th>
                  <th className="p-3">Specific (/kg)</th>
                  <th className="p-3">Anti-Dumping (bps)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {hsEntries.map((item) => (
                  <tr key={item.hsCode} className="hover:bg-slate-900/40">
                    <td className="p-3 font-mono text-sky-400">{item.hsCode}</td>
                    <td className="p-3">{item.category}</td>
                    <td className="p-3">{item.adValoremRateBps} bps</td>
                    <td className="p-3">{item.specificDutyCentsPerKg} cents</td>
                    <td className="p-3">{item.antiDumpingSurchargeBps} bps</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}