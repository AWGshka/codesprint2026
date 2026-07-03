import { Modal } from "./Modal";
import { Button } from "../button/Button";

import type { Component } from "solid-js";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => (
  <Modal open={props.open} onClose={props.onCancel} title={props.title}>
    <p class="mb-5 font-sans text-fs-sm text-fg-muted">{props.description}</p>
    <div class="flex justify-end gap-2">
      <Button variant="secondary" onClick={props.onCancel}>
        Cancel
      </Button>
      <Button variant={props.danger ? "danger" : "primary"} loading={props.busy} onClick={props.onConfirm}>
        {props.confirmLabel ?? "Confirm"}
      </Button>
    </div>
  </Modal>
);
