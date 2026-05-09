"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  BookOpen,
  Calendar,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  ScrollText,
  UserSquare2,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const studentLinks = [
    { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/courses", label: "My Courses", icon: BookOpen },
    { href: "/student/grades", label: "Grades", icon: GraduationCap },
    { href: "/student/attendance", label: "Attendance", icon: Calendar },
    { href: "/student/assignments", label: "Assignments", icon: ScrollText },
    { href: "/student/fees", label: "Fees", icon: Receipt },
  ];

  const professorLinks = [
    { href: "/professor/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/professor/attendance", label: "Attendance", icon: Calendar },
    { href: "/professor/grades", label: "Gradebook", icon: GraduationCap },
    { href: "/professor/assignments", label: "Assignments", icon: ScrollText },
        { href: "/professor/export", label: "Export Excel", icon: FileSpreadsheet },

    { href: "/professor/cv", label: "My CV", icon: UserSquare2 },
  ];

  const adminLinks = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/courses", label: "Courses", icon: BookOpen },
    {
      href: "/admin/grading-control",
      label: "Grade Booking",
      icon: GraduationCap,
    },
    { href: "/admin/fees", label: "Fee Management", icon: DollarSign },
  ];

  const links =
    user?.role === "admin"
      ? adminLinks
      : user?.role === "professor"
        ? professorLinks
        : studentLinks;
  useEffect(() => {
    if (user?.mustChangePassword && pathname !== "/force-change-password") {
      router.push("/force-change-password");
    }
  }, [user?.mustChangePassword, pathname, router]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffaf3_0%,#f6eee2_100%)] text-[#26151a]">
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-2xl border border-[#d6c1a1] bg-white/90 p-3 text-[#7a1126] shadow-lg backdrop-blur"
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-72 border-r border-[#dbc7aa] bg-[#4e1020] text-white shadow-2xl transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-6 py-6">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/branding/wiu-logo.webp"
                alt="WIU logo"
                width={54}
                height={54}
                className="h-12 w-12 rounded-full border border-white/20 bg-white/80 p-1"
              />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#f0c98c]">
                  WIU Portal
                </p>
                <p className="text-sm text-[#f2e5d3]">
                  Wadi International University
                </p>
              </div>
            </Link>
          </div>

          <div className="px-6 pt-6">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f0c98c]">
                Signed in as
              </p>
              <p className="mt-2 text-lg font-bold">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm capitalize text-[#eadbc4]">{user?.role}</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
            {links.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                    active
                      ? "bg-[#f3c783] text-[#4e1020] shadow-lg"
                      : "text-[#f2e5d3] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={19} />
                  <span className="font-medium">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 font-medium text-[#f8e7d3] transition hover:bg-white/15"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-72">
        <header className="border-b border-[#e3d3bc] bg-[#fff7eb]/85 backdrop-blur">
          <div className="flex items-center justify-between px-6 py-5 lg:px-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#8a5a44]">
                Academic Workspace
              </p>
              <h1 className="mt-1 text-xl font-black text-[#4e1020]">
                Wadi International University
              </h1>
            </div>
            <div className="hidden items-center gap-3 rounded-full border border-[#e1cfb4] bg-white px-4 py-2 text-sm text-[#6b5848] md:flex">
              <Image
                src="/branding/wiu-logo.webp"
                alt="WIU emblem"
                width={28}
                height={28}
                className="h-7 w-7 rounded-full border border-[#dcc6a6] bg-white"
              />
              Branded academic portal
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
