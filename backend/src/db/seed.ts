// Idempotent seed — run with `bun run db:seed`. Guarded by a count check on
// `campaigns`; a second run logs "already seeded" and exits without inserting
// anything twice.
//
// EXPECTED RECONCILIATION COUNTS (drives the /admin/reconciliation demo):
//   exact matches       = all "completed" donations that got a mirrored
//                         settlement with the same paymentRef/amount/currency;
//                         all but 6 arrive pre-reconciled (persisted matches)
//   missingInProcessor  = 3   (completed donations with NO settlement row)
//   missingInApp        = 3   (settlement rows with NO matching donation)
//   mismatched          = 3   (settlement exists but amountMinor differs)
//   awaiting            = 6 exact + the 9 discrepancies above
// Total processor_settlements rows = (# completed donations) - 3 (missing) + 3 (mismatch, still 1:1) + 3 (extra missingInApp)
// i.e. settlements = completedDonations - missingInProcessor + missingInApp.
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { auth } from "~/auth";
import { user } from "~/db/auth-schema";
import { auditLogs } from "~/db/audit-logs";
import { processorSettlements } from "~/db/processor-settlements";
import { reconciliationMatches } from "~/db/reconciliation-matches";
import { type CampaignStatus, type Frequency, campaigns } from "~/db/campaigns";
import { type DonationSource, type DonationStatus, donations } from "~/db/donations";

// Small deterministic PRNG (mulberry32) so re-seeding a fresh DB always
// produces the same demo data — makes the discrepancy counts above exact.
const mulberry32 = (seed: number) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const rand = mulberry32(20260702);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
const randomInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const base36 = (length: number) =>
  Array.from({ length }, () => Math.floor(rand() * 36).toString(36))
    .join("")
    .toUpperCase();

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 4) || "GT";

const daysAgo = (days: number, hourOffset = 0) => new Date(Date.now() - days * 86_400_000 - hourOffset * 3_600_000);
const daysAhead = (days: number) => new Date(Date.now() + days * 86_400_000);

type CampaignSeed = {
  slug: string;
  name: string;
  cause: string;
  description: string;
  story?: string;
  targetMinor: number;
  currency: "EUR" | "USD" | "GBP";
  status: CampaignStatus;
  brandColor: string;
  logoUrl?: string;
  presetsMinor: number[];
  frequencies: Frequency[];
};

const CAMPAIGN_SEEDS: CampaignSeed[] = [
  {
    slug: "global-relief",
    name: "Global Relief Fund",
    cause: "Disaster relief",
    description: "Emergency aid for communities hit by natural disasters.",
    story: "When the ground shakes or the waters rise, we're first on the scene.",
    targetMinor: 5_000_000,
    currency: "EUR",
    status: "active",
    brandColor: "#0E8C7A",
    logoUrl: "🌍",
    presetsMinor: [1000, 2500, 5000, 10000],
    frequencies: ["one_time", "monthly"],
  },
  {
    slug: "blue-cross",
    name: "Blue Cross Animal Welfare",
    cause: "Animal welfare",
    description: "Rescue, rehabilitation and rehoming for abandoned animals.",
    targetMinor: 2_000_000,
    currency: "GBP",
    status: "active",
    brandColor: "#1E6FB8",
    logoUrl: "🐾",
    presetsMinor: [500, 1500, 3000, 6000],
    frequencies: ["one_time", "monthly"],
  },
  {
    slug: "hope-children",
    name: "Hope Children's Trust",
    cause: "Children",
    description: "Education and healthcare access for children in need.",
    story: "Every child deserves a fair start — Hope gets them there.",
    targetMinor: 3_500_000,
    currency: "USD",
    status: "active",
    brandColor: "#B23A6B",
    logoUrl: "🧒",
    presetsMinor: [1000, 2000, 5000, 10000],
    frequencies: ["one_time", "monthly"],
  },
  {
    slug: "clean-water",
    name: "Clean Water Initiative",
    cause: "Environment",
    description: "Wells and filtration systems for water-scarce regions.",
    targetMinor: 4_000_000,
    currency: "EUR",
    status: "active",
    brandColor: "#0B6857",
    logoUrl: "💧",
    presetsMinor: [1000, 2500, 5000, 15000],
    frequencies: ["one_time"],
  },
  {
    slug: "food-bank-mt",
    name: "Food Bank Malta",
    cause: "Hunger relief",
    description: "Weekly food parcels for families across the Maltese islands.",
    targetMinor: 1_200_000,
    currency: "EUR",
    status: "paused",
    brandColor: "#C43D3D",
    logoUrl: "🍞",
    presetsMinor: [500, 1000, 2500, 5000],
    frequencies: ["one_time", "monthly"],
  },
  {
    slug: "cancer-research",
    name: "Cancer Research Drive",
    cause: "Health",
    description: "Funding early-stage cancer research and patient support.",
    targetMinor: 6_000_000,
    currency: "USD",
    status: "active",
    brandColor: "#7A3FA0",
    logoUrl: "🎗️",
    presetsMinor: [2000, 5000, 10000, 25000],
    frequencies: ["one_time", "monthly"],
  },
  {
    slug: "education-all",
    name: "Education For All",
    cause: "Education",
    description: "School supplies and scholarships for underserved students.",
    targetMinor: 1_800_000,
    currency: "GBP",
    status: "draft",
    brandColor: "#0E8C7A",
    logoUrl: "📚",
    presetsMinor: [500, 1000, 2500, 5000],
    frequencies: ["one_time"],
  },
  {
    slug: "elderly-care",
    name: "Elderly Care Fund",
    cause: "Elderly support",
    description: "Home visits, meals, and companionship for isolated seniors.",
    targetMinor: 900_000,
    currency: "EUR",
    status: "ended",
    brandColor: "#B4780F",
    logoUrl: "🤝",
    presetsMinor: [500, 1000, 2000, 4000],
    frequencies: ["one_time", "monthly"],
  },
  {
    slug: "refugee-support",
    name: "Refugee Support Network",
    cause: "Refugees",
    description: "Shelter, legal aid, and integration support for refugees.",
    targetMinor: 3_000_000,
    currency: "USD",
    status: "active",
    brandColor: "#1E6FB8",
    logoUrl: "🏠",
    presetsMinor: [1000, 2500, 5000, 10000],
    frequencies: ["one_time", "monthly"],
  },
  {
    slug: "shelter-rebuild",
    name: "Local Shelter Rebuild",
    cause: "Housing",
    description: "Rebuilding a community shelter damaged by storms.",
    targetMinor: 2_500_000,
    currency: "GBP",
    status: "paused",
    brandColor: "#188A5E",
    logoUrl: "🔨",
    presetsMinor: [1000, 2000, 5000, 10000],
    frequencies: ["one_time"],
  },
  {
    slug: "youth-sports",
    name: "Youth Sports Fund",
    cause: "Youth development",
    description: "Equipment and coaching for underfunded youth sports clubs.",
    targetMinor: 800_000,
    currency: "EUR",
    status: "active",
    brandColor: "#B23A6B",
    logoUrl: "⚽",
    presetsMinor: [500, 1000, 2000, 4000],
    frequencies: ["one_time"],
  },
  {
    slug: "wildlife-conservation",
    name: "Wildlife Conservation Alliance",
    cause: "Wildlife",
    description: "Protecting endangered species and their habitats.",
    targetMinor: 4_500_000,
    currency: "USD",
    status: "active",
    brandColor: "#0E8C7A",
    logoUrl: "🦁",
    presetsMinor: [1500, 3000, 7500, 15000],
    frequencies: ["one_time", "monthly"],
  },
];

const DEMO_USERS = [
  { username: "auditor", firstName: "Vera", lastName: "Vella", role: "auditor" as const },
  { username: "volunteer", firstName: "Mario", lastName: "Grech", role: "volunteer" as const },
  { username: "admin", firstName: "Alexandra", lastName: "Borg", role: "admin" as const },
];
const DEMO_PASSWORD = "demo1234";
const demoName = (u: (typeof DEMO_USERS)[number]) => `${u.firstName} ${u.lastName}`;

const seed = async () => {
  // Backfill first/last name on pre-existing demo users (idempotent reruns
  // and upgrades from a DB seeded before first/last name existed) — this
  // runs even if the full seed below is skipped because campaigns already
  // exist.
  for (const demoUser of DEMO_USERS) {
    const existing = await db.query.user.findFirst({ where: eq(user.username, demoUser.username) });
    if (existing && !existing.firstName) {
      await db
        .update(user)
        .set({ firstName: demoUser.firstName, lastName: demoUser.lastName, name: demoName(demoUser) })
        .where(eq(user.id, existing.id));
      console.log(`Backfilled name for existing user "${demoUser.username}" -> ${demoName(demoUser)}.`);
    }
  }

  const existingCampaigns = await db.$count(campaigns);
  if (existingCampaigns > 0) {
    console.log("Already seeded (campaigns table not empty) — skipping.");
    return;
  }

  // 1. Demo users (username/password login, roles via the admin plugin).
  // Created through Better Auth's server API (no session headers => the
  // request is treated as trusted/server-side, bypassing the normal
  // permission checks that would otherwise gate role assignment).
  console.log("Seeding demo users...");
  for (const demoUser of DEMO_USERS) {
    await auth.api.createUser({
      body: {
        email: `${demoUser.username}@demo.gt`,
        password: DEMO_PASSWORD,
        name: demoName(demoUser),
        role: demoUser.role,
        data: { username: demoUser.username, displayUsername: demoUser.username, firstName: demoUser.firstName, lastName: demoUser.lastName },
      },
    });
  }

  const adminUserRow = await db.query.user.findFirst({ where: eq(user.username, "admin") });
  const volunteerUserRow = await db.query.user.findFirst({ where: eq(user.username, "volunteer") });
  if (!adminUserRow || !volunteerUserRow) throw new Error("Seed failed: demo users were not created.");

  // 2. Campaigns — 12 across EUR/USD/GBP, varied status/branding/presets/frequencies.
  console.log("Seeding campaigns...");
  const insertedCampaigns = await db
    .insert(campaigns)
    .values(
      CAMPAIGN_SEEDS.map((c, i) => ({
        slug: c.slug,
        name: c.name,
        cause: c.cause,
        description: c.description,
        story: c.story ?? null,
        targetMinor: c.targetMinor,
        currency: c.currency,
        status: c.status,
        brandColor: c.brandColor,
        logoUrl: c.logoUrl ?? null,
        heroImageUrl: null,
        presetsMinor: c.presetsMinor,
        allowCustom: true,
        frequencies: c.frequencies,
        // Run window: ended campaigns closed recently; live ones run into the
        // future, staggered per index so lists show varied dates.
        startsAt: c.status === "ended" ? daysAgo(180) : daysAgo(30 + i * 5),
        endsAt: c.status === "ended" ? daysAgo(10) : daysAhead(60 + i * 10),
        createdBy: i % 2 === 0 ? adminUserRow.id : volunteerUserRow.id,
      })),
    )
    .returning();

  // 3. Donations — 260 spread over ~90 days, mixed currency/frequency/status/source.
  // Only non-draft campaigns receive donations (draft campaigns are never public).
  console.log("Seeding donations...");
  const publishedCampaigns = insertedCampaigns.filter((c) => c.status !== "draft");
  const usedReferences = new Set<string>();
  const donationRows: (typeof donations.$inferInsert)[] = [];
  const DONATION_COUNT = 260;
  const STATUS_WEIGHTS: DonationStatus[] = [
    ...Array(88).fill("completed"),
    ...Array(5).fill("declined"),
    ...Array(3).fill("refunded"),
    ...Array(4).fill("offline"),
  ];
  const SOURCE_WEIGHTS: DonationSource[] = [...Array(7).fill("web"), ...Array(3).fill("kiosk")];
  const CURRENCIES = ["EUR", "USD", "GBP"] as const;
  const DONOR_NAMES = ["Alex Kit", "Sam Farrugia", "Jordan Micallef", "Maria Vella", "Chen Wei", "Fatima Zahra", "Liam Borg", "Nora Grech"];

  for (let i = 0; i < DONATION_COUNT; i++) {
    const campaign = pick(publishedCampaigns);
    const CAMP = initials(campaign.name);
    let reference = `${CAMP}-${base36(4)}`;
    while (usedReferences.has(reference)) reference = `${CAMP}-${base36(4)}`;
    usedReferences.add(reference);

    // Usually give in the campaign's own currency; occasionally the donor
    // switches currency via the currency selector.
    const currency = rand() < 0.85 ? campaign.currency : pick(CURRENCIES);
    const frequency = pick(campaign.frequencies as Frequency[]);
    const preset = pick(campaign.presetsMinor as number[]);
    const status = pick(STATUS_WEIGHTS);
    const source = pick(SOURCE_WEIGHTS);
    const createdAt = daysAgo(randomInt(0, 89), randomInt(0, 23));
    const guest = rand() < 0.35;

    // Donor choices: ~15% rounded up to the next €10-equivalent, named donors
    // sometimes tick Gift Aid and the supporters wall.
    const roundedUp = rand() < 0.15;
    const rawAmount = rand() < 0.7 ? preset : randomInt(300, 20000);
    const amountMinor = roundedUp ? Math.ceil(rawAmount / 1000) * 1000 : rawAmount;

    donationRows.push({
      reference,
      campaignId: campaign.id,
      donorName: guest ? null : pick(DONOR_NAMES),
      donorEmail: guest ? null : `donor${i}@example.com`,
      amountMinor,
      currency,
      frequency,
      status,
      source,
      method: source === "kiosk" ? "tap" : "card",
      roundedUp,
      giftAid: !guest && rand() < 0.3,
      showOnWall: !guest && rand() < 0.6,
      paymentRef: crypto.randomUUID(),
      createdAt,
    });
  }

  await db.insert(donations).values(donationRows);

  // 4. Processor settlements — mirror completed donations, with deliberate
  // discrepancies (see the header comment for expected counts).
  console.log("Seeding processor settlements...");
  const completed = donationRows.filter((d) => d.status === "completed");
  const shuffled = [...completed].sort(() => rand() - 0.5);

  const MISSING_IN_PROCESSOR = 3; // completed donations with no settlement
  const MISMATCHED = 3; // settlement exists but amount differs
  const MISSING_IN_APP = 3; // settlement rows with no donation

  const missingInProcessorRefs = new Set(shuffled.slice(0, MISSING_IN_PROCESSOR).map((d) => d.paymentRef));
  const mismatchedRefs = new Set(shuffled.slice(MISSING_IN_PROCESSOR, MISSING_IN_PROCESSOR + MISMATCHED).map((d) => d.paymentRef));

  const settlementRows: (typeof processorSettlements.$inferInsert)[] = [];
  for (const donation of completed) {
    if (missingInProcessorRefs.has(donation.paymentRef as string)) continue; // missingInProcessor

    const isMismatch = mismatchedRefs.has(donation.paymentRef as string);
    settlementRows.push({
      paymentRef: donation.paymentRef as string,
      amountMinor: isMismatch ? (donation.amountMinor as number) + randomInt(100, 500) : (donation.amountMinor as number),
      currency: donation.currency as string,
      status: "settled",
      processedAt: donation.createdAt as Date,
    });
  }

  // missingInApp — settlements with no matching donation at all.
  for (let i = 0; i < MISSING_IN_APP; i++) {
    settlementRows.push({
      paymentRef: crypto.randomUUID(),
      amountMinor: randomInt(500, 10000),
      currency: pick(CURRENCIES),
      status: "settled",
      processedAt: daysAgo(randomInt(0, 89)),
    });
  }

  await db.insert(processorSettlements).values(settlementRows);

  // 5. Persisted reconciliation state: most exact matches arrive pre-reconciled
  // (as if auto-match ran on an earlier batch), leaving AWAITING_EXACT exact
  // pairs + all 9 discrepancies awaiting review — so both "Auto-match all" and
  // per-row "Reconcile" have something to do in the demo.
  console.log("Seeding reconciliation matches...");
  const AWAITING_EXACT = 6;
  const exactRefs = completed.map((d) => d.paymentRef as string).filter((ref) => !missingInProcessorRefs.has(ref) && !mismatchedRefs.has(ref));
  const preMatchedRefs = exactRefs.slice(0, Math.max(0, exactRefs.length - AWAITING_EXACT));
  if (preMatchedRefs.length > 0) {
    await db
      .insert(reconciliationMatches)
      .values(preMatchedRefs.map((paymentRef) => ({ paymentRef, method: "auto" as const, matchedBy: "admin@demo.gt", createdAt: daysAgo(randomInt(1, 30)) })));
  }

  // 6. A couple of audit rows so /admin/audit has something to show from day one.
  console.log("Seeding audit log seed rows...");
  await db.insert(auditLogs).values([
    {
      actorId: adminUserRow.id,
      actorEmail: `admin@demo.gt`,
      action: "campaign.create",
      targetType: "campaign",
      targetId: insertedCampaigns[0]?.id ?? null,
      metadata: { seed: true },
      createdAt: daysAgo(89),
    },
    {
      actorId: volunteerUserRow.id,
      actorEmail: `volunteer@demo.gt`,
      action: "auth.login",
      targetType: "auth",
      targetId: volunteerUserRow.id,
      metadata: { seed: true },
      createdAt: daysAgo(1),
    },
  ]);

  console.log(
    `Seed complete: ${DEMO_USERS.length} users, ${insertedCampaigns.length} campaigns, ${donationRows.length} donations, ${settlementRows.length} settlements ` +
      `(missingInProcessor=${MISSING_IN_PROCESSOR}, missingInApp=${MISSING_IN_APP}, mismatched=${MISMATCHED}, preMatched=${preMatchedRefs.length}).`,
  );
};

await seed();
