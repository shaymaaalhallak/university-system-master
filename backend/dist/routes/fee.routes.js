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
const getStudentId = async (userId) => {
    const rows = await query("SELECT student_id FROM students WHERE user_id = ?", [userId]);
    return rows.length > 0 ? rows[0].student_id : null;
};
// GET /api/fees/structure — Fee structure (public to authenticated users)
router.get("/structure", auth_1.verifyToken, async (req, res) => {
    return res.json({
        success: true,
        data: {
            tuition: {
                perSemester: 5000,
                description: "Core tuition fee per semester",
                installments: [
                    { name: "First installment (at registration)", percentage: 50, amount: 2500 },
                    { name: "Second installment (week 4)", percentage: 30, amount: 1500 },
                    { name: "Third installment (week 8)", percentage: 20, amount: 1000 },
                ],
                paymentMethods: ["Bank transfer", "Credit/Debit card", "University portal"],
            },
            otherFees: [
                { type: "library", amount: 150, description: "Library access fee per semester" },
                { type: "lab", amount: 200, description: "Lab fee (if enrolled in lab courses)" },
                { type: "activities", amount: 100, description: "Student activities fee per semester" },
            ],
        },
    });
});
// GET /api/fees/my — Student views own fees/payments
router.get("/my", auth_1.verifyToken, (0, auth_1.requireRole)("student"), async (req, res) => {
    try {
        const studentId = await getStudentId(req.user.id);
        if (!studentId)
            return res.status(404).json({ success: false, message: "Student profile not found" });
        const payments = await query(`SELECT payment_id, amount, payment_type, payment_method, payment_date, status
       FROM payments WHERE student_id = ? ORDER BY payment_date DESC`, [studentId]);
        const totalPaid = payments
            .filter((p) => p.status === "completed")
            .reduce((sum, p) => sum + Number(p.amount), 0);
        const totalPending = payments
            .filter((p) => p.status === "pending")
            .reduce((sum, p) => sum + Number(p.amount), 0);
        return res.json({
            success: true,
            data: { payments, totalPaid, totalPending },
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// GET /api/fees — Admin views all payments
router.get("/", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { studentId, status } = req.query;
        let sql = `
      SELECT p.payment_id, p.student_id, p.amount, p.payment_type, p.payment_method, p.payment_date, p.status,
             u.first_name, u.last_name, u.email
      FROM payments p
      JOIN students s ON p.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      WHERE 1=1
    `;
        const params = [];
        if (studentId) {
            sql += " AND p.student_id = ?";
            params.push(studentId);
        }
        if (status) {
            sql += " AND p.status = ?";
            params.push(status);
        }
        sql += " ORDER BY p.payment_date DESC";
        const rows = await query(sql, params);
        return res.json({ success: true, data: rows });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/fees — Admin records a payment for a student
router.post("/", auth_1.verifyToken, (0, auth_1.requireRole)("admin"), async (req, res) => {
    try {
        const { studentId, amount, paymentType, paymentMethod, paymentDate } = req.body;
        const result = await query("INSERT INTO payments (student_id, amount, payment_type, payment_method, payment_date, status) VALUES (?, ?, ?, ?, ?, 'completed')", [studentId, amount, paymentType, paymentMethod, paymentDate || new Date()]);
        return res.status(201).json({ success: true, data: { paymentId: result.insertId } });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
// POST /api/fees/:id/pay — Student or admin marks a pending payment as paid
router.post("/:id/pay", auth_1.verifyToken, async (req, res) => {
    try {
        const { paymentMethod } = req.body;
        await query("UPDATE payments SET status = 'completed', payment_method = ?, payment_date = CURDATE() WHERE payment_id = ?", [paymentMethod || "online", req.params.id]);
        return res.json({ success: true, message: "Payment recorded" });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.default = router;
