"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { DollarSign, CheckCircle, Clock } from "lucide-react";

export default function StudentFees() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [structure, setStructure] = useState<any>(null);
  const [totals, setTotals] = useState({ paid: 0, pending: 0 });

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === "student") {
      // FIX: res is already response.data — use res.success not res.data.success
      Promise.all([api.get<any>("/fees/my"), api.get<any>("/fees/structure")])
        .then(([feesRes, structRes]) => {
          if (feesRes.success) {
            setPayments(feesRes.data.payments || []);
            setTotals({ paid: feesRes.data.totalPaid || 0, pending: feesRes.data.totalPending || 0 });
          }
          if (structRes.success) setStructure(structRes.data);
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

  return (
    <div className="space-y-6  bg-white rounded-xl shadow-sm border p-6">
      <h1 className="text-2xl font-bold text-gray-900">Fees & Payments</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg"><DollarSign className="text-blue-600" size={24} /></div>
            <div>
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-3xl font-bold text-gray-900">${totals.paid + totals.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg"><CheckCircle className="text-green-600" size={24} /></div>
            <div>
              <p className="text-sm text-gray-500">Paid</p>
              <p className="text-3xl font-bold text-gray-900">${totals.paid}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg"><Clock className="text-red-600" size={24} /></div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-3xl font-bold text-gray-900">${totals.pending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Fee Structure */}
      {structure && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Fee Structure & Payment Plan</h2>
          <div className="mb-4">
            <p className="text-gray-700 font-medium">Tuition: ${structure.tuition.perSemester} per semester</p>
            <p className="text-sm text-gray-500 mb-3">{structure.tuition.description}</p>
            <h3 className="font-medium text-gray-800 mb-2">Installment Options:</h3>
            <div className="space-y-2">
              {structure.tuition.installments.map((inst: any, i: number) => (
                <div key={i} className="flex justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <span className="text-gray-700">{inst.name}</span>
                  <span className="font-semibold">${inst.amount} ({inst.percentage}%)</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Payment methods: {structure.tuition.paymentMethods.join(", ")}
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-800 mb-2">Other Fees:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {structure.otherFees.map((fee: any, i: number) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <p className="font-medium capitalize">{fee.type}</p>
                  <p className="text-gray-500">{fee.description}</p>
                  <p className="font-semibold text-blue-600">${fee.amount}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((p) => (
                <tr key={p.payment_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900 capitalize">{p.payment_type}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">${p.amount}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 capitalize">{p.payment_method || "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${p.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!payments.length && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No payment records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
