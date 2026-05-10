"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { Download, FileSpreadsheet, Filter, Upload, Users } from "lucide-react";
import * as XLSX from "xlsx";

type Section = {
  section_id: number;
  course_id: number;
  course_code: string;
  course_title: string;
  semester: number | string;
  year: number;
  room_number: string;
  schedule_time: string;
  enrolled_count: number;
};

type StudentRow = {
  student_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  major: string;
  department_name?: string | null;
  program_name?: string | null;
  student_semester?: number | string | null;
  gpa?: number | null;
  total_score?: number | null;
  letter_grade?: string | null;
};

type GradeComponent = {
  componentId: number;
  name: string;
  weight: number;
  order: number;
};

type SheetMode = "roster" | "attendance" | "grades";

type ExportFieldKey =
  | "studentId"
  | "fullName"
  | "email"
  | "major"
  | "semester"
  | "gpa"
  | "totalGrade"
  | "letterGrade";

const FIELD_OPTIONS: Array<{ key: ExportFieldKey; label: string }> = [
  { key: "studentId", label: "Student ID" },
  { key: "fullName", label: "Name" },
  { key: "email", label: "Email" },
  { key: "major", label: "Major" },
  { key: "semester", label: "Semester" },
  { key: "gpa", label: "GPA" },
  { key: "totalGrade", label: "Total Grade" },
  { key: "letterGrade", label: "Letter Grade" },
];

const DEFAULT_FIELDS: ExportFieldKey[] = ["studentId", "fullName", "email", "major"];
const ATTENDANCE_HEADER = "Attendance";

const getTodayLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().split("T")[0];
};

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export default function ProfessorExportPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [sheetMode, setSheetMode] = useState<SheetMode>("roster");
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [gradeComponents, setGradeComponents] = useState<GradeComponent[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedFields, setSelectedFields] = useState<ExportFieldKey[]>(DEFAULT_FIELDS);
  const [attendanceDate, setAttendanceDate] = useState(getTodayLocal());
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role !== "professor") {
      return;
    }

    const loadSections = async () => {
      try {
        setLoadingSections(true);
        setError(null);

        const response = await api.get<{ success: boolean; data: Section[] }>("/professor/my-sections");
        if (!response.success) {
          throw new Error("Failed to load sections");
        }

        setAllSections(response.data ?? []);
      } catch (err) {
        console.error(err);
        setError("Unable to load your course sections right now.");
      } finally {
        setLoadingSections(false);
      }
    };

    loadSections();
  }, [user]);

  const courses = useMemo(() => {
    const courseMap = new Map<number, { course_id: number; course_code: string; course_title: string }>();

    allSections.forEach((section) => {
      if (!courseMap.has(section.course_id)) {
        courseMap.set(section.course_id, {
          course_id: section.course_id,
          course_code: section.course_code,
          course_title: section.course_title,
        });
      }
    });

    return Array.from(courseMap.values());
  }, [allSections]);

  const sectionsForCourse = useMemo(
    () => allSections.filter((section) => section.course_id === selectedCourseId),
    [allSections, selectedCourseId]
  );

  const selectedSection = useMemo(
    () => allSections.find((section) => section.section_id === selectedSectionId) ?? null,
    [allSections, selectedSectionId]
  );

  useEffect(() => {
    if (!selectedSectionId) {
      setStudents([]);
      setGradeComponents([]);
      return;
    }

    const loadSectionData = async () => {
      try {
        setLoadingStudents(true);
        setError(null);
        setSuccessMessage(null);

        const studentPromise = api.get<{ success: boolean; data: StudentRow[] }>(
          `/professor/sections/${selectedSectionId}/students`
        );
        const gradeSetupPromise =
          sheetMode === "grades"
            ? api.get<{ success: boolean; data: { components: GradeComponent[] } }>(
                `/grades/section/${selectedSectionId}/setup`
              )
            : Promise.resolve({ success: true, data: { components: [] } });

        const [studentsResponse, gradeSetupResponse] = await Promise.all([
          studentPromise,
          gradeSetupPromise,
        ]);

        if (!studentsResponse.success) {
          throw new Error("Failed to load students");
        }

        setStudents(studentsResponse.data ?? []);
        setGradeComponents(
          gradeSetupResponse.success ? gradeSetupResponse.data.components ?? [] : []
        );
      } catch (err) {
        console.error(err);
        setError("Unable to load this section's export data.");
      } finally {
        setLoadingStudents(false);
      }
    };

    loadSectionData();
  }, [selectedSectionId, sheetMode]);

  const toggleField = (fieldKey: ExportFieldKey) => {
    setSelectedFields((current) => {
      if (current.includes(fieldKey)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== fieldKey);
      }
      return [...current, fieldKey];
    });
  };

  const getFieldValue = (student: StudentRow, fieldKey: ExportFieldKey) => {
    switch (fieldKey) {
      case "studentId":
        return String(student.student_id);
      case "fullName":
        return `${student.first_name} ${student.last_name}`;
      case "email":
        return student.email || "-";
      case "major":
        return student.major || student.program_name || student.department_name || "-";
      case "semester":
        return student.student_semester != null ? String(student.student_semester) : "-";
      case "gpa":
        return student.gpa != null ? String(student.gpa) : "-";
      case "totalGrade":
        return student.total_score != null ? String(student.total_score) : "-";
      case "letterGrade":
        return student.letter_grade || "-";
      default:
        return "-";
    }
  };

  const buildExportHeaders = () => {
    if (sheetMode === "attendance") {
      return ["Student ID", "Name", "Email", "Major", ATTENDANCE_HEADER];
    }

    if (sheetMode === "grades") {
      return ["Student ID", "Name", "Email", "Major", ...gradeComponents.map((component) => component.name)];
    }

    return selectedFields.map(
      (fieldKey) => FIELD_OPTIONS.find((field) => field.key === fieldKey)?.label || fieldKey
    );
  };

  const buildExportRows = () => {
    if (sheetMode === "attendance") {
      return students.map((student) => [
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        student.email || "-",
        student.major || "-",
        "",
      ]);
    }

    if (sheetMode === "grades") {
      return students.map((student) => [
        student.student_id,
        `${student.first_name} ${student.last_name}`,
        student.email || "-",
        student.major || "-",
        ...gradeComponents.map(() => ""),
      ]);
    }

    return students.map((student) =>
      selectedFields.map((fieldKey) => getFieldValue(student, fieldKey))
    );
  };

  const handleExport = async () => {
    if (!selectedSection || !students.length) {
      return;
    }

    if (sheetMode === "grades" && !gradeComponents.length) {
      setError("This section has no grade structure yet. Save the grade structure first, then export.");
      return;
    }

    try {
      setExporting(true);
      setError(null);
      setSuccessMessage(null);

      const headers = buildExportHeaders();
      const rows = buildExportRows();
      const professorName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Professor";
      const title =
        sheetMode === "attendance"
          ? "Attendance Import Template"
          : sheetMode === "grades"
            ? "Grades Import Template"
            : "Student Roster Export";

      const wsData: any[][] = [
        ["Wadi International University"],
        [title],
        [`${selectedSection.course_code} - ${selectedSection.course_title} | Section ${selectedSection.section_id}`],
        [`Professor: ${professorName}`],
      ];

      if (sheetMode === "attendance") {
        wsData.push([`Attendance date: ${attendanceDate}`]);
      }

      wsData.push([`Generated on ${new Date().toLocaleString()}`]);
      wsData.push([]);
      wsData.push(headers);
      rows.forEach((row) => wsData.push(row));

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws["!cols"] = headers.map(() => ({ wch: 22 }));
      ws["!merges"] = [];
      for (let i = 0; i < wsData.length - rows.length - 1; i++) {
        if (i === wsData.length - rows.length - 2) continue;
        ws["!merges"].push({ s: { r: i, c: 0 }, e: { r: i, c: headers.length - 1 } });
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedSection.course_code}-section-${selectedSection.section_id}-${sheetMode}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setSuccessMessage("Excel sheet exported successfully.");
    } finally {
      setExporting(false);
    }
  };

  const parseTemplateRows = (worksheet: XLSX.WorkSheet) => {
    const sheetRange = worksheet["!ref"];
    if (!sheetRange) {
      throw new Error("This file is empty.");
    }

    const range = XLSX.utils.decode_range(sheetRange);

    let headerRowIndex = -1;
    let startColumnIndex = -1;

       for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
      const normalizedRow: string[] = [];

      for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const cellValue = worksheet[cellAddress]?.v;
        normalizedRow.push(normalizeHeader(cellValue));
      }

      const studentIdColumn = normalizedRow.findIndex((value) => value === "student id");
      const hasNameColumn = normalizedRow.includes("name");

      if (studentIdColumn !== -1 && hasNameColumn) {
        headerRowIndex = rowIndex;
        startColumnIndex = studentIdColumn;
        break;
      }
    }

     if (headerRowIndex === -1 || startColumnIndex === -1) {
      throw new Error("This file does not look like a WIU export template. Please export a fresh sheet first.");
    }

    const headers: string[] = [];
    for (let columnIndex = startColumnIndex; columnIndex <= range.e.c; columnIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: columnIndex });
      const cellValue = worksheet[cellAddress]?.v;
      headers.push(String(cellValue ?? "").trim());
    }

     const dataRows: Array<Array<string | number | null>> = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex <= range.e.r; rowIndex += 1) {
      const rowValues: Array<string | number | null> = [];

      for (let columnIndex = startColumnIndex; columnIndex <= range.e.c; columnIndex += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const cellValue = worksheet[cellAddress]?.v;
        rowValues.push(cellValue ?? "");
      }

      if (String(rowValues[0] ?? "").trim().length > 0) {
        dataRows.push(rowValues);
      }
    }

    return { headers, dataRows };
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !selectedSectionId) {
      return;
    }

    if (sheetMode === "roster") {
      setError("Roster mode is export-only. Switch to attendance or grades to import a filled sheet.");
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setSuccessMessage(null);

      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const { headers, dataRows } = parseTemplateRows(worksheet);

      if (sheetMode === "attendance") {
        const headerMap = headers.map(normalizeHeader);
        const studentIdIndex = headerMap.indexOf("student id");
        const statusIndex = headerMap.indexOf(normalizeHeader(ATTENDANCE_HEADER));

        if (studentIdIndex === -1 || statusIndex === -1) {
          throw new Error("Attendance template is missing Student ID or Attendance Status columns.");
        }

        const records = dataRows
          .map((row) => ({
            studentId: String(row[studentIdIndex] ?? "").trim(),
            status: String(row[statusIndex] ?? "").trim(),
          }))
          .filter((row) => row.studentId && row.status)
          .map((row) => {
            const normalizedStatus = row.status.toLowerCase();
            if (normalizedStatus === "present") return { studentId: row.studentId, status: "Present" };
            if (normalizedStatus === "absent") return { studentId: row.studentId, status: "Absent" };
            if (normalizedStatus === "late") return { studentId: row.studentId, status: "Late" };
            throw new Error(`Invalid attendance status for student ${row.studentId}. Use Present, Absent, or Late.`);
          });

        if (!records.length) {
          throw new Error("No attendance rows were found to import.");
        }

        const response = await api.post<{ success: boolean; message: string }>("/attendance", {
          sectionId: selectedSectionId,
          date: attendanceDate,
          records,
        });

        if (!response.success) {
          throw new Error(response.message || "Failed to import attendance");
        }

        setSuccessMessage(`Attendance imported for ${records.length} students.`);
        return;
      }

      const headerMap = headers.map(normalizeHeader);
      const studentIdIndex = headerMap.indexOf("student id");
      if (studentIdIndex === -1) {
        throw new Error("Grades template is missing the Student ID column.");
      }
      if (!gradeComponents.length) {
        throw new Error("This section has no saved grade structure. Save it first before importing grades.");
      }

      const componentIndexes = gradeComponents.map((component) => ({
        componentId: component.componentId,
        name: component.name,
        index: headerMap.indexOf(normalizeHeader(component.name)),
      }));

      const missingComponent = componentIndexes.find((component) => component.index === -1);
      if (missingComponent) {
        throw new Error(`The grades file is missing the "${missingComponent.name}" column.`);
      }

      let importedCount = 0;
      for (const row of dataRows) {
        const studentId = Number(String(row[studentIdIndex] ?? "").trim());
        if (!studentId) continue;

        const componentScores = componentIndexes.map((component) => ({
          componentId: component.componentId,
          score: Number(row[component.index] ?? 0) || 0,
        }));

        const response = await api.post<{ success: boolean; message: string }>("/grades", {
          studentId,
          sectionId: selectedSectionId,
          componentScores,
        });

        if (!response.success) {
          throw new Error(response.message || `Failed to save grades for student ${studentId}`);
        }

        importedCount += 1;
      }

      if (!importedCount) {
        throw new Error("No grade rows were found to import.");
      }

      setSuccessMessage(`Grades imported for ${importedCount} students.`);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || err?.message || "Failed to import the Excel file.");
    } finally {
      setImporting(false);
    }
  };

  const previewHeaders = buildExportHeaders();
  const previewRows = buildExportRows();

  if (isLoading || loadingSections) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#7a1126]" />
      </div>
    );
  }

  if (user?.role !== "professor") {
    return <div className="p-6">Access denied. This page is for professors only.</div>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 text-black">
        <section className="overflow-hidden rounded-[2rem] border border-[#dfccb0] bg-[linear-gradient(135deg,#fff8ee_0%,#f2e1c8_48%,#e1c8a2_100%)] shadow-[0_24px_70px_rgba(88,51,30,0.08)]">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#8a5a44]">Professor Excel Workspace</p>
              <h1 className="mt-4 text-4xl font-black leading-tight text-[#4e1020]">Export and Import Academic Sheets</h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-[#6b5848]">
                Export a branded WIU sheet for roster, attendance, or grades, let the professor fill it in,
                then import the same Excel file back to update students in that section.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { label: "Courses", value: courses.length, icon: FileSpreadsheet },
                { label: "Sections", value: sectionsForCourse.length, icon: Filter },
                { label: "Students", value: students.length, icon: Users },
              ].map((card) => (
                <div key={card.label} className="rounded-[1.5rem] border border-white/45 bg-white/70 p-5 shadow-sm backdrop-blur">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7a1126] to-[#b57639] text-white">
                    <card.icon size={22} />
                  </div>
                  <p className="text-sm text-[#8a5a44]">{card.label}</p>
                  <p className="mt-1 text-3xl font-black text-[#4e1020]">{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
          <h2 className="mb-5 text-2xl font-black text-[#4e1020]">Step 1: Choose the Sheet Type</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                key: "roster" as SheetMode,
                title: "Student Roster",
                description: "Export student information like name, email, and major.",
              },
              {
                key: "attendance" as SheetMode,
                title: "Attendance Sheet",
                description: "Export a template, fill attendance statuses, then import it back.",
              },
              {
                key: "grades" as SheetMode,
                title: "Grades Sheet",
                description: "Export the section grading structure, fill scores, then import it back.",
              },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSheetMode(option.key)}
                className={`rounded-[1.35rem] border p-5 text-left transition ${
                  sheetMode === option.key
                    ? "border-[#b57639] bg-[#fff7eb]"
                    : "border-[#eadcc6] bg-[#fffaf3]"
                }`}
              >
                <p className="font-bold text-[#4e1020]">{option.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#8a5a44]">{option.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
          <h2 className="mb-5 text-2xl font-black text-[#4e1020]">Step 2: Choose Course and Section</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#6b5848]">Course</label>
              <select
                value={selectedCourseId ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedCourseId(value ? Number(value) : null);
                  setSelectedSectionId(null);
                  setStudents([]);
                  setGradeComponents([]);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="w-full rounded-2xl border border-[#dec9aa] bg-[#fffaf3] px-4 py-3"
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.course_id} value={course.course_id}>
                    {course.course_code} - {course.course_title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#6b5848]">Section</label>
              <select
                value={selectedSectionId ?? ""}
                onChange={(e) => setSelectedSectionId(e.target.value ? Number(e.target.value) : null)}
                disabled={!selectedCourseId}
                className="w-full rounded-2xl border border-[#dec9aa] bg-[#fffaf3] px-4 py-3 disabled:bg-[#f3eadc]"
              >
                <option value="">Select section</option>
                {sectionsForCourse.map((section) => (
                  <option key={section.section_id} value={section.section_id}>
                    Section {section.section_id} - {section.schedule_time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {sheetMode === "attendance" && (
            <div className="mt-4 max-w-sm">
              <label className="mb-2 block text-sm font-medium text-[#6b5848]">Attendance date</label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="w-full rounded-2xl border border-[#dec9aa] bg-[#fffaf3] px-4 py-3"
              />
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mt-4 rounded-[1.2rem] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}
        </section>

        {sheetMode === "roster" && (
          <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
            <h2 className="mb-5 text-2xl font-black text-[#4e1020]">Step 3: Choose What Goes Into the Roster</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {FIELD_OPTIONS.map((field) => {
                const checked = selectedFields.includes(field.key);
                return (
                  <label
                    key={field.key}
                    className={`flex cursor-pointer items-center gap-3 rounded-[1.3rem] border px-4 py-4 transition ${
                      checked
                        ? "border-[#b57639] bg-[#fff7eb]"
                        : "border-[#eadcc6] bg-[#fffaf3]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleField(field.key)}
                      className="h-4 w-4 rounded border-[#caaa7a] text-[#7a1126]"
                    />
                    <span className="font-medium text-[#4e1020]">{field.label}</span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {sheetMode === "grades" && selectedSectionId && (
          <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
            <h2 className="mb-5 text-2xl font-black text-[#4e1020]">Step 3: Grade Columns</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {gradeComponents.map((component) => (
                <div key={component.componentId} className="rounded-[1.3rem] border border-[#eadcc6] bg-[#fffaf3] px-4 py-4">
                  <p className="font-bold text-[#4e1020]">{component.name}</p>
                  <p className="mt-1 text-sm text-[#8a5a44]">Weight: {component.weight}%</p>
                </div>
              ))}
              {!gradeComponents.length && (
                <div className="rounded-[1.3rem] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                  This section has no grade structure yet. Save the grade structure first in the gradebook.
                </div>
              )}
            </div>
          </section>
        )}

        <section className="rounded-[1.75rem] border border-[#e2d2bc] bg-white p-7 shadow-[0_22px_55px_rgba(73,36,22,0.08)]">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-[#4e1020]">Step 4: Export or Import</h2>
              <p className="mt-1 text-sm text-[#8a5a44]">
                Export the sheet, fill it in, then import it back for attendance or grades.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={!selectedSectionId || !students.length || exporting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7a1126] px-6 py-3 font-semibold text-white transition hover:bg-[#5f0d1e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={18} />
                {exporting ? "Preparing..." : "Export Excel Sheet"}
              </button>

              {sheetMode !== "roster" && (
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#cfae7f] bg-[#fff8ee] px-6 py-3 font-semibold text-[#7a1126] transition hover:bg-[#fff1db]">
                  <Upload size={18} />
                  {importing ? "Importing..." : "Import Filled Excel"}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportFile}
                    disabled={!selectedSectionId || importing}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {loadingStudents && <p className="text-[#8a5a44]">Loading students...</p>}
          {!loadingStudents && selectedSectionId && !students.length && (
            <p className="text-[#8a5a44]">No active students are enrolled in this section.</p>
          )}
          {!loadingStudents && !selectedSectionId && (
            <p className="text-[#8a5a44]">Choose a course and section first to prepare the sheet.</p>
          )}

          {!!students.length && !!previewHeaders.length && (
            <div className="overflow-x-auto rounded-[1.4rem] border border-[#eadcc6]">
              <table className="min-w-full text-sm">
                <thead className="bg-[#f7f1e7]">
                  <tr>
                    {previewHeaders.map((header) => (
                      <th key={header} className="px-4 py-3 text-left font-semibold text-[#6b5848]">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index} className="border-t border-[#f1e6d6] bg-white">
                      {row.map((cell, cellIndex) => (
                        <td key={`${index}-${cellIndex}`} className="px-4 py-3 text-[#4e1020]">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}