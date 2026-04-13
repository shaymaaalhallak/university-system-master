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
router.get("/", auth_1.verifyToken, async (req, res) => {
    try {
        const rows = await query(`SELECT d.department_id, d.department_name, d.description,
              (SELECT COUNT(*) FROM students s WHERE s.department_id = d.department_id) AS student_count,
              (SELECT COUNT(*) FROM professors p WHERE p.department_id = d.department_id) AS professor_count,
              (SELECT COUNT(*) FROM courses c WHERE c.department_id = d.department_id) AS course_count
       FROM departments d ORDER BY d.department_name`);
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
router.get("/:id", auth_1.verifyToken, async (req, res) => {
    try {
        const rows = await query("SELECT * FROM departments WHERE department_id = ?", [req.params.id]);
        if (rows.length === 0)
            return res.status(404).json({ success: false, message: "Department not found" });
        return res.json({ success: true, data: rows[0] });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
router.post("/", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { departmentName, description } = req.body;
        const result = await query("INSERT INTO departments (department_name, description) VALUES (?, ?)", [departmentName, description]);
        return res.status(201).json({ success: true, data: { departmentId: result.insertId } });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
router.put("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { departmentName, description } = req.body;
        await query("UPDATE departments SET department_name = ?, description = ? WHERE department_id = ?", [departmentName, description, req.params.id]);
        return res.json({ success: true, message: "Department updated" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
router.delete("/:id", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        await query("DELETE FROM departments WHERE department_id = ?", [req.params.id]);
        return res.json({ success: true, message: "Department deleted" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
