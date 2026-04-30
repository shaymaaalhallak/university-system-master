"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type ApiResponse<T> = { success: boolean; data: T; message?: string };

type Course = {
  course_id: number;
  course_code: string;
  course_title: string;
  credits: number;
  program_id?: number | null;
  department_name?: string | null;
  program_name?: string | null;
};

export default function AddCourseToPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [yearNo, setYearNo] = useState("1");
  const [semesterNo, setSemesterNo] = useState("1");
  const [isRequired, setIsRequired] = useState(true);
  const [courseBucket, setCourseBucket] = useState("major");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<ApiResponse<any>>(`/courses/study-plans/${id}`),
      api.get<ApiResponse<Course[]>>("/courses"),
    ]).then(([planRes, coursesRes]) => {
      if (planRes.success) setPlan(planRes.data);
      if (coursesRes.success) setCourses(coursesRes.data);
    });
  }, [id]);

  const usedCourseIds = useMemo(
    () =>
      new Set<number>(
        (plan?.items || []).map((item: any) => Number(item.course_id)),
      ),
    [plan?.items],
  );

  const availableCourses = useMemo(() => {
    const q = search.toLowerCase();
    return courses.filter((course) => {
      if (usedCourseIds.has(course.course_id)) return false;
      const sameProgram =
        !plan?.program_id ||
        !course.program_name ||
        Number(course.program_id || 0) === Number(plan.program_id);
      if (!sameProgram && Number(course.program_id || 0) !== 0) return false;
      if (!q) return true;
      return (
        course.course_code.toLowerCase().includes(q) ||
        course.course_title.toLowerCase().includes(q)
      );
    });
  }, [courses, search, usedCourseIds]);

  const addCourse = async () => {
    setError("");
    if (!selectedCourseId) {
      setError("Please choose a course from the table.");
      return;
    }

    try {
      setSaving(true);
      await api.post(`/courses/study-plans/${id}/courses`, {
        courseId: selectedCourseId,
        yearNo: Number(yearNo || "1"),
        semesterNo: Number(semesterNo || "1"),
        isRequired,
        courseBucket,
      });
      router.push(`/admin/courses/study-plans/${id}`);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "Failed to add course to study plan.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 bg-[#FCFBF8] p-3 rounded-xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Assign Course to Study Plan</h1>
          <p className="text-gray-600">{plan?.plan_name || "Loading..."}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/courses/create?returnTo=${encodeURIComponent(`/admin/courses/study-plans/${id}/add-course`)}`}
            className="px-3 py-2 rounded-lg border border-[#DED7CB] bg-white hover:bg-[#F2EBDD]"
          >
            + Create New Course
          </Link>
          <Link
            href={`/admin/courses/study-plans/${id}`}
            className="text-black"
          >
            ← Back to plan
          </Link>
        </div>
      </div>

      <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-4 space-y-3">
        <p className="text-sm text-gray-600">
          This page assigns an existing course to the selected study plan. To
          create a brand new course, use
          <span className="font-medium"> + Create New Course</span> first, then
          come back and assign it here.
        </p>
        <p className="text-sm text-gray-600">
          Step 1: select a course from the table. Step 2: choose year/semester
          and save.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="border border-[#DED7CB] bg-white rounded-lg p-2"
            placeholder="Year number"
            type="number"
            min={1}
            value={yearNo}
            onChange={(e) => setYearNo(e.target.value)}
          />
          <input
            className="border border-[#DED7CB] bg-white rounded-lg p-2"
            placeholder="Semester number"
            type="number"
            min={1}
            value={semesterNo}
            onChange={(e) => setSemesterNo(e.target.value)}
          />
          <label className="flex items-center gap-2 border border-[#DED7CB] bg-white rounded-lg px-3">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            Required Course
          </label>
          <select
            className="border border-[#DED7CB] bg-white rounded-lg p-2"
            value={courseBucket}
            onChange={(e) => setCourseBucket(e.target.value)}
          >
            <option value="major">Major Course</option>
            <option value="english">English</option>
            <option value="arabic">Arabic</option>
            <option value="culture">Culture</option>
          </select>
          <button
            onClick={addCourse}
            disabled={saving}
            className="bg-[#7A263A] text-white rounded-lg px-4 py-2 hover:bg-[#631F2F] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add to Plan"}
          </button>
        </div>
        {selectedCourseId && (
          <p className="text-sm text-gray-700">
            Selected course ID: {selectedCourseId}
          </p>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>

      <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-4">
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full md:w-96"
          placeholder="Search available courses"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F1EFEA]">
            <tr>
              {[
                "Select",
                "Code",
                "Title",
                "Credits",
                "Department",
                "Program",
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {availableCourses.map((course) => (
              <tr
                key={course.course_id}
                className={`border-t ${selectedCourseId === course.course_id ? "bg-[#F9F1EE]" : ""}`}
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelectedCourseId(course.course_id)}
                    className="px-3 py-1 rounded border border-[#DED7CB] bg-white hover:bg-[#F2EBDD]"
                  >
                    {selectedCourseId === course.course_id
                      ? "Selected"
                      : "Select"}
                  </button>
                </td>
                <td className="px-4 py-3">{course.course_code}</td>
                <td className="px-4 py-3">{course.course_title}</td>
                <td className="px-4 py-3">{course.credits}</td>
                <td className="px-4 py-3">{course.department_name || "-"}</td>
                <td className="px-4 py-3">{course.program_name || "Common"}</td>
              </tr>
            ))}
            {!availableCourses.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No available courses found. This plan may already include all
                  courses.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
