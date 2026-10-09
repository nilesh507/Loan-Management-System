"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@creditsea/shared";
import { Protected, request } from "../../components/auth";
import { Shell } from "../../components/shell";
type Loan = {
  _id: string;
  status: string;
  principalPaise: number;
  totalRepaymentPaise: number;
  paidAmountPaise: number;
  appliedAt: string;
};
function Content() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    request<Loan[]>("/loans/me")
      .then(setLoans)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Shell title="My loans">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <div>
          <h2 className="text-2xl font-bold">Your lending journey</h2>
          <p className="muted">
            Track every application and payment in one place.
          </p>
        </div>
        <Link className="btn" href="/apply/personal">
          New application
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      {loans.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">◉</div>
          <h3 className="text-xl font-bold">No applications yet</h3>
          <p className="muted mt-2 mb-6">
            Start with a quick eligibility check.
          </p>
          <Link className="btn" href="/apply/personal">
            Start application
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {loans.map((l) => (
            <Link
              href={`/loans/${l._id}`}
              className="card p-6 block hover:border-blue-300"
              key={l._id}
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div className={`chip status-${l.status}`}>
                    {l.status === "APPLIED" ? "PENDING REVIEW" : l.status}
                  </div>
                  <h3 className="font-bold text-lg mt-3">
                    Loan #{l._id.slice(-8).toUpperCase()}
                  </h3>
                  <p className="muted text-sm">
                    Applied {new Date(l.appliedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {formatINR(l.principalPaise)}
                  </div>
                  <p className="muted text-sm">
                    Outstanding{" "}
                    {formatINR(l.totalRepaymentPaise - l.paidAmountPaise)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
export default function Loans() {
  return (
    <Protected roles={["BORROWER"]}>
      <Content />
    </Protected>
  );
}
