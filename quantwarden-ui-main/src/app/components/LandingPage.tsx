"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import {
  Shield,
  Users,
  Building2,
  ChevronRight,
  FileKey,
  Radar,
  ShieldCheck,
  Clock,
  Key,
  ArrowRight,
  LayoutDashboard,
  CheckCircle,
  XCircle,
  AlertTriangle, Info
} from "lucide-react";

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { data: sessionData } = useSession();
  const isLoggedIn = !!sessionData?.session;

  const domains = [
    "api.company.com", 
    "192.168.1.1", 
    "auth.internal.net", 
    "10.0.0.5",
    "db.secure-prod.io",
    "172.31.254.42",
    "vault.corp.local",
    "203.0.113.15",
    "k8s-cluster.net",
    "10.12.8.200"
  ];
  const [domainIndex, setDomainIndex] = useState(0);

  const scannerRef = useRef<HTMLDivElement>(null);
  const clipLayerRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  
  const posRef = useRef(105);
  const dirRef = useRef(-1);
  const isHoveredRef = useRef(false);

  useEffect(() => {
    let lastTime = performance.now();
    let pauseUntil = 0;
    let reqId: number;

    const loop = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;

      if (!isHoveredRef.current) {
        if (time >= pauseUntil) {
          posRef.current += dirRef.current * 0.018 * dt; // Slower sweep (was 0.03666)
          if (posRef.current <= -5) { 
            posRef.current = -5; 
            dirRef.current = 1; 
            pauseUntil = time + 1500; // Delay before returning
          }
          if (posRef.current >= 105) { 
            posRef.current = 105; 
            dirRef.current = -1; 
            pauseUntil = time + 1500; // Delay before returning
          }
        }
      }

      if (clipLayerRef.current) clipLayerRef.current.style.clipPath = `inset(0 0 0 ${posRef.current}%)`;
      if (lineRef.current) lineRef.current.style.left = `${posRef.current}%`;

      reqId = requestAnimationFrame(loop);
    };
    reqId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqId);
  }, []);

  const handleMouseEnter = () => { isHoveredRef.current = true; };
  const handleMouseLeave = () => { isHoveredRef.current = false; };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!scannerRef.current) return;
    const rect = scannerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    posRef.current = (x / rect.width) * 100;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setDomainIndex((prev) => (prev + 1) % domains.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: FileKey,
      title: "CertIn-CBOM",
      desc: "Maintain a Cryptographic Bill of Materials for your organization as advised by Cert-In (Indian Computer Emergency Response Team) national nodal agency."
    },
    {
      icon: Radar,
      title: "Scan for Assets",
      desc: "Automatically discover subdomains and open ports tied securely to your root domain without manual intervention."
    },
    {
      icon: ShieldCheck,
      title: "Encryption Analysis",
      desc: "Receive actionable safety scores, detect post-quantum cryptography algorithms, grade key sizes, and more."
    },
    {
      icon: Clock,
      title: "Scheduled Scans",
      desc: "Automate continuous monitoring over regular intervals to keep your security posture completely up to date."
    },
    {
      icon: Key,
      title: "Role-Based Access",
      desc: "Delegate tight governance and custom roles, strictly controlled by individual enterprise administrators."
    },
    {
      icon: Building2,
      title: "Join or Create Entities",
      desc: "Login and configure your own enterprise organization, or join an existing one instantly via secure invite link or code."
    }
  ];

  return (
    <div className="relative min-h-screen text-slate-900 font-sans selection:bg-[#8B0000] selection:text-white overflow-x-hidden">
      {/* Background with theme-aligned gradient */}

      <div
        aria-hidden="true"
        className="fixed inset-0 z-[-1] bg-[#fffcf5] opacity-100"
      />

      {/* Sticky Navigation Bar */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 border-b border-transparent ${isScrolled
          ? "py-3 bg-white/70 backdrop-blur-xl border-[#8B0000]/10"
          : "py-6 bg-transparent"
          }`}
      >
        {/* SVG Noise Overlay */}
        <div 
          className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${isScrolled ? "opacity-[0.05]" : "opacity-0"}`}
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 flex items-center justify-between">

          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-[goldenrod]" strokeWidth={3} fill="#8B0000" />
            <div>
              <span className="text-2xl font-extrabold text-[#5f3512] tracking-tight whitespace-nowrap">
                Quant<span className="text-[#8B0000]">Warden</span>
              </span>
            </div>
          </div>

          <div className="[perspective:1000px] h-[40px] flex items-center justify-end min-w-[120px]">
            {isLoggedIn ? (
              <Link
                href="/app"
                className="group flex items-center justify-center px-6 py-2.5 bg-[#8B0000] text-white text-sm font-semibold rounded-full hover:bg-[#730000] shadow-md shadow-[#8B0000]/20 transition-all min-w-[120px]"
              >
                <span key="open-app-nav" className="btn-flip-in flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" /> Open App
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center justify-center px-6 py-2.5 bg-[#8B0000] text-white text-sm font-semibold rounded-full hover:bg-[#730000] shadow-md shadow-[#8B0000]/20 transition-all min-w-[120px]"
              >
                <span key="login-nav" className="btn-flip-in flex items-center gap-2">
                  Login
                </span>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-0 scroll-smooth">

        {/* Hero Section Wrapper */}
        <div className="relative w-full">
          {/* Multi-colored Bottom Glow (Shifted down & focused on corners) */}
          <div className="absolute -bottom-32 -left-20 w-[500px] h-[400px] bg-yellow-400 opacity-30 blur-[120px] pointer-events-none z-0 rounded-full" />
          <div className="absolute -bottom-32 -right-20 w-[500px] h-[400px] bg-pink-600 opacity-30 blur-[120px] pointer-events-none z-0 rounded-full" />
          <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-800 opacity-20 blur-[120px] pointer-events-none z-0 rounded-full" />

          {/* Subtle Bottom-Left Grid */}
          <div
            className="absolute bottom-0 left-0 w-[40vw] h-112 opacity-30 pointer-events-none hidden md:block"
            style={{
              backgroundImage: "linear-gradient(#8B0000 1px, transparent 1px), linear-gradient(90deg, #8B0000 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              WebkitMaskImage: "radial-gradient(circle at bottom left, black 0%, transparent 70%)",
              maskImage: "radial-gradient(circle at bottom left, black 0%, transparent 70%)"
            }}
          />

          {/* Subtle Bottom-Right Grid */}
          <div
            className="absolute bottom-0 right-0 w-[40vw] h-112 opacity-30 pointer-events-none hidden md:block"
            style={{
              backgroundImage: "linear-gradient(#8B0000 1px, transparent 1px), linear-gradient(90deg, #8B0000 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              WebkitMaskImage: "radial-gradient(circle at bottom right, black 0%, transparent 70%)",
              maskImage: "radial-gradient(circle at bottom right, black 0%, transparent 70%)"
            }}
          />

          {/* Hero Section */}
          <section className="relative w-full max-w-7xl mx-auto px-6 sm:px-12 pt-4 pb-12 md:pt-8 md:pb-20 text-center flex flex-col items-center z-10">

            {/* Big Hero Title */}
            <div className="mb-10">
              <h1 className="text-7xl font-black text-[#3d200a] tracking-tighter drop-shadow-sm">
                <span>{"Securing the "}</span>
                <span className="text-[#8B0000]">Future.</span>
              </h1>
            </div>

            {/* Wrapper to handle the overflowing scanner line while maintaining the layout */}
            <div className="relative w-full max-w-[850px] mx-auto hidden md:block py-4">
              {/* Animated Scanner Component */}
              <div 
                ref={scannerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
                className="relative w-full min-h-[220px] font-sans select-none flex justify-center items-center cursor-crosshair"
                style={{ clipPath: "inset(-20px 0px -20px 0px)" }}
              >
                
                {/* Background layers wrapper (enforces rounded corners while letting scanner line break out) */}
                <div className="relative w-full overflow-hidden border border-[#e5d5c5] z-0">

                {/* Lower Layer: Domain / IP (Maroon background with grid & animated text) */}
                <div className="absolute inset-0 z-0 w-full bg-[#7a1818] shadow-inner">
                {/* Subtle White Grid Pattern Overlay */}
                <div 
                  className="absolute inset-0 opacity-40 pointer-events-none"
                  style={{
                    backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                    maskImage: "radial-gradient(circle at center, black 10%, transparent 90%)",
                    WebkitMaskImage: "radial-gradient(circle at center, black 10%, transparent 90%)"
                  }}
                />

                {/* Animated Text Holder with Flip/Scroll effect and top-to-bottom fading */}
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden [perspective:1000px] z-10">
                  <div 
                    key={domainIndex} 
                    className="domain-flip-text text-6xl md:text-7xl lg:text-[4.75rem] font-black tracking-tighter text-center bg-gradient-to-b from-white via-white/80 to-white/0 bg-clip-text text-transparent px-4 py-2 w-full truncate"
                  >
                    {domains[domainIndex]}
                  </div>
                </div>
              </div>

              {/* Upper Layer: Crypto Data Grid (Masked via clip-path) */}
              <div 
                ref={clipLayerRef}
                className="scanner-clip-layer relative z-10 bg-white flex items-center justify-center w-full font-mono"
              >
                <div className="max-w-[800px] w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 border-t border-l border-dashed border-[#8B0000]/30 content-center shrink-0">
                  
                  {/* Signature */}
                  <div className="text-left p-1.5 border-r border-b border-dashed border-[#8B0000]/30 w-full">
                    <div className="flex items-center gap-2 mb-1.5 p-2 -mx-1.5 -mt-1.5 bg-[#8B0000] shadow-sm">
                      <AlertTriangle className="w-4 h-4 text-white stroke-[3] shrink-0" />
                      <h4 className="text-white font-bold text-[12px] tracking-widest uppercase">Signature</h4>
                    </div>
                    <div className="flex flex-col divide-y divide-dashed divide-[#8B0000]/30 w-full">
                      <div className="py-1 first:pt-0 last:pb-0 flex flex-col">
                        <p className="text-[#3d200a] font-extrabold text-[13px] uppercase leading-none flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-500 stroke-[3] shrink-0" />
                          <span className="whitespace-nowrap">RSA-2048</span>
                        </p>
                        <p className="text-amber-600 font-semibold text-[10px] mt-1 ml-5 whitespace-nowrap">Vulnerable to Shor's Algorithm</p>
                        <p className="text-blue-800 font-semibold text-[10px] mt-0.5 ml-5 whitespace-nowrap flex items-center gap-1">
                          <Info className="w-3 h-3 stroke-[3]" /> Migrate to ML-DSA for PQC Safety
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cipher */}
                  <div className="text-left p-1.5 border-r border-b border-dashed border-[#8B0000]/30 w-full">
                    <div className="flex items-center gap-2 mb-1.5 p-2 -mx-1.5 -mt-1.5 bg-[#8B0000] shadow-sm">
                      <AlertTriangle className="w-4 h-4 text-white stroke-[3] shrink-0" />
                      <h4 className="text-white font-bold text-[12px] tracking-widest uppercase">Cipher</h4>
                    </div>
                    <div className="flex flex-col divide-y divide-dashed divide-[#8B0000]/30 w-full">
                      <div className="py-1 first:pt-0 last:pb-0">
                        <p className="text-[#3d200a] font-extrabold text-[13px] uppercase leading-none flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600 stroke-[3] shrink-0" />
                          <span className="whitespace-nowrap">AES-256-GCM</span>
                        </p>
                      </div>
                      <div className="py-1 first:pt-0 last:pb-0 flex flex-col">
                        <p className="text-[#3d200a] font-extrabold text-[13px] uppercase leading-none flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-500 stroke-[3] shrink-0" />
                          <span className="whitespace-nowrap">AES-128-GCM</span>
                        </p>
                        <p className="text-amber-600 font-semibold text-[10px] mt-1 ml-5 whitespace-nowrap">Vulnerable to Grover's Algorithm</p>
                      </div>
                      <div className="py-1 first:pt-0 last:pb-0">
                        <p className="text-[#3d200a] font-extrabold text-[13px] uppercase leading-none flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600 stroke-[3] shrink-0" />
                          <span className="whitespace-nowrap">ChaCha20-Poly1350</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Key Exchange */}
                  <div className="text-left p-1.5 border-r border-b border-dashed border-[#8B0000]/30 w-full">
                    <div className="flex items-center gap-2 mb-1.5 p-2 -mx-1.5 -mt-1.5 bg-[#8B0000] shadow-sm">
                      <CheckCircle className="w-4 h-4 text-white stroke-[3] shrink-0" />
                      <h4 className="text-white font-bold text-[12px] tracking-widest uppercase">Key Exchange</h4>
                    </div>
                    <div className="flex flex-col divide-y divide-dashed divide-[#8B0000]/30 w-full">
                      <div className="py-1 first:pt-0 last:pb-0">
                        <p className="text-[#3d200a] font-extrabold text-[13px] uppercase leading-none flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600 stroke-[3] shrink-0" />
                          <span className="whitespace-nowrap">X25519</span>
                        </p>
                      </div>
                      <div className="py-1 first:pt-0 last:pb-0 flex flex-col">
                        <p className="text-[#3d200a] font-extrabold text-[13px] uppercase leading-none flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600 stroke-[3] shrink-0" />
                          <span className="text-emerald-700 whitespace-nowrap flex items-center">ML-KEM-768 <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-sm ml-2 font-bold uppercase">Negotiated</span></span>
                        </p>
                        <p className="text-blue-800 font-semibold text-[10px] mt-1 ml-5 whitespace-nowrap flex items-center gap-1">
                          <Info className="w-3 h-3 stroke-[3]" /> PQC ready Key exchange
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Protocol */}
                  <div className="text-left p-1.5 border-r border-b border-dashed border-[#8B0000]/30 w-full">
                    <div className="flex items-center gap-2 mb-1.5 p-2 -mx-1.5 -mt-1.5 bg-[#8B0000] shadow-sm">
                      <CheckCircle className="w-4 h-4 text-white stroke-[3] shrink-0" />
                      <h4 className="text-white font-bold text-[12px] tracking-widest uppercase">Protocol</h4>
                    </div>
                    <div className="flex flex-col divide-y divide-dashed divide-[#8B0000]/30 w-full">
                      <div className="py-1 first:pt-0 last:pb-0 flex flex-col">
                        <p className="text-[#3d200a] font-extrabold text-[13px] uppercase leading-none flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600 stroke-[3] shrink-0" />
                          <span className="whitespace-nowrap">TLS 1.3</span>
                        </p>
                        <p className="text-emerald-600 font-semibold text-[10px] mt-1 ml-5 whitespace-nowrap">Perfect Forward Secrecy</p>
                      </div>
                    </div>
                  </div>

                  {/* Open Ports */}
                  <div className="text-left p-1.5 border-r border-b border-dashed border-[#8B0000]/30 w-full">
                    <div className="flex items-center gap-2 mb-1.5 p-2 -mx-1.5 -mt-1.5 bg-[#8B0000] shadow-sm">
                      <CheckCircle className="w-4 h-4 text-white stroke-[3] shrink-0" />
                      <h4 className="text-white font-bold text-[12px] tracking-widest uppercase">Open Ports</h4>
                    </div>
                    <div className="flex flex-col divide-y divide-dashed divide-[#8B0000]/30 w-full">
                      <div className="py-1 first:pt-0 last:pb-0">
                        <p className="text-[#3d200a] font-extrabold text-[13px] uppercase leading-none flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600 stroke-[3] shrink-0" />
                          <span className="whitespace-nowrap">443 (HTTPS)</span>
                        </p>
                      </div>
                      <div className="py-1 first:pt-0 last:pb-0">
                        <p className="text-[#3d200a] font-extrabold text-[13px] uppercase leading-none flex items-center gap-1.5 opacity-60">
                          <CheckCircle className="w-4 h-4 text-slate-500 stroke-[3] shrink-0" />
                          <span className="whitespace-nowrap">80 Protected/Closed</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* PQC Score */}
                  <div className="text-left p-1.5 border-r border-b border-dashed border-[#8B0000]/30 w-full flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-1.5 p-2 -mx-1.5 -mt-1.5 bg-[#8B0000] shadow-sm">
                      <CheckCircle className="w-4 h-4 text-white stroke-[3] shrink-0" />
                      <h4 className="text-white font-bold text-[12px] tracking-widest uppercase">PQC Score</h4>
                    </div>
                    <div className="flex flex-col w-full pl-[26px]">
                      <p className="text-[#3d200a] font-extrabold text-[24px] uppercase leading-none whitespace-nowrap tracking-tight">85<span className="text-[16px] text-slate-500 font-bold">/100</span></p>
                      <p className="text-emerald-600 font-semibold text-[11px] mt-2 whitespace-nowrap">Quantum-Safe Ready</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>

              {/* The Scanner Line Overlay */}
              <div 
                ref={lineRef}
                className="absolute top-0 bottom-0 w-[4px] bg-[#fbca3e] z-30 shadow-[0_0_15px_rgba(251,202,62,0.9)] pointer-events-none"
              >
                {/* Top and Bottom Circles - making them bigger and proportionally offset */}
                <div className="absolute -top-1.5 -left-[5px] w-3.5 h-3.5 rounded-full bg-[#fbca3e] shadow-[0_0_12px_rgba(251,202,62,1)]" />
                <div className="absolute -bottom-2.5 -left-[5px] w-3.5 h-3.5 rounded-full bg-[#fbca3e] shadow-[0_0_12px_rgba(251,202,62,1)]" />
              </div>
            </div>
          </div>
              
              <style dangerouslySetInnerHTML={{__html: `
  .scanner-clip-layer {
    border-left: 1px solid rgba(229, 213, 197, 0.7);
  }
  .domain-flip-text {
    animation: flipDownEffect 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    transform-origin: 50% 0%;
  }
  @keyframes flipDownEffect {
    0% { transform: rotateX(-80deg) translateY(-60px); opacity: 0; filter: blur(4px); }
    100% { transform: rotateX(0deg) translateY(0); opacity: 1; filter: blur(0px); }
  }
  .btn-flip-in {
    animation: btnFlipIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    transform-origin: 50% 0%;
  }
  @keyframes btnFlipIn {
    0% { transform: rotateX(-90deg) translateY(-10px); opacity: 0; }
    100% { transform: rotateX(0deg) translateY(0); opacity: 1; }
  }
`}} />

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#3d200a] mb-6 tracking-tight leading-tight max-w-5xl">
              A Post-Quantum Cryptography <br/> Scanner for Your Team
            </h2>

            <p className="text-sm md:text-md text-[#8a5d33] mb-8 max-w-3xl font-normal leading-relaxed">
              Proactively identify deprecated cryptography algorithms, measure your transition readiness, and effortlessly generate a CertIn-compliant Cryptographic Bill of Materials (CBOM) for your organization from one centralized hub.
            </p>

            <div className="perspective-[1000px] flex items-center justify-center min-h-12">
              {isLoggedIn ? (
                <Link
                  href="/app"
                  className="group flex items-center justify-center px-6 py-3 bg-[#8B0000] text-white rounded-full text-md font-bold shadow-xl shadow-[#8B0000]/30 hover:-translate-y-1 hover:bg-[#730000] transition-all"
                >
                  <span key="open-app-hero" className="btn-flip-in flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5" /> Open App 
                    {/* <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /> */}
                  </span>
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="group flex items-center justify-center px-6 py-3 bg-[#8B0000] text-white rounded-full text-md font-bold shadow-xl shadow-[#8B0000]/30 hover:-translate-y-1 hover:bg-[#730000] transition-all"
                >
                  <span key="signup-hero" className="btn-flip-in flex items-center gap-2">
                    Get Started 
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              )}
            </div>
          </section>
        </div>

        {/* Features Matrix Component */}
        <section className="max-w-7xl mx-auto px-6 sm:px-12 py-20 relative">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#3d200a]">Pioneering Post-Quantum Security</h2>
            <div className="w-16 h-1.5 bg-[#8B0000] mx-auto mt-4 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, idx) => {
              const iconGradientId = `feature-icon-grad-${idx}`;
              const themeStyles = [
                // Current (Amber / Maroon)
                {
                  hoverBorder: "hover:border-amber-300/45",
                  hoverBg: "hover:bg-[linear-gradient(160deg,#fff4d9_0%,#fde68a_38%,#fbbf24_100%)]",
                  shadow: "hover:shadow-[#8B0000]/10",
                  stops: ["#fde68a", "#fbbf24", "#f59e0b"],
                  textAccent: "text-[#8B0000]",
                  textDark: "text-[#5b1f12]",
                  textSubtitle: "text-[#6b2c16]",
                  bubbleBg: "bg-amber-700/30",
                  arrowBg: "bg-[#8B0000]",
                  arrowBorder: "border-[#730000]"
                },
                // Blue
                {
                  hoverBorder: "hover:border-blue-300/45",
                  hoverBg: "hover:bg-[linear-gradient(160deg,#eff6ff_0%,#93c5fd_38%,#3b82f6_100%)]",
                  shadow: "hover:shadow-blue-900/10",
                  stops: ["#bfdbfe", "#60a5fa", "#2563eb"],
                  textAccent: "text-blue-900",
                  textDark: "text-blue-950",
                  textSubtitle: "text-blue-900",
                  bubbleBg: "bg-blue-200",
                  arrowBg: "bg-blue-700",
                  arrowBorder: "border-blue-800"
                },
                // Pink
                {
                  hoverBorder: "hover:border-pink-300/45",
                  hoverBg: "hover:bg-[linear-gradient(160deg,#fdf2f8_0%,#f9a8d4_38%,#ec4899_100%)]",
                  shadow: "hover:shadow-pink-900/10",
                  stops: ["#fbcfe8", "#f472b6", "#db2777"],
                  textAccent: "text-pink-900",
                  textDark: "text-pink-950",
                  textSubtitle: "text-pink-900",
                  bubbleBg: "bg-pink-200",
                  arrowBg: "bg-pink-700",
                  arrowBorder: "border-pink-800"
                },
                // Orange
                {
                  hoverBorder: "hover:border-orange-300/45",
                  hoverBg: "hover:bg-[linear-gradient(160deg,#fff7ed_0%,#fdba74_38%,#f97316_100%)]",
                  shadow: "hover:shadow-orange-900/10",
                  stops: ["#fed7aa", "#fb923c", "#ea580c"],
                  textAccent: "text-orange-900",
                  textDark: "text-orange-950",
                  textSubtitle: "text-orange-900",
                  bubbleBg: "bg-orange-200",
                  arrowBg: "bg-orange-700",
                  arrowBorder: "border-orange-800"
                },
                // Green
                {
                  hoverBorder: "hover:border-green-300/45",
                  hoverBg: "hover:bg-[linear-gradient(160deg,#f0fdf4_0%,#86efac_38%,#22c55e_100%)]",
                  shadow: "hover:shadow-green-900/10",
                  stops: ["#bbf7d0", "#4ade80", "#16a34a"],
                  textAccent: "text-green-900",
                  textDark: "text-green-950",
                  textSubtitle: "text-green-900",
                  bubbleBg: "bg-green-200",
                  arrowBg: "bg-green-700",
                  arrowBorder: "border-green-800"
                },
                // Purple
                {
                  hoverBorder: "hover:border-purple-300/45",
                  hoverBg: "hover:bg-[linear-gradient(160deg,#faf5ff_0%,#d8b4fe_38%,#a855f7_100%)]",
                  shadow: "hover:shadow-purple-900/10",
                  stops: ["#e9d5ff", "#c084fc", "#9333ea"],
                  textAccent: "text-purple-900",
                  textDark: "text-purple-950",
                  textSubtitle: "text-purple-900",
                  bubbleBg: "bg-purple-200",
                  arrowBg: "bg-purple-700",
                  arrowBorder: "border-purple-800"
                }
              ][idx % 6]; // Cycle through the 6 themes based on index

              return (
              <div
                key={idx}
                className={`group rounded-3xl p-8 hover:border bg-transparent backdrop-blur-md transition-all duration-700 ease-out hover:rounded-none hover:shadow-xl hover:-translate-y-0.5 h-72 ${themeStyles.hoverBorder} ${themeStyles.hoverBg} ${themeStyles.shadow}`}
              >
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="grow flex items-center justify-center overflow-hidden transition-all duration-700 ease-out group-hover:grow-0 group-hover:max-h-0">
                    <feat.icon
                      className="w-24 h-24 transition-all duration-700 ease-out group-hover:opacity-0 group-hover:scale-75 group-hover:-translate-y-8"
                      style={{ stroke: `url(#${iconGradientId})` }}
                    >
                      <defs>
                        <linearGradient id={iconGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={themeStyles.stops[0]} />
                          <stop offset="55%" stopColor={themeStyles.stops[1]} />
                          <stop offset="100%" stopColor={themeStyles.stops[2]} />
                        </linearGradient>
                      </defs>
                    </feat.icon>
                  </div>

                  <div className="mt-auto transition-transform duration-700 ease-out group-hover:-translate-y-14">
                    <div className={`flex items-center gap-2 transition-colors duration-700 rounded-full pl-3 ${themeStyles.textAccent} ${themeStyles.bubbleBg} group-hover:bg-transparent p-1`}>
                    <feat.icon className={`w-0 h-0 opacity-0 transition-all duration-600 group-hover:w-5 group-hover:h-5 group-hover:opacity-100 ${themeStyles.textDark}`} />
                      <h3 className="text-xl font-extrabold">{feat.title}</h3>
                    <span className={`ml-auto inline-flex items-center justify-center w-9 h-9 rounded-full border text-white transition-all duration-600 group-hover:opacity-0 group-hover:scale-90 group-hover:-translate-y-1 ${themeStyles.arrowBg} ${themeStyles.arrowBorder}`}>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>

                    <p className={`max-h-0 opacity-0 overflow-hidden leading-relaxed font-normal transition-all duration-700 ease-out group-hover:max-h-40 group-hover:opacity-100 group-hover:mt-4 ${themeStyles.textSubtitle}`}>
                      {feat.desc}
                    </p>
                  </div>
                </div>
              </div>
            )})}
          </div>
        </section>

        {/* CTA Section */}
        <div className="w-full min-h-screen relative bg-[linear-gradient(160deg,#fff7e6_0%,#fde68a_35%,#fbbf24_65%,#f59e0b_100%)] flex flex-col items-center justify-center mt-20">
          <section className="w-full max-w-5xl mx-auto px-6 sm:px-12 py-12 flex flex-col items-center text-center relative z-10">

            <div className="mb-6 flex items-center justify-center">
              <Shield className="h-16 w-16 text-[#8B0000]" strokeWidth={1.5} />
            </div>

            <h2 className="text-3xl md:text-5xl font-extrabold text-[#3d200a] mb-10 tracking-tight">
              Ready to secure your baseline?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-12">
              <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-6 border border-amber-400/50 shadow-lg flex flex-col items-center text-center">
                <div className="bg-[#8B0000]/10 p-3 rounded-full mb-2 text-[#8B0000]">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-[#3d200a] mb-2">Individual Accounts</h3>
                <p className="text-sm text-[#8a5d33] leading-relaxed font-normal">
                  Create an individual identity to manage your personal cryptography baseline securely.
                </p>
              </div>

              <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-6 border border-amber-400/50 shadow-lg flex flex-col items-center text-center">
                <div className="bg-[#8B0000]/10 p-3 rounded-full mb-2 text-[#8B0000]">
                  <Building2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-[#3d200a] mb-2">Organizations</h3>
                <p className="text-sm text-[#8a5d33] leading-relaxed font-normal">
                  Create or join existing organizational teams to share scanning analytics and threat discoveries.
                </p>
              </div>
            </div>

            {isLoggedIn ? (
              <Link
                href="/app"
                className="group flex items-center justify-center gap-2 px-8 py-3.5 bg-[#8B0000] text-white rounded-xl font-semibold shadow-xl shadow-[#8B0000]/30 hover:bg-[#730000] hover:-translate-y-0.5 transition-all"
              >
                <LayoutDashboard className="w-5 h-5" /> Open App
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                <Link
                  href="/signup"
                  className="group flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-[#8B0000] text-white rounded-xl font-semibold shadow-xl shadow-[#8B0000]/30 hover:bg-[#730000] hover:-translate-y-0.5 transition-all"
                >
                  Create Account
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  href="/login"
                  className="flex items-center justify-center w-full sm:w-auto px-8 py-3.5 bg-[#fff7e6] text-[#8B0000] border border-[#8B0000]/20 rounded-xl font-semibold hover:bg-white hover:border-[#8B0000]/40 hover:-translate-y-0.5 shadow-md shadow-[#8B0000]/5 transition-all"
                >
                  Login
                </Link>
              </div>
            )}

          </section>
        </div>

      </main>

      {/* Footer Section */}
      <footer className="relative bg-[#8B0000] py-12 md:py-24 flex flex-col items-center justify-center text-center px-6 overflow-hidden">

        {/* Subtle Corner Fading Grids */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            WebkitMaskImage: "radial-gradient(circle at center, transparent 35%, black 100%)",
            maskImage: "radial-gradient(circle at center, transparent 35%, black 100%)"
          }}
        />

        <p className="text-white/80 text-base md:text-lg font-medium max-w-2xl mx-auto leading-relaxed mb-8 md:mb-12 relative z-10">
          Securing the future of enterprise cryptography against tomorrow&apos;s computational threats.
        </p>

        {/* Massive Gradient Logo Text */}
        <div className="w-full flex justify-center items-center mb-8 md:mb-16 select-none relative z-10 pointer-events-none">
          <h2 className="font-black text-[12vw] leading-none tracking-tighter bg-clip-text text-transparent bg-linear-to-b from-white to-white/10">
            QuantWarden
          </h2>
        </div>

        <p className="text-white/50 text-xs font-mono tracking-widest relative z-10">
          &copy; COPYRIGHT TEAM KEYGEN
        </p>
      </footer>

    </div>
  );
}
