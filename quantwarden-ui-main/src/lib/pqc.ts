const NIST_KYBER_GROUPS = [
  "MLKEM512",
  "MLKEM768",
  "MLKEM1024",
  "SecP256r1MLKEM768",
  "X25519MLKEM768",
  "SecP384r1MLKEM1024",
] as const;

export const PQC_KYBER_GROUPS = NIST_KYBER_GROUPS;

export function isKyberGroup(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return NIST_KYBER_GROUPS.some((entry) => entry.toUpperCase() === normalized);
}

export function hasKyberGroup(values: Array<string | null | undefined> | null | undefined): boolean {
  return Boolean(values?.some((value) => isKyberGroup(value)));
}
