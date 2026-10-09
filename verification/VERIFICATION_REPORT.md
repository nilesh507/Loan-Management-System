# CreditSea evaluator verification — 9 October 2026

## Environment

- Local MongoDB (`127.0.0.1:27017`), production Express API (`localhost:4000`), and production Next.js frontend (`localhost:3000`) were running for the final pass. The API health endpoint and web homepage both returned HTTP 200 afterward.
- Playwright Chromium exercised the rendered application. The evaluator journey used the six seeded accounts; Borrower, Sales, Sanction, Disbursement, and Collection completed or inspected their respective flow, and Admin's desktop dashboard rendered links to all four modules.
- The latest seeded-borrower loan is `6ac8e92c5d1b7d2db5b5c614` in the persistent `creditsea_lms` MongoDB database. A direct database read confirmed `CLOSED`, principal ₹1,00,000, interest ₹12,000, total paid ₹1,12,000 in two distinct UTR payments (₹50,000 and ₹62,000), and a closure timestamp.

## Passed checks

| Check | Evidence |
| --- | --- |
| Seeded login and full borrower-to-closure UI journey | `e2e/evaluator.spec.ts`, final Playwright run passed. |
| Failed BRE across age, salary, PAN, and unemployment; submission blocked | Four visible rejection reasons and HTTP 422 on premature submit. |
| Loan calculation and persistence | ₹1,00,000 for 365 days at 12% yielded ₹12,000 interest and ₹1,12,000 repayment; confirmed in MongoDB. |
| Role restrictions | Unauthenticated operation returned 401; Borrower and Sales forbidden actions returned 403; Sales frontend denied Collection; six-role API matrix passed in `workflow.test.ts`. |
| Invalid transitions | Repeated sanction and disbursement actions, and a payment after closure, returned 409. |
| Payment validation | Overpayment returned 422; fractional-paise amount returned 400; duplicate UTR returned 409; exact final payment auto-closed the loan. Integration tests also passed concurrent duplicate and overpayment cases. |
| File upload | A generated, renderable one-page PDF was uploaded and stored; `pypdf` read the stored document and extracted its text. |
| Responsive rendering | Chromium screenshots inspected at 1440 px and 375 px. Mobile borrower configuration and Sanction review rendered; the Sales queue showed its action without horizontal overflow after the fix. |
| Admin overview | Seeded Admin login rendered all four dashboard modules at desktop width. |
| Automated gates | Typecheck, lint, production build, 19/19 API tests, and 4/4 browser tests passed. |

## Failures encountered and resolved

- The 375 px Sales table initially concealed its action offscreen. `apps/web/app/dashboard/[module]/page.tsx` now renders cards on narrow screens. The final mobile screenshot shows the action, and the page has no horizontal overflow.
- Repeated evaluator logins initially exhausted one 30-request IP bucket. The API returned plain text for HTTP 429, producing a frontend JSON parse error. `apps/api/src/routes/auth.ts` now returns a structured 429 and uses an account-specific login limit alongside a larger IP limit; `apps/web/components/auth.tsx` handles non-JSON error responses. A new API test verifies the 429 format.
- Intermediate test reruns found an unfinished seeded loan from an interrupted run and ambiguous test selectors when multiple loans appeared in a queue. The unfinished loan was completed through the Collection API, and `e2e/evaluator.spec.ts` now selects by loan ID. These were test-state and selector issues; the final combined browser run passed.

## Final failures

None in the executed checks.

## Unexecuted checks

- Firefox, WebKit, physical phone and tablet testing; rendered checks used Chromium at 1440 px and 375 px.
- Real bank transfer or external PAN identity verification; the assignment implementation models disbursement and checks PAN format.
- Hosted deployment, GitHub submission, and a recorded evaluator video.

## Rendered evidence

- `screenshots/login-desktop.png`
- `screenshots/admin-desktop.png`
- `screenshots/sales-mobile.png`
- `screenshots/borrower-config-mobile.png`
- `screenshots/sanction-mobile.png`
