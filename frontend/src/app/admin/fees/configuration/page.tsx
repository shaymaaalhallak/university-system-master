"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { DollarSign, Plus, Trash2, Save } from "lucide-react";

type ProgramFeeConfig = {
  id: number;
  program_id: number;
  program_name: string;
  price_per_credit: number;
  effective_from: string | null;
  effective_to: string | null;
};

type Program = {
  program_id: number;
  program_name: string;
  department_id: number;
};

export default function AdminFeeConfiguration() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [configs, setConfigs] = useState<ProgramFeeConfig[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [pricePerCredit, setPricePerCredit] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");

  const today = new Date();
  const minFrom = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString().split("T")[0];
  const maxFrom = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().split("T")[0];

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    Promise.all([
      api.get<any>("/fees/config"),
      api.get<any>("/users/programs"),
    ])
      .then(([configRes, progRes]) => {
        if (configRes.success) setConfigs(configRes.data);
        if (progRes.success) setPrograms(progRes.data);
      })
      .catch(console.error);
  }, [user]);

  const handleProgramChange = (programId: string) => {
    setSelectedProgram(programId);
    const existing = configs.find((c) => c.program_id === Number(programId));
    if (existing) {
      setPricePerCredit(String(existing.price_per_credit));
      setEffectiveFrom(existing.effective_from ? existing.effective_from.split("T")[0] : "");
      setEffectiveTo(existing.effective_to ? existing.effective_to.split("T")[0] : "");
    } else {
      setPricePerCredit("");
      setEffectiveFrom("");
      setEffectiveTo("");
    }
  };

  const handleSave = async () => {
    if (!selectedProgram || !pricePerCredit) return;
    try {
      const res = await api.post<any>("/fees/config", {
        program_id: Number(selectedProgram),
        price_per_credit: Number(pricePerCredit),
        effective_from: effectiveFrom || null,
        effective_to: effectiveTo || null,
      });
      if (res.success) {
        const configRes = await api.get<any>("/fees/config");
        if (configRes.success) setConfigs(configRes.data);
        setSelectedProgram("");
        setPricePerCredit("");
        setEffectiveFrom("");
        setEffectiveTo("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await api.delete<any>(`/fees/config/${id}`);
      if (res.success) {
        setConfigs((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7A263A]" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return <div className="p-6 text-gray-700">Access denied.</div>;
  }

  const programConfigMap = new Map(configs.map((c) => [c.program_id, c]));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="bg-gradient-to-r from-[#7A263A] via-[#6A1F31] to-[#531627] rounded-xl shadow-lg p-6 text-white">
          <h1 className="text-3xl font-bold">Fee Configuration</h1>
          <p className="mt-2 text-[#F5E7DD]">Set credit-hour pricing per program.</p>
        </section>

        <div className="bg-white rounded-xl shadow-sm border border-[#E7E2D9] p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plus size={20} className="text-[#7A263A]" />
            Add / Edit Fee Setting
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Program</label>
              <select
                value={selectedProgram}
                onChange={(e) => handleProgramChange(e.target.value)}
                className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm focus:ring-2 focus:ring-[#7A263A] focus:border-[#7A263A]"
              >
                <option value="">Select program...</option>
                {programs.map((p) => {
                  const existing = programConfigMap.get(p.program_id);
                  return (
                    <option key={p.program_id} value={p.program_id}>
                      {p.program_name} {existing ? `($${Number(existing.price_per_credit).toFixed(2)}/cr)` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Credit ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pricePerCredit}
                onChange={(e) => setPricePerCredit(e.target.value)}
                className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm focus:ring-2 focus:ring-[#7A263A] focus:border-[#7A263A]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => {
                  setEffectiveFrom(e.target.value);
                  if (effectiveTo && e.target.value >= effectiveTo) setEffectiveTo("");
                }}
                min={minFrom}
                max={maxFrom}
                className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm focus:ring-2 focus:ring-[#7A263A] focus:border-[#7A263A]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective To</label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                min={effectiveFrom || minFrom}
                className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm focus:ring-2 focus:ring-[#7A263A] focus:border-[#7A263A]"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={!selectedProgram || !pricePerCredit}
              className="flex items-center justify-center gap-2 bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#6A1F31] transition disabled:opacity-50"
            >
              <Save size={18} />
              Save
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[#E7E2D9] overflow-hidden">
          <div className="p-6 border-b border-[#E7E2D9]">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign size={20} className="text-[#7A263A]" />
              Current Fee Settings
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#FDF2F3]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Program</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Price / Credit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Effective From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Effective To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {configs.map((config) => (
                  <tr key={config.id} className="hover:bg-[#FCFBF8]">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{config.program_name}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="font-semibold text-[#7A263A]">${Number(config.price_per_credit).toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{config.effective_from ? new Date(config.effective_from).toLocaleDateString() : "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{config.effective_to ? new Date(config.effective_to).toLocaleDateString() : "—"}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="text-red-500 hover:text-red-700 transition"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {configs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No fee configurations yet. Add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
