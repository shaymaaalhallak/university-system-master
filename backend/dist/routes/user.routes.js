"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const query = (sql, params = []) => new Promise((resolve, reject) => db_1.default.query(sql, params, (err, results) => (err ? reject(err) : resolve(results))));
// GET /api/users/students — Admin/Professor only
router.get("/students", auth_1.verifyToken, (0, auth_1.requireRole)("admin", "professor"), async (req, res) => {
    try {
        const { search, departmentId } = req.query;
        let sql = `
      SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.status, u.created_at,
             s.student_id, s.department_id, s.program_id, s.enrollment_year, s.semester, s.gpa,
             d.department_name
      FROM users u
      JOIN students s ON u.user_id = s.user_id
      LEFT JOIN departments d ON s.department_id = d.department_id
      WHERE u.role = 'student'
    `;
        const params = [];
        if (search) {
            sql += " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)";
            const like = `%${search}%`;
            params.push(like, like, like);
        }
        if (departmentId) {
            sql += " AND s.department_id = ?";
            params.push(departmentId);
        }
        sql += " ORDER BY u.first_name ASC";
        const students = await query(sql, params);
        return res.json({ success: true, data: students });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/users/professors — Admin only
router.get("/professors", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { search } = req.query;
        let sql = `
      SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.status, u.created_at,
             p.professor_id, p.department_id, p.title, p.hire_date, p.cv_url,
             d.department_name
      FROM users u
      JOIN professors p ON u.user_id = p.user_id
      LEFT JOIN departments d ON p.department_id = d.department_id
      WHERE u.role = 'professor'
    `;
        const params = [];
        if (search) {
            sql += " AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)";
            const like = `%${search}%`;
            params.push(like, like, like);
        }
        sql += " ORDER BY u.first_name ASC";
        const professors = await query(sql, params);
        return res.json({ success: true, data: professors });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/users/:id — Admin only
router.get("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const users = await query(`SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.role, u.status, u.block_reason, u.created_at
       FROM users u WHERE u.user_id = ?`, [req.params.id]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        return res.json({ success: true, data: users[0] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// PUT /api/users/:id — Admin: update user info
router.put("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { firstName, lastName, phone, departmentId, semester } = req.body;
        await query("UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE user_id = ?", [firstName, lastName, phone, req.params.id]);
        return res.json({ success: true, message: "User updated" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/:id/block — Admin: block a user with reason
router.post("/:id/block", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ success: false, message: "Block reason is required" });
        }
        await query("UPDATE users SET status = 'blocked', block_reason = ? WHERE user_id = ?", [reason, req.params.id]);
        return res.json({ success: true, message: "User blocked successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/:id/unblock — Admin: unblock a user
router.post("/:id/unblock", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        await query("UPDATE users SET status = 'active', block_reason = NULL WHERE user_id = ?", [req.params.id]);
        return res.json({ success: true, message: "User unblocked successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// DELETE /api/users/:id — Admin only
router.delete("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        await query("DELETE FROM users WHERE user_id = ?", [req.params.id]);
        return res.json({ success: true, message: "User deleted" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/users/:id/reset-password — Admin resets a user's password
router.post("/:id/reset-password", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
        }
        const hashed = await bcryptjs_1.default.hash(newPassword, 10);
        await query("UPDATE users SET password = ? WHERE user_id = ?", [hashed, req.params.id]);
        return res.json({ success: true, message: "Password reset successfully" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
