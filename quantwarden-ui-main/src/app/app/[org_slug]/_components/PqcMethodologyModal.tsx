import { useState } from "react";
import { ShieldCheck, X, AlertTriangle } from "lucide-react";

export function PqcMethodologyModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [infoTab, setInfoTab] = useState<"score" | "tier">("score");
  const [showPqcInfoTooltip, setShowPqcInfoTooltip] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="pqc-modal-shell relative w-full max-w-2xl shadow-[0_28px_80px_rgba(43,20,0,0.36)] h-[650px] max-h-[85vh] flex flex-col overflow-hidden rounded-[1.25rem]">
          <div className="pqc-modal-header relative border-b border-[#8B0000]/20 flex flex-col z-10 shrink-0">
            <div className="relative px-6 pt-5 pb-3 flex justify-between items-center">
              <h2 className="text-xl font-black text-white flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-white/90" />
                PQC Evaluation Engine
                <div className="relative ml-1 flex items-center">
                  <button
                    type="button"
                    className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                    onMouseEnter={() => setShowPqcInfoTooltip(true)}
                    onMouseLeave={() => setShowPqcInfoTooltip(false)}
                    onClick={() => setShowPqcInfoTooltip((v) => !v)}
                  >
                    <span className="text-[10px] font-black leading-none">?</span>
                  </button>
                  {showPqcInfoTooltip && (
                    <div className="absolute left-0 top-6 z-20 w-[22rem] rounded-xl border border-white/20 bg-[#2b0000]/95 p-3.5 text-xs font-medium leading-relaxed text-red-50 shadow-xl backdrop-blur-md">
                      <p>
                        The Post-Quantum Cryptography score evaluates an asset's TLS configuration out of a maximum of <strong className="text-white">100 points</strong>. The algorithm assigns points based on four core pillars indicating resistance against "Harvest Now, Decrypt Later" strategies.
                      </p>
                    </div>
                  )}
                </div>
              </h2>
              <button 
                onClick={onClose}
                className="text-white/60 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors backdrop-blur-sm shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative flex px-6 gap-2 pb-4">
              <button
                onClick={() => setInfoTab("score")}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  infoTab === "score" ? "bg-white text-[#8B0000] shadow-sm" : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                Score
              </button>
              <button
                onClick={() => setInfoTab("tier")}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  infoTab === "tier" ? "bg-white text-[#8B0000] shadow-sm" : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                Tier
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            {infoTab === "score" ? (
              <>
                <details className="pqc-rule-details pqc-golden-card group rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm" open>
                  <summary className="flex cursor-pointer items-center justify-between bg-white/20 p-4 hover:bg-white/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300/50 flex items-center justify-center font-bold text-sm">1</span>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                        Key Encapsulation Mechanism <span className="text-gray-500 normal-case font-medium ml-1">(Max 40)</span>
                      </h3>
                    </div>
                    <span className="transition group-open:rotate-180 text-gray-400">
                      <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div className="bg-white/70 px-4 py-3 space-y-1 backdrop-blur-md">
                    <div className="flex items-center gap-4 py-2 border-b border-amber-600/15 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-emerald-100 text-emerald-700">+40</div>
                      <p className="text-sm text-gray-700 font-medium">ML-KEM Algorithm natively negotiated.</p>
                    </div>
                    <div className="flex items-center gap-4 py-2 border-b border-amber-600/15 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-emerald-50 text-emerald-600">+20</div>
                      <p className="text-sm text-gray-700 font-medium">ML-KEM supported by server but not negotiated.</p>
                    </div>
                    <div className="flex items-center gap-4 py-2 border-b border-amber-600/15 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-blue-50 text-blue-600">+15</div>
                      <p className="text-sm text-gray-700 font-medium">Strong Classic fallback (x25519, x448, secp384r1+).</p>
                    </div>
                    <div className="flex items-center gap-4 py-2 border-b border-amber-600/15 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-gray-100 text-gray-600">+10</div>
                      <p className="text-sm text-gray-700 font-medium">Standard Classic (secp256r1/DHE).</p>
                    </div>
                  </div>
                </details>

                <details className="pqc-rule-details pqc-golden-card group rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm">
                  <summary className="flex cursor-pointer items-center justify-between bg-white/20 p-4 hover:bg-white/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300/50 flex items-center justify-center font-bold text-sm">2</span>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                        Symmetric Encryption <span className="text-gray-500 normal-case font-medium ml-1">(Max 30)</span>
                      </h3>
                    </div>
                    <span className="transition group-open:rotate-180 text-gray-400">
                      <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div className="bg-white/70 px-4 py-3 space-y-1 backdrop-blur-md">
                    <p className="text-xs text-gray-500 mb-3 ml-2">Grover's algorithm halves effective symmetric key strength, making AES-128 vulnerable.</p>
                    <div className="flex items-center gap-4 py-2 border-b border-amber-600/15 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-emerald-100 text-emerald-700">+30</div>
                      <p className="text-sm text-gray-700 font-medium">AES-256-GCM or ChaCha20-Poly1305.</p>
                    </div>
                    <div className="flex items-center gap-4 py-2 border-b border-amber-600/15 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-blue-50 text-blue-600">+15</div>
                      <p className="text-sm text-gray-700 font-medium">AES-128-GCM.</p>
                    </div>
                  </div>
                </details>

                <details className="pqc-rule-details pqc-golden-card group rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm">
                  <summary className="flex cursor-pointer items-center justify-between bg-white/20 p-4 hover:bg-white/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300/50 flex items-center justify-center font-bold text-sm">3</span>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                        Protocol Version <span className="text-gray-500 normal-case font-medium ml-1">(Max 20)</span>
                      </h3>
                    </div>
                    <span className="transition group-open:rotate-180 text-gray-400">
                      <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div className="bg-white/70 px-4 py-3 space-y-1 backdrop-blur-md">
                    <div className="flex items-center gap-4 py-2 border-b border-amber-600/15 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-emerald-100 text-emerald-700">+20</div>
                      <p className="text-sm text-gray-700 font-medium">TLS 1.3 Available</p>
                    </div>
                    <div className="flex items-center gap-4 py-2 border-b border-amber-600/15 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-blue-50 text-blue-600">+10</div>
                      <p className="text-sm text-gray-700 font-medium">TLS 1.2 Only</p>
                    </div>
                  </div>
                </details>

                <details className="pqc-rule-details pqc-golden-card group rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm">
                  <summary className="flex cursor-pointer items-center justify-between bg-white/20 p-4 hover:bg-white/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300/50 flex items-center justify-center font-bold text-sm">4</span>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                        Authentication <span className="text-gray-500 normal-case font-medium ml-1">(Max 10)</span>
                      </h3>
                    </div>
                    <span className="transition group-open:rotate-180 text-gray-400">
                      <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div className="bg-white/70 px-4 py-3 space-y-1 backdrop-blur-md">
                    <div className="flex items-center gap-4 py-2 border-b border-amber-600/15 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-emerald-100 text-emerald-700">+10</div>
                      <p className="text-sm text-gray-700 font-medium">ECDSA / EdDSA or RSA ≥ 3072</p>
                    </div>
                    <div className="flex items-center gap-4 py-2 border-b border-amber-600/15 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-amber-50 text-amber-600">+5</div>
                      <p className="text-sm text-gray-700 font-medium">RSA 2048-bit</p>
                    </div>
                  </div>
                </details>

                <details className="group border border-red-200/80 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden bg-red-50/40 backdrop-blur-md shadow-sm">
                  <summary className="flex cursor-pointer items-center justify-between bg-red-50/60 p-4 hover:bg-red-50/90 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-white/80 text-red-600 flex items-center justify-center text-xs font-bold border border-red-100"><AlertTriangle className="h-3.5 w-3.5" /></span>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-red-800">
                        Hard Penalties
                      </h3>
                    </div>
                    <span className="transition group-open:rotate-180 text-red-600">
                      <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <div className="bg-white/80 px-4 py-3 border-t border-red-100/50 space-y-1 backdrop-blur-md">
                    <div className="flex items-center gap-4 py-2 border-b border-red-100/60 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-red-100 text-red-700">-50</div>
                      <p className="text-sm text-gray-700 font-medium">Self-Signed Certificate.</p>
                    </div>
                    <div className="flex items-center gap-4 py-2 border-b border-red-100/60 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-red-100 text-red-700">-50</div>
                      <p className="text-sm text-gray-700 font-medium">RSA Key length &lt; 2048 or weak signature (SHA-1).</p>
                    </div>
                    <div className="flex items-center gap-4 py-2 border-b border-red-100/60 last:border-0">
                      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs bg-red-100 text-red-700">-30</div>
                      <p className="text-sm text-gray-700 font-medium">Legacy protocol enabled (TLS 1.0 or TLS 1.1).</p>
                    </div>
                  </div>
                </details>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl bg-white">
                  <div className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-black text-sm bg-emerald-100 text-emerald-700">≥ 90</div>
                  <div>
                    <h3 className="text-base text-gray-900 font-black mb-0.5">Tier A - Quantum-Safe</h3>
                    <p className="text-sm text-gray-500">Asset natively negotiates quantum-resistant key exchanges today.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl bg-white">
                  <div className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-black text-sm bg-blue-100 text-blue-700">≥ 75</div>
                  <div>
                    <h3 className="text-base text-gray-900 font-black mb-0.5">Tier B - Transitional</h3>
                    <p className="text-sm text-gray-500">Asset supports post-quantum capabilities but doesn't default to them.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl bg-white">
                  <div className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-black text-sm bg-amber-100 text-amber-700">≥ 50</div>
                  <div>
                    <h3 className="text-base text-gray-900 font-black mb-0.5">Tier C - Legacy</h3>
                    <p className="text-sm text-gray-500">Asset is dependent entirely on classical cryptography (e.g. elliptic curves).</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 border border-gray-100 rounded-xl bg-white">
                  <div className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-black text-sm bg-red-100 text-red-700">&lt; 50</div>
                  <div>
                    <h3 className="text-base text-gray-900 font-black mb-0.5">Tier D - Vulnerable</h3>
                    <p className="text-sm text-gray-500">Asset suffers from weak symmetric ciphers or severe legacy protocol flaws.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx global>{`
        .pqc-modal-shell {
          border: 1px solid rgba(156, 197, 255, 0.55);
          background-color: rgba(242, 248, 255, 0.95);
          background-image:
            radial-gradient(circle at 1px 1px, rgba(90, 0, 24, 0.42) 1.1px, transparent 1.2px),
            linear-gradient(180deg, rgba(245, 250, 255, 0.97), rgba(252, 254, 255, 0.93));
          background-size: 16px 16px, 100% 100%;
          background-position: 0 0, 0 0;
        }

        .pqc-modal-header {
          background-color: #8b0000;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.11) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.11) 1px, transparent 1px),
            linear-gradient(180deg, rgba(165, 0, 0, 0) 0%, rgba(80, 0, 0, 0.42) 100%);
          background-size: 30px 30px, 30px 30px, 100% 100%;
        }

        .pqc-rule-details[open] > summary {
          background-color: #0f2748 !important;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(180deg, rgba(28, 68, 122, 0) 0%, rgba(8, 22, 45, 0.42) 100%) !important;
          background-size: 26px 26px, 26px 26px, 100% 100% !important;
          border-bottom: 1px solid rgba(191, 219, 254, 0.15) !important;
        }

        .pqc-rule-details[open] > summary h3 {
          color: white !important;
        }

        .pqc-rule-details[open] > summary h3 span {
          color: rgba(255, 255, 255, 0.7) !important;
        }

        .pqc-rule-details[open] > summary span:first-child {
          background-color: rgba(255, 255, 255, 0.15) !important;
          color: white !important;
          border-color: rgba(255, 255, 255, 0.3) !important;
        }

        .pqc-rule-details[open] > summary > span:last-child {
          color: rgba(255, 244, 244, 0.95) !important;
          background-color: transparent !important;
        }

        .pqc-golden-card {
          background: linear-gradient(135deg, rgba(255, 250, 235, 1) 0%, rgba(254, 237, 185, 0.9) 45%, rgba(250, 219, 137, 0.7) 100%);
          border: 1px solid rgba(220, 155, 30, 0.35);
        }

        .pqc-rule-details[open] summary ~ * {
          animation: pqc-details-show 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        @keyframes pqc-details-show {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
