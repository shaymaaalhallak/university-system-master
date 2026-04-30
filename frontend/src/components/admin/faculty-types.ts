export type FacultyRow = {
  user_id: number;
  professor_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department_id: number | null;
  department_name: string | null;
  title: string | null;
  hire_date: string | null;
};

export type FacultyMeta = {
  departments: Array<{ department_id: number; department_name: string }>;
  programs: Array<{
    program_id: number;
    program_name: string;
    department_id: number | null;
  }>;
  titles: Array<{ title: string }>;
  stats: { totalProfessors: number };
};

export type FacultyFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  departmentId: string;
  degreeProgramId: string;
  title: string;
  hireDate: string;
};
