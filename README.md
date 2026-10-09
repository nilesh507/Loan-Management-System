# CreditSea Loan Management System

A full-stack lending assignment with a borrower portal and role-based operations dashboard. The original requirements are in `LMS_Assignment.pdf`.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS; Express, Mongoose, MongoDB; JWT in HTTP-only cookies and bcrypt.

## Prerequisites and setup

Node.js 22.13+ LTS or 24+, npm 10+, and MongoDB 7 (or Docker). From this repository root:

```sh
npm ci
cp .env.example .env
# Run `openssl rand -hex 32`, then replace JWT_SECRET in .env with its output.
docker compose up -d
npm run seed
npm run dev
```

If Docker is unavailable, start a local MongoDB 7 server at `127.0.0.1:27017` instead of running `docker compose up -d`. Do not start both on port 27017. The API listens on port 4000 and the web app on 3000. Both workspaces read the root `.env`; Next.js imports only `NEXT_PUBLIC_API_URL` from it. A shell-exported `NEXT_PUBLIC_API_URL` takes precedence.

For the built version, stop the development servers and run `npm run build` followed by `npm run start`. The root start command launches both servers. Visit `http://localhost:3000`; `http://localhost:4000/api/v1/health` should report a connected database.

## Demo credentials

All seeded accounts use the development-only password `CreditSea@123`:

| Role         | Email                       |
| ------------ | --------------------------- |
| Admin        | admin@creditsea.demo        |
| Sales        | sales@creditsea.demo        |
| Sanction     | sanction@creditsea.demo     |
| Disbursement | disbursement@creditsea.demo |
| Collection   | collection@creditsea.demo   |
| Borrower     | borrower@creditsea.demo     |

The seed script is idempotent and does not remove existing records. It refuses to change the role or password of an account already occupying a demo email. It is disabled in production.

The [recording script](DEMO_SCRIPT.md) uses a new fictional borrower and the included [synthetic PDF](demo/synthetic-salary-slip.pdf), so it does not depend on the seeded borrower's prior loan history.

## Workflow

1. Sign up as a borrower or use the demo borrower. Enter personal details, pass the four eligibility rules, upload a PDF/JPEG/PNG up to 5 MB, and set amount and tenure.
2. In Sanction, approve or reject an applied loan. In Disbursement, mark an approved loan disbursed. In Collection, record payments with unique UTRs. The final exact payment closes the loan.
3. The borrower can see the full status and payment history in My loans.

## Checks

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e # with both servers running
```

Browser tests create persistent fictional loans, including loans on the seeded borrower account. Use a disposable local database for repeated test runs. If a browser run is interrupted with a seeded loan still active, finish that loan through the relevant executive workflow before rerunning the seeded journey.

## Security and limitations

The API validates eligibility, amounts, status changes, roles, ownership, and file signatures. It checks that an uploaded file still exists before creating a loan. JWTs are HTTP-only cookies with SameSite=Lax and an origin check for mutations. Uploaded files are private on the API host. This assignment implementation does not include durable object storage, real money transfer, third-party PAN verification, or production identity proofing. Production deployment requires HTTPS, a strong secret, backup/retention policies, and a shared storage service.

If MongoDB connection fails, ensure Docker Desktop or your local MongoDB server is running and `MONGODB_URI` is correct. If the browser cannot reach the API, check port 4000 and `FRONTEND_URL`.
