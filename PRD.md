# BatchFlow — Product Requirements Document

## Overview
BatchFlow is a factory-style production workflow tracker for cannabis processing teams. Workers log daily progress against batch steps from their phones. Owners see real-time progress across all batches.

## Stack
- Next.js 14 (App Router)
- Prisma 5 + NeonDB Postgres
- Tailwind CSS
- Deployed on Vercel

## Auth
- PIN-based login (4-digit numeric PIN per worker)
- No email/password — workers are standing at tables, not sitting at desks
- Role: `WORKER` or `OWNER`
- Owner PINs access the dashboard; Worker PINs access the logging interface

## Core Data Model

### Worker
- id, name, pin (unique, 4-digit), role (WORKER | OWNER), createdAt

### Recipe
- id, name, description, createdAt
- Has many RecipeSteps (ordered)

### RecipeStep
- id, recipeId, name, order, notes (optional)
- Example: "Fill Bags" with notes "Set filler to 14g"

### Batch
- id, recipeId, name, targetQuantity, status (ACTIVE | COMPLETED | CANCELLED), startDate, completedDate, createdAt
- Example: "14g Ground Flower Batch #047", target 500

### BatchStep
- id, batchId, recipeStepId, name, order, targetQuantity (inherited from batch), completedQuantity (computed from logs), status (LOCKED | IN_PROGRESS | COMPLETED)
- Created automatically when a Batch is created (one per RecipeStep)

### ProgressLog
- id, batchStepId, workerId, quantity, note (optional), createdAt
- The atomic unit of work — "Maria filled 150 bags at 2:34pm"

## Key Rules
1. **Step ceiling**: A step's completed quantity cannot exceed the previous step's completed quantity. Step 1 has no ceiling (only batch target).
2. **Lock rule**: A step is LOCKED if the previous step has 0 completed quantity. Workers cannot log against locked steps.
3. **Completion**: A step is COMPLETED when completedQuantity >= targetQuantity. A batch is COMPLETED when all steps are completed.
4. **No negative logs**: Quantity must be > 0.
5. **Validation on submit**: If logging X against step N, verify: (previous step completed) >= (step N completed + X). If not, cap or reject.

## Screens

### 1. Login (`/`)
- Single input: 4-digit PIN
- Numpad-style buttons for phone use (no keyboard needed)
- On success: redirect to `/batches` (worker) or `/dashboard` (owner)

### 2. Worker: Batch List (`/batches`)
- Shows all ACTIVE batches (all workers see all active batches)
- Each card shows: batch name, target quantity, current bottleneck step + progress
- Tap → Batch Detail

### 3. Worker: Batch Detail (`/batches/[id]`)
- Batch name + target at top
- Waterfall of all steps with progress bars
- Each unlocked step has a [+ Log] button
- Locked steps show 🔒

### 4. Worker: Log Entry (modal or inline on Batch Detail)
- Step name at top
- Number input (large, thumb-friendly)
- Optional note text input
- Submit button
- On submit: validate ceiling rule, save ProgressLog, update UI
- Quick +50 / +100 / +250 shortcut buttons below the input

### 5. Owner: Dashboard (`/dashboard`)
- All active batches with waterfall progress bars
- Activity feed: recent logs across all batches (who, what, when)
- Per-batch: tap to see detail with worker breakdown

### 6. Owner: Recipe Builder (`/recipes`)
- List existing recipes
- Create new recipe: name + ordered steps
- Drag to reorder steps
- Each step: name + optional notes

### 7. Owner: Create Batch (`/batches/new`)
- Select recipe
- Enter batch name + target quantity
- Start date
- Create → generates BatchSteps from RecipeSteps

### 8. Owner: Worker Management (`/workers`)
- List workers with PINs
- Add worker: name + auto-generate PIN
- Deactivate worker

## UX Principles
- **Phone-first**: All touch targets 44px+, large text, minimal scrolling
- **5-second logging**: PIN → tap batch → tap step → enter number → done
- **No dropdowns or multi-selects**: Every interaction is a tap or a number
- **Visual progress**: Color-coded bars, clear icons for status
- **Works offline-ish**: Optimistic UI updates, graceful error handling

## API Routes (App Router)

### Auth
- `POST /api/auth/login` — { pin } → { worker, token/session }

### Batches
- `GET /api/batches` — list active batches (with steps + progress)
- `GET /api/batches/[id]` — batch detail with steps + logs
- `POST /api/batches` — create batch (owner only)
- `PATCH /api/batches/[id]` — update status (owner only)

### Progress
- `POST /api/batches/[id]/steps/[stepId]/log` — log progress { quantity, note? }

### Recipes
- `GET /api/recipes` — list recipes
- `POST /api/recipes` — create recipe with steps (owner only)
- `GET /api/recipes/[id]` — recipe detail
- `PUT /api/recipes/[id]` — update recipe (owner only)

### Workers
- `GET /api/workers` — list workers (owner only)
- `POST /api/workers` — create worker (owner only)
- `PATCH /api/workers/[id]` — update/deactivate (owner only)

## Seed Data
Create seed script with:
- 1 Owner: "Will", PIN 1234
- 2 Workers: "Maria" PIN 2241, "James" PIN 3356
- 1 Recipe: "14g Ground Flower" with 8 steps (Prep Bags, Measure Flower, Sift Flower, Fill Bags, Label ×3, Pack Master Cases, Sticker Cases, Box)
- 1 Active Batch: "14g Ground Flower #047", target 500, with some progress logged

## Phase 1 Scope (this build)
- [x] Schema + migrations
- [x] PIN auth (session cookie)
- [x] Worker batch list + detail + logging
- [x] Owner dashboard with waterfall
- [x] Recipe builder (basic)
- [x] Batch creation
- [x] Seed data
- [x] Deploy to Vercel

## Phase 2 (later)
- Worker assignment to specific batches
- Shift tracking / time logging
- Export reports (CSV)
- METRC-friendly data export
- Notifications when batch completes
- Photo attachments on logs
