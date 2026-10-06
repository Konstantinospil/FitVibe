import React,{forwardRef,useId,useState} from "react";
export type FieldControlSize="sm"|"md"|"lg";
export type FieldControlVariant="default"|"error";
export type InputFieldState="default"|"focus"|"error"|"disabled";
export type SelectFieldState=InputFieldState;
export type TextareaFieldState=InputFieldState;

export interface InputControlProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>,"size">{controlSize?:FieldControlSize;variant?:FieldControlVariant}
export const InputControl=forwardRef<HTMLInputElement,InputControlProps>(({controlSize="md",variant="default",disabled=false,style,...props},ref)=><input ref={ref} disabled={disabled} data-component="input-control" data-size={controlSize} data-variant={variant} style={style} {...props}/>);
InputControl.displayName="InputControl";

export interface InputFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>,"size"|"style"|"className"|"disabled"|"aria-invalid">{label:React.ReactNode;helperText?:React.ReactNode;error?:boolean;disabled?:boolean;endAdornment?:React.ReactNode}
export const InputField=forwardRef<HTMLInputElement,InputFieldProps>(({id,label,helperText,error=false,disabled=false,endAdornment,onFocus,onBlur,...props},ref)=>{
 const generatedId=useId(),inputId=id??generatedId,helperId=helperText?`${inputId}-helper`:undefined; const [focused,setFocused]=useState(false);
 const state:InputFieldState=disabled?"disabled":error?"error":focused?"focus":"default";
 return <div data-component="input-field" data-state={state} data-has-adornment={endAdornment?true:undefined}>
  <label htmlFor={inputId}>{label}</label>
  <div data-slot="field-control-wrap">
   <InputControl {...props} id={inputId} ref={ref} disabled={disabled} variant={error?"error":"default"} aria-invalid={error?"true":undefined} aria-describedby={helperId} onFocus={e=>{setFocused(true);onFocus?.(e)}} onBlur={e=>{setFocused(false);onBlur?.(e)}}/>
   {endAdornment?<span aria-hidden="true" data-slot="field-end-adornment">{endAdornment}</span>:null}
  </div>
  {helperText?<div id={helperId} data-slot="field-helper">{helperText}</div>:null}
 </div>;
});
InputField.displayName="InputField";

export interface SelectControlProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>,"size">{controlSize?:FieldControlSize;variant?:FieldControlVariant}
export const SelectControl=forwardRef<HTMLSelectElement,SelectControlProps>(({controlSize="md",variant="default",disabled=false,style,children,...props},ref)=><select ref={ref} disabled={disabled} data-component="select-control" data-size={controlSize} data-variant={variant} style={style} {...props}>{children}</select>);
SelectControl.displayName="SelectControl";

export interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>,"size"|"style"|"className"|"disabled"|"aria-invalid">{label:React.ReactNode;helperText?:React.ReactNode;error?:boolean;disabled?:boolean;children:React.ReactNode}
export const SelectField=forwardRef<HTMLSelectElement,SelectFieldProps>(({id,label,helperText,error=false,disabled=false,children,onFocus,onBlur,...props},ref)=>{
 const generatedId=useId(),selectId=id??generatedId,helperId=helperText?`${selectId}-helper`:undefined; const [focused,setFocused]=useState(false);
 const state:SelectFieldState=disabled?"disabled":error?"error":focused?"focus":"default";
 return <div data-component="select-field" data-state={state}>
  <label htmlFor={selectId}>{label}</label>
  <div data-slot="field-control-wrap">
   <SelectControl {...props} id={selectId} ref={ref} disabled={disabled} variant={error?"error":"default"} aria-invalid={error?"true":undefined} aria-describedby={helperId} onFocus={e=>{setFocused(true);onFocus?.(e)}} onBlur={e=>{setFocused(false);onBlur?.(e)}}>{children}</SelectControl>
   <span aria-hidden="true" data-slot="select-chevron"/>
  </div>
  {helperText?<div id={helperId} data-slot="field-helper">{helperText}</div>:null}
 </div>;
});
SelectField.displayName="SelectField";

export interface TextareaControlProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>{controlSize?:FieldControlSize;variant?:FieldControlVariant}
export const TextareaControl=forwardRef<HTMLTextAreaElement,TextareaControlProps>(({controlSize="md",variant="default",disabled=false,style,...props},ref)=><textarea ref={ref} disabled={disabled} data-component="textarea-control" data-size={controlSize} data-variant={variant} style={style} {...props}/>);
TextareaControl.displayName="TextareaControl";

export interface TextareaFieldProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>,"style"|"className"|"disabled"|"aria-invalid">{label:React.ReactNode;helperText?:React.ReactNode;error?:boolean;disabled?:boolean}
export const TextareaField=forwardRef<HTMLTextAreaElement,TextareaFieldProps>(({id,label,helperText,error=false,disabled=false,onFocus,onBlur,...props},ref)=>{
 const generatedId=useId(),textareaId=id??generatedId,helperId=helperText?`${textareaId}-helper`:undefined; const [focused,setFocused]=useState(false);
 const state:TextareaFieldState=disabled?"disabled":error?"error":focused?"focus":"default";
 return <div data-component="textarea-field" data-state={state}>
  <label htmlFor={textareaId}>{label}</label>
  <TextareaControl {...props} id={textareaId} ref={ref} disabled={disabled} variant={error?"error":"default"} aria-invalid={error?"true":undefined} aria-describedby={helperId} onFocus={e=>{setFocused(true);onFocus?.(e)}} onBlur={e=>{setFocused(false);onBlur?.(e)}}/>
  {helperText?<div id={helperId} data-slot="field-helper">{helperText}</div>:null}
 </div>;
});
TextareaField.displayName="TextareaField";
