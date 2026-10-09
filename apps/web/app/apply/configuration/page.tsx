"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR, terms } from "@creditsea/shared";
import { Protected, request } from "../../../components/auth";
import { Shell, Steps } from "../../../components/shell";
function Content() {
  const [amount, setAmount] = useState(100000);
  const [days, setDays] = useState(365);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const quote = terms(amount, days);
  useEffect(() => {
    request<{ personalDetails?: unknown; salarySlip?: unknown } | null>(
      "/applications/me/draft",
    )
      .then((d) => setReady(Boolean(d?.personalDetails && d?.salarySlip)))
      .catch(() => setReady(false));
  }, []);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const loan = await request<{ _id: string }>("/applications/me/submit", {
        method: "POST",
        body: JSON.stringify({ principalRupees: amount, tenureDays: days }),
      });
      window.location.href = `/loans/${loan._id}`;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title="Configure your loan">
      <Steps at={4} />
      <div className="grid lg:grid-cols-2 gap-6 max-w-5xl">
        <div className="card p-6 md:p-8">
          <h2 className="text-xl font-bold">Choose your terms</h2>
          <p className="muted mt-2 mb-8">
            Fixed 12% annual simple interest. No hidden calculation.
          </p>
          <label className="label" htmlFor="amount">
            Loan amount
          </label>
          <div className="text-3xl font-bold mb-3">
            {formatINR(amount * 100)}
          </div>
          <input
            id="amount"
            type="range"
            min="50000"
            max="500000"
            step="1000"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm muted mb-9">
            <span>₹50,000</span>
            <span>₹5,00,000</span>
          </div>
          <label className="label" htmlFor="days">
            Tenure
          </label>
          <div className="text-3xl font-bold mb-3">{days} days</div>
          <input
            id="days"
            type="range"
            min="30"
            max="365"
            step="1"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm muted">
            <span>30 days</span>
            <span>365 days</span>
          </div>
        </div>
        <div className="card p-6 md:p-8">
          <h2 className="text-xl font-bold mb-7">Repayment summary</h2>
          <div className="space-y-5">
            {[
              ["Principal", formatINR(quote.principalPaise)],
              ["Annual interest rate", "12%"],
              ["Tenure", `${days} days`],
              ["Interest", formatINR(quote.interestPaise)],
            ].map(([a, b]) => (
              <div
                className="flex justify-between border-b border-slate-100 pb-4"
                key={a}
              >
                <span className="muted">{a}</span>
                <strong>{b}</strong>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 rounded-xl p-5 mt-6 flex justify-between">
            <span className="font-bold">Total repayment</span>
            <strong className="text-xl text-blue-800">
              {formatINR(quote.totalRepaymentPaise)}
            </strong>
          </div>
          {!ready && (
            <p className="error mt-5">
              Complete your personal details and document upload first.
            </p>
          )}
          {error && (
            <p role="alert" className="error mt-5">
              {error}
            </p>
          )}
          <button
            disabled={!ready || busy}
            onClick={() => void submit()}
            className="btn w-full mt-6"
          >
            {busy ? "Submitting…" : "Apply for loan →"}
          </button>
          <Link href="/apply/documents" className="block text-center mt-4">
            ← Back to document
          </Link>
        </div>
      </div>
    </Shell>
  );
}
export default function Configuration() {
  return (
    <Protected roles={["BORROWER"]}>
      <Content />
    </Protected>
  );
}
