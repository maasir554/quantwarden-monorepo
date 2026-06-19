"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { pageSizeOptions } from "./asset-explorer-utils";

type AssetExplorerPaginationDockProps = {
  canGoToNextPage: boolean;
  canGoToPreviousPage: boolean;
  commitPageInput: () => void;
  page: number;
  pageEnd: number;
  pageInputValue: string;
  pageSize: number;
  pageStart: number;
  setPage: (value: number | ((current: number) => number)) => void;
  setPageInputValue: (value: string) => void;
  setPageSize: (value: number) => void;
  totalMatch: number;
  totalPages: number;
};

export default function AssetExplorerPaginationDock({
  canGoToNextPage,
  canGoToPreviousPage,
  commitPageInput,
  page,
  pageEnd,
  pageInputValue,
  pageSize,
  pageStart,
  setPage,
  setPageInputValue,
  setPageSize,
  totalMatch,
  totalPages,
}: AssetExplorerPaginationDockProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/75 bg-[rgba(255,248,228,0.82)] px-2.5 py-2 shadow-xl shadow-amber-950/15 backdrop-blur-xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden h-9 items-center rounded-full border border-amber-500/15 bg-white/75 px-3 text-xs font-bold text-[#6d3f1d] sm:flex">
              <span className="text-[#7a1f1f]">{pageStart}</span>
              <span className="mx-1 text-[#8a5d33]/60">-</span>
              <span className="text-[#7a1f1f]">{pageEnd}</span>
              <span className="mx-1.5 text-[#8a5d33]/60">of</span>
              <span className="text-[#7a1f1f]">{totalMatch}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Visible range</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => canGoToPreviousPage && setPage((current) => Math.max(1, current - 1))}
              disabled={!canGoToPreviousPage}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border text-sm shadow-lg shadow-amber-950/10 transition",
                canGoToPreviousPage
                  ? "border-[#7a1f1f]/50 bg-[#7a1f1f] text-white hover:bg-[#671818]"
                  : "border-white/75 bg-white/80 text-[#7a1f1f] opacity-45"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Previous page</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex h-9 items-center gap-2 rounded-full border border-[#163b73]/35 bg-[#163b73]/92 px-3 text-xs font-bold text-white shadow-lg shadow-amber-950/10">
              <span className="whitespace-nowrap text-white/82">Page</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pageInputValue}
                onChange={(event) => setPageInputValue(event.target.value.replace(/\D+/g, ""))}
                onFocus={(event) => event.target.select()}
                onBlur={commitPageInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitPageInput();
                    event.currentTarget.blur();
                  }
                }}
                className="h-6 w-12 rounded-full bg-white/14 px-2 text-center text-xs font-bold text-white outline-none ring-1 ring-white/18 placeholder:text-white/60 focus:bg-white/18 focus:ring-white/30"
                aria-label="Current page number"
              />
              <span className="whitespace-nowrap text-white/82">/ {totalPages}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Jump to page</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => canGoToNextPage && setPage((current) => Math.min(totalPages, current + 1))}
              disabled={!canGoToNextPage}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border text-sm shadow-lg shadow-amber-950/10 transition",
                canGoToNextPage
                  ? "border-[#7a1f1f]/50 bg-[#7a1f1f] text-white hover:bg-[#671818]"
                  : "border-white/75 bg-white/80 text-[#7a1f1f] opacity-45"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Next page</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  const nextPageSize = Number.parseInt(value, 10);
                  if (!pageSizeOptions.includes(nextPageSize)) return;
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 min-w-[132px] rounded-full border-amber-500/20 bg-white/85 px-3 text-xs font-bold shadow-lg shadow-amber-950/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent>Assets per page</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
