# Chain Studio

A private prompt-chain workspace built with Next.js, Supabase, and the Vercel AI SDK.

## Features

- Create, edit, and delete chains and steps. Drag steps or use accessible arrow/keyboard controls to reorder them.
- Save the entire chain atomically, with stale-save detection for concurrent edits.
- Google OAuth sign-in, `profiles.is_superadmin = true`, and the Humor Project’s existing active-session rules. Every API route and database policy enforces access.
- Sequential text and image generation through AI Gateway, including an image-to-funny-captions template.
- Private input uploads and generated images, per-chain run history, partial outputs on failure, copy, image downloads, and JSON export.
- Light, dark, and system themes; responsive layouts.

## Local setup

Use Node.js 22 or later.

```sh
npm ci
cp .env.example .env.local
```

Fill in the Supabase project URL and publishable key. This application integrates with the existing **Humor Project** schema; its migration is an extension, not a standalone database bootstrap. It never uses a service-role key.

In Supabase Authentication → URL Configuration, add the exact callback URLs you use:

```text
http://localhost:3000/auth/callback
https://YOUR-PRODUCTION-DOMAIN/auth/callback
```

Preserve the existing Site URL and other redirect URLs because this database is shared with other apps. The Google provider is already configured in the Humor Project. Your Google account must have a matching `profiles.user_id` with `is_superadmin = true`. The app never grants its own users that role.

For local generation, link the existing Vercel project and run `vercel env pull .env.local`, or add an AI Gateway key as `AI_GATEWAY_API_KEY`. Deployments use Vercel OIDC automatically. A funded Gateway account and access to the selected models are required. Never commit credentials.

```sh
npm run dev
```

Use `http://localhost:3000` consistently for PKCE cookies and OAuth callbacks.

## Database

The versioned migration in `supabase/migrations` adds `output_type` to the existing step table, creates private run records, adds superadmin write policies, installs `pc_save_chain`, and creates a private media bucket. It preserves the existing `humor_private.is_superadmin()` helper and profile protection trigger.

Apply it once to the existing Humor database. The hosted migration was applied during project setup. A rollback-only integration check is in `supabase/tests/prompt_chain_security.sql` and requires an existing active Google superadmin session.

## Prompts and execution

- `{{input}}`: original starting text.
- `{{previous}}`: previous step’s text; the first step receives the starting text.
- `{{step.1}}`: text from an earlier numbered step. References follow displayed order; forward references are rejected.
- Each step receives the previous text automatically, even without a variable. The most recent image passes to subsequent steps.

Run the saved version of a ready chain. Chain definitions are snapshotted into the run so later edits do not rewrite history. The initial model catalog contains Gemini 3.5 Flash Lite for text/vision and Gemini 3.1 Flash Image for image output, verified against the Gateway catalog during implementation. Supported IDs are centralized in `src/lib/validation.ts`.

Runs stream progress over an authenticated HTTP connection and save each completed step before continuing. A run has a four-minute overall deadline and a 90-second per-step limit, with at most 12 steps. A terminated server process can leave an interrupted run marked running; this version does not include a durable background queue or resume. History shows the 100 most recent runs. Input images are limited to 3 MB, and generated images to 10 MB. Deleting a chain removes its run records; private storage objects are retained and can be cleaned up separately.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

The execution tests use a fake generation provider; they do not spend AI credits. Live model availability and billing must be verified in the connected Gateway account.
