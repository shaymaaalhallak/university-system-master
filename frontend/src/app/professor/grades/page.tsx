"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { BookOpen, Plus, Save, Trash2, Users } from "lucide-react";

type Section = {
  section_id: number;
  course_code: string;
  course_title: string;
  semester: number;
  year: number;
};

type GradeComponent = {
  componentId: number | string;
  name: string;
  weight: number;
  order: number;
};

type StudentRow = {
  student_id: number;
  first_name: string;
  last_name: string;
  email: string;
  total_score: number | null;
  letter_grade: string | null;
  componentScores: Record<string, number>;
};

const newComponent = (order: number): GradeComponent => ({
  componentId: `new-${order}-${Date.now()}`,
  name: "",
  weight: 0,
  order,
});

export default function ProfessorGradesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [components, setComponents] = useState<GradeComponent[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role !== "professor") return;

    const loadSections = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ success: boolean; data: Section[] }>("/professor/my-sections");
        if (!response.success) throw new Error("Failed to load sections");
        setSections(response.data ?? []);
      } catch (err) {
        console.error(err);
        setError("Unable to load your sections right now.");
      } finally {
        setLoading(false);
      }
    };

    loadSections();
  }, [user]);

  useEffect(() => {
    if (!selectedSectionId) {
      setComponents([]);
      setStudents([]);
      return;
    }

    const loadSectionDetails = async () => {
      try {
        setLoadingDetails(true);
        setError(null);
        setMessage(null);

        const response = await api.get<{
          success: boolean;
          data: {
            components: GradeComponent[];
            students: StudentRow[];
          };
        }>(`/grades/section/${selectedSectionId}/setup`);

        if (!response.success) throw new Error("Failed to load grade setup");

        const nextComponents = (response.data.components ?? []).length
          ? response.data.components
          : [newComponent(1)];

        setComponents(nextComponents);
        setStudents(response.data.students ?? []);
      } catch (err) {
        console.error(err);
        setError("Unable to load this section's grade setup.");
      } finally {
        setLoadingDetails(false);
      }
    };

    loadSectionDetails();
  }, [selectedSectionId]);

  const totalWeight = useMemo(
    () => components.reduce((sum, component) => sum + (Number(component.weight) || 0), 0),
    [components]
  );

  const addComponent = () => {
    setComponents((current) => [...current, newComponent(current.length + 1)]);
  };

  const updateComponent = (index: number, field: "name" | "weight", value: string) => {
    setComponents((current) =>
      current.map((component, currentIndex) =>
        currentIndex === index
          ? {
              ...component,
              [field]: field === "weight" ? Math.max(0, Number(value) || 0) : value,
            }
          : component
      )
    );
  };

  const removeComponent = (index: number) => {
    setComponents((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateStudentScore = (studentId: number, componentKey: string, value: string) => {
    const numeric = Math.max(0, Math.min(100, Number(value) || 0));
    setStudents((current) =>
      current.map((student) =>
        student.student_id === studentId
          ? {
              ...student,
              componentScores: {
                ...student.componentScores,
                [componentKey]: numeric,
              },
            }
          : student
      )
    );
  };

  const saveStructure = async () => {
    if (!selectedSectionId) return;

    try {
      setSavingStructure(true);
      setError(null);
      setMessage(null);

      const payload = components.map((component, index) => ({
        name: component.name,
        weight: Number(component.weight) || 0,
        order: index + 1,
      }));

      const response = await api.put<{ success: boolean; message: string }>(
        `/grades/section/${selectedSectionId}/setup`,
        { components: payload }
      );

      if (!response.success) throw new Error(response.message || "Failed to save grade structure");

      setMessage(response.message || "Grade structure saved.");

      const reload = await api.get<{
        success: boolean;
        data: {
          components: GradeComponent[];
          students: StudentRow[];
        };
      }>(`/grades/section/${selectedSectionId}/setup`);

      if (reload.success) {
        setComponents(reload.data.components ?? []);
        setStudents(reload.data.students ?? []);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to save the grade structure. Make sure names are filled and total weight equals 100.");
    } finally {
      setSavingStructure(false);
    }
  };

  const saveStudent = async (student: StudentRow) => {
    if (!selectedSectionId) return;

    try {
      setSavingStudentId(student.student_id);
      setError(null);
      setMessage(null);

      const componentScores = components.map((component) => ({
        componentId: Number(component.componentId),
        score: Number(student.componentScores[String(component.componentId)] ?? 0),
      }));

      const response = await api.post<{
        success: boolean;
        message: string;
        data: { totalScore: number; letterGrade: string };
      }>("/grades", {
        studentId: student.student_id,
        sectionId: selectedSectionId,
        componentScores,
      });

      if (!response.success) throw new Error(response.message || "Failed to save grades");

      setStudents((current) =>
        current.map((row) =>
          row.student_id === student.student_id
            ? {
                ...row,
                total_score: response.data.totalScore,
                letter_grade: response.data.letterGrade,
              }
            : row
        )
      );
      setMessage(`${student.first_name} ${student.last_name}'s grades were saved.`);
    } catch (err) {
      console.error(err);
      setError("Unable to save this student's grades.");
    } finally {
      setSavingStudentId(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (user?.role !== "professor") {
    return <div className="p-6">Access denied. This page is for professors only.</div>;
  }

  return (
    <div className="space-y-6 text-black bg-white max-h-full">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-3">
            <BookOpen className="text-blue-700" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Professor Grade</h1>
            <p className="text-sm text-gray-500">
              Create any number of exams, quizzes, projects, or assignments for a section. The total weight must equal 100.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">Section</label>
        <select
          value={selectedSectionId ?? ""}
          onChange={(e) => setSelectedSectionId(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-lg border px-3 py-2"
        >
          <option value="">Select section</option>
          {sections.map((section) => (
            <option key={section.section_id} value={section.section_id}>
              {section.course_code} - {section.course_title} - Section {section.section_id}
            </option>
          ))}
        </select>
      </div>

      {selectedSectionId && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Grade Structure</h2>
            <button
              type="button"
              onClick={addComponent}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-700"
            >
              <Plus size={16} />
              Add Component
            </button>
          </div>

          <div className="space-y-3">
            {components.map((component, index) => (
              <div key={String(component.componentId)} className="grid gap-3 md:grid-cols-[1fr_140px_80px] items-end">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Component name</label>
                  <input
                    value={component.name}
                    onChange={(e) => updateComponent(index, "name", e.target.value)}
                    placeholder={`Quiz ${index + 1}`}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Weight %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={component.weight}
                    onChange={(e) => updateComponent(index, "weight", e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeComponent(index)}
                  disabled={components.length === 1}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-red-600 disabled:text-gray-300"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className={`rounded-lg px-3 py-2 text-sm ${totalWeight === 100 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            Total weight: {totalWeight}/100
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

          <button
            type="button"
            onClick={saveStructure}
            disabled={savingStructure || totalWeight !== 100}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white disabled:bg-green-300"
          >
            <Save size={16} />
            {savingStructure ? "Saving structure..." : "Save Grade Structure"}
          </button>
        </div>
      )}

      {selectedSectionId && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">Student Grades</h2>
          </div>

          {loadingDetails && <p className="text-gray-500">Loading gradebook...</p>}

          {!loadingDetails && !students.length && (
            <p className="text-gray-500">No active students are enrolled in this section.</p>
          )}

          {!loadingDetails && students.length > 0 && components.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    {components.map((component) => (
                      <th key={String(component.componentId)} className="px-4 py-3">
                        {component.name || "Unnamed"} ({component.weight}%)
                      </th>
                    ))}
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Letter</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.student_id}>
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">{student.first_name} {student.last_name}</p>
                        <p className="text-sm text-gray-500">{student.email}</p>
                      </td>
                      {components.map((component) => (
                        <td key={String(component.componentId)} className="px-4 py-4">
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            value={student.componentScores[String(component.componentId)] ?? 0}
                            onChange={(e) => updateStudentScore(student.student_id, String(component.componentId), e.target.value)}
                            className="w-24 rounded-lg border px-3 py-2 "
                          />
                        </td>
                      ))}
                      <td className="px-4 py-4 font-semibold text-gray-900">{student.total_score ?? "-"}</td>
                      <td className="px-4 py-4 font-semibold text-gray-900">{student.letter_grade ?? "-"}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => saveStudent(student)}
                          disabled={savingStudentId === student.student_id || totalWeight !== 100}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:bg-blue-300"
                        >
                          {savingStudentId === student.student_id ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
