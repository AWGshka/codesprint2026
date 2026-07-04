import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { fr } from "./dictionaries/fr";
import { it } from "./dictionaries/it";
import { mt } from "./dictionaries/mt";
import { nl } from "./dictionaries/nl";

import type { Flatten } from "@solid-primitives/i18n";
import { flatten, resolveTemplate, translator } from "@solid-primitives/i18n";

import { createMemo, createRoot } from "solid-js";

import { prefs } from "~/shared/prefs";
import type { Locale } from "~/shared/prefs";

const flatEn = flatten(en);

// Every non-English dictionary is merged over the full English one so any
// missing key resolves to English instead of rendering `undefined`.
const withFallback = (dict: object) => ({ ...flatEn, ...flatten(dict as typeof en) }) as unknown as Flatten<typeof en>;

const dictionaries: Record<Locale, Flatten<typeof en>> = {
  en: flatEn,
  mt: withFallback(mt),
  fr: withFallback(fr),
  nl: withFallback(nl),
  it: withFallback(it),
  es: withFallback(es),
};

// `t` is a module-scoped singleton (same lifetime as `prefs`), so its `createMemo`
// must live inside a `createRoot` — otherwise Solid warns "computations created
// outside a createRoot or render will never be disposed" (it's never meant to be
// disposed, but Solid still wants an owner to attach to).
const activeDict = createRoot(() => createMemo(() => dictionaries[prefs.locale()]));

/** Reactive translator — re-resolves whenever the locale signal changes. */
export const t = translator(activeDict, resolveTemplate);
