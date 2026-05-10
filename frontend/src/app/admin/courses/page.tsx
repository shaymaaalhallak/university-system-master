"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
type ApiResponse<T> = { success: boolean; data: T; message?: string };

type Course = {
  course_id: number;
  course_code: string;
  course_title: string;
  credits: number;
  department_id: number | null;
  program_id: number | null;
  department_name: string | null;
  program_name: string | null;
};

export default function ManageCoursesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");
  const [prereqCourse, setPrereqCourse] = useState<Course | null>(null);
  const [showPrereqModal, setShowPrereqModal] = useState(false);
  const [selectedPrereqId, setSelectedPrereqId] = useState("");

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") router.push("/login");
  }, [isLoading, router, user]);

  const loadCourses = async () => {
    const res = await api.get<ApiResponse<Course[]>>("/courses");
    if (res.success) setCourses(res.data);
  };

  useEffect(() => {
    if (user?.role === "admin") loadCourses();
  }, [user?.role]);

  const filtered = courses.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.course_code.toLowerCase().includes(q) ||
      c.course_title.toLowerCase().includes(q)
    );
  });

  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <DashboardLayout>
    <div className="space-y-4 bg-[#FCFBF8] p-3 rounded-xl">
      <div className="flex items-center gap-2 border-b border-[#E7E2D9] pb-2">
        <button className="px-3 py-2 rounded-lg bg-[#7A263A] text-white">
          Courses
        </button>
        <Link
          href="/admin/courses/study-plans"
          className="px-3 py-2 rounded-lg border border-[#DED7CB] bg-white hover:bg-[#F2EBDD]"
        >
          Study Plans
        </Link>
      </div>

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Courses List</h1>
        <Link
          href="/admin/courses/create"
          className="bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#631F2F]"
        >
          + Add Course
        </Link>
      </div>

      <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-4">
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full md:w-80"
          placeholder="Search courses"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F1EFEA]">
            <tr>
              {[
                "Code",
                "Title",
                "Credits",
                "Department",
                "Program",
                "Actions",
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.course_id} className="border-t">
                <td className="px-4 py-3">{c.course_code}</td>
                <td className="px-4 py-3">{c.course_title}</td>
                <td className="px-4 py-3">{c.credits}</td>
                <td className="px-4 py-3">{c.department_name || "-"}</td>
                <td className="px-4 py-3">{c.program_name || "Common"}</td>
                <td className="px-4 py-3 flex gap-3">
                  <Link
                    className="text-black"
                    href={`/admin/courses/${c.course_id}/edit`}
                  >
                    ✏️ Edit
                  </Link>
                  <Link
                    className="text-black"
                    href={`/admin/courses/${c.course_id}`}
                  >
                    📘 Study Plan Usage
                  </Link>
                  <button
                    className="text-black"
                    onClick={() => {
                      setPrereqCourse(c);
                      setSelectedPrereqId("");
                      setShowPrereqModal(true);
                    }}
                  >
                    🔗 Prerequisites
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No courses found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
      {/* Prerequisite Modal */}
      {showPrereqModal && prereqCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPrereqModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Add Prerequisite for <span className="text-[#7A263A]">{prereqCourse.course_code}</span>
            </h3>
            <p className="text-sm text-gray-500 mb-4">Select a course that must be completed before {prereqCourse.course_code}.</p>
            <select
              value={selectedPrereqId}
              onChange={(e) => setSelectedPrereqId(e.target.value)}
              className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm mb-4"
            >
              <option value="">Choose a prerequisite course...</option>
              {courses
                .filter((c) => c.course_id !== prereqCourse.course_id)
                .filter((c) => !prereqCourse.program_id || c.program_id === prereqCourse.program_id || !c.program_id)
                .map((c) => (
                  <option key={c.course_id} value={c.course_id}>
                    {c.course_code} — {c.course_title}{c.program_name ? ` (${c.program_name})` : " (Common)"}
                  </option>
                ))}
            </select>
            {courses.filter((c) => c.course_id !== prereqCourse.course_id).filter((c) => !prereqCourse.program_id || c.program_id === prereqCourse.program_id || !c.program_id).length === 0 && (
              <p className="text-sm text-gray-500 mb-4">No courses available in the same program.</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowPrereqModal(false)} className="flex-1 px-4 py-2 border border-[#DED7CB] rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={async () => {
                  if (!selectedPrereqId) return;
                  await api.post(`/courses/${prereqCourse.course_id}/prerequisites`, { requiredCourseId: selectedPrereqId });
                  setShowPrereqModal(false);
                  setSelectedPrereqId("");
                  alert("Prerequisite added");
                }}
                disabled={!selectedPrereqId}
                className="flex-1 px-4 py-2 bg-[#7A263A] text-white rounded-lg text-sm hover:bg-[#6A1F31] disabled:opacity-50"
              >
                Add Prerequisite
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
