"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ExternalLink, Save, Briefcase, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { professorApi } from "@/lib/api";

type CvResponse = {
  cv_url: string | null;
  title: string | null;
  hire_date: string | null;
};

export default function ProfessorCvPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [loadingPage, setLoadingPage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<CvResponse | null>(null);
  const [cvUrl, setCvUrl] = useState("");

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

        const response = await professorApi.getMyCv() as { success: boolean; data?: CvResponse; message?: string };
        if (!response.success || !response.data) {
          throw new Error(response.message || "Failed to load CV");
        }

        setProfile(response.data);
        setCvUrl(response.data.cv_url ?? "");
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

      const trimmedUrl = cvUrl.trim();
      if (!trimmedUrl) {
        setError("Please enter your CV file link first.");
        return;
      }

      const response = await professorApi.updateMyCv({ cvUrl: trimmedUrl }) as { success: boolean; message?: string };
      if (!response.success) {
        throw new Error(response.message || "Failed to save CV");
      }

      setProfile((current) => ({
        cv_url: trimmedUrl,
        title: current?.title ?? null,
        hire_date: current?.hire_date ?? null,
      }));
      setMessage(response.message || "CV updated successfully.");
    } catch (err) {
      console.error(err);
      setError("Unable to save your CV right now.");
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
    return <div className="p-6">Access denied. This page is for professors only.</div>;
  }

  return (
    <div className="space-y-6 text-black">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-3">
            <FileText className="text-blue-700" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My CV</h1>
            <p className="text-sm text-gray-500">
              Add or update your CV link so it can be viewed from the system.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile Summary</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
              <div className="rounded-lg bg-green-100 p-2">
                <Briefcase className="text-green-700" size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Title</p>
                <p className="font-medium text-gray-900">{profile?.title || "Not set"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
              <div className="rounded-lg bg-yellow-100 p-2">
                <CalendarDays className="text-yellow-700" size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Hire Date</p>
                <p className="font-medium text-gray-900">
                  {profile?.hire_date ? new Date(profile.hire_date).toLocaleDateString() : "Not set"}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Current CV</p>
              {profile?.cv_url ? (
                <a
                  href={profile.cv_url}
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
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Update CV</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">CV File Link</label>
              <input
                type="text"
                value={cvUrl}
                onChange={(e) => setCvUrl(e.target.value)}
                placeholder="Paste your CV file link here"
                className="w-full rounded-lg border px-3 py-2"
              />
              <p className="mt-2 text-xs text-gray-500">
                Example: a PDF link from Google Drive, OneDrive, Dropbox, or your uploaded file location.
              </p>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:bg-blue-300"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save CV"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
