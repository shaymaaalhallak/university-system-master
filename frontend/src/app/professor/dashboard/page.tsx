"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Users,
  FileSpreadsheet,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
export default function ProfessorDashboard() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === "professor") {
      api
        .get<any>("/dashboard/professor")
        .then((res) => {
          if (res.success) setData(res.data);
        })
        .catch(console.error);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#7a1126]" />
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

  const statCards = [
    {
      label: "Sections Teaching",
      value: data?.coursesTeaching ?? 0,
      icon: BookOpen,
      tone: "from-[#7a1126] to-[#a44745]",
    },
    {
      label: "Total Students",
      value: data?.totalStudents ?? 0,
      icon: Users,
      tone: "from-[#b57639] to-[#d19a52]",
    },
    {
      label: "Pending Grading",
      value: data?.pendingGrading ?? 0,
      icon: ClipboardCheck,
      tone: "from-[#4e1020] to-[#7a1126]",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 text-black">
        <section className="overflow-hidden rounded-[2rem] border border-[#dfccb0] bg-[linear-gradient(135deg,#fff8ee_0%,#f2e1c8_48%,#e1c8a2_100%)] shadow-[0_24px_70px_rgba(88,51,30,0.08)]">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#8a5a44]">
                Professor Workspace
              </p>
              <h2 className="mt-4 text-4xl font-black leading-tight text-[#4e1020]">
                Welcome back, Professor {user?.lastName}.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-[#6b5848]">
                Review your sections, manage academic records, and move quickly
                between attendance, grading, assignments, and your faculty
                profile.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/professor/grades"
                  className="inline-flex items-center gap-2 rounded-full bg-[#7a1126] px-6 py-3 font-semibold text-white transition hover:bg-[#5f0d1e]"
                >
                  Open Gradebook
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/professor/assignments"
                  className="inline-flex items-center gap-2 rounded-full border border-[#bb9057] bg-white/70 px-6 py-3 font-semibold text-[#6c1730] transition hover:bg-white"
                >
                  Manage Assignments
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-[1.5rem] border border-white/45 bg-white/70 p-5 shadow-sm backdrop-blur"
                >
                  <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.tone} text-white`}
                  >
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

        <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h3 className="text-2xl font-black text-[#4e1020]">
                My Sections
              </h3>
              <span className="rounded-full bg-[#fff7eb] px-4 py-2 text-sm font-medium text-[#8a5a44]">
                {data?.sections?.length ?? 0} active sections
              </span>
            </div>

            <div className="space-y-4">
              {data?.sections?.map((section: any) => (
                <div
                  key={section.sectionId}
                  className="rounded-[1.4rem] border border-[#eadcc6] bg-[#fffaf3] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-bold text-[#4e1020]">
                        {section.courseName}{" "}
                        <span className="text-sm font-medium text-[#8a5a44]">
                          ({section.courseCode})
                        </span>
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[#6b5848]">
                        {section.time} • {section.room} • {section.enrolled}{" "}
                        students
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${section.gradeEntryEnabled ? "bg-green-100 text-green-700" : "bg-[#efe4d7] text-[#8a5a44]"}`}
                    >
                      {section.gradeEntryEnabled
                        ? "Grades open"
                        : "Grades closed"}
                    </span>
                  </div>
                </div>
              ))}
              {!data?.sections?.length && (
                <p className="py-4 text-center text-[#8a5a44]">
                  No sections assigned yet.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
              <h3 className="mb-5 text-2xl font-black text-[#4e1020]">
                Quick Actions
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    href: "/professor/attendance",
                    label: "Attendance",
                    icon: Calendar,
                  },
                  {
                    href: "/professor/grades",
                    label: "Gradebook",
                    icon: GraduationCap,
                  },
                  {
                    href: "/professor/assignments",
                    label: "Assignments",
                    icon: FileText,
                  },
                  {
                    href: "/professor/export",
                    label: "Export Excel",
                    icon: FileSpreadsheet,
                  },

                  { href: "/professor/cv", label: "My CV", icon: Users },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="rounded-[1.4rem] border border-[#eadcc6] bg-[#fff8ee] p-5 transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <action.icon className="mb-4 text-[#7a1126]" size={22} />
                    <p className="font-bold text-[#4e1020]">{action.label}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[#e2d2bc] bg-[#4e1020] p-7 text-white shadow-[0_22px_55px_rgba(73,36,22,0.15)]">
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#f0c98c]">
                Teaching focus
              </p>
              <h3 className="mt-3 text-2xl font-black">
                Keep academic work moving from one place.
              </h3>
              <p className="mt-4 leading-7 text-[#eadbc4]">
                The professor area is now aligned with the new WIU visual system
                so course management, attendance, grading, assignments, and CV
                updates feel like one connected workspace.
              </p>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
