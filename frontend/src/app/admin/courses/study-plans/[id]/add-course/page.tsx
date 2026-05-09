"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
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
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [yearNo, setYearNo] = useState("1");
  const [semesterNo, setSemesterNo] = useState("1");
  const [isRequired, setIsRequired] = useState(true);
  const [courseBucket, setCourseBucket] = useState("major");
  const [isFlexible, setIsFlexible] = useState(false);
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
    if (!selectedCourseIds.length) {
      setError("Please choose a course from the table.");
      return;
    }

    try {
      setSaving(true);
      for (const courseId of selectedCourseIds) {
        await api.post(`/courses/study-plans/${id}/courses`, {
          courseId,
          yearNo: Number(yearNo || "1"),
          semesterNo: Number(semesterNo || "1"),
          isRequired,
          courseBucket,
          isFlexible,
        });
      }
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
    <DashboardLayout>
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
            <span className="font-medium"> + Create New Course</span> first,
            then come back and assign it here.
          </p>
          <p className="text-sm text-gray-600">
            Step 1: select a course from the table. Step 2: choose year/semester
            and save.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Course Categories:</strong>
              <br />• <strong>Program Courses (Major)</strong> – Specific to
              this program only
              <br />• <strong>English/Arabic/Culture Courses</strong> – Common
              courses shared across all programs in this department
              <br />
              <br />
              <strong>Any Semester (Flexible):</strong> Check this for courses
              that students can take in ANY semester (e.g. English, Arabic,
              Culture). Uncheck for courses that must be taken in a specific
              semester.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
              title="Course category type"
            >
              <option value="major">Program Courses (Major)</option>
              <option value="english">English Courses (All Programs)</option>
              <option value="arabic">Arabic Courses (All Programs)</option>
              <option value="culture">Culture Courses (All Programs)</option>
            </select>
            <label className="flex items-center gap-2 border border-[#DED7CB] bg-white rounded-lg px-3">
              <input
                type="checkbox"
                checked={isFlexible}
                onChange={(e) => {
                  setIsFlexible(e.target.checked);
                  if (e.target.checked) {
                    setYearNo("0");
                    setSemesterNo("0");
                  }
                }}
              />
              Any Semester (flexible)
            </label>
            <button
              onClick={addCourse}
              disabled={saving}
              className="bg-[#7A263A] text-white rounded-lg px-4 py-2 hover:bg-[#631F2F] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Add to Plan"}
            </button>
          </div>
          {!!selectedCourseIds.length && (
            <p className="text-sm text-gray-700">
              Selected course IDs: {selectedCourseIds.join(", ")}
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
                  className={`border-t ${selectedCourseIds.includes(course.course_id) ? "bg-[#F9F1EE]" : ""}`}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        setSelectedCourseIds((prev) =>
                          prev.includes(course.course_id)
                            ? prev.filter((id) => id !== course.course_id)
                            : [...prev, course.course_id],
                        )
                      }
                      className="px-3 py-1 rounded border border-[#DED7CB] bg-white hover:bg-[#F2EBDD]"
                    >
                      {selectedCourseIds.includes(course.course_id)
                        ? "Selected"
                        : "Select"}
                    </button>
                  </td>
                  <td className="px-4 py-3">{course.course_code}</td>
                  <td className="px-4 py-3">{course.course_title}</td>
                  <td className="px-4 py-3">{course.credits}</td>
                  <td className="px-4 py-3">{course.department_name || "-"}</td>
                  <td className="px-4 py-3">
                    {course.program_name || "Common"}
                  </td>
                </tr>
              ))}
              {!availableCourses.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No available courses found. This plan may already include
                    all courses.
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
