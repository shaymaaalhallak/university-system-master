import { BookOpen, Building2, CalendarDays, GraduationCap, Landmark, Microscope } from "lucide-react";
import PublicSiteShell from "@/components/public-site-shell";

const faculties = [
  {
    title: "Engineering and Technology",
    text: "Programs centered on applied technical learning, computing, and engineering-oriented academic preparation.",
    icon: Building2,
  },
  {
    title: "Management and Business",
    text: "Academic study aimed at organizational thinking, administration, and practical market-facing skills.",
    icon: Landmark,
  },
  {
    title: "Health and Medical Fields",
    text: "Programs connected to pharmacy, health sciences, and other professionally structured health tracks.",
    icon: Microscope,
  },
  {
    title: "Law and Humanities",
    text: "Programs that support legal education, communication, and broader human-centered academic development.",
    icon: BookOpen,
  },
];

export default function AcademicsPage() {
  return (
    <PublicSiteShell
      current="academics"
      title="Academic life at WIU is organized around faculties, programs, and structured progress."
      subtitle="The university presents itself as a multi-field institution where programs are intended to prepare students for real employment and professional growth."
      eyebrow="Academics"
    >
      <section className="grid gap-6 lg:grid-cols-2">
        {faculties.map((faculty) => (
          <div key={faculty.title} className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-8 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
            <faculty.icon className="mb-4 text-[#7a1126]" size={26} />
            <h2 className="text-2xl font-black text-[#4e1020]">{faculty.title}</h2>
            <p className="mt-3 leading-7 text-[#6b5848]">{faculty.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        {[
          {
            title: "Program structure",
            text: "Courses, sections, grades, assignments, and attendance are all reflected in the digital portal structure.",
            icon: GraduationCap,
          },
          {
            title: "Academic calendar",
            text: "Semester planning, assessments, and registration periods are intended to follow a clear academic rhythm.",
            icon: CalendarDays,
          },
          {
            title: "Outcome focus",
            text: "WIU emphasizes preparing graduates to meet the increasing quality demands of the labor market.",
            icon: BookOpen,
          },
        ].map((item) => (
          <div key={item.title} className="rounded-[1.6rem] border border-[#dec9a7] bg-gradient-to-br from-[#fff7eb] to-white p-6 shadow-[0_18px_45px_rgba(73,36,22,0.08)]">
            <item.icon className="mb-4 text-[#7a1126]" size={24} />
            <h3 className="text-xl font-bold text-[#4e1020]">{item.title}</h3>
            <p className="mt-3 leading-7 text-[#6b5848]">{item.text}</p>
          </div>
        ))}
      </section>
    </PublicSiteShell>
  );
}
