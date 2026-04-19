"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { StudentMeta, StudentRow } from "@/components/admin/student-types";

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export default function StudentsListPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [meta, setMeta] = useState<StudentMeta | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [semester, setSemester] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") {
      router.push("/login");
    }
  }, [isLoading, router, user]);

  const load = async () => {
    setLoading(true);
    try {
      const [metaRes, listRes] = await Promise.all([
        api.get<ApiResponse<StudentMeta>>("/users/students/meta"),
        api.get<ApiResponse<StudentRow[]>>("/users/students", {
          params: {
            search: search || undefined,
            departmentId: departmentId || undefined,
            programId: programId || undefined,
            semester: semester || undefined,
            status: status || undefined,
          },
        }),
      ]);

      if (metaRes.success) setMeta(metaRes.data);
      if (listRes.success) setStudents(listRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const filteredPrograms = useMemo(() => {
    if (!meta) return [];
    if (!departmentId) return meta.programs;
    return meta.programs.filter(
      (p) => String(p.department_id) === departmentId,
    );
  }, [departmentId, meta]);

  const blockToggle = async (student: StudentRow) => {
    const isBlocked = student.status === "blocked";
    const endpoint = isBlocked ? "unblock" : "block";
    await api.post(
      `/users/${student.user_id}/${endpoint}`,
      isBlocked ? {} : { reason: "Blocked by admin" },
    );
    await load();
  };

  const deleteStudent = async (id: number) => {
    if (!confirm("Delete this student?")) return;
    await api.delete(`/users/${id}`);
    await load();
  };

  if (isLoading || loading)
    return <div className="p-6">Loading students...</div>;

  return (
    <div className="space-y-4 bg-[#FCFBF8] text-black p-3 rounded-xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Students Management Module
        </h1>
        <Link
          className="bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#631F2F]"
          href="/admin/students/create"
        >
          + Add Student
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total students" value={meta?.stats.totalStudents ?? 0} />
        <Stat label="Active students" value={meta?.stats.activeStudents ?? 0} />
        <Stat
          label="Blocked students"
          value={meta?.stats.blockedStudents ?? 0}
        />
        <Stat label="Unpaid fees" value={meta?.stats.unpaidStudents ?? 0} />
      </div>

      <div className="bg-[#FCFBF8] rounded-xl border border-[#E7E2D9] p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2"
          placeholder="Search name / email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border border-[#DED7CB] bg-white rounded-lg p-2"
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setProgramId("");
          }}
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
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
        >
          <option value="">Program</option>
          {filteredPrograms.map((p) => (
            <option key={p.program_id} value={p.program_id}>
              {p.program_name}
            </option>
          ))}
        </select>
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2"
          placeholder="Semester"
          type="number"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        />
        <select
          className="border border-[#DED7CB] bg-white rounded-lg p-2"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>

        <div className="md:col-span-5 flex gap-2">
          <button
            className="bg-[#7A263A] text-white rounded-lg px-4 py-2 hover:bg-[#631F2F]"
            onClick={load}
          >
            Apply Filters
          </button>
          <button
            className="border border-[#DED7CB] bg-white rounded-lg px-4 py-2 hover:bg-[#F2EBDD]"
            onClick={() => {
              setSearch("");
              setDepartmentId("");
              setProgramId("");
              setSemester("");
              setStatus("");
              setTimeout(load, 0);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F1EFEA] text-gray-600">
            <tr>
              {"Name,Email,Department,Program,Semester,Status,Actions"
                .split(",")
                .map((c) => (
                  <th key={c} className="text-left px-4 py-3 font-semibold">
                    {c}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.user_id} className="border-t">
                <td className="px-4 py-3">
                  {s.first_name} {s.last_name}
                </td>
                <td className="px-4 py-3">{s.email}</td>
                <td className="px-4 py-3">{s.department_name || "-"}</td>
                <td className="px-4 py-3">{s.program_name || "-"}</td>
                <td className="px-4 py-3">{s.semester ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs bg-white text-black border border-black">
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/students/${s.user_id}`}
                      className="text-black"
                    >
                      👁 View
                    </Link>
                    <Link
                      href={`/admin/students/${s.user_id}/edit`}
                      className="text-black"
                    >
                      ✏️ Edit
                    </Link>
                    <button
                      onClick={() => blockToggle(s)}
                      className="text-black"
                    >
                      🚫 {s.status === "blocked" ? "Unblock" : "Block"}
                    </button>
                    <button
                      onClick={() => deleteStudent(s.user_id)}
                      className="text-black"
                    >
                      ❌ Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!students.length && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={7}>
                  No students found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
