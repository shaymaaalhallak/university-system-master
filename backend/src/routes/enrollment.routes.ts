import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

// Helper: get student_id from user_id
const getStudentId = async (userId: number): Promise<number | null> => {
  const rows = await query("SELECT student_id FROM students WHERE user_id = ?", [userId]);
  return rows.length > 0 ? rows[0].student_id : null;
};

// GET /api/enrollments — Admin/Professor
router.get("/", verifyToken, requireRole("admin", "professor"), async (req: Request, res: Response) => {
  try {
    const { studentId, sectionId, status } = req.query;
    let sql = `
      SELECT e.enrollment_id, e.student_id, e.section_id, e.status, e.enrolled_at,
             u.first_name, u.last_name, u.email,
             c.course_code, c.course_title, c.credits,
             cs.semester, cs.year, cs.room_number, cs.schedule_time
      FROM enrollments e
      JOIN students s ON e.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      JOIN course_sections cs ON e.section_id = cs.section_id
      JOIN courses c ON cs.course_id = c.course_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (studentId) { sql += " AND e.student_id = ?"; params.push(studentId); }
    if (sectionId) { sql += " AND e.section_id = ?"; params.push(sectionId); }
    if (status) { sql += " AND e.status = ?"; params.push(status); }
    sql += " ORDER BY e.enrolled_at DESC";

    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/enrollments/my — Logged-in student's enrollments
router.get("/my", verifyToken, requireRole("student"), async (req: Request, res: Response) => {
  try {
    const studentId = await getStudentId(req.user!.id);
    if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });

    const rows = await query(
      `SELECT e.enrollment_id, e.section_id, e.status, e.enrolled_at,
              c.course_id, c.course_code, c.course_title, c.credits,
              cs.semester, cs.year, cs.room_number, cs.schedule_time,
              u.first_name AS prof_first, u.last_name AS prof_last,
              g.letter_grade, g.total_score
       FROM enrollments e
       JOIN course_sections cs ON e.section_id = cs.section_id
       JOIN courses c ON cs.course_id = c.course_id
       JOIN professors p ON cs.professor_id = p.professor_id
       JOIN users u ON p.user_id = u.user_id
       LEFT JOIN grades g ON g.student_id = e.student_id AND g.section_id = e.section_id
       WHERE e.student_id = ?
       ORDER BY cs.year DESC, cs.semester`,
      [studentId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/enrollments — Student registers for a section
router.post("/", verifyToken, requireRole("student"), async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.body;
    if (!sectionId) return res.status(400).json({ success: false, message: "sectionId is required" });

    const studentId = await getStudentId(req.user!.id);
    if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });

    // Get section details
    const sections = await query(
      `SELECT cs.section_id, cs.course_id, cs.semester, cs.year, c.credits
       FROM course_sections cs JOIN courses c ON cs.course_id = c.course_id
       WHERE cs.section_id = ?`,
      [sectionId]
    );
    if (sections.length === 0) return res.status(404).json({ success: false, message: "Section not found" });
    const section = sections[0];

    // Check already enrolled
    const existing = await query(
      "SELECT enrollment_id FROM enrollments WHERE student_id = ? AND section_id = ? AND status = 'active'",
      [studentId, sectionId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Already enrolled in this section" });
    }

    // Check prerequisites
    const prereqs = await query(
      "SELECT required_course_id FROM prerequisites WHERE course_id = ?",
      [section.course_id]
    );

    for (const prereq of prereqs) {
      const completed = await query(
        `SELECT g.grade_id FROM grades g
         JOIN course_sections cs ON g.section_id = cs.section_id
         WHERE g.student_id = ? AND cs.course_id = ? AND g.letter_grade NOT IN ('F', '')`,
        [studentId, prereq.required_course_id]
      );
      if (completed.length === 0) {
        const prereqCourse = await query(
          "SELECT course_code, course_title FROM courses WHERE course_id = ?",
          [prereq.required_course_id]
        );
        const name = prereqCourse.length > 0
          ? `${prereqCourse[0].course_code} - ${prereqCourse[0].course_title}`
          : "a required course";
        return res.status(400).json({
          success: false,
          message: `Prerequisite not met: You must complete ${name} first`,
        });
      }
    }

    // Check 19-credit maximum for current semester
    const creditCheck = await query(
      `SELECT COALESCE(SUM(c.credits), 0) AS total_credits
       FROM enrollments e
       JOIN course_sections cs ON e.section_id = cs.section_id
       JOIN courses c ON cs.course_id = c.course_id
       WHERE e.student_id = ? AND e.status = 'active' AND cs.semester = ? AND cs.year = ?`,
      [studentId, section.semester, section.year]
    );

    const currentCredits = Number(creditCheck[0].total_credits);
    if (currentCredits + section.credits > 19) {
      return res.status(400).json({
        success: false,
        message: `Cannot enroll: would exceed 19-credit maximum (currently at ${currentCredits} credits)`,
      });
    }

    // All checks passed — enroll
    const result: any = await query(
      "INSERT INTO enrollments (student_id, section_id, status) VALUES (?, ?, 'active')",
      [studentId, sectionId]
    );

    return res.status(201).json({
      success: true,
      message: "Successfully enrolled",
      data: { enrollmentId: result.insertId },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /api/enrollments/:id — Student drops a course
router.delete("/:id", verifyToken, requireRole("student"), async (req: Request, res: Response) => {
  try {
    const studentId = await getStudentId(req.user!.id);
    if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });

    // Make sure the enrollment belongs to this student
    const enrollment = await query(
      "SELECT enrollment_id FROM enrollments WHERE enrollment_id = ? AND student_id = ?",
      [req.params.id, studentId]
    );
    if (enrollment.length === 0) {
      return res.status(404).json({ success: false, message: "Enrollment not found" });
    }

    await query(
      "UPDATE enrollments SET status = 'dropped' WHERE enrollment_id = ?",
      [req.params.id]
    );
    return res.json({ success: true, message: "Course dropped successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
