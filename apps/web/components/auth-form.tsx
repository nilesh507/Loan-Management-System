"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { request, useAuth, landing, User } from "./auth";
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await request("/auth/register", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      const user = await request<User>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      await refresh();
      window.location.href =
        mode === "signup" ? "/apply/personal" : landing(user.role);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex bg-[#10294d] text-white p-16 flex-col justify-between">
        <Link href="/" className="text-3xl text-white font-black">
          CreditSea<span className="text-sky-400">.</span>
        </Link>
        <div>
          <h1 className="text-5xl font-bold leading-tight">
            A simpler way to move forward.
          </h1>
          <p className="text-slate-300 text-lg mt-5">
            One clear journey from application to repayment.
          </p>
        </div>
        <div className="text-slate-400">Secure lending workspace</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="card p-8 md:p-12 w-full max-w-md">
          <h2 className="text-3xl font-bold">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h2>
          <p className="muted mt-2 mb-8">
            {mode === "signup"
              ? "Start your loan application in minutes."
              : "Sign in to your CreditSea workspace."}
          </p>
          {mode === "signup" && (
            <div className="mb-4">
              <label className="label" htmlFor="fullName">
                Full name
              </label>
              <input
                required
                minLength={2}
                maxLength={100}
                id="fullName"
                className="field"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
          )}
          <div className="mb-4">
            <label className="label" htmlFor="email">
              Email address
            </label>
            <input
              required
              type="email"
              id="email"
              className="field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              required
              type="password"
              minLength={mode === "signup" ? 8 : 1}
              id="password"
              className="field"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {mode === "signup" && (
            <div className="mb-4">
              <label className="label" htmlFor="confirm">
                Confirm password
              </label>
              <input
                required
                type="password"
                id="confirm"
                className="field"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
              />
            </div>
          )}
          {error && (
            <p role="alert" className="error mb-4">
              {error}
            </p>
          )}
          <button disabled={busy} className="btn w-full">
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
          <p className="text-sm mt-6 text-center muted">
            {mode === "signup"
              ? "Already have an account?"
              : "New to CreditSea?"}{" "}
            <Link href={mode === "signup" ? "/login" : "/signup"}>
              {mode === "signup" ? "Sign in" : "Create an account"}
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
