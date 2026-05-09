"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const query = (sql, params = []) => new Promise((resolve, reject) => db_1.default.query(sql, params, (err, results) => err ? reject(err) : resolve(results)));
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token)
            return res
                .status(401)
                .json({ success: false, message: "No token provided" });
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "university_jwt_secret_key_2024");
        const users = await query("SELECT user_id, email, role, status, block_reason FROM users WHERE user_id = ?", [decoded.id]);
        if (users.length === 0)
            return res
                .status(401)
                .json({ success: false, message: "User not found" });
        const user = users[0];
        if (user.status === "blocked")
            return res.status(403).json({
                success: false,
                blocked: true,
                message: user.block_reason ||
                    "Your account is blocked. Contact the administrator.",
            });
        req.user = { id: user.user_id, email: user.email, role: user.role };
        next();
    }
    catch {
        return res
            .status(401)
            .json({ success: false, message: "Invalid or expired token" });
    }
};
exports.verifyToken = verifyToken;
const requireRole = (...roles) => (req, res, next) => {
    console.log("[AUTH] requireRole check: user.role=", req.user?.role, "required=", roles);
    if (!req.user)
        return res
            .status(401)
            .json({ success: false, message: "Not authenticated" });
    if (!roles.includes(req.user.role)) {
        console.log("[AUTH] Access denied: role", req.user.role, "not in", roles);
        return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
};
exports.requireRole = requireRole;
