import { Clock3, Mail, MapPin, Phone, Send } from "lucide-react";
import PublicSiteShell from "@/components/public-site-shell";

export default function ContactPage() {
  return (
    <PublicSiteShell
      current="contact"
      title="Reach WIU through the official university contact points."
      subtitle="Use the university phone, email, and campus location details to connect with the institution and its academic services."
      eyebrow="Contact"
    >
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-8 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
          <h2 className="text-2xl font-black text-[#4e1020]">Contact information</h2>
          <div className="mt-6 space-y-5">
            {[
              { icon: MapPin, title: "Address", text: "Syria, Homs, Wadi al-Nasara" },
              { icon: Phone, title: "Phone", text: "+963317439800" },
              { icon: Mail, title: "Email", text: "info@wiu.edu.sy" },
              { icon: Clock3, title: "Availability", text: "Follow university office and admission announcements for operating times." },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 rounded-2xl bg-[#fff8ee] p-4">
                <div className="rounded-2xl bg-white p-3 shadow-sm">
                  <item.icon className="text-[#7a1126]" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-[#4e1020]">{item.title}</h3>
                  <p className="mt-1 leading-7 text-[#6b5848]">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-8 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
          <div className="mb-5 flex items-center gap-3">
            <Send className="text-[#7a1126]" size={24} />
            <h2 className="text-2xl font-black text-[#4e1020]">Send a message</h2>
          </div>
          <form className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <input type="text" placeholder="First name" className="rounded-2xl border border-[#ddc8a9] px-4 py-3 outline-none focus:border-[#b57639]" />
              <input type="text" placeholder="Last name" className="rounded-2xl border border-[#ddc8a9] px-4 py-3 outline-none focus:border-[#b57639]" />
            </div>
            <input type="email" placeholder="Email address" className="w-full rounded-2xl border border-[#ddc8a9] px-4 py-3 outline-none focus:border-[#b57639]" />
            <input type="text" placeholder="Subject" className="w-full rounded-2xl border border-[#ddc8a9] px-4 py-3 outline-none focus:border-[#b57639]" />
            <textarea rows={6} placeholder="Your message" className="w-full rounded-2xl border border-[#ddc8a9] px-4 py-3 outline-none focus:border-[#b57639]" />
            <button type="submit" className="rounded-full bg-[#7a1126] px-6 py-3 font-semibold text-white transition hover:bg-[#5f0d1e]">
              Send Message
            </button>
          </form>
        </section>
      </div>
    </PublicSiteShell>
  );
}
