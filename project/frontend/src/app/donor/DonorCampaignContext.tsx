import { useParams } from "@solidjs/router";

import type { Accessor, ParentComponent } from "solid-js";
import { createContext, createEffect, createResource, createSignal, useContext } from "solid-js";

import { getCampaign } from "~/shared/api";
import type { CampaignWithProgress, CurrencyCode } from "~/shared/api";

interface DonorCampaignApi {
  campaign: Accessor<CampaignWithProgress | undefined>;
  loading: Accessor<boolean>;
  error: Accessor<unknown>;
  refetch: () => void;
  currency: Accessor<CurrencyCode>;
  setCurrency: (c: CurrencyCode) => void;
}

const DonorCampaignContext = createContext<DonorCampaignApi>();

/** Fetches the `:slug` campaign once per donor sub-tree (`/c/:slug/*`) and shares it (+ a chosen display currency) with landing/give/thanks. */
export const DonorCampaignProvider: ParentComponent = (props) => {
  const params = useParams<{ slug: string }>();
  const [campaign, { refetch }] = createResource(() => params.slug, getCampaign);
  const [currency, setCurrency] = createSignal<CurrencyCode>("EUR");
  let initializedCurrency = false;

  // Default the display currency to the campaign's own currency, once, the first time it loads.
  createEffect(() => {
    const loaded = campaign();
    if (loaded && !initializedCurrency) {
      initializedCurrency = true;
      setCurrency(loaded.currency);
    }
  });

  const api: DonorCampaignApi = {
    campaign: () => campaign(),
    loading: () => campaign.loading,
    error: () => campaign.error,
    refetch: () => refetch(),
    currency,
    setCurrency,
  };

  return <DonorCampaignContext.Provider value={api}>{props.children}</DonorCampaignContext.Provider>;
};

export const useDonorCampaign = () => {
  const ctx = useContext(DonorCampaignContext);
  if (!ctx) throw new Error("useDonorCampaign must be used within <DonorCampaignProvider>");
  return ctx;
};
