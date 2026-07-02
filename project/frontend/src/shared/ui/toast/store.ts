import { createSignal } from "solid-js";

export type ToastVariant = "default" | "success" | "warning" | "danger";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

let nextId = 0;
const [toasts, setToasts] = createSignal<ToastItem[]>([]);

export const toastStore = { toasts };

/** Queues a toast (kit's confirmation-toast pattern); auto-dismisses after `durationMs`. */
export const showToast = (message: string, variant: ToastVariant = "default", durationMs = 4000) => {
  const id = nextId++;
  setToasts((list) => [...list, { id, message, variant }]);
  setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), durationMs);
};

export const dismissToast = (id: number) => setToasts((list) => list.filter((item) => item.id !== id));
