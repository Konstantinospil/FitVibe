import React,{useEffect,useId,useRef} from "react";
import {X} from "lucide-react";
import {IconButton} from "@fitvibe/ui";

export interface ModalProps {
  open:boolean;
  title:React.ReactNode;
  description?:React.ReactNode;
  children?:React.ReactNode;
  footer?:React.ReactNode;
  closeLabel?:string;
  onClose:()=>void;
  closeOnBackdrop?:boolean;
  width?:"sm"|"md"|"lg";
}

export const Modal: React.FC<ModalProps> = ({
  open,title,description,children,footer,closeLabel="Close",onClose,closeOnBackdrop=true,width="md",
}) => {
  const titleId=useId();
  const descriptionId=useId();
  const panelRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open){return;}
    const previous=document.activeElement as HTMLElement|null;
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();onClose();}
    };
    document.addEventListener("keydown",handleKeyDown);
    panelRef.current?.focus();
    return()=>{document.removeEventListener("keydown",handleKeyDown);previous?.focus();};
  },[open,onClose]);
  if(!open){return null;}
  return (
    <div
      data-component="modal-layer"
      onClick={(event)=>{if(closeOnBackdrop&&event.target===event.currentTarget){onClose();}}}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description?descriptionId:undefined}
        tabIndex={-1}
        data-component="modal"
        data-size={width}
      >
        <header data-slot="modal-header">
          <div data-slot="modal-copy">
            <h2 id={titleId} data-slot="modal-title">{title}</h2>
            {description?<p id={descriptionId} data-slot="modal-description">{description}</p>:null}
          </div>
          <IconButton icon={<X aria-hidden="true" />} label={closeLabel} size="md" onClick={onClose} />
        </header>
        <div className="fitvibe-scrollbar" data-slot="modal-body">{children}</div>
        {footer?<footer data-slot="modal-footer">{footer}</footer>:null}
      </div>
    </div>
  );
};
