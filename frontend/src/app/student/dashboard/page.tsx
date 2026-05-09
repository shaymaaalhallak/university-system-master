"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  DollarSign,
  Megaphone,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";

interface DashboardData {
  gpa: string;
  credits: number;
  attendance: number;
  pendingFees: number;
  upcomingClasses: Array<{
    courseName: string;
    time: string;
    room: string;
    professor: string;
  }>;
  pendingAssignments: Array<{
    id: string;
    title: string;
    course: string;
    dueDate: string;
  }>;
  recentAnnouncements: Array<{
    id: string;
    title: string;
    date: string;
  }>;
  studyPlan?: {
    enrollmentYear: number;
    planNames: string[];
    semesters: Array<{
      yearNo: number;
      semesterNo: number;
      calendarYear: number | null;
      isFlexible: boolean;
      courses: Array<{
        code: string;
        name: string;
        credits: number;
        bucket: string;
        prerequisites: Array<{ course_code: string; course_title: string }>;
      }>;
    }>;
  };
}

export default function StudentDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [droppingId, setDroppingId] = useState<number | null>(null);
  const [dropMsg, setDropMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  const loadEnrolledCourses = async () => {
    try {
      setLoadingCourses(true);
      const res = await api.get<any>("/enrollments/my");
      if (res.success) setEnrolledCourses(res.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleDrop = async (enrollmentId: number) => {
    if (!confirm("Are you sure you want to drop this course?")) return;
    try {
      setDroppingId(enrollmentId);
      setDropMsg(null);
      await api.delete(`/enrollments/${enrollmentId}`);
      setDropMsg("Course dropped successfully.");
      loadEnrolledCourses();
    } catch {
      setDropMsg("Failed to drop course.");
    } finally {
      setDroppingId(null);
    }
  };

  useEffect(() => {
    if (user?.role === "student") {
      api
        .get<any>("/dashboard/student")
        .then((res) => {
          if (res.success) setData(res.data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
      loadEnrolledCourses();
    }
  }, [user]);

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#7a1126]" />
      </div>
    );
  }

  if (user?.role !== "student") return null;

  const statCards = [
    { label: "Current GPA", value: data?.gpa ?? "-", icon: TrendingUp },
    { label: "Credits", value: data?.credits ?? 0, icon: BookOpen },
    { label: "Attendance", value: `${data?.attendance ?? 0}%`, icon: Calendar },
    {
      label: "Pending Fees",
      value: `$${data?.pendingFees ?? 0}`,
      icon: DollarSign,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 text-black">
        <section className="overflow-hidden rounded-[2rem] border border-[#dfccb0] bg-[linear-gradient(135deg,#fff8ee_0%,#f2e1c8_48%,#e1c8a2_100%)] shadow-[0_24px_70px_rgba(88,51,30,0.08)]">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.08fr_0.92fr] lg:p-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#8a5a44]">
                Student Workspace
              </p>
              <h2 className="mt-4 text-4xl font-black leading-tight text-[#4e1020]">
                Welcome back, {user?.firstName}.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-[#6b5848]">
                Stay on top of your semester with quick access to courses,
                assignments, attendance, grades, fees, and university
                announcements.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="/student/courses"
                  className="inline-flex items-center gap-2 rounded-full bg-[#7a1126] px-6 py-3 font-semibold text-white transition hover:bg-[#5f0d1e]"
                >
                  View My Courses
                  <ArrowRight size={18} />
                </a>
                <a
                  href="/student/assignments"
                  className="inline-flex items-center gap-2 rounded-full border border-[#bb9057] bg-white/70 px-6 py-3 font-semibold text-[#6c1730] transition hover:bg-white"
                >
                  Check Assignments
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-[1.5rem] border border-white/45 bg-white/70 p-5 shadow-sm backdrop-blur"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7a1126] to-[#b57639] text-white">
                    <card.icon size={22} />
                  </div>
                  <p className="text-sm text-[#8a5a44]">{card.label}</p>
                  <p className="mt-1 text-3xl font-black text-[#4e1020]">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
            <h3 className="mb-5 text-2xl font-black text-[#4e1020]">
              Upcoming Classes
            </h3>
            <div className="space-y-4">
              {data?.upcomingClasses?.length ? (
                data.upcomingClasses.map((cls, index) => (
                  <div
                    key={index}
                    className="rounded-[1.4rem] border border-[#eadcc6] bg-[#fffaf3] p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-[#4e1020]">
                          {cls.courseName}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-[#6b5848]">
                          {cls.professor} • {cls.room}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#f3e4cf] px-3 py-1 text-sm font-medium text-[#7a1126]">
                        {cls.time}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-[#8a5a44]">
                  No courses enrolled yet.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {dropMsg && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{dropMsg}</p>
            )}

            <div className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
              <h3 className="mb-5 text-2xl font-black text-[#4e1020]">Enrolled Courses</h3>
              <div className="space-y-3">
                {enrolledCourses.filter((e: any) => e.status === "active").length > 0 ? (
                  enrolledCourses.filter((e: any) => e.status === "active").map((e: any) => (
                    <div key={e.enrollment_id} className="flex items-center justify-between rounded-[1.4rem] border border-[#eadcc6] bg-[#fffaf3] p-4">
                      <div>
                        <p className="font-bold text-[#4e1020]">{e.course_code} - {e.course_title}</p>
                        <p className="text-sm text-[#8a5a44]">{e.semester} {e.year} • Prof. {e.prof_first} {e.prof_last}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDrop(e.enrollment_id)}
                        disabled={droppingId === e.enrollment_id}
                        className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        {droppingId === e.enrollment_id ? "..." : <Trash2 size={16} />}
                      </button>
                    </div>
                  ))
                ) : loadingCourses ? (
                  <p className="py-4 text-center text-[#8a5a44]">Loading...</p>
                ) : (
                  <p className="py-4 text-center text-[#8a5a44]">No active enrollments.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
              <div className="mb-5 flex items-center gap-3">
                <AlertCircle className="text-[#7a1126]" size={22} />
                <h3 className="text-2xl font-black text-[#4e1020]">
                  Pending Assignments
                </h3>
              </div>
              <div className="space-y-4">
                {data?.pendingAssignments?.length ? (
                  data.pendingAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="rounded-[1.4rem] border border-[#eadcc6] bg-[#fff8ee] p-5"
                    >
                      <p className="font-bold text-[#4e1020]">
                        {assignment.title}
                      </p>
                      <p className="mt-1 text-sm text-[#8a5a44]">
                        {assignment.course}
                      </p>
                      <p className="mt-3 text-sm font-medium text-[#7a1126]">
                        Due: {assignment.dueDate}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-[#8a5a44]">
                    No pending assignments.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[#e2d2bc] bg-[#4e1020] p-7 text-white shadow-[0_22px_55px_rgba(73,36,22,0.15)]">
              <div className="mb-5 flex items-center gap-3">
                <Megaphone className="text-[#f3c783]" size={22} />
                <h3 className="text-2xl font-black">Recent Announcements</h3>
              </div>
              <div className="space-y-4">
                {data?.recentAnnouncements?.length ? (
                  data.recentAnnouncements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="rounded-[1.3rem] border border-white/10 bg-white/10 p-4"
                    >
                      <p className="font-semibold">{announcement.title}</p>
                      <p className="mt-1 text-sm text-[#eadbc4]">
                        {new Date(announcement.date).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[#eadbc4]">No announcements.</p>
                )}
              </div>
            </div>
          </div>
        </section>
        <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
          <h3 className="text-2xl font-black text-[#4e1020]">My Study Plan</h3>
          <p className="mt-1 text-sm text-[#8a5a44]">
            {(data?.studyPlan?.planNames || []).join(" + ") ||
              "No assigned plan"}
          </p>
          <div className="mt-5 space-y-4">
            {(data?.studyPlan?.semesters || []).map((semester) => (
              <div
                key={`${semester.yearNo}-${semester.semesterNo}`}
                className={`rounded-xl border p-4 ${
                  semester.isFlexible
                    ? "border-blue-200 bg-blue-50"
                    : "border-[#eadcc6] bg-[#fffaf3]"
                }`}
              >
                <p className="font-bold text-[#4e1020]">
                  {semester.isFlexible
                    ? "Flexible Courses (Can be taken in any semester)"
                    : `Semester ${semester.semesterNo} (Year ${semester.yearNo} - ${semester.calendarYear})`}
                </p>
                <div className="mt-2 space-y-1 text-sm text-[#6b5848]">
                  {semester.courses.map((course) => (
                    <div
                      key={`${semester.yearNo}-${semester.semesterNo}-${course.code}`}
                      className="py-1"
                    >
                      <p>
                        {course.code} - {course.name} - {course.credits} credits
                        {course.bucket !== "major"
                          ? ` (${
                              {
                                english: "English Course",
                                arabic: "Arabic Course",
                                culture: "Culture Course",
                              }[course.bucket] || course.bucket
                            })`
                          : " (Program Course)"}
                      </p>
                      {course.prerequisites &&
                        course.prerequisites.length > 0 && (
                          <p className="text-xs text-red-600 ml-4">
                            Prerequisites:{" "}
                            {course.prerequisites
                              .map(
                                (p: any) => `${p.course_code} - ${p.course_title}`
                              )
                              .join(", ")}
                          </p>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!data?.studyPlan?.semesters?.length && (
              <p className="text-sm text-[#8a5a44]">
                No study plan items available for your specialization yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
