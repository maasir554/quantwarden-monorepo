export interface PqcAssessment {
  score: number;       // 0 to 100
  tier: "A" | "B" | "C" | "D" | "F";
  status: "Quantum-Safe" | "Transitional" | "Legacy" | "Vulnerable" | "Unknown";
  breakdown: {
    keyExchange: { score: number; max: 40; label: string; passed: boolean };
    symmetric:   { score: number; max: 30; label: string; passed: boolean };
    protocol:    { score: number; max: 20; label: string; passed: boolean };
    auth:        { score: number; max: 10; label: string; passed: boolean };
    penalties:   Array<{ score: number; reason: string }>;
  };
}

export function calculatePqcScore(scanData: any | null): PqcAssessment | null {
  if (!scanData || typeof scanData !== "object") return null;
  if (!scanData.resolved_ip) return null;

  // 1. Key Encapsulation / Exchange (Max 40)
  let kexScore = 0;
  let kexLabel = "Unknown";
  let kexPassed = false;

  const supportedGroups: string[] = scanData.supported_groups || [];
  const kexAlgos: string[] = scanData.tls_key_exchange_algorithms || [];
  const allKex = new Set([...supportedGroups, ...kexAlgos].map(g => g.toLowerCase()));
  
  const hasMlKem = Array.from(allKex).some(g => g.includes("mlkem"));
  
  let negotiatedMlKem = false;
  if (Array.isArray(scanData.tls_versions)) {
    scanData.tls_versions.forEach((v: any) => {
      if (v.supported && v.negotiated_group && v.negotiated_group.toLowerCase().includes("mlkem")) {
        negotiatedMlKem = true;
      }
    });
  }

  if (negotiatedMlKem) {
    kexScore = 40;
    kexLabel = "ML-KEM Negotiated";
    kexPassed = true;
  } else if (hasMlKem) {
    kexScore = 20;
    kexLabel = "ML-KEM Supported (Not Default)";
    kexPassed = false; // Need true negotiation for passing this pillar
  } else if (allKex.has("x25519") || allKex.has("x448") || allKex.has("secp384r1") || allKex.has("secp521r1")) {
    kexScore = 15;
    kexLabel = "Strong Classical (x25519 / secp384r1+)";
    kexPassed = false;
  } else if (allKex.has("secp256r1") || Array.from(allKex).some(g => g.includes("dhe"))) {
    kexScore = 10;
    kexLabel = "Standard Classical (secp256r1 / DHE)";
    kexPassed = false;
  } else {
    kexLabel = "Legacy or None";
  }

  // 2. Symmetric Encryption (Max 30)
  let symScore = 0;
  let symLabel = "Unknown";
  let symPassed = false;

  const encAlgos: string[] = (scanData.tls_encryption_algorithms || []).map((a: string) => a.toUpperCase());
  
  if (encAlgos.includes("AES_256_GCM") || encAlgos.includes("CHACHA20_POLY1305")) {
    symScore = 30;
    symLabel = "AES-256 / ChaCha20-Poly1305";
    symPassed = true;
  } else if (encAlgos.includes("AES_128_GCM")) {
    symScore = 15;
    symLabel = "AES-128 GCM";
    symPassed = false;
  } else if (encAlgos.length > 0) {
    symScore = 5;
    symLabel = "Legacy Symmetric";
    symPassed = false;
  }

  // 3. Protocol Version (Max 20)
  let protoScore = 0;
  let protoLabel = "Unknown";
  let protoPassed = false;

  let supportsTls13 = false;
  let supportsTls12 = false;
  let supportsTls11 = false;
  let supportsTls10 = false;

  if (Array.isArray(scanData.tls_versions)) {
    scanData.tls_versions.forEach((v: any) => {
      const ver = v.tls_version || "";
      if (ver.includes("1.3") && v.supported) supportsTls13 = true;
      if (ver.includes("1.2") && v.supported) supportsTls12 = true;
      if (ver.includes("1.1") && v.supported) supportsTls11 = true;
      if (ver.includes("1.0") && v.supported) supportsTls10 = true;
    });
  }

  if (supportsTls13) {
    protoScore = 20;
    protoLabel = "TLS 1.3 Available";
    protoPassed = true;
  } else if (supportsTls12) {
    protoScore = 10;
    protoLabel = "TLS 1.2 Only";
    protoPassed = false;
  }

  // 4. Authentication / Signature (Max 10)
  let authScore = 0;
  let authLabel = "Unknown";
  let authPassed = false;
  let rsaBits = 0;
  let isRsa = false;

  const cert = scanData.certificate;
  if (cert && cert.public_key_algorithm) {
    const algo = (cert.public_key_algorithm.name || "").toLowerCase();
    rsaBits = cert.public_key_bits || 0;

    if (algo.includes("ecdsa") || algo.includes("ecpublickey") || algo.includes("ed25519") || algo.includes("secp")) {
      authScore = 10;
      authLabel = "ECDSA / EdDSA";
      authPassed = true;
    } else if (algo.includes("rsa")) {
      isRsa = true;
      if (rsaBits >= 3072) {
        authScore = 10;
        authLabel = `RSA ${rsaBits}-bit`;
        authPassed = true;
      } else if (rsaBits >= 2048) {
        authScore = 5;
        authLabel = `RSA ${rsaBits}-bit`;
        authPassed = false;
      } else {
        authLabel = `RSA ${rsaBits}-bit`;
        authPassed = false;
      }
    }
  }

  // Penalties
  const penalties: Array<{ score: number; reason: string }> = [];

  let isSelfSigned = false;
  if (cert && cert.subject_normalized && cert.issuer_normalized) {
    if (cert.subject_normalized === cert.issuer_normalized) {
      isSelfSigned = true;
    }
  }

  if (isSelfSigned) {
    penalties.push({ score: -50, reason: "Self-Signed Certificate" });
  }

  if (supportsTls10 || supportsTls11) {
    penalties.push({ score: -30, reason: "Deprecated Protocol Enabled (TLS 1.0 / 1.1)" });
  }

  if (isRsa && rsaBits > 0 && rsaBits < 2048) {
    penalties.push({ score: -50, reason: `Weak RSA Key (${rsaBits}-bit)` });
  }
  
  if (cert && cert.signature_algorithm && cert.signature_algorithm.name) {
    if (cert.signature_algorithm.name.toLowerCase().includes("sha1") || cert.signature_algorithm.name.toLowerCase().includes("md5")) {
      penalties.push({ score: -50, reason: "Weak Signature Algorithm (SHA-1 / MD5)" });
    }
  }

  // Synthesis
  const penaltyTotal = penalties.reduce((sum, p) => sum + p.score, 0);
  const rawScore = kexScore + symScore + protoScore + authScore + penaltyTotal;
  const clampedScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  let tier: PqcAssessment["tier"];
  let status: PqcAssessment["status"];

  if (clampedScore >= 90) {
    tier = "A";
    status = "Quantum-Safe";
  } else if (clampedScore >= 75) {
    tier = "B";
    status = "Transitional";
  } else if (clampedScore >= 50) {
    tier = "C";
    status = "Legacy";
  } else {
    tier = "D";
    status = "Vulnerable";
  }

  return {
    score: clampedScore,
    tier,
    status,
    breakdown: {
      keyExchange: { score: kexScore, max: 40, label: kexLabel, passed: kexPassed },
      symmetric: { score: symScore, max: 30, label: symLabel, passed: symPassed },
      protocol: { score: protoScore, max: 20, label: protoLabel, passed: protoPassed },
      auth: { score: authScore, max: 10, label: authLabel, passed: authPassed },
      penalties,
    }
  };
}
