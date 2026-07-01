# Refill — Supplement Tracker

## Architecture Overview

**Tech Stack:**
- **Frontend**: Next.js 15+ (App Router) + TypeScript + Tailwind CSS
- **Backend**: Convex (for real-time sync between Mark & Lori)
- **State Management**: Zustand (for UI state), Convex queries (for data)
- **Deployment**: Vercel (with Convex backend integration)

**Key Design Principles:**
- Real-time data sync via Convex queries
- Component composition over large monolithic components
- Design tokens matched to handoff specifications
- Desktop-first MVP (mobile layouts TBD in v2)

---

## Data Schema (Convex)

### Tables

#### `households`
Represents a household (e.g., "Mark & Lori"). All data is scoped to a household for multi-member sharing.

```typescript
{
  _id: Id<"households">,
  name: string,                // "Mark & Lori"
  createdAt: number,          // timestamp
}
```

#### `people`
Individual household members.

```typescript
{
  _id: Id<"people">,
  householdId: Id<"households">,
  name: string,               // "Mark" or "Lori"
  color: string,              // "green" or "amber" (for avatar tint)
}
```

**Indexes:**
- `by_household(householdId)`

#### `supplements`
Physical supplement jars/bottles the household owns.

```typescript
{
  _id: Id<"supplements">,
  householdId: Id<"households">,
  
  // User-supplied
  name: string,               // "Omega-3 Fish Oil"
  brand: string | undefined,  // "NorSea Naturals"
  form: string | undefined,   // "Softgel", "Tablet", etc
  purchaseUrl: string,        // where they bought it
  
  // Auto-lookup filled fields (optional in MVP, mocked)
  servingSize: string | undefined,       // "1 softgel"
  servingSizeAmount: number | undefined, // 1000
  servingSizeUnit: string | undefined,   // "mg"
  nutrients: Array<{name, amount, unit}> | undefined,
  category: string | undefined,  // "Essential fatty acid"
  imageUrl: string | undefined,  // from product listing
  
  // Inventory & cost
  jarSize: number,            // total pills when full
  remaining: number,          // pills left
  price: number,              // purchase price
  createdAt: number,
}
```

**Indexes:**
- `by_household(householdId)`

#### `dosages`
How often and how much each person takes a supplement.

```typescript
{
  _id: Id<"dosages">,
  supplementId: Id<"supplements">,
  personId: Id<"people">,
  pillsPerDose: number,      // 2 (pills per dose)
  daysPerWeek: number,       // 7 (takes it daily)
}
```

**Derived:** `perDayPills = pillsPerDose * daysPerWeek / 7`

**Indexes:**
- `by_supplement(supplementId)`
- `by_person(personId)`

#### `retailerSites`
URLs of retailer sites the user wants us to scrape for prices. (MVP: mocked data only)

```typescript
{
  _id: Id<"retailerSites">,
  householdId: Id<"households">,
  name: string,               // "Amazon", "Vitacost", etc
  baseUrl: string,            // "https://amazon.com"
}
```

**Indexes:**
- `by_household(householdId)`

#### `priceQuotes`
Latest price data from each retailer for each supplement. (MVP: mocked/static)

```typescript
{
  _id: Id<"priceQuotes">,
  supplementId: Id<"supplements">,
  retailerId: Id<"retailerSites">,
  sticker: number,            // base price
  shipping: number,           // shipping cost
  total: number,              // sticker + shipping
  inStock: boolean,
  etaDays: number,            // delivery time
  checkedAt: number,          // timestamp of price check
}
```

**Indexes:**
- `by_supplement(supplementId)`
- `by_retailer(retailerId)`

---

## Convex Queries & Mutations

### `convex/supplements.ts`
- `list(householdId)` → array of supplements for a household
- `get(id)` → single supplement
- `create(householdId, ...)` → insert and return new supplement ID
- `update(id, ...)` → patch and return updated supplement
- `remove(id)` → delete supplement

### `convex/people.ts`
- `list(householdId)` → array of people
- `create(householdId, name, color)` → insert and return ID
- `update(id, ...)` → patch and return updated person

### `convex/dosages.ts`
- `listBySupplementId(supplementId)` → dosages for a supplement
- `listByPersonId(personId)` → dosages for a person
- `create(supplementId, personId, pillsPerDose, daysPerWeek)` → insert and return ID
- `update(id, ...)` → patch and return updated dosage
- `remove(id)` → delete dosage

### `convex/households.ts`
- `create(name)` → insert and return household ID
- `get(id)` → single household

---

## File Structure

```
refill/
├── app/
│   ├── layout.tsx                 # Root layout (HTML shell, fonts, providers)
│   ├── page.tsx                   # Root → redirects to /dashboard
│   ├── globals.css                # Tailwind + utility classes
│   ├── providers.tsx              # ConvexProvider wrapper
│   │
│   ├── dashboard/
│   │   ├── layout.tsx             # Dashboard layout (sidebar + main)
│   │   └── page.tsx               # Dashboard view (pill-jars grid)
│   │
│   ├── supplements/
│   │   ├── page.tsx               # Supplements list
│   │   └── new/
│   │       └── page.tsx           # Add supplement (paste-link flow)
│   │
│   ├── people/
│   │   └── page.tsx               # People management (placeholder)
│   │
│   ├── costs/
│   │   └── page.tsx               # Cost breakdown (placeholder)
│   │
│   └── buy/
│       └── page.tsx               # Price comparison (placeholder)
│
├── components/
│   ├── Sidebar.tsx                # Left nav bar (all pages)
│   └── PillBottle.tsx             # Stylized jar visual (dashboard)
│
├── convex/
│   ├── schema.ts                  # Data schema definition
│   ├── supplements.ts             # Queries/mutations for supplements
│   ├── people.ts                  # Queries/mutations for people
│   ├── dosages.ts                 # Queries/mutations for dosages
│   ├── households.ts              # Queries/mutations for households
│   └── _generated/                # Auto-generated types (do not edit)
│       ├── api.ts
│       └── dataModel.d.ts
│
├── hooks/
│   └── useDemoHousehold.ts        # Hook to initialize demo household + people
│
├── lib/
│   └── supplement-utils.ts        # Utility functions (status, days left, etc)
│
├── public/                        # Static assets (empty for MVP)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── convex.json                    # Convex project config
├── .env.local.example             # Environment template
└── DOCS.md                        # This file
```

---

## Component Architecture

### Page Components (in `app/`)
- **DashboardPage**: Fetches supplements via `useQuery(api.supplements.list)`, renders stat cards and pill-jar grid
- **SupplementsPage**: Lists all supplements with name, brand, status pills, and price
- **AddSupplementPage**: Paste-link-first flow; simulates lookup, renders result card, saves to Convex

### Layout Components
- **RootLayout**: Sets up `ConvexProvider`, loads Google Fonts, wraps in providers
- **DashboardLayout**: Renders `<Sidebar />` + `<main>` (outlet for nested routes)

### Reusable Components
- **Sidebar**: Navigation (Dashboard, Supplements, People, Costs, Buy) with active state styling
- **PillBottle**: Visual pill-jar with fill percentage and status color

### Hooks
- **useDemoHousehold**: Initializes demo household + sample supplements + dosages on first load (stored in localStorage)

### Utilities
- `getDaysLeft(remaining, perDayConsumption)` → days until empty
- `getSupplementStatus(daysLeft)` → "critical" | "low" | "on-track" | "stocked"
- `getTimelineBarPct(daysLeft)` → width % for Gantt bar (MVP v1.1)
- `getRunOutDate(daysLeft)` → future date when supplement runs out

---

## Design Tokens (Tailwind Config)

All colors, typography, and spacing from the design handoff are configured in `tailwind.config.ts`:

**Colors:**
- `primary`: `#2e7d5b` (accent green)
- `primary-dark`: `#1f5c41` (deep green)
- `primary-light`: `#eaf2ec` (green tint)
- `critical`: `#c0492f` (red)
- `low`: `#b07d18` (amber)
- `on-track`: `#2e7d5b` (green)
- `stocked`: `#1f5c41` (deep green)
- `text`: `#1c2620` (dark)
- `text-muted`: `#5e6b63` (muted gray)
- `surface`: `#ffffff` (white)
- `surface-alt`: `#fbfcfb` (light gray)
- `bg`: `#f1f4f0` (page background)

**Typography:**
- `font-sans`: Hanken Grotesk (UI text)
- `font-mono`: IBM Plex Mono (prices, counts, URLs)
- Font weights: 400, 500, 600, 700, 800

**Spacing & Radius:**
- Border radius: `xs` (8px), `sm` (9px), `md` (11px), `lg` (12px), `xl` (13px)
- Shadows: `card`, `focus` ring (defined in config)

---

## State Flow

### Real-Time Data (Convex Queries)
```
User navigates to /dashboard
  → useDemoHousehold() checks localStorage for householdId
  → useQuery(api.supplements.list, {householdId})
  → Convex subscription watches supplements table
  → Any change (Mark adds new supplement) → instant re-render for Lori
```

### UI State (Zustand, v2+)
For MVP, UI state is minimal (mostly local component state). In v2, consider Zustand for:
- Active tab on Costs page (Day/Month/Year)
- Sidebar collapse state
- Sort order on Buy page

### Demo Initialization
On first load, `useDemoHousehold()`:
1. Checks `localStorage` for saved `householdId`
2. If missing, calls `api.households.create("Mark & Lori")`
3. Creates 2 people (Mark, Lori)
4. Creates 2 sample supplements (Omega-3, Vitamin K2) with dosages
5. Stores householdId in localStorage (so it persists across sessions)

---

## Derived Values (Computed, Not Stored)

These are calculated on-the-fly in components or utility functions:

- **perDayPills**: Σ of `pillsPerDose × daysPerWeek / 7` for all dosages of a supplement
- **daysLeft**: `remaining / perDayPills`
- **runOutDate**: today + daysLeft
- **status**: based on daysLeft thresholds (critical ≤ 7, low ≤ 25, on-track ≤ 60, stocked > 60)
- **fillPct**: `remaining / jarSize × 100` (for pill-jar visual)
- **timelineBarPct**: `min(100, daysLeft / 160 × 100)` (for Gantt bar width)

---

## MVP Feature Checklist

### ✅ Done (MVP v1)
- [x] Convex schema (households, people, supplements, dosages)
- [x] Basic queries/mutations
- [x] Next.js app shell (dashboard layout, sidebar nav)
- [x] Dashboard page (pill-jar grid, stat cards, critical banner)
- [x] Supplements list page (view all supplements)
- [x] Add supplement page (paste-link-first flow, mocked lookup)
- [x] Demo household initialization (Mark & Lori + 2 sample supplements)
- [x] Design tokens (colors, fonts, spacing)
- [x] Real-time data subscription (Convex queries)

### 🚧 Deferred to v2
- [ ] People management page
- [ ] Costs breakdown page (daily/monthly cost per person)
- [ ] Buy price comparison page (retailer scraping, sorting)
- [ ] Real supplement lookup service integration
- [ ] Real price-scraping (Convex actions)
- [ ] Mobile responsive layouts (iPhone, iPad)
- [ ] User authentication (email/password sign-up)
- [ ] Invite household members (email sharing)
- [ ] Edit/delete supplement UI (partial—mutations exist)
- [ ] Dosage adjustment UI
- [ ] Image uploads
- [ ] Saved retailer sites management

---

## Next Steps to Finish MVP

1. **Install dependencies**: `npm install` (installs Next.js, Convex, Zustand, etc)
2. **Link to Convex**: `npx convex dev` (creates Convex project, returns `NEXT_PUBLIC_CONVEX_URL`)
3. **Set environment**: Add `NEXT_PUBLIC_CONVEX_URL` to `.env.local`
4. **Run dev server**: `npm run dev` (starts Next.js on localhost:3000)
5. **Test the flow**:
   - Navigate to http://localhost:3000/dashboard
   - Should auto-create demo household + supplements
   - Click "+ Add supplement" and test paste-link flow
   - Verify real-time sync by opening dashboard in two browser tabs

---

## Tailwind Custom Classes

Utility classes defined in `app/globals.css`:

```css
.btn-primary       /* primary green button */
.btn-outline       /* outlined text button */
.card              /* white card with border + shadow */
.status-critical   /* red pill for critical status */
.status-low        /* amber pill for low status */
.status-on-track   /* green pill for on-track status */
.status-stocked    /* deep green pill for stocked status */
```

---

## Notes & Gotchas

### Why Zustand isn't used yet
For MVP, Convex queries handle server state just fine. Zustand will be added in v2 for UI state (tabs, filters, sort order) that doesn't need real-time sync.

### Why no auth in MVP
Auth adds complexity. For now, demo household is stored in localStorage. Real auth + household sharing will be v2.

### Why mock lookup service
Real product lookup (scraping Amazon, Vitacost, etc) requires backend work. For MVP, mocked data validates UX. Convex actions will handle real lookup in v2.

### Why no images yet
Product images are placeholders. Real images come from user upload or lookup service in v2.

### Responsive design deferred
Sidebar + page layout assume desktop. Mobile nav (hamburger / bottom tab bar) comes in v2 after iPhone designs are finalized.

---

## Troubleshooting

**"Convex queries return `undefined`"**
- Make sure `.env.local` has `NEXT_PUBLIC_CONVEX_URL`
- Run `npx convex dev` to start the Convex backend
- Check that `useDemoHousehold()` has initialized (check browser console)

**"Pill bottles don't show fill percentage"**
- Check that `supplement.remaining` and `supplement.jarSize` are numbers
- Ensure `status` prop is one of: "critical", "low", "on-track", "stocked"

**"Layout looks broken (sidebar missing)"**
- Make sure you're on `/dashboard` route (not just `/`)
- Sidebar is only in `app/dashboard/layout.tsx`, not root layout

**"Demo data didn't auto-create"**
- Clear localStorage: `localStorage.clear()` in browser console, then refresh
- Check browser console for error logs from `useDemoHousehold()`

---

## Deployment

When ready to ship to Vercel:

1. Push repo to GitHub
2. Link Convex project via `convex.json` (team + project name)
3. Deploy to Vercel (auto-builds, links Convex)
4. Set `NEXT_PUBLIC_CONVEX_URL` as Vercel env var (from Convex dashboard)

No backend servers needed—Convex handles all API logic.
