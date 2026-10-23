#!/usr/bin/env node
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const compose = fs.readFileSync(path.join(root,"infra/docker/prod/compose.yml"),"utf8");
const healthcheck = compose.match(/(?ms)^  clamav:\n(.*?)(?=^  \w+:|^volumes:)/)?.[1];
test("ClamAV PING healthcheck escapes shell reply from Compose interpolation", () => {
  assert.ok(healthcheck,"missing ClamAV service");
  assert.match(healthcheck,/test:\s*\["CMD-SHELL",.*\$\$reply/);
  assert.doesNotMatch(healthcheck,/test:\s*\["CMD-SHELL",.*(?<!\$)\$reply/);
});
test("Compose resolves escaped variable for container shell and not host interpolation", {skip:spawnSync("docker",["compose","version"],{encoding:"utf8"}).status!==0},()=>{
  const digest="a".repeat(64);
  const env={...process.env};
  for(const name of ["INGRESS","BACKEND","FRONTEND","BACKOFFICE","POSTGRES","CLAMAV","REDIS"])
    env[name+"_IMAGE"]="example@sha256:"+digest;
  env.POSTGRES_PASSWORD="test-only";
  env.FITVIBE_ENV_FILE="/dev/null";
  const result=spawnSync("docker",["compose","-f","infra/docker/prod/compose.yml","config","--format","json"],{cwd:root,env,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);
  const command=JSON.parse(result.stdout).services.clamav.healthcheck.test.join(" ");
  assert.match(command,/\$reply/);
  assert.doesNotMatch(command,/\$\$reply/);
});
