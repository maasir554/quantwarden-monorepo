"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Filter,
  Globe,
  Loader2,
  RefreshCcw,
  Search,
  Telescope,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import AssetExplorerAssetList from "./AssetExplorerAssetList";
import AssetExplorerFilterControls from "./AssetExplorerFilterControls";
import AssetExplorerPaginationDock from "./AssetExplorerPaginationDock";
import { AssetExplorerClientProps, BooleanFilter, FilterOptions, SelectOption } from "./asset-explorer-types";
import {
  FILTER_QUERY_KEYS,
  assetMatchesClientSearch,
  buildFilterQueryParams,
  countActiveFilters,
  countAdvancedFilters,
  miniNavTopOffset,
  normalizeBooleanFilter,
  pageSizeOptions,
} from "./asset-explorer-utils";

export default function AssetExplorerClientImpl({
  org,
  initialDnsState,
  initialCertState,
  initialTlsProfile,
  initialTlsMatch,
  initialSelfSigned,
  initialSignatureAlgorithm,
  initialPort,
  initialCertExpiry,
  initialTimeoutOnly,
  initialNoTls,
  initialCipher,
  initialKeySize,
  initialTls,
  initialPqcSupported,
  initialPqcNegotiated,
  initialPqcTier,
  initialScanStatus,
  initialBucket,
  initialKexAlgorithms,
  initialKexGroups,
  initialPage,
  initialPageSize,
}: AssetExplorerClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const capsuleSearchInputRef = useRef<HTMLInputElement | null>(null);

  const [dnsState, setDnsState] = useState(initialDnsState || "");
  const [certState, setCertState] = useState(initialCertState || "");
  const [tlsProfile, setTlsProfile] = useState(initialTlsProfile || "");
  const [tlsMatch, setTlsMatch] = useState(initialTlsMatch === "exact_latest" ? "exact_latest" : "");
  const [selfSigned, setSelfSigned] = useState(initialSelfSigned === "true" ? "true" : "");
  const [signatureAlgorithm, setSignatureAlgorithm] = useState(initialSignatureAlgorithm || "");
  const [port, setPort] = useState(initialPort || "");
  const [certExpiry, setCertExpiry] = useState(initialCertExpiry || "");
  const [timeoutOnly, setTimeoutOnly] = useState<BooleanFilter>(normalizeBooleanFilter(initialTimeoutOnly));
  const [noTlsOnly, setNoTlsOnly] = useState<BooleanFilter>(normalizeBooleanFilter(initialNoTls));
  const [cipher, setCipher] = useState(initialCipher || "");
  const [keySize, setKeySize] = useState(initialKeySize || "");
  const [tls, setTls] = useState(initialTls || "");
  const [pqcSupportedOnly, setPqcSupportedOnly] = useState<BooleanFilter>(normalizeBooleanFilter(initialPqcSupported));
  const [pqcNegotiatedOnly, setPqcNegotiatedOnly] = useState<BooleanFilter>(normalizeBooleanFilter(initialPqcNegotiated));
  const [pqcTier, setPqcTier] = useState(initialPqcTier || "");
  const [scanStatus, setScanStatus] = useState(initialScanStatus || "");
  const [bucket, setBucket] = useState(initialBucket || "");
  const [kexAlgorithms, setKexAlgorithms] = useState<string[]>(initialKexAlgorithms || []);
  const [kexGroups, setKexGroups] = useState<string[]>(initialKexGroups || []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(Math.max(1, initialPage || 1));
  const [pageSize, setPageSize] = useState(pageSizeOptions.includes(initialPageSize) ? initialPageSize : 25);
  const [pageInputValue, setPageInputValue] = useState(String(Math.max(1, initialPage || 1)));
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<any[]>([]);
  const [usesEndpointMatching, setUsesEndpointMatching] = useState(false);
  const [expandedAssetIds, setExpandedAssetIds] = useState<Record<string, boolean>>({});
  const [showScrollCapsules, setShowScrollCapsules] = useState(false);
  const [isCapsuleSearchOpen, setIsCapsuleSearchOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(
    countAdvancedFilters({
      timeoutOnly: normalizeBooleanFilter(initialTimeoutOnly),
      noTlsOnly: normalizeBooleanFilter(initialNoTls),
      pqcSupportedOnly: normalizeBooleanFilter(initialPqcSupported),
      pqcNegotiatedOnly: normalizeBooleanFilter(initialPqcNegotiated),
      pqcTier: initialPqcTier || "",
      scanStatus: initialScanStatus || "",
      bucket: initialBucket || "",
      kexAlgorithms: initialKexAlgorithms || [],
      kexGroups: initialKexGroups || [],
    }) > 0
  );
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    ciphers: [],
    keySizes: [],
    tlsVersions: [],
    ports: [],
    kexAlgorithms: [],
    kexGroups: [],
    signatureAlgorithms: [],
    buckets: [],
  });
  const deferredSearch = useDeferredValue(search);
  const normalizedSearch = useMemo(() => deferredSearch.trim().toLowerCase(), [deferredSearch]);
  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        dnsState,
        certState,
        tlsProfile,
        tlsMatch,
        selfSigned,
        signatureAlgorithm,
        port,
        certExpiry,
        timeoutOnly,
        noTlsOnly,
        cipher,
        keySize,
        tls,
        pqcSupportedOnly,
        pqcNegotiatedOnly,
        pqcTier,
        scanStatus,
        bucket,
        kexAlgorithms,
        kexGroups,
      }),
    [
      cipher,
      certState,
      certExpiry,
      dnsState,
      keySize,
      kexAlgorithms,
      kexGroups,
      noTlsOnly,
      port,
      pqcNegotiatedOnly,
      pqcSupportedOnly,
      pqcTier,
      scanStatus,
      selfSigned,
      signatureAlgorithm,
      bucket,
      tlsMatch,
      tlsProfile,
      timeoutOnly,
      tls,
    ]
  );
  const previousFilterSignatureRef = useRef<string | null>(null);
  const previousSearchValueRef = useRef<string | null>(null);

  useEffect(() => {
    setPageInputValue(String(page));
  }, [page]);

  useEffect(() => {
    if (previousFilterSignatureRef.current === null) {
      previousFilterSignatureRef.current = filterSignature;
      return;
    }

    if (previousFilterSignatureRef.current !== filterSignature) {
      previousFilterSignatureRef.current = filterSignature;
      setPage(1);
    }
  }, [filterSignature]);

  useEffect(() => {
    if (previousSearchValueRef.current === null) {
      previousSearchValueRef.current = normalizedSearch;
      return;
    }

    if (previousSearchValueRef.current !== normalizedSearch) {
      previousSearchValueRef.current = normalizedSearch;
      setPage(1);
    }
  }, [normalizedSearch]);

  useEffect(() => {
    const updateCapsuleVisibility = () => {
      const filterPanel = filterPanelRef.current;
      if (!filterPanel) {
        setShowScrollCapsules(false);
        return;
      }

      const rect = filterPanel.getBoundingClientRect();
      setShowScrollCapsules(rect.bottom <= miniNavTopOffset);
    };

    updateCapsuleVisibility();
    window.addEventListener("scroll", updateCapsuleVisibility, { passive: true });
    window.addEventListener("resize", updateCapsuleVisibility);

    return () => {
      window.removeEventListener("scroll", updateCapsuleVisibility);
      window.removeEventListener("resize", updateCapsuleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!showScrollCapsules) {
      setIsCapsuleSearchOpen(false);
    }
  }, [showScrollCapsules]);

  useEffect(() => {
    if (!isCapsuleSearchOpen) return;

    const focusTimer = window.setTimeout(() => {
      capsuleSearchInputRef.current?.focus();
      capsuleSearchInputRef.current?.select();
    }, 120);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isCapsuleSearchOpen]);

  useEffect(() => {
    if (!isFilterModalOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterModalOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isFilterModalOpen]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    const filterParams = buildFilterQueryParams({
      dnsState,
      certState,
      tlsProfile,
      tlsMatch,
      selfSigned,
      signatureAlgorithm,
      port,
      certExpiry,
      timeoutOnly,
      noTlsOnly,
      cipher,
      keySize,
      tls,
      pqcSupportedOnly,
      pqcNegotiatedOnly,
      pqcTier,
      scanStatus,
      bucket,
      kexAlgorithms,
      kexGroups,
      page,
      pageSize,
    });

    for (const key of FILTER_QUERY_KEYS) {
      nextParams.delete(key);
    }

    filterParams.forEach((value, key) => {
      nextParams.set(key, value);
    });

    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();

    if (currentQuery !== nextQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [
    cipher,
    certState,
    certExpiry,
    dnsState,
    kexAlgorithms,
    kexGroups,
    keySize,
    noTlsOnly,
    pathname,
    port,
    pqcNegotiatedOnly,
    pqcSupportedOnly,
    pqcTier,
    selfSigned,
    signatureAlgorithm,
    bucket,
    tlsMatch,
    tlsProfile,
    page,
    pageSize,
    router,
    searchParams,
    timeoutOnly,
    tls,
    scanStatus,
  ]);

  useEffect(() => {
    let mounted = true;

    const fetchAssets = async () => {
      setLoading(true);

      try {
        const query = new URLSearchParams();
        query.append("orgId", org.id);
        if (dnsState) query.append("dnsState", dnsState);
        if (certState) query.append("certState", certState);
        if (tlsProfile) query.append("tlsProfile", tlsProfile);
        if (tlsMatch) query.append("tlsMatch", tlsMatch);
        if (selfSigned) query.append("selfSigned", selfSigned);
        if (signatureAlgorithm) query.append("signatureAlgorithm", signatureAlgorithm);
        if (port) query.append("port", port);
        if (certExpiry) query.append("certExpiry", certExpiry);
        if (timeoutOnly) query.append("timeoutOnly", timeoutOnly);
        if (noTlsOnly) query.append("noTls", noTlsOnly);
        if (cipher) query.append("cipher", cipher);
        if (keySize) query.append("keySize", keySize);
        if (tls) query.append("tls", tls);
        if (pqcSupportedOnly) query.append("pqcSupported", pqcSupportedOnly);
        if (pqcNegotiatedOnly) query.append("pqcNegotiated", pqcNegotiatedOnly);
        if (pqcTier) query.append("pqcTier", pqcTier);
        if (scanStatus) query.append("scanStatus", scanStatus);
        if (bucket) query.append("bucket", bucket);
        if (kexAlgorithms.length > 0) query.append("kexAlgos", kexAlgorithms.join(","));
        if (kexGroups.length > 0) query.append("kexGroups", kexGroups.join(","));
        query.append("paginate", "false");

        const res = await fetch(`/api/orgs/explore?${query.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");

        const json = await res.json();

        if (mounted) {
          setAssets(json.assets || []);
          setUsesEndpointMatching(Boolean(json.usesEndpointMatching));
          setExpandedAssetIds({});
          if (json.filterOptions) setFilterOptions(json.filterOptions);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAssets();

    return () => {
      mounted = false;
    };
  }, [
    cipher,
    certState,
    certExpiry,
    dnsState,
    kexAlgorithms,
    kexGroups,
    keySize,
    noTlsOnly,
    org.id,
    port,
    pqcNegotiatedOnly,
    pqcSupportedOnly,
    pqcTier,
    scanStatus,
    selfSigned,
    signatureAlgorithm,
    bucket,
    tlsMatch,
    tlsProfile,
    timeoutOnly,
    tls,
  ]);

  const activeFilterCount = countActiveFilters({
    dnsState,
    certState,
    tlsProfile,
    tlsMatch,
    selfSigned,
    signatureAlgorithm,
    port,
    certExpiry,
    timeoutOnly,
    noTlsOnly,
    cipher,
    keySize,
    tls,
    pqcSupportedOnly,
    pqcNegotiatedOnly,
    pqcTier,
    scanStatus,
    bucket,
    kexAlgorithms,
    kexGroups,
  });
  const hasSearch = Boolean(search.trim());

  const activeAdvancedFilterCount = countAdvancedFilters({
    timeoutOnly,
    noTlsOnly,
    pqcSupportedOnly,
    pqcNegotiatedOnly,
    pqcTier,
    scanStatus,
    bucket,
    kexAlgorithms,
    kexGroups,
  });

  const dnsOptions: SelectOption[] = [
    { value: "found", label: "Resolved in DNS" },
    { value: "not_found", label: "Missing from DNS" },
  ];

  const scanResultOptions: SelectOption[] = [
    { value: "false", label: "Successful scan" },
    { value: "true", label: "Timed out" },
  ];

  const tlsPresenceOptions: SelectOption[] = [
    { value: "false", label: "TLS detected" },
    { value: "true", label: "No TLS detected" },
  ];

  const kyberSupportOptions: SelectOption[] = [
    { value: "true", label: "Kyber supported" },
    { value: "false", label: "Kyber not supported" },
  ];

  const kyberNegotiationOptions: SelectOption[] = [
    { value: "true", label: "Kyber negotiated" },
    { value: "false", label: "Kyber not negotiated" },
  ];

  const scanStatusOptions: SelectOption[] = [
    { value: "scanned", label: "Scanned" },
    { value: "unscanned", label: "Unscanned" },
    { value: "no_dns", label: "Missing DNS" },
    { value: "unresponsive", label: "Unresponsive" },
  ];

  const tlsVersionOptions = filterOptions.tlsVersions.map((option) => ({
    value: option,
    label: option,
  }));

  const keySizeOptions = filterOptions.keySizes.map((option) => ({
    value: option,
    label: option,
  }));

  const portOptions = filterOptions.ports.map((option) => ({
    value: option,
    label: option,
  }));

  const certExpiryOptions: SelectOption[] = [
    { value: "expired", label: "Expired" },
    { value: "in_30_days", label: "In 30 days" },
    { value: "in_90_days", label: "In 90 days" },
    { value: "over_90_days", label: "> 90 days" },
  ];

  const signatureAlgorithmOptions = filterOptions.signatureAlgorithms.map((option) => ({
    value: option,
    label: option,
  }));

  const cipherOptions = filterOptions.ciphers.map((option) => ({
    value: option,
    label: option,
  }));

  const bucketOptions = filterOptions.buckets.map((option) => ({
    value: option,
    label: option,
  }));

  const toggleSelection = (value: string, selected: string[], setter: (values: string[]) => void) => {
    if (selected.includes(value)) {
      setter(selected.filter((item) => item !== value));
      return;
    }

    setter([...selected, value]);
  };

  const toggleAssetExpansion = (assetId: string) => {
    setExpandedAssetIds((current) => ({
      ...current,
      [assetId]: !current[assetId],
    }));
  };

  const searchedAssets = useMemo(
    () => assets.filter((asset) => assetMatchesClientSearch(asset, normalizedSearch)),
    [assets, normalizedSearch]
  );
  const totalMatch = searchedAssets.length;
  const matchingEndpointCount = searchedAssets.reduce(
    (sum, asset) => sum + Math.max(asset.matchingEndpointCount || 0, 0),
    0
  );
  const totalPages = Math.max(1, Math.ceil(totalMatch / pageSize));
  const paginatedAssets = searchedAssets.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const resetFilters = () => {
    setSearch("");
    setDnsState("");
    setCertState("");
    setTlsProfile("");
    setTlsMatch("");
    setSelfSigned("");
    setSignatureAlgorithm("");
    setPort("");
    setCertExpiry("");
    setTimeoutOnly("");
    setNoTlsOnly("");
    setCipher("");
    setKeySize("");
    setTls("");
    setPqcSupportedOnly("");
    setPqcNegotiatedOnly("");
    setPqcTier("");
    setScanStatus("");
    setBucket("");
    setKexAlgorithms([]);
    setKexGroups([]);
    setPage(1);
    setShowAdvancedFilters(false);
  };

  const commitPageInput = () => {
    const parsedPage = Number.parseInt(pageInputValue, 10);
    const nextPage = Number.isFinite(parsedPage) ? Math.min(Math.max(parsedPage, 1), totalPages) : page;
    setPageInputValue(String(nextPage));
    if (nextPage !== page) {
      setPage(nextPage);
    }
  };

  const canGoToPreviousPage = page > 1;
  const canGoToNextPage = page < totalPages;
  const pageStart = totalMatch === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, totalMatch);

  return (
    <TooltipProvider>
      <div className="mx-auto flex min-h-screen w-full max-w-275 flex-col px-6 py-8 sm:px-8">
        <AnimatePresence>
          {showScrollCapsules ? (
            <motion.div
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center sm:top-24"
            >
              <div className="pointer-events-auto flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/app/${org.slug}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/80 text-[#7a1f1f] shadow-lg shadow-amber-950/10 backdrop-blur-xl transition hover:bg-white"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Back to dashboard</TooltipContent>
                </Tooltip>

                <motion.div
                  layout
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  animate={{ width: isCapsuleSearchOpen ? 44 : 172 }}
                  className="flex h-11 items-center gap-2 overflow-hidden rounded-full border border-white/75 bg-white/80 px-3 text-sm font-bold text-[#3d200a] shadow-lg shadow-amber-950/10 backdrop-blur-xl"
                >
                  <Telescope className="h-4 w-4 shrink-0 text-[#7a1f1f]" />
                  <motion.span
                    animate={{
                      opacity: isCapsuleSearchOpen ? 0 : 1,
                      x: isCapsuleSearchOpen ? -8 : 0,
                      maxWidth: isCapsuleSearchOpen ? 0 : 120,
                    }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    Asset Explorer
                  </motion.span>
                </motion.div>

                <AnimatePresence mode="popLayout" initial={false}>
                  {isCapsuleSearchOpen ? (
                    <motion.div
                      key="capsule-search-open"
                      layout
                      initial={{ opacity: 0, width: 44 }}
                      animate={{ opacity: 1, width: 320 }}
                      exit={{ opacity: 0, width: 44 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="flex h-11 items-center gap-2 rounded-full border border-white/75 bg-white/88 px-3 text-[#3d200a] shadow-lg shadow-amber-950/10 backdrop-blur-xl"
                    >
                      <Search className="h-4 w-4 shrink-0 text-[#7a1f1f]" />
                      <input
                        ref={capsuleSearchInputRef}
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search assets"
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#3d200a] outline-none placeholder:text-[#8a5d33]/65"
                      />
                      <button
                        type="button"
                        onClick={() => setIsCapsuleSearchOpen(false)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8B0000]/8 text-[#7a1f1f] transition hover:bg-[#8B0000]/14"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ) : (
                    <Tooltip key="capsule-search-closed">
                      <TooltipTrigger asChild>
                        <motion.button
                          layout
                          type="button"
                          onClick={() => setIsCapsuleSearchOpen(true)}
                          initial={{ opacity: 0, width: 44 }}
                          animate={{ opacity: 1, width: 44 }}
                          exit={{ opacity: 0, width: 44 }}
                          transition={{ duration: 0.2 }}
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/80 text-[#7a1f1f] shadow-lg shadow-amber-950/10 backdrop-blur-xl transition hover:bg-white"
                        >
                          <Search className="h-4 w-4" />
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent>Quick search</TooltipContent>
                    </Tooltip>
                  )}
                </AnimatePresence>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setIsFilterModalOpen(true)}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full border shadow-lg shadow-amber-950/10 backdrop-blur-xl transition",
                        activeFilterCount > 0
                          ? "border-[#163b73]/55 bg-[#163b73]/92 text-white hover:bg-[#163b73]"
                          : "border-white/75 bg-white/80 text-[#7a1f1f] hover:bg-white"
                      )}
                    >
                      <Filter className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {activeFilterCount > 0
                      ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                      : "Open filters"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {isFilterModalOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-start justify-center bg-[#2a1202]/28 px-4 py-6 backdrop-blur-sm sm:items-center sm:p-6"
              onClick={() => setIsFilterModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.985 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/70 bg-[rgba(255,248,228,0.92)] shadow-2xl shadow-amber-950/20 backdrop-blur-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-amber-500/10 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-sm font-bold text-[#7a1f1f]">Filters</p>
                    <h3 className="mt-1 text-xl font-bold text-[#3d200a]">Adjust the explorer without losing your place</h3>
                    <p className="mt-1 text-sm font-medium text-[#6d3f1d]/85">
                      Filter changes stay shareable through the URL. Search refines the current results instantly on this page.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeFilterCount > 0 ? (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-[#8B0000]/15 bg-white/80 px-4 text-sm font-bold text-[#8B0000] transition hover:bg-white"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Reset
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsFilterModalOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/75 bg-white/85 text-[#7a1f1f] transition hover:bg-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[calc(90vh-5.5rem)] overflow-y-auto px-5 py-5 sm:px-6">
                  <AssetExplorerFilterControls
                    search={search}
                    setSearch={setSearch}
                    dnsState={dnsState}
                    setDnsState={setDnsState}
                    tls={tls}
                    setTls={setTls}
                    keySize={keySize}
                    setKeySize={setKeySize}
                    signatureAlgorithm={signatureAlgorithm}
                    setSignatureAlgorithm={setSignatureAlgorithm}
                    port={port}
                    setPort={setPort}
                    certExpiry={certExpiry}
                    setCertExpiry={setCertExpiry}
                    cipher={cipher}
                    setCipher={setCipher}
                    timeoutOnly={timeoutOnly}
                    setTimeoutOnly={setTimeoutOnly}
                    noTlsOnly={noTlsOnly}
                    setNoTlsOnly={setNoTlsOnly}
                    pqcSupportedOnly={pqcSupportedOnly}
                    setPqcSupportedOnly={setPqcSupportedOnly}
                    pqcNegotiatedOnly={pqcNegotiatedOnly}
                    setPqcNegotiatedOnly={setPqcNegotiatedOnly}
                    pqcTier={pqcTier}
                    setPqcTier={setPqcTier}
                    scanStatus={scanStatus}
                    setScanStatus={setScanStatus}
                    bucket={bucket}
                    setBucket={setBucket}
                    kexAlgorithms={kexAlgorithms}
                    setKexAlgorithms={setKexAlgorithms}
                    kexGroups={kexGroups}
                    setKexGroups={setKexGroups}
                    filterOptions={filterOptions}
                    dnsOptions={dnsOptions}
                    tlsVersionOptions={tlsVersionOptions}
                    keySizeOptions={keySizeOptions}
                    portOptions={portOptions}
                    certExpiryOptions={certExpiryOptions}
                    signatureAlgorithmOptions={signatureAlgorithmOptions}
                    cipherOptions={cipherOptions}
                    bucketOptions={bucketOptions}
                    scanResultOptions={scanResultOptions}
                    scanStatusOptions={scanStatusOptions}
                    tlsPresenceOptions={tlsPresenceOptions}
                    kyberSupportOptions={kyberSupportOptions}
                    kyberNegotiationOptions={kyberNegotiationOptions}
                    activeAdvancedFilterCount={activeAdvancedFilterCount}
                    showAdvancedFilters={showAdvancedFilters}
                    setShowAdvancedFilters={setShowAdvancedFilters}
                    toggleSelection={toggleSelection}
                    variant="modal"
                  />
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/app/${org.slug}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#8a5d33]/85 transition-colors hover:text-[#5b3416]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="flex items-center gap-3 truncate text-3xl font-extrabold tracking-tight text-[#3d200a]">
            <Globe className="h-8 w-8 text-[#8B0000]" />
            Asset Explorer
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#6d3f1d]">
            Deep search and filter all tracked infrastructure variants in real-time.
          </p>
        </div>

        <div ref={filterPanelRef} className="mb-8 rounded-[30px] border border-white/55 bg-white/45 p-4 shadow-sm ring-1 ring-amber-500/10 backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-sm font-bold text-[#7a1f1f]">
                  Find and filter
                </p>
                <h2 className="mt-1 text-lg font-bold text-[#3d200a]">
                  Search by asset name, TLS posture, and post-quantum handshake details.
                </h2>
                <p className="mt-1 text-sm font-medium text-[#6d3f1d]/85">
                  Filters stay shareable through the URL. Search narrows the current results instantly on this page.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full bg-white/75 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#8a5d33]">
                  {activeFilterCount === 0
                    ? hasSearch
                      ? "Live search active"
                      : "Showing all assets"
                    : hasSearch
                      ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"} + search`
                      : `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`}
                </div>
                {activeFilterCount > 0 || hasSearch ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 rounded-full border border-[#8B0000]/15 bg-white/75 px-4 py-2 text-sm font-bold text-[#8B0000] transition-colors hover:border-[#8B0000]/30 hover:bg-white"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Reset filters
                  </button>
                ) : null}
              </div>
            </div>

            <AssetExplorerFilterControls
              search={search}
              setSearch={setSearch}
              dnsState={dnsState}
              setDnsState={setDnsState}
              tls={tls}
              setTls={setTls}
              keySize={keySize}
              setKeySize={setKeySize}
              signatureAlgorithm={signatureAlgorithm}
              setSignatureAlgorithm={setSignatureAlgorithm}
              port={port}
              setPort={setPort}
              certExpiry={certExpiry}
              setCertExpiry={setCertExpiry}
              cipher={cipher}
              setCipher={setCipher}
              timeoutOnly={timeoutOnly}
              setTimeoutOnly={setTimeoutOnly}
              noTlsOnly={noTlsOnly}
              setNoTlsOnly={setNoTlsOnly}
              pqcSupportedOnly={pqcSupportedOnly}
              setPqcSupportedOnly={setPqcSupportedOnly}
              pqcNegotiatedOnly={pqcNegotiatedOnly}
              setPqcNegotiatedOnly={setPqcNegotiatedOnly}
              pqcTier={pqcTier}
              setPqcTier={setPqcTier}
              scanStatus={scanStatus}
              setScanStatus={setScanStatus}
              bucket={bucket}
              setBucket={setBucket}
              kexAlgorithms={kexAlgorithms}
              setKexAlgorithms={setKexAlgorithms}
              kexGroups={kexGroups}
              setKexGroups={setKexGroups}
              filterOptions={filterOptions}
              dnsOptions={dnsOptions}
              tlsVersionOptions={tlsVersionOptions}
              keySizeOptions={keySizeOptions}
              portOptions={portOptions}
              certExpiryOptions={certExpiryOptions}
              signatureAlgorithmOptions={signatureAlgorithmOptions}
              cipherOptions={cipherOptions}
              bucketOptions={bucketOptions}
              scanResultOptions={scanResultOptions}
              scanStatusOptions={scanStatusOptions}
              tlsPresenceOptions={tlsPresenceOptions}
              kyberSupportOptions={kyberSupportOptions}
              kyberNegotiationOptions={kyberNegotiationOptions}
              activeAdvancedFilterCount={activeAdvancedFilterCount}
              showAdvancedFilters={showAdvancedFilters}
              setShowAdvancedFilters={setShowAdvancedFilters}
              toggleSelection={toggleSelection}
            />
          </div>
        </div>

        <div className="flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-[#8B0000]" />
              <p className="font-mono text-sm font-semibold text-[#6d3f1d]">Querying infrastructure...</p>
            </div>
          ) : totalMatch === 0 ? (
            <div className="flex flex-col items-center justify-center pb-32 pt-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/55 bg-white/45 backdrop-blur-md">
                <Search className="h-8 w-8 text-[#8B0000]" />
              </div>
              <p className="text-lg font-bold text-[#3d200a]">
                {hasSearch ? "No assets match this search." : "No correlated assets found."}
              </p>
              <p className="mt-1 max-w-sm text-sm font-medium text-[#6d3f1d]">
                {hasSearch
                  ? "Try a broader search term, or clear the search to return to the filtered result set."
                  : "Try broadening the filters, relaxing an advanced TLS condition, or clearing the current setup."}
              </p>
            </div>
          ) : (
            <AssetExplorerAssetList
              assets={paginatedAssets}
              expandedAssetIds={expandedAssetIds}
              matchingEndpointCount={matchingEndpointCount}
              onToggleAssetExpansion={toggleAssetExpansion}
              orgSlug={org.slug}
              totalMatch={totalMatch}
              usesEndpointMatching={usesEndpointMatching}
            />
          )}
        </div>

        {!loading && totalMatch > 0 ? (
          <AssetExplorerPaginationDock
            canGoToNextPage={canGoToNextPage}
            canGoToPreviousPage={canGoToPreviousPage}
            commitPageInput={commitPageInput}
            page={page}
            pageEnd={pageEnd}
            pageInputValue={pageInputValue}
            pageSize={pageSize}
            pageStart={pageStart}
            setPage={setPage}
            setPageInputValue={setPageInputValue}
            setPageSize={setPageSize}
            totalMatch={totalMatch}
            totalPages={totalPages}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}
