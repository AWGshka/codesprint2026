import { DonationService } from "./service";
import { CreateDonationBody, CreateDonationResponse, DonationExportQuery, DonationListQuery, DonationListResponse, DonationReceiptSchema, ReferenceParams } from "./model";

import { Elysia, t } from "elysia";

import { toCsv } from "~/lib/csv";
import { paginate } from "~/lib/pagination";
import { parsePages } from "~/lib/pages";
import { data, ok } from "~/lib/response";
import { AppError } from "~/lib/errors";
import { authPlugin } from "~/plugins/auth";
import { SlugParams } from "~/modules/campaigns/model";

const EXPORT_HEADERS = [
  "reference",
  "campaignName",
  "donorName",
  "donorEmail",
  "amountMinor",
  "currency",
  "frequency",
  "status",
  "source",
  "paymentRef",
  "createdAt",
];

export const donations = new Elysia({ name: "donations" })
  .use(authPlugin)
  // Public — simulated payment + receipt
  .post("/campaigns/:slug/donations", async ({ params, body }) => ok(await DonationService.create(params.slug, body)), {
    params: SlugParams,
    body: CreateDonationBody,
    response: { 200: data(CreateDonationResponse) },
    detail: { summary: "Create a donation (simulated payment; 402 on decline)", tags: ["Donations"] },
  })
  .get("/campaigns/:slug/donations/:reference", async ({ params }) => ok(await DonationService.getReceipt(params.slug, params.reference)), {
    params: ReferenceParams,
    response: { 200: data(DonationReceiptSchema) },
    detail: { summary: "Donation receipt by reference", tags: ["Donations"] },
  })
  // Admin — ledger
  .get("/admin/donations", async ({ query }) => ok(await DonationService.listAdmin(query)), {
    auth: true,
    permissions: { donation: ["read"] },
    query: DonationListQuery,
    response: { 200: data(DonationListResponse) },
    detail: { summary: "Donation ledger (filters, sort, pagination)", tags: ["Admin", "Donations"] },
  })
  .get(
    "/admin/donations/export.csv",
    async ({ query, user, set }) => {
      const { pages: pagesParam, ...filters } = query;

      let rows: Awaited<ReturnType<typeof DonationService.listForExport>>;
      if (pagesParam) {
        let pages: number[];
        try {
          pages = parsePages(pagesParam);
        } catch {
          throw new AppError(400, "INVALID_PAGES", 'Invalid "pages" query param — expected e.g. "2" or "1-3,5"');
        }
        const { pageSize } = paginate(1, filters.pageSize);
        rows = await DonationService.listForExportPages(filters, pages, pageSize);
      } else {
        rows = await DonationService.listForExport(filters);
      }

      await DonationService.recordExportAudit({ id: user.id, email: user.email }, rows.length, filters);

      const csv = toCsv(
        EXPORT_HEADERS,
        rows.map((r) => [
          r.reference,
          r.campaignName,
          r.donorName ?? "Guest",
          r.donorEmail ?? "",
          r.amountMinor,
          r.currency,
          r.frequency,
          r.status,
          r.source,
          r.paymentRef,
          r.createdAt,
        ]),
      );

      set.headers["content-type"] = "text/csv; charset=utf-8";
      set.headers["content-disposition"] = 'attachment; filename="donations-export.csv"';
      return csv;
    },
    {
      auth: true,
      permissions: { donation: ["export"] },
      query: DonationExportQuery,
      response: { 200: t.String() },
      detail: { summary: "Stream the filtered ledger as CSV (capped, audited)", tags: ["Admin", "Donations"] },
    },
  );
