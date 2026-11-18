# Next.js Cross-Border Freight & Customs Brokerage Hub

A multi-tenant B2B freight forwarding, customs tariff assessment, container detention/demurrage calculation, and bonded warehouse settlement engine built with Next.js App Router and TypeScript.

## Architecture & Core Modules

- **`src/lib/tenants/broker-registry.ts`**: Multi-tenant customs broker registry managing credit lines, customs surety bonds, corridor authorizations, and operational status transitions (`ACTIVE`, `CREDIT_HOLD`, `BOND_SUSPENDED`, `RESTRICTED_AUDIT`, `DECOMMISSIONED`).
- **`src/lib/tariffs/duty-calculator.ts`**: Harmonized System (HS) 6-digit tariff classification engine supporting ad-valorem duties, specific weight/unit tariffs, anti-dumping surcharges, de-minimis threshold exemptions, and multi-currency CIF (Cost, Insurance, and Freight) valuation.
- **`src/lib/detention/demurrage-engine.ts`**: Port terminal container detention and demurrage calculator accounting for vessel discharge timestamps, port calendar holidays, weather-related force majeure windows, tiered progressive daily penalty brackets, and dispute credit clawbacks.
- **`src/lib/idempotency/manifest-guard.ts`**: Webhook and manifest submission idempotency layer providing deterministic payload canonicalization, HMAC digest validation, and replay window protection.
- **`src/lib/store/ledger-journal.ts` & `src/lib/store/broker-singleton.ts`**: Bonded warehouse financial ledger managing customs duty reservations, demurrage accruals, dispute holds, and append-only audit journaling.

## Synthetic Test Data Notice

All broker profiles, contact emails (e.g., `example1@example.com`, `example2@example.com`), bond identifiers (e.g., `BOND-DEMO-0001`), and webhook signature strings (e.g., `YOUR_API_KEY_HERE`) included in this repository are strictly synthetic dummy placeholders used for local unit testing in isolated environments. No live credentials, keys, or personal data are used anywhere in this codebase.

## Local Development & Verification

```bash
# Install dependencies
pnpm install

# Run TypeScript type checking
pnpm typecheck

# Run Vitest unit and integration suite
pnpm test

# Start local development server
pnpm dev












This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
