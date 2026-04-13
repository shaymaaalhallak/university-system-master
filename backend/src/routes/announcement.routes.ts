import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

// GET /api/announcements — All authenticated users (filtered by role)
router.get("/", verifyToken, async (req: Request, res: Response) => {
  try {
    const { priority } = req.query;
    const role = req.user!.role;

    let sql = `
      SELECT a.announcement_id AS id, a.title, a.content, a.target_roles,
             a.priority, a.created_at, a.expires_at,
             u.first_name, u.last_name
      FROM announcements a
      JOIN users u ON a.author_id = u.user_id
      WHERE (a.expires_at IS NULL OR a.expires_at >= CURDATE())
        AND (a.target_roles LIKE ? OR a.target_roles LIKE '%all%')
    `;
    const params: any[] = [`%${role}%`];

    if (priority) { sql += " AND a.priority = ?"; params.push(priority); }
    sql += " ORDER BY a.created_at DESC LIMIT 50";

    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/announcements/:id
router.get("/:id", verifyToken, async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT a.*, u.first_name, u.last_name FROM announcements a
       JOIN users u ON a.author_id = u.user_id WHERE a.announcement_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Announcement not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/announcements — Admin only
router.post("/", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { title, content, targetRoles, priority, expiresAt } = req.body;
    const result: any = await query(
      "INSERT INTO announcements (title, content, author_id, target_roles, priority, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      [title, content, req.user!.id, targetRoles || "student,professor,admin", priority || "medium", expiresAt || null]
    );
    return res.status(201).json({ success: true, data: { announcementId: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /api/announcements/:id — Admin only
router.put("/:id", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { title, content, targetRoles, priority, expiresAt } = req.body;
    await query(
      "UPDATE announcements SET title=?, content=?, target_roles=?, priority=?, expires_at=? WHERE announcement_id=?",
      [title, content, targetRoles, priority, expiresAt || null, req.params.id]
    );
    return res.json({ success: true, message: "Announcement updated" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /api/announcements/:id — Admin only
router.delete("/:id", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    await query("DELETE FROM announcements WHERE announcement_id = ?", [req.params.id]);
    return res.json({ success: true, message: "Announcement deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
