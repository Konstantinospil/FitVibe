import React from "react";
export type CardVariant="surface"|"muted";
export interface CardProps extends React.HTMLAttributes<HTMLDivElement>{as?:keyof React.JSX.IntrinsicElements;variant?:CardVariant}
export const Card:React.FC<CardProps>=({children,as="div",variant="surface",style,...rest})=>{const Component=as as React.ElementType;return <Component data-ui="card" data-component="card" data-variant={variant} style={style} {...rest}>{children}</Component>};
export const CardHeader:React.FC<React.HTMLAttributes<HTMLElement>>=({children,style,...rest})=><header data-component="card-header" style={style} {...rest}>{children}</header>;
export const CardTitle:React.FC<React.HTMLAttributes<HTMLHeadingElement>>=({children,style,...rest})=><h3 data-component="card-title" style={style} {...rest}>{children}</h3>;
export const CardDescription:React.FC<React.HTMLAttributes<HTMLParagraphElement>>=({children,style,...rest})=><p data-component="card-description" style={style} {...rest}>{children}</p>;
export const CardContent:React.FC<React.HTMLAttributes<HTMLDivElement>>=({children,style,...rest})=><div data-component="card-content" style={style} {...rest}>{children}</div>;
export const CardFooter:React.FC<React.HTMLAttributes<HTMLDivElement>>=({children,style,...rest})=><div data-component="card-footer" style={style} {...rest}>{children}</div>;
