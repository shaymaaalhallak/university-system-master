import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) =>
      err ? reject(err) : resolve(results),
    ),
  );

// GET /api/dashboard/student
router.get(
  "/student",
  verifyToken,
  requireRole("student"),
  async (req: Request, res: Response) => {
    try {
      const studentRows = await query(
        "SELECT student_id, gpa, semester FROM students WHERE user_id = ?",
        [req.user!.id],
      );
      if (studentRows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Student profile not found" });
      }
      const { student_id, gpa, semester } = studentRows[0];

      // Active enrollments with schedule — safe if enrollments table missing
      let enrollments: any[] = [];
      try {
        enrollments = await query(
          `SELECT c.course_code, c.course_title, c.credits,
                cs.room_number, cs.schedule_time,
                u.first_name AS prof_first, u.last_name AS prof_last
         FROM enrollments e
         JOIN course_sections cs ON e.section_id = cs.section_id
         JOIN courses c ON cs.course_id = c.course_id
         JOIN professors p ON cs.professor_id = p.professor_id
         JOIN users u ON p.user_id = u.user_id
         WHERE e.student_id = ? AND e.status = 'active'
         ORDER BY c.course_code`,
          [student_id],
        );
      } catch {
        /* enrollments table not yet created */
      }

      // Total credits this semester
      let creditRow = [{ total: 0 }];
      try {
        creditRow = await query(
          `SELECT COALESCE(SUM(c.credits), 0) AS total
         FROM enrollments e
         JOIN course_sections cs ON e.section_id = cs.section_id
         JOIN courses c ON cs.course_id = c.course_id
         WHERE e.student_id = ? AND e.status = 'active'`,
          [student_id],
        );
      } catch {}

      // Overall attendance rate
      const attRow = await query(
        `SELECT
         COUNT(*) AS total,
         SUM(status = 'Present') AS present
       FROM attendance WHERE student_id = ?`,
        [student_id],
      );
      const attTotal = Number(attRow[0].total) || 0;
      const attPresent = Number(attRow[0].present) || 0;
      const attendanceRate =
        attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

      // Pending assignments — safe if enrollments table missing
      let pendingAssignments: any[] = [];
      try {
        pendingAssignments = await query(
          `SELECT a.assignment_id AS id, a.title, c.course_title AS course, a.due_date
         FROM assignments a
         JOIN course_sections cs ON a.section_id = cs.section_id
         JOIN courses c ON cs.course_id = c.course_id
         JOIN enrollments e ON e.section_id = a.section_id AND e.student_id = ? AND e.status = 'active'
         LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.assignment_id AND sub.student_id = ?
         WHERE a.due_date >= CURDATE() AND sub.submission_id IS NULL
         ORDER BY a.due_date ASC LIMIT 5`,
          [student_id, student_id],
        );
      } catch {}

      // Recent announcements — safe if announcements table doesn't exist yet
      let announcements: any[] = [];
      try {
        announcements = await query(
          `SELECT announcement_id AS id, title, created_at AS date
         FROM announcements
         WHERE (target_roles LIKE '%student%' OR target_roles LIKE '%all%')
           AND (expires_at IS NULL OR expires_at >= CURDATE())
         ORDER BY created_at DESC LIMIT 5`,
        );
      } catch {
        /* table may not exist on first run */
      }

      // Pending fees
      const feeRow = await query(
        "SELECT COALESCE(SUM(amount), 0) AS pending FROM payments WHERE student_id = ? AND status = 'pending'",
        [student_id],
      );
      let studyPlan: any = {
        semesters: [],
        enrollmentYear: null,
        planNames: [],
      };
      try {
        const planRes = await query(
          `SELECT s.enrollment_year, sp.plan_id, sp.plan_name
         FROM students s
         LEFT JOIN study_plans sp
           ON (sp.program_id = s.program_id)
           OR (sp.program_id IS NULL AND (sp.department_id = s.department_id OR sp.department_id IS NULL))
         WHERE s.student_id = ?
         ORDER BY CASE WHEN sp.program_id = s.program_id THEN 0 ELSE 1 END`,
          [student_id],
        );

        if (planRes.length > 0) {
          const enrollmentYear = Number(
            planRes[0].enrollment_year || new Date().getFullYear(),
          );
          const planIds = planRes
            .map((row: any) => Number(row.plan_id))
            .filter((v: number) => Number.isFinite(v) && v > 0);
          let items: any[] = [];
          if (planIds.length > 0) {
            items = await query(
              `SELECT spc.year_no, spc.semester_no, spc.course_bucket, c.course_code, c.course_title, c.credits
             FROM study_plan_courses spc
             JOIN courses c ON c.course_id = spc.course_id
             WHERE spc.plan_id IN (${planIds.map(() => "?").join(",")})
             ORDER BY spc.year_no, spc.semester_no, c.course_code`,
              planIds,
            );
          }

          const grouped = new Map<string, any[]>();
          items.forEach((item: any) => {
            const key = `${item.year_no}-${item.semester_no}`;
            const list = grouped.get(key) || [];
            list.push(item);
            grouped.set(key, list);
          });

          studyPlan = {
            enrollmentYear,
            planNames: planRes.map((row: any) => row.plan_name).filter(Boolean),
            semesters: Array.from(grouped.entries()).map(([key, rows]) => {
              const [yearNo, semesterNo] = key.split("-").map(Number);
              return {
                yearNo,
                semesterNo,
                calendarYear: enrollmentYear + yearNo - 1,
                courses: rows.map((row: any) => ({
                  code: row.course_code,
                  name: row.course_title,
                  credits: Number(row.credits || 0),
                  bucket: row.course_bucket || "major",
                })),
              };
            }),
          };
        }
      } catch {}
      return res.json({
        success: true,
        data: {
          gpa: gpa ? Number(gpa).toFixed(2) : "0.00",
          credits: Number(creditRow[0].total),
          semester,
          attendanceRate,
          pendingFees: Number(feeRow[0].pending),
          upcomingClasses: enrollments.map((e: any) => ({
            courseName: e.course_title,
            courseCode: e.course_code,
            time: e.schedule_time,
            room: e.room_number,
            professor: `${e.prof_first} ${e.prof_last}`,
          })),
          pendingAssignments,
          recentAnnouncements: announcements,
          studyPlan,
        },
      });
    } catch (error) {
      console.error("Student dashboard error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// GET /api/dashboard/professor
router.get(
  "/professor",
  verifyToken,
  requireRole("professor"),
  async (req: Request, res: Response) => {
    try {
      const profRows = await query(
        "SELECT professor_id FROM professors WHERE user_id = ?",
        [req.user!.id],
      );
      if (profRows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Professor profile not found" });
      }
      const profId = profRows[0].professor_id;

      // Sections teaching this year — enrolled count safe if enrollments missing
      let sections: any[] = [];
      try {
        sections = await query(
          `SELECT cs.section_id, c.course_code, c.course_title,
                cs.room_number, cs.schedule_time, cs.semester, cs.year,
                (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = cs.section_id AND e.status = 'active') AS enrolled,
                COALESCE(gec.is_enabled, 0) AS grade_entry_enabled
         FROM course_sections cs
         JOIN courses c ON cs.course_id = c.course_id
         LEFT JOIN grade_entry_control gec ON gec.section_id = cs.section_id
         WHERE cs.professor_id = ?
         ORDER BY cs.year DESC, cs.semester`,
          [profId],
        );
      } catch {
        // Fallback without enrollment count if tables missing
        sections = await query(
          `SELECT cs.section_id, c.course_code, c.course_title,
                cs.room_number, cs.schedule_time, cs.semester, cs.year,
                0 AS enrolled, 0 AS grade_entry_enabled
         FROM course_sections cs
         JOIN courses c ON cs.course_id = c.course_id
         WHERE cs.professor_id = ?
         ORDER BY cs.year DESC, cs.semester`,
          [profId],
        );
      }

      const totalStudents = sections.reduce(
        (sum: number, s: any) => sum + Number(s.enrolled),
        0,
      );

      // Ungraded submissions
      const pendingGrading = await query(
        `SELECT COUNT(*) AS count
       FROM assignment_submissions sub
       JOIN assignments a ON sub.assignment_id = a.assignment_id
       JOIN course_sections cs ON a.section_id = cs.section_id
       WHERE cs.professor_id = ? AND sub.score IS NULL`,
        [profId],
      );

      // Announcements — safe if table missing
      let announcements: any[] = [];
      try {
        announcements = await query(
          `SELECT announcement_id AS id, title, priority, created_at
         FROM announcements
         WHERE (target_roles LIKE '%professor%' OR target_roles LIKE '%all%')
           AND (expires_at IS NULL OR expires_at >= CURDATE())
         ORDER BY created_at DESC LIMIT 5`,
        );
      } catch {
        /* table may not exist on first run */
      }

      return res.json({
        success: true,
        data: {
          coursesTeaching: sections.length,
          totalStudents,
          pendingGrading: Number(pendingGrading[0].count),
          sections: sections.map((s: any) => ({
            sectionId: s.section_id,
            courseName: s.course_title,
            courseCode: s.course_code,
            time: s.schedule_time,
            room: s.room_number,
            enrolled: s.enrolled,
            gradeEntryEnabled: !!s.grade_entry_enabled,
          })),
          announcements,
        },
      });
    } catch (error) {
      console.error("Professor dashboard error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// GET /api/dashboard/admin
router.get(
  "/admin",
  verifyToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const [students, professors, courses, blocked, payments] =
        await Promise.all([
          query(
            "SELECT COUNT(*) AS count FROM users WHERE role = 'student' AND status = 'active'",
          ),
          query(
            "SELECT COUNT(*) AS count FROM users WHERE role = 'professor' AND status = 'active'",
          ),
          query("SELECT COUNT(*) AS count FROM courses"),
          query("SELECT COUNT(*) AS count FROM users WHERE status = 'blocked'"),
          query(
            "SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status = 'completed'",
          ),
        ]);

      // These tables are created by migration — safe fallback if not yet created
      let enrollmentsCount = [{ count: 0 }];
      let recentActivity: any[] = [];
      let pendingExemptions = [{ count: 0 }];
      try {
        enrollmentsCount = await query(
          "SELECT COUNT(*) AS count FROM enrollments WHERE status = 'active'",
        );
      } catch {}
      try {
        recentActivity = await query(
          `SELECT al.action, al.created_at, u.first_name, u.last_name, u.role, u.email
         FROM audit_logs al JOIN users u ON al.user_id = u.user_id
         ORDER BY al.created_at DESC LIMIT 10`,
        );
      } catch {}
      try {
        pendingExemptions = await query(
          "SELECT COUNT(*) AS count FROM exam_exemptions WHERE status = 'pending'",
        );
      } catch {}

      return res.json({
        success: true,
        data: {
          totalStudents: Number(students[0].count),
          totalProfessors: Number(professors[0].count),
          totalCourses: Number(courses[0].count),
          activeEnrollments: Number(enrollmentsCount[0].count),
          blockedUsers: Number(blocked[0].count),
          totalRevenue: Number(payments[0].total),
          pendingExemptions: Number(pendingExemptions[0].count),
          recentActivities: recentActivity.map((a: any) => ({
            type: a.action,
            description: `${a.first_name} ${a.last_name} (${a.role}) — ${a.action}`,
            email: a.email,
            time: a.created_at,
          })),
        },
      });
    } catch (error) {
      console.error("Admin dashboard error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

export default router;
