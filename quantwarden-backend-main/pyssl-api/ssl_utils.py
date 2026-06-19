import ssl
import socket
from datetime import datetime, timezone
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa, ec, dsa, ed25519, ed448
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.x509.oid import NameOID, ExtensionOID, SignatureAlgorithmOID

from models import (
    SSLAnalysisResponse, ConnectionInfo, ProtocolInfo, CipherSuiteInfo,
    CertificateInfo, SubjectInfo, IssuerInfo, ValidityInfo, AlgorithmInfo,
    PublicKeyInfo, ExtensionsInfo, AuthorityInfoAccessInfo,
    AlgorithmDetectedInfo, SecurityAnalysisInfo
)

def analyze_ssl(domain: str) -> SSLAnalysisResponse:
    # Set default port
    port = 443
    timeout = 10.0

    context = ssl.create_default_context()
    # We want to get the raw certificate, so we can check it even if it's invalid (expired, etc)
    # wait, if we want to check if certificate is valid natively, check_hostname and verify_mode = CERT_REQUIRED
    # If it fails verification, it throws ssl.SSLCertVerificationError.
    # To get certificate details even on expiration, we might need CERT_NONE, but we want to know if it's valid.
    # Approach: Connect with verification to test validity, if it fails, capture error, connect without verification to get cert details.
    
    certificate_valid = True
    warnings = []
    
    # Try verifying first
    try:
         with socket.create_connection((domain, port), timeout=timeout) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                pass
    except ssl.SSLCertVerificationError as e:
        certificate_valid = False
        warnings.append(f"Certificate validation failed: {str(e)}")
    except Exception as e:
        # We will let the generic connection with CERT_NONE handle actual connection errors
        pass
        
    # Now connect without verification to always get the cert data
    unverified_context = ssl.create_default_context()
    unverified_context.check_hostname = False
    unverified_context.verify_mode = ssl.CERT_NONE

    with socket.create_connection((domain, port), timeout=timeout) as sock:
        with unverified_context.wrap_socket(sock, server_hostname=domain) as ssock:
            
            # 1. Connection Info
            tls_version = ssock.version() or "Unknown"
            cipher_info = ssock.cipher()
            cipher_name = cipher_info[0] if cipher_info else "Unknown"
            tls_version_secure = tls_version in ["TLSv1.2", "TLSv1.3"]
            if not tls_version_secure:
                warnings.append(f"Insecure TLS version used: {tls_version}")

            # 2. Extract Certificate
            der_cert = ssock.getpeercert(binary_form=True)
            if not der_cert:
                raise ValueError("No certificate provided by the server.")

    # Parse the certificate
    cert = x509.load_der_x509_certificate(der_cert, default_backend())

    self_signed_cert = is_self_signed_certificate(cert)
    if self_signed_cert:
        warnings.append("Certificate appears to be self-signed.")

    # Validity
    not_valid_before = cert.not_valid_before_utc
    not_valid_after = cert.not_valid_after_utc
    now = datetime.now(timezone.utc)
    days_remaining = (not_valid_after - now).days

    if days_remaining <= 0:
        certificate_valid = False
        if "Certificate expired" not in warnings:
            warnings.append("Certificate is expired.")
    elif days_remaining < 30:
        warnings.append(f"Certificate expires soon ({days_remaining} days).")

    # Subject and Issuer
    def get_name_attributes(name_obj) -> dict:
        attrs = {
            "CN": NameOID.COMMON_NAME,
            "O": NameOID.ORGANIZATION_NAME,
            "OU": NameOID.ORGANIZATIONAL_UNIT_NAME,
            "C": NameOID.COUNTRY_NAME,
            "ST": NameOID.STATE_OR_PROVINCE_NAME,
            "L": NameOID.LOCALITY_NAME,
        }
        result = {}
        for key, oid in attrs.items():
            vals = name_obj.get_attributes_for_oid(oid)
            result[key] = vals[0].value if vals else None
        
        # Build full DN
        dn_parts = []
        for attr in name_obj:
            dn_parts.append(f"{attr.oid._name}={attr.value}")
        result["full_dn"] = ", ".join(dn_parts)
        return result

    subject_attrs = get_name_attributes(cert.subject)
    issuer_attrs = get_name_attributes(cert.issuer)

    subject_info = SubjectInfo(
        common_name=subject_attrs["CN"],
        organization=subject_attrs["O"],
        organizational_unit=subject_attrs["OU"],
        country=subject_attrs["C"],
        state=subject_attrs["ST"],
        locality=subject_attrs["L"],
        full_dn=subject_attrs["full_dn"]
    )

    issuer_info = IssuerInfo(
        common_name=issuer_attrs["CN"],
        organization=issuer_attrs["O"],
        full_dn=issuer_attrs["full_dn"]
    )

    # Public Key
    public_key = cert.public_key()
    pub_algo = "Unknown"
    pub_size = 0
    exponent = None
    key_size_adequate = False
    classical_sec_level = "Unknown"

    if isinstance(public_key, rsa.RSAPublicKey):
        pub_algo = "RSA"
        pub_size = public_key.key_size
        exponent = public_key.public_numbers().e
        classical_sec_level = f"{pub_size} bits"
        key_size_adequate = pub_size >= 2048
    elif isinstance(public_key, ec.EllipticCurvePublicKey):
        pub_algo = "EC"
        pub_size = public_key.curve.key_size
        classical_sec_level = f"{pub_size} bits (curve {public_key.curve.name})"
        key_size_adequate = pub_size >= 256
    elif isinstance(public_key, dsa.DSAPublicKey):
        pub_algo = "DSA"
        pub_size = public_key.key_size
        classical_sec_level = f"{pub_size} bits"
        key_size_adequate = pub_size >= 2048
    elif isinstance(public_key, ed25519.Ed25519PublicKey):
        pub_algo = "Ed25519"
        pub_size = 256
        classical_sec_level = "256 bits Equivalent"
        key_size_adequate = True
    elif isinstance(public_key, ed448.Ed448PublicKey):
        pub_algo = "Ed448"
        pub_size = 448
        classical_sec_level = "448 bits Equivalent"
        key_size_adequate = True

    if not key_size_adequate:
        warnings.append(f"Inadequate key size: {pub_algo} {pub_size} bits.")

    public_key_info = PublicKeyInfo(
        algorithm=pub_algo,
        size=pub_size,
        exponent=exponent
    )

    # Signature Algorithm
    sig_algo_name = cert.signature_hash_algorithm.name if cert.signature_hash_algorithm else "Unknown"
    if sig_algo_name == "Unknown":
        if cert.signature_algorithm_oid == SignatureAlgorithmOID.RSA_WITH_SHA256:
            sig_algo_name = "sha256WithRSAEncryption"
            
    # Try getting the exact signature OID and string representation
    sig_oid = cert.signature_algorithm_oid.dotted_string
    sig_algo_info = AlgorithmInfo(
        name=sig_algo_name,
        primitive="signature",
        oid=sig_oid
    )

    # Extensions
    sans = []
    try:
        ext = cert.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
        sans = [name.value for name in ext.value]
    except x509.ExtensionNotFound:
         pass

    key_usage = []
    try:
        ext = cert.extensions.get_extension_for_oid(ExtensionOID.KEY_USAGE)
        ku = ext.value
        if ku.digital_signature: key_usage.append("digitalSignature")
        if ku.content_commitment: key_usage.append("nonRepudiation")
        if ku.key_encipherment: key_usage.append("keyEncipherment")
        if ku.data_encipherment: key_usage.append("dataEncipherment")
        if ku.key_agreement: key_usage.append("keyAgreement")
        if ku.key_cert_sign: key_usage.append("keyCertSign")
        if ku.crl_sign: key_usage.append("cRLSign")
    except x509.ExtensionNotFound:
        pass

    eku = []
    try:
        ext = cert.extensions.get_extension_for_oid(ExtensionOID.EXTENDED_KEY_USAGE)
        for usage in ext.value:
            eku.append(usage._name)
    except x509.ExtensionNotFound:
        pass

    basic_constraints = "CA:FALSE"
    try:
        ext = cert.extensions.get_extension_for_oid(ExtensionOID.BASIC_CONSTRAINTS)
        bc = ext.value
        basic_constraints = f"CA:{'TRUE' if bc.ca else 'FALSE'}"
    except x509.ExtensionNotFound:
        pass

    crl_dp = []
    try:
        ext = cert.extensions.get_extension_for_oid(ExtensionOID.CRL_DISTRIBUTION_POINTS)
        for dp in ext.value:
            for fullname in dp.full_name or []:
                 crl_dp.append(fullname.value)
    except x509.ExtensionNotFound:
        pass

    aia_ocsp = []
    aia_ca = []
    try:
        ext = cert.extensions.get_extension_for_oid(ExtensionOID.AUTHORITY_INFORMATION_ACCESS)
        for desc in ext.value:
            if desc.access_method == x509.AuthorityInformationAccessOID.OCSP:
                aia_ocsp.append(desc.access_location.value)
            elif desc.access_method == x509.AuthorityInformationAccessOID.CA_ISSUERS:
                 aia_ca.append(desc.access_location.value)
    except x509.ExtensionNotFound:
        pass

    extensions_info = ExtensionsInfo(
        subject_alternative_names=sans,
        key_usage=key_usage,
        extended_key_usage=eku,
        basic_constraints=basic_constraints,
        crl_distribution_points=crl_dp,
        authority_information_access=AuthorityInfoAccessInfo(ocsp=aia_ocsp, ca_issuers=aia_ca)
    )

    cert_info = CertificateInfo(
        name=subject_info.common_name or subject_info.organization or "Unknown",
        subject=subject_info,
        issuer=issuer_info,
        validity=ValidityInfo(
            not_valid_before=not_valid_before.isoformat().replace("+00:00", "Z"),
            not_valid_after=not_valid_after.isoformat().replace("+00:00", "Z"),
            days_remaining=days_remaining
        ),
        signature_algorithm=sig_algo_info,
        public_key=public_key_info,
        serial_number=str(cert.serial_number),
        version=cert.version.value,
        extensions=extensions_info
    )

    # Algorithms Detected
    algorithms = []
    # Connection Cipher Algo
    parts = cipher_name.split("-")
    enc_algo = None
    kx = None
    mac = None
    if parts:
         enc_algo = "-".join(parts)
    
    # Try to parse OpenSSL cipher suite strings heuristically 
    # e.g., TLS_AES_256_GCM_SHA384 or ECDHE-RSA-AES256-GCM-SHA384
    mode = None
    if "GCM" in cipher_name:
         mode = "gcm"
    elif "CBC" in cipher_name:
         mode = "cbc"
    elif "CCM" in cipher_name:
         mode = "ccm"
         
    strong_cipher = True
    if "RC4" in cipher_name or "DES" in cipher_name or "MD5" in cipher_name:
        strong_cipher = False
        warnings.append(f"Weak cipher suite detected: {cipher_name}")
    elif mode == "cbc" and tls_version_secure and tls_version != "TLSv1.3":
        # CBC handles poorly in TLS 1.2 sometimes, but we'll focus on really weak ones above
        pass
        
    algorithms.append(AlgorithmDetectedInfo(
        name=cipher_name,
        primitive="encryption",
        mode=mode,
        classical_security_level="256 bits" if "256" in cipher_name else "128 bits" if "128" in cipher_name else "Unknown"
    ))
    
    # Signature Algo
    algorithms.append(AlgorithmDetectedInfo(
        name=sig_algo_name,
        primitive="signature",
        mode=None,
        classical_security_level=classical_sec_level
    ))

    # Compile the final response
    return SSLAnalysisResponse(
        domain=domain,
        timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        connection_info=ConnectionInfo(
            protocol=ProtocolInfo(
                version=tls_version,
                cipher_suite=CipherSuiteInfo(
                    name=cipher_name,
                    encryption_algorithm=cipher_name,  # simplified
                    key_exchange="Unknown",            # simplified
                    mac_algorithm="Unknown"            # simplified
                )
            )
        ),
        certificate=cert_info,
        algorithms_detected=algorithms,
        security_analysis=SecurityAnalysisInfo(
            tls_version_secure=tls_version_secure,
            certificate_valid=certificate_valid,
            strong_cipher=strong_cipher,
            key_size_adequate=key_size_adequate,
            self_signed_cert=self_signed_cert,
            warnings=warnings
        )
    )


def is_self_signed_certificate(cert: x509.Certificate) -> bool:
    if cert.issuer != cert.subject:
        return False

    public_key = cert.public_key()
    try:
        if isinstance(public_key, rsa.RSAPublicKey):
            public_key.verify(
                cert.signature,
                cert.tbs_certificate_bytes,
                padding.PKCS1v15(),
                cert.signature_hash_algorithm,
            )
        elif isinstance(public_key, ec.EllipticCurvePublicKey):
            public_key.verify(
                cert.signature,
                cert.tbs_certificate_bytes,
                ec.ECDSA(cert.signature_hash_algorithm),
            )
        elif isinstance(public_key, dsa.DSAPublicKey):
            public_key.verify(
                cert.signature,
                cert.tbs_certificate_bytes,
                cert.signature_hash_algorithm,
            )
        elif isinstance(public_key, ed25519.Ed25519PublicKey) or isinstance(public_key, ed448.Ed448PublicKey):
            public_key.verify(cert.signature, cert.tbs_certificate_bytes)
        else:
            return False

        return True
    except Exception:
        return False
