export type BooleanFilter = "" | "true" | "false";

export type AssetExplorerClientProps = {
  org: {
    id: string;
    slug: string;
    name: string;
  };
  initialDnsState: string;
  initialCertState: string;
  initialTlsProfile: string;
  initialTlsMatch: string;
  initialSelfSigned: string;
  initialSignatureAlgorithm: string;
  initialPort: string;
  initialCertExpiry: string;
  initialTimeoutOnly: string;
  initialNoTls: string;
  initialCipher: string;
  initialKeySize: string;
  initialTls: string;
  initialPqcSupported: string;
  initialPqcNegotiated: string;
  initialPqcTier?: string;
  initialScanStatus?: string;
  initialBucket?: string;
  initialKexAlgorithms: string[];
  initialKexGroups: string[];
  initialPage: number;
  initialPageSize: number;
};

export type FilterOptions = {
  ciphers: string[];
  keySizes: string[];
  tlsVersions: string[];
  ports: string[];
  kexAlgorithms: string[];
  kexGroups: string[];
  signatureAlgorithms: string[];
  buckets: string[];
};

export type SelectOption = {
  value: string;
  label: string;
};

export type ResultSummaryProps = {
  usesEndpointMatching: boolean;
  totalMatch: number;
  matchingEndpointCount: number;
  assetCount: number;
};

export type FilterControlsProps = {
  search: string;
  setSearch: (value: string) => void;
  dnsState: string;
  setDnsState: (value: string) => void;
  tls: string;
  setTls: (value: string) => void;
  keySize: string;
  setKeySize: (value: string) => void;
  signatureAlgorithm: string;
  setSignatureAlgorithm: (value: string) => void;
  port: string;
  setPort: (value: string) => void;
  certExpiry: string;
  setCertExpiry: (value: string) => void;
  cipher: string;
  setCipher: (value: string) => void;
  timeoutOnly: BooleanFilter;
  setTimeoutOnly: (value: BooleanFilter) => void;
  noTlsOnly: BooleanFilter;
  setNoTlsOnly: (value: BooleanFilter) => void;
  pqcSupportedOnly: BooleanFilter;
  setPqcSupportedOnly: (value: BooleanFilter) => void;
  pqcNegotiatedOnly: BooleanFilter;
  setPqcNegotiatedOnly: (value: BooleanFilter) => void;
  pqcTier: string;
  setPqcTier: (value: string) => void;
  scanStatus: string;
  setScanStatus: (value: string) => void;
  bucket: string;
  setBucket: (value: string) => void;
  kexAlgorithms: string[];
  setKexAlgorithms: (value: string[]) => void;
  kexGroups: string[];
  setKexGroups: (value: string[]) => void;
  filterOptions: FilterOptions;
  dnsOptions: SelectOption[];
  tlsVersionOptions: SelectOption[];
  keySizeOptions: SelectOption[];
  portOptions: SelectOption[];
  certExpiryOptions: SelectOption[];
  signatureAlgorithmOptions: SelectOption[];
  cipherOptions: SelectOption[];
  bucketOptions: SelectOption[];
  scanResultOptions: SelectOption[];
  scanStatusOptions: SelectOption[];
  tlsPresenceOptions: SelectOption[];
  kyberSupportOptions: SelectOption[];
  kyberNegotiationOptions: SelectOption[];
  activeAdvancedFilterCount: number;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (value: boolean | ((current: boolean) => boolean)) => void;
  toggleSelection: (value: string, selected: string[], setter: (values: string[]) => void) => void;
  variant?: "inline" | "modal";
};
