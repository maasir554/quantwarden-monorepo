"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // When the pathname or search params change, navigation is complete
  useEffect(() => {
    setIsNavigating(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [pathname, searchParams]);

  // Intercept all click events on anchor tags
  const handleClick = useCallback((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest("a");
    if (!target) return;

    const href = target.getAttribute("href");
    if (!href) return;

    // Ignore external links, hash links, mailto, tel, blob, javascript
    if (
      href.startsWith("http") ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("blob:") ||
      href.startsWith("javascript:")
    ) return;

    // Ignore links opened in new tabs
    if (target.target === "_blank") return;

    // Ignore if modifier keys pressed (user wants new tab)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    // Ignore links pointing to the current page
    if (href === pathname) return;

    // Start the navigation indicator with a small delay to avoid flicker on fast navigations
    timeoutRef.current = setTimeout(() => {
      setIsNavigating(true);
    }, 120);
  }, [pathname]);

  useEffect(() => {
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [handleClick]);

  if (!isNavigating) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] animate-in fade-in duration-200" />

      {/* Desktop: Top progress bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] overflow-hidden hidden sm:block">
        <div
          className="h-full bg-gradient-to-r from-transparent via-[#8B0000] to-transparent"
          style={{
            width: "40%",
            animation: "nav-progress-slide 0.8s ease-in-out infinite",
          }}
        />
      </div>

      {/* Mobile: Centered spinner */}
      <div className="absolute inset-0 flex items-center justify-center sm:hidden">
        <div className="bg-white/90 border border-amber-500/20 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#8B0000]" />
          <span className="text-sm font-bold text-[#3d200a]">Loading…</span>
        </div>
      </div>

      {/* Keyframe for the sliding bar */}
      <style>{`
        @keyframes nav-progress-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
