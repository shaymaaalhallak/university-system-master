// User Types
export type UserRole = "student" | "professor" | "admin" | "super_admin";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  mustChangePassword?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Student extends User {
  role: "student";
  studentId: string;
  departmentId: string;
  enrollmentYear: number;
  semester: number;
  gpa?: number;
}

export interface Professor extends User {
  role: "professor";
  employeeId: string;
  departmentId: string;
  designation: string;
  specialization: string[];
}

export interface Admin extends User {
  role: "admin" | "super_admin";
  employeeId: string;
  departmentId?: string;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

// Department Types
export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  headId?: string;
  createdAt: Date;
}

// Course Types
export interface Course {
  id: string;
  code: string;
  name: string;
  description: string;
  credits: number;
  departmentId: string;
  professorId?: string;
  semester: number;
  maxStudents: number;
  enrolledStudents: number;
}

export interface CourseSection {
  id: string;
  courseId: string;
  section: string;
  professorId: string;
  room: string;
  schedule: Schedule[];
}

export interface Schedule {
  id: string;
  day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
  startTime: string;
  endTime: string;
}

// Enrollment Types
export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  sectionId: string;
  status: "active" | "completed" | "dropped";
  enrolledAt: Date;
  grade?: string;
  gradePoints?: number;
}

// Assignment Types
export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  maxMarks: number;
  dueDate: Date;
  createdAt: Date;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submissionUrl?: string;
  submissionText?: string;
  submittedAt?: Date;
  marks?: number;
  feedback?: string;
}

// Grade Types
export interface Grade {
  id: string;
  studentId: string;
  courseId: string;
  assignmentId?: string;
  examId?: string;
  marks: number;
  maxMarks: number;
  weightage: number;
  createdAt: Date;
}

// Attendance Types
export interface Attendance {
  id: string;
  studentId: string;
  courseId: string;
  date: Date;
  status: "present" | "absent" | "late" | "excused";
  markedBy: string;
}

// Fee Types
export interface Fee {
  id: string;
  studentId: string;
  type: "tuition" | "hostel" | "transport" | "library" | "other";
  amount: number;
  dueDate: Date;
  status: "pending" | "paid" | "overdue";
  paidAt?: Date;
  paymentMethod?: string;
}

// Announcement Types
export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  departmentId?: string;
  targetRoles: UserRole[];
  priority: "low" | "medium" | "high";
  createdAt: Date;
  expiresAt?: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Dashboard Stats
export interface DashboardStats {
  totalStudents: number;
  totalProfessors: number;
  totalCourses: number;
  totalEnrollments: number;
  pendingAssignments: number;
  averageGPA: number;
  attendanceRate: number;
}
