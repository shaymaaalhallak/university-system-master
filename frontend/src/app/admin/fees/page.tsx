"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import SearchableSelect from "@/components/SearchableSelect";
import {
  DollarSign, FileText, CreditCard, Percent, AlertTriangle,
  Plus, Trash2, CheckCircle, Search
} from "lucide-react";

type Student = { student_id: number; first_name: string; last_name: string; email: string };
type Invoice = {
  id: number; student_id: number; semester: string; year: number;
  total_credits: number; price_per_credit: number; total_amount: number;
  discount_amount: number; penalty_amount: number; final_amount: number;
  paid_amount: number; status: string; generated_at: string;
  first_name?: string; last_name?: string; email?: string; program_name?: string;
};
type Payment = {
  id: number; invoice_id: number; student_id: number; amount: number;
  payment_method: string; transaction_reference: string; payment_date: string;
  status: string; admin_notes: string;
  first_name?: string; last_name?: string; email?: string;
  semester?: string; year?: number;
};
type Discount = {
  id: number; student_id: number; type: string; value: number;
  reason: string; semester: string; year: number; created_at: string;
  first_name?: string; last_name?: string; email?: string; program_name?: string;
};
type Penalty = {
  id: number; student_id: number; amount: number; reason: string;
  semester: string; year: number; created_at: string;
  first_name?: string; last_name?: string; email?: string; program_name?: string;
};

type Tab = "invoices" | "payments" | "discounts" | "penalties";

export default function AdminFees() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate invoice modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [genSemester, setGenSemester] = useState("Fall");
  const [genYear, setGenYear] = useState(new Date().getFullYear().toString());
  const [genStudentId, setGenStudentId] = useState("");

  // Record payment modal
  const [showPayment, setShowPayment] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payStudentId, setPayStudentId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");

  // Discount modal
  const [showDiscount, setShowDiscount] = useState(false);
  const [discStudentId, setDiscStudentId] = useState("");
  const [discType, setDiscType] = useState("scholarship");
  const [discValue, setDiscValue] = useState("");
  const [discReason, setDiscReason] = useState("");
  const [discSemester, setDiscSemester] = useState("Fall");
  const [discYear, setDiscYear] = useState(new Date().getFullYear().toString());
  const [discAllStudents, setDiscAllStudents] = useState(false);

  // Penalty modal
  const [showPenalty, setShowPenalty] = useState(false);
  const [penStudentId, setPenStudentId] = useState("");
  const [penAmount, setPenAmount] = useState("");
  const [penReason, setPenReason] = useState("");
  const [penSemester, setPenSemester] = useState("Fall");
  const [penYear, setPenYear] = useState(new Date().getFullYear().toString());
  const [penAllStudents, setPenAllStudents] = useState(false);

  // Filter states
  const [searchStudent, setSearchStudent] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, payRes, discRes, penRes, stuRes] = await Promise.all([
        api.get<any>("/fees/invoices"),
        api.get<any>("/fees/payments"),
        api.get<any>("/fees/discounts"),
        api.get<any>("/fees/penalties"),
        api.get<any>("/users/students"),
      ]);
      if (invRes.success) setInvoices(invRes.data);
      if (payRes.success) setPayments(payRes.data);
      if (discRes.success) setDiscounts(discRes.data);
      if (penRes.success) setPenalties(penRes.data);
      if (stuRes.success) setStudents(stuRes.data?.students || stuRes.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user?.role === "admin") fetchData();
  }, [user]);

  const handleGenerateInvoices = async () => {
    try {
      const res = await api.post<any>("/fees/invoices/generate", {
        semester: genSemester,
        year: Number(genYear),
        studentId: genStudentId ? Number(genStudentId) : undefined,
      });
      if (res.success) {
        fetchData();
        setShowGenerate(false);
        setGenStudentId("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordPayment = async () => {
    if (!payInvoiceId || !payStudentId || !payAmount) return;
    try {
      const res = await api.post<any>("/fees/payments", {
        invoice_id: Number(payInvoiceId),
        student_id: Number(payStudentId),
        amount: Number(payAmount),
        payment_method: payMethod,
        transaction_reference: payRef || undefined,
      });
      if (res.success) {
        fetchData();
        setShowPayment(false);
        setPayInvoiceId("");
        setPayStudentId("");
        setPayAmount("");
        setPayRef("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDiscount = async () => {
    if ((!discAllStudents && !discStudentId) || !discValue) return;
    try {
      const res = await api.post<any>("/fees/discounts", {
        student_id: discAllStudents ? undefined : Number(discStudentId),
        type: discType,
        value: Number(discValue),
        reason: discReason || undefined,
        semester: discSemester,
        year: Number(discYear),
        all_students: discAllStudents || undefined,
      });
      if (res.success) {
        fetchData();
        setShowDiscount(false);
        setDiscStudentId("");
        setDiscValue("");
        setDiscReason("");
        setDiscAllStudents(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePenalty = async () => {
    if ((!penAllStudents && !penStudentId) || !penAmount) return;
    try {
      const res = await api.post<any>("/fees/penalties", {
        student_id: penAllStudents ? undefined : Number(penStudentId),
        amount: Number(penAmount),
        reason: penReason || undefined,
        semester: penSemester,
        year: Number(penYear),
        all_students: penAllStudents || undefined,
      });
      if (res.success) {
        fetchData();
        setShowPenalty(false);
        setPenStudentId("");
        setPenAmount("");
        setPenReason("");
        setPenAllStudents(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDiscount = async (id: number) => {
    if (confirm("Delete this discount?")) {
      const res = await api.delete<any>(`/fees/discounts/${id}`);
      if (res.success) setDiscounts((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const handleDeletePenalty = async (id: number) => {
    if (confirm("Delete this penalty?")) {
      const res = await api.delete<any>(`/fees/penalties/${id}`);
      if (res.success) setPenalties((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleVerifyPayment = async (id: number) => {
    const res = await api.put<any>(`/fees/payments/${id}/verify`);
    if (res.success) fetchData();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-green-100 text-green-700",
      partial: "bg-yellow-100 text-yellow-700",
      pending: "bg-gray-100 text-gray-600",
      overdue: "bg-red-100 text-red-700",
      completed: "bg-green-100 text-green-700",
      failed: "bg-red-100 text-red-700",
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-600"}`}>
        {status}
      </span>
    );
  };

  const summary = {
    totalInvoices: invoices.length,
    totalPaid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.final_amount), 0),
    totalPending: invoices.filter((i) => i.status === "pending" || i.status === "partial" || i.status === "overdue")
      .reduce((s, i) => s + (Number(i.final_amount) - Number(i.paid_amount)), 0),
    totalPayments: payments.filter((p) => p.status === "completed").reduce((s, p) => s + Number(p.amount), 0),
    activeDiscounts: discounts.length,
    activePenalties: penalties.length,
  };

  const filteredPayments = payments.filter((p) => {
    if (!searchStudent) return true;
    const q = searchStudent.toLowerCase();
    return (p.first_name + " " + p.last_name).toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
  });

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "invoices", label: "Invoices", icon: FileText },
    { key: "payments", label: "Payments", icon: CreditCard },
    { key: "discounts", label: "Discounts", icon: Percent },
    { key: "penalties", label: "Penalties", icon: AlertTriangle },
  ];

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="bg-gradient-to-r from-[#7A263A] via-[#6A1F31] to-[#531627] rounded-xl shadow-lg p-6 text-white">
          <h1 className="text-3xl font-bold">Fee Management</h1>
          <p className="mt-2 text-[#F5E7DD]">Manage invoices, payments, discounts, and penalties across programs.</p>
        </section>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E7E2D9]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FDF2F3] rounded-lg"><FileText className="text-[#7A263A]" size={20} /></div>
              <div>
                <p className="text-xs text-gray-500">Invoices</p>
                <p className="text-xl font-bold text-gray-900">{summary.totalInvoices}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E7E2D9]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="text-green-600" size={20} /></div>
              <div>
                <p className="text-xs text-gray-500">Collected</p>
                <p className="text-xl font-bold text-gray-900">${summary.totalPayments.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E7E2D9]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg"><CreditCard className="text-yellow-600" size={20} /></div>
              <div>
                <p className="text-xs text-gray-500">Outstanding</p>
                <p className="text-xl font-bold text-gray-900">${summary.totalPending.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E7E2D9]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Percent className="text-blue-600" size={20} /></div>
              <div>
                <p className="text-xs text-gray-500">Discounts</p>
                <p className="text-xl font-bold text-gray-900">{summary.activeDiscounts}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E7E2D9]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="text-red-600" size={20} /></div>
              <div>
                <p className="text-xs text-gray-500">Penalties</p>
                <p className="text-xl font-bold text-gray-900">{summary.activePenalties}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E7E2D9] overflow-hidden">
          <div className="border-b border-[#E7E2D9]">
            <div className="flex">
              {tabs.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition border-b-2 ${
                      active
                        ? "border-[#7A263A] text-[#7A263A]"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <tab.icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {/* ─── Invoices Tab ──────────────────────────────── */}
            {activeTab === "invoices" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">All Invoices</h2>
                  <button
                    onClick={() => setShowGenerate(true)}
                    className="flex items-center gap-2 bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#6A1F31] transition text-sm"
                  >
                    <Plus size={18} />
                    Generate Invoices
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#FDF2F3]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Semester</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Credits</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Paid</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Balance</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-[#FCFBF8]">
                          <td className="px-4 py-3 text-sm">
                            <p className="font-medium text-gray-900">{inv.first_name} {inv.last_name}</p>
                            <p className="text-xs text-gray-500">{inv.email}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{inv.semester} {inv.year}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{inv.total_credits}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">${Number(inv.final_amount).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-green-600">${Number(inv.paid_amount).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm font-semibold">${(Number(inv.final_amount) - Number(inv.paid_amount)).toFixed(2)}</td>
                          <td className="px-4 py-3">{getStatusBadge(inv.status)}</td>
                        </tr>
                      ))}
                      {invoices.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No invoices yet. Generate them above.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── Payments Tab ──────────────────────────────── */}
            {activeTab === "payments" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">Payment Records</h2>
                  <button
                    onClick={() => setShowPayment(true)}
                    className="flex items-center gap-2 bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#6A1F31] transition text-sm"
                  >
                    <Plus size={18} />
                    Record Payment
                  </button>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by student name or email..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-[#DED7CB] rounded-lg text-sm focus:ring-2 focus:ring-[#7A263A] focus:border-[#7A263A]"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#FDF2F3]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Method</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredPayments.map((pay) => (
                        <tr key={pay.id} className="hover:bg-[#FCFBF8]">
                          <td className="px-4 py-3 text-sm">
                            <p className="font-medium text-gray-900">{pay.first_name} {pay.last_name}</p>
                            <p className="text-xs text-gray-500">{pay.email}</p>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">${Number(pay.amount).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 capitalize">{pay.payment_method || "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {pay.payment_date ? new Date(pay.payment_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(pay.status)}</td>
                          <td className="px-4 py-3">
                            {pay.status === "pending" && (
                              <button
                                onClick={() => handleVerifyPayment(pay.id)}
                                className="text-green-600 hover:text-green-800 transition"
                                title="Verify payment"
                              >
                                <CheckCircle size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredPayments.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No payments found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── Discounts Tab ─────────────────────────────── */}
            {activeTab === "discounts" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">Scholarships & Discounts</h2>
                  <button
                    onClick={() => setShowDiscount(true)}
                    className="flex items-center gap-2 bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#6A1F31] transition text-sm"
                  >
                    <Plus size={18} />
                    Add Discount
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#FDF2F3]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Value</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Semester</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {discounts.map((d) => (
                        <tr key={d.id} className="hover:bg-[#FCFBF8]">
                          <td className="px-4 py-3 text-sm">
                            <p className="font-medium text-gray-900">{d.first_name} {d.last_name}</p>
                            <p className="text-xs text-gray-500">{d.email}</p>
                          </td>
                          <td className="px-4 py-3 text-sm capitalize text-gray-700">{d.type}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-600">-${Number(d.value).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{d.reason || "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{d.semester} {d.year}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDeleteDiscount(d.id)}
                              className="text-red-500 hover:text-red-700 transition"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {discounts.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No discounts recorded.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── Penalties Tab ─────────────────────────────── */}
            {activeTab === "penalties" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">Late Fees & Penalties</h2>
                  <button
                    onClick={() => setShowPenalty(true)}
                    className="flex items-center gap-2 bg-[#7A263A] text-white px-4 py-2 rounded-lg hover:bg-[#6A1F31] transition text-sm"
                  >
                    <Plus size={18} />
                    Add Penalty
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#FDF2F3]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Student</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Semester</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#7A263A] uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {penalties.map((p) => (
                        <tr key={p.id} className="hover:bg-[#FCFBF8]">
                          <td className="px-4 py-3 text-sm">
                            <p className="font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                            <p className="text-xs text-gray-500">{p.email}</p>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-red-600">+${Number(p.amount).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{p.reason || "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{p.semester} {p.year}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleDeletePenalty(p.id)}
                              className="text-red-500 hover:text-red-700 transition"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {penalties.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No penalties recorded.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generate Invoice Modal */}
        {showGenerate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowGenerate(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Invoices</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Semester</label>
                  <select value={genSemester} onChange={(e) => setGenSemester(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm">
                    <option value="Fall">Fall</option>
                    <option value="Spring">Spring</option>
                    <option value="Summer">Summer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Year</label>
                  <input type="number" value={genYear} onChange={(e) => setGenYear(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Specific Student (optional)</label>
                  <select value={genStudentId} onChange={(e) => setGenStudentId(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm">
                    <option value="">All students with enrollments</option>
                    {students.map((s: any) => (
                      <option key={s.student_id} value={s.student_id}>{s.first_name} {s.last_name} ({s.email})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowGenerate(false)} className="flex-1 px-4 py-2 border border-[#DED7CB] rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleGenerateInvoices} className="flex-1 px-4 py-2 bg-[#7A263A] text-white rounded-lg text-sm hover:bg-[#6A1F31]">Generate</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Record Payment Modal */}
        {showPayment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPayment(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Payment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Student</label>
                  <SearchableSelect
                    options={students.map((s: any) => ({ value: s.student_id, label: `${s.first_name} ${s.last_name} (${s.email})` }))}
                    value={payStudentId}
                    onChange={setPayStudentId}
                    placeholder="Type to search student..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Invoice</label>
                  <select value={payInvoiceId} onChange={(e) => setPayInvoiceId(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm">
                    <option value="">Select invoice...</option>
                    {invoices.filter(i => !payStudentId || i.student_id === Number(payStudentId)).map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        #{inv.id} - {inv.semester} {inv.year} (${Number(inv.final_amount).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
                  <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm">
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Transaction Ref (optional)</label>
                  <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowPayment(false)} className="flex-1 px-4 py-2 border border-[#DED7CB] rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleRecordPayment} disabled={!payInvoiceId || !payStudentId || !payAmount} className="flex-1 px-4 py-2 bg-[#7A263A] text-white rounded-lg text-sm hover:bg-[#6A1F31] disabled:opacity-50">Record</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Discount Modal */}
        {showDiscount && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDiscount(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Discount</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Student</label>
                  <SearchableSelect
                    options={students.map((s: any) => ({ value: s.student_id, label: `${s.first_name} ${s.last_name} (${s.email})` }))}
                    value={discStudentId}
                    onChange={setDiscStudentId}
                    placeholder="Type to search student..."
                    disabled={discAllStudents}
                  />
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <input type="checkbox" checked={discAllStudents} onChange={(e) => setDiscAllStudents(e.target.checked)} className="rounded border-gray-300" />
                    Apply to all students enrolled this semester
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select value={discType} onChange={(e) => setDiscType(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm">
                    <option value="scholarship">Scholarship</option>
                    <option value="merit">Merit Discount</option>
                    <option value="need_based">Need-based</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Value ($)</label>
                  <input type="number" step="0.01" value={discValue} onChange={(e) => setDiscValue(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason</label>
                  <input type="text" value={discReason} onChange={(e) => setDiscReason(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Semester</label>
                    <select value={discSemester} onChange={(e) => setDiscSemester(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm">
                      <option value="Fall">Fall</option>
                      <option value="Spring">Spring</option>
                      <option value="Summer">Summer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Year</label>
                    <input type="number" value={discYear} onChange={(e) => setDiscYear(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowDiscount(false)} className="flex-1 px-4 py-2 border border-[#DED7CB] rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleCreateDiscount} disabled={(!discAllStudents && !discStudentId) || !discValue} className="flex-1 px-4 py-2 bg-[#7A263A] text-white rounded-lg text-sm hover:bg-[#6A1F31] disabled:opacity-50">Create</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Penalty Modal */}
        {showPenalty && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPenalty(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Penalty</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Student</label>
                  <SearchableSelect
                    options={students.map((s: any) => ({ value: s.student_id, label: `${s.first_name} ${s.last_name} (${s.email})` }))}
                    value={penStudentId}
                    onChange={setPenStudentId}
                    placeholder="Type to search student..."
                    disabled={penAllStudents}
                  />
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <input type="checkbox" checked={penAllStudents} onChange={(e) => setPenAllStudents(e.target.checked)} className="rounded border-gray-300" />
                    Apply to all students enrolled this semester
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
                  <input type="number" step="0.01" value={penAmount} onChange={(e) => setPenAmount(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason</label>
                  <input type="text" value={penReason} onChange={(e) => setPenReason(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Semester</label>
                    <select value={penSemester} onChange={(e) => setPenSemester(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm">
                      <option value="Fall">Fall</option>
                      <option value="Spring">Spring</option>
                      <option value="Summer">Summer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Year</label>
                    <input type="number" value={penYear} onChange={(e) => setPenYear(e.target.value)} className="w-full rounded-lg border border-[#DED7CB] px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowPenalty(false)} className="flex-1 px-4 py-2 border border-[#DED7CB] rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={handleCreatePenalty} disabled={(!penAllStudents && !penStudentId) || !penAmount} className="flex-1 px-4 py-2 bg-[#7A263A] text-white rounded-lg text-sm hover:bg-[#6A1F31] disabled:opacity-50">Create</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
