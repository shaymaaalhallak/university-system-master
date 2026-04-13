"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Award, GraduationCap, TrendingUp } from "lucide-react";

type GradeComponent = {
  componentId: number;
  name: string;
  weight: number;
  score: number;
  order: number;
};

interface Grade {
  id: string;
  course_code: string;
  course_title: string;
  credits: number;
  total_score: number;
  letter_grade: string;
  semester: string;
  year: number;
  components: GradeComponent[];
}

interface GPAData {
  gpa: string;
  totalCredits: number;
  semesterGPA: Record<string, string>;
  standing: string;
  canGraduate: boolean;
}

export default function StudentGrades() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gpaData, setGpaData] = useState<GPAData | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === "student") {
      Promise.all([
        api.get<any>("/grades/my"),
        api.get<any>("/grades/my-gpa"),
      ])
        .then(([gradesRes, gpaRes]) => {
          if (gradesRes.success) setGrades(gradesRes.data);
          if (gpaRes.success) setGpaData(gpaRes.data);
        })
        .catch(console.error);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (user?.role !== "student") return <div className="p-6">Access denied.</div>;

  const getGradeColor = (letter: string) => {
    if (!letter) return "bg-gray-100 text-gray-700";
    if (letter.startsWith("A")) return "bg-green-100 text-green-700";
    if (letter.startsWith("B")) return "bg-blue-100 text-blue-700";
    if (letter.startsWith("C")) return "bg-yellow-100 text-yellow-700";
    if (letter.startsWith("D")) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  const standingColor = () => {
    if (!gpaData) return "text-gray-600";
    const g = Number(gpaData.gpa);
    if (g >= 3.5) return "text-green-600";
    if (g >= 3.0) return "text-blue-600";
    if (g >= 2.0) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6 bg-white rounded-xl shadow-sm border p-6">
      <h1 className="text-2xl font-bold text-gray-900">My Grades & GPA</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <GraduationCap className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Cumulative GPA</p>
              <p className="text-3xl font-bold text-gray-900">{gpaData?.gpa ?? "-"}</p>
              {gpaData && <p className={`text-sm font-medium ${standingColor()}`}>{gpaData.standing}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Credits</p>
              <p className="text-3xl font-bold text-gray-900">{gpaData?.totalCredits ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Award className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Courses Graded</p>
              <p className="text-3xl font-bold text-gray-900">{grades.length}</p>
            </div>
          </div>
        </div>
      </div>

      {gpaData?.semesterGPA && Object.keys(gpaData.semesterGPA).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">GPA by Semester</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(gpaData.semesterGPA).map(([sem, gpa]) => (
              <div key={sem} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{sem}</p>
                <p className="text-xl font-bold text-blue-600">{gpa}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {grades.map((grade) => (
          <div key={grade.id} className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{grade.course_title}</h2>
                <p className="text-sm text-gray-500">{grade.course_code} • {grade.year} {grade.semester} • {grade.credits} credits</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{grade.total_score ?? "-"}</p>
                <span className={`mt-1 inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getGradeColor(grade.letter_grade)}`}>
                  {grade.letter_grade || "-"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {grade.components.map((component) => (
                <div key={component.componentId} className="rounded-lg border bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{component.name}</p>
                      <p className="text-xs text-gray-500">Weight: {component.weight}%</p>
                    </div>
                    <p className="text-xl font-bold text-blue-600">{component.score}</p>
                  </div>
                </div>
              ))}
              {!grade.components.length && (
                <p className="text-sm text-gray-500">No grade components saved yet.</p>
              )}
            </div>
          </div>
        ))}

        {!grades.length && (
          <div className="bg-white rounded-xl shadow-sm border p-6 text-center text-gray-500">
            No grades available yet.
          </div>
        )}
      </div>

      {gpaData && (
        <div className={`rounded-xl p-4 border ${gpaData.canGraduate ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <p className={`font-medium ${gpaData.canGraduate ? "text-green-700" : "text-red-700"}`}>
            {gpaData.canGraduate
              ? `Your GPA of ${gpaData.gpa} meets the minimum graduation requirement (2.00)`
              : `Your GPA of ${gpaData.gpa} is below the 2.00 minimum required for graduation`}
          </p>
        </div>
      )}
    </div>
  );
}
