import React from "react";
import {AlertTriangle} from "lucide-react";
import {Button} from "@fitvibe/ui";
import {Modal} from "./composites/Modal";

interface ConfirmDialogProps {
  isOpen:boolean;
  title:string;
  message:string;
  confirmLabel?:string;
  cancelLabel?:string;
  variant?:"danger"|"warning"|"info";
  onConfirm:()=>void;
  onCancel:()=>void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,title,message,confirmLabel="Confirm",cancelLabel="Cancel",variant="warning",onConfirm,onCancel,
}) => (
  <Modal
    open={isOpen}
    title={title}
    onClose={onCancel}
    width="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={variant==="danger"?"danger":"primary"} onClick={onConfirm}>{confirmLabel}</Button>
      </>
    }
  >
    <div data-component="confirm-dialog" data-tone={variant}>
      <span aria-hidden="true" data-slot="confirm-dialog-icon"><AlertTriangle /></span>
      <p data-slot="confirm-dialog-message">{message}</p>
    </div>
  </Modal>
);
