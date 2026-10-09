"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Role, formatINR } from "@creditsea/shared";
import { Protected, fetchDocument, request } from "../../../components/auth";
import { Shell } from "../../../components/shell";
type Loan = {
  _id: string;
  borrowerId: { fullName: string; email: string };
  status: string;
  principalPaise: number;
  tenureDays: number;
  interestPaise: number;
  totalRepaymentPaise: number;
  paidAmountPaise: number;
  appliedAt: string;
  applicationSnapshot: {
    pan: string;
    monthlySalaryPaise: number;
    employmentMode: string;
    dateOfBirth: string;
  };
  payments: { utr: string; amountPaise: number; paymentDate: string }[];
};
type Lead = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  draft?: {
    personalDetails?: { employmentMode: string; monthlySalaryPaise: number };
    salarySlip?: unknown;
    eligibility?: { eligible: boolean };
  };
};
const roles: Record<string, Role> = {
  sales: "SALES",
  sanction: "SANCTION",
  disbursement: "DISBURSEMENT",
  collection: "COLLECTION",
};
function Content({ module }: { module: string }) {
  const [items, setItems] = useState<Loan[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Loan | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [utr, setUtr] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const load = useCallback(async () => {
    try {
      const route =
        module === "sales"
          ? "/operations/sales/leads"
          : `/operations/${module}/loans`;
      const result = await request<{ items: (Loan | Lead)[]; total: number }>(
        `${route}?page=${page}&limit=20`,
      );
      if (module === "sales") setLeads(result.items as Lead[]);
      else setItems(result.items as Loan[]);
      setTotal(result.total);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [module, page]);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(path: string, body?: unknown) {
    if (!selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`/operations/${module}/loans/${selected._id}/${path}`, {
        method: "POST",
        body: JSON.stringify(body || {}),
      });
      setNotice("Action completed successfully.");
      setSelected(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible =
    module === "sales"
      ? leads.filter((x) =>
          (x.fullName + x.email).toLowerCase().includes(search.toLowerCase()),
        )
      : items.filter((x) =>
          (x.borrowerId.fullName + x.borrowerId.email + x._id)
            .toLowerCase()
            .includes(search.toLowerCase()),
        );
  const leadProgress = (lead: Lead) =>
    lead.draft?.eligibility?.eligible && lead.draft?.salarySlip
      ? "Ready to apply"
      : lead.draft?.eligibility?.eligible === false
        ? "Eligibility needs attention"
        : lead.draft?.personalDetails
          ? "Personal details saved"
          : "Registered";
  return (
    <Shell title={`${module.charAt(0).toUpperCase() + module.slice(1)} queue`}>
      <div className="flex flex-wrap justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">
            {module === "sales"
              ? "Pre-application leads"
              : module === "sanction"
                ? "Applications to review"
                : module === "disbursement"
                  ? "Ready to disburse"
                  : "Active collections"}
          </h2>
          <p className="muted">
            {total} record{total === 1 ? "" : "s"} in this queue
          </p>
        </div>
        <input
          className="field max-w-xs"
          aria-label="Search records"
          placeholder="Search records"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="error mb-5">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success mb-5">
          {notice}
        </p>
      )}
      <div className="grid gap-3 md:hidden">
        {visible.length === 0 ? (
          <div className="card p-6 text-center muted">
            No records found in this queue.
          </div>
        ) : module === "sales" ? (
          (visible as Lead[]).map((lead) => (
            <article key={lead.id} className="card p-5 min-w-0">
              <strong className="block break-words">{lead.fullName}</strong>
              <p className="muted text-sm break-all">{lead.email}</p>
              <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div>
                  <dt className="muted">Registered</dt>
                  <dd>
                    {new Date(lead.createdAt).toLocaleDateString("en-IN")}
                  </dd>
                </div>
                <div>
                  <dt className="muted">Salary</dt>
                  <dd>
                    {lead.draft?.personalDetails
                      ? formatINR(lead.draft.personalDetails.monthlySalaryPaise)
                      : "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4">
                <span className="chip">{leadProgress(lead)}</span>
              </p>
              <button
                className="btn-secondary mt-4"
                onClick={() =>
                  alert(
                    `${lead.fullName}\n${lead.email}\n${lead.draft?.personalDetails?.employmentMode || "No employment details"}`,
                  )
                }
              >
                View lead
              </button>
            </article>
          ))
        ) : (
          (visible as Loan[]).map((loan) => (
            <article key={loan._id} className="card p-5 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <strong className="break-words">
                  {loan.borrowerId.fullName}
                </strong>
                <span className={`chip status-${loan.status}`}>
                  {loan.status}
                </span>
              </div>
              <p className="muted text-sm break-all">{loan.borrowerId.email}</p>
              <p className="muted font-mono text-xs mt-2">
                Loan #{loan._id.slice(-8).toUpperCase()}
              </p>
              <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div>
                  <dt className="muted">Principal</dt>
                  <dd>{formatINR(loan.principalPaise)}</dd>
                </div>
                <div>
                  <dt className="muted">Total repayment</dt>
                  <dd>{formatINR(loan.totalRepaymentPaise)}</dd>
                </div>
              </dl>
              <button
                className="btn-secondary mt-4"
                onClick={() => {
                  setSelected(loan);
                  setError("");
                }}
              >
                Review loan
              </button>
            </article>
          ))
        )}
      </div>
      <div className="card overflow-x-auto hidden md:block">
        {visible.length === 0 ? (
          <div className="p-12 text-center muted">
            No records found in this queue.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                {module === "sales" ? (
                  <>
                    <th>Borrower</th>
                    <th>Registered</th>
                    <th>Progress</th>
                    <th>Salary</th>
                    <th></th>
                  </>
                ) : (
                  <>
                    <th>Loan ID</th>
                    <th>Borrower</th>
                    <th>Principal</th>
                    <th>Total repayment</th>
                    <th>Status</th>
                    <th></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {module === "sales"
                ? (visible as Lead[]).map((x) => (
                    <tr key={x.id}>
                      <td>
                        <strong>{x.fullName}</strong>
                        <br />
                        <span className="muted text-sm">{x.email}</span>
                      </td>
                      <td>
                        {new Date(x.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td>
                        <span className="chip">{leadProgress(x)}</span>
                      </td>
                      <td>
                        {x.draft?.personalDetails
                          ? formatINR(
                              x.draft.personalDetails.monthlySalaryPaise,
                            )
                          : "—"}
                      </td>
                      <td>
                        <button
                          className="btn-secondary"
                          onClick={() =>
                            alert(
                              `${x.fullName}\n${x.email}\n${x.draft?.personalDetails?.employmentMode || "No employment details"}`,
                            )
                          }
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                : (visible as Loan[]).map((x) => (
                    <tr key={x._id}>
                      <td className="font-mono">
                        #{x._id.slice(-8).toUpperCase()}
                      </td>
                      <td>
                        <strong>{x.borrowerId.fullName}</strong>
                        <br />
                        <span className="muted text-sm">
                          {x.borrowerId.email}
                        </span>
                      </td>
                      <td>{formatINR(x.principalPaise)}</td>
                      <td>{formatINR(x.totalRepaymentPaise)}</td>
                      <td>
                        <span className={`chip status-${x.status}`}>
                          {x.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setSelected(x);
                            setError("");
                          }}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex gap-3 items-center mt-5">
        <button
          className="btn-secondary"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="btn-secondary"
          disabled={page * 20 >= total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
      {selected && (
        <div
          className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Loan review"
        >
          <div className="card p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between">
              <div>
                <div className={`chip status-${selected.status}`}>
                  {selected.status}
                </div>
                <h3 className="text-2xl font-bold mt-3">
                  Loan #{selected._id.slice(-8).toUpperCase()}
                </h3>
                <p className="muted">
                  {selected.borrowerId.fullName} · {selected.borrowerId.email}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close dialog"
                className="text-2xl self-start"
              >
                ×
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              {[
                ["Principal", formatINR(selected.principalPaise)],
                ["Interest", formatINR(selected.interestPaise)],
                ["Total repayment", formatINR(selected.totalRepaymentPaise)],
                [
                  "Outstanding",
                  formatINR(
                    selected.totalRepaymentPaise - selected.paidAmountPaise,
                  ),
                ],
                ["Tenure", `${selected.tenureDays} days`],
                ["Employment", selected.applicationSnapshot.employmentMode],
              ].map(([a, b]) => (
                <div key={a} className="bg-slate-50 rounded-lg p-3">
                  <div className="muted text-xs">{a}</div>
                  <strong>{b}</strong>
                </div>
              ))}
            </div>
            {module === "sanction" && (
              <>
                <div className="bg-slate-50 rounded-lg p-4 mt-5 text-sm">
                  PAN: {selected.applicationSnapshot.pan} · Salary:{" "}
                  {formatINR(selected.applicationSnapshot.monthlySalaryPaise)} ·
                  DOB: {selected.applicationSnapshot.dateOfBirth}
                </div>
                <button
                  className="btn-secondary mt-4"
                  onClick={async () => {
                    const preview = window.open("", "_blank");
                    try {
                      const blob = await fetchDocument(
                        `/operations/sanction/loans/${selected._id}/salary-slip`,
                      );
                      const url = URL.createObjectURL(blob);
                      if (preview) preview.location.href = url;
                      else window.open(url, "_blank");
                    } catch (error) {
                      preview?.close();
                      setError((error as Error).message);
                    }
                  }}
                >
                  View salary slip
                </button>
                <div className="flex flex-wrap gap-3 mt-6">
                  <button
                    disabled={busy}
                    className="btn"
                    onClick={() => {
                      if (confirm("Approve this loan?")) void action("approve");
                    }}
                  >
                    Approve loan
                  </button>
                </div>
                <label className="label mt-6" htmlFor="reason">
                  Rejection reason
                </label>
                <input
                  id="reason"
                  className="field"
                  minLength={5}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this application is rejected"
                />
                <button
                  disabled={busy || reason.trim().length < 5}
                  className="btn-danger mt-3"
                  onClick={() => {
                    if (confirm("Reject this loan?"))
                      void action("reject", { reason });
                  }}
                >
                  Reject loan
                </button>
              </>
            )}
            {module === "disbursement" && (
              <button
                disabled={busy}
                className="btn mt-6"
                onClick={() => {
                  if (confirm("Mark this loan as disbursed?"))
                    void action("disburse");
                }}
              >
                Mark as disbursed
              </button>
            )}
            {module === "collection" && (
              <>
                <h4 className="font-bold mt-6 mb-3">Payment history</h4>
                {selected.payments.length === 0 ? (
                  <p className="muted">No payments recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table>
                      <thead>
                        <tr>
                          <th>UTR</th>
                          <th>Date</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.payments.map((p) => (
                          <tr key={p.utr}>
                            <td>{p.utr}</td>
                            <td>
                              {new Date(p.paymentDate).toLocaleDateString(
                                "en-IN",
                              )}
                            </td>
                            <td>{formatINR(p.amountPaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <h4 className="font-bold mt-6">Record payment</h4>
                <div className="grid sm:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="label" htmlFor="utr">
                      UTR number
                    </label>
                    <input
                      id="utr"
                      className="field"
                      value={utr}
                      onChange={(e) => setUtr(e.target.value)}
                      placeholder="DEMO-000001"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="payment">
                      Amount (₹)
                    </label>
                    <input
                      id="payment"
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="field"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="date">
                      Payment date
                    </label>
                    <input
                      id="date"
                      type="date"
                      className="field"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  disabled={busy || !utr || !amount}
                  className="btn mt-4"
                  onClick={() => {
                    if (confirm("Record this payment?"))
                      void action("payments", {
                        utr,
                        amountRupees: Number(amount),
                        paymentDate: date,
                      });
                  }}
                >
                  Record payment
                </button>
              </>
            )}
            {error && (
              <p role="alert" className="error mt-4">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}
export default function Module() {
  const { module } = useParams<{ module: string }>();
  if (!roles[module]) return <div className="p-10">Module not found.</div>;
  return (
    <Protected roles={[roles[module], "ADMIN"]}>
      <Content module={module} />
    </Protected>
  );
}
