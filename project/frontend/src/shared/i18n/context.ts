import { en } from "./dictionaries/en";
import { mt } from "./dictionaries/mt";

import type { Flatten } from "@solid-primitives/i18n";
import { flatten, resolveTemplate, translator } from "@solid-primitives/i18n";

import { createMemo } from "solid-js";

import { prefs } from "~/shared/prefs";

const flatEn = flatten(en);
const flatMt = flatten(mt);

// `mt` is partial by design - merge it over the full English dictionary so
// every key resolves even where a translation is missing.
const dictionaries: Record<"en" | "mt", Flatten<typeof en>> = { en: flatEn, mt: { ...flatEn, ...flatMt } as unknown as Flatten<typeof en> };

const activeDict = createMemo(() => dictionaries[prefs.locale()]);

/** Reactive translator - re-resolves whenever the locale signal changes. */
export const t = translator(activeDict, resolveTemplate);
