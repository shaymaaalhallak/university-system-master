"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_validator_1 = require("express-validator");
const db_1 = __importDefault(require("../config/db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
function sendDatabaseAwareError(res, error, fallback) {
    const err = error;
    const code = err?.code || "";
    const message = err?.message || "";
    const databaseUnavailableCodes = new Set([
        "ECONNREFUSED",
        "PROTOCOL_CONNECTION_LOST",
        "ER_CON_COUNT_ERROR",
        "ETIMEDOUT",
    ]);
    if (databaseUnavailableCodes.has(code)) {
        return res.status(503).json({
            success: false,
            message: "Database is unavailable. Check backend DB settings and try again.",
            code,
        });
    }
    if (code === "ER_NO_SUCH_TABLE" || /doesn't exist/i.test(message)) {
        return res.status(503).json({
            success: false,
            message: "Database schema is incomplete. Run migrations and try again.",
            code: code || "ER_NO_SUCH_TABLE",
        });
    }
    return res.status(500).json({ success: false, message: fallback });
}
const query = (sql, params = []) => new Promise((resolve, reject) => db_1.default.query(sql, params, (err, results) => err ? reject(err) : resolve(results)));
// ------------------- REGISTER (Admin-only in production) -------------------
// This route is used by admin to create student/professor accounts
// Kept accessible for initial setup — protect with verifyToken + requireRole("admin") once first admin exists
router.post("/register", [
    (0, express_validator_1.body)("email").isEmail().withMessage("Please enter a valid email"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters"),
    (0, express_validator_1.body)("firstName").notEmpty().withMessage("First name is required"),
    (0, express_validator_1.body)("lastName").notEmpty().withMessage("Last name is required"),
    (0, express_validator_1.body)("role")
        .isIn(["student", "professor", "admin"])
        .withMessage("Invalid role"),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const { email, password, firstName, lastName, role, phone, departmentId, programId, } = req.body;
        const existingUsers = await query("SELECT user_id FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res
                .status(400)
                .json({ success: false, message: "Email already in use" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const insertResult = await query("INSERT INTO users (first_name, last_name, email, password, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, 'active')", [firstName, lastName, email, hashedPassword, phone || null, role]);
        const userId = insertResult.insertId;
        // Create role-specific profile
        if (role === "student") {
            await query("INSERT INTO students (user_id, department_id, program_id, enrollment_year, semester) VALUES (?, ?, ?, YEAR(CURDATE()), 1)", [userId, departmentId || null, programId || null]);
        }
        else if (role === "professor") {
            await query("INSERT INTO professors (user_id, department_id, hire_date) VALUES (?, ?, CURDATE())", [userId, departmentId || null]);
        }
        const token = jsonwebtoken_1.default.sign({ id: userId, email, role }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" });
        return res.status(201).json({
            success: true,
            data: {
                user: { id: userId, firstName, lastName, email, role },
                token,
            },
        });
    }
    catch (error) {
        console.error("Register error:", error);
        return sendDatabaseAwareError(res, error, "Server error");
    }
});
// ------------------- LOGIN -------------------
router.post("/login", [
    (0, express_validator_1.body)("email").isEmail().withMessage("Please enter a valid email"),
    (0, express_validator_1.body)("password").notEmpty().withMessage("Password is required"),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const { email, password } = req.body;
        const users = await query("SELECT user_id, first_name, last_name, email, password, role, status, IFNULL(block_reason, '') AS block_reason FROM users WHERE email = ?", [email]);
        if (users.length === 0) {
            return res
                .status(401)
                .json({ success: false, message: "Invalid credentials" });
        }
        const user = users[0];
        // Check if account is blocked BEFORE password check
        if (user.status === "blocked") {
            return res.status(403).json({
                success: false,
                blocked: true,
                message: user.block_reason ||
                    "Your account has been blocked. Please contact the administrator.",
            });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            return res
                .status(401)
                .json({ success: false, message: "Invalid credentials" });
        }
        // Log login to audit_logs
        const ipAddress = req.ip || req.headers["x-forwarded-for"] || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";
        await query("INSERT INTO audit_logs (user_id, action, ip_address, user_agent) VALUES (?, 'login', ?, ?)", [user.user_id, ipAddress, userAgent]).catch(() => { }); // Don't fail login if audit log fails
        const token = jsonwebtoken_1.default.sign({ id: user.user_id, email: user.email, role: user.role }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" });
        return res.json({
            success: true,
            data: {
                user: {
                    id: user.user_id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    email: user.email,
                    role: user.role,
                },
                token,
            },
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return sendDatabaseAwareError(res, error, "Server error");
    }
});
// ------------------- LOGOUT -------------------
router.post("/logout", auth_1.verifyToken, async (req, res) => {
    try {
        if (req.user) {
            const ipAddress = req.ip || req.headers["x-forwarded-for"] || "unknown";
            await query("INSERT INTO audit_logs (user_id, action, ip_address) VALUES (?, 'logout', ?)", [req.user.id, ipAddress]).catch(() => { });
        }
        return res.json({ success: true, message: "Logged out successfully" });
    }
    catch (error) {
        return res.json({ success: true, message: "Logged out successfully" });
    }
});
// ------------------- GET CURRENT USER -------------------
router.get("/me", auth_1.verifyToken, async (req, res) => {
    try {
        const users = await query("SELECT user_id, first_name, last_name, email, role, phone, status, created_at FROM users WHERE user_id = ?", [req.user.id]);
        if (users.length === 0) {
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
        }
        const user = users[0];
        return res.json({
            success: true,
            data: {
                id: user.user_id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                status: user.status,
                createdAt: user.created_at,
            },
        });
    }
    catch (error) {
        console.error("Get me error:", error);
        return sendDatabaseAwareError(res, error, "Server error");
    }
});
exports.default = router;
