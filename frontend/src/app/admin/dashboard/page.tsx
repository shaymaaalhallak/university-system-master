"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Users, BookOpen, Building, GraduationCap, Activity, ShieldAlert } from "lucide-react";

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      // FIX: res is already response.data — use res.success not res.data.success
      api
        .get<any>("/dashboard/admin")
        .then((res) => { if (res.success) setData(res.data); })
        .catch(console.error);
    }
  }, [user]);

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  if (user?.role !== "admin") return <div className="p-6">Access denied. This page is for administrators only.</div>;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 opacity-90">System overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Active Students", value: data?.totalStudents ?? 0, icon: Users, color: "blue" },
          { label: "Professors", value: data?.totalProfessors ?? 0, icon: GraduationCap, color: "green" },
          { label: "Total Courses", value: data?.totalCourses ?? 0, icon: BookOpen, color: "purple" },
          { label: "Active Enrollments", value: data?.activeEnrollments ?? 0, icon: Building, color: "orange" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center gap-4">
              <div className={`p-3 bg-${stat.color}-100 rounded-lg`}>
                <stat.icon className={`text-${stat.color}-600`} size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <ShieldAlert className="text-red-500" size={24} />
          <div>
            <p className="font-semibold text-red-700">Blocked Users</p>
            <p className="text-2xl font-bold text-red-600">{data?.blockedUsers ?? 0}</p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <Activity className="text-yellow-500" size={24} />
          <div>
            <p className="font-semibold text-yellow-700">Pending Exemptions</p>
            <p className="text-2xl font-bold text-yellow-600">{data?.pendingExemptions ?? 0}</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <BookOpen className="text-green-500" size={24} />
          <div>
            <p className="font-semibold text-green-700">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600">${data?.totalRevenue ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent login/logout activity */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Login Activity</h2>
          <div className="space-y-3">
            {data?.recentActivities?.map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Activity className="text-blue-600 mt-0.5 shrink-0" size={16} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{a.description}</p>
                  <p className="text-xs text-gray-500">{new Date(a.time).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {!data?.recentActivities?.length && <p className="text-gray-500 text-center py-4">No recent activity</p>}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/admin/students", label: "Manage Students", icon: Users },
              { href: "/admin/faculty", label: "Manage Faculty", icon: GraduationCap },
              { href: "/admin/courses", label: "Manage Courses", icon: BookOpen },
              { href: "/admin/audit-logs", label: "Audit Logs", icon: Activity },
              { href: "/admin/grade-control", label: "Grade Control", icon: ShieldAlert },
              { href: "/admin/exemptions", label: "Exemptions", icon: Building },
            ].map((action) => (
              <a key={action.href} href={action.href} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                <action.icon className="text-indigo-600 shrink-0" size={18} />
                <p className="font-medium text-gray-900 text-sm">{action.label}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
