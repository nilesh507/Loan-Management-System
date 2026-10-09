# Submission readiness

Checked on 9 October 2026. This is a local readiness record; publishing and video upload remain manual.

## Verified locally

- `.gitignore` excludes `.env`, installed dependencies, Next.js and TypeScript output, private uploaded files, logs, and Playwright output. `.env.example` remains includable and uses a deliberately invalid `JWT_SECRET=CHANGE_ME` placeholder.
- README has setup, health check, role credentials, test commands, and limitations. `DEMO_SCRIPT.md` has a timed walkthrough; `demo/synthetic-salary-slip.pdf` is a valid, readable one-page fictional PDF under 5 MB.
- A source-only copy with no `.env`, dependencies, build output, or uploaded files installed successfully using `npm ci` on Node 24.19.0; the project built; all six accounts seeded into an isolated MongoDB database; and a browser signed in as the seeded Admin against its isolated API and frontend. The isolated database was removed afterward.
- The main workspace's `npm run start` launched both built servers. `http://localhost:4000/api/v1/health` and `http://localhost:3000/` returned HTTP 200.
- The previous evaluator pass recorded 19/19 API tests and 4/4 Chromium browser tests passing. See `verification/VERIFICATION_REPORT.md` for those checks.

## Before handing it to an evaluator

1. Run the commands in `README.md` from a fresh checkout with Node 22.13+ LTS or 24+, MongoDB 7, and a newly generated JWT secret. The example secret must be replaced.
2. Make the 3–5-minute recording using `DEMO_SCRIPT.md`. Use a fresh borrower email and new UTRs for each take. Review that the final screen visibly says CLOSED and shows zero outstanding.
3. Manually create the GitHub repository and push the local commit. For a private repository, invite the evaluator. Verify the README, `.env.example`, and demo PDF are visible in the remote repository and `.env` is absent.
4. Manually upload the recording as an unlisted YouTube video or appropriately shared Google Drive file, then verify evaluator access.
5. Submit the repository URL, video URL, and the six role credentials in `README.md`.

No GitHub push, hosting, video recording, or upload was performed during preparation.
