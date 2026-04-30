"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import FacultyForm from "@/components/admin/FacultyForm";
import {
  FacultyFormValues,
  FacultyMeta,
} from "@/components/admin/faculty-types";

type ApiResponse<T> = { success: boolean; data: T; message?: string };

const initial: FacultyFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  departmentId: "",
  degreeProgramId: "",
  title: "Professor",
  hireDate: new Date().toISOString().slice(0, 10),
};

export default function CreateFacultyPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [meta, setMeta] = useState<FacultyMeta | null>(null);
  const [form, setForm] = useState<FacultyFormValues>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") router.push("/login");
  }, [isLoading, router, user]);

  useEffect(() => {
    if (user?.role === "admin") {
      api
        .get<ApiResponse<FacultyMeta>>("/users/professors/meta")
        .then((res) => {
          if (res.success) setMeta(res.data);
        });
    }
  }, [user?.role]);

  const createProfessor = async () => {
    if (!form.firstName || !form.lastName || !form.degreeProgramId)
      return alert(
        "Please complete required fields (including degree program)",
      );
    setSaving(true);
    try {
      const res = await api.post<ApiResponse<{ userId: number }>>(
        "/users/professors",
        {
          ...form,
          departmentId: form.departmentId || null,
        },
      );
      if (res.success) {
        const credentials = res.data as any;
        alert(
          `Professor created.\nEmail: ${credentials.generatedEmail}\nPassword: ${credentials.generatedPassword}\n\nShare these credentials securely. Professor will be forced to change password on first login.`,
        );
        router.push(`/admin/faculty/${res.data.userId}`);
      }
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to create professor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 bg-[#FCFBF8] text-black p-3 rounded-xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Add Professor Page</h1>
        <Link href="/admin/faculty" className="text-black">
          ← Back to list
        </Link>
      </div>
      <FacultyForm
        value={form}
        meta={meta}
        onChange={setForm}
        onSubmit={createProfessor}
        submitLabel="Create Professor"
        includePassword
        autoGenerateCredentials
        loading={saving}
      />
    </div>
  );
}
