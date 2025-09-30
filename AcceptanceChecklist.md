# Acceptance Checklist – Training Planner & Logger (v2.0)

## 1. User Management & Security
- [ ] Users can register with username, password, and profile details.  
- [ ] Passwords must follow policy (≥12 characters, mixed case, number, special char).  
- [ ] Passwords are stored hashed (bcrypt).  
- [ ] Users can log in and log out securely.  
- [ ] JWT + refresh token authentication works as specified.  
- [ ] Session cookies are httpOnly and secure.  
- [ ] Brute-force protection: account locks after 10 failed attempts, reset required.  
- [ ] 2FA (email or authenticator app) can be enabled/disabled in profile settings.  
- [ ] HTTPS enforced across all routes.  
- [ ] Users can update profile information.  
- [ ] Users can delete their account and all related data (GDPR compliance).  

## 2. Exercises
- [ ] User can create custom exercises with attributes (distance, time, sets, reps, resistance, effort).  
- [ ] Exercises are stored and reusable across sessions.  
- [ ] Exercises can be edited and deleted.  

## 3. Sessions
- [ ] Users can plan sessions for a specific date.  
- [ ] Users can plan recurring sessions (weekly, multiple days).  
- [ ] Users can execute and log actual sessions.  
- [ ] Sessions can be cloned and modified.  
- [ ] Sessions can be deleted.  
- [ ] Users can toggle session visibility (public/private).  

## 4. Planning
- [ ] Calendar view displays upcoming planned sessions.  
- [ ] Weekly recurring sessions appear correctly.  
- [ ] Exceptions (skipped or extra sessions) are handled properly.  

## 5. Logging
- [ ] Users can add exercises one by one into a session.  
- [ ] Users can save the entire session after all exercises are added.  
- [ ] Planned vs. actual performance differences are stored.  

## 6. Progress Tracking
- [ ] Users can view all historical sessions and exercises.  
- [ ] Graphs/charts of progress (volume, intensity, frequency) display correctly.  
- [ ] Planned vs. executed comparison is available.  
- [ ] Personal bests and streaks are tracked.  

## 7. Points System
- [ ] Points are awarded automatically after session completion.  
- [ ] Points calculation includes: calories, age, sex, fitness level, subjective effort.  
- [ ] Users only see the points total (calculation remains hidden).  

## 8. Sharing & Community
- [ ] Public sessions appear on the homepage feed.  
- [ ] Users can view and try public sessions from others.  
- [ ] Users can make sessions private (not visible to others).  
- [ ] Users can delete their shared sessions.  
- [ ] (Optional extension) Users can bookmark or like sessions.  

## 9. Non-Functional
- [ ] Application is modular (frontend, backend, DB separated).  
- [ ] API endpoints are versioned (`/api/v1`).  
- [ ] UI is responsive (mobile, tablet, desktop).  
- [ ] UI passes WCAG 2.1 accessibility checks.  
- [ ] App supports keyboard navigation and screen readers.  
- [ ] API average response <300ms under test load.  
- [ ] Security tests confirm HTTPS, brute-force lockout, 2FA, and session protection.  

## 10. Deployment & Ops
- [ ] Application runs with Docker Compose (frontend, backend, DB).  
- [ ] Database migrations apply successfully.  
- [ ] Documentation is provided (README, PRD, Acceptance Checklist).  
- [ ] Logging and monitoring are in place for errors and performance.  
