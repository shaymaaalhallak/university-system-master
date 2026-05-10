"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { BookOpen, Calendar, ClipboardList, Paperclip, Save, Trash2, Users } from "lucide-react";

type Section = {
  section_id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  semester: number;
  year: number;
  room_number: string;
  schedule_time: string;
  enrolled_count?: number;
};

type Assignment = {
  id: number;
  section_id: number;
  title: string;
  description: string;
  attachment_url: string | null;
  due_date: string;
  max_score: number;
  course_code: string;
  course_title: string;
  students?: Array<{
    student_id: number;
    first_name: string;
    last_name: string;
    email: string;
    submitted: boolean;
    submissionId: number | null;
    submissionDate: string | null;
    fileUrl: string | null;
    score: number | null;
    feedback: string | null;
  }>;
};

const getAttachmentUrl = (attachmentPath: string | null) => {
  if (!attachmentPath) {
    return null;
  }

  if (/^https?:\/\//i.test(attachmentPath)) {
    return attachmentPath;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";
  const backendBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;
  return `${backendBase}${attachmentPath}`;
};

const todayLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 16);
};

export default function ProfessorAssignmentsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: todayLocal(),
    maxScore: 100,
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role !== "professor") {
      return;
    }

    const loadSections = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ success: boolean; data: Section[] }>("/professor/my-sections");
        if (!response.success) {
          throw new Error("Failed to load sections");
        }
        setSections(response.data ?? []);
      } catch (err) {
        console.error(err);
        setError("Unable to load your sections.");
      } finally {
        setLoading(false);
      }
    };

    loadSections();
  }, [user]);

  useEffect(() => {
    if (!sections.length) {
      setSelectedCourseId(null);
      setSelectedSectionId(null);
      return;
    }

    if (!selectedCourseId) {
      setSelectedCourseId(sections[0].course_id);
    }
  }, [sections, selectedCourseId]);

  useEffect(() => {
    if (!selectedSectionId) {
      setAssignments([]);
      return;
    }

    const loadAssignments = async () => {
      try {
        setLoadingAssignments(true);
        setError(null);
        const response = await api.get<{ success: boolean; data: Assignment[] }>(
          `/assignments/section/${selectedSectionId}/submissions`
        );
        if (!response.success) {
          throw new Error("Failed to load assignments");
        }
        setAssignments(response.data ?? []);
      } catch (err) {
        console.error(err);
        setError("Unable to load assignments for this section.");
      } finally {
        setLoadingAssignments(false);
      }
    };

    loadAssignments();
  }, [selectedSectionId]);

  const totalSubmitted = useMemo(
    () =>
      assignments.reduce(
        (sum, assignment) => sum + (assignment.students?.filter((student) => student.submitted).length ?? 0),
        0
      ),
    [assignments]
  );

  const courses = useMemo(() => {
    const courseMap = new Map<number, { course_id: number; course_code: string; course_title: string }>();

    sections.forEach((section) => {
      if (!courseMap.has(section.course_id)) {
        courseMap.set(section.course_id, {
          course_id: section.course_id,
          course_code: section.course_code,
          course_title: section.course_title,
        });
      }
    });

    return Array.from(courseMap.values());
  }, [sections]);

  const sectionsForCourse = useMemo(
    () => sections.filter((section) => section.course_id === selectedCourseId),
    [sections, selectedCourseId]
  );

  const handleCreateAssignment = async () => {
    if (!selectedSectionId) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const payload = new FormData();
      payload.append("sectionId", String(selectedSectionId));
      payload.append("title", form.title);
      payload.append("description", form.description);
      payload.append("dueDate", form.dueDate);
      payload.append("maxScore", String(form.maxScore));
      if (attachmentFile) {
        payload.append("attachment", attachmentFile);
      }

      const response = await api.post<{ success: boolean; data: { assignmentId: number } }>("/assignments", payload);

      if (!response.success) {
        throw new Error("Failed to create assignment");
      }

      setForm({
        title: "",
        description: "",
        dueDate: todayLocal(),
        maxScore: 100,
      });
      setAttachmentFile(null);
      setMessage("Assignment created successfully.");

      const reload = await api.get<{ success: boolean; data: Assignment[] }>(
        `/assignments/section/${selectedSectionId}/submissions`
      );
      if (reload.success) {
        setAssignments(reload.data ?? []);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to create the assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) return;
    try {
      setDeletingId(assignmentId);
      setError(null);
      const response = await api.delete<{ success: boolean; message: string }>(`/assignments/${assignmentId}`);
      if (response.success) {
        setMessage("Assignment deleted successfully.");
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      }
    } catch (err) {
      console.error(err);
      setError("Unable to delete this assignment.");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (user?.role !== "professor") {
    return <div className="p-6">Access denied. This page is for professors only.</div>;
  }

  return (
    <div className="space-y-6 text-black">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-3">
            <BookOpen className="text-purple-700" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Professor Assignments</h1>
            <p className="text-sm text-gray-500">
              Create assignments with deadlines and track which students submitted them.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Course</label>
            <select
              value={selectedCourseId ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  setSelectedCourseId(null);
                  setSelectedSectionId(null);
                  setAssignments([]);
                  return;
                }

                setSelectedCourseId(Number(value));
                setSelectedSectionId(null);
                setAssignments([]);
              }}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.course_code} - {course.course_title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Section</label>
            <select
              value={selectedSectionId ?? ""}
              onChange={(e) => setSelectedSectionId(e.target.value ? Number(e.target.value) : null)}
              disabled={!selectedCourseId}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-gray-100"
            >
              <option value="">Select section</option>
              {sectionsForCourse.map((section) => (
                <option key={section.section_id} value={section.section_id}>
                  Section {section.section_id} - {section.schedule_time}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!sections.length && (
          <p className="mt-4 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            No courses were returned for this professor. If you already assigned sections, reload after backend restart.
          </p>
        )}
      </div>

      {selectedSectionId && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-green-700" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">Create Assignment</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={form.title}
              onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
              placeholder="Assignment title"
              className="rounded-lg border px-3 py-2"
            />
            <input
              type="number"
              min="1"
              value={form.maxScore}
              onChange={(e) => setForm((current) => ({ ...current, maxScore: Number(e.target.value) || 100 }))}
              className="rounded-lg border px-3 py-2"
              placeholder="Max score"
            />
          </div>

          <textarea
            value={form.description}
            onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
            placeholder="Assignment description"
            className="min-h-32 w-full rounded-lg border px-3 py-2"
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Attachment</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.txt,image/*"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border px-3 py-2"
            />
            <p className="text-xs text-gray-500">
              The professor can attach a PDF or another course file. Max upload size is 10 MB.
            </p>
          </div>

          <div className="max-w-md">
            <label className="mb-2 block text-sm font-medium text-gray-700">Deadline</label>
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => setForm((current) => ({ ...current, dueDate: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

          <button
            type="button"
            onClick={handleCreateAssignment}
            disabled={saving || !form.title.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white disabled:bg-green-300"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Create Assignment"}
          </button>
        </div>
      )}

      {selectedSectionId && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="text-blue-600" size={20} />
              <h2 className="text-lg font-semibold text-gray-900">Submission Tracking</h2>
            </div>
            <span className="text-sm text-gray-500">Total submitted records: {totalSubmitted}</span>
          </div>

          {loadingAssignments && <p className="text-gray-500">Loading assignments...</p>}

          {!loadingAssignments && !assignments.length && (
            <p className="text-gray-500">No assignments yet for this section.</p>
          )}

          {!loadingAssignments &&
            assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-xl border p-4">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
                    <p className="text-sm text-gray-500">{assignment.description}</p>
                    {getAttachmentUrl(assignment.attachment_url) && (
                      <a
                        href={getAttachmentUrl(assignment.attachment_url) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-sm text-blue-600 underline"
                      >
                        <Paperclip size={14} />
                        Open assignment attachment
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(assignment.id, assignment.title)}
                      disabled={deletingId === assignment.id}
                      className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100 disabled:opacity-60"
                      title="Delete assignment"
                    >
                      {deletingId === assignment.id ? "..." : <Trash2 size={16} />}
                    </button>
                    <div className="text-right text-sm text-gray-500">
                      <div className="flex items-center gap-2 justify-end">
                        <Calendar size={14} />
                        <span>{new Date(assignment.due_date).toLocaleDateString()}</span>
                      </div>
                      <div>Max score: {assignment.max_score}</div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Submitted At</th>
                        <th className="px-4 py-3">File</th>
                        <th className="px-4 py-3">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {assignment.students?.map((student) => (
                        <tr key={`${assignment.id}-${student.student_id}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {student.first_name} {student.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{student.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                student.submitted
                                  ? "bg-green-100 text-green-700"
                                  : new Date(assignment.due_date) > new Date()
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {student.submitted
                                ? "Submitted"
                                : new Date(assignment.due_date) > new Date()
                                  ? "Pending"
                                  : "Missing"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {student.submissionDate ? new Date(student.submissionDate).toLocaleString() : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {student.fileUrl ? (
                              <a
                                href={getAttachmentUrl(student.fileUrl) ?? "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 underline"
                              >
                                Open file
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{student.score ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
