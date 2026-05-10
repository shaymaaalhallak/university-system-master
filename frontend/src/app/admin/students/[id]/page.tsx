"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
type ApiResponse<T> = { success: boolean; data: T; message?: string };

type StudentDetailResponse = {
  profile: {
    user_id: number;
    student_id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    department_name: string | null;
    program_name: string | null;
    semester: number | null;
    gpa: number | null;
    status: "active" | "blocked";
  };
  enrollments: any[];
  grades: any[];
  attendance: any[];
  payments: any[];
  examRequests: any[];
  library: any[];
  notifications: any[];
  activityLogs: any[];
};

const tabs = [
  "Profile",
  "Enrollments",
  "Grades & GPA",
  "Attendance",
  "Payments",
  "Exams & Requests",
  "Library",
  "Notifications",
  "Activity Logs",
] as const;

type Tab = (typeof tabs)[number];

export default function StudentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Profile");
  const [data, setData] = useState<StudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<ApiResponse<StudentDetailResponse>>(
        `/users/students/${id}`,
      );
      if (res.success) setData(res.data);
    } catch (error: any) {
      setError(
        error?.response?.data?.message || "Failed to load student details",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const attendancePercent = useMemo(() => {
    const rows = data?.attendance || [];
    if (!rows.length) return 0;
    const presentCount = rows.filter((r) => r.status === "present").length;
    return Math.round((presentCount / rows.length) * 100);
  }, [data?.attendance]);

  const isStrongPassword = (pw: string): boolean => {
    if (pw.length < 8) return false;
    if (!/[A-Z]/.test(pw)) return false;
    if (!/[a-z]/.test(pw)) return false;
    if (!/[0-9]/.test(pw)) return false;
    if (!/[^A-Za-z0-9]/.test(pw)) return false;
    return true;
  };

  const resetPassword = async () => {
    const newPassword = prompt(
      "Enter new password (min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special character)",
    );
    if (!newPassword) return;
    if (!isStrongPassword(newPassword)) {
      alert(
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a digit, and a special character.",
      );
      return;
    }
    await api.post(`/users/${id}/reset-password`, { newPassword });
    alert("Password reset successful");
  };

  const addPayment = async () => {
    const amount = prompt("Amount?");
    if (!amount) return;
    await api.post(`/users/students/${id}/payments`, {
      amount,
      status: "pending",
    });
    await load();
  };

  const sendNotification = async () => {
    const title = prompt("Notification title");
    const message = prompt("Notification message");
    if (!title || !message) return;
    await api.post(`/users/students/${id}/notifications`, { title, message });
    await load();
  };

  const updateExamRequest = async (
    requestId: number,
    nextStatus: "approved" | "rejected",
  ) => {
    const adminNote = prompt("Optional admin note") || "";
    await api.post(`/users/students/${id}/exam-requests/${requestId}/status`, {
      status: nextStatus,
      adminNote,
    });
    await load();
  };

  const markPaid = async (paymentId: number) => {
    await api.post(`/users/students/${id}/payments/${paymentId}/pay`, {
      paymentMethod: "admin_entry",
    });
    await load();
  };

  if (loading) return <div className="p-6">Loading student details...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data)
    return (
      <div className="p-6 text-gray-600">Student details not available.</div>
    );

  const p = data.profile;

  return (
    <DashboardLayout>
      <div className="space-y-4 bg-[#FCFBF8] text-black p-3 rounded-xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Student Details Page
            </h1>
            <p className="text-gray-500">
              {p.first_name} {p.last_name}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/admin/students/${id}/edit`}
              className="px-3 py-2 rounded-lg border"
            >
              Edit Student
            </Link>
            <Link
              href="/admin/students"
              className="px-3 py-2 rounded-lg text-black"
            >
              Back to list
            </Link>
          </div>
        </div>

        <div className="bg-[#FCFBF8] rounded-xl border border-[#E7E2D9] p-3 flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 rounded-lg whitespace-nowrap border border-black ${t === tab ? "bg-gray-200 text-black" : "bg-white text-black"}`}
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
              <Row k="Program" v={p.program_name || "-"} />
              <Row k="Semester" v={String(p.semester ?? "-")} />
              <Row k="GPA" v={String(p.gpa ?? "-")} />
              <Row k="Status" v={p.status} />
              <div className="pt-4 flex gap-2">
                <Link
                  className="border border-[#DED7CB] bg-white rounded-lg px-3 py-2 hover:bg-[#F2EBDD]"
                  href={`/admin/students/${id}/edit`}
                >
                  Edit
                </Link>
                <button
                  className="bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                  onClick={resetPassword}
                >
                  Reset password
                </button>
              </div>
            </div>
          )}

          {tab === "Enrollments" && (
            <SimpleTable
              headers={["Course", "Semester", "Status", "Action"]}
              rows={(data.enrollments || []).map((e) => [
                `${e.course_code || ""} ${e.course_title || ""}`,
                `${e.section_semester || ""} ${e.year || ""}`,
                e.status,
                <button
                  key={e.enrollment_id}
                  onClick={() =>
                    api
                      .post(`/users/students/${id}/drop`, {
                        enrollmentId: e.enrollment_id,
                      })
                      .then(load)
                  }
                  className="text-black"
                >
                  Drop course
                </button>,
              ])}
              footer={
                <button
                  className="mt-3 bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                  onClick={async () => {
                    const sectionId = prompt("Section ID to enroll");
                    if (!sectionId) return;
                    await api.post(`/users/students/${id}/enroll`, {
                      sectionId,
                    });
                    await load();
                  }}
                >
                  Enroll in new course
                </button>
              }
            />
          )}

          {tab === "Grades & GPA" && (
            <SimpleTable
              headers={[
                "Course",
                "Assignment",
                "Mid",
                "Final",
                "Total",
                "Grade",
              ]}
              rows={(data.grades || []).map((g) => [
                `${g.course_code || ""} ${g.course_title || ""}`,
                g.assignment_score,
                g.midterm_score,
                g.final_score,
                g.total_score,
                g.letter_grade,
              ])}
              footer={
                <a
                  href="/student/grades"
                  className="inline-block mt-3 bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                >
                  Open GPA Calculator
                </a>
              }
            />
          )}

          {tab === "Attendance" && (
            <SimpleTable
              headers={["Course ID", "Date", "Status"]}
              rows={(data.attendance || []).map((a) => [
                a.course_id,
                new Date(a.date).toLocaleDateString(),
                a.status,
              ])}
              footer={
                <p className="mt-3 font-semibold">
                  Attendance %: {attendancePercent}%
                </p>
              }
            />
          )}

          {tab === "Payments" && (
            <SimpleTable
              headers={["Date", "Amount", "Type", "Status", "Action"]}
              rows={(data.payments || []).map((pmt) => [
                pmt.payment_date
                  ? new Date(pmt.payment_date).toLocaleDateString()
                  : "-",
                `$${pmt.amount}`,
                pmt.payment_type,
                pmt.status,
                pmt.status === "pending" ? (
                  <button
                    key={pmt.payment_id}
                    className="text-black"
                    onClick={() => markPaid(pmt.payment_id)}
                  >
                    Mark as paid
                  </button>
                ) : (
                  "-"
                ),
              ])}
              footer={
                <button
                  onClick={addPayment}
                  className="mt-3 bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                >
                  Add payment
                </button>
              }
            />
          )}

          {tab === "Exams & Requests" && (
            <SimpleTable
              headers={["Request", "Status", "Admin Note", "Actions"]}
              rows={(data.examRequests || []).map((r) => [
                r.reason,
                r.status,
                r.admin_note || "-",
                <div key={r.exemption_id} className="flex gap-2">
                  <button
                    className="text-black"
                    onClick={() =>
                      updateExamRequest(r.exemption_id, "approved")
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="text-black"
                    onClick={() =>
                      updateExamRequest(r.exemption_id, "rejected")
                    }
                  >
                    Reject
                  </button>
                </div>,
              ])}
            />
          )}

          {tab === "Library" && (
            <SimpleTable
              headers={["Book ID", "Borrow Date", "Return Status"]}
              rows={(data.library || []).map((r) => [
                r.book_id,
                r.borrow_date
                  ? new Date(r.borrow_date).toLocaleDateString()
                  : "-",
                r.status || (r.return_date ? "returned" : "borrowed"),
              ])}
            />
          )}

          {tab === "Notifications" && (
            <SimpleTable
              headers={["Title", "Message", "Time"]}
              rows={(data.notifications || []).map((n) => [
                n.title,
                n.message,
                new Date(n.created_at).toLocaleString(),
              ])}
              footer={
                <button
                  onClick={sendNotification}
                  className="mt-3 bg-[#7A263A] text-white rounded-lg px-3 py-2 hover:bg-[#631F2F]"
                >
                  Send notification
                </button>
              }
            />
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
    <div className="grid grid-cols-3 border-b py-2">
      <p className="font-medium text-gray-700">{k}</p>
      <p className="col-span-2 text-gray-900">{v}</p>
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
    <DashboardLayout>
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
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2">
                    {cell}
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
    </DashboardLayout>
  );
}
