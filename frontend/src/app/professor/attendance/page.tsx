"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Calendar, ClipboardCheck, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
type Section = {
  section_id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  semester: number;
  year: number;
  room_number: string;
  schedule_time: string;
  enrolled_count: number;
  grade_entry_enabled: number;
};

type Student = {
  student_id: number;
  first_name: string;
  last_name: string;
  email: string;
};

type AttendanceRecord = {
  student_id: number;
  status: "Present" | "Absent" | "Late";
};

const STATUS_CYCLE: AttendanceRecord["status"][] = [
  "Present",
  "Absent",
  "Late",
];

function getTodayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().split("T")[0];
}

export default function ProfessorAttendance() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [allSections, setAllSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState(getTodayLocal());
  const [statuses, setStatuses] = useState<
    Record<number, AttendanceRecord["status"]>
  >({});
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

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
        setLoadingSections(true);
        setError(null);

        const response = await api.get<{ success: boolean; data: Section[] }>(
          "/professor/my-sections",
        );
        if (!response.success) {
          throw new Error("Failed to load sections");
        }

        setAllSections(response.data ?? []);
      } catch (err) {
        console.error(err);
        setError("Unable to load your sections right now.");
      } finally {
        setLoadingSections(false);
      }
    };

    loadSections();
  }, [user]);

  const courses = useMemo(() => {
    const courseMap = new Map<
      number,
      { course_id: number; course_code: string; course_title: string }
    >();

    allSections.forEach((section) => {
      if (!courseMap.has(section.course_id)) {
        courseMap.set(section.course_id, {
          course_id: section.course_id,
          course_code: section.course_code,
          course_title: section.course_title,
        });
      }
    });

    return Array.from(courseMap.values());
  }, [allSections]);

  const sectionsForCourse = useMemo(
    () =>
      allSections.filter((section) => section.course_id === selectedCourseId),
    [allSections, selectedCourseId],
  );

  useEffect(() => {
    if (!selectedSectionId) {
      setStudents([]);
      setStatuses({});
      return;
    }

    const loadStudentsAndAttendance = async () => {
      try {
        setLoadingStudents(true);
        setError(null);
        setSuccessMessage("");

        const [studentsResponse, attendanceResponse] = await Promise.all([
          api.get<{ success: boolean; data: Student[] }>(
            `/attendance/section/${selectedSectionId}/students`,
          ),
          api.get<{ success: boolean; data: AttendanceRecord[] }>(
            `/attendance?sectionId=${selectedSectionId}&date=${selectedDate}`,
          ),
        ]);

        const enrolledStudents = studentsResponse.success
          ? (studentsResponse.data ?? [])
          : [];
        const attendanceRows = attendanceResponse.success
          ? (attendanceResponse.data ?? [])
          : [];
        const nextStatuses: Record<number, AttendanceRecord["status"]> = {};

        enrolledStudents.forEach((student) => {
          nextStatuses[student.student_id] = "Present";
        });

        attendanceRows.forEach((record) => {
          nextStatuses[record.student_id] = record.status;
        });

        setStudents(enrolledStudents);
        setStatuses(nextStatuses);
      } catch (err) {
        console.error(err);
        setError("Unable to load students or attendance for this section.");
      } finally {
        setLoadingStudents(false);
      }
    };

    loadStudentsAndAttendance();
  }, [selectedSectionId, selectedDate]);

  const handleCourseChange = (courseId: number) => {
    setSelectedCourseId(courseId);
    setSelectedSectionId(null);
    setStudents([]);
    setStatuses({});
    setSuccessMessage("");
  };

  const cycleStatus = (studentId: number) => {
    setStatuses((current) => {
      const currentStatus = current[studentId] ?? "Present";
      const nextIndex =
        (STATUS_CYCLE.indexOf(currentStatus) + 1) % STATUS_CYCLE.length;

      return {
        ...current,
        [studentId]: STATUS_CYCLE[nextIndex],
      };
    });
  };

  const handleSubmit = async () => {
    if (!selectedSectionId || students.length === 0) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage("");

      const records = students.map((student) => ({
        studentId: student.student_id,
        status: statuses[student.student_id] ?? "Present",
      }));

      const response = await api.post<{ success: boolean; message: string }>(
        "/attendance",
        {
          sectionId: selectedSectionId,
          date: selectedDate,
          records,
        },
      );

      if (!response.success) {
        throw new Error(response.message || "Failed to save attendance");
      }

      setSuccessMessage(response.message || "Attendance saved successfully.");
    } catch (err) {
      console.error(err);
      setError("Unable to save attendance right now.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loadingSections) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (user?.role !== "professor") {
    return (
      <div className="p-6">
        Access denied. This page is for professors only.
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 text-black bg-white">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-3">
              <ClipboardCheck className="text-green-700" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Professor Attendance
              </h1>
              <p className="text-sm text-gray-500">
                Choose a course, then a section and date to mark attendance.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            My Sections
          </h2>
          <div className="space-y-3">
            {allSections.map((section) => (
              <div
                key={section.section_id}
                className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2">
                    <Calendar className="text-blue-600" size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {section.course_title}{" "}
                      <span className="text-sm text-gray-400">
                        ({section.course_code})
                      </span>
                    </p>
                    <p className="text-sm text-gray-500">
                      Section {section.section_id} • {section.schedule_time} •{" "}
                      {section.room_number} • {section.enrolled_count} students
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    section.grade_entry_enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {section.grade_entry_enabled
                    ? "Grades open"
                    : "Grades closed"}
                </span>
              </div>
            ))}
            {!allSections.length && (
              <p className="py-4 text-center text-gray-500">
                No sections assigned yet.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Course
              </label>
              <select
                value={selectedCourseId ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    setSelectedCourseId(null);
                    setSelectedSectionId(null);
                    setStudents([]);
                    setStatuses({});
                    setSuccessMessage("");
                    return;
                  }
                  handleCourseChange(Number(value));
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
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Section
              </label>
              <select
                value={selectedSectionId ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedSectionId(value ? Number(value) : null);
                }}
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

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={!selectedSectionId}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-gray-100"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {successMessage && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {successMessage}
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">Students</h2>
          </div>

          {loadingStudents && (
            <p className="text-gray-500">Loading students...</p>
          )}

          {!loadingStudents && selectedSectionId && !students.length && (
            <p className="text-gray-500">
              No active students are enrolled in this section.
            </p>
          )}

          {!loadingStudents && !selectedSectionId && (
            <p className="text-gray-500">
              Select a course and section to start attendance.
            </p>
          )}

          <div className="space-y-3">
            {students.map((student) => (
              <div
                key={student.student_id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {student.first_name} {student.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{student.email}</p>
                </div>

                <button
                  type="button"
                  onClick={() => cycleStatus(student.student_id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium ${
                    statuses[student.student_id] === "Present"
                      ? "bg-green-100 text-green-700"
                      : statuses[student.student_id] === "Absent"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {statuses[student.student_id] ?? "Present"}
                </button>
              </div>
            ))}
          </div>

          {students.length > 0 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:bg-blue-300"
              >
                {saving ? "Saving..." : "Save Attendance"}
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
