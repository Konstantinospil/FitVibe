import pkg from "pg";
const { Client } = pkg;
const cfg = {
  host: process.env.POSTGRES_HOST || "localhost",
  user: process.env.POSTGRES_USER || "app_user",
  password: process.env.POSTGRES_PASSWORD || "app_pass",
  database: process.env.POSTGRES_DB || "app_db",
  port: Number(process.env.POSTGRES_PORT || 5432),
};
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
for (let i=0;i<60;i++){
  const c = new Client(cfg);
  try { await c.connect(); await c.end(); console.log("DB ready"); process.exit(0); }
  catch { console.log("Waiting DB..."); await sleep(2000); }
}
console.error("DB not ready in time"); process.exit(1);
