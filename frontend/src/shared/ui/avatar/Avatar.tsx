import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";
import { initials } from "~/shared/lib/user";
import { avatarColor } from "~/shared/lib/color";

export interface AvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  username: string;
  size?: "sm" | "md";
  class?: string;
}

const sizeClass: Record<NonNullable<AvatarProps["size"]>, string> = { sm: "size-7 text-label", md: "size-9 text-fs-sm" };

/** Deterministic initials avatar — same name/username always renders the same background colour. */
export const Avatar: Component<AvatarProps> = (props) => (
  <span
    class={cn("inline-flex shrink-0 items-center justify-center rounded-full font-sans font-semibold text-white", sizeClass[props.size ?? "md"], props.class)}
    style={{ background: avatarColor(`${props.firstName ?? ""}${props.lastName ?? ""}` || props.username) }}
    aria-hidden="true">
    {initials(props.firstName, props.lastName, props.username)}
  </span>
);
