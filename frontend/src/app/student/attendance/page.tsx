"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { AlertTriangle, Calendar, CheckCircle, Clock3, XCircle } from "lucide-react";

interface AttendanceRecord {
  id: string;
  section_id: string;
  course_code: string;
  course_title: string;
  date: string;
  status: "Present" | "Absent" | "Late";
}

interface SectionSummary {
  sectionId: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
  absenceLimit: number;
  atRisk: boolean;
  courseCode?: string;
  courseTitle?: string;
}

function formatClassDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function StudentAttendance() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [summaries, setSummaries] = useState<SectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role !== "student") {
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const attRes = await api.get<{ success: boolean; data: AttendanceRecord[] }>("/attendance/my");
        if (attRes.success) {
          setAttendance(attRes.data ?? []);
        }

        const enrollRes = await api.get<{ success: boolean; data: any[] }>("/enrollments/my");
        if (enrollRes.success && (enrollRes.data?.length ?? 0) > 0) {
          const sectionIds = Array.from(
            new Set(enrollRes.data.map((enrollment) => enrollment.section_id))
          );

          const reports = await Promise.all(
            sectionIds.map((sectionId) =>
              api
                .get<{ success: boolean; data: Omit<SectionSummary, "courseCode" | "courseTitle"> }>(
                  `/attendance/course/${sectionId}/report`
                )
                .then((response) => {
                  if (!response.success) {
                    return null;
                  }

                  const enrollment = enrollRes.data.find((item) => item.section_id === sectionId);
                  return {
                    ...response.data,
                    courseCode: enrollment?.course_code,
                    courseTitle: enrollment?.course_title,
                  };
                })
                .catch(() => null)
            )
          );

          setSummaries(reports.filter(Boolean) as SectionSummary[]);
        } else {
          setSummaries([]);
        }
      } catch (loadError) {
        console.error(loadError);
        setError("Unable to load your attendance right now.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const totalPresent = useMemo(() => attendance.filter((record) => record.status === "Present").length, [attendance]);
  const totalAbsent = useMemo(() => attendance.filter((record) => record.status === "Absent").length, [attendance]);
  const totalLate = useMemo(() => attendance.filter((record) => record.status === "Late").length, [attendance]);

  const getStatusIcon = (status: AttendanceRecord["status"]) => {
    if (status === "Present") {
      return <CheckCircle className="text-green-500" size={20} />;
    }
    if (status === "Absent") {
      return <XCircle className="text-red-500" size={20} />;
    }
    return <Clock3 className="text-yellow-500" size={20} />;
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
    <div className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
          <p className="text-sm text-gray-500">Track your class-by-class attendance and course risk level.</p>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-green-100 p-3">
              <CheckCircle className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Present</p>
              <p className="text-3xl font-bold text-gray-900">{totalPresent}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-red-100 p-3">
              <XCircle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Absent</p>
              <p className="text-3xl font-bold text-gray-900">{totalAbsent}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-yellow-100 p-3">
              <Clock3 className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Late</p>
              <p className="text-3xl font-bold text-gray-900">{totalLate}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 p-3">
              <Calendar className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Classes</p>
              <p className="text-3xl font-bold text-gray-900">{attendance.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Course-wise Attendance</h2>
        <div className="space-y-4">
          {summaries.map((item) => (
            <div
              key={item.sectionId}
              className={`rounded-lg border p-4 ${item.atRisk ? "border-red-300 bg-red-50" : "border-gray-200"}`}
            >
              <div className="mb-2 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">{item.courseTitle}</h3>
                  <p className="text-xs text-gray-500">
                    {item.courseCode} • Section {item.sectionId}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      item.percentage >= 75
                        ? "bg-green-100 text-green-700"
                        : item.percentage >= 60
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {item.percentage}%
                  </span>
                  {item.atRisk && (
                    <p className="mt-1 text-xs text-red-600">Warning: absence limit reached</p>
                  )}
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className={`h-2 rounded-full ${
                    item.percentage >= 75 ? "bg-green-500" : item.percentage >= 60 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-gray-500">
                <span>{item.present} Present</span>
                <span>{item.absent} Absent</span>
                <span>{item.late} Late</span>
                <span className="text-gray-400">Limit: {item.absenceLimit} absences</span>
              </div>
            </div>
          ))}
          {!summaries.length && (
            <p className="py-8 text-center text-gray-500">No attendance summary available yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Attendance History</h2>
        <div className="space-y-3">
          {attendance.slice(0, 20).map((record) => (
            <div key={record.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-3">
                {getStatusIcon(record.status)}
                <div>
                  <p className="font-medium text-gray-900">{record.course_title}</p>
                  <p className="text-sm text-gray-500">
                    {record.course_code} • Section {record.section_id} • {formatClassDate(record.date)}
                  </p>
                </div>
              </div>
              <span
                className={`text-sm font-medium ${
                  record.status === "Present"
                    ? "text-green-600"
                    : record.status === "Absent"
                    ? "text-red-600"
                    : "text-yellow-600"
                }`}
              >
                {record.status}
              </span>
            </div>
          ))}
          {!attendance.length && (
            <div className="rounded-lg border border-dashed p-6 text-center text-gray-500">
              <AlertTriangle className="mx-auto mb-2 text-gray-400" size={20} />
              No attendance records yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
