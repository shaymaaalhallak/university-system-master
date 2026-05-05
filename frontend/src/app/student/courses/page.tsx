// =====================================================================
// FILE: src/app/student/courses/page.tsx
// =====================================================================
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { BookOpen, Users, Clock, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
export default function StudentCourses() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [sections, setSections] = useState<any[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<any[]>([]);
  const [studyPlan, setStudyPlan] = useState<any>(null);
  const [enrolling, setEnrolling] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === "student") {
      setLoadingData(true);
      setError("");
      let hadError = false;
      const loadSections = async () => {
        try {
          const res: any = await api.get("/courses/sections");
          if (res.success) setSections(res.data);
        } catch (e: any) {
          console.error("Failed to load sections:", e);
          hadError = true;
          const msg = e?.response?.data?.message || "Failed to load course sections";
          setError((prev) => prev ? prev : msg);
        }
      };
      const loadEnrollments = async () => {
        try {
          const res: any = await api.get("/enrollments/my");
          if (res.success) setMyEnrollments(res.data);
        } catch (e: any) {
          console.error("Failed to load enrollments:", e);
          hadError = true;
          if (!error) {
            const msg = e?.response?.data?.message || "Failed to load enrollments";
            setError(msg);
          }
        }
      };
      const loadStudyPlan = async () => {
        try {
          const res: any = await api.get("/courses/study-plans/my-program");
          if (res.success) setStudyPlan(res.data);
        } catch (e: any) {
          console.error("Failed to load study plan:", e);
          if (!error) {
            const msg = e?.response?.data?.message || "Failed to load study plan";
            setError(msg);
          }
        }
      };
      Promise.all([loadSections(), loadEnrollments(), loadStudyPlan()])
        .finally(() => setLoadingData(false));
    }
  }, [user, isLoading]);

  const enrolledSectionIds = myEnrollments
    .filter((e) => e.status === "active")
    .map((e) => String(e.section_id));

  // Build prerequisite lookup from study plan
  const prereqLookup = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const semester of studyPlan?.semesters || []) {
      for (const course of semester.courses || []) {
        if (course.prerequisites && course.prerequisites.length > 0) {
          map[course.courseId || course.code] = course.prerequisites.map(
            (p: any) => `${p.course_code} - ${p.course_title}`
          );
        }
      }
    }
    return map;
  }, [studyPlan]);

  const handleEnroll = async (sectionId: number) => {
    setEnrolling(sectionId);
    setMessage("");
    try {
      const res: any = await api.post("/enrollments", { sectionId });
      if (res.success) {
        setMessage("✓ Successfully enrolled!");
        // Refresh enrollments
        const updated: any = await api.get<any>("/enrollments/my");
        if (updated.success) setMyEnrollments(updated.data);
      } else {
        setMessage(`✗ ${res.message}`);
      }
    } catch (e: any) {
      setMessage(`✗ ${e?.response?.data?.message || "Enrollment failed"}`);
    } finally {
      setEnrolling(null);
    }
  };

  if (isLoading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 bg-white rounded-xl shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-gray-900">My Courses</h1>
        {error && (
          <div className="p-3 rounded-lg text-sm font-medium bg-red-50 text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div
            className={`p-3 rounded-lg text-sm font-medium ${message.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
          >
            {message}
          </div>
        )}

        {/* Enrolled courses */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Enrolled Courses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myEnrollments
              .filter((e) => e.status === "active")
              .map((e) => (
                <div
                  key={e.enrollment_id}
                  className="border border-blue-200 rounded-lg p-4 bg-blue-50"
                >
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                    {e.course_code}
                  </span>
                  <h3 className="font-semibold text-gray-900 mt-2 mb-1">
                    {e.course_title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {e.prof_first} {e.prof_last}
                  </p>
                  <p className="text-sm text-gray-500">
                    {e.room_number} · {e.schedule_time}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {e.credits} credits · {e.semester} {e.year}
                  </p>
                  {e.letter_grade && (
                    <span className="mt-2 inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                      Grade: {e.letter_grade}
                    </span>
                  )}
                </div>
              ))}
            {!myEnrollments.filter((e) => e.status === "active").length && (
              <p className="text-gray-500 col-span-full text-center py-8">
                You haven&apos;t enrolled in any courses yet.
              </p>
            )}
          </div>
        </div>

        {/* Available sections to enroll */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Available Course Sections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections
              .filter((s) => !enrolledSectionIds.includes(String(s.section_id)))
              .map((s) => (
                <div
                  key={s.section_id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                      {s.course_code}
                    </span>
                    <span className="text-sm text-gray-500">
                      {s.credits} cr
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {s.course_title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {s.first_name} {s.last_name}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <Clock size={14} /> {s.schedule_time}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Users size={14} /> {s.enrolled_count} enrolled
                  </p>
                  <p className="text-xs text-gray-400">
                    {s.semester} {s.year} · Room {s.room_number}
                  </p>
                  {prereqLookup[s.course_id] && prereqLookup[s.course_id].length > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      Prerequisites: {prereqLookup[s.course_id].join(", ")}
                    </p>
                  )}
                  <button
                    onClick={() => handleEnroll(s.section_id)}
                    disabled={enrolling === s.section_id}
                    className="mt-3 w-full text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {enrolling === s.section_id ? (
                      "Enrolling..."
                    ) : (
                      <>
                        Enroll <ChevronRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              ))}
            {!sections.filter(
              (s) => !enrolledSectionIds.includes(String(s.section_id)),
            ).length && (
              <p className="text-gray-500 col-span-full text-center py-8">
                No available sections at this time.
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
