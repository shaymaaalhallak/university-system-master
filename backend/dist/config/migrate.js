"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const db_1 = __importDefault(require("./db"));
const query = (sql, params = []) => new Promise((resolve, reject) => db_1.default.query(sql, params, (err, results) => err ? reject(err) : resolve(results)));
const columnExists = async (table, column) => {
    const rows = await query(`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, column]);
    return rows[0].cnt > 0;
};
const tableExists = async (table) => {
    const rows = await query(`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [table]);
    return rows[0].cnt > 0;
};
const indexExists = async (table, index) => {
    const rows = await query(`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`, [table, index]);
    return rows[0].cnt > 0;
};
async function runMigrations() {
    console.log("Running database migrations...");
    try {
        if (!(await columnExists("users", "block_reason"))) {
            await query("ALTER TABLE `users` ADD COLUMN `block_reason` varchar(500) DEFAULT NULL AFTER `status`");
            console.log("  Added users.block_reason");
        }
        if (!(await columnExists("users", "must_change_password"))) {
            await query("ALTER TABLE `users` ADD COLUMN `must_change_password` tinyint(1) NOT NULL DEFAULT 0 AFTER `password`");
            console.log("  Added users.must_change_password");
        }
        if (!(await columnExists("professors", "cv_url"))) {
            await query("ALTER TABLE `professors` ADD COLUMN `cv_url` text DEFAULT NULL");
            console.log("  Added professors.cv_url");
        }
        if (!(await columnExists("professors", "degree_program_id"))) {
            await query("ALTER TABLE `professors` ADD COLUMN `degree_program_id` int(11) DEFAULT NULL AFTER `department_id`");
            console.log("  Added professors.degree_program_id");
        }
        if (!(await columnExists("course_sections", "section_name"))) {
            await query("ALTER TABLE `course_sections` ADD COLUMN `section_name` varchar(20) DEFAULT NULL AFTER `course_id`");
            console.log("  Added course_sections.section_name");
        }
        if (!(await tableExists("enrollments"))) {
            await query(`
        CREATE TABLE \`enrollments\` (
          \`enrollment_id\` int(11) NOT NULL AUTO_INCREMENT,
          \`student_id\` int(11) NOT NULL,
          \`section_id\` int(11) NOT NULL,
          \`enrolled_at\` timestamp DEFAULT current_timestamp(),
          \`status\` enum('active','dropped','completed') DEFAULT 'active',
          PRIMARY KEY (\`enrollment_id\`),
          UNIQUE KEY \`unique_enrollment\` (\`student_id\`, \`section_id\`),
          KEY \`student_id\` (\`student_id\`),
          KEY \`section_id\` (\`section_id\`),
          CONSTRAINT \`enrollments_ibfk_1\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`student_id\`),
          CONSTRAINT \`enrollments_ibfk_2\` FOREIGN KEY (\`section_id\`) REFERENCES \`course_sections\` (\`section_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  Created enrollments table");
        }
        if (!(await tableExists("prerequisites"))) {
            await query(`
        CREATE TABLE \`prerequisites\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`course_id\` int(11) NOT NULL,
          \`required_course_id\` int(11) NOT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`unique_prereq\` (\`course_id\`, \`required_course_id\`),
          CONSTRAINT \`prerequisites_ibfk_1\` FOREIGN KEY (\`course_id\`) REFERENCES \`courses\` (\`course_id\`),
          CONSTRAINT \`prerequisites_ibfk_2\` FOREIGN KEY (\`required_course_id\`) REFERENCES \`courses\` (\`course_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  Created prerequisites table");
        }
        if (!(await tableExists("audit_logs"))) {
            await query(`
        CREATE TABLE \`audit_logs\` (
          \`log_id\` int(11) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) NOT NULL,
          \`action\` enum('login','logout') NOT NULL,
          \`ip_address\` varchar(45) DEFAULT NULL,
          \`user_agent\` varchar(255) DEFAULT NULL,
          \`created_at\` timestamp DEFAULT current_timestamp(),
          PRIMARY KEY (\`log_id\`),
          KEY \`user_id\` (\`user_id\`),
          CONSTRAINT \`audit_logs_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  Created audit_logs table");
        }
        if (!(await tableExists("exam_exemptions"))) {
            await query(`
        CREATE TABLE \`exam_exemptions\` (
          \`exemption_id\` int(11) NOT NULL AUTO_INCREMENT,
          \`student_id\` int(11) NOT NULL,
          \`exam_id\` int(11) NOT NULL,
          \`reason\` text NOT NULL,
          \`status\` enum('pending','approved','rejected') DEFAULT 'pending',
          \`admin_note\` text DEFAULT NULL,
          \`requested_at\` timestamp DEFAULT current_timestamp(),
          PRIMARY KEY (\`exemption_id\`),
          KEY \`student_id\` (\`student_id\`),
          KEY \`exam_id\` (\`exam_id\`),
          CONSTRAINT \`exemptions_ibfk_1\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`student_id\`),
          CONSTRAINT \`exemptions_ibfk_2\` FOREIGN KEY (\`exam_id\`) REFERENCES \`exams\` (\`exam_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  Created exam_exemptions table");
        }
        if (!(await tableExists("grade_entry_control"))) {
            await query(`
        CREATE TABLE \`grade_entry_control\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`section_id\` int(11) NOT NULL,
          \`is_enabled\` tinyint(1) DEFAULT 0,
          \`assignment_label\` varchar(100) DEFAULT 'Assignments',
          \`midterm_label\` varchar(100) DEFAULT 'Midterm',
          \`final_label\` varchar(100) DEFAULT 'Final Exam',
          \`assignment_weight\` int(11) DEFAULT 30,
          \`midterm_weight\` int(11) DEFAULT 30,
          \`final_weight\` int(11) DEFAULT 40,
          \`enabled_by\` int(11) DEFAULT NULL,
          \`updated_at\` timestamp DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`unique_section\` (\`section_id\`),
          CONSTRAINT \`gec_ibfk_1\` FOREIGN KEY (\`section_id\`) REFERENCES \`course_sections\` (\`section_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  Created grade_entry_control table");
        }
        if (!(await columnExists("grade_entry_control", "assignment_label"))) {
            await query("ALTER TABLE `grade_entry_control` ADD COLUMN `assignment_label` varchar(100) DEFAULT 'Assignments' AFTER `is_enabled`");
            console.log("  Added grade_entry_control.assignment_label");
        }
        if (!(await columnExists("grade_entry_control", "midterm_label"))) {
            await query("ALTER TABLE `grade_entry_control` ADD COLUMN `midterm_label` varchar(100) DEFAULT 'Midterm' AFTER `assignment_label`");
            console.log("  Added grade_entry_control.midterm_label");
        }
        if (!(await columnExists("grade_entry_control", "final_label"))) {
            await query("ALTER TABLE `grade_entry_control` ADD COLUMN `final_label` varchar(100) DEFAULT 'Final Exam' AFTER `midterm_label`");
            console.log("  Added grade_entry_control.final_label");
        }
        if (!(await columnExists("grade_entry_control", "assignment_weight"))) {
            await query("ALTER TABLE `grade_entry_control` ADD COLUMN `assignment_weight` int(11) DEFAULT 30 AFTER `final_label`");
            console.log("  Added grade_entry_control.assignment_weight");
        }
        if (!(await columnExists("grade_entry_control", "midterm_weight"))) {
            await query("ALTER TABLE `grade_entry_control` ADD COLUMN `midterm_weight` int(11) DEFAULT 30 AFTER `assignment_weight`");
            console.log("  Added grade_entry_control.midterm_weight");
        }
        if (!(await columnExists("grade_entry_control", "final_weight"))) {
            await query("ALTER TABLE `grade_entry_control` ADD COLUMN `final_weight` int(11) DEFAULT 40 AFTER `midterm_weight`");
            console.log("  Added grade_entry_control.final_weight");
        }
        if (!(await columnExists("grade_entry_control", "opened_at"))) {
            await query("ALTER TABLE `grade_entry_control` ADD COLUMN `opened_at` datetime DEFAULT NULL AFTER `enabled_by`");
            console.log("  Added grade_entry_control.opened_at");
        }
        if (!(await columnExists("grade_entry_control", "close_at"))) {
            await query("ALTER TABLE `grade_entry_control` ADD COLUMN `close_at` datetime DEFAULT NULL AFTER `opened_at`");
            console.log("  Added grade_entry_control.close_at");
        }
        if (!(await columnExists("grade_entry_control", "entry_mode"))) {
            await query("ALTER TABLE `grade_entry_control` ADD COLUMN `entry_mode` enum('exam','assignment') DEFAULT 'exam' AFTER `close_at`");
            console.log("  Added grade_entry_control.entry_mode");
        }
        if (!(await columnExists("assignments", "created_by"))) {
            await query("ALTER TABLE `assignments` ADD COLUMN `created_by` int(11) DEFAULT NULL AFTER `section_id`");
            console.log("  Added assignments.created_by");
        }
        if (!(await columnExists("assignments", "course_id"))) {
            await query("ALTER TABLE `assignments` ADD COLUMN `course_id` int(11) DEFAULT NULL AFTER `section_id`");
            console.log("  Added assignments.course_id");
        }
        if (!(await tableExists("grade_components"))) {
            await query(`
        CREATE TABLE \`grade_components\` (
          \`component_id\` int(11) NOT NULL AUTO_INCREMENT,
          \`section_id\` int(11) NOT NULL,
          \`component_name\` varchar(100) NOT NULL,
          \`weight\` int(11) NOT NULL,
          \`display_order\` int(11) NOT NULL DEFAULT 0,
          PRIMARY KEY (\`component_id\`),
          KEY \`gc_section_id\` (\`section_id\`),
          CONSTRAINT \`gc_section_fk\` FOREIGN KEY (\`section_id\`) REFERENCES \`course_sections\` (\`section_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  Created grade_components table");
        }
        if (!(await tableExists("grade_component_scores"))) {
            await query(`
        CREATE TABLE \`grade_component_scores\` (
          \`component_score_id\` int(11) NOT NULL AUTO_INCREMENT,
          \`grade_id\` int(11) NOT NULL,
          \`component_id\` int(11) NOT NULL,
          \`score\` decimal(5,2) NOT NULL DEFAULT 0,
          PRIMARY KEY (\`component_score_id\`),
          UNIQUE KEY \`unique_grade_component\` (\`grade_id\`, \`component_id\`),
          KEY \`gcs_component_id\` (\`component_id\`),
          CONSTRAINT \`gcs_grade_fk\` FOREIGN KEY (\`grade_id\`) REFERENCES \`grades\` (\`grade_id\`) ON DELETE CASCADE,
          CONSTRAINT \`gcs_component_fk\` FOREIGN KEY (\`component_id\`) REFERENCES \`grade_components\` (\`component_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  Created grade_component_scores table");
        }
        if (!(await tableExists("announcements"))) {
            await query(`
        CREATE TABLE \`announcements\` (
          \`announcement_id\` int(11) NOT NULL AUTO_INCREMENT,
          \`title\` varchar(150) NOT NULL,
          \`content\` text NOT NULL,
          \`author_id\` int(11) NOT NULL,
          \`target_roles\` varchar(100) DEFAULT 'student,professor,admin',
          \`priority\` enum('low','medium','high') DEFAULT 'medium',
          \`created_at\` timestamp DEFAULT current_timestamp(),
          \`expires_at\` date DEFAULT NULL,
          PRIMARY KEY (\`announcement_id\`),
          KEY \`author_id\` (\`author_id\`),
          CONSTRAINT \`announcements_ibfk_1\` FOREIGN KEY (\`author_id\`) REFERENCES \`users\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  Created announcements table");
        }
        if (!(await columnExists("assignments", "attachment_url"))) {
            await query("ALTER TABLE `assignments` ADD COLUMN `attachment_url` text DEFAULT NULL AFTER `description`");
            console.log("  Added assignments.attachment_url");
        }
        if (!(await indexExists("grades", "unique_student_section_grade"))) {
            await query(`
        DELETE g1 FROM grades g1
        INNER JOIN grades g2
          ON g1.student_id = g2.student_id
         AND g1.section_id = g2.section_id
         AND g1.grade_id < g2.grade_id
      `);
            await query("ALTER TABLE `grades` ADD UNIQUE KEY `unique_student_section_grade` (`student_id`, `section_id`)");
            console.log("  Added grades unique_student_section_grade");
        }
        // ── professor_course_eligibility table ──────────────────────────────────
        if (!(await tableExists("professor_course_eligibility"))) {
            await query(`
        CREATE TABLE \`professor_course_eligibility\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`professor_id\` int(11) NOT NULL,
          \`course_id\` int(11) NOT NULL,
          \`eligibility_type\` enum('primary','secondary') DEFAULT 'secondary',
          \`created_at\` timestamp DEFAULT current_timestamp(),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uniq_prof_course\` (\`professor_id\`, \`course_id\`),
          KEY \`idx_pce_course\` (\`course_id\`),
          CONSTRAINT \`pce_prof_fk\` FOREIGN KEY (\`professor_id\`) REFERENCES \`professors\` (\`professor_id\`) ON DELETE CASCADE,
          CONSTRAINT \`pce_course_fk\` FOREIGN KEY (\`course_id\`) REFERENCES \`courses\` (\`course_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  Created professor_course_eligibility table");
        }
        // ── study_plans table ────────────────────────────────────────────────────
        if (!(await tableExists("study_plans"))) {
            await query(`
        CREATE TABLE \`study_plans\` (
          \`plan_id\` int(11) NOT NULL AUTO_INCREMENT,
          \`plan_name\` varchar(150) NOT NULL,
          \`department_id\` int(11) DEFAULT NULL,
          \`program_id\` int(11) DEFAULT NULL,
          \`created_at\` timestamp DEFAULT current_timestamp(),
          PRIMARY KEY (\`plan_id\`),
          KEY \`idx_sp_department\` (\`department_id\`),
          KEY \`idx_sp_program\` (\`program_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  ✓ Created study_plans table");
        }
        if (!(await columnExists("study_plans", "department_id"))) {
            await query("ALTER TABLE `study_plans` ADD COLUMN `department_id` int(11) DEFAULT NULL AFTER `name`");
            console.log("  Added study_plans.department_id");
        }
        if (!(await columnExists("study_plans", "program_id"))) {
            await query("ALTER TABLE `study_plans` ADD COLUMN `program_id` int(11) DEFAULT NULL AFTER `department_id`");
            console.log("  Added study_plans.program_id");
        }
        if (!(await indexExists("study_plans", "idx_sp_department"))) {
            await query("ALTER TABLE `study_plans` ADD KEY `idx_sp_department` (`department_id`)");
            console.log("  Added study_plans.idx_sp_department");
        }
        if (!(await indexExists("study_plans", "idx_sp_program"))) {
            await query("ALTER TABLE `study_plans` ADD KEY `idx_sp_program` (`program_id`)");
            console.log("  Added study_plans.idx_sp_program");
        }
        // ── study_plan_courses table ─────────────────────────────────────────────
        if (!(await tableExists("study_plan_courses"))) {
            await query(`
        CREATE TABLE \`study_plan_courses\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`plan_id\` int(11) NOT NULL,
          \`course_id\` int(11) NOT NULL,
          \`year_no\` int(11) NOT NULL,
          \`semester_no\` int(11) NOT NULL,
          \`is_required\` tinyint(1) DEFAULT 1,
          \`created_at\` timestamp DEFAULT current_timestamp(),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uniq_plan_course\` (\`plan_id\`, \`course_id\`),
          KEY \`idx_spc_course\` (\`course_id\`),
          CONSTRAINT \`spc_plan_fk\` FOREIGN KEY (\`plan_id\`) REFERENCES \`study_plans\` (\`plan_id\`) ON DELETE CASCADE,
          CONSTRAINT \`spc_course_fk\` FOREIGN KEY (\`course_id\`) REFERENCES \`courses\` (\`course_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  ✓ Created study_plan_courses table");
        }
        if (!(await columnExists("study_plan_courses", "course_bucket"))) {
            await query("ALTER TABLE `study_plan_courses` ADD COLUMN `course_bucket` varchar(30) NOT NULL DEFAULT 'major' AFTER `is_required`");
            console.log("  Added study_plan_courses.course_bucket");
        }
        if (!(await columnExists("study_plan_courses", "is_flexible"))) {
            await query("ALTER TABLE `study_plan_courses` ADD COLUMN `is_flexible` tinyint(1) NOT NULL DEFAULT 0 AFTER `course_bucket`");
            console.log("  Added study_plan_courses.is_flexible");
        }
        // ── program_fee_settings table ───────────────────────────────────────────
        if (!(await tableExists("program_fee_settings"))) {
            await query(`
        CREATE TABLE \`program_fee_settings\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`program_id\` int(11) NOT NULL,
          \`price_per_credit\` decimal(10,2) NOT NULL DEFAULT 0.00,
          \`effective_from\` date DEFAULT NULL,
          \`effective_to\` date DEFAULT NULL,
          \`created_at\` timestamp DEFAULT current_timestamp(),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uniq_program\` (\`program_id\`),
          CONSTRAINT \`pfs_program_fk\` FOREIGN KEY (\`program_id\`) REFERENCES \`programs\` (\`program_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  ✓ Created program_fee_settings table");
        }
        // ── student_invoices table ───────────────────────────────────────────────
        if (!(await tableExists("student_invoices"))) {
            await query(`
        CREATE TABLE \`student_invoices\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`student_id\` int(11) NOT NULL,
          \`semester\` varchar(20) NOT NULL,
          \`year\` int(11) NOT NULL,
          \`total_credits\` int(11) NOT NULL DEFAULT 0,
          \`price_per_credit\` decimal(10,2) NOT NULL DEFAULT 0.00,
          \`total_amount\` decimal(10,2) NOT NULL DEFAULT 0.00,
          \`discount_amount\` decimal(10,2) NOT NULL DEFAULT 0.00,
          \`penalty_amount\` decimal(10,2) NOT NULL DEFAULT 0.00,
          \`final_amount\` decimal(10,2) NOT NULL DEFAULT 0.00,
          \`paid_amount\` decimal(10,2) NOT NULL DEFAULT 0.00,
          \`status\` enum('pending','paid','partial','overdue') DEFAULT 'pending',
          \`generated_at\` timestamp DEFAULT current_timestamp(),
          PRIMARY KEY (\`id\`),
          KEY \`inv_student\` (\`student_id\`),
          KEY \`inv_semester\` (\`semester\`,\`year\`),
          CONSTRAINT \`inv_student_fk\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`student_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  ✓ Created student_invoices table");
        }
        // ── student_payments table ───────────────────────────────────────────────
        if (!(await tableExists("student_payments"))) {
            await query(`
        CREATE TABLE \`student_payments\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`invoice_id\` int(11) NOT NULL,
          \`student_id\` int(11) NOT NULL,
          \`amount\` decimal(10,2) NOT NULL DEFAULT 0.00,
          \`payment_method\` varchar(50) DEFAULT NULL,
          \`transaction_reference\` varchar(100) DEFAULT NULL,
          \`payment_date\` datetime DEFAULT current_timestamp(),
          \`status\` enum('pending','completed','failed') DEFAULT 'pending',
          \`admin_notes\` text DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          KEY \`pay_invoice\` (\`invoice_id\`),
          KEY \`pay_student\` (\`student_id\`),
          CONSTRAINT \`pay_invoice_fk\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`student_invoices\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`pay_student_fk\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`student_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  ✓ Created student_payments table");
        }
        // ── student_discounts table ──────────────────────────────────────────────
        if (!(await tableExists("student_discounts"))) {
            await query(`
        CREATE TABLE \`student_discounts\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`student_id\` int(11) NOT NULL,
          \`type\` varchar(50) NOT NULL,
          \`value\` decimal(10,2) NOT NULL DEFAULT 0.00,
          \`reason\` text DEFAULT NULL,
          \`semester\` varchar(20) NOT NULL,
          \`year\` int(11) NOT NULL,
          \`created_at\` timestamp DEFAULT current_timestamp(),
          PRIMARY KEY (\`id\`),
          KEY \`disc_student\` (\`student_id\`),
          CONSTRAINT \`disc_student_fk\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`student_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  ✓ Created student_discounts table");
        }
        // ── fee_penalties table ──────────────────────────────────────────────────
        if (!(await tableExists("fee_penalties"))) {
            await query(`
        CREATE TABLE \`fee_penalties\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`student_id\` int(11) NOT NULL,
          \`amount\` decimal(10,2) NOT NULL DEFAULT 0.00,
          \`reason\` varchar(255) DEFAULT NULL,
          \`semester\` varchar(20) NOT NULL,
          \`year\` int(11) NOT NULL,
          \`created_at\` timestamp DEFAULT current_timestamp(),
          PRIMARY KEY (\`id\`),
          KEY \`pen_student\` (\`student_id\`),
          CONSTRAINT \`pen_student_fk\` FOREIGN KEY (\`student_id\`) REFERENCES \`students\` (\`student_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
            console.log("  ✓ Created fee_penalties table");
        }
        console.log("Migrations complete");
    }
    catch (err) {
        console.error("Migration failed:", err.message);
    }
}
