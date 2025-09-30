import express from "express";
import db from "../db.js";
import { requireAuth } from "../utils/auth.js";
import { estimateEntryCalories } from "../utils/calories.js";
import { toPoints } from "../utils/points.js";
const r = express.Router();

r.post("/", requireAuth, async (req,res)=>{
  const { title, planned_for=null, visibility="private", exercises=[] } = req.body||{};
  if(!title) return res.status(400).json({error:"Title required"});
  const [s]=await db("sessions").insert({ owner_user_id:req.user.id, title, planned_for, status:"planned", visibility }).returning("*");
  let pos=1;
  for(const ex of exercises){
    await db("session_exercises").insert({
      session_id:s.id, name_snapshot: ex.name||"Exercise", position: pos++,
      planned_sets: ex.planned_sets||null, planned_reps: ex.planned_reps||null,
      planned_distance_m: ex.planned_distance_m||null, planned_duration_s: ex.planned_duration_s||null,
      planned_load_kg: ex.planned_load_kg||null, planned_rpe: ex.planned_rpe||null
    });
  }
  res.status(201).json(s);
});

r.post("/:id/exercise", requireAuth, async (req,res)=>{
  const id = Number(req.params.id);
  const s = await db("sessions").where({ id, owner_user_id:req.user.id }).first();
  if(!s) return res.status(404).json({error:"Session not found"});
  const ex = req.body||{};
  const [row]=await db("session_exercises").insert({
    session_id:id, name_snapshot: ex.name||"Exercise", position: ex.position||1,
    actual_sets: ex.actual_sets||null, actual_total_reps: ex.actual_total_reps||null,
    actual_distance_m: ex.actual_distance_m||null, actual_duration_s: ex.actual_duration_s||null,
    actual_avg_load_kg: ex.actual_avg_load_kg||null, actual_rpe: ex.actual_rpe||null
  }).returning("*");
  res.status(201).json(row);
});

r.post("/:id/complete", requireAuth, async (req,res)=>{
  const id = Number(req.params.id);
  const s = await db("sessions").where({ id, owner_user_id:req.user.id }).first();
  if(!s) return res.status(404).json({error:"Session not found"});
  const profile = await db("user_profiles").where({ user_id:req.user.id }).first();
  const entries = await db("session_exercises").where({ session_id:id });
  const total = entries.reduce((a,e)=>a+estimateEntryCalories(e, profile),0);
  const pts = toPoints({ calories: total, subjectiveDay: req.body?.subjective_day_fitness });
  const [u]=await db("sessions").where({id}).update({
    completed_at:new Date(), status:"completed", user_weight_kg: profile?.weight_kg||null,
    user_fitness_level: profile?.fitness_level||null, calories_burned: total, points_total: pts,
    subjective_day_fitness: req.body?.subjective_day_fitness||null
  }).returning("*");
  res.json(u);
});

r.get("/mine", requireAuth, async (req,res)=>{
  const rows = await db("sessions")
  .where({ owner_user_id:req.user.id })
  .orderBy("created_at","desc")
  .select("id","title","completed_at","points_total");
  res.json(rows);
});

export default r;
