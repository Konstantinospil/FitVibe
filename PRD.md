# Product Requirements Document (PRD)

**Project:** Training Planner & Logger Web App  
**Author:** Konstantinos  
**Version:** 2.0  
**Date:** 2025-09-30

---

## 1. Vision

The Training Planner & Logger is a web application that empowers individuals to **plan, log, share, and track** their training sessions efficiently.  
The app is modular, scalable, and designed with separation of concerns to allow sustainable growth and future extensibility (e.g., nutrition, wearables, AI recommendations).

It provides a **clear, barrier-free, responsive user interface**, ensuring accessibility and usability across devices and user groups.

---

## 2. Context

### 2.1 Goals

- Provide an **easy interface** for planning and logging training sessions.
- Enable **fast entry and retrieval** of exercises and sessions.
- Facilitate **sharing and community engagement** while respecting privacy.
- Offer **progress tracking** over time via stored historical data.
- Deliver a **gamified experience** via a hidden points system.
- **Accessible**, responsive UI.
- Ensure **security-first user management** (2FA, brute-force protection, password policy).
- Support **scalability and modularity** for future enhancements.

### 2.2 Future improvements (for MVP)

- Third-party wearable integrations (Garmin/Strava).
- Real-time chat or social graph.
- Nutrition tracking and body composition analytics.

### 2.3 Users & Core Use Cases

- **Athlete (Member)**: Plans/logs workouts; reviews history and badges; shares sessions.
- **Admin**: Internal role for moderation and (future) configuration of selectable values.

---

## 3. Functional Requirements

### 3.1 Key Flows

1. **Plan a session** → add exercises (any combination of measures) → save as planned.
2. **Log a session** → enter actuals → complete the session → points awarded.
3. **Browse Feed** → clone or attempt another user’s public session.
4. **Account Management** → edit alias/weight/fitness level, upload/delete avatar, add recovery email, view calendar, delete account (confirmation modal).
5. **Admin (future)** → manage selectable lists (e.g., fitness levels), moderate content.

### 3.2 User Management & Security

- Register, login, logout (secure authentication).
- A profile has the following attributes:
  - Username
  - Age: [Range: 18 - 70]
  - Sex: [Man, Woman, Diverse, None]
  - Weight: [Range: 30 - 200]
  - How often do you train: [Not at all, 0-1 Times per month, Every other week, Once every week, Every other day, Everyday]
- **Username Policy:** no obsenities and no duplicates are allowed
- **Password Policy:** at least 12 characters, mix of uppercase, lowercase, numbers, and symbols.
- **Two-Factor Authentication (2FA):** enabled optionally for enhanced security.
- **Brute-force protection:** account lock after 10 failed attempts, reset via email.
- Secure sessions with httpOnly cookies, refresh tokens, and persistent session store.
- HTTPS enforced for all traffic.
- Users can delete their account and associated data (GDPR compliance).
- **Register/Login/Logout** using username + password (bcrypt hashing).
- **JWT access token** (short-lived) + **refresh token** (rotated, stored in `auth_sessions`).
- **Axios interceptor** refreshes tokens on `401` automatically.
- **Roles**: `user` (default) and `admin`. Admin-only endpoints require `requireAdmin`.

### 3.3 Exercise Module

- Exercises types are stored and reusable across sessions in a library.
- Exercises types can include any combination of attributes:
  - Name
  - Focus: Strength, Cardio, Power endurance
- Exercises can have a number of attributes:
  - Exercise type
  - Distance
  - Time
  - Altitude
  - Repetitions per set
  - Sets
  - Resistance (weight, band, incline, etc.)
  - Subjective effort (RPE scale 1–10)

### 3.3 Session Module

- A session consists of a **sequence of exercises**.
- Two types:
  - **Planned sessions** (future date or recurring weekly).
  - **Executed sessions** (with actual logged performance).
- Sessions can be cloned and modified.
- Sessions can be marked **public** or **private**.
- Sessions can be deleted.

### 3.4 Planning Module

- Ability to schedule sessions:
  - Recurring (weekly templates, e.g. _Sunday Run_).
  - Specific date sessions (e.g. _Marathon Training Day_).
- Calendar integration (weekly/monthly views).

### 3.5 Logging Module

- Log exercises within a session as performed.
- Quick reuse of past sessions/exercises.
- Comparison between planned vs. actual.

### 3.6 Progress Tracking Module

- Store and display historical training sessions.
- Charts/visualizations of key metrics (time, reps, weight, intensity, effort).
- Weekly, monthly, yearly progress summaries.
- Personal bests and streaks.

### 3.7 Points Module

- Points automatically calculated after session completion.
- Formula (hidden from user) considers:
  - Calories burned
  - User-specific factors (age, sex, fitness level)
  - Subjective effort of the day
- Users only see **points awarded**, not the calculation.

### 3.8 Sharing & Community Module

- This module is only visible to registered users after login.
- Homepage feed of public sessions.
- Users can view and try others’ sessions.
- Options to like/bookmark sessions (future extension).
- Control visibility: make session **public** or **private**.

---

## 4. Non-Functional Requirements

### 4.1 Modularity & Separation of Concerns

- Backend modules: Users, Exercises, Sessions, Progress, Points, Feed, AppStats, Logs.
- Frontend modules: Authentication, Planner, Logger, Dashboard, Feed.
- Database schema: normalized, modular, relational.
- Strict separation of presentation, business logic, and persistence.

### 4.2 Scalability

- Containerized services (Docker).
- Stateless backend for horizontal scaling.
- Database optimized with indexing & caching.
- Prepared for microservices architecture in later phases.

### 4.3 Extensibility

- Easy to add new features: Nutrition, Wearables, AI Coaching, Leaderboards.
- API-first design with versioning (`/api/v1`).

### 4.4 Security

- Hashed + salted passwords (bcrypt).
- JWT authentication with refresh tokens.
- Brute-force attack mitigation.
- Two-factor authentication (2FA).
- HTTPS enforced.
- GDPR: full user data deletion on request.

### 4.5 Accessibility (Barrier-Free)

- WCAG 2.1 compliance (contrast, ARIA labels, keyboard navigation).
- Colorblind-friendly palettes.
- Support for screen readers.

### 4.6 Performance

- Fast response time (<300ms API calls under normal load).
- Responsive UI for mobile, tablet, desktop.
- Lazy-loading of large datasets (historical sessions).

---

## 5. UI/UX Requirements

### 5.1 Design Principles

- Clean, minimalistic design.
- Visual hierarchy with clear typography and iconography.
- Device-responsive layout (mobile-first, tablet, desktop).
- Accessible color contrast and scalable font sizes.

### 5.2 Key Screens

1. **Dashboard / Homepage**

   - Shows user’s next planned session, quick stats, and feed of public sessions.

2. **Planner**

   - Create/edit planned sessions.
   - Calendar view with recurring schedules.

3. **Logger**

   - Start/complete session.
   - Add exercises one by one (with attributes).
   - Save entire session at completion.

4. **Progress Dashboard**

   - Graphs of historical performance (volume, intensity, frequency).
   - Session comparison (planned vs. actual).

5. **Feed / Community**

   - Stream of public sessions with ability to try/copy them.

6. **Profile & Settings**
   - Manage profile (age, weight, fitness level).
   - Privacy & account deletion.
   - Security settings (2FA, password reset).

---

## 6. Architecture & Technologies

### 6.1 System Architecture

- **Frontend**: React (Vite) + TailwindCSS.
  - Pages: Home/Feed, Login/Register, Dashboard (planning/logging), Account (profile + calendar).
  - Token handling: localStorage for access/refresh; Axios instance with interceptor.
- **Backend**: Node.js + Express + Knex (PostgreSQL).
  - Middleware: Helmet, CORS, cookie/body parsers, `requireAuth`, `requireAdmin`.
  - Auth: `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`.
  - Account: `/account` (GET/PUT), `/account/sessions` (GET), `/account/avatar` (POST multipart), `/account/recovery-email` (POST), `/account` (DELETE).
  - Sessions: `/sessions` (CRUD, complete), `/feed` (public sessions).
  - File storage: local `/uploads` (production can move to S3/GCS).
- **Infrastructure**: Docker Compose (frontend, backend, postgres). Optional pgAdmin service for local development.
- **Database**: PostgreSQL, normalized relational schema, migrations via Knex.
- **Deployment**: Docker Compose (development) → Kubernetes (production scalability).
- **Authentication**: JWT + refresh tokens, secure cookies.
- **Security Enhancements**:
  - Brute-force detection and account lockout.
  - 2FA (via email or authenticator app).
  - HTTPS/TLS certificates.
- **Caching/Performance**: Redis (future extension).

### 6.2 Architecture Diagram (logical)

```
[ Client (Browser/Mobile) ]
        |
   Responsive UI (React + Vite)
        |
   REST API calls (HTTPS, JSON)
        |
   [ Backend API Layer - Node.js/Express ]
     - Auth Module
     - Exercise Module
     - Session Module
     - Progress Module
     - Points Module
     - Feed Module
        |
   [ Database - PostgreSQL ]
        |
   [ Future Services: Redis cache, ML/AI recommender, Wearables integrations ]
```

### 6.3 Technologies Used

- **Frontend**: React 18, Vite, Axios, TailwindCSS (for styling), Recharts (for graphs).
- **Backend**: Node.js (v20), Express, Knex, bcrypt, jsonwebtoken.
- **Database**: PostgreSQL 15.
- **Infrastructure**: Docker, Docker Compose (local), Kubernetes-ready.
- **Security**: HTTPS, bcrypt password hashing, JWT auth, 2FA, brute-force protection.
- **Accessibility**: WCAG 2.1 design standards.

---

## 7. Styling Guide – FitVibe Training App

### 7.1 General Design Language

- **Look & Feel**: Light theme with soft gradients and high contrast accent colors (blue, pink, green, purple).
- **Background**: White or very light gray for clarity.
- **Cards**: Rounded corners (`rounded-2xl`), subtle shadows (`shadow-md`), padding (`p-4`).
- **Typography**: Clean sans-serif, bold headings, lighter paragraph text.
- **Icons**: Minimal, line-based (e.g. Lucide React).

---

### 7.2 Layout & Responsiveness

- **Mobile-first**: Default layout optimized for phones.
- **Grid/Flex**: Use Tailwind’s `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.
- **Cards & Widgets**: Collapse into vertical stack on mobile, expand to multi-column on tablet/desktop.
- **Navbar**: Sticky at the top, gradient background, collapses into a hamburger menu on small screens.
- **Calendar (Account)**:
  - Completed sessions: solid **accent green** (e.g., `#16a34a`).
  - Planned sessions: **indigo→purple gradient** (e.g., `from-indigo-500 to-purple-600`).
  - Tooltip on hover: title, status, points, planned/completed date.

---

### 7.3 Color Palette

Inspired by the uploaded design.

- **Primary Gradient**: from `#667eea` (blue) to `#764ba2` (purple).
- **Accent Colors**:
  - Green: `#34d399` (success, progress)
  - Pink: `#f472b6` (alerts, highlights)
  - Orange: `#f97316` (warnings, metrics)
- **Neutral**:
  - Background: `#f9fafb`
  - Card: `#ffffff`
  - Text Primary: `#1f2937`
  - Text Secondary: `#6b7280`

---

### 7.4 Navbar

- **Desktop**: Horizontal links aligned right.
- **Mobile**: Collapsible hamburger menu.
- **Gradient header**: Blue→Purple with white text.
- **Height**: ~56px (`h-14`).

**Tailwind Example:**

```jsx
<nav className="bg-gradient-to-r from-indigo-500 to-purple-600 h-14 flex items-center px-4 shadow-md">
  <div className="text-white font-bold text-lg">FitVibe</div>
  <div className="ml-auto hidden md:flex space-x-6">
    <a href="/dashboard" className="text-white hover:opacity-80">
      Dashboard
    </a>
    <a href="/sessions" className="text-white hover:opacity-80">
      Sessions
    </a>
    <a href="/progress" className="text-white hover:opacity-80">
      Progress
    </a>
    <a href="/feed" className="text-white hover:opacity-80">
      Community
    </a>
  </div>
  {/* Mobile Menu */}
  <button className="ml-auto md:hidden text-white">☰</button>
</nav>
```

---

### 7.5 Components

- **Cards**: Rounded, white, shadow, gradient headers for key metrics.
- **Buttons**: Rounded (`rounded-full` or `rounded-lg`), bold color fills (green, blue, pink), hover opacity changes.
- **Charts**: Circular progress rings (match accent colors), line/area graphs with smooth curves.

---

### 7.6 Accessibility

- High contrast text on gradient/nav backgrounds.
- Minimum 44px target size for buttons on mobile.
- Semantic HTML (`<nav>`, `<main>`, `<section>`).
- Tailwind utilities for ARIA support (`sr-only` labels).

---

This styling guide supplements the PRD and serves as the basis for frontend implementation in TailwindCSS.

# 8. Database Schema

### `users`

| Column        | Type      | Notes                       |
| ------------- | --------- | --------------------------- |
| id (PK)       | BIGINT    | Primary key                 |
| username      | TEXT      | Unique login name           |
| password_hash | TEXT      | Bcrypt hash of password     |
| role          | TEXT      | `user` (default) or `admin` |
| status        | TEXT      | `active`, `disabled`, …     |
| created_at    | TIMESTAMP | Default `now()`             |

### `user_contacts`

| Column       | Type      | Notes                           |
| ------------ | --------- | ------------------------------- |
| id (PK)      | BIGINT    |                                 |
| user_id (FK) | BIGINT    | → `users.id`                    |
| type         | TEXT      | `email`, `recovery`, `phone`, … |
| value        | TEXT      | Address/number                  |
| is_verified  | BOOLEAN   | Default `false`                 |
| created_at   | TIMESTAMP | Default `now()`                 |

### `user_static`

| Column        | Type   | Notes              |
| ------------- | ------ | ------------------ |
| user_id (PK)  | BIGINT | → `users.id` (1–1) |
| date_of_birth | DATE   | Immutable          |
| gender        | TEXT   | Immutable          |

### `user_state`

| Column        | Type      | Notes                                        |
| ------------- | --------- | -------------------------------------------- |
| user_id (PK)  | BIGINT    | → `users.id` (1–1)                           |
| alias         | TEXT      | Display name                                 |
| weight        | DECIMAL   | Numeric weight in chosen unit                |
| weight_unit   | TEXT      | Default `kg`                                 |
| fitness_level | TEXT      | `beginner` / `intermediate` / `advanced`     |
| photo_url     | TEXT      | Path or URL to avatar (e.g., `/uploads/...`) |
| updated_at    | TIMESTAMP | Default `now()`                              |

### `user_state_history`

| Column        | Type      | Notes                                |
| ------------- | --------- | ------------------------------------ |
| id (PK)       | BIGINT    |                                      |
| user_id (FK)  | BIGINT    | → `users.id`                         |
| alias         | TEXT      | Snapshot                             |
| weight        | DECIMAL   | Snapshot                             |
| weight_unit   | TEXT      | Snapshot                             |
| fitness_level | TEXT      | Snapshot                             |
| photo_url     | TEXT      | Snapshot                             |
| updated_at    | TIMESTAMP | Snapshot timestamp (default `now()`) |

### `badges`

| Column       | Type      | Notes            |
| ------------ | --------- | ---------------- |
| id (PK)      | BIGINT    |                  |
| user_id (FK) | BIGINT    | → `users.id`     |
| name         | TEXT      | Badge name       |
| description  | TEXT      | Optional details |
| awarded_at   | TIMESTAMP | Default `now()`  |

### `exercises`

| Column        | Type      | Notes                               |
| ------------- | --------- | ----------------------------------- |
| id (PK)       | BIGINT    |                                     |
| owner_user_id | BIGINT    | → `users.id` (nullable, `SET NULL`) |
| name          | TEXT      | Required                            |
| category      | TEXT      | e.g., `cardio`, `strength`          |
| muscle_group  | TEXT      | e.g., `legs`, `back`                |
| tags          | TEXT[]    | Free-form labels                    |
| is_public     | BOOLEAN   | Default `true`                      |
| created_at    | TIMESTAMP | Default `now()`                     |
| deleted_at    | TIMESTAMP | Soft delete                         |

### `sessions`

| Column          | Type      | Notes                                |
| --------------- | --------- | ------------------------------------ |
| id (PK)         | BIGINT    |                                      |
| owner_user_id   | BIGINT    | → `users.id`                         |
| title           | TEXT      | Session title                        |
| planned_for     | TIMESTAMP | Planned date/time                    |
| completed_at    | TIMESTAMP | Completion date/time                 |
| status          | TEXT      | `planned` / `completed` / `canceled` |
| visibility      | TEXT      | `private` / `public`                 |
| calories_burned | DECIMAL   | Calculated on completion             |
| points_total    | DECIMAL   | Session summary points               |
| created_at      | TIMESTAMP | Default `now()`                      |
| deleted_at      | TIMESTAMP | Soft delete                          |

### `session_exercises` _(unit-agnostic values + alternative unit labels)_

| Column                           | Type    | Notes                                     |
| -------------------------------- | ------- | ----------------------------------------- |
| id (PK)                          | BIGINT  |                                           |
| session_id (FK)                  | BIGINT  | → `sessions.id`                           |
| name_snapshot                    | TEXT    | Exercise name at time of planning/logging |
| position                         | INT     | Order within session (unique per session) |
| planned_sets                     | INT     | Optional                                  |
| planned_reps                     | INT     | Optional                                  |
| planned_distance                 | DECIMAL | Optional (numeric)                        |
| planned_distance_alt_unit        | TEXT    | Optional (e.g., `m`, `km`, `mi`)          |
| planned_duration                 | DECIMAL | Optional (numeric)                        |
| planned_load                     | DECIMAL | Optional (numeric)                        |
| planned_load_alt_unit            | TEXT    | Optional (e.g., `kg`, `lb`)               |
| planned_rpe                      | DECIMAL | Optional, 1 decimal place                 |
| actual_sets                      | INT     | Optional                                  |
| actual_total_reps                | INT     | Optional                                  |
| actual_distance                  | DECIMAL | Optional (numeric)                        |
| actual_distance_alt_unit         | TEXT    | Optional                                  |
| actual_duration                  | DECIMAL | Optional (numeric)                        |
| actual_avg_load                  | DECIMAL | Optional (numeric)                        |
| actual_load_alt_unit             | TEXT    | Optional                                  |
| actual_rpe                       | DECIMAL | Optional, 1 decimal place                 |
| **UNIQUE(session_id, position)** |         | Ensures stable ordering per session       |

### `user_points`

| Column       | Type      | Notes                                           |
| ------------ | --------- | ----------------------------------------------- |
| id (PK)      | BIGINT    |                                                 |
| user_id (FK) | BIGINT    | → `users.id`                                    |
| source_type  | TEXT      | `session`, `badge`, `challenge`, `streak`, …    |
| source_id    | BIGINT    | Optional link to source entity                  |
| points       | DECIMAL   | Positive/negative; allows adjustments if needed |
| awarded_at   | TIMESTAMP | Default `now()`                                 |

---

## 8.4 Relations

```
(1)───∞ means: one-to-many; (1)───(1) means: one-to-one

┌───────────────┐            ┌──────────────────┐
│ users         │(1)────────>│ user*credentials │
│ id (PK)       │            │ id (PK)          │
│ username      │            │ user_id (FK)     │
│ password_hash │            │ type             │
│ role          │            │ identifier       │
│ status        │            │ secret           │
│ created_at    │            │ created_at       │
└───────┬───────┘            └──────────────────┘
        │(1)
        │
        v(∞)
┌──────────────────┐
│ user_contacts    │
│ id (PK)          │
│ user_id (FK)     │
│ type (email/…)   │
│ value            │
│ is_verified      │
│ created_at       │
└────────┬─────────┘
         │(1)
         │
         v(1)
┌──────────────────┐
│ user_static      │ (immutable)
│ user_id (PK, FK) │
│ date_of_birth    │
│ gender           │
└────────┬─────────┘
         │(1)
         │
         v(1)
┌──────────────────┐          ┌──────────────────────┐
│ user_state       │(1)───∞──>│ user_state_history   │
│ user_id (PK, FK) │          │ id (PK)              │
│ alias            │          │ user_id (FK)         │
│ weight           │          │ alias                │
│ weight_unit      │          │ weight               │
│ fitness_level    │          │ weight_unit          │
│ photo_url        │          │ fitness_level        │
│ updated_at       │          │ photo_url            │
└────────┬─────────┘          │ updated_at           │
         │(1)                 └──────────────────────┘
         │
         v(∞)
┌──────────────────┐
│ badges           │
│ id (PK)          │
│ user_id (FK)     │
│ name             │
│ description      │
│ awarded_at       │
└────────┬─────────┘
         │(1)
         │
         v(∞)
┌──────────────────┐
│ user_points      │
│ id (PK)          │
│ user_id (FK)     │
│ source_type      │
│ source_id        │
│ points           │
│ awarded_at       │
└────────┬─────────┘
         │
         │
         v
┌──────────────────┐              ┌───────────────────┐
│ exercises        │              │ sessions          │
│ id (PK)          │              │ id (PK)           │
│ owner_user_id FK │(1)◄───────(∞) owner_user_id FK   │
│ name             │              │ title             │
│ category         │              │ planned_for       │
│ muscle_group     │              │ completed_at      │
│ tags[]           │              │ status            │
│ is_public        │              │ visibility        │
│ created_at       │              │ calories_burned   │
│ deleted_at       │              │ points_total      │
└──────────────────┘              │ created_at        │
                                  │ deleted_at        │
                                  └─────────┬─────────┘
                                            │(1)
                                            │
                                            v(∞)
                                  ┌────────────────────────┐
                                  │ session_exercises      │
                                  │ id (PK)                │
                                  │ session_id (FK)        │
                                  │ name_snapshot          │
                                  │ position (unique\*)    │
                                  │ planned*\_ / actual\__ │
                                  │ _\_distance/\_load     │
                                  │ \_\_duration/\_rpe     │
                                  │ \*\_alt_unit           │
                                  └────────────────────────┘
```

## 9. Roadmap

### Phase 1 (MVP)

- User authentication + profile management
- Exercise creation & session logging
- Session planning (date & recurring)
- Feed (public/private sessions)
- Points calculation
- Progress dashboard (basic history)

### Phase 2

- Advanced progress analytics (charts, streaks, personal bests)
- Social features (likes, bookmarks)
- Multi-device sync
- Stronger 2FA adoption

### Phase 3

- Wearable integrations (Garmin, Strava)
- Nutrition tracking module
- AI recommendations & adaptive training

---

## 10. Risks & Mitigations

- **Token theft** → Short-lived access tokens; rotating refresh tokens; server-side revocation list; HTTPS everywhere.
- **PII exposure** → Separate contacts/credentials from `users`; limit returned fields; audit logs; strict CORS.
- **Unit ambiguity** → Store numeric values without units plus explicit `_alt_unit` fields; display according to user preference.
- **Performance bottlenecks** → DB indexing (FKs, `owner_user_id`, `planned_for`); pagination for feed; CDN/static caching for uploads.
- **Vendor lock-in for storage** → Agitbstract file storage to enable swap from local `/uploads` to S3/GCS later with minimal code change.
