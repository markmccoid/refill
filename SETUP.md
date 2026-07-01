# Quick Setup Guide

## Prerequisites
- Node.js 18+ installed
- GitHub account (for deployment later)
- Vercel account (for deployment later)

## Local Development

### 1. Install Dependencies
```bash
npm install
```

This installs:
- Next.js 15
- Convex (real-time backend)
- Tailwind CSS (styling)
- TypeScript
- Zustand (for v2+ state management)

### 2. Link to Convex
```bash
npx convex dev
```

This will:
- Prompt you to log in to Convex (creates account if needed)
- Create a new Convex project (or link to existing one)
- Output your `NEXT_PUBLIC_CONVEX_URL`
- Watch `convex/` for changes and auto-deploy

### 3. Create `.env.local`
Copy the Convex URL from step 2:
```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and paste your URL:
```
NEXT_PUBLIC_CONVEX_URL=https://your-team-name.convex.cloud
```

### 4. Start Development Server
In a new terminal:
```bash
npm run dev
```

Opens at `http://localhost:3000`

### 5. Test the App
1. Navigate to http://localhost:3000/dashboard
2. You should see:
   - Demo household "Mark & Lori" auto-created
   - 2 sample supplements (Omega-3 Fish Oil, Vitamin K2)
   - Pill-jar grid showing supplement fill levels
3. Try:
   - Click "+ Add supplement"
   - Paste any URL and click "Look up"
   - See mocked product data fill in
   - Click "Add to shelf" to save

### 6. Open Two Browser Tabs (Optional)
To test real-time sync:
1. Open http://localhost:3000/dashboard in two browser windows
2. In tab A, click "+ Add supplement", add a new one
3. In tab B, the supplement list updates instantly (no refresh needed)

---

## Project Structure Quick Ref

```
app/              Next.js pages & layout
convex/           Data schema & queries
components/       Reusable React components
hooks/            Custom React hooks
lib/              Utility functions
```

See `DOCS.md` for detailed architecture.

---

## First Build Task: Fix Tailwind Border Color

The global CSS references a `border-border` color that needs to be defined. Edit `tailwind.config.ts` and add:

```typescript
"border": "rgba(20, 40, 30, 0.07)"
```

to the `colors` object in `theme.extend`.

---

## Common Commands

```bash
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run convex:dev       # Start Convex backend only
npm run convex:codegen   # Generate Convex types
```

---

## Troubleshooting

**Port 3000 already in use?**
```bash
npm run dev -- -p 3001
```

**Convex not syncing?**
```bash
npx convex dev --clear-db  # Reset database & resync
```

**Types not generated?**
```bash
npm run convex:codegen
```

---

## Next: Review DOCS.md

For full architecture, data schema, component breakdown, and deferred features—see `DOCS.md`.
