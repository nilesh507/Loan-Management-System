"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Protected, fetchDocument, request } from "../../../components/auth";
import { Shell, Steps } from "../../../components/shell";
function Content() {
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    request<{ salarySlip?: { originalFilename: string } } | null>(
      "/applications/me/draft",
    )
      .then((d) => setSaved(d?.salarySlip?.originalFilename || ""))
      .catch(() => {});
  }, []);
  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      const result = await request<{ originalFilename: string }>(
        "/applications/me/salary-slip",
        { method: "POST", body: data },
      );
      setSaved(result.originalFilename);
      setFile(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell title="Supporting document">
      <Steps at={3} />
      <div className="card p-6 md:p-8 max-w-2xl">
        <h2 className="text-xl font-bold">Upload your salary slip</h2>
        <p className="muted mt-2">
          PDF, JPEG or PNG. Maximum 5 MB. Your document is only available to
          authorized reviewers.
        </p>
        <form onSubmit={upload} className="mt-7">
          <label
            htmlFor="file"
            className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer bg-slate-50"
          >
            <span className="font-semibold">Choose a file to upload</span>
            <br />
            <span className="muted text-sm">or drop it here</span>
            <input
              ref={fileInput}
              id="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="block mx-auto mt-4 max-w-full"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          {file && (
            <div className="flex items-center justify-between gap-3 mt-3">
              <p className="text-sm">
                Selected: {file.name} · {(file.size / 1024 / 1024).toFixed(2)}{" "}
                MB · {file.type}
              </p>
              <button
                type="button"
                className="text-sm underline"
                onClick={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                Clear
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="error mt-4">
              {error}
            </p>
          )}
          <button className="btn mt-5" disabled={!file || busy}>
            {busy
              ? "Uploading…"
              : saved
                ? "Replace document"
                : "Upload document"}
          </button>
        </form>
        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-6">
            <strong className="success">Uploaded successfully</strong>
            <p className="text-sm mt-1">{saved}</p>
            <a
              href="#"
              onClick={async (e) => {
                e.preventDefault();
                const preview = window.open("", "_blank");
                try {
                  const blob = await fetchDocument(
                    "/applications/me/salary-slip",
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
              View document
            </a>
          </div>
        )}
        <div className="flex justify-between items-center mt-8">
          <Link href="/apply/personal">← Back</Link>
          <Link
            className={`btn ${!saved ? "pointer-events-none opacity-50" : ""}`}
            href="/apply/configuration"
          >
            Continue →
          </Link>
        </div>
      </div>
    </Shell>
  );
}
export default function Documents() {
  return (
    <Protected roles={["BORROWER"]}>
      <Content />
    </Protected>
  );
}
