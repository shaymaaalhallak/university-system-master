"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await login({ email, password });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Unable to connect. Make sure the backend server is running.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7f1e7_0%,#ead7bd_55%,#d6bd9d_100%)] text-[#26151a]">
      <div className="mx-auto flex min-h-screen max-w-7xl items-stretch px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/40 bg-white/50 shadow-[0_30px_80px_rgba(78,16,32,0.18)] backdrop-blur lg:grid-cols-[0.92fr_1.08fr]">
          <div className="flex flex-col justify-between bg-[#fff9f0] p-8 sm:p-10 lg:p-12">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#7a1126] transition hover:text-[#5f0d1e]">
                <ArrowLeft size={16} />
                Back to home
              </Link>

              <div className="mt-8 flex items-center gap-4">
                <Image
                  src="/branding/wiu-logo.webp"
                  alt="WIU logo"
                  width={72}
                  height={72}
                  className="h-16 w-16 rounded-full border border-[#cfab74] bg-white p-1 shadow-sm"
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#8a5a44]">Wadi International University</p>
                  <h1 className="mt-1 text-3xl font-black text-[#4e1020]">Portal Login</h1>
                </div>
              </div>

              <p className="mt-6 max-w-md text-base leading-7 text-[#6b5848]">
                Access the WIU academic portal for courses, attendance, assignments, grades,
                fees, and faculty tools in one place.
              </p>

              {error && (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#5c463a]">
                    University Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9b7d66]" />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc8a9] bg-white px-12 py-3.5 text-[#26151a] outline-none transition focus:border-[#b57639] focus:ring-4 focus:ring-[#e8cda3]/45"
                      placeholder="you@wiu.edu.sy"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#5c463a]">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9b7d66]" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-[#ddc8a9] bg-white px-12 py-3.5 text-[#26151a] outline-none transition focus:border-[#b57639] focus:ring-4 focus:ring-[#e8cda3]/45"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9b7d66] transition hover:text-[#7a1126]"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#7a1126] px-5 py-3.5 font-semibold text-white shadow-[0_20px_35px_rgba(122,17,38,0.22)] transition hover:bg-[#5f0d1e] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Signing in..." : "Sign In to WIU Portal"}
                </button>
              </form>
            </div>

            {/* <div className="mt-8 rounded-[1.5rem] border border-[#e1cfb4] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#8a5a44]">Demo Accounts</p>
              <div className="mt-4 grid gap-3 text-sm text-[#5f4a3d]">
                <div className="rounded-xl bg-[#fff7eb] px-4 py-3"><span className="font-semibold text-[#4e1020]">Admin:</span> admin@university.edu</div>
                <div className="rounded-xl bg-[#fff7eb] px-4 py-3"><span className="font-semibold text-[#4e1020]">Professor:</span> professor@university.edu</div>
                <div className="rounded-xl bg-[#fff7eb] px-4 py-3"><span className="font-semibold text-[#4e1020]">Student:</span> student@university.edu</div>
              </div>
            </div> */}
          </div>

          <div className="relative hidden lg:block">
            <Image
              src="/branding/wiu-campus.jpg"
              alt="Wadi International University campus"
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(78,16,32,0.12),rgba(78,16,32,0.85))]" />

            <div className="absolute inset-0 p-10">
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-center justify-between gap-6">
                  <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-white backdrop-blur-md">
                    <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#f3c783]">Campus Entrance</p>
                    <p className="mt-2 text-2xl font-black">Wadi International University</p>
                    <p className="text-sm text-[#f4e2cb]">Wadi International University</p>
                  </div>

                  <Image
                    src="/branding/wiu-logo.webp"
                    alt="WIU emblem"
                    width={110}
                    height={110}
                    className="h-24 w-24 rounded-full border border-white/20 bg-white/75 p-1 shadow-xl"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    "Assignments and deadlines",
                    "Attendance and grading",
                    "Academic identity and records",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-sm font-medium text-white backdrop-blur-md"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
