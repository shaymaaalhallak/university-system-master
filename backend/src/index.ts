// AUTO-MIGRATING VERSION — creates missing DB tables/columns on startup
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";

// ── Routes ────────────────────────────────────────────────────────────────────
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import courseRoutes from "./routes/course.routes";
import enrollmentRoutes from "./routes/enrollment.routes";
import gradeRoutes from "./routes/grade.routes";
import attendanceRoutes from "./routes/attendance.routes";
import assignmentRoutes from "./routes/assignment.routes";
import departmentRoutes from "./routes/department.routes";
import feeRoutes from "./routes/fee.routes";
import announcementRoutes from "./routes/announcement.routes";
import adminRoutes from "./routes/admin.routes";
import professorRoutes from "./routes/professor.routes";
import scheduleRoutes from "./routes/schedule.routes";
import exemptionRoutes from "./routes/exemption.routes";
import dashboardRoutes from "./routes/dashboard.routes";

// db.ts calls dotenv.config() internally — env vars loaded before anything else
import db from "./config/db";
import { runMigrations } from "./config/migrate";

const app: Application = express();
const PORT = Number(process.env.PORT) || 5000;

// ── CORS: accept all origins (frontend proxy or direct browser) ───────────────
app.use(
  cors({
    origin: true, // allow every origin
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.options("*", cors()); // pre-flight for all routes

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ── Rate limit ────────────────────────────────────────────────────────────────
app.set("trust proxy", 1);
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

// ── DB health check ───────────────────────────────────────────────────────────
db.query("SELECT 1", (err: any) => {
  if (err) console.error("❌ DB connection failed:", err.message);
  else console.log("✅ Connected to MySQL database");
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/professor", professorRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/exemptions", exemptionRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/api/health", (_req: Request, res: Response) =>
  res.json({ status: "ok", port: PORT, time: new Date().toISOString() }),
);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) =>
  res.status(404).json({ success: false, message: "Route not found" }),
);

// ── Global error handler — logs the FULL error so you always see what broke ──
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
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
  await new Promise<void>((resolve) => {
    db.query("SELECT 1", (err: any) => {
      if (err) {
        console.error("❌ Cannot connect to MySQL:", err.message);
        console.error(
          "   → Check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in .env",
        );
      } else {
        console.log("✅ Connected to MySQL database");
      }
      resolve();
    });
  });

  // 2. Auto-create any missing tables / columns
  await runMigrations();

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

export default app;
