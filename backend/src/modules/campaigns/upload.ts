import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "~/db";
import { campaigns } from "~/db/campaigns";
import { authPlugin } from "~/plugins/auth";
import { ok } from "~/lib/response";
import { BadRequest, NotFound } from "~/lib/errors";

const UPLOAD_DIR = "./data/uploads";
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

const extFromMime = (mime: string): string => {
  if (mime === "image/svg+xml") return ".svg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/png") return ".png";
  return ".jpg";
};

export const campaignUpload = new Elysia({ name: "campaign-upload" })
  .use(authPlugin)
  .post(
    "/admin/campaigns/:id/logo",
    async ({ params, body }) => {
      const file = body.logo;
      if (!file || !(file instanceof Blob)) throw BadRequest("No file uploaded", { field: "logo" });
      if (!ALLOWED_TYPES.has(file.type)) throw BadRequest("Only PNG, JPG, WebP and SVG images are allowed", { field: "logo" });
      if (file.size > MAX_SIZE) throw BadRequest("File too large (max 2 MB)", { field: "logo" });

      const [campaign] = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, params.id)).limit(1);
      if (!campaign) throw NotFound("Campaign not found");

      // Ensure upload directory exists
      await Bun.write(`${UPLOAD_DIR}/.keep`, "");

      const filename = `${crypto.randomUUID()}${extFromMime(file.type)}`;
      const path = `${UPLOAD_DIR}/${filename}`;
      await Bun.write(path, file);

      const logoUrl = `/uploads/${filename}`;
      await db.update(campaigns).set({ logoUrl }).where(eq(campaigns.id, params.id));

      return ok({ logoUrl });
    },
    {
      auth: true,
      permissions: { campaign: ["update"] },
      params: t.Object({ id: t.String() }),
      type: "multipart/form-data",
      body: t.Object({ logo: t.File() }),
      detail: { summary: "Upload campaign logo image", tags: ["Admin", "Campaigns"] },
    },
  );
