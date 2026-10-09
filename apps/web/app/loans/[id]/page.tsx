"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatINR } from "@creditsea/shared";
import { Protected, request } from "../../../components/auth";
import { Shell } from "../../../components/shell";
type Loan = {
  _id: string;
  status: string;
  principalPaise: number;
  tenureDays: number;
  interestPaise: number;
  totalRepaymentPaise: number;
  paidAmountPaise: number;
  annualInterestRatePercent: number;
  appliedAt: string;
  sanctionedAt?: string;
  disbursedAt?: string;
  closedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  payments: { utr: string; amountPaise: number; paymentDate: string }[];
};
function Content() {
  const { id } = useParams<{ id: string }>();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    request<Loan>(`/loans/me/${id}`)
      .then(setLoan)
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <Shell title="Loan details">
      {error && <p className="error">{error}</p>}
      {!loan ? (
        <p>Loading loan…</p>
      ) : (
        <>
          <div className="flex flex-wrap justify-between gap-4 mb-7">
            <div>
              <div className={`chip status-${loan.status}`}>
                {loan.status === "APPLIED" ? "PENDING REVIEW" : loan.status}
              </div>
              <h2 className="text-2xl font-bold mt-3">
                Loan #{loan._id.slice(-8).toUpperCase()}
              </h2>
              <p className="muted">
                Submitted {new Date(loan.appliedAt).toLocaleString("en-IN")}
              </p>
            </div>
            <Link href="/loans">← All loans</Link>
          </div>
          {loan.rejectionReason && (
            <div className="card p-5 mb-5 border-red-200">
              <strong className="error">Application rejected</strong>
              <p>{loan.rejectionReason}</p>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-5">
            <div className="card p-6">
              <h3 className="font-bold text-lg mb-5">Financial summary</h3>
              {[
                ["Principal", formatINR(loan.principalPaise)],
                ["Tenure", `${loan.tenureDays} days`],
                ["Interest", formatINR(loan.interestPaise)],
                ["Total repayment", formatINR(loan.totalRepaymentPaise)],
                ["Paid", formatINR(loan.paidAmountPaise)],
                [
                  "Outstanding",
                  formatINR(loan.totalRepaymentPaise - loan.paidAmountPaise),
                ],
              ].map(([a, b]) => (
                <div
                  key={a}
                  className="flex justify-between border-b border-slate-100 py-3"
                >
                  <span className="muted">{a}</span>
                  <strong>{b}</strong>
                </div>
              ))}
            </div>
            <div className="card p-6">
              <h3 className="font-bold text-lg mb-5">Progress</h3>
              {[
                ["Applied", loan.appliedAt],
                ["Sanctioned", loan.sanctionedAt],
                ["Disbursed", loan.disbursedAt],
                ["Closed", loan.closedAt],
                ["Rejected", loan.rejectedAt],
              ]
                .filter((x) => x[1])
                .map(([a, b]) => (
                  <div key={a} className="border-l-2 border-blue-600 pl-4 pb-6">
                    <strong>{a}</strong>
                    <p className="muted text-sm">
                      {new Date(b!).toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
            </div>
          </div>
          {loan.payments.length > 0 && (
            <div className="card p-6 mt-5">
              <h3 className="font-bold text-lg mb-4">Payment history</h3>
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
                    {loan.payments.map((p) => (
                      <tr key={p.utr}>
                        <td>{p.utr}</td>
                        <td>
                          {new Date(p.paymentDate).toLocaleDateString("en-IN")}
                        </td>
                        <td>{formatINR(p.amountPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
export default function Detail() {
  return (
    <Protected roles={["BORROWER"]}>
      <Content />
    </Protected>
  );
}
