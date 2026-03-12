# Fitness Platform

Cloudflare-hosted multi-tenant fitness coaching platform with:
- admin-created client accounts
- Worker-managed auth with HTTP-only cookies
- D1-backed intake, plans, daily logs, check-ins, and weekly reviews
- Gemini-based draft plan generation
- Google Sheets export from the Worker

## Structure

- `public/index.html`: single-page frontend for admin and client flows
- `src/worker.js`: API, auth, Gemini generation, and export logic
- `migrations/001_init.sql`: D1 schema
- `wrangler.toml`: Cloudflare Worker + assets config

## Setup

1. Create a D1 database:
   - `npx wrangler d1 create fitness-platform`
   - copy the generated `database_id` into `wrangler.toml`

2. Apply the migration:
   - `npx wrangler d1 execute fitness-platform --file=./migrations/001_init.sql`

3. Start local dev or deploy once:
   - `npx wrangler dev`
   - or `npx wrangler deploy`

4. Open the app for the first time.
   - If no admin exists yet, the login page shows a `Create First Admin` form.
   - Submit the admin username/password there once.

5. Set secrets:
   - `npx wrangler secret put GEMINI_API_KEY`
   - `npx wrangler secret put GOOGLE_SHEETS_WEBHOOK`

6. Run locally:
   - `npx wrangler dev`

7. Deploy:
   - `npx wrangler deploy`

## Notes

- If `GEMINI_API_KEY` is missing or Gemini fails, the Worker falls back to a deterministic draft plan.
- Google Sheets export is optional. If `GOOGLE_SHEETS_WEBHOOK` is unset, export calls will fail with a clear error.
- Client-side local storage is intentionally not used as the source of truth.
