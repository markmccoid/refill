import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh denormalized forecast caches daily so restock.badgeCount stays
// accurate even for households with no writes (time-only stock drain).
crons.daily(
  "refresh forecast caches",
  { hourUTC: 8, minuteUTC: 0 },
  internal.migrations.refreshAllForecastCaches
);

export default crons;
