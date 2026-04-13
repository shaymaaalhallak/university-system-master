import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

const getStudentId = async (userId: number): Promise<number | null> => {
  const rows = await query("SELECT student_id FROM students WHERE user_id = ?", [userId]);
  return rows.length > 0 ? rows[0].student_id : null;
};

// GET /api/exemptions/my — Student views their own exemption requests
router.get("/my", verifyToken, requireRole("student"), async (req: Request, res: Response) => {
  try {
    const studentId = await getStudentId(req.user!.id);
    if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });

    const rows = await query(
      `SELECT ex.exemption_id, ex.exam_id, ex.reason, ex.status, ex.admin_note, ex.requested_at,
              e.exam_type, e.exam_date, e.max_marks,
              c.course_code, c.course_title
       FROM exam_exemptions ex
       JOIN exams e ON ex.exam_id = e.exam_id
       JOIN course_sections cs ON e.section_id = cs.section_id
       JOIN courses c ON cs.course_id = c.course_id
       WHERE ex.student_id = ?
       ORDER BY ex.requested_at DESC`,
      [studentId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/exemptions — Student submits an exemption request
router.post("/", verifyToken, requireRole("student"), async (req: Request, res: Response) => {
  try {
    const { examId, reason } = req.body;
    if (!examId || !reason) {
      return res.status(400).json({ success: false, message: "examId and reason are required" });
    }

    const studentId = await getStudentId(req.user!.id);
    if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });

    // Check exam date is in the future
    const exams = await query("SELECT exam_date FROM exams WHERE exam_id = ?", [examId]);
    if (exams.length === 0) return res.status(404).json({ success: false, message: "Exam not found" });

    const examDate = new Date(exams[0].exam_date);
    if (examDate <= new Date()) {
      return res.status(400).json({ success: false, message: "Cannot request exemption after exam date" });
    }

    // Check not already requested
    const existing = await query(
      "SELECT exemption_id FROM exam_exemptions WHERE student_id = ? AND exam_id = ?",
      [studentId, examId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "You already submitted an exemption request for this exam" });
    }

    const result: any = await query(
      "INSERT INTO exam_exemptions (student_id, exam_id, reason) VALUES (?, ?, ?)",
      [studentId, examId, reason]
    );

    return res.status(201).json({
      success: true,
      message: "Exemption request submitted successfully",
      data: { exemptionId: result.insertId },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/exemptions — Admin views all exemption requests
router.get("/", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT ex.exemption_id, ex.student_id, ex.exam_id, ex.reason, ex.status, ex.admin_note, ex.requested_at,
             u.first_name, u.last_name, u.email,
             e.exam_type, e.exam_date,
             c.course_code, c.course_title
      FROM exam_exemptions ex
      JOIN students s ON ex.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      JOIN exams e ON ex.exam_id = e.exam_id
      JOIN course_sections cs ON e.section_id = cs.section_id
      JOIN courses c ON cs.course_id = c.course_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) { sql += " AND ex.status = ?"; params.push(status); }
    sql += " ORDER BY ex.requested_at DESC";

    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /api/exemptions/:id — Admin approves or rejects
router.put("/:id", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { status, adminNote } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'approved' or 'rejected'" });
    }
    await query(
      "UPDATE exam_exemptions SET status = ?, admin_note = ? WHERE exemption_id = ?",
      [status, adminNote || null, req.params.id]
    );
    return res.json({ success: true, message: `Exemption ${status}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
