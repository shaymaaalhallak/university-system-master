import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function calculateGPA(
  grades: { gradePoints: number; credits: number }[],
): number {
  if (grades.length === 0) return 0;

  let totalPoints = 0;
  let totalCredits = 0;

  grades.forEach((grade) => {
    totalPoints += grade.gradePoints * grade.credits;
    totalCredits += grade.credits;
  });

  return totalCredits > 0
    ? Math.round((totalPoints / totalCredits) * 100) / 100
    : 0;
}

export function getGradeLetter(marks: number): string {
  if (marks >= 90) return "A+";
  if (marks >= 80) return "A";
  if (marks >= 75) return "A-";
  if (marks >= 70) return "B+";
  if (marks >= 65) return "B";
  if (marks >= 60) return "B-";
  if (marks >= 55) return "C+";
  if (marks >= 50) return "C";
  if (marks >= 45) return "D";
  return "F";
}

export function getGradePoints(marks: number): number {
  if (marks >= 90) return 4.0;
  if (marks >= 80) return 4.0;
  if (marks >= 75) return 3.7;
  if (marks >= 70) return 3.3;
  if (marks >= 65) return 3.0;
  if (marks >= 60) return 2.7;
  if (marks >= 55) return 2.3;
  if (marks >= 50) return 2.0;
  if (marks >= 45) return 1.0;
  return 0.0;
}

export function calculateAttendancePercentage(
  present: number,
  total: number,
): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getDayName(day: string): string {
  const days: Record<string, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };
  return days[day.toLowerCase()] || day;
}

export function isOverdue(dueDate: Date | string): boolean {
  return new Date(dueDate) < new Date();
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    pending: "bg-yellow-100 text-yellow-800",
    dropped: "bg-red-100 text-red-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
    present: "bg-green-100 text-green-800",
    absent: "bg-red-100 text-red-800",
    late: "bg-yellow-100 text-yellow-800",
    excused: "bg-blue-100 text-blue-800",
  };
  return colors[status.toLowerCase()] || "bg-gray-100 text-gray-800";
}
