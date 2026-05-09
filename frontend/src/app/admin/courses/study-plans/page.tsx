"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
type ApiResponse<T> = { success: boolean; data: T; message?: string };

export default function StudyPlansListPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [error, setError] = useState("");
  const load = async () => {
    try {
      setError("");
      const res = await api.get<ApiResponse<any[]>>("/courses/study-plans");
      if (res.success) setPlans(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load study plans.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-4 bg-[#FCFBF8] p-3 rounded-xl">
        <div className="flex items-center gap-2 border-b border-[#E7E2D9] pb-2">
          <Link
            href="/admin/courses"
            className="px-3 py-2 rounded-lg border border-[#DED7CB] bg-white hover:bg-[#F2EBDD]"
          >
            Courses
          </Link>
          <button className="px-3 py-2 rounded-lg bg-[#7A263A] text-white">
            Study Plans
          </button>
        </div>

        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Study Plans</h1>
          <Link
            href="/admin/courses/study-plans/create"
            className="bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#631F2F]"
          >
            + Add Plan
          </Link>
        </div>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}
        <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F1EFEA]">
              <tr>
                {[
                  "Plan name",
                  "Scope",
                  "Type",
                  "Number of courses",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.plan_id} className="border-t">
                  <td className="px-4 py-3">{p.plan_name}</td>
                  <td className="px-4 py-3">
                    {p.program_name || (
                      <span className="text-blue-600 font-medium">
                        {p.department_name || "All Departments"} (Common)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.program_id ? (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                        Program-specific
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        Common/Shared
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.courses_count}</td>
                  <td className="px-4 py-3 flex gap-3">
                    <Link
                      className="text-black"
                      href={`/admin/courses/study-plans/${p.plan_id}`}
                    >
                      👁 View
                    </Link>
                    <Link
                      className="text-black"
                      href={`/admin/courses/study-plans/${p.plan_id}`}
                    >
                      ✏️ Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {!plans.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No study plans found
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
