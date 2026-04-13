import { BookOpen, Search, Sparkles } from "lucide-react";
import PublicSiteShell from "@/components/public-site-shell";

const courses = [
  { code: "CS301", name: "Data Structures", credits: 3, department: "Computer Science" },
  { code: "CS302", name: "Database Systems", credits: 3, department: "Computer Science" },
  { code: "CS101L", name: "Programming Lab", credits: 1, department: "Computer Science" },
  { code: "LAW201", name: "Legal Foundations", credits: 3, department: "Law" },
  { code: "PHARM220", name: "Pharmaceutical Sciences", credits: 3, department: "Pharmacy" },
  { code: "BUS210", name: "Principles of Management", credits: 3, department: "Business" },
];

export default function CoursesCatalogPage() {
  return (
    <PublicSiteShell
      current="courses"
      title="Browse core academic offerings through a cleaner WIU course catalog."
      subtitle="The course catalog page gives a portal-friendly view of sample academic subjects and departments in the WIU environment."
      eyebrow="Courses Catalog"
    >
      <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-8 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff7eb] px-4 py-2 text-sm font-medium text-[#8a5a44]">
              <Sparkles size={16} />
              Sample course view for the WIU portal
            </div>
            <h2 className="text-2xl font-black text-[#4e1020]">Search and review courses</h2>
          </div>

          <div className="relative max-w-xl flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9b7d66]" />
            <input
              type="text"
              placeholder="Search by code, title, or department"
              className="w-full rounded-2xl border border-[#ddc8a9] bg-[#fffdf8] py-3 pl-12 pr-4 outline-none focus:border-[#b57639]"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-[1.5rem] border border-[#eadbc4]">
          <table className="min-w-full bg-white">
            <thead className="bg-[#fff8ee] text-left text-xs uppercase tracking-[0.2em] text-[#8a5a44]">
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Course name</th>
                <th className="px-6 py-4">Credits</th>
                <th className="px-6 py-4">Department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0e4d2]">
              {courses.map((course) => (
                <tr key={course.code} className="hover:bg-[#fffaf3]">
                  <td className="px-6 py-4 font-semibold text-[#7a1126]">{course.code}</td>
                  <td className="px-6 py-4 text-[#26151a]">{course.name}</td>
                  <td className="px-6 py-4 text-[#6b5848]">{course.credits}</td>
                  <td className="px-6 py-4 text-[#6b5848]">{course.department}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        {[
          "Course viewing is intended to support advising, student planning, and section-based enrollment.",
          "The academic portal connects the course catalog with grades, assignments, attendance, and registration workflows.",
          "Course data can later be expanded further to mirror the full official WIU offering more closely.",
        ].map((item) => (
          <div key={item} className="rounded-[1.6rem] border border-[#dec9a7] bg-gradient-to-br from-[#fff7eb] to-white p-6 shadow-[0_18px_45px_rgba(73,36,22,0.08)]">
            <BookOpen className="mb-4 text-[#7a1126]" size={22} />
            <p className="leading-7 text-[#6b5848]">{item}</p>
          </div>
        ))}
      </section>
    </PublicSiteShell>
  );
}
