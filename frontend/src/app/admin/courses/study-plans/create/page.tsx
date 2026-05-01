"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export default function CreateStudyPlanPage() {
  const router = useRouter();
  const [planName, setPlanName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [meta, setMeta] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<ApiResponse<any>>("/users/students/meta")
      .then((res) => {
        if (res.success) setMeta(res.data);
      })
      .catch((err: any) => {
        setError(
          err?.response?.data?.message ||
            "Unable to load departments/programs metadata.",
        );
      });
  }, []);

  const programs = useMemo(() => {
    const all = meta?.programs || [];
    if (!departmentId) return all;
    return all.filter((p: any) => String(p.department_id) === departmentId);
  }, [meta?.programs, departmentId]);

  const createPlan = async () => {
    setError("");
    if (!planName.trim()) {
      setError("Plan name is required.");
      return;
    }

    try {
      setSaving(true);
      const res = await api.post<ApiResponse<{ planId: number }>>(
        "/courses/study-plans",
        {
          planName: planName.trim(),
          departmentId: departmentId || null,
          programId: programId || null,
        },
      );
      if (res.success)
        router.push(`/admin/courses/study-plans/${res.data.planId}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to create study plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 bg-[#FCFBF8] p-3 rounded-xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Study Plan</h1>
        <Link href="/admin/courses" className="text-black">
          ← Back to Study Plan
        </Link>
      </div>

      <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-6 space-y-3 max-w-2xl">
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full"
          placeholder="Plan name (e.g. BS Computer Science 2026)"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
        />
        <select
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full"
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setProgramId("");
          }}
        >
          <option value="">Department (optional)</option>
          {(meta?.departments || []).map((d: any) => (
            <option key={d.department_id} value={d.department_id}>
              {d.department_name}
            </option>
          ))}
        </select>

        <select
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
        >
          <option value="">Program / Specialization (optional)</option>
          {programs.map((p: any) => (
            <option key={p.program_id} value={p.program_id}>
              {p.program_name}
            </option>
          ))}
        </select>

        <p className="text-xs text-gray-600">
          Keep Program empty for common/shared plans (e.g. English, Arabic,
          Culture) within this department.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={createPlan}
            disabled={saving}
            className="bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#631F2F] disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Study Plan"}
          </button>
          <Link
            href="/admin/courses/study-plans"
            className="px-4 py-2 rounded-lg border border-[#DED7CB] bg-white hover:bg-[#F2EBDD]"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
