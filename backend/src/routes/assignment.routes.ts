import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";
import fs from "fs";
import path from "path";
import multer from "multer";

const router = Router();

const assignmentUploadDir = path.join(process.cwd(), "uploads", "assignments");
fs.mkdirSync(assignmentUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, assignmentUploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

const getStudentId = async (userId: number): Promise<number | null> => {
  const rows = await query("SELECT student_id FROM students WHERE user_id = ?", [userId]);
  return rows.length > 0 ? rows[0].student_id : null;
};

const getProfessorId = async (userId: number): Promise<number | null> => {
  const rows = await query("SELECT professor_id FROM professors WHERE user_id = ?", [userId]);
  return rows.length > 0 ? rows[0].professor_id : null;
};

const professorOwnsSection = async (userId: number, sectionId: number | string): Promise<boolean> => {
  const professorId = await getProfessorId(userId);
  if (!professorId) {
    return false;
  }

  const rows = await query(
    "SELECT section_id FROM course_sections WHERE section_id = ? AND professor_id = ?",
    [sectionId, professorId]
  );

  return rows.length > 0;
};

const toPublicUploadPath = (filename: string) => `/uploads/assignments/${filename}`;

const deleteStoredFile = (storedPath?: string | null) => {
  if (!storedPath) {
    return;
  }

  const normalized = storedPath.replace(/^\/+/, "");
  const absolutePath = path.join(process.cwd(), normalized);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

// GET /api/assignments — filtered list
router.get("/", verifyToken, async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.query;
    let sql = `
      SELECT a.assignment_id AS id, a.section_id, a.title, a.description, a.attachment_url, a.due_date, a.max_score,
             c.course_code, c.course_title
      FROM assignments a
      JOIN course_sections cs ON a.section_id = cs.section_id
      JOIN courses c ON cs.course_id = c.course_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (sectionId) { sql += " AND a.section_id = ?"; params.push(sectionId); }

    if (req.user!.role === "student") {
      const studentId = await getStudentId(req.user!.id);
      if (!studentId) {
        return res.status(404).json({ success: false, message: "Student profile not found" });
      }
      sql += " AND EXISTS (SELECT 1 FROM enrollments e WHERE e.section_id = a.section_id AND e.student_id = ? AND e.status = 'active')";
      params.push(studentId);
    }

    if (req.user!.role === "professor") {
      const professorId = await getProfessorId(req.user!.id);
      if (!professorId) {
        return res.status(404).json({ success: false, message: "Professor profile not found" });
      }
      sql += " AND cs.professor_id = ?";
      params.push(professorId);
    }

    sql += " ORDER BY a.due_date ASC";

    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/assignments/my — student's assignments
router.get("/my", verifyToken, requireRole("student"), async (req: Request, res: Response) => {
  try {
    const studentId = await getStudentId(req.user!.id);
    if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });

    const rows = await query(
      `SELECT a.assignment_id AS id, a.section_id, a.title, a.description, a.attachment_url, a.due_date, a.max_score,
              c.course_code, c.course_title,
              sub.submission_id, sub.score, sub.submission_date, sub.file_url, sub.feedback
       FROM assignments a
       JOIN course_sections cs ON a.section_id = cs.section_id
       JOIN courses c ON cs.course_id = c.course_id
       JOIN enrollments e ON e.section_id = a.section_id AND e.student_id = ? AND e.status = 'active'
       LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.assignment_id AND sub.student_id = ?
       ORDER BY a.due_date ASC`,
      [studentId, studentId]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/assignments/section/:sectionId/submissions — professor tracking
router.get("/section/:sectionId/submissions", verifyToken, requireRole("professor", "admin"), async (req: Request, res: Response) => {
  try {
    const { sectionId } = req.params;

    if (req.user!.role === "professor") {
      const ownsSection = await professorOwnsSection(req.user!.id, sectionId);
      if (!ownsSection) {
        return res.status(403).json({ success: false, message: "You do not teach this section" });
      }
    }

    const assignments = await query(
      `SELECT a.assignment_id AS id, a.title, a.description, a.attachment_url, a.due_date, a.max_score,
              c.course_code, c.course_title
       FROM assignments a
       JOIN course_sections cs ON a.section_id = cs.section_id
       JOIN courses c ON cs.course_id = c.course_id
       WHERE a.section_id = ?
       ORDER BY a.due_date ASC`,
      [sectionId]
    );

    const students = await query(
      `SELECT s.student_id, u.first_name, u.last_name, u.email
       FROM enrollments e
       JOIN students s ON e.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE e.section_id = ? AND e.status = 'active'
       ORDER BY u.last_name, u.first_name`,
      [sectionId]
    );

    const submissions = await query(
      `SELECT sub.submission_id, sub.assignment_id, sub.student_id, sub.submission_date, sub.file_url, sub.score, sub.feedback
       FROM assignment_submissions sub
       JOIN assignments a ON sub.assignment_id = a.assignment_id
       WHERE a.section_id = ?`,
      [sectionId]
    );

    const submissionsByAssignment = new Map<number, any[]>();
    submissions.forEach((submission: any) => {
      const key = Number(submission.assignment_id);
      const current = submissionsByAssignment.get(key) ?? [];
      current.push(submission);
      submissionsByAssignment.set(key, current);
    });

    return res.json({
      success: true,
      data: assignments.map((assignment: any) => {
        const assignmentSubmissions = submissionsByAssignment.get(Number(assignment.id)) ?? [];
        return {
          ...assignment,
          students: students.map((student: any) => {
            const submission = assignmentSubmissions.find(
              (item: any) => Number(item.student_id) === Number(student.student_id)
            );
            return {
              ...student,
              submitted: !!submission,
              submissionId: submission?.submission_id ?? null,
              submissionDate: submission?.submission_date ?? null,
              fileUrl: submission?.file_url ?? null,
              score: submission?.score ?? null,
              feedback: submission?.feedback ?? null,
            };
          }),
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/assignments/:id
router.get("/:id", verifyToken, async (req: Request, res: Response) => {
  try {
    let sql = `
      SELECT a.*, c.course_code, c.course_title
      FROM assignments a
      JOIN course_sections cs ON a.section_id = cs.section_id
      JOIN courses c ON cs.course_id = c.course_id
      WHERE a.assignment_id = ?
    `;
    const params: any[] = [req.params.id];

    if (req.user!.role === "student") {
      const studentId = await getStudentId(req.user!.id);
      if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });
      sql += " AND EXISTS (SELECT 1 FROM enrollments e WHERE e.section_id = a.section_id AND e.student_id = ? AND e.status = 'active')";
      params.push(studentId);
    }

    if (req.user!.role === "professor") {
      const professorId = await getProfessorId(req.user!.id);
      if (!professorId) return res.status(404).json({ success: false, message: "Professor profile not found" });
      sql += " AND cs.professor_id = ?";
      params.push(professorId);
    }

    const rows = await query(sql, params);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Assignment not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/assignments — professor creates assignment
router.post("/", verifyToken, requireRole("professor", "admin"), upload.single("attachment"), async (req: Request, res: Response) => {
  try {
    const { sectionId, title, description, dueDate, maxScore } = req.body;

    if (req.user!.role === "professor") {
      const ownsSection = await professorOwnsSection(req.user!.id, sectionId);
      if (!ownsSection) {
        return res.status(403).json({ success: false, message: "You do not teach this section" });
      }
    }

    const result: any = await query(
      "INSERT INTO assignments (section_id, title, description, attachment_url, due_date, max_score) VALUES (?, ?, ?, ?, ?, ?)",
      [sectionId, title, description, req.file ? toPublicUploadPath(req.file.filename) : null, dueDate, maxScore || 100]
    );
    return res.status(201).json({ success: true, data: { assignmentId: result.insertId } });
  } catch (error) {
    if (req.file) {
      deleteStoredFile(toPublicUploadPath(req.file.filename));
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /api/assignments/:id
router.put("/:id", verifyToken, requireRole("professor", "admin"), upload.single("attachment"), async (req: Request, res: Response) => {
  try {
    const { title, description, dueDate, maxScore } = req.body;
    let existingAttachmentUrl: string | null = null;

    if (req.user!.role === "professor") {
      const assignmentRows = await query("SELECT section_id, attachment_url FROM assignments WHERE assignment_id = ?", [req.params.id]);
      if (assignmentRows.length === 0) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      existingAttachmentUrl = assignmentRows[0].attachment_url ?? null;

      const ownsSection = await professorOwnsSection(req.user!.id, assignmentRows[0].section_id);
      if (!ownsSection) {
        return res.status(403).json({ success: false, message: "You do not teach this section" });
      }
    } else {
      const assignmentRows = await query("SELECT attachment_url FROM assignments WHERE assignment_id = ?", [req.params.id]);
      if (assignmentRows.length === 0) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }
      existingAttachmentUrl = assignmentRows[0].attachment_url ?? null;
    }

    const nextAttachmentUrl =
      req.body.removeAttachment === "true"
        ? null
        : req.file
        ? toPublicUploadPath(req.file.filename)
        : existingAttachmentUrl;

    await query(
      "UPDATE assignments SET title=?, description=?, attachment_url=?, due_date=?, max_score=? WHERE assignment_id=?",
      [title, description, nextAttachmentUrl, dueDate, maxScore, req.params.id]
    );

    if ((req.file || req.body.removeAttachment === "true") && existingAttachmentUrl && existingAttachmentUrl !== nextAttachmentUrl) {
      deleteStoredFile(existingAttachmentUrl);
    }
    return res.json({ success: true, message: "Assignment updated" });
  } catch (error) {
    if (req.file) {
      deleteStoredFile(toPublicUploadPath(req.file.filename));
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /api/assignments/:id
router.delete("/:id", verifyToken, requireRole("professor", "admin"), async (req: Request, res: Response) => {
  try {
    if (req.user!.role === "professor") {
      const assignmentRows = await query("SELECT section_id, attachment_url FROM assignments WHERE assignment_id = ?", [req.params.id]);
      if (assignmentRows.length === 0) {
        return res.status(404).json({ success: false, message: "Assignment not found" });
      }

      const ownsSection = await professorOwnsSection(req.user!.id, assignmentRows[0].section_id);
      if (!ownsSection) {
        return res.status(403).json({ success: false, message: "You do not teach this section" });
      }

      deleteStoredFile(assignmentRows[0].attachment_url ?? null);
    } else {
      const assignmentRows = await query("SELECT attachment_url FROM assignments WHERE assignment_id = ?", [req.params.id]);
      if (assignmentRows.length > 0) {
        deleteStoredFile(assignmentRows[0].attachment_url ?? null);
      }
    }

    await query("DELETE FROM assignments WHERE assignment_id = ?", [req.params.id]);
    return res.json({ success: true, message: "Assignment deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/assignments/:id/submit — student submits
router.post("/:id/submit", verifyToken, requireRole("student"), async (req: Request, res: Response) => {
  try {
    const studentId = await getStudentId(req.user!.id);
    if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });

    const { fileUrl } = req.body;
    const assignmentRows = await query(
      `SELECT a.assignment_id, a.section_id, a.due_date
       FROM assignments a
       JOIN enrollments e ON e.section_id = a.section_id AND e.student_id = ? AND e.status = 'active'
       WHERE a.assignment_id = ?`,
      [studentId, req.params.id]
    );

    if (assignmentRows.length === 0) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    const dueDate = new Date(assignmentRows[0].due_date);
    const now = new Date();
    if (now > dueDate) {
      return res.status(400).json({ success: false, message: "Deadline has passed for this assignment" });
    }

    const result: any = await query(
      `INSERT INTO assignment_submissions (assignment_id, student_id, submission_date, file_url)
       VALUES (?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE submission_date = NOW(), file_url = VALUES(file_url)`,
      [req.params.id, studentId, fileUrl || null]
    );
    return res.json({ success: true, message: "Assignment submitted", data: { submissionId: result.insertId } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/assignments/submissions/:id/grade — professor grades
router.post("/submissions/:id/grade", verifyToken, requireRole("professor", "admin"), async (req: Request, res: Response) => {
  try {
    const { score, feedback } = req.body;

    if (req.user!.role === "professor") {
      const submissionRows = await query(
        `SELECT a.section_id
         FROM assignment_submissions sub
         JOIN assignments a ON sub.assignment_id = a.assignment_id
         WHERE sub.submission_id = ?`,
        [req.params.id]
      );

      if (submissionRows.length === 0) {
        return res.status(404).json({ success: false, message: "Submission not found" });
      }

      const ownsSection = await professorOwnsSection(req.user!.id, submissionRows[0].section_id);
      if (!ownsSection) {
        return res.status(403).json({ success: false, message: "You do not teach this section" });
      }
    }

    await query(
      "UPDATE assignment_submissions SET score = ?, feedback = ? WHERE submission_id = ?",
      [score, feedback, req.params.id]
    );
    return res.json({ success: true, message: "Submission graded" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
