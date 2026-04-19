export type StudentRow = {
  user_id: number;
  student_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: "active" | "blocked";
  department_name: string | null;
  program_name: string | null;
  semester: number | null;
  enrollment_year: number | null;
  gpa: number | null;
};

export type DepartmentOption = {
  department_id: number;
  department_name: string;
};

export type ProgramOption = {
  program_id: number;
  program_name: string;
  department_id: number;
};

export type StudentMeta = {
  departments: DepartmentOption[];
  programs: ProgramOption[];
  stats: {
    totalStudents: number;
    activeStudents: number;
    blockedStudents: number;
    unpaidStudents: number;
  };
};

export type StudentFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  departmentId: string;
  programId: string;
  enrollmentYear: string;
  semester: string;
};
