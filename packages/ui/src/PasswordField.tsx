import React,{forwardRef,useId,useState} from "react";
import {IconButton} from "./IconButton";
import {InputControl} from "./FieldControls";
export type PasswordFieldState="default"|"focus"|"error"|"disabled";
export interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>,"type"|"size"|"style"|"className"|"disabled"|"aria-invalid">{label:React.ReactNode;helperText?:React.ReactNode;error?:boolean;disabled?:boolean;showPasswordLabel?:string;hidePasswordLabel?:string}
const VisibilityIcon:React.FC<{visible:boolean}>=({visible})=><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.5 10s2.8-4.5 7.5-4.5 7.5 4.5 7.5 4.5-2.8 4.5-7.5 4.5S2.5 10 2.5 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6"/>{!visible?<path d="m3.5 3.5 13 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>:null}</svg>;
export const PasswordField=forwardRef<HTMLInputElement,PasswordFieldProps>(({id,label,helperText,error=false,disabled=false,showPasswordLabel="Show password",hidePasswordLabel="Hide password",onFocus,onBlur,...props},ref)=>{
 const generatedId=useId(),inputId=id??generatedId,helperId=helperText?`${inputId}-helper`:undefined; const [focused,setFocused]=useState(false),[visible,setVisible]=useState(false);
 const reveal=()=>{if(!disabled)setVisible(true)},mask=()=>setVisible(false); const state:PasswordFieldState=disabled?"disabled":error?"error":focused?"focus":"default";
 return <div data-component="password-field" data-state={state} data-visible={visible?"true":"false"}>
  <label htmlFor={inputId}>{label}</label>
  <div data-slot="field-control-wrap">
   <InputControl {...props} id={inputId} ref={ref} type={visible?"text":"password"} disabled={disabled} variant={error?"error":"default"} aria-invalid={error?"true":undefined} aria-describedby={helperId} onFocus={e=>{setFocused(true);onFocus?.(e)}} onBlur={e=>{setFocused(false);onBlur?.(e)}}/>
   <IconButton type="button" variant="ghost" icon={<VisibilityIcon visible={visible}/>} label={visible?hidePasswordLabel:showPasswordLabel} disabled={disabled} title={visible?hidePasswordLabel:showPasswordLabel} data-slot="password-visibility-toggle"
    onMouseDown={e=>{e.preventDefault();reveal()}} onMouseUp={mask} onMouseLeave={mask} onTouchStart={reveal} onTouchEnd={mask} onTouchCancel={mask}
    onKeyDown={e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();reveal()}}} onKeyUp={e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();mask()}}} onBlur={mask}/>
  </div>
  {helperText?<div id={helperId} data-slot="field-helper">{helperText}</div>:null}
 </div>;
});
PasswordField.displayName="PasswordField";
