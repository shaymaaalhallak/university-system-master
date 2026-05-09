"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ExternalLink,
  Save,
  Briefcase,
  CalendarDays,
  Upload,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { professorApi } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
type CvResponse = {
  cv_url: string | null;
  title: string | null;
  hire_date: string | null;
};

const getFileUrl = (path: string | null) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";
  const backendBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;
  return `${backendBase}${path}`;
};

export default function ProfessorCvPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [loadingPage, setLoadingPage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<CvResponse | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role !== "professor") {
      return;
    }

    const loadCv = async () => {
      try {
        setLoadingPage(true);
        setError(null);

        const response = (await professorApi.getMyCv()) as {
          success: boolean;
          data?: CvResponse;
          message?: string;
        };
        if (!response.success || !response.data) {
          throw new Error(response.message || "Failed to load CV");
        }

        setProfile(response.data);
      } catch (err) {
        console.error(err);
        setError("Unable to load your CV details right now.");
      } finally {
        setLoadingPage(false);
      }
    };

    loadCv();
  }, [user]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      if (!cvFile) {
        setError("Please select a CV file to upload.");
        return;
      }

      const formData = new FormData();
      formData.append("file", cvFile);

      const response = (await professorApi.updateMyCvFile(formData)) as {
        success: boolean;
        message?: string;
        data?: { cvUrl: string };
      };
      if (!response.success) {
        throw new Error(response.message || "Failed to upload CV");
      }

      setProfile((current) => ({
        cv_url: response.data?.cvUrl ?? current?.cv_url ?? null,
        title: current?.title ?? null,
        hire_date: current?.hire_date ?? null,
      }));
      setCvFile(null);
      setMessage(response.message || "CV uploaded successfully.");
    } catch (err) {
      console.error(err);
      setError("Unable to upload your CV right now.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loadingPage) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (user?.role !== "professor") {
    return (
      <div className="p-6">
        Access denied. This page is for professors only.
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 text-black">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3">
              <FileText className="text-blue-700" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My CV</h1>
              <p className="text-sm text-gray-500">
                Upload your CV file so it can be viewed from the system.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Profile Summary
            </h2>

            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                <div className="rounded-lg bg-green-100 p-2">
                  <Briefcase className="text-green-700" size={18} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Title
                  </p>
                  <p className="font-medium text-gray-900">
                    {profile?.title || "Not set"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                <div className="rounded-lg bg-yellow-100 p-2">
                  <CalendarDays className="text-yellow-700" size={18} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Hire Date
                  </p>
                  <p className="font-medium text-gray-900">
                    {profile?.hire_date
                      ? new Date(profile.hire_date).toLocaleDateString()
                      : "Not set"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                  Current CV
                </p>
                {profile?.cv_url ? (
                  <a
                    href={getFileUrl(profile.cv_url) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 underline"
                  >
                    <ExternalLink size={14} />
                    Open current CV
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">No CV saved yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Update CV
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Upload CV File
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50">
                    <Upload size={16} />
                    {cvFile ? cvFile.name : "Choose file"}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                  {cvFile && (
                    <button
                      onClick={() => setCvFile(null)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Upload your CV as PDF or Word document (max 10 MB).
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              {message && (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  {message}
                </p>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !cvFile}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:bg-blue-300"
              >
                <Save size={16} />
                {saving ? "Uploading..." : "Upload CV"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
