import { Router, Request, Response } from "express";
import db from "../config/db";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

const query = (sql: string, params: any[] = []): Promise<any> =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, results) => (err ? reject(err) : resolve(results)))
  );

const getStudentId = async (userId: number): Promise<number | null> => {
  const rows = await query("SELECT student_id FROM students WHERE user_id = ?", [userId]);
  return rows.length > 0 ? rows[0].student_id : null;
};

// ─── Fee Structure (static, public) ────────────────────────────────────────
router.get("/structure", verifyToken, async (_req: Request, res: Response) => {
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

// ─── Program Fee Configuration ─────────────────────────────────────────────
router.get("/config", verifyToken, requireRole("admin"), async (_req: Request, res: Response) => {
  try {
    const rows = await query(`
      SELECT pfs.id, pfs.program_id, pr.program_name, pfs.price_per_credit,
             pfs.effective_from, pfs.effective_to, pfs.created_at
      FROM program_fee_settings pfs
      JOIN programs pr ON pfs.program_id = pr.program_id
      ORDER BY pr.program_name
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/config", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { program_id, price_per_credit, effective_from, effective_to } = req.body;
    if (!program_id || price_per_credit === undefined) {
      return res.status(400).json({ success: false, message: "program_id and price_per_credit are required" });
    }
    if (Number(price_per_credit) <= 0) {
      return res.status(400).json({ success: false, message: "price_per_credit must be greater than 0" });
    }
    if (!effective_from || !effective_to) {
      return res.status(400).json({ success: false, message: "effective_from and effective_to are required" });
    }
    await query(
      `INSERT INTO program_fee_settings (program_id, price_per_credit, effective_from, effective_to)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE price_per_credit = VALUES(price_per_credit),
                               effective_from = VALUES(effective_from),
                               effective_to = VALUES(effective_to)`,
      [program_id, price_per_credit, effective_from, effective_to],
    );
    return res.json({ success: true, message: "Fee configuration saved" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/config/:id", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    await query("DELETE FROM program_fee_settings WHERE id = ?", [req.params.id]);
    return res.json({ success: true, message: "Fee configuration deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Invoices ──────────────────────────────────────────────────────────────
router.get("/invoices", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { studentId, semester, year, status } = req.query;
    let sql = `
      SELECT si.*, u.first_name, u.last_name, u.email, pr.program_name
      FROM student_invoices si
      JOIN students s ON si.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN programs pr ON s.program_id = pr.program_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (studentId) { sql += " AND si.student_id = ?"; params.push(studentId); }
    if (semester) { sql += " AND si.semester = ?"; params.push(semester); }
    if (year) { sql += " AND si.year = ?"; params.push(year); }
    if (status) { sql += " AND si.status = ?"; params.push(status); }
    sql += " ORDER BY si.year DESC, si.semester, u.last_name";
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/invoices/my", verifyToken, requireRole("student"), async (req: Request, res: Response) => {
  try {
    const studentId = await getStudentId(req.user!.id);
    if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });
    const rows = await query(
      "SELECT * FROM student_invoices WHERE student_id = ? ORDER BY year DESC, semester",
      [studentId],
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/invoices/generate", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { semester, year, studentId } = req.body;
    if (!semester || !year) {
      return res.status(400).json({ success: false, message: "semester and year are required" });
    }

    // Get all active students (or specific one)
    let students: any[];
    if (studentId) {
      students = await query(
        "SELECT s.student_id, s.program_id, s.department_id FROM students s WHERE s.student_id = ?",
        [studentId],
      );
    } else {
      students = await query(`
        SELECT DISTINCT s.student_id, s.program_id, s.department_id
        FROM students s
        JOIN enrollments e ON s.student_id = e.student_id
        JOIN course_sections cs ON e.section_id = cs.section_id
        WHERE cs.semester = ? AND cs.year = ? AND e.status = 'active'
      `, [semester, year]);
    }

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: "No students found for this semester/year" });
    }

    const created: any[] = [];

    for (const student of students) {
      // Check if invoice already exists
      const existing = await query(
        "SELECT id FROM student_invoices WHERE student_id = ? AND semester = ? AND year = ?",
        [student.student_id, semester, year],
      );
      if (existing.length > 0) {
        created.push({ studentId: student.student_id, skipped: true, invoiceId: existing[0].id });
        continue;
      }

      // Get fee config for student's program
      let pricePerCredit = 0;
      if (student.program_id) {
        const feeConfig = await query(
          "SELECT price_per_credit FROM program_fee_settings WHERE program_id = ? AND (effective_to IS NULL OR effective_to >= CURDATE()) ORDER BY effective_from DESC LIMIT 1",
          [student.program_id],
        );
        if (feeConfig.length > 0) {
          pricePerCredit = Number(feeConfig[0].price_per_credit);
        }
      }

      // Get total enrolled credits for this student in this semester
      const creditsResult = await query(`
        SELECT COALESCE(SUM(c.credits), 0) AS total_credits
        FROM enrollments e
        JOIN course_sections cs ON e.section_id = cs.section_id
        JOIN courses c ON cs.course_id = c.course_id
        WHERE e.student_id = ? AND cs.semester = ? AND cs.year = ? AND e.status = 'active'
      `, [student.student_id, semester, year]);
      const totalCredits = Number(creditsResult[0]?.total_credits || 0);
      const totalAmount = totalCredits * pricePerCredit;

      // Get existing discounts for this student/semester
      const discountsResult = await query(
        "SELECT COALESCE(SUM(value), 0) AS total_discount FROM student_discounts WHERE student_id = ? AND semester = ? AND year = ?",
        [student.student_id, semester, year],
      );
      const discountAmount = Number(discountsResult[0]?.total_discount || 0);

      // Get existing penalties for this student/semester
      const penaltiesResult = await query(
        "SELECT COALESCE(SUM(amount), 0) AS total_penalty FROM fee_penalties WHERE student_id = ? AND semester = ? AND year = ?",
        [student.student_id, semester, year],
      );
      const penaltyAmount = Number(penaltiesResult[0]?.total_penalty || 0);

      const finalAmount = totalAmount - discountAmount + penaltyAmount;

      const result: any = await query(
        `INSERT INTO student_invoices (student_id, semester, year, total_credits, price_per_credit, total_amount, discount_amount, penalty_amount, final_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [student.student_id, semester, year, totalCredits, pricePerCredit, totalAmount, discountAmount, penaltyAmount, finalAmount],
      );

      created.push({ studentId: student.student_id, invoiceId: result.insertId, totalCredits, totalAmount, finalAmount });
    }

    return res.json({ success: true, message: `Generated/updated ${created.length} invoice(s)`, data: created });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/invoices/:id", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    await query("UPDATE student_invoices SET status = ? WHERE id = ?", [status, req.params.id]);
    return res.json({ success: true, message: "Invoice updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Payments ──────────────────────────────────────────────────────────────
router.get("/payments", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { studentId, invoiceId, status } = req.query;
    let sql = `
      SELECT sp.*, u.first_name, u.last_name, u.email, si.semester, si.year
      FROM student_payments sp
      JOIN students s ON sp.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN student_invoices si ON sp.invoice_id = si.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (studentId) { sql += " AND sp.student_id = ?"; params.push(studentId); }
    if (invoiceId) { sql += " AND sp.invoice_id = ?"; params.push(invoiceId); }
    if (status) { sql += " AND sp.status = ?"; params.push(status); }
    sql += " ORDER BY sp.payment_date DESC";
    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/payments/my", verifyToken, requireRole("student"), async (req: Request, res: Response) => {
  try {
    const studentId = await getStudentId(req.user!.id);
    if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });
    const rows = await query(
      "SELECT * FROM student_payments WHERE student_id = ? ORDER BY payment_date DESC",
      [studentId],
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/payments", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { invoice_id, student_id, amount, payment_method, transaction_reference, admin_notes } = req.body;
    if (!invoice_id || !student_id || !amount) {
      return res.status(400).json({ success: false, message: "invoice_id, student_id, and amount are required" });
    }
    const result: any = await query(
      "INSERT INTO student_payments (invoice_id, student_id, amount, payment_method, transaction_reference, status, admin_notes) VALUES (?, ?, ?, ?, ?, 'completed', ?)",
      [invoice_id, student_id, amount, payment_method || null, transaction_reference || null, admin_notes || null],
    );

    // Update invoice paid_amount and status
    await query(
      `UPDATE student_invoices si
       SET si.paid_amount = COALESCE((SELECT SUM(amount) FROM student_payments WHERE invoice_id = ? AND status = 'completed'), 0),
           si.status = CASE
             WHEN COALESCE((SELECT SUM(amount) FROM student_payments WHERE invoice_id = ? AND status = 'completed'), 0) >= si.final_amount THEN 'paid'
             WHEN COALESCE((SELECT SUM(amount) FROM student_payments WHERE invoice_id = ? AND status = 'completed'), 0) > 0 THEN 'partial'
             ELSE 'pending'
           END
       WHERE si.id = ?`,
      [invoice_id, invoice_id, invoice_id, invoice_id],
    );

    return res.status(201).json({ success: true, data: { paymentId: result.insertId } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/payments/:id/verify", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const payment = await query("SELECT * FROM student_payments WHERE id = ?", [req.params.id]);
    if (payment.length === 0) return res.status(404).json({ success: false, message: "Payment not found" });
    await query("UPDATE student_payments SET status = 'completed' WHERE id = ?", [req.params.id]);
    const p = payment[0];
    await query(
      `UPDATE student_invoices si
       SET si.paid_amount = COALESCE((SELECT SUM(amount) FROM student_payments WHERE invoice_id = ? AND status = 'completed'), 0),
           si.status = CASE
             WHEN COALESCE((SELECT SUM(amount) FROM student_payments WHERE invoice_id = ? AND status = 'completed'), 0) >= si.final_amount THEN 'paid'
             WHEN COALESCE((SELECT SUM(amount) FROM student_payments WHERE invoice_id = ? AND status = 'completed'), 0) > 0 THEN 'partial'
             ELSE 'pending'
           END
       WHERE si.id = ?`,
      [p.invoice_id, p.invoice_id, p.invoice_id, p.invoice_id],
    );
    return res.json({ success: true, message: "Payment verified" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Discounts ─────────────────────────────────────────────────────────────
router.get("/discounts", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const rows = await query(`
      SELECT sd.*, u.first_name, u.last_name, u.email, pr.program_name
      FROM student_discounts sd
      JOIN students s ON sd.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN programs pr ON s.program_id = pr.program_id
      ORDER BY sd.created_at DESC
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/discounts", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { student_id, type, value, reason, semester, year, all_students } = req.body;
    if (value === undefined || !type || !semester || !year) {
      return res.status(400).json({ success: false, message: "type, value, semester, and year are required" });
    }
    if (!all_students && !student_id) {
      return res.status(400).json({ success: false, message: "student_id is required when not applying to all students" });
    }

    const targetStudents: number[] = [];
    if (all_students) {
      const rows = await query(
        "SELECT DISTINCT s.student_id FROM students s JOIN enrollments e ON s.student_id = e.student_id JOIN course_sections cs ON e.section_id = cs.section_id WHERE cs.semester = ? AND cs.year = ? AND e.status = 'active'",
        [semester, year],
      );
      rows.forEach((r: any) => targetStudents.push(r.student_id));
    } else {
      targetStudents.push(student_id);
    }

    const createdIds: number[] = [];
    for (const sid of targetStudents) {
      const result: any = await query(
        "INSERT INTO student_discounts (student_id, type, value, reason, semester, year) VALUES (?, ?, ?, ?, ?, ?)",
        [sid, type, value, reason || null, semester, year],
      );
      createdIds.push(result.insertId);

      // Update corresponding invoice
      await query(
        `UPDATE student_invoices si
         SET si.discount_amount = COALESCE((SELECT SUM(value) FROM student_discounts WHERE student_id = ? AND semester = ? AND year = ?), 0),
             si.final_amount = si.total_amount - si.discount_amount + si.penalty_amount,
             si.status = CASE
               WHEN si.paid_amount >= si.total_amount - si.discount_amount + si.penalty_amount THEN 'paid'
               WHEN si.paid_amount > 0 THEN 'partial'
               ELSE 'pending'
             END
         WHERE si.student_id = ? AND si.semester = ? AND si.year = ?`,
        [sid, semester, year, sid, semester, year],
      );
    }

    return res.status(201).json({ success: true, data: { ids: createdIds, count: createdIds.length } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/discounts/:id", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const disc = await query("SELECT student_id, semester, year FROM student_discounts WHERE id = ?", [req.params.id]);
    await query("DELETE FROM student_discounts WHERE id = ?", [req.params.id]);
    if (disc.length > 0) {
      const { student_id, semester, year } = disc[0];
      await query(
        `UPDATE student_invoices si
         SET si.discount_amount = COALESCE((SELECT SUM(value) FROM student_discounts WHERE student_id = ? AND semester = ? AND year = ?), 0),
             si.final_amount = si.total_amount - si.discount_amount + si.penalty_amount,
             si.status = CASE
               WHEN si.paid_amount >= si.total_amount - si.discount_amount + si.penalty_amount THEN 'paid'
               WHEN si.paid_amount > 0 THEN 'partial'
               ELSE 'pending'
             END
         WHERE si.student_id = ? AND si.semester = ? AND si.year = ?`,
        [student_id, semester, year, student_id, semester, year],
      );
    }
    return res.json({ success: true, message: "Discount deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Penalties ─────────────────────────────────────────────────────────────
router.get("/penalties", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const rows = await query(`
      SELECT fp.*, u.first_name, u.last_name, u.email, pr.program_name
      FROM fee_penalties fp
      JOIN students s ON fp.student_id = s.student_id
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN programs pr ON s.program_id = pr.program_id
      ORDER BY fp.created_at DESC
    `);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/penalties", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { student_id, amount, reason, semester, year, all_students } = req.body;
    if (amount === undefined || !semester || !year) {
      return res.status(400).json({ success: false, message: "amount, semester, and year are required" });
    }
    if (!all_students && !student_id) {
      return res.status(400).json({ success: false, message: "student_id is required when not applying to all students" });
    }

    const targetStudents: number[] = [];
    if (all_students) {
      const rows = await query(
        "SELECT DISTINCT s.student_id FROM students s JOIN enrollments e ON s.student_id = e.student_id JOIN course_sections cs ON e.section_id = cs.section_id WHERE cs.semester = ? AND cs.year = ? AND e.status = 'active'",
        [semester, year],
      );
      rows.forEach((r: any) => targetStudents.push(r.student_id));
    } else {
      targetStudents.push(student_id);
    }

    const createdIds: number[] = [];
    for (const sid of targetStudents) {
      const result: any = await query(
        "INSERT INTO fee_penalties (student_id, amount, reason, semester, year) VALUES (?, ?, ?, ?, ?)",
        [sid, amount, reason || null, semester, year],
      );
      createdIds.push(result.insertId);

      // Update corresponding invoice
      await query(
        `UPDATE student_invoices si
         SET si.penalty_amount = COALESCE((SELECT SUM(amount) FROM fee_penalties WHERE student_id = ? AND semester = ? AND year = ?), 0),
             si.final_amount = si.total_amount - si.discount_amount + si.penalty_amount,
             si.status = CASE
               WHEN si.paid_amount >= si.total_amount - si.discount_amount + si.penalty_amount THEN 'paid'
               WHEN si.paid_amount > 0 THEN 'partial'
               ELSE 'pending'
             END
         WHERE si.student_id = ? AND si.semester = ? AND si.year = ?`,
        [sid, semester, year, sid, semester, year],
      );
    }

    return res.status(201).json({ success: true, data: { ids: createdIds, count: createdIds.length } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/penalties/:id", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const pen = await query("SELECT student_id, semester, year FROM fee_penalties WHERE id = ?", [req.params.id]);
    await query("DELETE FROM fee_penalties WHERE id = ?", [req.params.id]);
    if (pen.length > 0) {
      const { student_id, semester, year } = pen[0];
      await query(
        `UPDATE student_invoices si
         SET si.penalty_amount = COALESCE((SELECT SUM(amount) FROM fee_penalties WHERE student_id = ? AND semester = ? AND year = ?), 0),
             si.final_amount = si.total_amount - si.discount_amount + si.penalty_amount,
             si.status = CASE
               WHEN si.paid_amount >= si.total_amount - si.discount_amount + si.penalty_amount THEN 'paid'
               WHEN si.paid_amount > 0 THEN 'partial'
               ELSE 'pending'
             END
         WHERE si.student_id = ? AND si.semester = ? AND si.year = ?`,
        [student_id, semester, year, student_id, semester, year],
      );
    }
    return res.json({ success: true, message: "Penalty deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Student Fee Dashboard ─────────────────────────────────────────────────
router.get("/dashboard", verifyToken, requireRole("student"), async (req: Request, res: Response) => {
  try {
    const studentId = await getStudentId(req.user!.id);
    if (!studentId) return res.status(404).json({ success: false, message: "Student profile not found" });

    const student = await query(
      `SELECT s.*, pr.program_name FROM students s
       LEFT JOIN programs pr ON s.program_id = pr.program_id
       WHERE s.student_id = ?`,
      [studentId],
    );

    // Get current enrollments with credits
    const enrollments = await query(`
      SELECT e.enrollment_id, c.course_code, c.course_title, c.credits,
             cs.section_id, cs.semester, cs.year, cs.section_name
      FROM enrollments e
      JOIN course_sections cs ON e.section_id = cs.section_id
      JOIN courses c ON cs.course_id = c.course_id
      WHERE e.student_id = ? AND e.status = 'active'
    `, [studentId]);

    // Get invoices
    const invoices = await query(
      "SELECT * FROM student_invoices WHERE student_id = ? ORDER BY year DESC, semester DESC",
      [studentId],
    );

    // Get payments
    const payments = await query(
      "SELECT * FROM student_payments WHERE student_id = ? ORDER BY payment_date DESC",
      [studentId],
    );

    // Get discounts
    const discounts = await query(
      "SELECT * FROM student_discounts WHERE student_id = ? ORDER BY created_at DESC",
      [studentId],
    );

    // Get penalties
    const penalties = await query(
      "SELECT * FROM fee_penalties WHERE student_id = ? ORDER BY created_at DESC",
      [studentId],
    );

    const totalPaid = payments
      .filter((p: any) => p.status === "completed")
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    const totalPending = invoices
      .filter((i: any) => i.status === "pending" || i.status === "partial")
      .reduce((sum: number, i: any) => sum + (Number(i.final_amount) - Number(i.paid_amount)), 0);

    const totalCredits = enrollments.reduce((sum: number, e: any) => sum + Number(e.credits), 0);

    return res.json({
      success: true,
      data: {
        student: student[0],
        enrollments,
        invoices,
        payments,
        discounts,
        penalties,
        totalCredits,
        totalPaid,
        totalPending,
        balance: totalPending,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Legacy: Simple payments list (still used by admin dashboard) ──────────
router.get("/", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
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
    const params: any[] = [];
    if (studentId) { sql += " AND p.student_id = ?"; params.push(studentId); }
    if (status) { sql += " AND p.status = ?"; params.push(status); }
    sql += " ORDER BY p.payment_date DESC";

    const rows = await query(sql, params);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/", verifyToken, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const { studentId, amount, paymentType, paymentMethod, paymentDate } = req.body;
    const result: any = await query(
      "INSERT INTO payments (student_id, amount, payment_type, payment_method, payment_date, status) VALUES (?, ?, ?, ?, ?, 'completed')",
      [studentId, amount, paymentType, paymentMethod, paymentDate || new Date()],
    );
    return res.status(201).json({ success: true, data: { paymentId: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/:id/pay", verifyToken, async (req: Request, res: Response) => {
  try {
    const { paymentMethod } = req.body;
    await query(
      "UPDATE payments SET status = 'completed', payment_method = ?, payment_date = CURDATE() WHERE payment_id = ?",
      [paymentMethod || "online", req.params.id],
    );
    return res.json({ success: true, message: "Payment recorded" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
