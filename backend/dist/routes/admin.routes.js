"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const query = (sql, params = []) => new Promise((resolve, reject) => db_1.default.query(sql, params, (err, results) => (err ? reject(err) : resolve(results))));
// GET /api/admin/audit-logs — View all login/logout activity
router.get("/audit-logs", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { userId, action, from, to } = req.query;
        let sql = `
      SELECT al.log_id, al.user_id, al.action, al.ip_address, al.user_agent, al.created_at,
             u.first_name, u.last_name, u.email, u.role
      FROM audit_logs al
      JOIN users u ON al.user_id = u.user_id
      WHERE 1=1
    `;
        const params = [];
        if (userId) {
            sql += " AND al.user_id = ?";
            params.push(userId);
        }
        if (action) {
            sql += " AND al.action = ?";
            params.push(action);
        }
        if (from) {
            sql += " AND al.created_at >= ?";
            params.push(from);
        }
        if (to) {
            sql += " AND al.created_at <= ?";
            params.push(to);
        }
        sql += " ORDER BY al.created_at DESC LIMIT 200";
        const rows = await query(sql, params);
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/admin/grade-entry/:sectionId/enable — Enable grade entry for a section
router.post("/grade-entry/:sectionId/enable", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        await query(`INSERT INTO grade_entry_control (section_id, is_enabled, enabled_by)
       VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE is_enabled = 1, enabled_by = VALUES(enabled_by)`, [req.params.sectionId, req.user.id]);
        return res.json({ success: true, message: "Grade entry enabled for this section" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/admin/grade-entry/:sectionId/disable — Disable grade entry for a section
router.post("/grade-entry/:sectionId/disable", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        await query(`INSERT INTO grade_entry_control (section_id, is_enabled, enabled_by)
       VALUES (?, 0, ?)
       ON DUPLICATE KEY UPDATE is_enabled = 0, enabled_by = VALUES(enabled_by)`, [req.params.sectionId, req.user.id]);
        return res.json({ success: true, message: "Grade entry disabled for this section" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/admin/grade-entry — View all sections and their grade entry status
router.get("/grade-entry", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const rows = await query(`SELECT cs.section_id, c.course_code, c.course_title,
              cs.semester, cs.year,
              u.first_name AS prof_first, u.last_name AS prof_last,
              COALESCE(gec.is_enabled, 0) AS is_enabled,
              gec.updated_at
       FROM course_sections cs
       JOIN courses c ON cs.course_id = c.course_id
       JOIN professors p ON cs.professor_id = p.professor_id
       JOIN users u ON p.user_id = u.user_id
       LEFT JOIN grade_entry_control gec ON gec.section_id = cs.section_id
       ORDER BY cs.year DESC, cs.semester, c.course_code`);
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/admin/blocked-users — List all blocked users
router.get("/blocked-users", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const rows = await query(`SELECT user_id, first_name, last_name, email, role, status, block_reason, created_at
       FROM users WHERE status = 'blocked' ORDER BY first_name`);
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/admin/stats — Overview numbers for admin dashboard
router.get("/stats", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
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
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
