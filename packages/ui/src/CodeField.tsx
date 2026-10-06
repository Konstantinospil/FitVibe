import React,{forwardRef,useId,useMemo,useState} from "react";
import {InputControl} from "./FieldControls";
export type CodeFieldState="default"|"focus"|"error"|"disabled";
export interface CodeFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>,"type"|"size"|"style"|"className"|"disabled"|"aria-invalid">{label:React.ReactNode;helperText?:React.ReactNode;error?:React.ReactNode;disabled?:boolean;digits?:number}
export const CodeField=forwardRef<HTMLInputElement,CodeFieldProps>(({id,label,helperText,error,disabled=false,digits=6,value,defaultValue,onFocus,onBlur,...props},ref)=>{
 const generatedId=useId(),inputId=id??generatedId,helperId=helperText&&!error?`${inputId}-helper`:undefined,errorId=error?`${inputId}-error`:undefined;
 const [focused,setFocused]=useState(false),[internalValue,setInternalValue]=useState(String(defaultValue??"")); const controlled=value!==undefined,currentValue=controlled?String(value??""):internalValue;
 const state:CodeFieldState=disabled?"disabled":error?"error":focused?"focus":"default"; const totp=useMemo(()=>new RegExp(`^\\d{0,${digits}}$`).test(currentValue),[currentValue,digits]);
 return <div data-component="code-field" data-state={state} data-mode={totp?"totp":"backup"}>
  <label htmlFor={inputId}>{label}</label>
  <div data-slot="code-shell">
   {totp?<div aria-hidden="true" data-slot="code-slots" style={{gridTemplateColumns:`repeat(${digits}, minmax(0, 1fr))`}}>{Array.from({length:digits},(_,index)=>{const character=currentValue[index];return <span key={index} data-slot="code-digit" data-filled={character?"true":"false"}>{character??"0"}</span>})}</div>:<div aria-hidden="true" data-slot="backup-code-value">{currentValue}</div>}
   <InputControl {...props} id={inputId} ref={ref} value={controlled?value:undefined} defaultValue={controlled?undefined:defaultValue} disabled={disabled} inputMode={props.inputMode??"text"} variant={error?"error":"default"} aria-invalid={error?"true":undefined} aria-describedby={[helperId,errorId].filter(Boolean).join(" ")||undefined} aria-errormessage={errorId} data-overlay="true"
    onChange={e=>{if(!controlled)setInternalValue(e.target.value);props.onChange?.(e)}} onFocus={e=>{setFocused(true);onFocus?.(e)}} onBlur={e=>{setFocused(false);onBlur?.(e)}}/>
  </div>
  {error?<div id={errorId} role="alert" data-slot="code-feedback" data-tone="error">{error}</div>:helperText?<div id={helperId} data-slot="code-feedback">{helperText}</div>:null}
 </div>;
});
CodeField.displayName="CodeField";
