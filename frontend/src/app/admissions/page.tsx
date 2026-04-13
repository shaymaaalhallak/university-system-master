import { CalendarDays, CheckCircle2, FileCheck2, Globe2, ShieldCheck } from "lucide-react";
import PublicSiteShell from "@/components/public-site-shell";

const requirements = [
  "Secondary certificate or equivalent according to the program requirements.",
  "Completion of official admission documents and identity records.",
  "Program-specific eligibility in line with university and ministry regulations.",
  "Commitment to the deadlines and enrollment instructions announced by the university.",
];

const steps = [
  "Choose the target faculty or academic track.",
  "Prepare personal documents and academic certificates.",
  "Complete the application and registration steps through the university process.",
  "Follow final acceptance, tuition, and enrollment instructions.",
];

export default function AdmissionsPage() {
  return (
    <PublicSiteShell
      current="admissions"
      title="Admissions built around clarity, readiness, and academic fit."
      subtitle="WIU admissions should guide students from interest to enrollment with clear requirements, required documents, and practical next steps."
      eyebrow="Admissions"
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-8 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
          <div className="mb-5 flex items-center gap-3">
            <FileCheck2 className="text-[#7a1126]" size={24} />
            <h2 className="text-2xl font-black text-[#4e1020]">General admission requirements</h2>
          </div>
          <div className="space-y-4 text-[#6b5848]">
            {requirements.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl bg-[#fff8ee] px-4 py-4">
                <CheckCircle2 className="mt-1 text-[#b57639]" size={18} />
                <p className="leading-7">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-8 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
          <div className="mb-5 flex items-center gap-3">
            <ShieldCheck className="text-[#7a1126]" size={24} />
            <h2 className="text-2xl font-black text-[#4e1020]">Application path</h2>
          </div>
          <div className="space-y-4">
            {steps.map((item, index) => (
              <div key={item} className="rounded-2xl border border-[#eadbc4] px-4 py-4">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#8a5a44]">Step {index + 1}</p>
                <p className="mt-2 leading-7 text-[#6b5848]">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        {[
          {
            title: "Registration timing",
            text: "Follow the official university admission announcements for opening and closing dates.",
            icon: CalendarDays,
          },
          {
            title: "International outlook",
            text: "WIU positions itself as an international university while serving strong local academic needs.",
            icon: Globe2,
          },
          {
            title: "Final enrollment",
            text: "Accepted students complete enrollment through fee settlement and final registration procedures.",
            icon: CheckCircle2,
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
