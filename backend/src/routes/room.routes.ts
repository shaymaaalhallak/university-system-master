import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

router.get("/", verifyToken, async (req: Request, res: Response) => {
  try {
    const rows = await query("SELECT room_id, room_code, building, capacity FROM rooms ORDER BY building, room_code");
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { room_code, building, capacity } = req.body;
    if (!room_code) {
      return res.status(400).json({ success: false, message: "room_code is required" });
    }
    const result: any = await query(
      "INSERT INTO rooms (room_code, building, capacity) VALUES (?, ?, ?)",
      [room_code, building || null, capacity || 0]
    );
    return res.status(201).json({ success: true, data: { room_id: result.insertId } });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, message: "Room code already exists" });
    }
    console.error("Failed to create room:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/:id", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    await query("DELETE FROM rooms WHERE room_id = ?", [req.params.id]);
    return res.json({ success: true, message: "Room deleted" });
  } catch (error) {
    console.error("Failed to delete room:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
