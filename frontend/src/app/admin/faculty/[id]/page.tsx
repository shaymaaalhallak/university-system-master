"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

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
  "Grading Control",
  "Assignments & Exams",
  "Schedule",
  "Performance Overview",
  "Email",
  "Activity Logs",
] as const;

type Tab = (typeof tabs)[number];

export default function FacultyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Profile");
  const [data, setData] = useState<FacultyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<ApiResponse<FacultyDetails>>(
        `/users/professors/${id}`,
      );
      if (res.success) setData(res.data);
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

  if (loading) return <div className="p-6">Loading professor details...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6">No data found.</div>;

  const p = data.profile;

  return (
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
        {tab === "Profile" && (
          <div className="space-y-2 text-sm">
            <Row k="Name" v={`${p.first_name} ${p.last_name}`} />
            <Row k="Email" v={p.email} />
            <Row k="Phone" v={p.phone || "-"} />
            <Row k="Department" v={p.department_name || "-"} />
            <Row k="Title" v={p.title || "Professor"} />
            <Row
              k="Hire date"
              v={p.hire_date ? new Date(p.hire_date).toLocaleDateString() : "-"}
            />
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
          <SimpleTable
            headers={["Course", "Semester", "Year", "Room", "Schedule"]}
            rows={(data.sections || []).map((s) => [
              `${s.course_code} ${s.course_title}`,
              s.semester,
              s.year,
              s.room || "-",
              s.schedule || "-",
            ])}
            footer={
              <button
                className="mt-3 bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                onClick={async () => {
                  const courseId = prompt("Course ID");
                  const semester = prompt("Semester (e.g. Fall)");
                  const year = prompt("Year");
                  const room = prompt("Room") || "";
                  const schedule = prompt("Schedule") || "";
                  if (!courseId || !semester || !year) return;
                  await api.post(`/users/professors/${id}/sections`, {
                    courseId,
                    semester,
                    year,
                    room,
                    schedule,
                  });
                  await load();
                }}
              >
                Assign course / open section
              </button>
            }
          />
        )}

        {tab === "Course Eligibility" && (
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
            footer={
              <button
                className="mt-3 bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                onClick={async () => {
                  const courseId = prompt("Course ID from catalog") || "";
                  const eligibilityType =
                    prompt("Type: primary or secondary") || "secondary";
                  if (!courseId) return;
                  await api.post(`/users/professors/${id}/eligibility`, {
                    courseId,
                    eligibilityType,
                  });
                  await load();
                }}
              >
                Add eligible course
              </button>
            }
          />
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

        {tab === "Grading Control" && (
          <SimpleTable
            headers={["Course", "Open grading", "Actions"]}
            rows={(data.gradingControl || []).map((g) => [
              `${g.course_code} ${g.course_title}`,
              g.is_enabled ? "Open" : "Closed",
              <div key={g.section_id} className="flex gap-2">
                <button
                  className="text-black"
                  onClick={() =>
                    api
                      .post(`/admin/grade-entry/${g.section_id}/enable`)
                      .then(load)
                  }
                >
                  Open
                </button>
                <button
                  className="text-black"
                  onClick={() =>
                    api
                      .post(`/admin/grade-entry/${g.section_id}/disable`)
                      .then(load)
                  }
                >
                  Close
                </button>
              </div>,
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
                e.exam_date ? new Date(e.exam_date).toLocaleDateString() : "-",
              ])}
            />
          </div>
        )}

        {tab === "Schedule" && (
          <SimpleTable
            headers={["Course", "Semester", "Year", "Room", "Schedule"]}
            rows={(data.schedule || []).map((s) => [
              s.course_code,
              s.semester,
              s.year,
              s.room || "-",
              s.schedule || "-",
            ])}
          />
        )}

        {tab === "Performance Overview" && (
          <div className="space-y-2">
            <Row
              k="Average student grade"
              v={
                data.performance?.average_grade
                  ? Number(data.performance.average_grade).toFixed(2)
                  : "-"
              }
            />
            <Row k="Pass rate" v={`${passRate}%`} />
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
