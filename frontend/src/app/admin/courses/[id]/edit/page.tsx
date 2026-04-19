"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type ApiResponse<T> = { success: boolean; data: T; message?: string };

type Course = {
  course_id: number;
  course_code: string;
  course_title: string;
  credits: number;
  description?: string | null;
  department_id?: number | null;
  program_id?: number | null;
};

export default function EditCoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [credits, setCredits] = useState("3");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api.get<ApiResponse<Course>>(`/courses/${id}`).then((res) => {
      if (!res.success) return;
      setCourse(res.data);
      setCourseCode(res.data.course_code || "");
      setCourseTitle(res.data.course_title || "");
      setCredits(String(res.data.credits ?? 3));
      setDescription(res.data.description || "");
      setDepartmentId(
        res.data.department_id ? String(res.data.department_id) : "",
      );
      setProgramId(res.data.program_id ? String(res.data.program_id) : "");
    });
  }, [id]);

  const save = async () => {
    setError("");
    if (!courseCode.trim() || !courseTitle.trim()) {
      setError("Course code and title are required.");
      return;
    }
    try {
      setSaving(true);
      await api.put(`/courses/${id}`, {
        courseCode: courseCode.trim(),
        courseTitle: courseTitle.trim(),
        credits: Number(credits || "0"),
        description: description || "",
        departmentId: departmentId || null,
        programId: programId || null,
      });
      router.push("/admin/courses");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to update course.");
    } finally {
      setSaving(false);
    }
  };

  if (!course) return <div className="p-6">Loading course details...</div>;

  return (
    <div className="space-y-4 bg-[#FCFBF8] p-3 rounded-xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Edit Course</h1>
        <Link href="/admin/courses" className="text-black">
          ← Back to courses
        </Link>
      </div>

      <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-6 space-y-3 max-w-2xl">
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full"
          placeholder="Course code"
          value={courseCode}
          onChange={(e) => setCourseCode(e.target.value)}
        />
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full"
          placeholder="Course title"
          value={courseTitle}
          onChange={(e) => setCourseTitle(e.target.value)}
        />
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full"
          placeholder="Credits"
          type="number"
          min={0}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
        />
        <textarea
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full"
          placeholder="Description (optional)"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full"
          placeholder="Department ID (optional)"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
        />
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full"
          placeholder="Program ID (optional)"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#631F2F] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href="/admin/courses"
            className="px-4 py-2 rounded-lg border border-[#DED7CB] bg-white hover:bg-[#F2EBDD]"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
