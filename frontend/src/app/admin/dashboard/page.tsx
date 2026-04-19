"use client";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Users,
  BookOpen,
  Building,
  GraduationCap,
  Activity,
  ShieldAlert,
  DollarSign,
  ArrowRight,
} from "lucide-react";

type AdminDashboardData = {
  totalStudents: number;
  totalProfessors: number;
  totalCourses: number;
  activeEnrollments: number;
  blockedUsers: number;
  pendingExemptions: number;
  totalRevenue: number;
  recentActivities: Array<{ description: string; time: string }>;
};

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      api
        .get<any>("/dashboard/admin")
        .then((res) => {
          if (res.success) setData(res.data);
        })
        .catch(console.error);
    }
  }, [user]);

  if (isLoading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );

  if (user?.role !== "admin") {
    return (
      <div className="p-6 text-gray-700">
        Access denied. This page is for administrators only.
      </div>
    );
  }

  const stats = [
    {
      label: "Active Students",
      value: data?.totalStudents ?? 0,
      icon: Users,
      iconBoxClass: "bg-primary-100",
      iconClass: "text-primary-600",
    },
    {
      label: "Professors",
      value: data?.totalProfessors ?? 0,
      icon: GraduationCap,
      iconBoxClass: "bg-emerald-100",
      iconClass: "text-emerald-600",
    },
    {
      label: "Total Courses",
      value: data?.totalCourses ?? 0,
      icon: BookOpen,
      iconBoxClass: "bg-violet-100",
      iconClass: "text-violet-600",
    },
    {
      label: "Active Enrollments",
      value: data?.activeEnrollments ?? 0,
      icon: Building,
      iconBoxClass: "bg-amber-100",
      iconClass: "text-amber-600",
    },
  ];

  const actions: Array<{
    href?: string;
    label: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    available: boolean;
  }> = [
    {
      href: "/admin/students",
      label: "Manage Students",
      icon: Users,
      available: true,
    },
    {
      href: "/admin/students/create",
      label: "Add Student",
      icon: GraduationCap,
      available: true,
    },
    {
      href: "/admin/faculty",
      label: "Manage Faculty",
      icon: GraduationCap,
      available: true,
    },
    {
      href: "/admin/courses",
      label: "Manage Courses",
      icon: BookOpen,
      available: true,
    },
    { label: "Audit Logs", icon: Activity, available: false },
    { label: "Exemptions", icon: Building, available: false },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="bg-gradient-to-r from-[#7A263A] via-[#6A1F31] to-[#531627] rounded-xl shadow-lg p-6 text-white">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-2 text-[#F5E7DD]">
            System overview and management insights across the university.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.iconBoxClass}`}>
                  <stat.icon className={stat.iconClass} size={24} />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#FDF2F3] border border-[#F3CFD4] rounded-xl p-5 flex items-center gap-3 shadow-sm">
            <ShieldAlert className="text-[#B63E57]" size={24} />
            <div>
              <p className="font-semibold text-[#8D2A41]">Blocked Users</p>
              <p className="text-2xl font-bold text-[#A7354D]">
                {data?.blockedUsers ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-[#FFF9ED] border border-[#F1E1B9] rounded-xl p-5 flex items-center gap-3 shadow-sm">
            <Activity className="text-[#B7842D]" size={24} />
            <div>
              <p className="font-semibold text-[#8B6723]">Pending Exemptions</p>
              <p className="text-2xl font-bold text-[#A67326]">
                {data?.pendingExemptions ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-[#F3FAF5] border border-[#CBE8D3] rounded-xl p-5 flex items-center gap-3 shadow-sm">
            <DollarSign className="text-[#3E8E63]" size={24} />
            <div>
              <p className="font-semibold text-[#2F6E4D]">Total Revenue</p>
              <p className="text-2xl font-bold text-[#347A55]">
                ${data?.totalRevenue ?? 0}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#FCFBF8] rounded-xl p-6 shadow-sm border border-[#E7E2D9]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Login Activity
            </h2>
            <div className="space-y-3">
              {data?.recentActivities?.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 bg-[#F1EFEA] rounded-lg"
                >
                  <Activity
                    className="text-primary-600 mt-0.5 shrink-0"
                    size={16}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {a.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(a.time).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {!data?.recentActivities?.length && (
                <p className="text-gray-500 text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </div>

          <div className="bg-[#FCFBF8] rounded-xl p-6 shadow-sm border border-[#E7E2D9]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {actions.map((action) => {
                const content = (
                  <>
                    <div className="flex items-center gap-2">
                      <action.icon
                        className="text-primary-600 shrink-0"
                        size={18}
                      />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {action.label}
                        </p>
                        {!action.available && (
                          <p className="text-xs text-gray-500">Coming soon</p>
                        )}
                      </div>
                    </div>
                    <ArrowRight
                      className={
                        action.available ? "text-primary-500" : "text-gray-400"
                      }
                      size={16}
                    />
                  </>
                );

                if (action.available && action.href) {
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="p-3 border border-[#DED7CB] bg-[#F7F4EE] rounded-lg hover:border-[#C4B090] hover:bg-[#F2EBDD] transition-colors flex items-center justify-between gap-3"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={action.label}
                    className="p-3 border border-[#E7E1D6] bg-[#F8F6F1] rounded-lg opacity-80 flex items-center justify-between gap-3"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
