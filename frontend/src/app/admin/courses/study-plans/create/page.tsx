"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type ApiResponse<T> = { success: boolean; data: T; message?: string };

export default function CreateCoursePage() {
  const router = useRouter();
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [credits, setCredits] = useState("3");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const createCourse = async () => {
    setError("");
    if (!courseCode.trim() || !courseTitle.trim()) {
      setError("Course code and title are required.");
      return;
    }

    try {
      setSaving(true);
      const res = await api.post<ApiResponse<{ courseId: number }>>(
        "/courses",
        {
          courseCode: courseCode.trim(),
          courseTitle: courseTitle.trim(),
          credits: Number(credits || "0"),
          description: description || "",
          departmentId: departmentId || null,
          programId: programId || null,
        },
      );
      if (res.success) router.push("/admin/courses");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to create course.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 bg-[#FCFBF8] p-3 rounded-xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Create Course</h1>
        <Link href="/admin/courses" className="text-black">
          ← Back to courses
        </Link>
      </div>

      <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-6 space-y-3 max-w-2xl">
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2 w-full"
          placeholder="Course code (e.g. CS101)"
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
            onClick={createCourse}
            disabled={saving}
            className="bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#631F2F] disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Course"}
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
