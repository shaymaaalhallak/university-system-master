import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

  const tableExists = async (tableName: string): Promise<boolean> => {
  const rows = await query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
};
const getProfessorId = async (userId: number): Promise<number | null> => {
  const rows = await query("SELECT professor_id FROM professors WHERE user_id = ?", [userId]);
  return rows.length > 0 ? rows[0].professor_id : null;
};

// GET /api/professor/my-sections — Professor's own sections
router.get("/my-sections", verifyToken, requireRole("professor"), async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT cs.section_id, cs.course_id, cs.semester, cs.year, cs.room_number, cs.schedule_time,
              c.course_code, c.course_title, c.credits,
              (SELECT COUNT(*) FROM enrollments e WHERE e.section_id = cs.section_id AND e.status = 'active') AS enrolled_count,
              COALESCE(gec.is_enabled, 0) AS grade_entry_enabled
       FROM course_sections cs
       JOIN professors p ON cs.professor_id = p.professor_id
       JOIN courses c ON cs.course_id = c.course_id
       LEFT JOIN grade_entry_control gec ON gec.section_id = cs.section_id
       WHERE p.user_id = ?
       ORDER BY cs.year DESC, cs.semester, c.course_code`,
      [req.user!.id]
    );

    const profileRows = await query(
      "SELECT professor_id FROM professors WHERE user_id = ?",
      [req.user!.id]
    );
    if (profileRows.length === 0) {
      return res.status(404).json({ success: false, message: "Professor profile not found" });
    }

    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/professor/sections/:sectionId/students — Students enrolled in a section
router.get("/sections/:sectionId/students", verifyToken, requireRole("professor", "admin"), async (req: Request, res: Response) => {
  try {
    // If professor, verify they teach this section
    if (req.user!.role === "professor") {
      const profId = await getProfessorId(req.user!.id);
      const owns = await query(
        "SELECT section_id FROM course_sections WHERE section_id = ? AND professor_id = ?",
        [req.params.sectionId, profId]
      );
      if (owns.length === 0) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

     const hasDepartmentsTable = await tableExists("departments");
    const hasProgramsTable = await tableExists("programs");

    const departmentSelect = hasDepartmentsTable
      ? ", d.department_name"
      : ", NULL AS department_name";
    const departmentJoin = hasDepartmentsTable
      ? "LEFT JOIN departments d ON s.department_id = d.department_id"
      : "";

    const programSelect = hasProgramsTable
      ? ", pr.program_name"
      : ", NULL AS program_name";
    const programJoin = hasProgramsTable
      ? "LEFT JOIN programs pr ON s.program_id = pr.program_id"
      : "";

    const rows = await query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email,
             s.student_id, s.semester as student_semester, s.gpa
              ${departmentSelect}
              ${programSelect},
              e.enrollment_id, e.enrolled_at, e.status AS enrollment_status,
              g.total_score, g.letter_grade,
              (SELECT SUM(a.status = 'Present') FROM attendance a WHERE a.student_id = s.student_id AND a.section_id = ?) AS present_count,
              (SELECT SUM(a.status = 'Absent') FROM attendance a WHERE a.student_id = s.student_id AND a.section_id = ?) AS absent_count
       FROM enrollments e
       JOIN students s ON e.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
        ${departmentJoin}
       ${programJoin}
       LEFT JOIN grades g ON g.student_id = e.student_id AND g.section_id = e.section_id
       WHERE e.section_id = ? AND e.status = 'active'
       ORDER BY u.last_name`,
      [req.params.sectionId, req.params.sectionId, req.params.sectionId]
    );
     return res.json({
      success: true,
      data: rows.map((row: any) => ({
        ...row,
        major: row.program_name || row.department_name || "Undeclared",
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/professor/cv — Get own CV (professor only)
router.get("/cv", verifyToken, requireRole("professor"), async (req: Request, res: Response) => {
  try {
    const rows = await query(
      "SELECT cv_url, title, hire_date FROM professors WHERE user_id = ?",
      [req.user!.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Profile not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /api/professor/cv — Professor uploads/updates their CV URL
// (In production, use multer for file upload; here we accept a URL)
router.put("/cv", verifyToken, requireRole("professor"), async (req: Request, res: Response) => {
  try {
    const { cvUrl } = req.body;
    if (!cvUrl) return res.status(400).json({ success: false, message: "cvUrl is required" });

    await query("UPDATE professors SET cv_url = ? WHERE user_id = ?", [cvUrl, req.user!.id]);
    return res.json({ success: true, message: "CV updated successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/professor/:professorId/cv — Admin views a professor's CV
router.get("/:professorId/cv", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT p.cv_url, p.title, p.hire_date, u.first_name, u.last_name, u.email
       FROM professors p JOIN users u ON p.user_id = u.user_id
       WHERE p.professor_id = ?`,
      [req.params.professorId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Professor not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
