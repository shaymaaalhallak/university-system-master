"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Lock, Unlock } from "lucide-react";

type GradeEntryRow = {
  section_id: number;
  course_code: string;
  course_title: string;
  semester: number;
  year: number;
  prof_first: string;
  prof_last: string;
  is_enabled: number;
  updated_at: string | null;
};

export default function AdminGradingControlPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [rows, setRows] = useState<GradeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSectionId, setSavingSectionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        data: GradeEntryRow[];
      }>("/admin/grade-entry");
      if (!response.success) throw new Error("Failed to load grading control");
      setRows(response.data ?? []);
    } catch (err) {
      console.error(err);
      setError("Unable to load grading control right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      loadRows();
    }
  }, [user]);

  const setGradeEntry = async (sectionId: number, enabled: boolean) => {
    try {
      setSavingSectionId(sectionId);
      setError(null);
      await api.post(
        `/admin/grade-entry/${sectionId}/${enabled ? "enable" : "disable"}`,
      );
      await loadRows();
    } catch (err) {
      console.error(err);
      setError("Unable to update grade booking status.");
    } finally {
      setSavingSectionId(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="p-6">Access denied. This page is for admins only.</div>
    );
  }

  return (
    <div className="space-y-6 text-black bg-white">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Grade Booking Control
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Admin can open or close grade booking per section. Professors can
          enter grades only when booking is open.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-xl border bg-white p-4 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Section</th>
              <th className="px-3 py-2">Professor</th>
              <th className="px-3 py-2">Term</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = !!row.is_enabled;
              const isSaving = savingSectionId === row.section_id;

              return (
                <tr key={row.section_id} className="border-b last:border-0">
                  <td className="px-3 py-3">
                    {row.course_code} - {row.course_title}
                  </td>
                  <td className="px-3 py-3">{row.section_id}</td>
                  <td className="px-3 py-3">
                    {row.prof_first} {row.prof_last}
                  </td>
                  <td className="px-3 py-3">
                    Semester {row.semester}, {row.year}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        isOpen
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {isOpen ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setGradeEntry(row.section_id, !isOpen)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 disabled:opacity-60"
                    >
                      {isOpen ? <Lock size={16} /> : <Unlock size={16} />}
                      {isSaving ? "Saving..." : isOpen ? "Close" : "Open"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!rows.length && (
          <p className="p-4 text-sm text-gray-500">No sections found.</p>
        )}
      </div>
    </div>
  );
}
