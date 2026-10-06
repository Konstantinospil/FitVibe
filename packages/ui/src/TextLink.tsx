import React,{forwardRef} from "react";
export interface TextLinkProps extends React.HTMLAttributes<HTMLElement>{as?:React.ElementType;href?:string;to?:string;target?:string;rel?:string;type?:"button"|"submit"|"reset";inactive?:boolean;children:React.ReactNode}
export const TextLink=forwardRef<HTMLElement,TextLinkProps>(({as:Component="a",href,to,target,rel,inactive=false,children,style,onClick,...props},ref)=><Component {...props} ref={ref} {...(Component==="a"?{href}:{to})} target={target} rel={rel} aria-disabled={inactive||undefined} tabIndex={inactive?-1:props.tabIndex} data-component="text-link" style={style} onClick={(e:React.MouseEvent<HTMLElement>)=>{if(inactive){e.preventDefault();e.stopPropagation();return}onClick?.(e)}}>{children}</Component>);
TextLink.displayName="TextLink";
