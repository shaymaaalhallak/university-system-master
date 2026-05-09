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
  department_name: string | null;
  program_name: string | null;
};

export default function ManageCoursesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState("");

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
                    onClick={async () => {
                      const requiredCourseId = prompt("Prerequisite course ID");
                      if (!requiredCourseId) return;
                      await api.post(`/courses/${c.course_id}/prerequisites`, {
                        requiredCourseId,
                      });
                      alert("Prerequisite added");
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
    </DashboardLayout>
  );
}
