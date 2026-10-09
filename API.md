# API

Base URL: `http://localhost:4000/api/v1`. All successful JSON responses are `{ "success": true, "data": ... }`; errors are `{ "success": false, "error": { "code": "...", "message": "...", "details": null } }`. Authentication is an HTTP-only cookie set by login.

| Method | Endpoint                                          | Role                 | Purpose                                                       |
| ------ | ------------------------------------------------- | -------------------- | ------------------------------------------------------------- |
| POST   | `/auth/register`                                  | Public               | Register borrower: fullName, email, password, confirmPassword |
| POST   | `/auth/login`                                     | Public               | Login: email, password                                        |
| POST   | `/auth/logout`                                    | Public               | Clear cookie                                                  |
| GET    | `/auth/me`                                        | Signed in            | Current user                                                  |
| GET    | `/health`                                         | Public               | Database status; 503 if unavailable                           |
| GET    | `/applications/me/draft`                          | Borrower             | Saved draft                                                   |
| PUT    | `/applications/me/personal-details`               | Borrower             | fullName, pan, dateOfBirth, monthlySalary, employmentMode     |
| POST   | `/applications/me/eligibility-check`              | Borrower             | Recheck saved details                                         |
| POST   | `/applications/me/salary-slip`                    | Borrower             | Multipart file field `file`                                   |
| GET    | `/applications/me/salary-slip`                    | Borrower             | Private document                                              |
| POST   | `/applications/me/submit`                         | Borrower             | principalRupees, tenureDays                                   |
| GET    | `/loans/me`                                       | Borrower             | Own loans                                                     |
| GET    | `/loans/me/:loanId`                               | Borrower             | Own loan detail                                               |
| GET    | `/operations/sales/leads`                         | Sales, Admin         | Leads; page, limit, search                                    |
| GET    | `/operations/sales/leads/:borrowerId`             | Sales, Admin         | Lead detail                                                   |
| GET    | `/operations/{module}/loans`                      | Matching role, Admin | Loan queue; page, limit                                       |
| GET    | `/operations/{module}/loans/:loanId`              | Matching role, Admin | Detail in that module's stage; Collection also reads CLOSED   |
| GET    | `/operations/sanction/loans/:loanId/salary-slip`  | Sanction, Admin      | Private document for an APPLIED loan                          |
| POST   | `/operations/sanction/loans/:loanId/approve`      | Sanction, Admin      | Applied to sanctioned                                         |
| POST   | `/operations/sanction/loans/:loanId/reject`       | Sanction, Admin      | `{ "reason": "..." }`                                         |
| POST   | `/operations/disbursement/loans/:loanId/disburse` | Disbursement, Admin  | Sanctioned to disbursed                                       |
| GET    | `/operations/collection/loans/:loanId/payments`   | Collection, Admin    | Payment history                                               |
| POST   | `/operations/collection/loans/:loanId/payments`   | Collection, Admin    | utr, amountRupees, paymentDate                                |

Role denial returns 403; unauthenticated returns 401; state/duplicate conflicts return 409; missing or invalid uploaded files and overpayments return 422; malformed input, including more than two decimal places, returns 400. Nonexistent or wrong-stage detail reads return 404.
