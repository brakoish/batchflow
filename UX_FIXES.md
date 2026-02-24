# UX Fixes - BatchFlow v0.2

## Critical Fixes

### 1. Make dashboard batch cards fully clickable
- In `app/dashboard/page.tsx`, wrap each batch card in a `<Link>` to `/batches/[id]`
- Remove the tiny "View Details →" link
- The entire card should be clickable

### 2. Fix logout
- `app/api/auth/logout/route.ts` should clear the `workerId` cookie and redirect to `/`
- Make sure it works as both form POST and regular navigation

### 3. Owner should access batch detail too
- In `app/batches/[id]/page.tsx`, don't redirect owners away
- The "Back" link should go to `/dashboard` for owners, `/batches` for workers
- Owner should be able to log progress too (they're often on the floor)

### 4. Add a consistent nav/header component
- Create `app/components/Header.tsx` as a client component
- Shows: BatchFlow logo/name on left, user name + role badge, logout button
- For owner: also show Dashboard, Recipes, Workers, New Batch links
- For worker: just show Batches link
- Mobile: hamburger menu or compact layout
- Use this header on ALL pages (batches list, batch detail, dashboard, recipes, workers, new batch)

### 5. Auto-submit PIN on 4th digit
- In `app/page.tsx`, when `pin.length === 4` after adding a digit, auto-trigger `handleSubmit`
- Remove the green checkmark button from numpad
- Replace it with a "Clear" button or just leave backspace

### 6. Success feedback on log entry
- After successful log submission, show a brief green toast/banner "✓ Logged 150 units"
- Auto-dismiss after 2 seconds
- Add a subtle scale animation on the progress bar update

### 7. Mobile-responsive dashboard
- Dashboard header buttons should wrap or collapse on mobile
- Use flex-wrap or a dropdown menu on small screens
- Activity feed should stack below batches on mobile (already does with lg:grid-cols-3)

### 8. Fix stale data after logging
- In `BatchDetailClient.tsx`, after successful log, fetch fresh batch data from API instead of relying on `router.refresh()`
- Or better: optimistically update the local state with the new quantities

### 9. Add pull-to-refresh hint
- Add a small "Pull to refresh" or a refresh button on batch list and batch detail
- Workers need an easy way to see updated progress from other workers

### 10. Improve the waterfall visualization
- Add percentage labels to progress bars
- Use color gradients: gray (locked) → blue (in progress) → green (completed)
- Make step cards more compact on the dashboard view

## Style Improvements
- Add `safe-area-inset` padding for notched phones
- Ensure all interactive elements are at least 44px tap targets
- Add focus-visible styles for accessibility
- Add a subtle gradient or pattern to the login screen background

## Don't Change
- Keep the dark theme
- Keep the PIN numpad interface (it's great)
- Keep the modal for log entry (bottom sheet on mobile is right)
- Keep Prisma schema as-is
