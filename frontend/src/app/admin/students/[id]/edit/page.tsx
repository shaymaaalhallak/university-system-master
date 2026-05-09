"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import StudentForm from "@/components/admin/StudentForm";
import {
  StudentFormValues,
  StudentMeta,
} from "@/components/admin/student-types";
import DashboardLayout from "@/components/DashboardLayout";
type ApiResponse<T> = { success: boolean; data: T; message?: string };

type StudentDetail = {
  profile: {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    department_id: number | null;
    program_id: number | null;
    enrollment_year: number | null;
    semester: number | null;
  };
};

export default function EditStudentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [meta, setMeta] = useState<StudentMeta | null>(null);
  const [form, setForm] = useState<StudentFormValues>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    departmentId: "",
    programId: "",
    enrollmentYear: "",
    semester: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") router.push("/login");
  }, [isLoading, router, user]);

  useEffect(() => {
    if (user?.role !== "admin") return;

    Promise.all([
      api.get<ApiResponse<StudentMeta>>("/users/students/meta"),
      api.get<ApiResponse<StudentDetail>>(`/users/students/${params.id}`),
    ])
      .then(([metaRes, detailRes]) => {
        if (metaRes.success) setMeta(metaRes.data);
        if (detailRes.success) {
          const p = detailRes.data.profile;
          setForm({
            firstName: p.first_name,
            lastName: p.last_name,
            email: p.email,
            password: "",
            phone: p.phone || "",
            departmentId: p.department_id ? String(p.department_id) : "",
            programId: p.program_id ? String(p.program_id) : "",
            enrollmentYear: p.enrollment_year ? String(p.enrollment_year) : "",
            semester: p.semester ? String(p.semester) : "",
          });
        }
      })
      .catch((err: any) => {
        setError(
          err?.response?.data?.message || "Failed to load student for edit",
        );
      });
  }, [params.id, user?.role]);

  const saveStudent = async () => {
    setSaving(true);
    try {
      await api.put(`/users/students/${params.id}`, {
        ...form,
        departmentId: form.departmentId || null,
        programId: form.programId || null,
      });
      router.push(`/admin/students/${params.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 bg-[#FCFBF8] text-black p-3 rounded-xl">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Edit Student Page
          </h1>
          <Link href={`/admin/students/${params.id}`} className="text-black">
            ← Back to details
          </Link>
        </div>
        {error && (
          <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-700">
            {error}
          </div>
        )}

        <StudentForm
          value={form}
          meta={meta}
          onChange={setForm}
          onSubmit={saveStudent}
          submitLabel="Update Student"
          includePassword={false}
          loading={saving}
        />
      </div>
    </DashboardLayout>
  );
}
