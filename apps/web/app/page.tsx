import Link from "next/link";
export default function Home() {
  return (
    <main className="min-h-screen bg-[#10294d] text-white">
      <nav className="max-w-6xl mx-auto p-6 flex justify-between">
        <strong className="text-2xl">
          CreditSea<span className="text-sky-400">.</span>
        </strong>
        <div className="flex gap-6">
          <Link className="text-white" href="/login">
            Sign in
          </Link>
          <Link className="text-white" href="/signup">
            Get started
          </Link>
        </div>
      </nav>
      <section className="max-w-6xl mx-auto px-6 py-24 md:py-36">
        <div className="text-sky-300 font-semibold tracking-widest text-sm">
          LENDING, MADE CLEAR
        </div>
        <h1 className="text-5xl md:text-7xl font-bold max-w-3xl mt-5 leading-tight">
          Your next step starts here.
        </h1>
        <p className="text-slate-300 mt-7 text-xl max-w-xl">
          Apply for a personal loan with a straightforward process, transparent
          terms, and real-time status updates.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            href="/signup"
            style={{ color: "#10294d" }}
            className="bg-sky-400 font-bold px-6 py-4 rounded-xl"
          >
            Apply for a loan →
          </Link>
          <Link
            href="/login"
            className="border border-slate-400 text-white px-6 py-4 rounded-xl"
          >
            Sign in
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mt-24">
          {[
            ["₹50K–₹5L", "Loan amount"],
            ["30–365 days", "Flexible tenure"],
            ["12% p.a.", "Fixed simple interest"],
          ].map(([a, b]) => (
            <div key={b} className="border border-white/20 rounded-xl p-6">
              <div className="text-3xl font-bold">{a}</div>
              <div className="text-slate-300 mt-2">{b}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
