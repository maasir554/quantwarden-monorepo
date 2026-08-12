"use client";

import { AlertTriangle, CheckCircle2, Loader2, Network, Radar } from "lucide-react";
import { useScanActivity } from "@/components/scan-activity-provider";
import type { OrgScanWorkflowStatus, WorkflowStep } from "@/lib/scan-activity-types";

function stepMeta(step: WorkflowStep) {
  if (step === "subdomain_discovery") {
    return {
      title: "Discovering subdomains",
      detail: "QuantWarden is mapping subdomains for the root domains added during onboarding.",
      icon: Network,
    };
  }
  if (step === "port_discovery") {
    return {
      title: "Discovering ports and services",
      detail: "Subdomain discovery is complete. QuantWarden is now resolving assets and checking configured ports.",
      icon: Radar,
    };
  }
  if (step === "openssl") {
    return {
      title: "Analyzing TLS and cryptography",
      detail: "Asset discovery is complete. The first OpenSSL scan is collecting certificate, TLS, and PQC evidence.",
      icon: Loader2,
    };
  }
  return {
    title: "Initial analysis complete",
    detail: "The onboarding scan workflow has finished.",
    icon: CheckCircle2,
  };
}

function getActiveOnboardingWorkflow(workflows: OrgScanWorkflowStatus[]) {
  const active = workflows.filter(
    (workflow) =>
      workflow.workflowType === "onboarding" &&
      workflow.currentStep !== "done" &&
      (workflow.status === "pending" || workflow.status === "running")
  );

  const priority: Record<WorkflowStep, number> = {
    subdomain_discovery: 0,
    port_discovery: 1,
    openssl: 2,
    done: 3,
  };

  const activeWorkflow = active.sort(
    (left, right) =>
      priority[left.currentStep] - priority[right.currentStep] ||
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  )[0];

  if (activeWorkflow) return activeWorkflow;

  const latestOnboarding = workflows
    .filter((workflow) => workflow.workflowType === "onboarding")
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )[0];

  return latestOnboarding?.status === "failed" ? latestOnboarding : null;
}

export function useInitialScanStatus(orgId: string, orgSlug?: string) {
  const scan = useScanActivity(orgId, { orgSlug });
  const workflow = getActiveOnboardingWorkflow(scan.workflows);
  const activeBatch = workflow?.activeBatchId
    ? scan.activity?.activeBatches.find((batch) => batch.id === workflow.activeBatchId)
    : scan.activity?.activeBatches.find((batch) => batch.source === "automated");

  return {
    ...scan,
    workflow,
    activeBatch,
    meta: workflow ? stepMeta(workflow.currentStep) : null,
  };
}

export function OnboardingScanStatus({
  orgId,
  orgSlug,
}: {
  orgId: string;
  orgSlug?: string;
}) {
  const { workflow, activeBatch, meta, openMonitor } = useInitialScanStatus(orgId, orgSlug);
  if (!workflow || !meta) return null;

  const Icon = meta.icon;
  const percent = activeBatch?.percentComplete ?? 0;
  const failed = workflow.status === "failed";

  return (
    <div className={`mb-4 overflow-hidden rounded-2xl border bg-white/60 shadow-sm backdrop-blur ${
      failed ? "border-red-300/70" : "border-white/70"
    }`}>
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            failed ? "bg-red-100 text-red-700" : "bg-[#8B0000]/10 text-[#8B0000]"
          }`}>
            {failed
              ? <AlertTriangle className="h-5 w-5" />
              : <Icon className={`h-5 w-5 ${workflow.status === "running" ? "animate-pulse" : ""}`} />}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${failed ? "text-red-950" : "text-[#3d200a]"}`}>
              {failed ? `Initial scan stopped during ${meta.title.toLowerCase()}` : meta.title}
            </p>
            <p className={`mt-0.5 text-xs font-medium ${failed ? "text-red-900/70" : "text-[#8a5d33]"}`}>
              {failed ? "Open the Activity Monitor to review the failure before analysis can be shown." : meta.detail}
            </p>
          </div>
        </div>
        {failed ? (
          <button
            type="button"
            onClick={openMonitor}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-800"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Review failure
          </button>
        ) : activeBatch ? (
          <button
            type="button"
            onClick={openMonitor}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#8B0000]/15 bg-white/70 px-3 py-2 text-xs font-bold text-[#8B0000] transition hover:bg-white"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {percent}% complete
          </button>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#8B0000]/8 px-3 py-2 text-xs font-bold text-[#8B0000]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Preparing
          </span>
        )}
      </div>
      {!failed && activeBatch ? (
        <div className="h-1 bg-[#8B0000]/8">
          <div className="h-full bg-[#8B0000] transition-[width] duration-500" style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export function FirstScanAnalysisNotice({
  orgId,
  orgSlug,
  area,
}: {
  orgId: string;
  orgSlug?: string;
  area: "overview" | "pqc";
}) {
  const { workflow, meta } = useInitialScanStatus(orgId, orgSlug);
  const title = area === "pqc" ? "PQC posture is being prepared" : "Security analysis is being prepared";

  return (
    <div className="rounded-2xl border border-white/70 bg-white/55 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#8B0000]/10 text-[#8B0000]">
          {workflow ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#3d200a]">{title}</h2>
          <p className="mt-1 text-sm font-medium leading-relaxed text-[#8a5d33]">
            {workflow?.status === "failed"
              ? `The initial workflow stopped during ${meta?.title.toLowerCase() || "scanning"}. Resolve or rerun it before analysis is shown.`
              : meta
              ? `${meta.title} is in progress. Results will appear here automatically when the initial scan finishes.`
              : "Results will appear here automatically when the initial scan finishes."}
          </p>
        </div>
      </div>
    </div>
  );
}
