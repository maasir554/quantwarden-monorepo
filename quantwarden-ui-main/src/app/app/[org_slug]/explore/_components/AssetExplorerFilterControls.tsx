"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Cpu,
  Fingerprint,
  GitBranch,
  Globe,
  KeyRound,
  LockKeyhole,
  LucideIcon,
  Network,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FilterControlsProps, SelectOption } from "./asset-explorer-types";
import { ALL_FILTER_VALUE, expandTransition, normalizeBooleanFilter } from "./asset-explorer-utils";

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  icon: Icon,
  className,
  labelClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  allLabel: string;
  icon?: LucideIcon;
  className?: string;
  labelClassName?: string;
}) {
  const isFiltered = Boolean(value);
  const showIconInLabel = Boolean(label && Icon);
  const showIconInField = Boolean(!label && Icon);

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <p className={cn("flex items-center gap-2 text-sm font-bold text-[#7a1f1f]", labelClassName)}>
          {showIconInLabel ? <Icon className="h-4 w-4 shrink-0" /> : null}
          <span>{label}</span>
        </p>
      ) : null}
      <Select
        value={value || ALL_FILTER_VALUE}
        onValueChange={(nextValue) => onChange(nextValue === ALL_FILTER_VALUE ? "" : nextValue)}
      >
        <SelectTrigger
          className={cn(
            "h-12 w-full rounded-2xl px-3 text-left text-xs font-bold shadow-none transition-colors",
            showIconInField
              ? "[&>span]:flex [&>span]:min-w-0 [&>span]:items-center [&>span]:gap-2.5 [&>span]:overflow-hidden [&>span]:whitespace-nowrap"
              : "",
            isFiltered
              ? "border-[#163b73]/40 bg-[#163b73]/92 text-white [&_svg]:!text-white/80"
              : "border-white/60 bg-white/80 text-[#3d200a] [&_svg]:!text-[#8a5d33]/70"
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {showIconInField ? (
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  isFiltered ? "bg-white/14 text-white" : "bg-[#8B0000]/8 text-[#8B0000]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <span className="min-w-0 truncate whitespace-nowrap">
              <SelectValue />
            </span>
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTER_VALUE}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MultiSelectFilter({
  label,
  helper,
  values,
  options,
  onToggle,
  onClear,
  emptyLabel,
  icon: Icon,
  labelClassName,
}: {
  label: string;
  helper: string;
  values: string[];
  options: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  emptyLabel: string;
  icon?: LucideIcon;
  labelClassName?: string;
}) {
  const summary =
    values.length === 0
      ? emptyLabel
      : values.length === 1
        ? values[0]
        : `${values.length} selected`;
  const isFiltered = values.length > 0;
  const showIconInLabel = Boolean(label && Icon);
  const showIconInField = Boolean(!label && Icon);

  return (
    <div className="space-y-2">
      <p className={cn("flex items-center gap-2 text-sm font-bold text-[#7a1f1f]", labelClassName)}>
        {showIconInLabel ? <Icon className="h-4 w-4 shrink-0" /> : null}
        <span>{label}</span>
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-16 w-full items-center justify-between rounded-2xl border px-3 text-left text-xs font-bold shadow-none transition-colors",
              isFiltered
                ? "border-[#163b73]/40 bg-[#163b73]/92 text-white hover:border-[#163b73]/60"
                : "border-white/60 bg-white/80 text-[#3d200a] hover:border-[#8B0000]/25"
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {showIconInField ? (
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    isFiltered ? "bg-white/14 text-white" : "bg-[#8B0000]/8 text-[#8B0000]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
              ) : null}
              <div className="min-w-0">
              <p className="truncate">{summary}</p>
              <p className={cn("truncate text-xs font-medium", isFiltered ? "text-white/72" : "text-[#8a5d33]/70")}>
                {helper}
              </p>
              </div>
            </div>
            <ChevronDown className={cn("h-4 w-4 shrink-0", isFiltered ? "text-white/80" : "text-[#8a5d33]/70")} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-[240] w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-2">
          <div className="flex items-start justify-between gap-3 px-2 py-1">
            <div>
              <DropdownMenuLabel className="px-0 py-0 normal-case tracking-normal text-[#3d200a]">
                {label}
              </DropdownMenuLabel>
              <p className="mt-1 text-xs font-medium text-[#8a5d33]/80">{helper}</p>
            </div>
            {values.length > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-bold text-[#8B0000] transition-colors hover:text-[#730000]"
              >
                Clear
              </button>
            ) : null}
          </div>
          <DropdownMenuSeparator />
          <div className="max-h-72 overflow-y-auto pr-1">
            {options.length === 0 ? (
              <p className="px-3 py-4 text-sm font-medium text-[#8a5d33]/75">No values discovered yet.</p>
            ) : (
              options.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option}
                  checked={values.includes(option)}
                  onCheckedChange={() => onToggle(option)}
                >
                  <span className="truncate">{option}</span>
                </DropdownMenuCheckboxItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function AssetExplorerFilterControls({
  search,
  setSearch,
  dnsState,
  setDnsState,
  tls,
  setTls,
  keySize,
  setKeySize,
  signatureAlgorithm,
  setSignatureAlgorithm,
  port,
  setPort,
  certExpiry,
  setCertExpiry,
  cipher,
  setCipher,
  timeoutOnly,
  setTimeoutOnly,
  noTlsOnly,
  setNoTlsOnly,
  pqcSupportedOnly,
  setPqcSupportedOnly,
  pqcNegotiatedOnly,
  setPqcNegotiatedOnly,
  pqcTier,
  setPqcTier,
  scanStatus,
  setScanStatus,
  bucket,
  setBucket,
  kexAlgorithms,
  setKexAlgorithms,
  kexGroups,
  setKexGroups,
  filterOptions,
  dnsOptions,
  tlsVersionOptions,
  keySizeOptions,
  portOptions,
  certExpiryOptions,
  signatureAlgorithmOptions,
  cipherOptions,
  bucketOptions,
  scanResultOptions,
  scanStatusOptions,
  tlsPresenceOptions,
  kyberSupportOptions,
  kyberNegotiationOptions,
  activeAdvancedFilterCount,
  showAdvancedFilters,
  setShowAdvancedFilters,
  toggleSelection,
  variant = "inline",
}: FilterControlsProps) {
  const isModal = variant === "modal";

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-2 xl:col-span-5">
          <p className="flex items-center gap-2 text-sm font-bold text-[#7a1f1f]">
            <Search className="h-4 w-4 shrink-0" />
            <span>Search</span>
          </p>
          <input
            type="text"
            placeholder="Search domains, IP addresses, or known TLS details"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-semibold text-[#3d200a] placeholder:text-[#8a5d33]/55 outline-none transition-all focus:border-[#8B0000]/30 focus:ring-2 focus:ring-[#8B0000]/10"
          />
        </div>

        <LabeledSelect
          label="DNS status"
          value={dnsState}
          onChange={setDnsState}
          options={dnsOptions}
          allLabel="Any DNS status"
          icon={Globe}
          className="xl:col-span-2"
        />

        <LabeledSelect
          label="Latest TLS version"
          value={tls}
          onChange={setTls}
          options={tlsVersionOptions}
          allLabel="Any latest TLS version"
          icon={ShieldCheck}
          className="xl:col-span-3"
        />

        <LabeledSelect
          label="Key size"
          value={keySize}
          onChange={setKeySize}
          options={keySizeOptions}
          allLabel="Any certificate key size"
          icon={KeyRound}
          className="xl:col-span-2"
        />

        <LabeledSelect
          label="Certificate validity"
          value={certExpiry}
          onChange={setCertExpiry}
          options={certExpiryOptions}
          allLabel="Any validity window"
          icon={CalendarClock}
          className="xl:col-span-3"
        />

        <LabeledSelect
          label="Signature algorithm"
          value={signatureAlgorithm}
          onChange={setSignatureAlgorithm}
          options={signatureAlgorithmOptions}
          allLabel="Any signature algorithm"
          icon={Fingerprint}
          className="xl:col-span-4"
        />

        <LabeledSelect
          label="Cipher suite"
          value={cipher}
          onChange={setCipher}
          options={cipherOptions}
          allLabel="Any cipher suite"
          icon={LockKeyhole}
          className="xl:col-span-3"
        />

        <LabeledSelect
          label="Port"
          value={port}
          onChange={setPort}
          options={portOptions}
          allLabel="Any TLS port"
          icon={Network}
          className="xl:col-span-2"
        />

        <div className="space-y-2 xl:col-span-4">
          <p className="text-sm font-bold text-[#7a1f1f]">Advanced</p>
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            className={cn(
              "flex h-12 w-full items-center justify-between rounded-2xl border px-3 text-left text-xs font-bold transition-colors",
              showAdvancedFilters
                ? "border-[#7a1f1f]/70 bg-[#7a1f1f] text-white"
                : "border-white/60 bg-white/80 text-[#3d200a] hover:border-[#8B0000]/25"
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  showAdvancedFilters ? "bg-white/16 text-white" : "bg-[#8B0000]/8 text-[#8B0000]"
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate">PQC, scan outcomes, and key exchange filters</span>
                <span
                  className={cn(
                    "block truncate text-xs font-medium",
                    showAdvancedFilters ? "text-white/78" : "text-[#8a5d33]/70"
                  )}
                >
                  {activeAdvancedFilterCount === 0
                    ? "Optional bucket, PQC, and deeper TLS filters"
                    : `${activeAdvancedFilterCount} advanced filter${activeAdvancedFilterCount === 1 ? "" : "s"} active`}
                </span>
              </span>
            </span>
            {showAdvancedFilters ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-white/85" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-[#8a5d33]/75" />
            )}
          </button>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:col-span-8 xl:items-end">
          <LabeledSelect
            label=""
            value={bucket}
            onChange={setBucket}
            options={bucketOptions}
            allLabel="All Buckets"
            icon={Tags}
            className="min-w-0"
          />
          <LabeledSelect
            label=""
            value={pqcTier}
            onChange={setPqcTier}
            options={[
              { value: "A", label: "Tier A (90-100)" },
              { value: "B", label: "Tier B (75-89)" },
              { value: "C", label: "Tier C (50-74)" },
              { value: "D", label: "Tier D (< 50)" },
            ]}
            allLabel="Any PQC Rating"
            icon={Cpu}
            className="min-w-0"
          />
          <LabeledSelect
            label=""
            value={scanStatus}
            onChange={setScanStatus}
            options={scanStatusOptions}
            allLabel="Any Scan Status"
            icon={Activity}
            className="min-w-0"
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showAdvancedFilters ? (
          <motion.div
            key={`advanced-filters-${variant}`}
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={expandTransition}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "rounded-[26px] border border-[#7a1f1f]/55 bg-[#7a1f1f] bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:18px_18px] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                isModal ? "mt-1" : ""
              )}
            >
              <div className="grid gap-3 xl:grid-cols-4">
                <LabeledSelect
                  label="Scan result"
                  value={timeoutOnly}
                  onChange={(value) => setTimeoutOnly(normalizeBooleanFilter(value))}
                  options={scanResultOptions}
                  allLabel="Any scan result"
                  icon={AlertTriangle}
                  labelClassName="text-white/92"
                />

                <LabeledSelect
                  label="TLS presence"
                  value={noTlsOnly}
                  onChange={(value) => setNoTlsOnly(normalizeBooleanFilter(value))}
                  options={tlsPresenceOptions}
                  allLabel="Any TLS presence"
                  icon={Shield}
                  labelClassName="text-white/92"
                />

                <LabeledSelect
                  label="Kyber support"
                  value={pqcSupportedOnly}
                  onChange={(value) => setPqcSupportedOnly(normalizeBooleanFilter(value))}
                  options={kyberSupportOptions}
                  allLabel="Any Kyber support"
                  icon={Cpu}
                  labelClassName="text-white/92"
                />

                <LabeledSelect
                  label="Kyber negotiation"
                  value={pqcNegotiatedOnly}
                  onChange={(value) => setPqcNegotiatedOnly(normalizeBooleanFilter(value))}
                  options={kyberNegotiationOptions}
                  allLabel="Any Kyber negotiation"
                  icon={ShieldCheck}
                  labelClassName="text-white/92"
                />
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <MultiSelectFilter
                  label="Key exchange methods"
                  helper="Select one or more algorithms seen in the handshake."
                  values={kexAlgorithms}
                  options={filterOptions.kexAlgorithms}
                  onToggle={(value) => toggleSelection(value, kexAlgorithms, setKexAlgorithms)}
                  onClear={() => setKexAlgorithms([])}
                  emptyLabel="All key exchange methods"
                  icon={KeyRound}
                  labelClassName="text-white/92"
                />

                <MultiSelectFilter
                  label="Negotiated groups"
                  helper="Select the negotiated curves or hybrid groups to match."
                  values={kexGroups}
                  options={filterOptions.kexGroups}
                  onToggle={(value) => toggleSelection(value, kexGroups, setKexGroups)}
                  onClear={() => setKexGroups([])}
                  emptyLabel="All negotiated groups"
                  icon={GitBranch}
                  labelClassName="text-white/92"
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
