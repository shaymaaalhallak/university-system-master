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
const tableExists = async (tableName: string): Promise<boolean> => {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
};

const columnExists = async (
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return Number(rows?.[0]?.cnt || 0) > 0;
};

const getExistingColumn = async (
  tableName: string,
  candidates: string[],
): Promise<string | null> => {
  for (const col of candidates) {
    if (await columnExists(tableName, col)) return col;
  }
  return null;
};

// Helper: get student_id from user_id
const getStudentId = async (userId: number): Promise<number | null> => {
  const rows = await query(
    "SELECT student_id FROM students WHERE user_id = ?",
    [userId],
  );
  return rows.length > 0 ? rows[0].student_id : null;
};

// GET /api/enrollments — Admin/Professor
router.get(
  "/",
  verifyToken,
  requireRole("admin", "professor"),
  async (req: Request, res: Response) => {
    try {
      const { studentId, sectionId, status } = req.query;
      let sql = `
      SELECT e.enrollment_id, e.student_id, e.section_id, e.status, e.enrolled_at,
             u.first_name, u.last_name, u.email,
             c.course_code, c.course_title, c.credits,
             cs.semester, cs.year,
             COALESCE(r.room_number, '') AS room_number,
             COALESCE((SELECT GROUP_CONCAT(CONCAT(LEFT(ss.day_of_week, 3), ' ', TIME_FORMAT(ss.start_time, '%H:%i'), '-', TIME_FORMAT(ss.end_time, '%H:%i')) SEPARATOR ', ') FROM section_schedule ss WHERE ss.section_id = cs.section_id), '') AS schedule_time
      FROM enrollments e
      JOIN students s ON e.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      JOIN course_sections cs ON e.section_id = cs.section_id
      JOIN courses c ON cs.course_id = c.course_id
      LEFT JOIN rooms r ON cs.room_id = r.room_id
      WHERE 1=1
    `;
      const params: any[] = [];
      if (studentId) {
        sql += " AND e.student_id = ?";
        params.push(studentId);
      }
      if (sectionId) {
        sql += " AND e.section_id = ?";
        params.push(sectionId);
      }
      if (status) {
        sql += " AND e.status = ?";
        params.push(status);
      }
      sql += " ORDER BY e.enrolled_at DESC";

      const rows = await query(sql, params);
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// GET /api/enrollments/my — Logged-in student's enrollments
router.get(
  "/my",
  verifyToken,
  requireRole("student"),
  async (req: Request, res: Response) => {
    try {
      const studentId = await getStudentId(req.user!.id);
      if (!studentId)
        return res
          .status(404)
          .json({ success: false, message: "Student profile not found" });

      const rows = await query(
        `SELECT e.enrollment_id, e.section_id, e.status, e.enrolled_at,
              c.course_id, c.course_code, c.course_title, c.credits,
              cs.semester, cs.year,
              COALESCE(r.room_number, '') AS room_number,
              COALESCE((SELECT GROUP_CONCAT(CONCAT(LEFT(ss.day_of_week, 3), ' ', TIME_FORMAT(ss.start_time, '%H:%i'), '-', TIME_FORMAT(ss.end_time, '%H:%i')) SEPARATOR ', ') FROM section_schedule ss WHERE ss.section_id = cs.section_id), '') AS schedule_time,
              u.first_name AS prof_first, u.last_name AS prof_last,
              g.letter_grade, g.total_score
       FROM enrollments e
       JOIN course_sections cs ON e.section_id = cs.section_id
       JOIN courses c ON cs.course_id = c.course_id
       JOIN professors p ON cs.professor_id = p.professor_id
       JOIN users u ON p.user_id = u.user_id
       LEFT JOIN rooms r ON cs.room_id = r.room_id
       LEFT JOIN grades g ON g.student_id = e.student_id AND g.section_id = e.section_id
       WHERE e.student_id = ?
       ORDER BY cs.year DESC, cs.semester`,
        [studentId],
      );
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// POST /api/enrollments — Student registers for a section
router.post(
  "/",
  verifyToken,
  requireRole("student"),
  async (req: Request, res: Response) => {
    try {
      const { sectionId } = req.body;
      console.log("[ENROLL] Step 1: Request received, sectionId=", sectionId);
      if (!sectionId)
        return res
          .status(400)
          .json({ success: false, message: "sectionId is required" });

      const studentId = await getStudentId(req.user!.id);
      console.log("[ENROLL] Step 2: studentId=", studentId);
      if (!studentId)
        return res
          .status(404)
          .json({ success: false, message: "Student profile not found" });

      const studentPlanRows = await query(
        "SELECT department_id, program_id, semester FROM students WHERE student_id = ? LIMIT 1",
        [studentId],
      );
      console.log("[ENROLL] Step 3: student profile=", studentPlanRows[0]);
      if (!studentPlanRows.length) {
        return res.status(404).json({
          success: false,
          message: "Student academic profile not found",
        });
      }
      const studentPlan = studentPlanRows[0];

      const sections = await query(
        `SELECT cs.section_id, cs.course_id, cs.semester, cs.year, c.credits
         FROM course_sections cs JOIN courses c ON cs.course_id = c.course_id
         WHERE cs.section_id = ?`,
        [sectionId],
      );
      console.log("[ENROLL] Step 4: section details=", sections[0]);
      if (sections.length === 0)
        return res
          .status(404)
          .json({ success: false, message: "Section not found" });
      const section = sections[0];

      const [
        hasStudyPlans,
        hasStudyPlanCourses,
        hasProgramColumn,
        hasDepartmentColumn,
      ] = await Promise.all([
        tableExists("study_plans"),
        tableExists("study_plan_courses"),
        columnExists("study_plans", "program_id"),
        columnExists("study_plans", "department_id"),
      ]);
      console.log("[ENROLL] Step 5: hasStudyPlans=", hasStudyPlans, "hasStudyPlanCourses=", hasStudyPlanCourses);

      const semesterCol = hasStudyPlanCourses
        ? await getExistingColumn("study_plan_courses", ["semester_no", "semester"])
        : null;

      // Build the set of allowed course IDs for this student
      const allowedCourseIds = new Set<number>();
      const isDirectCommonSet = new Set<number>();

      if (hasStudyPlans && hasStudyPlanCourses) {
        // 1. Program-specific plan courses
        if (hasProgramColumn && studentPlan.program_id) {
          const programPlans = await query(
            `SELECT plan_id FROM study_plans WHERE program_id = ?`,
            [Number(studentPlan.program_id)],
          );
          console.log("[ENROLL] Step 6: Program-specific plans:", programPlans);
          if (programPlans.length > 0) {
            const planIds = programPlans.map((p: any) => p.plan_id);
            const ph = planIds.map(() => "?").join(",");
            const progCourses = await query(
              `SELECT DISTINCT course_id FROM study_plan_courses WHERE plan_id IN (${ph})`,
              planIds,
            );
            progCourses.forEach((c: any) => allowedCourseIds.add(Number(c.course_id)));
          }
        }

        // 2. Department-common plan courses
        if (hasDepartmentColumn && studentPlan.department_id) {
          const deptPlans = await query(
            `SELECT plan_id FROM study_plans WHERE program_id IS NULL AND department_id = ?`,
            [Number(studentPlan.department_id)],
          );
          console.log("[ENROLL] Step 7: Department-common plans:", deptPlans);
          if (deptPlans.length > 0) {
            const planIds = deptPlans.map((p: any) => p.plan_id);
            const ph = planIds.map(() => "?").join(",");
            const deptCourses = await query(
              `SELECT DISTINCT course_id FROM study_plan_courses WHERE plan_id IN (${ph})`,
              planIds,
            );
            deptCourses.forEach((c: any) => allowedCourseIds.add(Number(c.course_id)));
          }
        }

        // 3. Universal common plan courses
        const universalPlans = await query(
          `SELECT plan_id FROM study_plans WHERE program_id IS NULL AND department_id IS NULL`,
          [],
        );
        console.log("[ENROLL] Step 8: Universal common plans:", universalPlans);
        if (universalPlans.length > 0) {
          const planIds = universalPlans.map((p: any) => p.plan_id);
          const ph = planIds.map(() => "?").join(",");
          const uniCourses = await query(
            `SELECT DISTINCT course_id FROM study_plan_courses WHERE plan_id IN (${ph})`,
            planIds,
          );
          uniCourses.forEach((c: any) => allowedCourseIds.add(Number(c.course_id)));
        }

        // 4. Direct common courses from courses table (department match, no program)
        const directCommon = await query(
          `SELECT course_id FROM courses WHERE department_id = ? AND program_id IS NULL`,
          [Number(studentPlan.department_id)],
        );
        console.log("[ENROLL] Step 9: Direct common courses:", directCommon.length);
        directCommon.forEach((c: any) => {
          const cid = Number(c.course_id);
          allowedCourseIds.add(cid);
          isDirectCommonSet.add(cid);
        });

        console.log("[ENROLL] Step 10: Total allowed course IDs:", Array.from(allowedCourseIds));

        // Validate the course is allowed
        if (allowedCourseIds.size > 0 && !allowedCourseIds.has(section.course_id)) {
          console.log("[ENROLL] Step 11: course_id", section.course_id, "NOT in allowed set");
          return res.status(400).json({
            success: false,
            message: "This course is not available for your program or department.",
          });
        }
      }

      // Check already enrolled in THIS section
      console.log("[ENROLL] Step 14: checking duplicate enrollment");
      const existing = await query(
        "SELECT enrollment_id FROM enrollments WHERE student_id = ? AND section_id = ? AND status = 'active'",
        [studentId, sectionId],
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Already enrolled in this section",
        });
      }

      // Check already enrolled in SAME COURSE (different section/professor)
      const existingCourse = await query(
        `SELECT e.enrollment_id, cs.section_id, u.first_name, u.last_name
         FROM enrollments e
         JOIN course_sections cs ON e.section_id = cs.section_id
         JOIN professors p ON cs.professor_id = p.professor_id
         JOIN users u ON p.user_id = u.user_id
         WHERE e.student_id = ? AND cs.course_id = ? AND e.status = 'active'`,
        [studentId, section.course_id],
      );
      if (existingCourse.length > 0) {
        const profName = `${existingCourse[0].first_name} ${existingCourse[0].last_name}`;
        return res.status(400).json({
          success: false,
          message: `Already enrolled in this course with ${profName}. You can only enroll in one section per course.`,
        });
      }

      // Check prerequisites
      console.log("[ENROLL] Step 11: checking prerequisites for course_id=", section.course_id);
      const prereqs = await query(
        "SELECT required_course_id FROM prerequisites WHERE course_id = ?",
        [section.course_id],
      );
      console.log("[ENROLL] Step 11b: prereqs=", prereqs);

      for (const prereq of prereqs) {
        const completed = await query(
          `SELECT g.grade_id FROM grades g
           JOIN course_sections cs ON g.section_id = cs.section_id
           WHERE g.student_id = ? AND cs.course_id = ? AND g.letter_grade NOT IN ('F', '')`,
          [studentId, prereq.required_course_id],
        );
        if (completed.length === 0) {
          const prereqCourse = await query(
            "SELECT course_code, course_title FROM courses WHERE course_id = ?",
            [prereq.required_course_id],
          );
          const name =
            prereqCourse.length > 0
              ? `${prereqCourse[0].course_code} - ${prereqCourse[0].course_title}`
              : "a required course";
          return res.status(400).json({
            success: false,
            message: `Prerequisite not met: You must complete ${name} first`,
          });
        }
      }

      // Check 19-credit maximum
      console.log("[ENROLL] Step 12: checking credit limit");
      const creditCheck = await query(
        `SELECT COALESCE(SUM(c.credits), 0) AS total_credits
         FROM enrollments e
         JOIN course_sections cs ON e.section_id = cs.section_id
         JOIN courses c ON cs.course_id = c.course_id
         WHERE e.student_id = ? AND e.status = 'active' AND cs.semester = ? AND cs.year = ?`,
        [studentId, section.semester, section.year],
      );

      const currentCredits = Number(creditCheck[0].total_credits);
      console.log("[ENROLL] Step 12b: current_credits=", currentCredits, "section_credits=", section.credits);
      if (currentCredits + section.credits > 19) {
        return res.status(400).json({
          success: false,
          message: `Cannot enroll: would exceed 19-credit maximum (currently at ${currentCredits} credits)`,
        });
      }

      // All checks passed — enroll (re-activate if previously dropped)
      console.log("[ENROLL] Step 13: inserting/updating enrollment");
      await query(
        `INSERT INTO enrollments (student_id, section_id, status)
         VALUES (?, ?, 'active')
         ON DUPLICATE KEY UPDATE status = 'active'`,
        [studentId, sectionId],
      );

      const enrollment = await query(
        "SELECT enrollment_id FROM enrollments WHERE student_id = ? AND section_id = ?",
        [studentId, sectionId],
      );

      console.log("[ENROLL] SUCCESS: enrollmentId=", enrollment[0]?.enrollment_id);
      return res.status(201).json({
        success: true,
        message: "Successfully enrolled",
        data: { enrollmentId: enrollment[0]?.enrollment_id },
      });
    } catch (error: any) {
      console.error("[ENROLL] ERROR:", error.message);
      console.error("[ENROLL] ERROR STACK:", error.stack);
      return res.status(500).json({
        success: false,
        message: "Server error during enrollment",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

// DELETE /api/enrollments/:id — Student drops a course
router.delete(
  "/:id",
  verifyToken,
  requireRole("student"),
  async (req: Request, res: Response) => {
    try {
      const studentId = await getStudentId(req.user!.id);
      if (!studentId)
        return res
          .status(404)
          .json({ success: false, message: "Student profile not found" });

      // Make sure the enrollment belongs to this student
      const enrollment = await query(
        "SELECT enrollment_id FROM enrollments WHERE enrollment_id = ? AND student_id = ?",
        [req.params.id, studentId],
      );
      if (enrollment.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Enrollment not found" });
      }

      await query(
        "UPDATE enrollments SET status = 'dropped' WHERE enrollment_id = ?",
        [req.params.id],
      );
      return res.json({
        success: true,
        message: "Course dropped successfully",
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

export default router;
