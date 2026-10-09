"use client";
import Link from "next/link";
import { Protected, useAuth, landing } from "../../components/auth";
import { Shell } from "../../components/shell";
function Content() {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") {
    if (typeof window !== "undefined")
      window.location.replace(landing(user!.role));
    return <p>Redirecting…</p>;
  }
  return (
    <Shell title="Operations overview">
      <p className="muted mb-8">Choose a team queue to review live records.</p>
      <div className="grid md:grid-cols-2 gap-5">
        {[
          ["sales", "Registered borrowers who have not applied"],
          ["sanction", "Review new loan applications"],
          ["disbursement", "Release sanctioned loans"],
          ["collection", "Record repayments and close loans"],
        ].map(([name, description]) => (
          <Link
            className="card p-7 hover:border-blue-300"
            href={`/dashboard/${name}`}
            key={name}
          >
            <h2 className="capitalize text-xl font-bold">{name} →</h2>
            <p className="muted mt-3">{description}</p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
export default function Dashboard() {
  return (
    <Protected
      roles={["ADMIN", "SALES", "SANCTION", "DISBURSEMENT", "COLLECTION"]}
    >
      <Content />
    </Protected>
  );
}
