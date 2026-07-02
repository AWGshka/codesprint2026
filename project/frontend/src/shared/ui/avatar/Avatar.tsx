import { Show } from "solid-js";
import type { Component } from "solid-js";

import { cn } from "~/shared/lib/cn";

export interface AvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  image?: string | null;
  /** Any stable per-user string (id is ideal) - hashed to pick a deterministic background hue. */
  userId: string;
  size?: "sm" | "md";
  class?: string;
}

const SIZE_CLASS: Record<NonNullable<AvatarProps["size"]>, string> = { sm: "size-8 text-label", md: "size-11 text-body" };

/** Simple, fast string hash - not cryptographic, just deterministic (same id -> same hue always). */
const hueFromId = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  return hash % 360;
};

const initialsOf = (firstName?: string | null, lastName?: string | null, username?: string | null): string => {
  const first = firstName?.trim()?.[0];
  const last = lastName?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  const handle = username?.trim()?.[0];
  return handle ? handle.toUpperCase() : "?";
};

/**
 * Initials avatar - shows `image` when set, otherwise a deterministic-hue circle with initials
 * (a fixed hue picked from `userId`, not the theme palette, so it stays legible and distinct in
 * all 4 theme combos without needing per-theme tuning). Decorative by design (`aria-hidden` +
 * empty `alt`) - always pair it with visible name text, which carries the accessible label; this
 * component is never the sole way to identify a user.
 */
export const Avatar: Component<AvatarProps> = (props) => {
  const size = () => props.size ?? "md";
  const initials = () => initialsOf(props.firstName, props.lastName, props.username);
  const hue = () => hueFromId(props.userId);

  return (
    <Show
      when={props.image}
      fallback={
        <span
          class={cn("inline-flex shrink-0 items-center justify-center rounded-full font-sans font-semibold text-white", SIZE_CLASS[size()], props.class)}
          style={{ "background-color": `hsl(${hue()}deg 55% 40%)` }}
          aria-hidden="true">
          {initials()}
        </span>
      }>
      {(src) => <img src={src()} alt="" aria-hidden="true" class={cn("shrink-0 rounded-full object-cover", SIZE_CLASS[size()], props.class)} />}
    </Show>
  );
};
