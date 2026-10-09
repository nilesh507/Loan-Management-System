"use client";
import { FormEvent, useEffect, useState } from "react";
import { Protected, request } from "../../../components/auth";
import { Shell, Steps } from "../../../components/shell";
type Draft = {
  personalDetails?: {
    fullName: string;
    pan: string;
    dateOfBirth: string;
    monthlySalaryPaise: number;
    employmentMode: string;
  };
};
function Content() {
  const [form, setForm] = useState({
    fullName: "",
    pan: "",
    dateOfBirth: "",
    monthlySalary: 25000,
    employmentMode: "SALARIED",
  });
  const [reasons, setReasons] = useState<{ message: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    request<Draft | null>("/applications/me/draft")
      .then((d) => {
        if (d?.personalDetails)
          setForm({
            fullName: d.personalDetails.fullName,
            pan: d.personalDetails.pan,
            dateOfBirth: d.personalDetails.dateOfBirth,
            monthlySalary: d.personalDetails.monthlySalaryPaise / 100,
            employmentMode: d.personalDetails.employmentMode,
          });
      })
      .catch(() => {});
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await request<{
        eligibility: { eligible: boolean; reasons: { message: string }[] };
      }>("/applications/me/personal-details", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setReasons(data.eligibility.reasons);
      if (data.eligibility.eligible) window.location.href = "/apply/documents";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title="Personal details">
      <Steps at={2} />
      <form onSubmit={submit} className="card p-6 md:p-8 max-w-2xl">
        <h2 className="text-xl font-bold mb-2">Let&apos;s get to know you</h2>
        <p className="muted mb-7">
          We check eligibility before you upload a document.
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              className="field"
              id="name"
              required
              minLength={2}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="pan">
              PAN
            </label>
            <input
              className="field uppercase"
              id="pan"
              required
              value={form.pan}
              maxLength={20}
              onChange={(e) => setForm({ ...form, pan: e.target.value })}
              placeholder="ABCDE1234F"
            />
          </div>
          <div>
            <label className="label" htmlFor="dob">
              Date of birth
            </label>
            <input
              className="field"
              id="dob"
              type="date"
              required
              value={form.dateOfBirth}
              onChange={(e) =>
                setForm({ ...form, dateOfBirth: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="salary">
              Monthly salary (₹)
            </label>
            <input
              className="field"
              id="salary"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.monthlySalary}
              onChange={(e) =>
                setForm({ ...form, monthlySalary: Number(e.target.value) })
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="employment">
              Employment mode
            </label>
            <select
              className="field"
              id="employment"
              value={form.employmentMode}
              onChange={(e) =>
                setForm({ ...form, employmentMode: e.target.value })
              }
            >
              <option value="SALARIED">Salaried</option>
              <option value="SELF_EMPLOYED">Self-employed</option>
              <option value="UNEMPLOYED">Unemployed</option>
            </select>
          </div>
        </div>
        {reasons.length > 0 && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-xl p-4 mt-6"
          >
            <strong className="error">Eligibility needs attention</strong>
            <ul className="list-disc ml-5 mt-2 error">
              {reasons.map((r, i) => (
                <li key={i}>{r.message}</li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p role="alert" className="error mt-4">
            {error}
          </p>
        )}
        <button disabled={busy} className="btn mt-7">
          {busy ? "Checking…" : "Check eligibility →"}
        </button>
      </form>
    </Shell>
  );
}
export default function Personal() {
  return (
    <Protected roles={["BORROWER"]}>
      <Content />
    </Protected>
  );
}
