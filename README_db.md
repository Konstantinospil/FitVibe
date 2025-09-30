# 📘 Database Schema (Developer Reference)

This schema defines the database tables for FitVibe.  
It includes the new **user_points** table for gamification.

## Tables Overview

- **users** → core identity
- **user_credentials** → login secrets
- **user_contacts** → email/phone
- **user_static** → immutable info
- **user_state** → current weight, alias, fitness level
- **user_state_history** → snapshots of state
- **exercises** → exercise catalog
- **sessions** → planned/executed sessions
- **session_exercises** → exercises inside sessions
- **badges** → earned badges
- **user_points** → point events (from sessions, badges, etc.)

## Relations (ASCII)

```
   ┌───────────────┐         ┌──────────────────┐
   │    users      │1───────∞│ user_credentials │
   │ id (PK)       │         │ user_id (FK)     │
   └───────────────┘         └──────────────────┘
          │1
          │
          ∞
   ┌──────────────────┐
   │  user_contacts   │
   │ user_id (FK)     │
   └──────────────────┘

          │1
          │
          1
   ┌──────────────────┐
   │   user_static    │
   │ user_id (PK,FK)  │
   └──────────────────┘

          │1
          │
          1
   ┌──────────────────┐
   │   user_state     │
   │ user_id (PK,FK)  │
   └──────────────────┘
          │
          ∞
   ┌──────────────────┐
   │user_state_history│
   │ user_id (FK)     │
   └──────────────────┘

          │
          ∞
   ┌──────────────────┐
   │     badges       │
   │ user_id (FK)     │
   └──────────────────┘

          │
          ∞
   ┌──────────────────┐
   │    exercises     │
   │ owner_user_id FK │
   └──────────────────┘

          │
          ∞
   ┌──────────────────┐
   │    sessions      │
   │ owner_user_id FK │
   └──────────────────┘
          │
          ∞
   ┌──────────────────┐
   │session_exercises │
   │ session_id (FK)  │
   └──────────────────┘

          │
          ∞
   ┌──────────────────┐
   │   user_points    │
   │ user_id (FK)     │
   └──────────────────┘
```

📌 Use `user_points` for leaderboards, progress tracking, and gamification analytics.
