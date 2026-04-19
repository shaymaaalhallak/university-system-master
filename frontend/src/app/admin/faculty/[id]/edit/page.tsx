"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import FacultyForm from "@/components/admin/FacultyForm";
import {
  FacultyFormValues,
  FacultyMeta,
} from "@/components/admin/faculty-types";

type ApiResponse<T> = { success: boolean; data: T; message?: string };

type ProfessorDetails = {
  profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    department_id: number | null;
    title: string | null;
    hire_date: string | null;
  };
};

export default function EditFacultyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [meta, setMeta] = useState<FacultyMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FacultyFormValues>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    departmentId: "",
    title: "Professor",
    hireDate: "",
  });

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") router.push("/login");
  }, [isLoading, router, user]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    Promise.all([
      api.get<ApiResponse<FacultyMeta>>("/users/professors/meta"),
      api.get<ApiResponse<ProfessorDetails>>(`/users/professors/${id}`),
    ]).then(([metaRes, detailRes]) => {
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
          title: p.title || "Professor",
          hireDate: p.hire_date ? p.hire_date.slice(0, 10) : "",
        });
      }
    });
  }, [id, user?.role]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/users/professors/${id}`, {
        ...form,
        departmentId: form.departmentId || null,
      });
      router.push(`/admin/faculty/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 bg-[#FCFBF8] text-black p-3 rounded-xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Edit Professor Page
        </h1>
        <Link href={`/admin/faculty/${id}`} className="text-black">
          ← Back to details
        </Link>
      </div>
      <FacultyForm
        value={form}
        meta={meta}
        onChange={setForm}
        onSubmit={save}
        submitLabel="Update Professor"
        includePassword={false}
        loading={saving}
      />
    </div>
  );
}
