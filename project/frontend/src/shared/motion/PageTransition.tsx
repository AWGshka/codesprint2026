import { fadeInUp, transition } from "./presets";

import { useLocation } from "@solidjs/router";

import { Show } from "solid-js";
import type { ParentComponent } from "solid-js";
import { Motion, Presence } from "solid-motionone";

// Animates the routed outlet on navigation: keying on pathname re-creates the
// child so Presence can run the exit→enter pair between routes.
export const PageTransition: ParentComponent = (props) => {
  const location = useLocation();

  return (
    <Presence exitBeforeEnter>
      <Show when={location.pathname} keyed>
        <Motion.div initial={fadeInUp.initial} animate={fadeInUp.animate} exit={fadeInUp.exit} transition={transition}>
          {props.children}
        </Motion.div>
      </Show>
    </Presence>
  );
};
