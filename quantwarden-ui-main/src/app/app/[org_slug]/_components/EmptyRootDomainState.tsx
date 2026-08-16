"use client";

import { useState, type FormEvent } from "react";
import { Globe2, Loader2, Play } from "lucide-react";

interface EmptyRootDomainStateProps {
  orgId: string;
  area: "overview" | "pqc";
}

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(/[/?#]/, 1)[0]
    .replace(/\.$/, "");
}

function isValidDomain(value: string) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
}

export function EmptyRootDomainState({ orgId, area }: EmptyRootDomainStateProps) {
  const [domain, setDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedDomain = normalizeDomain(domain);

    if (!isValidDomain(normalizedDomain)) {
      setError("Enter a valid root domain, for example example.com.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/orgs/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          value: normalizedDomain,
          type: "domain",
          isRoot: true,
          openPorts: [{ number: 443, protocol: "tcp" }],
          startDefaultWorkflow: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "The domain could not be added.");
      }

      window.location.reload();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "The domain could not be added.");
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-white/70 bg-white/55 p-5 shadow-sm ring-1 ring-[#8a5d33]/10 backdrop-blur-xl">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#8B0000]/10 text-[#8B0000]">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#3d200a]">Add a root domain to begin</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#8a5d33]">
              {area === "pqc"
                ? "PQC posture needs TLS evidence from a domain. QuantWarden will discover subdomains, check ports, and analyze TLS automatically."
                : "QuantWarden will discover subdomains, check ports, and analyze TLS automatically after the domain is added."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full lg:max-w-xl">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`root-domain-${area}`} className="sr-only">Root domain</label>
            <input
              id={`root-domain-${area}`}
              type="text"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="example.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={submitting}
              className="min-w-0 flex-1 rounded-lg border border-[#8a5d33]/30 bg-white/70 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#8B0000]/60 focus:ring-2 focus:ring-[#8B0000]/10 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={submitting || !domain.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#8B0000] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#700000] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {submitting ? "Starting pipeline" : "Add and start scanning"}
            </button>
          </div>
          {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
        </form>
      </div>
    </section>
  );
}
