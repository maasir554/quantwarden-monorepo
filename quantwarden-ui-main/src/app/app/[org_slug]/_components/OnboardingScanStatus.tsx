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
    <div className={`mb-4 rounded-2xl border px-4 py-3 shadow-sm backdrop-blur ${
      failed ? "border-red-300/70 bg-red-50/90" : "border-cyan-300/55 bg-cyan-50/90"
    }`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${
            failed ? "bg-red-600" : "bg-cyan-600"
          }`}>
            {failed
              ? <AlertTriangle className="h-5 w-5" />
              : <Icon className={`h-5 w-5 ${workflow.status === "running" ? "animate-pulse" : ""}`} />}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-black ${failed ? "text-red-950" : "text-cyan-950"}`}>
              {failed ? `Initial scan stopped during ${meta.title.toLowerCase()}` : meta.title}
            </p>
            <p className={`mt-0.5 text-xs font-semibold ${failed ? "text-red-900/70" : "text-cyan-900/70"}`}>
              {failed ? "Open the Activity Monitor to review the failure before analysis can be shown." : meta.detail}
            </p>
          </div>
        </div>
        {failed ? (
          <button
            type="button"
            onClick={openMonitor}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-800"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Review failure
          </button>
        ) : activeBatch ? (
          <button
            type="button"
            onClick={openMonitor}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-cyan-800"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {percent}% complete
          </button>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-cyan-100 px-3 py-2 text-xs font-bold text-cyan-800">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Preparing
          </span>
        )}
      </div>
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
  const title = area === "pqc"
    ? "Let the first complete scan finish to view PQC posture"
    : "Let the first complete scan finish to view security analysis";

  return (
    <div className="rounded-2xl border border-amber-300/70 bg-amber-50/90 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
          {workflow ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div>
          <h2 className="text-sm font-black text-[#3d200a]">{title}</h2>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-[#8a5d33]">
            {workflow?.status === "failed"
              ? `The initial workflow stopped during ${meta?.title.toLowerCase() || "scanning"}. Resolve or rerun it before analysis is shown.`
              : meta
              ? `${meta.title} is currently in progress. Analysis becomes available after subdomain discovery, port discovery, and the initial TLS/OpenSSL scan complete.`
              : "Analysis becomes available after subdomain discovery, port discovery, and the initial TLS/OpenSSL scan complete."}
          </p>
        </div>
      </div>
    </div>
  );
}
