# Future Features & Enhancements

## Add Supplement: Full Entry Form

### MVP Status
Currently, manual entry collects minimal fields:
- Name
- Pills in jar
- Remaining pills
- Price

### v2 Enhancement: Full Form
Expand manual entry to capture all product details at add time:

**Core Fields:**
- Name
- Brand
- Form (Softgel, Tablet, Powder, etc.)
- Pills in jar
- Remaining pills
- Price
- Purchase URL

**Optional Fields:**
- Image upload (drag-drop zone)
- Category (Essential fatty acid, Vitamin, Mineral, etc.)
- Serving size (e.g., "1 softgel")
- Serving amount (e.g., 1000 mg)
- Nutrients breakdown (EPA/DHA, etc.) — as array of {name, amount, unit}

**Design Reference:**
See `docs/Refill Tracker.dc.html` → "Add supplement: Form + auto-lookup panel" (screen 1c)

**Implementation Notes:**
- Form fields already exist in Convex schema (optional fields)
- Reuse existing `convex/supplements.ts` mutation (already accepts all fields)
- Add form validation (name required, pill counts must be numbers > 0)
- Consider rich image upload (drag-drop, preview before save)

---

## Dosage Management UI

### MVP Status
Dosages are stored in Convex but not editable via UI. People must be manually created.

### v2 Enhancement: Assign During Add
When adding a supplement, let users specify:
- Who takes it? (checkboxes for Mark, Lori, or add more people)
- How many pills per dose?
- How many days per week?

**Design:** Use chips/pills for people selection, spinners for numbers.

**After:** Redirect to supplement detail page showing dosages.

### v2+ Enhancement: Supplement Detail Page
Route: `/supplements/:id`
- View supplement info
- Edit name, price, remaining pills
- Manage dosages (add/edit/remove per person)
- Delete supplement
- View run-out forecast

---

## People Management

### MVP Status
Hardcoded: Mark (green) and Lori (amber) created on first load.

### v2 Enhancement: UI for Adding/Editing People
- `/people` page lists household members with avatars
- "+ Add person" form (name, avatar color)
- Edit person name/color
- Delete person (cascade: remove their dosages)

---

## Dashboard: Timeline (Gantt) View

### MVP Status
Dashboard shows pill-jar grid only (1b from design).

### v2 Enhancement: Gantt Timeline (1a from design)
Add a toggle on Dashboard header: "Jars" vs. "Timeline"

**Timeline view:**
- Horizontal bar chart showing run-out dates
- 6-month span (Jul–Dec or current month ± 5 months)
- One bar per supplement, color-coded by status
- Month gridlines
- Left gutter: supplement name + remaining count
- Right column: days until run-out

**Design Reference:**
See `docs/Refill Tracker.dc.html` → "Dashboard: Run-out timeline (Gantt)" (screen 1a)

---

## Costs Breakdown Page

### MVP Status
Route `/costs` is a placeholder.

### v2 Implementation: Cost Analysis
**Layout:**
- Header: "Based on current dosing for Mark & Lori"
- Toggle: Day / Month / Year (updates all figures)
- 3 summary cards:
  1. **Total**: big mono price, sub-text ($/day · $/year)
  2. **Mark**: avatar + mono price + $/day
  3. **Lori**: avatar + mono price + $/day
- Breakdown table:
  - Columns: Supplement | $ per pill | $ per day | $ per month | Taken by
  - One row per supplement
  - Total row at bottom

**Calculation:**
- `pricePerPill = price / jarSize`
- `perDayPills = Σ(pillsPerDose × daysPerWeek / 7)` for all dosages of that supplement
- `dailyCost = pricePerPill × perDayPills`
- `monthlyCost = dailyCost × 30.42`
- Per-person cost = sum of their share of each supplement's daily cost

**Design Reference:**
See `docs/Refill Tracker.dc.html` → "Costs" (screen 1e)

---

## Buy: Price Comparison Page

### MVP Status
Route `/buy` is a placeholder.

### v2 Implementation: Retailer Price Finder
**Route:** `/buy/:supplementId`

**Layout:**
- Header: product image (46px) + name + jar description
- Running-low alert banner (if daysLeft ≤ 7)
- **Sort tabs**: "Cheapest incl. shipping" (default) | "Fastest delivery"
- **Comparison table**:
  - Columns: Site | Sticker | Shipping | Total | Stock | Arrives | [action]
  - One row per retailer
  - Best row highlighted (green tint, deep-green total price)
  - Badges: "Best total + fastest" or "Lowest sticker"
  - Stock pill: green "In stock" or amber "Low stock"
  - "Buy" button per row
- **"Sites we check" panel** (dashed border):
  - List of saved retailer URLs (Amazon ✕, Vitacost ✕, etc.)
  - "+ Add a site URL" affordance
  - Users manage which sites get scraped

**Backend (Convex actions):**
- Real price scraping (fetch from Amazon, Vitacost, iHerb, etc.)
- Async per-site fetching (may take 2–5 seconds)
- Upsert `priceQuotes` table with results
- Handle rate-limiting and errors (show "unavailable" if scrape fails)

**Design Reference:**
See `docs/Refill Tracker.dc.html` → "Buy: Best-price finder" (screen 1f)

---

## Real Product Lookup Service

### MVP Status
Supplement lookup is mocked (returns hardcoded Omega-3 data for any URL).

### v2 Implementation
**Goal:** Paste a URL → auto-fill name, brand, form, nutrients, image, etc.

**Options:**
1. **Product DB API** (e.g., Open Food Facts, ProductHunt API)
   - Free/open data
   - Limited supplement coverage
   - Fast, no scraping needed

2. **Lightweight scraping** (Cheerio/jsdom)
   - Parse Amazon/Vitacost/iHerb product pages
   - Extract title, image, price, description
   - Server-side in Convex action
   - Handle IP bans / rate limits

3. **Third-party lookup service** (e.g., Keepa, CamelCamelCamel for Amazon)
   - Paid APIs
   - High accuracy and coverage
   - Slower (depends on service)

**Recommended approach:** Start with option 2 (lightweight scraping in Convex action), fallback to manual entry if scrape fails.

**Implementation:**
- Convex action: `export const lookupProduct = action({...})`
- Accept URL as input
- Fetch & parse HTML
- Return `{ name, brand, form, imageUrl, nutrients?, category? }`
- Frontend mutation called on "Look up" button

---

## Image Upload & Storage

### MVP Status
Images are URLs only (no upload, no file storage).

### v2 Implementation
**Option 1: Convex File Storage**
- Built-in, no third-party vendor lock
- Store images directly in Convex
- Reference via URL

**Option 2: External (Cloudinary, AWS S3)**
- More scalable for large households
- Requires API keys

**Recommended:** Convex file storage (simpler for MVP scale).

**Implementation:**
- Add `<input type="file" />` to Add Supplement form
- Use Convex mutation to store file + return URL
- Update supplement schema: `imageUrl` stores Convex file URL

---

## Mobile Responsive Layouts

### MVP Status
Desktop-only (sidebar + full-width main).

### v2 Implementation
**iPhone/iPad layouts** (not yet designed in handoff):
- Sidebar → hamburger menu or bottom tab bar
- Multi-column grids → single column (jars, cost cards)
- Tables → card stacks
- Adjust typography scale (smaller on mobile)

**Breakpoints:**
- Desktop: 1024px+
- Tablet: 640px–1024px
- Mobile: < 640px

**Flag to designer:** Request iPhone mockups before mobile build.

---

## User Authentication & Household Sharing

### MVP Status
Demo household created in localStorage; no real auth.

### v2 Implementation
**Goals:**
- Mark can sign up with email/password
- Lori can join Mark's household via invite link
- Real-time sync via Convex subscriptions
- Each person has own login, shares one household

**Implementation:**
- Convex auth (built-in, Clerk integration optional)
- Add `users` table (email, householdId)
- Middleware to check auth on each route
- Invite flow: generate shareable link, Lori clicks → joins household

**Design:** Login page, household join screen (minimal UI, not in current handoff).

---

## Notification & Alerts

### MVP Status
None.

### v2 Enhancement
- Email reminder when supplement runs low (5 days left)
- Optional: SMS alerts
- Optional: In-app toast notifications for real-time changes

---

## Export & Reporting

### v2+ Enhancement
- Export supplement list as CSV
- Generate monthly cost report (PDF)
- Share household inventory with healthcare provider

---

## Settings & Preferences

### v2+ Enhancement
- Units preference (mg vs. mcg vs. IU)
- Currency preference (USD, EUR, etc.)
- Notification frequency
- Theme (light/dark mode)
- Archive old supplements (soft-delete)

---

## Accessibility

### MVP Status
Basic semantic HTML, but no A11y audit.

### v2 Enhancement
- WCAG 2.1 AA compliance
- Screen reader testing
- Keyboard navigation
- Color contrast check (status pills, charts)
- Focus management (modals, forms)
