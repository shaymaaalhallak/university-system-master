"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { BookOpen, Calendar, Paperclip, Upload } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
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
  submission_id: number | null;
  score: number | null;
  submission_date: string | null;
  file_url: string | null;
  feedback: string | null;
};

const getAttachmentUrl = (attachmentPath: string | null) => {
  if (!attachmentPath) {
    return null;
  }

  if (/^https?:\/\//i.test(attachmentPath)) {
    return attachmentPath;
  }

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";
  const backendBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;
  return `${backendBase}${attachmentPath}`;
};

export default function StudentAssignmentsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role !== "student") {
      return;
    }

    const loadAssignments = async () => {
      try {
        setLoading(true);
        const response = await api.get<{
          success: boolean;
          data: Assignment[];
        }>("/assignments/my");
        if (!response.success) {
          throw new Error("Failed to load assignments");
        }
        const rows = response.data ?? [];
        setAssignments(rows);
        setFileUrls(
          Object.fromEntries(
            rows.map((assignment) => [
              assignment.id,
              assignment.file_url ?? "",
            ]),
          ),
        );
      } catch (err) {
        console.error(err);
        setError("Unable to load your assignments.");
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, [user]);

  const handleSubmit = async (assignmentId: number) => {
    try {
      setSavingId(assignmentId);
      setError(null);
      setMessage(null);

      const response = await api.post<{ success: boolean; message: string }>(
        `/assignments/${assignmentId}/submit`,
        { fileUrl: fileUrls[assignmentId] },
      );

      if (!response.success) {
        throw new Error(response.message || "Failed to submit assignment");
      }

      setAssignments((current) =>
        current.map((assignment) =>
          assignment.id === assignmentId
            ? {
                ...assignment,
                submission_date: new Date().toISOString(),
                file_url: fileUrls[assignmentId],
              }
            : assignment,
        ),
      );
      setMessage(response.message || "Assignment submitted.");
    } catch (err) {
      console.error(err);
      setError(
        "Unable to submit the assignment. Check the deadline and file URL.",
      );
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (user?.role !== "student") {
    return <div className="p-6">Access denied.</div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3">
              <BookOpen className="text-blue-700" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                My Assignments
              </h1>
              <p className="text-sm text-gray-500">
                Submit your work before the deadline and track your submission
                status.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {message}
          </p>
        )}

        <div className="space-y-4">
          {assignments.map((assignment) => {
            const deadlinePassed = new Date() > new Date(assignment.due_date);

            return (
              <div
                key={assignment.id}
                className="rounded-xl border bg-white p-6 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {assignment.title}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {assignment.course_code} - {assignment.course_title}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div className="flex items-center gap-2 justify-end">
                      <Calendar size={14} />
                      <span>
                        {new Date(assignment.due_date).toLocaleString()}
                      </span>
                    </div>
                    <div>Max score: {assignment.max_score}</div>
                  </div>
                </div>

                <p className="text-sm text-gray-700">
                  {assignment.description}
                </p>

                {getAttachmentUrl(assignment.attachment_url) && (
                  <a
                    href={getAttachmentUrl(assignment.attachment_url) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 underline"
                  >
                    <Paperclip size={14} />
                    View assignment attachment
                  </a>
                )}

                <div className="rounded-lg bg-gray-50 p-4 space-y-3">
                  <div className="text-sm">
                    Status:{" "}
                    <span
                      className={`font-medium ${
                        assignment.submission_id
                          ? "text-green-700"
                          : deadlinePassed
                            ? "text-red-700"
                            : "text-yellow-700"
                      }`}
                    >
                      {assignment.submission_id
                        ? "Submitted"
                        : deadlinePassed
                          ? "Deadline passed"
                          : "Waiting for submission"}
                    </span>
                  </div>

                  <input
                    value={fileUrls[assignment.id] ?? ""}
                    onChange={(e) =>
                      setFileUrls((current) => ({
                        ...current,
                        [assignment.id]: e.target.value,
                      }))
                    }
                    placeholder="Paste your file URL"
                    className="w-full rounded-lg border px-3 py-2"
                  />

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSubmit(assignment.id)}
                      disabled={savingId === assignment.id || deadlinePassed}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:bg-blue-300"
                    >
                      <Upload size={16} />
                      {savingId === assignment.id
                        ? "Submitting..."
                        : "Submit Assignment"}
                    </button>

                    {assignment.file_url && (
                      <a
                        href={assignment.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 underline"
                      >
                        View submitted file
                      </a>
                    )}
                  </div>

                  {assignment.submission_date && (
                    <p className="text-sm text-gray-500">
                      Submitted at:{" "}
                      {new Date(assignment.submission_date).toLocaleString()}
                    </p>
                  )}

                  {assignment.score !== null && (
                    <p className="text-sm text-gray-700">
                      Score:{" "}
                      <span className="font-medium">{assignment.score}</span>
                    </p>
                  )}

                  {assignment.feedback && (
                    <p className="text-sm text-gray-700">
                      Feedback:{" "}
                      <span className="text-gray-600">
                        {assignment.feedback}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {!assignments.length && (
            <div className="rounded-xl border bg-white p-6 text-center text-gray-500 shadow-sm">
              No assignments available yet.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
