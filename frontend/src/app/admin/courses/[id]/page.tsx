"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
type ApiResponse<T> = { success: boolean; data: T; message?: string };

export default function CourseStudyPlanUsagePage() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    api.get<ApiResponse<any[]>>(`/courses/${id}/study-plans`).then((res) => {
      if (res.success) setRows(res.data);
    });
  }, [id]);

  return (
    <DashboardLayout>
      <div className="space-y-4 bg-[#FCFBF8] p-3 rounded-xl">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Study Plan Usage</h1>
          <Link href="/admin/courses" className="text-black">
            ← Back to courses
          </Link>
        </div>
        <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F1EFEA]">
              <tr>
                {["Plan", "Scope", "Year", "Semester", "Type", "Required"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-3">{r.plan_name}</td>
                  <td className="px-4 py-3">
                    {r.program_id ? (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        Program
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        Common
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_flexible ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                        Any
                      </span>
                    ) : (
                      r.year_no
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_flexible ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                        Flexible
                      </span>
                    ) : (
                      r.semester_no
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {{
                      major: "Program",
                      english: "English",
                      arabic: "Arabic",
                      culture: "Culture",
                    }[r.course_bucket as string] ||
                      r.course_bucket ||
                      "Program"}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_required ? "Required" : "Optional"}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    This course is not in any study plan.
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
