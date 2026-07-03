import { useNavigate } from "@solidjs/router";

import { Show } from "solid-js";
import type { Component } from "solid-js";

import { t } from "~/shared/i18n";
import { Banner } from "~/shared/ui";
import { GiveFlow } from "~/app/donor/GiveFlow";
import { useDonorCampaign } from "~/app/donor/DonorCampaignContext";

const GivePage: Component = () => {
  const donor = useDonorCampaign();
  const navigate = useNavigate();

  return (
    <Show when={donor.campaign()}>
      {(campaign) => (
        // Direct links to /give on a paused/ended campaign get the status message,
        // not a flow whose final submit the server would reject.
        <Show
          when={campaign().status === "active"}
          fallback={
            <Banner variant={campaign().status === "paused" ? "warning" : "neutral"}>
              {campaign().status === "paused" ? t("donor.campaignPaused") : t("donor.campaignEnded")}
            </Banner>
          }>
          <GiveFlow
            campaign={campaign()}
            currency={donor.currency()}
            source="web"
            onSuccess={(result) => navigate(`/c/${campaign().slug}/thanks/${result.reference}`)}
          />
        </Show>
      )}
    </Show>
  );
};

export default GivePage;
