import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "../config/db";

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string; role: string };
    }
  }
}

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err: any, results: any) =>
      err ? reject(err) : resolve(results)
    )
  );

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "university_jwt_secret_key_2024"
    ) as { id: number; email: string; role: string };

    const users = await query(
      "SELECT user_id, email, role, status, block_reason FROM users WHERE user_id = ?",
      [decoded.id]
    );
    if (users.length === 0)
      return res
        .status(401)
        .json({ success: false, message: "User not found" });

    const user = users[0];
    if (user.status === "blocked")
      return res.status(403).json({
        success: false,
        blocked: true,
        message:
          user.block_reason ||
          "Your account is blocked. Contact the administrator.",
      });

    req.user = { id: user.user_id, email: user.email, role: user.role };
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
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
