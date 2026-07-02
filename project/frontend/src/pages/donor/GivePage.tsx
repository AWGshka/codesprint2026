import { useNavigate } from "@solidjs/router";

import { Show } from "solid-js";
import type { Component } from "solid-js";

import { GiveFlow } from "~/app/donor/GiveFlow";
import { useDonorCampaign } from "~/app/donor/DonorCampaignContext";

const GivePage: Component = () => {
  const donor = useDonorCampaign();
  const navigate = useNavigate();

  return (
    <Show when={donor.campaign()}>
      {(campaign) => (
        <GiveFlow
          campaign={campaign()}
          currency={donor.currency()}
          source="web"
          onSuccess={(result) => navigate(`/c/${campaign().slug}/thanks/${result.reference}`)}
        />
      )}
    </Show>
  );
};

export default GivePage;
