# Chain Studio

A private prompt-chain workspace built with Next.js, Supabase, and the Vercel AI SDK.

## Features

- Create, edit, and delete chains and steps. Drag steps or use accessible arrow/keyboard controls to reorder them.
- Save the entire chain atomically, with stale-save detection for concurrent edits.
- Google OAuth sign-in, `profiles.is_superadmin = true`, and the Humor Project’s existing active-session rules. Every API route and database policy enforces access.
- Sequential text, vision, and image generation directly through OpenAI, including an image-to-funny-captions template. The model picker offers GPT-5 nano and GPT Image 2.5 Flare.
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

Vercel Production and Preview set `APP_URL=https://prompt-chain-tool-ruddy.vercel.app`. Sign-in first moves to this stable origin, then creates the PKCE cookie and starts Google OAuth. This keeps deployment-specific Vercel URLs from falling back to the shared Humor Project Site URL. Its exact `/auth/callback` URL must be in Supabase's redirect allowlist. Leave `APP_URL` blank for local development. For isolated preview authentication, use a dedicated allowed preview origin instead.

Set `OPENAI_API_KEY` in `.env.local` for local generation. In the Prompt Chain Tool's Vercel settings, add it as a **Secret** for **Production** and **Preview**, then redeploy. Text and vision use OpenAI's Responses API; image steps use the Images API, including edits when a preceding image is available. Keys stay on the server. Model access, rate limits, and billing follow the key's API project. Never commit credentials.

Only `OPENAI_API_KEY` is used. Gemini execution, its provider dependency, and its model options have been removed. The budget-model migration updates this tool's existing chain steps while preserving prompts, output types, and generated history. Other apps using the shared Humor Project catalog keep their existing models.

```sh
npm run dev
```

Use `http://localhost:3000` consistently for PKCE cookies and OAuth callbacks.

## Database

The versioned migration in `supabase/migrations` adds `output_type` to the existing step table, creates private run records, adds superadmin write policies, installs `pc_save_chain`, and creates a private media bucket. It preserves the existing `humor_private.is_superadmin()` helper and profile protection trigger.

Apply it once to the existing Humor database. The hosted migration was applied during project setup. A rollback-only integration check is in `supabase/tests/prompt_chain_security.sql` and requires an existing active Google superadmin session.

The OpenAI catalog migration adds an OpenAI provider and two supported models without modifying saved chains or generated history.

## Prompts and execution

- `{{input}}`: original starting text.
- `{{previous}}`: previous step’s text; the first step receives the starting text.
- `{{step.1}}`: text from an earlier numbered step. References follow displayed order; forward references are rejected.
- Each step receives the previous text automatically, even without a variable. The most recent image passes to subsequent steps.

Run the saved version of a ready chain. Chain definitions are snapshotted into the run so later edits do not rewrite history. Supported models are centralized in `src/lib/validation.ts`: GPT-5 nano for text/vision and GPT Image 2.5 Flare for images. Text requests use minimal reasoning and a 2,048-token output cap. Image output uses one 1024 × 1024 PNG at low quality. Sampling controls are omitted because GPT-5 nano does not support temperature.

GPT-5 nano is cheaper than GPT-6 Luna at the time of this change but is scheduled to shut down on December 11, 2026. Replace its catalog entry and supported ID before that date. See [OpenAI's retirement schedule](https://developers.openai.com/api/docs/deprecations). Cheaper models and output caps reduce spend; API rate limits and credit balances still apply.

Runs stream progress over an authenticated HTTP connection and save each completed step before continuing. A run has a four-minute overall deadline and a 90-second per-step limit, with at most 12 steps. A terminated server process can leave an interrupted run marked running; this version does not include a durable background queue or resume. History shows the 100 most recent runs. Input images are limited to 3 MB, and generated images to 10 MB. Deleting a chain removes its run records; private storage objects are retained and can be cleaned up separately.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

The execution and provider integration tests use fake responses; they do not spend API credits. They verify direct OpenAI requests, server-side key authentication, model exclusions, token and image quality limits, text and vision, image generation and edits, and safe errors. Live model availability and quota depend on the configured OpenAI key.
