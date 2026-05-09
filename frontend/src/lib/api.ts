import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import Cookies from "js-cookie";

// Default to backend directly for local development reliability.
// You can still override via NEXT_PUBLIC_API_URL (e.g. use "/api" when proxying through Next).
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";
const DIRECT_API_FALLBACK_URL = "http://127.0.0.1:5000/api";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor for adding auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = Cookies.get("token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor for handling errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalConfig = error.config as AxiosRequestConfig & {
          _retriedWithDirectApi?: boolean;
          baseURL?: string;
        };

        if (
          (error.response?.status === 503 || error.response?.status === 404) &&
          originalConfig &&
          !originalConfig._retriedWithDirectApi &&
          originalConfig.baseURL === "/api"
        ) {
          originalConfig._retriedWithDirectApi = true;
          originalConfig.baseURL = DIRECT_API_FALLBACK_URL;
          return this.client.request(originalConfig);
        }
        if (error.response?.status === 401) {
          Cookies.remove("token");
          Cookies.remove("refreshToken");
          window.location.href = "/login";
        }
        return Promise.reject(error);
      },
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const finalConfig = { ...(config ?? {}) };
    if (typeof FormData !== "undefined" && data instanceof FormData) {
      finalConfig.headers = {
        ...(finalConfig.headers ?? {}),
        "Content-Type": "multipart/form-data",
      };
    }
    const response: AxiosResponse<T> = await this.client.post(
      url,
      data,
      finalConfig,
    );
    return response.data;
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const finalConfig = { ...(config ?? {}) };
    if (typeof FormData !== "undefined" && data instanceof FormData) {
      finalConfig.headers = {
        ...(finalConfig.headers ?? {}),
        "Content-Type": "multipart/form-data",
      };
    }
    const response: AxiosResponse<T> = await this.client.put(
      url,
      data,
      finalConfig,
    );
    return response.data;
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const finalConfig = { ...(config ?? {}) };
    if (typeof FormData !== "undefined" && data instanceof FormData) {
      finalConfig.headers = {
        ...(finalConfig.headers ?? {}),
        "Content-Type": "multipart/form-data",
      };
    }
    const response: AxiosResponse<T> = await this.client.patch(
      url,
      data,
      finalConfig,
    );
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }
}

export const api = new ApiClient();

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),

  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
  }) => api.post("/auth/register", data),

  logout: () => api.post("/auth/logout"),

  getCurrentUser: () => api.get("/auth/me"),

  refreshToken: () => api.post("/auth/refresh"),

  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    api.post("/auth/reset-password", { token, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post("/auth/change-password", { currentPassword, newPassword }),
};

// Users API
export const usersApi = {
  getStudents: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get("/users/students", { params }),

  getProfessors: (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) => api.get("/users/professors", { params }),

  getUserById: (id: string) => api.get(`/users/${id}`),

  updateUser: (id: string, data: unknown) => api.put(`/users/${id}`, data),

  deleteUser: (id: string) => api.delete(`/users/${id}`),
};

// Courses API
export const coursesApi = {
  getCourses: (params?: {
    page?: number;
    limit?: number;
    departmentId?: string;
    semester?: number;
  }) => api.get("/courses", { params }),

  getCourseById: (id: string) => api.get(`/courses/${id}`),

  createCourse: (data: unknown) => api.post("/courses", data),

  updateCourse: (id: string, data: unknown) => api.put(`/courses/${id}`, data),

  deleteCourse: (id: string) => api.delete(`/courses/${id}`),

  enrollCourse: (courseId: string, sectionId: string) =>
    api.post(`/courses/${courseId}/enroll`, { sectionId }),

  dropCourse: (courseId: string) => api.post(`/courses/${courseId}/drop`),
};

// Enrollments API
export const enrollmentsApi = {
  getEnrollments: (params?: {
    studentId?: string;
    courseId?: string;
    status?: string;
  }) => api.get("/enrollments", { params }),

  getMyEnrollments: () => api.get("/enrollments/my"),

  registerForCourse: (courseId: string, sectionId: string) =>
    api.post("/enrollments", { courseId, sectionId }),

  dropEnrollment: (id: string) => api.delete(`/enrollments/${id}`),
};

// Assignments API
export const assignmentsApi = {
  getAssignments: (params?: { sectionId?: string; studentId?: string }) =>
    api.get("/assignments", { params }),

  getAssignmentById: (id: string) => api.get(`/assignments/${id}`),

  createAssignment: (data: unknown) => api.post("/assignments", data),

  updateAssignment: (id: string, data: unknown) =>
    api.put(`/assignments/${id}`, data),

  deleteAssignment: (id: string) => api.delete(`/assignments/${id}`),

  submitAssignment: (assignmentId: string, data: { fileUrl?: string }) =>
    api.post(`/assignments/${assignmentId}/submit`, data),

  gradeSubmission: (
    submissionId: string,
    data: { score: number; feedback: string },
  ) => api.post(`/assignments/submissions/${submissionId}/grade`, data),

  getMyAssignments: () => api.get("/assignments/my"),

  getSectionAssignmentSubmissions: (sectionId: string) =>
    api.get(`/assignments/section/${sectionId}/submissions`),
};

// Grades API
export const gradesApi = {
  getGrades: (params?: { studentId?: string; sectionId?: string }) =>
    api.get("/grades", { params }),

  getMyGrades: () => api.get("/grades/my"),

  getGradeById: (id: string) => api.get(`/grades/${id}`),

  calculateGPA: (studentId: string) => api.get(`/grades/${studentId}/gpa`),

  getSectionGradeSetup: (sectionId: string) =>
    api.get(`/grades/section/${sectionId}/setup`),

  saveSectionGradeSetup: (
    sectionId: string,
    data: {
      components: Array<{
        name: string;
        weight: number;
        order?: number;
      }>;
    },
  ) => api.put(`/grades/section/${sectionId}/setup`, data),

  saveStudentGrade: (data: {
    studentId: number;
    sectionId: number;
    componentScores: Array<{
      componentId: number;
      score: number;
    }>;
  }) => api.post("/grades", data),
};

// Attendance API
export const attendanceApi = {
  getAttendance: (params?: {
    studentId?: string;
    sectionId?: string;
    date?: string;
  }) => api.get("/attendance", { params }),

  getMyAttendance: (params?: { sectionId?: string }) =>
    api.get("/attendance/my", { params }),

  markAttendance: (data: {
    sectionId: string;
    date: string;
    records: Array<{
      studentId: string;
      status: string;
    }>;
  }) => api.post("/attendance", data),

  getAttendanceReport: (sectionId: string) =>
    api.get(`/attendance/course/${sectionId}/report`),

  getSectionStudents: (sectionId: string) =>
    api.get(`/attendance/section/${sectionId}/students`),
};

// Departments API
export const departmentsApi = {
  getDepartments: () => api.get("/departments"),

  getDepartmentById: (id: string) => api.get(`/departments/${id}`),

  createDepartment: (data: unknown) => api.post("/departments", data),

  updateDepartment: (id: string, data: unknown) =>
    api.put(`/departments/${id}`, data),

  deleteDepartment: (id: string) => api.delete(`/departments/${id}`),
};

// Fees API
export const feesApi = {
  // Legacy
  getFees: (params?: { studentId?: string; status?: string }) =>
    api.get("/fees", { params }),
  payFee: (feeId: string, paymentMethod: string) =>
    api.post(`/fees/${feeId}/pay`, { paymentMethod }),
  getFeeStructure: () => api.get("/fees/structure"),

  // Program Fee Configuration
  getFeeConfig: () => api.get("/fees/config"),
  saveFeeConfig: (data: { program_id: number; price_per_credit: number; effective_from?: string; effective_to?: string }) =>
    api.post("/fees/config", data),
  deleteFeeConfig: (id: number) => api.delete(`/fees/config/${id}`),

  // Invoices
  getInvoices: (params?: { studentId?: number; semester?: string; year?: number; status?: string }) =>
    api.get("/fees/invoices", { params }),
  getMyInvoices: () => api.get("/fees/invoices/my"),
  generateInvoices: (data: { semester: string; year: number; studentId?: number }) =>
    api.post("/fees/invoices/generate", data),
  updateInvoice: (id: number, data: { status: string }) =>
    api.put(`/fees/invoices/${id}`, data),

  // Payments
  getPayments: (params?: { studentId?: number; invoiceId?: number; status?: string }) =>
    api.get("/fees/payments", { params }),
  getMyPayments: () => api.get("/fees/payments/my"),
  recordPayment: (data: { invoice_id: number; student_id: number; amount: number; payment_method?: string; transaction_reference?: string; admin_notes?: string }) =>
    api.post("/fees/payments", data),
  verifyPayment: (id: number) => api.put(`/fees/payments/${id}/verify`),

  // Discounts
  getDiscounts: () => api.get("/fees/discounts"),
  createDiscount: (data: { student_id: number; type: string; value: number; reason?: string; semester: string; year: number }) =>
    api.post("/fees/discounts", data),
  deleteDiscount: (id: number) => api.delete(`/fees/discounts/${id}`),

  // Penalties
  getPenalties: () => api.get("/fees/penalties"),
  createPenalty: (data: { student_id: number; amount: number; reason?: string; semester: string; year: number }) =>
    api.post("/fees/penalties", data),
  deletePenalty: (id: number) => api.delete(`/fees/penalties/${id}`),

  // Student Fee Dashboard
  getMyFeeDashboard: () => api.get("/fees/dashboard"),
};

// Announcements API
export const announcementsApi = {
  getAnnouncements: (params?: { departmentId?: string; priority?: string }) =>
    api.get("/announcements", { params }),

  getAnnouncementById: (id: string) => api.get(`/announcements/${id}`),

  createAnnouncement: (data: unknown) => api.post("/announcements", data),

  updateAnnouncement: (id: string, data: unknown) =>
    api.put(`/announcements/${id}`, data),

  deleteAnnouncement: (id: string) => api.delete(`/announcements/${id}`),
};

// Dashboard API
export const dashboardApi = {
  getStudentDashboard: () => api.get("/dashboard/student"),

  getProfessorDashboard: () => api.get("/dashboard/professor"),

  getAdminDashboard: () => api.get("/dashboard/admin"),
};

// Professor API
export const professorApi = {
  getMySections: () => api.get("/professor/my-sections"),

  getMyCv: () => api.get("/professor/cv"),

  updateMyCv: (data: { cvUrl: string }) => api.put("/professor/cv", data),
  updateMyCvFile: (data: FormData) => api.put("/professor/cv", data),
};

export default api;
