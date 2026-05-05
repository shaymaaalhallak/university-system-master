"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export default function StudyPlanDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      setError("");
      const [planRes, coursesRes] = await Promise.all([
        api.get<ApiResponse<any>>(`/courses/study-plans/${id}`),
        api.get<ApiResponse<any[]>>(`/courses`),
      ]);
      if (planRes.success) setPlan(planRes.data);
      if (coursesRes.success) setCourses(coursesRes.data);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "Failed to load study plan details.",
      );
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const item of plan?.items || []) {
      if (item.is_flexible) {
        if (!map["Flexible (Any Semester)"]) map["Flexible (Any Semester)"] = [];
        map["Flexible (Any Semester)"].push(item);
      } else {
        const key = `Semester ${item.semester_no} (Year ${item.year_no})`;
        map[key] = map[key] || [];
        map[key].push(item);
      }
    }
    return map;
  }, [plan?.items]);

  if (!plan) {
    return (
      <div className="p-6">
        <p>Loading study plan...</p>
        {error && <p className="mt-2 text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-[#FCFBF8] p-3 rounded-xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{plan.plan_name}</h1>
          <p className="text-gray-600">
            {plan.program_name || plan.department_name || "General"}
          </p>
        </div>
        <Link href="/admin/courses/study-plans" className="text-black">
          ← Back to plans
        </Link>
      </div>
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}
      {Object.entries(grouped).map(([group, items]) => (
        <div
          key={group}
          className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-4"
        >
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg">{group}</h2>
            <Link
              href={`/admin/courses/study-plans/${id}/add-course`}
              className="bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
            >
              + Assign Course
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {(items as any[]).map((i) => (
              <div
                key={i.course_id}
                className="flex justify-between items-center border border-[#DED7CB] bg-white rounded-lg px-3 py-2"
              >
                <div>
                  <p className="font-medium">
                    {i.course_code} - {i.course_title} - {i.credits} credits
                  </p>
                  <p className="text-xs text-gray-500">
                    {i.is_required ? "Required" : "Optional"} •{" "}
                    {{
                      major: "Program Course",
                      english: "English Course (Common)",
                      arabic: "Arabic Course (Common)",
                      culture: "Culture Course (Common)",
                    }[i.course_bucket as string] || "Program Course"}
                    {i.is_flexible && (
                      <span className="ml-2 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                        Any Semester
                      </span>
                    )}
                  </p>
                  {i.prerequisites && i.prerequisites.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      Prerequisites:{" "}
                      {i.prerequisites
                        .map((p: any) => `${p.course_code} - ${p.course_title}`)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-black"
                    onClick={async () => {
                      const yearNo = Number(
                        prompt("Move to year", String(i.year_no)) || i.year_no,
                      );
                      const semesterNo = Number(
                        prompt("Move to semester", String(i.semester_no)) ||
                          i.semester_no,
                      );
                      const isRequired =
                        (
                          prompt(
                            "Required? yes/no",
                            i.is_required ? "yes" : "no",
                          ) || "yes"
                        ).toLowerCase() !== "no";
                      await api.put(
                        `/courses/study-plans/${id}/courses/${i.course_id}`,
                        {
                          yearNo,
                          semesterNo,
                          isRequired,
                          courseBucket: i.course_bucket || "major",
                        },
                      );
                      await load();
                    }}
                  >
                    ✏️ Move
                  </button>
                  <button
                    className="text-black"
                    onClick={async () => {
                      await api.delete(
                        `/courses/study-plans/${id}/courses/${i.course_id}`,
                      );
                      await load();
                    }}
                  >
                    ❌ Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!Object.keys(grouped).length && (
        <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-4">
          <p className="text-gray-600 mb-3">No courses assigned yet.</p>
          <Link
            href={`/admin/courses/study-plans/${id}/add-course`}
            className="inline-block bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
          >
            + Assign first course
          </Link>
          <p className="text-xs text-gray-500 mt-3">
            Tip: use course IDs from the courses list.
          </p>
          <div className="mt-2 text-xs text-gray-500">
            Available courses:{" "}
            {courses
              .slice(0, 5)
              .map((c) => `${c.course_id}:${c.course_code}`)
              .join(" | ")}
            {courses.length > 5 ? " ..." : ""}
          </div>
        </div>
      )}
    </div>
  );
}
