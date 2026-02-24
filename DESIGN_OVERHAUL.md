# Design Overhaul — BatchFlow v0.3

The current UI works but feels like a backend engineer built it. We need it to feel like a real product — the kind of app a design-forward team would ship. Think Linear, Vercel Dashboard, or Notion's mobile app.

## Design System Foundation

### Typography Scale
- Use a consistent type scale. Don't just randomly pick text sizes.
- Page titles: text-2xl font-bold tracking-tight
- Section headers: text-lg font-semibold
- Body: text-sm
- Labels/captions: text-xs text-zinc-500
- Numbers/stats: tabular-nums font-mono for alignment

### Spacing
- Use consistent spacing rhythm: 4, 8, 12, 16, 24, 32, 48
- Cards: p-4 or p-5 (not p-6 — too much air)
- Between cards: gap-3 (not space-y-4)
- Page padding: px-4 py-4 on mobile, px-6 py-6 on desktop

### Colors
- Background: zinc-950
- Card surface: zinc-900
- Card surface hover: zinc-900 with border-zinc-700
- Borders: zinc-800 default, zinc-700 on hover/focus
- Primary action: emerald-500 (not green-600 — more vibrant)
- Destructive: red-500
- Info/in-progress: blue-500
- Locked/disabled: zinc-600
- Text primary: zinc-50
- Text secondary: zinc-400
- Text muted: zinc-500

### Interactive States
Every interactive element needs:
- Default state
- Hover: subtle brightness/border change
- Active/pressed: scale-[0.98] transform (press-in effect)
- Focus-visible: ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-950
- Disabled: opacity-50 cursor-not-allowed
- Transition: transition-all duration-150

### Touch Targets
- All buttons: min-h-[44px] min-w-[44px]
- Tap areas should extend beyond visual boundaries where possible

### Animations
- Page transitions: fade in with slight upward motion
- Modal: slide up from bottom on mobile (already have this)
- Toast: slide in from top, auto-dismiss
- Progress bars: transition-all duration-500 ease-out
- Card hover: translate-y-[-1px] shadow-lg/10

## Component Patterns

### Cards
```
rounded-xl border border-zinc-800 bg-zinc-900 
hover:border-zinc-700 hover:translate-y-[-1px] 
transition-all duration-150 cursor-pointer
active:scale-[0.99]
```

### Buttons - Primary
```
bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98]
text-white font-medium rounded-lg px-4 py-2.5
transition-all duration-150
focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950
```

### Buttons - Secondary
```
bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 
hover:border-zinc-600 active:scale-[0.98]
text-zinc-200 font-medium rounded-lg px-4 py-2.5
transition-all duration-150
```

### Inputs
```
bg-zinc-800/50 border border-zinc-700 rounded-lg 
px-3.5 py-2.5 text-sm text-zinc-50
placeholder:text-zinc-500
focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500
transition-all duration-150
```

### Badges/Pills
```
text-xs font-medium px-2 py-0.5 rounded-full
```
- Check type: bg-blue-500/10 text-blue-400 border border-blue-500/20
- Count type: bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
- Status completed: bg-emerald-500/10 text-emerald-400
- Status locked: bg-zinc-500/10 text-zinc-500

### Progress Bars
```
h-1.5 rounded-full bg-zinc-800 overflow-hidden
```
Inner bar:
- In progress: bg-blue-500
- Complete: bg-emerald-500
- Locked: bg-zinc-700

Make them thinner (h-1.5 not h-3) — thinner bars look more refined.

## Per-Screen Fixes

### Login (app/page.tsx)
- Add a subtle gradient or glow behind the BatchFlow title
- PIN dots should pulse/fill with a micro-animation
- Numpad buttons need active:scale-[0.95] press feedback
- Auto-submit already works — keep it
- Add "BatchFlow" wordmark with a small icon/logo above it

### Batch List (app/batches/page.tsx)
- Cards should show a compact progress indicator (thin bar at bottom of card)
- Current step name should be more prominent
- Add subtle divider between header and list
- Empty state should have an illustration or at least a styled message

### Batch Detail (app/batches/[id]/BatchDetailClient.tsx)
- This is the most important screen — workers spend 90% of time here
- Steps should be more compact — less vertical padding
- CHECK steps: show a clean checkbox icon, not the current bulky layout
- COUNT steps: the progress bar + numbers should be on one line
- [+ Log] button should be more prominent — it's the primary action
- Mark Done button for CHECK steps should feel satisfying to tap
- Log modal: the number input should auto-focus
- Quick-add buttons should be more tactile (slightly raised look)
- Recent logs section should be collapsible or hidden by default (less noise)
- The toast should appear at the top, fixed position, with a check icon

### Dashboard (app/dashboard/page.tsx)
- Batch cards need the waterfall to be more compact
- Add summary stats at top: "3 active batches • 12 logs today • 2,400 units"
- Activity feed items should be more compact
- Consider a tab layout: Batches | Activity (instead of side-by-side on mobile)

### Recipe Builder (app/recipes/RecipeBuilder.tsx + page.tsx)
- Step type toggle should look like a proper segmented control
- Drag handles for reorder (or at least make ↑↓ look better)
- The form should feel lighter — less visual weight on containers

### Create Batch (app/batches/new/*)
- Recipe selection should use radio-style cards (current is OK but could be tighter)
- Preview of steps should be more compact

### Workers (app/workers/*)
- Worker cards should show last active time or total logs
- PIN should be copyable or revealable (show/hide toggle)

### Header (app/components/Header.tsx)
- Should be sticky (sticky top-0)
- Minimal: logo left, nav center (owner), user right
- Mobile: hamburger or bottom nav
- Add a subtle bottom border/shadow
- Keep it slim: h-14

## Don't Change
- Dark theme
- PIN auth flow
- CHECK vs COUNT step types
- The data model / API routes
- Heroicons (keep using them, add more where needed)

## Build Instructions
- Update all screens following these patterns
- Be consistent — same card style everywhere, same button style everywhere
- Test that the app builds with `npx next build`
- Make sure all interactive elements have proper hover/active/focus states
