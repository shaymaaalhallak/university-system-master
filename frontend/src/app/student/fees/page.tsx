"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { DollarSign, CheckCircle, Clock, BookOpen, CreditCard, Receipt, AlertTriangle, Percent } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function StudentFees() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === "student") {
      api.get<any>("/fees/dashboard")
        .then((res) => {
          if (res.success) setData(res.data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7A263A]" />
      </div>
    );
  }

  if (user?.role !== "student")
    return <div className="p-6 text-gray-700">Access denied.</div>;

  const enrollments = data?.enrollments || [];
  const invoices = data?.invoices || [];
  const payments = data?.payments || [];
  const discounts = data?.discounts || [];
  const penalties = data?.penalties || [];
  const totalCredits = data?.totalCredits || 0;
  const totalPaid = data?.totalPaid || 0;
  const totalPending = data?.totalPending || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="bg-gradient-to-r from-[#7A263A] via-[#6A1F31] to-[#531627] rounded-xl shadow-lg p-6 text-white">
          <h1 className="text-3xl font-bold">Fees & Payments</h1>
          <p className="mt-2 text-[#F5E7DD]">
            View your tuition, invoices, and payment history.
          </p>
        </section>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E7E2D9]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FDF2F3] rounded-lg">
                <BookOpen className="text-[#7A263A]" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Enrolled Credits</p>
                <p className="text-xl font-bold text-gray-900">{totalCredits}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E7E2D9]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Tuition</p>
                <p className="text-xl font-bold text-gray-900">
                  ${(totalPaid + totalPending).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E7E2D9]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Paid</p>
                <p className="text-xl font-bold text-gray-900">
                  ${totalPaid.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E7E2D9]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Clock className="text-red-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500">Balance</p>
                <p className="text-xl font-bold text-gray-900">
                  ${totalPending.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Enrolled Courses with Costs */}
        {enrollments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E7E2D9] overflow-hidden">
            <div className="p-6 border-b border-[#E7E2D9]">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen size={20} className="text-[#7A263A]" />
                Enrolled Courses
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#FDF2F3]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Course</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Section</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Credits</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Semester</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {enrollments.map((e: any) => (
                    <tr key={e.enrollment_id} className="hover:bg-[#FCFBF8]">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{e.course_code}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{e.course_title}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{e.section_name || "—"}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{e.credits}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{e.semester} {e.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invoices */}
        {invoices.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E7E2D9] overflow-hidden">
            <div className="p-6 border-b border-[#E7E2D9]">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Receipt size={20} className="text-[#7A263A]" />
                Invoices
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#FDF2F3]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Semester</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Credits</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Discount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Penalty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Final</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-[#FCFBF8]">
                      <td className="px-6 py-4 text-sm text-gray-700">{inv.semester} {inv.year}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{inv.total_credits}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">${Number(inv.total_amount).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-green-600">-${Number(inv.discount_amount).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-red-600">+${Number(inv.penalty_amount).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">${Number(inv.final_amount).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-green-600">${Number(inv.paid_amount).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          inv.status === "paid" ? "bg-green-100 text-green-700" :
                          inv.status === "partial" ? "bg-yellow-100 text-yellow-700" :
                          inv.status === "overdue" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Discounts & Penalties */}
        {(discounts.length > 0 || penalties.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {discounts.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-[#E7E2D9] overflow-hidden">
                <div className="p-6 border-b border-[#E7E2D9]">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Percent size={20} className="text-green-600" />
                    Discounts & Scholarships
                  </h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {discounts.map((d: any) => (
                    <div key={d.id} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900 capitalize">{d.type}</p>
                        <p className="text-xs text-gray-500">{d.reason || "—"} · {d.semester} {d.year}</p>
                      </div>
                      <span className="text-sm font-semibold text-green-600">-${Number(d.value).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {penalties.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-[#E7E2D9] overflow-hidden">
                <div className="p-6 border-b border-[#E7E2D9]">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle size={20} className="text-red-600" />
                    Late Fees & Penalties
                  </h2>
                </div>
                <div className="divide-y divide-gray-200">
                  {penalties.map((p: any) => (
                    <div key={p.id} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.reason || "Penalty"}</p>
                        <p className="text-xs text-gray-500">{p.semester} {p.year}</p>
                      </div>
                      <span className="text-sm font-semibold text-red-600">+${Number(p.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment History */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E7E2D9] overflow-hidden">
          <div className="p-6 border-b border-[#E7E2D9]">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard size={20} className="text-[#7A263A]" />
              Payment History
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#FDF2F3]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-[#FCFBF8]">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">${Number(p.amount).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 capitalize">{p.payment_method || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        p.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!payments.length && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No payment records found.
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
