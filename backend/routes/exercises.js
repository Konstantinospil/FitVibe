import express from "express";
import db from "../db.js";
import { requireAuth } from "../utils/auth.js";
const r = express.Router();
r.get("/", async (_req,res)=>{ const rows=await db("exercises").whereNull("deleted_at").orderBy("created_at","desc").limit(200); res.json(rows); });
r.post("/", requireAuth, async (req,res)=>{
  const { name, category=null, muscle_group=null, tags=null } = req.body||{};
  if(!name) return res.status(400).json({error:"Name required"});
  const [row]=await db("exercises").insert({ owner_user_id:req.user.id, name, category, muscle_group, tags, is_public:true }).returning("*");
  res.status(201).json(row);
});
export default r;
