"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, TextArea } from "@/components/ui/Forms";

export function CustomerClaimResponse({ claimId, requestMessage }: { claimId: string; requestMessage: string }) {
  const router = useRouter();
  const [responseMessage, setResponseMessage] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData();
    formData.set("responseMessage", responseMessage);
    for (const file of Array.from(files || [])) formData.append("additionalFiles", file);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/customer/claims/${claimId}/response`, { method: "POST", body: formData });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        setError(payload.error || "We couldn't submit the additional information.");
        return;
      }
      router.replace(`/dashboard/claims/${claimId}?submitted=1`);
    } catch {
      setError("We couldn't submit the additional information. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6" aria-labelledby="additional-information-heading">
      <h2 id="additional-information-heading" className="text-lg font-semibold text-[var(--brand-navy)]">Additional information requested</h2>
      <div className="mt-4 rounded-xl border border-amber-200/80 bg-white/80 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Officer request</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{requestMessage}</p></div>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div><label htmlFor="customer-claim-response" className="mb-1.5 block text-sm font-medium text-slate-800">Your response</label><TextArea id="customer-claim-response" rows={4} maxLength={1000} value={responseMessage} onChange={(event) => setResponseMessage(event.target.value)} disabled={pending} placeholder="Add any helpful context for the claims team." /></div>
        <div><label htmlFor="customer-claim-files" className="mb-1.5 block text-sm font-medium text-slate-800">Upload additional files</label><input id="customer-claim-files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFiles(event.target.files)} disabled={pending} className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-semibold file:text-teal-800" /><p className="mt-1.5 text-xs text-slate-500">PDF, JPEG, PNG, or WEBP. Up to 10 MB per file.</p></div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit information"}</Button>
      </form>
    </section>
  );
}
