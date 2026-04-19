"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export default function StudyPlansListPage() {
  const [plans, setPlans] = useState<any[]>([]);

  const load = async () => {
    const res = await api.get<ApiResponse<any[]>>("/courses/study-plans");
    if (res.success) setPlans(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  return (
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

      <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F1EFEA]">
            <tr>
              {["Plan name", "Major", "Number of courses", "Actions"].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.plan_id} className="border-t">
                <td className="px-4 py-3">{p.plan_name}</td>
                <td className="px-4 py-3">
                  {p.program_name || p.department_name || "General"}
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
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No study plans found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
