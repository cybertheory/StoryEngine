import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "fandom autonomous scraper",
  { minutes: 5 },
  internal.fandomScraper.scraperTick
);

export default crons;
