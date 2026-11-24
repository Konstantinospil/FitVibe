#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";
// Second localization layer: AST inventory of server-controlled messages,
// database seed labels, and raw backend-error consumers. No DB access.
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const crypto = require("node:crypto");
const LOCALES = ["en","de","fr","es","el"];
const DISPLAY = new Set(["message","label","title","description","caption","hint","helptext","displayname","display_name","subject","heading","subtitle","errormessage","successmessage","warningmessage","emptytext","placeholder"]);
const AMBIGUOUS = new Set(["name","text","value","content","summary"]);
function sourceFiles(root) {
  if (!fs.existsSync(root)) throw Error("Missing source root: "+root);
  const result=[];
  function visit(dir) {
    for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      if(["node_modules","dist","build","coverage","archive"].includes(item.name)) continue;
      const file=path.join(dir,item.name);
      if(item.isDirectory())visit(file);
      else if(item.isFile() && /\.(?:tsx?|jsx?|mjs|cjs)$/.test(file) && !file.endsWith(".d.ts"))result.push(file);
    }
  }
  visit(root);return result;
}
function parse(file,source) {
  const kind=/\.(?:tsx|jsx)$/.test(file)?ts.ScriptKind.TSX:/\.(?:mjs|cjs|js)$/.test(file)?ts.ScriptKind.JS:ts.ScriptKind.TS;
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,kind);
  if(ast.parseDiagnostics.length)throw Error("Parse error "+file+": "+ast.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText," ")).join("; "));
  return ast;
}
function visit(node,callback){callback(node);ts.forEachChild(node,child=>visit(child,callback));}
function position(ast,node){const p=ast.getLineAndCharacterOfPosition(node.getStart(ast));return{line:p.line+1,column:p.character+1};}
function textOf(node){
  if(!node)return null;
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
  if(ts.isTemplateExpression(node))return[node.head.text,...node.templateSpans.flatMap(x=>["{expression}",x.literal.text])].join("");
  return null;
}
function fieldName(node){return node.name.getText().replace(/["']/g,"").toLowerCase();}
function readable(text){return text==="{dynamic}"||typeof text==="string"&&/[\p{L}]/u.test(text);}
function finding(list,file,ast,node,kind,reason,text,extra={}){
  if(!readable(text))return;
  list.push({file,...position(ast,node),classification:kind,reason,text,...extra});
}
function inspectServer(file,source){
  const ast=parse(file,source),items=[],codes=[];
  const localized=/\/i18n\.service\.ts$/.test(file);
  visit(ast,node=>{
    if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&["HttpError","AppError","Error"].includes(node.expression.text)){
      const http=node.expression.text==="HttpError";
      const args=node.arguments||[];
      const message=args[http?2:0],code=http?textOf(args[1]):null;
      if(code)codes.push({code,file,...position(ast,args[1])});
      if(message)finding(items,file,ast,message,http?"ui":"review",http?"http-error-message":"error-constructor",textOf(message)||"{dynamic}",code?{code}:{});
    }
    if(ts.isPropertyAssignment(node)){
      const key=fieldName(node);
      if(DISPLAY.has(key)||AMBIGUOUS.has(key))
        finding(items,file,ast,node.initializer,localized?"localized":DISPLAY.has(key)?"ui":"review","field:"+key,textOf(node.initializer)||"{dynamic}");
    }
  });
  return{items,codes};
}
function inspectClient(file,source){
  const ast=parse(file,source),items=[];
  visit(ast,node=>{
    if(ts.isPropertyAccessExpression(node)&&node.name.text==="message"&&/\b(?:error|response|data)\b/.test(node.expression.getText(ast)))
      finding(items,file,ast,node,"review","raw-api-message-consumer","{dynamic}",{expression:node.getText(ast).slice(0,300)});
    if(ts.isPropertyAssignment(node)&&DISPLAY.has(fieldName(node))){
      const text=textOf(node.initializer);
      if(readable(text))finding(items,file,ast,node.initializer,"ui","client-field:"+fieldName(node),text);
    }
  });return items;
}
function nested(object,key){
  return key.split(".").reduce((v,part)=>v&&typeof v==="object"?v[part]:undefined,object);
}
function translations(root){
  const data={};
  for(const locale of LOCALES){
    data[locale]={};
    for(const name of ["common","auth"]){
      data[locale][name]=JSON.parse(fs.readFileSync(path.join(root,"apps/frontend/src/i18n/locales",locale,name+".json"),"utf8"));
    }
  }return data;
}
function codeCoverage(code,bundles){
  return Object.fromEntries(LOCALES.map(lang=>[lang,["common","auth"].some(ns=>Boolean(nested(bundles[lang][ns],"errors."+code)||nested(bundles[lang][ns],"auth.errors."+code)))]));
}
function scan(root=process.cwd()){
  const server=["apps/backend/src","packages/types/src"].flatMap(dir=>sourceFiles(path.join(root,dir)));
  const clients=["apps/frontend/src","apps/backoffice/src"].flatMap(dir=>sourceFiles(path.join(root,dir)));
  const findings=[],errorCodes=[];
  for(const absolute of server){
    const file=path.relative(root,absolute).replace(/\\/g,"/");
    const result=inspectServer(file,fs.readFileSync(absolute,"utf8"));
    findings.push(...result.items);errorCodes.push(...result.codes);
  }
  for(const absolute of clients){
    const file=path.relative(root,absolute).replace(/\\/g,"/");
    findings.push(...inspectClient(file,fs.readFileSync(absolute,"utf8")));
  }
  findings.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.column-b.column||a.reason.localeCompare(b.reason));
  findings.forEach((f,i)=>{f.id=crypto.createHash("sha256").update([f.file,f.line,f.column,f.reason,i].join("\0")).digest("hex").slice(0,16);});
  const bundles=translations(root);
  const codes=[...new Set(errorCodes.map(x=>x.code))].sort().map(code=>({code,coverage:codeCoverage(code,bundles),sources:errorCodes.filter(x=>x.code===code)}));
  const counts={
    serverUi:findings.filter(x=>x.classification==="ui"&&!x.reason.startsWith("client-")).length,
    serverReview:findings.filter(x=>x.classification==="review"&&x.reason!=="raw-api-message-consumer").length,
    clientUi:findings.filter(x=>x.reason.startsWith("client-field:")).length,
    rawErrorReads:findings.filter(x=>x.reason==="raw-api-message-consumer").length,
    untranslatedCodes:codes.filter(x=>Object.values(x.coverage).some(v=>!v)).length,
    alreadyLocalized:findings.filter(x=>x.classification==="localized").length
  };
  return{schemaVersion:1,serverFiles:server.length,clientFiles:clients.length,counts,findings,errorCodes:codes,
    warning:"Candidates only. Static data contracts are not proof of a localized runtime display. No live database data read."};
}
function markdown(report){
  const lines=["# Data contract localization findings","","These are candidates; inspect the JSON for full values and error code coverage.","",
    "Counts: "+JSON.stringify(report.counts),"","| Class | Location | Reason | Text |","|---|---|---|---|"];
  for(const f of report.findings){
    const value=f.text.replace(/\|/g,"\\|").replace(/[\r\n]/g," ").slice(0,150);
    lines.push("| "+f.classification+" | "+f.file+":"+f.line+" | "+f.reason+" | "+value+" |");
  }
  return lines.join("\n")+"\n";
}
function main(args){
  const report=scan();
  function arg(flag){const i=args.indexOf(flag);return i<0?null:args[i+1];}
  for(const [dest,data] of [[arg("--json"),JSON.stringify(report,null,2)+"\n"],[arg("--md"),markdown(report)]]){
    if(!dest)continue;
    fs.mkdirSync(path.dirname(path.resolve(dest)),{recursive:true});fs.writeFileSync(dest,data);
  }
  console.log("Data-contract localization audit: "+JSON.stringify(report.counts)+"; serverFiles="+report.serverFiles+", clientFiles="+report.clientFiles);
  if(args.includes("--strict")&&report.counts.serverUi+report.counts.serverReview+report.counts.clientUi+report.counts.rawErrorReads+report.counts.untranslatedCodes>0)process.exitCode=1;
}
module.exports={inspectServer,inspectClient,codeCoverage,scan,markdown};
if(require.main===module){try{main(process.argv.slice(2));}catch(error){console.error(error);process.exitCode=2;}}
