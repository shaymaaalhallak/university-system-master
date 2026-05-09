import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

// GET /api/admin/audit-logs — View all login/logout activity
router.get("/audit-logs", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { userId, action, from, to } = req.query;
    let sql = `
      SELECT al.log_id, al.user_id, al.action, al.ip_address, al.user_agent, al.created_at,
             u.first_name, u.last_name, u.email, u.role
      FROM audit_logs al
      JOIN users u ON al.user_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (userId) { sql += " AND al.user_id = ?"; params.push(userId); }
    if (action) { sql += " AND al.action = ?"; params.push(action); }
    if (from) { sql += " AND al.created_at >= ?"; params.push(from); }
    if (to) { sql += " AND al.created_at <= ?"; params.push(to); }
    sql += " ORDER BY al.created_at DESC LIMIT 200";

    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/admin/grade-entry/:sectionId/enable — Enable grade entry for a section
router.post("/grade-entry/:sectionId/enable", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    await query(
      `INSERT INTO grade_entry_control (section_id, is_enabled, enabled_by)
       VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE is_enabled = 1, enabled_by = VALUES(enabled_by)`,
      [req.params.sectionId, req.user!.id]
    );
    return res.json({ success: true, message: "Grade entry enabled for this section" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/admin/grade-entry/:sectionId/disable — Disable grade entry for a section
router.post("/grade-entry/:sectionId/disable", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    await query(
      `INSERT INTO grade_entry_control (section_id, is_enabled, enabled_by)
       VALUES (?, 0, ?)
       ON DUPLICATE KEY UPDATE is_enabled = 0, enabled_by = VALUES(enabled_by)`,
      [req.params.sectionId, req.user!.id]
    );
    return res.json({ success: true, message: "Grade entry disabled for this section" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/admin/grade-entry — View all sections and their grade entry status
router.get("/grade-entry", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { programId } = req.query;
    let sql = `
      SELECT cs.section_id, c.course_code, c.course_title,
             cs.semester, cs.year,
             u.first_name AS prof_first, u.last_name AS prof_last,
             pr.program_name,
             COALESCE(gec.is_enabled, 0) AS is_enabled,
             gec.entry_mode,
             gec.close_at,
             gec.updated_at
      FROM course_sections cs
      JOIN courses c ON cs.course_id = c.course_id
      JOIN professors p ON cs.professor_id = p.professor_id
      JOIN users u ON p.user_id = u.user_id
      LEFT JOIN programs pr ON c.program_id = pr.program_id
      LEFT JOIN grade_entry_control gec ON gec.section_id = cs.section_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (programId) {
      sql += " AND c.program_id = ?";
      params.push(Number(programId));
    }
    sql += " ORDER BY cs.year DESC, cs.semester, c.course_code";
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/admin/grade-entry/:sectionId/mode — Set entry mode for a section
router.post("/grade-entry/:sectionId/mode", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { entry_mode } = req.body;
    if (entry_mode !== "exam" && entry_mode !== "assignment") {
      return res.status(400).json({ success: false, message: "entry_mode must be 'exam' or 'assignment'" });
    }
    await query(
      "UPDATE grade_entry_control SET entry_mode = ? WHERE section_id = ?",
      [entry_mode, req.params.sectionId],
    );
    return res.json({ success: true, message: `Entry mode set to ${entry_mode}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/admin/grade-entry/bulk — Bulk enable/disable grade entry
router.post("/grade-entry/bulk", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { sectionIds, action, entry_mode, close_at } = req.body;
    if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
      return res.status(400).json({ success: false, message: "sectionIds must be a non-empty array" });
    }
    if (action !== "enable" && action !== "disable") {
      return res.status(400).json({ success: false, message: "action must be 'enable' or 'disable'" });
    }
    if (action === "enable") {
      if (entry_mode && entry_mode !== "exam" && entry_mode !== "assignment") {
        return res.status(400).json({ success: false, message: "entry_mode must be 'exam' or 'assignment'" });
      }
      for (const sectionId of sectionIds) {
        await query(
          `INSERT INTO grade_entry_control (section_id, is_enabled, enabled_by, entry_mode, close_at)
           VALUES (?, 1, ?, ?, ?)
           ON DUPLICATE KEY UPDATE is_enabled = 1, enabled_by = VALUES(enabled_by), entry_mode = VALUES(entry_mode), close_at = VALUES(close_at)`,
          [sectionId, req.user!.id, entry_mode || null, close_at || null],
        );
      }
    } else {
      for (const sectionId of sectionIds) {
        await query(
          `INSERT INTO grade_entry_control (section_id, is_enabled, enabled_by)
           VALUES (?, 0, ?)
           ON DUPLICATE KEY UPDATE is_enabled = 0, enabled_by = VALUES(enabled_by)`,
          [sectionId, req.user!.id],
        );
      }
    }
    return res.json({ success: true, message: `${action}d ${sectionIds.length} section(s)` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/admin/blocked-users — List all blocked users
router.get("/blocked-users", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT user_id, first_name, last_name, email, role, status, block_reason, created_at
       FROM users WHERE status = 'blocked' ORDER BY first_name`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/admin/stats — Overview numbers for admin dashboard
router.get("/stats", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const [students, professors, courses, enrollments, blocked] = await Promise.all([
      query("SELECT COUNT(*) AS count FROM users WHERE role = 'student' AND status = 'active'"),
      query("SELECT COUNT(*) AS count FROM users WHERE role = 'professor' AND status = 'active'"),
      query("SELECT COUNT(*) AS count FROM courses"),
      query("SELECT COUNT(*) AS count FROM enrollments WHERE status = 'active'"),
      query("SELECT COUNT(*) AS count FROM users WHERE status = 'blocked'"),
    ]);

    return res.json({
      success: true,
      data: {
        totalStudents: students[0].count,
        totalProfessors: professors[0].count,
        totalCourses: courses[0].count,
        activeEnrollments: enrollments[0].count,
        blockedUsers: blocked[0].count,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
