import { Award, Building2, Landmark, Users2 } from "lucide-react";
import PublicSiteShell from "@/components/public-site-shell";

const historyPoints = [
  "The initiative for Wadi International University grew after the Syrian private higher education framework was issued in 2001.",
  "Families from Wadi al-Nasara contributed to establishing an educational institution that could serve the region with a serious academic model.",
  "WIU was established by Legislative Decree No. 281 dated 3/7/2005 to prepare graduates for a labor market with rising quality expectations.",
];

const leadership = [
  "Dr. Shafek Georgres Basel",
  "Aziz Hadid",
  "Dr. Zaid Al-Assaf",
  "Prof. Moataz Abara",
];

export default function AboutPage() {
  return (
    <PublicSiteShell
      current="about"
      title="A university identity shaped by community, ambition, and academic purpose."
      subtitle="WIU was founded to create a serious private university model in Wadi al-Nasara, connecting regional aspiration with practical higher education."
      eyebrow="About WIU"
    >
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-8 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
          <h2 className="text-3xl font-black text-[#4e1020]">History and foundation</h2>
          <div className="mt-6 space-y-5 text-lg leading-8 text-[#6b5848]">
            {historyPoints.map((point) => (
              <p key={point}>{point}</p>
            ))}
          </div>
        </section>

        <section className="grid gap-5">
          {[
            {
              title: "Mission",
              text: "Provide quality higher education that prepares graduates for real professional demands and responsible public life.",
              icon: Award,
            },
            {
              title: "Vision",
              text: "Build a university model recognized for seriousness, relevance, and the ability to connect education with community development.",
              icon: Landmark,
            },
            {
              title: "Leadership spirit",
              text: "Academic leadership at WIU is rooted in service, professional competence, and long-term institutional growth.",
              icon: Users2,
            },
          ].map((item) => (
            <div key={item.title} className="rounded-[1.5rem] border border-[#e2d2bc] bg-white p-6 shadow-[0_18px_45px_rgba(73,36,22,0.08)]">
              <item.icon className="mb-4 text-[#7a1126]" size={24} />
              <h3 className="text-xl font-bold text-[#4e1020]">{item.title}</h3>
              <p className="mt-3 leading-7 text-[#6b5848]">{item.text}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[1.75rem] border border-[#dec9a7] bg-gradient-to-br from-[#fff7eb] to-white p-8 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
          <div className="mb-4 flex items-center gap-3">
            <Building2 className="text-[#7a1126]" size={24} />
            <h2 className="text-2xl font-black text-[#4e1020]">What WIU stands for</h2>
          </div>
          <p className="leading-8 text-[#6b5848]">
            WIU presents itself as a university built not only to teach, but to elevate standards,
            create professional readiness, and offer a meaningful local academic destination with an
            international-facing identity.
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-[#dec9a7] bg-[#4e1020] p-8 text-white shadow-[0_22px_55px_rgba(73,36,22,0.15)]">
          <h2 className="text-2xl font-black text-[#f3c783]">Leadership names</h2>
          <div className="mt-5 grid gap-3 text-[#f4e2cb]">
            {leadership.map((name) => (
              <div key={name} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
}
