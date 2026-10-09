"use client";
import Link from "next/link";
import { useAuth } from "./auth";
export function Shell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { user, logout } = useAuth();
  const sections =
    user?.role === "ADMIN"
      ? ["sales", "sanction", "disbursement", "collection"]
      : user?.role === "BORROWER"
        ? []
        : [user?.role.toLowerCase() || ""];
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-[#10294d] text-white p-6 md:w-60 shrink-0">
        <Link
          href="/"
          className="text-white text-2xl font-black tracking-tight"
        >
          CreditSea<span className="text-sky-400">.</span>
        </Link>
        <div className="mt-2 text-xs text-slate-300">LENDING OPERATIONS</div>
        <nav className="mt-10 flex md:flex-col gap-2 flex-wrap">
          {user?.role === "BORROWER" ? (
            <>
              <Link
                className="text-white p-2 rounded hover:bg-white/10"
                href="/loans"
              >
                My loans
              </Link>
              <Link
                className="text-white p-2 rounded hover:bg-white/10"
                href="/apply/personal"
              >
                Apply
              </Link>
            </>
          ) : (
            sections.map((x) => (
              <Link
                className="text-white p-2 rounded hover:bg-white/10 capitalize"
                key={x}
                href={`/dashboard/${x}`}
              >
                {x}
              </Link>
            ))
          )}
        </nav>
        <div className="mt-10 text-sm text-slate-300">
          {user?.fullName}
          <br />
          <span className="text-xs">{user?.role}</span>
        </div>
        <button
          className="mt-4 text-sm underline"
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 md:px-10 py-6">
          <h1 className="text-2xl font-bold">{title}</h1>
        </header>
        <div className="p-5 md:p-10 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
export function Steps({ at }: { at: number }) {
  return (
    <div className="grid grid-cols-4 gap-2 mb-8">
      {["Account", "Personal details", "Salary slip", "Loan terms"].map(
        (s, i) => (
          <div
            key={s}
            className={`text-xs md:text-sm border-t-4 pt-2 ${i + 1 <= at ? "border-blue-700 text-blue-800 font-bold" : "border-slate-200 text-slate-500"}`}
          >
            {i + 1}. {s}
          </div>
        ),
      )}
    </div>
  );
}
