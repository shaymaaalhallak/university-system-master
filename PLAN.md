# University Management System Enhancement Plan

**Current Status:** Basic structure exists, demo data in-memory, MySQL connected

**Files to Create/Update:**

```
1. backend/src/middleware/auth.ts - Auth + blocking check
2. backend/src/models/ - DB models (users, courses, etc.)
3. backend/src/controllers/ - Business logic
4. frontend/src/app/admin/users/page.tsx - User management
5. frontend/src/app/admin/logs/page.tsx - Login logs
6. frontend/src/app/student/schedule/page.tsx - Weekly schedule
7. frontend/src/app/student/course-registration/page.tsx - Course reg with prereqs
8. frontend/src/app/professor/cv/page.tsx - CV upload
9. frontend/src/app/student/exemption/page.tsx - Exam exemption requests
```

**Key Features to Implement:**

1. **Admin:** User CRUD, blocking toggle, login logs
2. **Professor:** Attendance, grades (admin permission), CV upload
3. **Student:** Course reg (19 credit limit, prereqs), GPA 4.0 calc, schedule, exemptions
4. **Global:** Login/logout logging, user blocking

**Database Schema Updates:**

- users: add `blocked`, `blockedReason`, `cvPath`
- logs: userId, action, timestamp, ip
- semesters: year, term
- tuition: studentId, semester, amount, paid

**Next Steps:**

1. Add auth middleware with blocking
2. Create admin user management page
3. Add user log table/API
4. Implement course prerequisites & credit limits

**Approve this plan before implementation?**
