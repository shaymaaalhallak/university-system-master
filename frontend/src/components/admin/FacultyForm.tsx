"use client";

import { FacultyFormValues, FacultyMeta } from "./faculty-types";

type Props = {
  value: FacultyFormValues;
  meta: FacultyMeta | null;
  onChange: (v: FacultyFormValues) => void;
  onSubmit: () => void;
  submitLabel: string;
  includePassword?: boolean;
  loading?: boolean;
};

export default function FacultyForm({
  value,
  meta,
  onChange,
  onSubmit,
  submitLabel,
  includePassword = true,
  loading = false,
}: Props) {
  const update = (key: keyof FacultyFormValues, v: string) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="bg-[#FCFBF8] border border-[#E7E2D9] rounded-xl p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2"
          placeholder="First name"
          value={value.firstName}
          onChange={(e) => update("firstName", e.target.value)}
        />
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2"
          placeholder="Last name"
          value={value.lastName}
          onChange={(e) => update("lastName", e.target.value)}
        />
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2"
          placeholder="Email"
          type="email"
          value={value.email}
          onChange={(e) => update("email", e.target.value)}
        />
        {includePassword ? (
          <input
            className="border border-[#DED7CB] bg-white rounded-lg p-2"
            placeholder="Password"
            type="password"
            value={value.password}
            onChange={(e) => update("password", e.target.value)}
          />
        ) : (
          <input
            className="border border-[#DED7CB] bg-white rounded-lg p-2"
            placeholder="Phone"
            value={value.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        )}
        {includePassword && (
          <input
            className="border border-[#DED7CB] bg-white rounded-lg p-2"
            placeholder="Phone"
            value={value.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        )}

        <select
          className="border border-[#DED7CB] bg-white rounded-lg p-2"
          value={value.departmentId}
          onChange={(e) => update("departmentId", e.target.value)}
        >
          <option value="">Department</option>
          {meta?.departments.map((d) => (
            <option key={d.department_id} value={d.department_id}>
              {d.department_name}
            </option>
          ))}
        </select>

        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2"
          placeholder="Title"
          value={value.title}
          onChange={(e) => update("title", e.target.value)}
        />
        <input
          className="border border-[#DED7CB] bg-white rounded-lg p-2"
          placeholder="Hire date"
          type="date"
          value={value.hireDate}
          onChange={(e) => update("hireDate", e.target.value)}
        />
      </div>

      <button
        onClick={onSubmit}
        disabled={loading}
        className="bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#631F2F] disabled:opacity-60"
      >
        {loading ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
