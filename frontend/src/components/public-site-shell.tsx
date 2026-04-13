import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import { ReactNode } from "react";

type PublicShellProps = {
  current: "about" | "academics" | "admissions" | "contact" | "courses";
  title: string;
  subtitle: string;
  eyebrow?: string;
  children: ReactNode;
};

const navItems = [
  { href: "/about", label: "About", key: "about" },
  { href: "/academics", label: "Academics", key: "academics" },
  { href: "/courses-catalog", label: "Courses", key: "courses" },
  { href: "/admissions", label: "Admissions", key: "admissions" },
  { href: "/contact", label: "Contact", key: "contact" },
] as const;

export default function PublicSiteShell({
  current,
  title,
  subtitle,
  eyebrow = "Wadi International University",
  children,
}: PublicShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f1e7] text-[#26151a]">
      <header className="sticky top-0 z-30 border-b border-[#d7c2a1]/60 bg-[#f7f1e7]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/branding/wiu-logo.webp"
              alt="Wadi International University logo"
              width={54}
              height={54}
              className="h-12 w-12 rounded-full border border-[#c9a46a] bg-white object-cover shadow-sm"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a5a44]">
                Wadi International University
              </p>
              <p className="text-lg font-black tracking-wide text-[#5b1020]">WIU Portal</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-[#5f4a3d] md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.key === current ? "text-[#7a1126]" : "transition hover:text-[#7a1126]"}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-[#b88b52] px-4 py-2 text-sm font-semibold text-[#6c1730] transition hover:bg-[#fff8ee]"
            >
              Login
            </Link>
            {/* <Link
              href="/register"
              className="rounded-full bg-[#7a1126] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#5f0d1e]"
            >
              Apply Now
            </Link> */}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f5d9ab_0%,transparent_38%),linear-gradient(135deg,#f7f1e7_15%,#eadcc6_50%,#d8c5ab_100%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.32em] text-[#8a5a44]">{eyebrow}</p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-[#4e1020] sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f4a3d]">{subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#7a1126] px-6 py-3 font-semibold text-white transition hover:bg-[#5f0d1e]"
              >
                Enter Portal
                <ArrowRight size={18} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-[#b88b52] bg-white/70 px-6 py-3 font-semibold text-[#6c1730] transition hover:bg-white"
              >
                Contact WIU
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/40 p-3 shadow-[0_30px_80px_rgba(78,16,32,0.18)] backdrop-blur">
              <div className="relative overflow-hidden rounded-[1.6rem]">
                <Image
                  src="/branding/wiu-campus.jpg"
                  alt="Wadi International University campus"
                  width={1200}
                  height={800}
                  className="h-[420px] w-full object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2a1020]/85 via-[#2a1020]/20 to-transparent" />

                <div className="absolute left-6 right-6 top-6 flex items-start justify-between gap-4">
                  <div className="rounded-2xl border border-white/30 bg-[#fff4de]/85 px-4 py-3 shadow-lg backdrop-blur">
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#8a5a44]">Campus View</p>
                    <p className="mt-1 text-lg font-bold text-[#4e1020]">Wadi International University</p>
                    <p className="text-sm text-[#6b5848]">Syria, Homs, Wadi al-Nasara</p>
                  </div>
                  <Image
                    src="/branding/wiu-logo.webp"
                    alt="WIU emblem"
                    width={88}
                    height={88}
                    className="h-20 w-20 rounded-full border border-white/30 bg-white/80 p-1 shadow-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">{children}</main>

      <footer className="bg-[#4e1020] py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <Image
                src="/branding/wiu-logo.webp"
                alt="WIU logo"
                width={52}
                height={52}
                className="h-12 w-12 rounded-full border border-white/20 bg-white/75 p-1"
              />
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#f0c98c]">
                  Wadi International University
                </p>
                <p className="text-xl font-black">Digital Academic Portal</p>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-[#eadbc4]">
              A university experience centered on academics, student services, professor workflows,
              and institutional identity for WIU.
            </p>
          </div>

          <div className="grid gap-4 text-sm text-[#eadbc4] sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <Phone size={18} className="text-[#f3c783]" />
              <span>+963317439800</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-[#f3c783]" />
              <span>info@wiu.edu.sy</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-[#f3c783]" />
              <span>Wadi al-Nasara, Syria</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
