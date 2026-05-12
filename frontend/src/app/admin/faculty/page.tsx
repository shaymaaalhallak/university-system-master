"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { FacultyMeta, FacultyRow } from "@/components/admin/faculty-types";
import DashboardLayout from "@/components/DashboardLayout";
type ApiResponse<T> = { success: boolean; data: T; message?: string };

export default function FacultyListPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [meta, setMeta] = useState<FacultyMeta | null>(null);
  const [rows, setRows] = useState<FacultyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") router.push("/login");
  }, [isLoading, router, user]);

  const load = async () => {
    setLoading(true);
    try {
      const [metaRes, listRes] = await Promise.all([
        api.get<ApiResponse<FacultyMeta>>("/users/professors/meta"),
        api.get<ApiResponse<FacultyRow[]>>("/users/professors", {
          params: {
            search: search || undefined,
            departmentId: departmentId || undefined,
            title: title || undefined,
          },
        }),
      ]);
      if (metaRes.success) setMeta(metaRes.data);
      if (listRes.success) setRows(listRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  if (isLoading || loading)
    return <div className="p-6">Loading faculty...</div>;

  return (
    <DashboardLayout>
      <div className="space-y-4 bg-[#FCFBF8] text-black p-3 rounded-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Faculty List</h1>
          <Link
            href="/admin/faculty/create"
            className="bg-[#7A263A] text-white rounded-lg px-4 py-2 hover:bg-[#631F2F]"
          >
            + Add Professor
          </Link>
        </div>

        <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border border-[#DED7CB] bg-white rounded-lg p-2"
            placeholder="Search (name / email)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-[#DED7CB] bg-white rounded-lg p-2"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">Department</option>
            {meta?.departments.map((d) => (
              <option key={d.department_id} value={d.department_id}>
                {d.department_name}
              </option>
            ))}
          </select>
          <select
            className="border border-[#DED7CB] bg-white rounded-lg p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          >
            <option value="">Title</option>
            {meta?.titles.map((t) => (
              <option key={t.title} value={t.title}>
                {t.title}
              </option>
            ))}
          </select>
          <div className="md:col-span-3">
            <button
              onClick={load}
              className="bg-[#7A263A] text-white rounded-lg px-4 py-2 hover:bg-[#631F2F]"
            >
              Apply Filters
            </button>
          </div>
        </div>

        <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F1EFEA]">
              <tr>
                {["Name", "Email", "Department", "Title", "Actions"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-t">
                  <td className="px-4 py-3">
                    {r.first_name} {r.last_name}
                  </td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">{r.department_name || "-"}</td>
                  <td className="px-4 py-3">{r.title || "Professor"}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <Link
                      href={`/admin/faculty/${r.user_id}`}
                      className="text-black"
                    >
                      👁 View
                    </Link>
                    <Link
                      href={`/admin/faculty/${r.user_id}/edit`}
                      className="text-black"
                    >
                      ✏️ Edit
                    </Link>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Delete professor ${r.first_name} ${r.last_name}? This action cannot be undone.`)) return;
                        try {
                          const res = await api.delete<ApiResponse<null>>(`/users/professors/${r.user_id}`);
                          if (res.success) {
                            setRows((prev) => prev.filter((x) => x.user_id !== r.user_id));
                          } else {
                            alert(res.message || "Failed to delete");
                          }
                        } catch {
                          alert("Failed to delete professor");
                        }
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No professors found
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
