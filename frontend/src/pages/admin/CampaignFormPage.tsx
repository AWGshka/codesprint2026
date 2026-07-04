import { useNavigate, useParams } from "@solidjs/router";

import type { Component } from "solid-js";
import { For, Show, createEffect, createResource, createSignal } from "solid-js";

import { t } from "~/shared/i18n";
import { adminCreateCampaign, adminGetCampaign, adminUpdateCampaign } from "~/shared/api";
import type { CampaignStatus, CreateCampaignBody, CurrencyCode, DonationFrequency } from "~/shared/api";
import { Button, Card, Checkbox, ErrorState, Field, Input, Select, Skeleton, showToast } from "~/shared/ui";

const emptyForm: CreateCampaignBody = {
  slug: "",
  name: "",
  cause: "",
  description: "",
  story: "",
  targetMinor: 100000,
  currency: "EUR",
  status: "draft",
  brandColor: "#0E8C7A",
  presetsMinor: [1000, 2500, 5000],
  allowCustom: true,
  frequencies: ["one_time"],
};

const FREQUENCIES: DonationFrequency[] = ["one_time", "monthly"];
const frequencyLabelKey: Record<DonationFrequency, "donor.oneTime" | "donor.monthly"> = { one_time: "donor.oneTime", monthly: "donor.monthly" };

/** ISO timestamp → the `yyyy-mm-dd` a date input needs (empty when unset). */
const toDateInput = (iso?: string | null): string => (iso ? iso.slice(0, 10) : "");
const CURRENCIES: CurrencyCode[] = ["EUR", "USD", "GBP"];
const STATUSES: CampaignStatus[] = ["draft", "active", "paused", "ended"];

const CampaignFormPage: Component = () => {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = () => Boolean(params.id);

  const [existing] = createResource(
    () => params.id,
    (id) => (id ? adminGetCampaign(id) : Promise.resolve(undefined)),
  );

  const [form, setForm] = createSignal<CreateCampaignBody>(emptyForm);
  const [presetsText, setPresetsText] = createSignal("10, 25, 50");
  const [startsAt, setStartsAt] = createSignal("");
  const [endsAt, setEndsAt] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let hydrated = false;

  createEffect(() => {
    const c = existing();
    if (c && !hydrated) {
      hydrated = true;
      setForm({ ...c, story: c.story ?? "", logoUrl: c.logoUrl ?? undefined, heroImageUrl: c.heroImageUrl ?? undefined });
      setPresetsText(c.presetsMinor.map((m) => (m / 100).toString()).join(", "));
      setStartsAt(toDateInput(c.startsAt));
      setEndsAt(toDateInput(c.endsAt));
    }
  });

  const toggleFrequency = (freq: DonationFrequency) => {
    setForm((f) => ({ ...f, frequencies: f.frequencies.includes(freq) ? f.frequencies.filter((x) => x !== freq) : [...f.frequencies, freq] }));
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    setError(undefined);
    setSaving(true);
    try {
      const presetsMinor = presetsText()
        .split(",")
        .map((s) => Math.round(Number.parseFloat(s.trim()) * 100))
        .filter((n) => Number.isFinite(n) && n > 0);
      const body: CreateCampaignBody = {
        ...form(),
        presetsMinor,
        // Date inputs → ISO timestamps; empty means an open-ended campaign.
        startsAt: startsAt() ? new Date(startsAt()).toISOString() : null,
        endsAt: endsAt() ? new Date(endsAt()).toISOString() : null,
      };
      if (isEdit() && params.id) await adminUpdateCampaign(params.id, body);
      else await adminCreateCampaign(body);
      showToast(t("admin.save"), "success");
      navigate("/admin/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="max-w-2xl space-y-5">
      <h1 class="font-display text-h1 font-semibold text-fg">{isEdit() ? t("admin.editCampaign") : t("admin.newCampaign")}</h1>

      <Show when={!isEdit() || !existing.loading} fallback={<Skeleton variant="block" class="h-96" />}>
        <Show when={!isEdit() || existing()} fallback={<ErrorState error={existing.error} />}>
          <Card padding="lg">
            <form class="space-y-4" onSubmit={submit}>
              <div class="grid grid-cols-2 gap-3">
                <Field label={t("admin.name")} required>
                  <Input required value={form().name} onInput={(e) => setForm({ ...form(), name: e.currentTarget.value })} />
                </Field>
                <Field label={t("admin.slug")} required hint={t("admin.slugHint")}>
                  <Input required value={form().slug} onInput={(e) => setForm({ ...form(), slug: e.currentTarget.value })} />
                </Field>
              </div>
              <Field label={t("admin.cause")} required>
                <Input required value={form().cause} onInput={(e) => setForm({ ...form(), cause: e.currentTarget.value })} />
              </Field>
              <Field label={t("admin.description")} required>
                <textarea
                  required
                  class="w-full rounded-md border border-border-strong bg-surface-raised px-3 py-2.5 font-sans text-body text-fg focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/20"
                  rows="3"
                  value={form().description}
                  onInput={(e) => setForm({ ...form(), description: e.currentTarget.value })}
                />
              </Field>
              <Field label={t("admin.story")}>
                <textarea
                  class="w-full rounded-md border border-border-strong bg-surface-raised px-3 py-2.5 font-sans text-body text-fg focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/20"
                  rows="2"
                  value={form().story ?? ""}
                  onInput={(e) => setForm({ ...form(), story: e.currentTarget.value })}
                />
              </Field>

              <div class="grid grid-cols-3 gap-3">
                <Field label={t("admin.targetAmount")} required>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={form().targetMinor / 100}
                    onInput={(e) => setForm({ ...form(), targetMinor: Math.round(Number.parseFloat(e.currentTarget.value || "0") * 100) })}
                  />
                </Field>
                <Field label={t("admin.currency")}>
                  <Select
                    options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                    value={form().currency}
                    onChange={(e) => setForm({ ...form(), currency: e.currentTarget.value as CurrencyCode })}
                  />
                </Field>
                <Field label={t("admin.status")}>
                  <Select
                    options={STATUSES.map((s) => ({ value: s, label: s }))}
                    value={form().status}
                    onChange={(e) => setForm({ ...form(), status: e.currentTarget.value as CampaignStatus })}
                  />
                </Field>
              </div>

              <Field label={t("admin.brandColor")}>
                <div class="flex items-center gap-2">
                  <input
                    type="color"
                    class="size-10 rounded-md border border-border-strong"
                    value={form().brandColor}
                    onInput={(e) => setForm({ ...form(), brandColor: e.currentTarget.value })}
                  />
                  <Input value={form().brandColor} onInput={(e) => setForm({ ...form(), brandColor: e.currentTarget.value })} />
                </div>
              </Field>

              <Field label={t("admin.logo")} hint={t("admin.logoHint")}>
                <div class="flex items-center gap-3">
                  <Input
                    class="max-w-24"
                    maxlength={2}
                    value={form().logoUrl ?? ""}
                    onInput={(e) => setForm({ ...form(), logoUrl: e.currentTarget.value || undefined })}
                    placeholder="🌍"
                  />
                  <span
                    class="inline-flex size-10 items-center justify-center rounded-lg text-base font-bold"
                    style={{ background: form().brandColor, color: "#fff" }}>
                    {form().logoUrl || form().name.slice(0, 2).toUpperCase() || "GT"}
                  </span>
                </div>
              </Field>

              <div class="grid grid-cols-2 gap-3">
                <Field label={t("admin.startDate")}>
                  <Input type="date" value={startsAt()} onInput={(e) => setStartsAt(e.currentTarget.value)} />
                </Field>
                <Field label={t("admin.endDate")}>
                  <Input type="date" value={endsAt()} onInput={(e) => setEndsAt(e.currentTarget.value)} />
                </Field>
              </div>

              <Field label={t("admin.presets")} hint={t("admin.presetsHint")}>
                <Input value={presetsText()} onInput={(e) => setPresetsText(e.currentTarget.value)} />
              </Field>

              <Checkbox label={t("admin.allowCustom")} checked={form().allowCustom ?? true} onChange={(v) => setForm({ ...form(), allowCustom: v })} />

              <Field label={t("admin.frequencies")}>
                <div class="flex gap-4">
                  <For each={FREQUENCIES}>
                    {(freq) => (
                      <Checkbox label={t(frequencyLabelKey[freq])} checked={form().frequencies.includes(freq)} onChange={() => toggleFrequency(freq)} />
                    )}
                  </For>
                </div>
              </Field>

              <Show when={error()}>
                <p class="font-sans text-fs-sm text-danger">{error()}</p>
              </Show>

              <div class="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => navigate("/admin/campaigns")}>
                  {t("admin.cancel")}
                </Button>
                <Button type="submit" loading={saving()}>
                  {t("admin.save")}
                </Button>
              </div>
            </form>
          </Card>
        </Show>
      </Show>
    </div>
  );
};

export default CampaignFormPage;
