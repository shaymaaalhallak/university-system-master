"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// AUTO-MIGRATING VERSION — creates missing DB tables/columns on startup
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
// ── Routes ────────────────────────────────────────────────────────────────────
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const course_routes_1 = __importDefault(require("./routes/course.routes"));
const enrollment_routes_1 = __importDefault(require("./routes/enrollment.routes"));
const grade_routes_1 = __importDefault(require("./routes/grade.routes"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const assignment_routes_1 = __importDefault(require("./routes/assignment.routes"));
const department_routes_1 = __importDefault(require("./routes/department.routes"));
const fee_routes_1 = __importDefault(require("./routes/fee.routes"));
const announcement_routes_1 = __importDefault(require("./routes/announcement.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const professor_routes_1 = __importDefault(require("./routes/professor.routes"));
const schedule_routes_1 = __importDefault(require("./routes/schedule.routes"));
const exemption_routes_1 = __importDefault(require("./routes/exemption.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
// db.ts calls dotenv.config() internally — env vars loaded before anything else
const db_1 = __importDefault(require("./config/db"));
const migrate_1 = require("./config/migrate");
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 5000;
// ── CORS: accept all origins (frontend proxy or direct browser) ───────────────
app.use((0, cors_1.default)({
    origin: true, // allow every origin
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options("*", (0, cors_1.default)()); // pre-flight for all routes
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use("/uploads", express_1.default.static(path_1.default.join(process.cwd(), "uploads")));
// ── Rate limit ────────────────────────────────────────────────────────────────
app.set("trust proxy", 1);
const limiter = (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);
// ── DB health check ───────────────────────────────────────────────────────────
db_1.default.query("SELECT 1", (err) => {
    if (err)
        console.error("❌ DB connection failed:", err.message);
    else
        console.log("✅ Connected to MySQL database");
});
// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", auth_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/courses", course_routes_1.default);
app.use("/api/enrollments", enrollment_routes_1.default);
app.use("/api/grades", grade_routes_1.default);
app.use("/api/attendance", attendance_routes_1.default);
app.use("/api/assignments", assignment_routes_1.default);
app.use("/api/departments", department_routes_1.default);
app.use("/api/fees", fee_routes_1.default);
app.use("/api/announcements", announcement_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
app.use("/api/professor", professor_routes_1.default);
app.use("/api/schedule", schedule_routes_1.default);
app.use("/api/exemptions", exemption_routes_1.default);
app.use("/api/dashboard", dashboard_routes_1.default);
app.get("/api/health", (_req, res) => res.json({ status: "ok", port: PORT, time: new Date().toISOString() }));
// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found" }));
// ── Global error handler — logs the FULL error so you always see what broke ──
app.use((err, req, res, _next) => {
    console.error(`\n❌ ERROR on ${req.method} ${req.path}`);
    console.error("   Message:", err.message);
    res.status(500).json({
        success: false,
        message: "Internal server error",
        error: err.message, // always visible in dev
    });
});
// ── Start with DB check + auto-migrations ─────────────────────────────────────
async function start() {
    // 1. Verify DB is reachable
    await new Promise((resolve) => {
        db_1.default.query("SELECT 1", (err) => {
            if (err) {
                console.error("❌ Cannot connect to MySQL:", err.message);
                console.error("   → Check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in .env");
            }
            else {
                console.log("✅ Connected to MySQL database");
            }
            resolve();
        });
    });
    // 2. Auto-create any missing tables / columns
    await (0, migrate_1.runMigrations)();
    // 3. Start listening
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n🚀 Server running  →  http://localhost:${PORT}`);
        console.log(`🔗 Health check    →  http://localhost:${PORT}/api/health\n`);
    });
}
start().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
exports.default = app;
