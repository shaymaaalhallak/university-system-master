"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Lock, Unlock, Filter, Clock } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
type Program = {
  program_id: number;
  program_name: string;
  department_id: number;
};

type GradeEntryRow = {
  section_id: number;
  course_code: string;
  course_title: string;
  semester: number;
  year: number;
  prof_first: string;
  prof_last: string;
  program_name: string | null;
  is_enabled: number;
  entry_mode: "exam" | "assignment" | null;
  close_at: string | null;
  updated_at: string | null;
};

export default function AdminGradingControlPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [rows, setRows] = useState<GradeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Open All modal state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openEntryMode, setOpenEntryMode] = useState<"exam" | "assignment">(
    "exam",
  );
  const [openCloseAt, setOpenCloseAt] = useState("");

  const loadRows = async (programId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = programId
        ? `/admin/grade-entry?programId=${programId}`
        : "/admin/grade-entry";
      const response = await api.get<{
        success: boolean;
        data: GradeEntryRow[];
      }>(url);
      if (!response.success) throw new Error("Failed to load grading control");
      setRows(response.data ?? []);
    } catch (err) {
      console.error(err);
      setError("Unable to load grading control right now.");
    } finally {
      setLoading(false);
    }
  };

  const loadPrograms = async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: { programs: Program[] };
      }>("/courses/study-plans/meta");
      if (response.success) {
        setPrograms(response.data?.programs ?? []);
      }
    } catch {
      // programs table might not exist
    }
  };

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      loadRows();
      loadPrograms();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "admin") {
      loadRows(selectedProgramId || undefined);
    }
  }, [selectedProgramId]);

  const handleOpenAll = async () => {
    const sectionIds = rows.map((r) => r.section_id);
    if (sectionIds.length === 0) return;
    try {
      setSaving(true);
      setError(null);
      const closeAt =
        openEntryMode === "assignment"
          ? new Date(2026, 6, 1).toISOString() // end of semester
          : openCloseAt
            ? new Date(openCloseAt).toISOString()
            : null;
      await api.post("/admin/grade-entry/bulk", {
        sectionIds,
        action: "enable",
        entry_mode: openEntryMode,
        close_at: closeAt,
      });
      setShowOpenModal(false);
      setOpenCloseAt("");
      await loadRows();
    } catch {
      setError("Unable to open grade booking.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseAll = async () => {
    const sectionIds = rows.map((r) => r.section_id);
    if (sectionIds.length === 0) return;
    if (
      !confirm("Are you sure you want to close grade booking for ALL sections?")
    )
      return;
    try {
      setSaving(true);
      setError(null);
      await api.post("/admin/grade-entry/bulk", {
        sectionIds,
        action: "disable",
      });
      await loadRows();
    } catch {
      setError("Unable to close grade booking.");
    } finally {
      setSaving(false);
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
    <DashboardLayout>
      <div className="space-y-6 text-black bg-white">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Grade Booking Control
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Open or close grade booking for all sections at once. Professors can
            enter grades only when booking is open.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-gray-500" />
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All Programs</option>
              {programs.map((program) => (
                <option key={program.program_id} value={program.program_id}>
                  {program.program_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={() => setShowOpenModal(true)}
              disabled={saving || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <Unlock size={16} />
              {saving ? "Saving..." : "Open All"}
            </button>
            <button
              type="button"
              onClick={handleCloseAll}
              disabled={saving || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <Lock size={16} />
              {saving ? "Saving..." : "Close All"}
            </button>
          </div>
        </div>

        {/* Open All Modal */}
        {showOpenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-bold text-gray-900">
                Open Grade Booking for All Sections
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Choose entry mode and set an optional close time.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Entry Mode
                  </label>
                  <select
                    value={openEntryMode}
                    onChange={(e) =>
                      setOpenEntryMode(e.target.value as "exam" | "assignment")
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="exam">Exam</option>
                    <option value="assignment">Assignment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {openEntryMode === "exam"
                      ? "Close At (date & time)"
                      : "Close At"}
                  </label>
                  {openEntryMode === "exam" ? (
                    <input
                      type="datetime-local"
                      value={openCloseAt}
                      onChange={(e) => setOpenCloseAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-gray-600">
                      Auto-closes at end of semester
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowOpenModal(false);
                    setOpenCloseAt("");
                  }}
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOpenAll}
                  disabled={
                    saving || (openEntryMode === "exam" && !openCloseAt)
                  }
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? "Opening..." : "Open All"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-white p-4 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="px-3 py-2">Course</th>
                <th className="px-3 py-2">Program</th>
                <th className="px-3 py-2">Section</th>
                <th className="px-3 py-2">Professor</th>
                <th className="px-3 py-2">Term</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Closes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOpen = !!row.is_enabled;

                return (
                  <tr key={row.section_id} className="border-b last:border-0">
                    <td className="px-3 py-3">
                      {row.course_code} - {row.course_title}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {row.program_name ?? "-"}
                    </td>
                    <td className="px-3 py-3">{row.section_id}</td>
                    <td className="px-3 py-3">
                      {row.prof_first} {row.prof_last}
                    </td>
                    <td className="px-3 py-3">
                      Semester {row.semester}, {row.year}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-medium uppercase text-gray-600">
                        {row.entry_mode ?? "-"}
                      </span>
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
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {row.close_at
                        ? new Date(row.close_at).toLocaleString()
                        : "-"}
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
    </DashboardLayout>
  );
}
