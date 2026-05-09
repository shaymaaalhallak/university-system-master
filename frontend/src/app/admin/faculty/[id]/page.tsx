"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
type ApiResponse<T> = { success: boolean; data: T; message?: string };

type FacultyDetails = {
  profile: any;
  sections: any[];
  eligibility: any[];
  availableCourses: any[];
  studentsInClasses: any[];
  gradingControl: any[];
  assignmentsExams: { assignments: any[]; exams: any[] };
  schedule: any[];
  performance: {
    average_grade: number | null;
    passed_count: number;
    total_count: number;
  };
  notifications: any[];
  activityLogs: any[];
};

const tabs = [
  "Profile",
  "Courses & Sections",
  "Course Eligibility",
  "Students in Classes",
  "Assignments & Exams",
  "Schedule",
  "Performance Overview",
  "Email",
  "Activity Logs",
] as const;

type Tab = (typeof tabs)[number];
type SectionDraft = {
  sectionName: string;
  semester: string;
  year: string;
  room: string;
  schedule: string;
};

const initialDraft: SectionDraft = {
  sectionName: "",
  semester: "Fall",
  year: String(new Date().getFullYear()),
  room: "",
  schedule: "",
};

export default function FacultyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Profile");
  const [data, setData] = useState<FacultyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [sectionDrafts, setSectionDrafts] = useState<
    Record<number, SectionDraft>
  >({});
  const [eligibilityCourseId, setEligibilityCourseId] = useState("");
  const [eligibilityType, setEligibilityType] = useState("secondary");
  const [actionError, setActionError] = useState("");
  const [perfDetails, setPerfDetails] = useState<any[]>([]);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [res, perfRes] = await Promise.all([
        api.get<ApiResponse<FacultyDetails>>(`/users/professors/${id}`),
        api.get<{ success: boolean; data: any[] }>(
          `/users/professors/${id}/performance-details`,
        ),
      ]);
      if (res.success) setData(res.data);
      if (perfRes.success) setPerfDetails(perfRes.data ?? []);
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "Failed to load professor details",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const passRate = useMemo(() => {
    if (!data?.performance?.total_count) return 0;
    return Math.round(
      (Number(data.performance.passed_count) /
        Number(data.performance.total_count)) *
        100,
    );
  }, [data?.performance]);

  const courseOverview = useMemo(() => {
    const grouped = new Map<
      string,
      {
        course_code: string;
        course_title: string;
        sections: any[];
      }
    >();
    for (const section of perfDetails) {
      const key = section.course_code;
      if (!grouped.has(key)) {
        grouped.set(key, {
          course_code: section.course_code,
          course_title: section.course_title,
          sections: [],
        });
      }
      grouped.get(key)!.sections.push(section);
    }
    const result: any[] = [];
    grouped.forEach((group) => {
      let totalStudents = 0;
      let totalPasses = 0;
      let totalFails = 0;
      let sumWeightedScores = 0;
      let sumWeights = 0;
      let overallMin = Infinity;
      let overallMax = -Infinity;
      for (const section of group.sections) {
        if (!section.components) continue;
        const sectionStudents = Math.max(
          ...section.components.map((c: any) => c.total_students || 0),
        );
        if (sectionStudents > 0) totalStudents += sectionStudents;
        for (const comp of section.components) {
          totalPasses += comp.pass_count || 0;
          totalFails += comp.fail_count || 0;
          sumWeightedScores +=
            (comp.average_score || 0) * (comp.total_students || 0);
          sumWeights += comp.total_students || 0;
          if ((comp.min_score ?? Infinity) < overallMin)
            overallMin = comp.min_score;
          if ((comp.max_score ?? -Infinity) > overallMax)
            overallMax = comp.max_score;
        }
      }
      result.push({
        course_code: group.course_code,
        course_title: group.course_title,
        section_count: group.sections.length,
        student_count: totalStudents,
        pass_rate:
          totalPasses + totalFails > 0
            ? Math.round((totalPasses / (totalPasses + totalFails)) * 100)
            : 0,
        avg_score:
          sumWeights > 0
            ? Math.round((sumWeightedScores / sumWeights) * 100) / 100
            : 0,
        min_score: overallMin === Infinity ? 0 : overallMin,
        max_score: overallMax === -Infinity ? 0 : overallMax,
      });
    });
    result.sort((a, b) => a.course_code.localeCompare(b.course_code));
    return result;
  }, [perfDetails]);

  const sectionsByCourse = useMemo(() => {
    const map = new Map<number, any[]>();
    (data?.sections || []).forEach((section) => {
      const bucket = map.get(section.course_id) || [];
      bucket.push(section);
      map.set(section.course_id, bucket);
    });
    return map;
  }, [data?.sections]);

  const assignedCourses = useMemo(() => {
    const catalog = data?.availableCourses || [];
    const catalogMap = new Map(catalog.map((c) => [Number(c.course_id), c]));
    return Array.from(sectionsByCourse.entries()).map(
      ([courseId, sections]) => ({
        courseId,
        course: catalogMap.get(courseId) || sections[0],
        sections,
      }),
    );
  }, [data?.availableCourses, sectionsByCourse]);
  const scheduleRows = useMemo(() => {
    const direct = data?.schedule || [];
    if (direct.length > 0) return direct;
    return (data?.sections || []).map((section) => ({
      course_code: section.course_code,
      semester: section.semester,
      year: section.year,
      room: section.room || "-",
      schedule: section.schedule_time || section.schedule || "-",
    }));
  }, [data?.schedule, data?.sections]);
  const addCourseBlock = () => {
    if (!selectedCourseId || !data) return;
    const courseId = Number(selectedCourseId);
    if (assignedCourses.some((c) => c.courseId === courseId)) return;

    const selected = data.availableCourses.find(
      (c) => Number(c.course_id) === courseId,
    );
    if (!selected) return;

    setData({
      ...data,
      sections: [
        ...data.sections,
        {
          section_id: `draft-${courseId}`,
          course_id: courseId,
          course_code: selected.course_code,
          course_title: selected.course_title,
          section_name: "",
          semester: "Fall",
          year: new Date().getFullYear(),
          room: "",
          schedule_time: "",
          schedule: "",
          isDraftCourse: true,
        },
      ],
    });
    setSelectedCourseId("");
  };

  const draftFor = (courseId: number) =>
    sectionDrafts[courseId] || initialDraft;

  const updateDraft = (
    courseId: number,
    key: keyof SectionDraft,
    value: string,
  ) => {
    setSectionDrafts((current) => ({
      ...current,
      [courseId]: {
        ...draftFor(courseId),
        [key]: value,
      },
    }));
  };

  const addSection = async (courseId: number) => {
    const draft = draftFor(courseId);
    if (!draft.sectionName || !draft.semester || !draft.year) {
      alert("Section name, semester, and year are required.");
      return;
    }
    setActionError("");
    try {
      await api.post(`/users/professors/${id}/sections`, {
        courseId,
        sectionName: draft.sectionName,
        semester: draft.semester,
        year: Number(draft.year),
        room: draft.room,
        schedule: draft.schedule,
      });

      setSectionDrafts((current) => ({ ...current, [courseId]: initialDraft }));
      await load();
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        "Unable to add this course to schedule right now.";
      setActionError(message);
    }
  };

  const removeSection = async (sectionId: number) => {
    await api.delete(`/users/professors/${id}/sections/${sectionId}`);
    await load();
  };

  if (loading) return <div className="p-6">Loading professor details...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6">No data found.</div>;

  const p = data.profile;

  return (
    <DashboardLayout>
      <div className="space-y-4 bg-[#FCFBF8] text-black p-3 rounded-xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              View Professor (Details Page)
            </h1>
            <p className="text-gray-500">
              {p.first_name} {p.last_name}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/admin/faculty/${id}/edit`}
              className="border border-[#DED7CB] bg-white rounded-lg px-3 py-2 hover:bg-[#F2EBDD]"
            >
              Edit Professor
            </Link>
            <Link href="/admin/faculty" className="text-black px-3 py-2">
              Back to list
            </Link>
          </div>
        </div>

        <div className="bg-[#FCFBF8] rounded-xl border border-[#E7E2D9] p-3 flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 rounded-lg whitespace-nowrap border border-black ${tab === t ? "bg-gray-200" : "bg-white"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-5">
          {actionError && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </p>
          )}
          {tab === "Profile" && (
            <div className="space-y-2 text-sm">
              <Row k="Name" v={`${p.first_name} ${p.last_name}`} />
              <Row k="Email" v={p.email} />
              <Row k="Phone" v={p.phone || "-"} />
              <Row k="Department" v={p.department_name || "-"} />
              <Row k="Title" v={p.title || "Professor"} />
              <Row
                k="Hire date"
                v={
                  p.hire_date ? new Date(p.hire_date).toLocaleDateString() : "-"
                }
              />
              <Row k="Degree Program" v={p.degree_program_name || "-"} />
              <div className="pt-3 flex gap-2">
                <Link
                  className="border border-[#DED7CB] bg-white rounded-lg px-3 py-2 hover:bg-[#F2EBDD]"
                  href={`/admin/faculty/${id}/edit`}
                >
                  Edit
                </Link>
                <button
                  onClick={async () => {
                    const newPassword = prompt("New password");
                    if (!newPassword) return;
                    await api.post(`/users/${id}/reset-password`, {
                      newPassword,
                    });
                    alert("Password reset");
                  }}
                  className="bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                >
                  Reset password
                </button>
              </div>
            </div>
          )}

          {tab === "Courses & Sections" && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <select
                  className="border border-[#DED7CB] bg-white rounded-lg p-2"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                >
                  <option value="">Select Course</option>
                  {(data.availableCourses || []).map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.course_code} - {course.course_title}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addCourseBlock}
                  className="bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                >
                  Add Course
                </button>
              </div>

              {assignedCourses.map(({ courseId, course, sections }) => {
                const draft = draftFor(courseId);
                const isPinned = sections.some(
                  (section) => typeof section.section_id === "number",
                );
                return (
                  <div
                    key={courseId}
                    className="rounded-lg border border-[#DED7CB] bg-white p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">
                        Course: {course.course_code} - {course.course_title}
                      </p>
                      {isPinned ? (
                        <span className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                          Pinned to Schedule
                        </span>
                      ) : (
                        <button
                          className="rounded-lg bg-[#7A263A] px-3 py-2 text-sm font-medium text-white"
                          onClick={() => addSection(courseId)}
                        >
                          Pin Course to Schedule
                        </button>
                      )}
                    </div>

                    <SimpleTable
                      headers={[
                        "Section",
                        "Semester",
                        "Year",
                        "Room",
                        "Schedule",
                        "Action",
                      ]}
                      rows={sections
                        .filter((s) => typeof s.section_id === "number")
                        .map((s) => [
                          s.section_name || "-",
                          s.semester,
                          s.year,
                          s.room || "-",
                          s.schedule_time || s.schedule || "-",
                          <button
                            key={`del-${s.section_id}`}
                            className="text-red-700"
                            onClick={() => removeSection(Number(s.section_id))}
                          >
                            X
                          </button>,
                        ])}
                    />

                    <div className="grid gap-2 md:grid-cols-5">
                      <input
                        className="border rounded-lg p-2"
                        placeholder="Section Name (A)"
                        value={draft.sectionName}
                        onChange={(e) =>
                          updateDraft(courseId, "sectionName", e.target.value)
                        }
                      />
                      <input
                        className="border rounded-lg p-2"
                        placeholder="Semester"
                        value={draft.semester}
                        onChange={(e) =>
                          updateDraft(courseId, "semester", e.target.value)
                        }
                      />
                      <input
                        className="border rounded-lg p-2"
                        placeholder="Year"
                        value={draft.year}
                        onChange={(e) =>
                          updateDraft(courseId, "year", e.target.value)
                        }
                      />
                      <input
                        className="border rounded-lg p-2"
                        placeholder="Room"
                        value={draft.room}
                        onChange={(e) =>
                          updateDraft(courseId, "room", e.target.value)
                        }
                      />
                      <input
                        className="border rounded-lg p-2"
                        placeholder="Schedule"
                        value={draft.schedule}
                        onChange={(e) =>
                          updateDraft(courseId, "schedule", e.target.value)
                        }
                      />
                    </div>
                    <button
                      className="bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                      onClick={() => addSection(courseId)}
                    >
                      + Add Section
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {tab === "Course Eligibility" && (
            <div className="space-y-4">
              <SimpleTable
                headers={["Course", "Type", "Actions"]}
                rows={(data.eligibility || []).map((e) => [
                  `${e.course_code} ${e.course_title}`,
                  e.eligibility_type || "secondary",
                  <button
                    key={e.course_id}
                    className="text-black"
                    onClick={() =>
                      api
                        .delete(
                          `/users/professors/${id}/eligibility/${e.course_id}`,
                        )
                        .then(load)
                    }
                  >
                    Remove
                  </button>,
                ])}
              />

              <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                <select
                  className="border rounded-lg p-2"
                  value={eligibilityCourseId}
                  onChange={(e) => setEligibilityCourseId(e.target.value)}
                >
                  <option value="">Select eligible course</option>
                  {(data.availableCourses || []).map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.course_code} - {course.course_title}
                    </option>
                  ))}
                </select>
                <select
                  className="border rounded-lg p-2"
                  value={eligibilityType}
                  onChange={(e) => setEligibilityType(e.target.value)}
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
                <button
                  className="bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                  onClick={async () => {
                    if (!eligibilityCourseId) return;
                    await api.post(`/users/professors/${id}/eligibility`, {
                      courseId: Number(eligibilityCourseId),
                      eligibilityType,
                    });
                    setEligibilityCourseId("");
                    setEligibilityType("secondary");
                    await load();
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {tab === "Students in Classes" && (
            <SimpleTable
              headers={["Student", "Email", "Course", "Enrollment status"]}
              rows={(data.studentsInClasses || []).map((s) => [
                `${s.first_name} ${s.last_name}`,
                s.email,
                `${s.course_code} ${s.course_title}`,
                s.status,
              ])}
            />
          )}

          {tab === "Assignments & Exams" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SimpleTable
                headers={["Assignments", "Due"]}
                rows={(data.assignmentsExams?.assignments || []).map((a) => [
                  a.title,
                  a.due_date ? new Date(a.due_date).toLocaleDateString() : "-",
                ])}
              />
              <SimpleTable
                headers={["Exams", "Date"]}
                rows={(data.assignmentsExams?.exams || []).map((e) => [
                  String(e.exam_id),
                  e.exam_date
                    ? new Date(e.exam_date).toLocaleDateString()
                    : "-",
                ])}
              />
            </div>
          )}

          {tab === "Schedule" && (
            <SimpleTable
              headers={["Course", "Semester", "Year", "Room", "Schedule"]}
              rows={scheduleRows.map((s) => [
                s.course_code,
                s.semester,
                s.year,
                s.room || "-",
                s.schedule || "-",
              ])}
            />
          )}

          {tab === "Performance Overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-[#DED7CB] bg-white p-4">
                  <p className="text-sm text-gray-500">Average Student Grade</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.performance?.average_grade
                      ? Number(data.performance.average_grade).toFixed(2)
                      : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#DED7CB] bg-white p-4">
                  <p className="text-sm text-gray-500">Overall Pass Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {passRate}%
                  </p>
                </div>
                <div className="rounded-lg border border-[#DED7CB] bg-white p-4">
                  <p className="text-sm text-gray-500">Total Sections</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {perfDetails.length}
                  </p>
                </div>
              </div>

              {courseOverview.length > 0 && (
                <div className="rounded-lg border border-[#DED7CB] bg-white p-4">
                  <h3 className="mb-3 text-lg font-bold text-gray-900">
                    Course Overview
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#F1EFEA]">
                        <tr>
                          <th className="px-3 py-2 text-left">Course</th>
                          <th className="px-3 py-2 text-left">Sections</th>
                          <th className="px-3 py-2 text-left">Students</th>
                          <th className="px-3 py-2 text-left">Pass Rate</th>
                          <th className="px-3 py-2 text-left">Avg Grade</th>
                          <th className="px-3 py-2 text-left">Min</th>
                          <th className="px-3 py-2 text-left">Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseOverview.map((c: any) => (
                          <tr key={c.course_code} className="border-t">
                            <td className="px-3 py-2 font-medium">
                              {c.course_code} - {c.course_title}
                            </td>
                            <td className="px-3 py-2">{c.section_count}</td>
                            <td className="px-3 py-2">{c.student_count}</td>
                            <td className="px-3 py-2">{c.pass_rate}%</td>
                            <td className="px-3 py-2">{c.avg_score}</td>
                            <td className="px-3 py-2">{c.min_score}</td>
                            <td className="px-3 py-2">{c.max_score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {perfDetails.map((section: any) => {
                if (!section.components || section.components.length === 0)
                  return null;
                const chartData = section.components.map((comp: any) => ({
                  name: comp.component_name,
                  "Pass Rate": comp.pass_rate ?? 0,
                  "Avg Score": comp.average_score ?? 0,
                }));
                return (
                  <div
                    key={section.section_id}
                    className="rounded-lg border border-[#DED7CB] bg-white p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {section.course_code} - {section.course_title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {section.section_name
                            ? `Section ${section.section_name}`
                            : ""}{" "}
                          - {section.semester} {section.year}
                        </p>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-green-700">
                          Pass:{" "}
                          {section.components.reduce(
                            (s: number, c: any) => s + (c.pass_count || 0),
                            0,
                          )}
                        </span>
                        <span className="text-red-700">
                          Fail:{" "}
                          {section.components.reduce(
                            (s: number, c: any) => s + (c.fail_count || 0),
                            0,
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Bar
                            dataKey="Pass Rate"
                            fill="#7A263A"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="Avg Score"
                            fill="#C4956A"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "Email" && (
            <button
              className="bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
              onClick={async () => {
                const subject = prompt("Subject") || "";
                const message = prompt("Message") || "";
                if (!subject || !message) return;
                await api.post(`/users/professors/${id}/email`, {
                  subject,
                  message,
                });
                await load();
              }}
            >
              Send email to professor
            </button>
          )}

          {tab === "Activity Logs" && (
            <SimpleTable
              headers={["Action", "IP", "Time"]}
              rows={(data.activityLogs || []).map((l) => [
                l.action,
                l.ip_address || "-",
                new Date(l.created_at).toLocaleString(),
              ])}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-3 py-2 border-b">
      <p className="font-medium">{k}</p>
      <p className="col-span-2">{v}</p>
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  footer,
}: {
  headers: string[];
  rows: Array<Array<string | number | JSX.Element>>;
  footer?: JSX.Element;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-[#F1EFEA]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td
                colSpan={headers.length}
                className="px-3 py-8 text-center text-gray-500"
              >
                No records
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
