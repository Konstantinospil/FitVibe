import express from "express"; import db from "../db.js";
const r = express.Router();
r.get("/", async (_req,res)=>{
  const rows = await db("sessions").whereNull("deleted_at").andWhere(q=>q.where("visibility","public").orWhere("visibility","unlisted")).orderByRaw("COALESCE(completed_at, planned_for) DESC NULLS LAST").limit(50);
  res.json(rows);
});
export default r;
