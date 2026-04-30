import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  Globe2,
  GraduationCap,
  Library,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const stats = [
  { value: "3", label: "Academic tracks" },
  { value: "2026", label: "Active intake" },
  { value: "1", label: "Unified digital portal" },
];

const pillars = [
  {
    title: "Modern Student Experience",
    text: "Attendance, assignments, grades, and fees live in one clear academic system.",
    icon: BookOpen,
  },
  {
    title: "Faculty-Focused Workflow",
    text: "Professors can manage sections, publish coursework, and update records with less friction.",
    icon: Users,
  },
  {
    title: "Institutional Identity",
    text: "The platform now reflects WIU visually with its logo, campus image, and bilingual personality.",
    icon: Award,
  },
];

export default function HomePage() {
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
              <p className="text-lg font-black tracking-wide text-[#5b1020]">
                WIU Portal
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-[#5f4a3d] md:flex">
            <Link href="/about" className="transition hover:text-[#7a1126]">
              About
            </Link>
            <Link href="/academics" className="transition hover:text-[#7a1126]">
              Academics
            </Link>
            <Link
              href="/courses-catalog"
              className="transition hover:text-[#7a1126]"
            >
              Courses
            </Link>
            <Link
              href="/admissions"
              className="transition hover:text-[#7a1126]"
            >
              Admissions
            </Link>
            <Link href="/contact" className="transition hover:text-[#7a1126]">
              Contact
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-[#b88b52] px-4 py-2 text-sm font-semibold text-[#6c1730] transition hover:bg-[#fff8ee]"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#f5d9ab_0%,transparent_38%),linear-gradient(135deg,#f7f1e7_15%,#eadcc6_50%,#d8c5ab_100%)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
            <div className="flex flex-col justify-center">
              <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#d4b182] bg-white/70 px-4 py-2 text-sm font-medium text-[#8a5a44] shadow-sm">
                <Sparkles size={16} />
                Digital campus experience for Wadi International University
              </div>

              <h1 className="max-w-3xl text-4xl font-black leading-tight text-[#4e1020] sm:text-5xl lg:text-6xl">
                A university portal that looks and feels like{" "}
                <span className="text-[#b57639]">WIU</span>.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f4a3d]">
                From course registration to assignments, attendance, grades, and
                faculty CVs, the platform now carries the identity of Wadi
                International University with a richer interface inspired by the
                campus itself.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-[#7a1126] px-6 py-3 font-semibold text-white transition hover:bg-[#5f0d1e]"
                >
                  Enter Portal
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 rounded-full border border-[#b88b52] bg-white/70 px-6 py-3 font-semibold text-[#6c1730] transition hover:bg-white"
                >
                  Discover WIU
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-[#d7c2a1] bg-white/75 p-5 shadow-[0_18px_45px_rgba(77,31,18,0.08)] backdrop-blur"
                  >
                    <div className="text-3xl font-black text-[#7a1126]">
                      {stat.value}
                    </div>
                    <div className="mt-1 text-sm text-[#6f5c4a]">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-10 hidden h-32 w-32 rounded-full bg-[#7a1126]/15 blur-3xl lg:block" />
              <div className="absolute -right-4 bottom-8 hidden h-36 w-36 rounded-full bg-[#d19a52]/25 blur-3xl lg:block" />

              <div className="relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/40 p-3 shadow-[0_30px_80px_rgba(78,16,32,0.18)] backdrop-blur">
                <div className="relative overflow-hidden rounded-[1.6rem]">
                  <Image
                    src="/branding/wiu-campus.jpg"
                    alt="Wadi International University campus"
                    width={1200}
                    height={800}
                    className="h-[460px] w-full object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2a1020]/85 via-[#2a1020]/20 to-transparent" />

                  <div className="absolute left-6 right-6 top-6 flex items-start justify-between">
                    <div className="rounded-2xl border border-white/30 bg-[#fff4de]/85 px-4 py-3 shadow-lg backdrop-blur">
                      <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#8a5a44]">
                        Campus View
                      </p>
                      <p className="mt-1 text-lg font-bold text-[#4e1020]">
                        Wadi International University
                      </p>
                    </div>
                    <Image
                      src="/branding/wiu-logo.webp"
                      alt="WIU emblem"
                      width={88}
                      height={88}
                      className="h-20 w-20 rounded-full border border-white/30 bg-white/80 p-1 shadow-lg"
                    />
                  </div>

                  <div className="absolute bottom-6 left-6 right-6 grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: Globe2, label: "International outlook" },
                      {
                        icon: ShieldCheck,
                        label: "Structured academic records",
                      },
                      { icon: GraduationCap, label: "Student-centered access" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white backdrop-blur-md"
                      >
                        <item.icon size={18} className="mb-2 text-[#f3c783]" />
                        <p className="text-sm font-medium">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-[#8a5a44]">
              Why this design direction
            </p>
            <h2 className="text-3xl font-black text-[#4e1020] sm:text-4xl">
              A more distinctive interface for the university, not a generic
              portal template.
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)] transition hover:-translate-y-1"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7a1126] to-[#b57639] text-white">
                  <pillar.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-[#4e1020]">
                  {pillar.title}
                </h3>
                <p className="mt-3 leading-7 text-[#6b5848]">{pillar.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#4e1020] py-20 text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-[#f0c98c]">
                Portal highlights
              </p>
              <h2 className="text-3xl font-black sm:text-4xl">
                Built around the daily rhythm of students, professors, and
                administration.
              </h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {[
                {
                  icon: Calendar,
                  title: "Attendance tracking",
                  text: "Section-based daily attendance with reporting.",
                },
                {
                  icon: BookOpen,
                  title: "Assignment workflow",
                  text: "Publish files, set deadlines, and track submissions.",
                },
                {
                  icon: Library,
                  title: "Grade structures",
                  text: "Flexible components with total control over weighting.",
                },
                {
                  icon: Users,
                  title: "Professor profiles",
                  text: "Dedicated CV and teaching profile space for faculty.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.5rem] border border-white/10 bg-white/8 p-6 backdrop-blur"
                >
                  <item.icon className="mb-4 text-[#f3c783]" size={22} />
                  <h3 className="font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#eadbc4]">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-8 rounded-[2rem] border border-[#dec9a7] bg-gradient-to-r from-[#fff7eb] via-white to-[#f5e6d1] p-8 shadow-[0_24px_70px_rgba(88,51,30,0.08)] lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.3em] text-[#8a5a44]">
                Contact WIU
              </p>
              <h2 className="text-3xl font-black text-[#4e1020]">
                Ready to step into the WIU portal?
              </h2>
              <div className="mt-6 grid gap-4 text-[#6b5848] sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-[#7a1126]" />
                  <span>+963317439800</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-[#7a1126]" />
                  <span>info@wiu.edu.sy</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-[#7a1126]" />
                  <span>Wadi al-Nasara, Syria</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7a1126] px-7 py-3 font-semibold text-white transition hover:bg-[#5f0d1e]"
            >
              Open Portal
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
