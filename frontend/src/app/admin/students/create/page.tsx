"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import StudentForm from "@/components/admin/StudentForm";
import {
  StudentFormValues,
  StudentMeta,
} from "@/components/admin/student-types";
import DashboardLayout from "@/components/DashboardLayout";
type ApiResponse<T> = { success: boolean; data: T; message?: string };

const initialState: StudentFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  departmentId: "",
  programId: "",
  enrollmentYear: String(new Date().getFullYear()),
  semester: "1",
};

export default function CreateStudentPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [meta, setMeta] = useState<StudentMeta | null>(null);
  const [form, setForm] = useState<StudentFormValues>(initialState);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") router.push("/login");
  }, [isLoading, router, user]);

  useEffect(() => {
    if (user?.role === "admin") {
      api.get<ApiResponse<StudentMeta>>("/users/students/meta").then((res) => {
        if (res.success) setMeta(res.data);
      });
    }
  }, [user?.role]);

  const createStudent = async () => {
    if (!form.firstName || !form.lastName) {
      alert("Please fill required fields");
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<any>("/users/students", {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || null,
        departmentId: form.departmentId || null,
        programId: form.programId || null,
        enrollmentYear: form.enrollmentYear ? Number(form.enrollmentYear) : null,
        semester: form.semester ? Number(form.semester) : null,
      });
      if (res.success) {
        const creds = res.data;
        if (creds.generatedPassword) {
          alert(
            `Student created.\nEmail: ${creds.generatedEmail}\nPassword: ${creds.generatedPassword}\n\nShare these credentials securely. Student will be forced to change password on first login.`,
          );
        }
        router.push(`/admin/students/${creds.userId}`);
      }
    } catch (error: any) {
      const response = error?.response?.data;
      const validationErrors = Array.isArray(response?.errors)
        ? response.errors
            .map((e: { msg?: string }) => e.msg)
            .filter(Boolean)
            .join(", ")
        : "";
      alert(
        response?.message || validationErrors || "Failed to create student",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 bg-[#FCFBF8] text-black p-3 rounded-xl">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Add Student Page</h1>
          <Link href="/admin/students" className="text-black">
            ← Back to list
          </Link>
        </div>

        <StudentForm
          value={form}
          meta={meta}
          onChange={setForm}
          onSubmit={createStudent}
          submitLabel="Create Student"
          loading={saving}
        />
      </div>
    </DashboardLayout>
  );
}
