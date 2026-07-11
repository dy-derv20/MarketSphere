import { AlertCircle } from "lucide-react";

// Loading/empty/error treatments shared by MarketSection and NewsSection.
// Deliberately not a spinner: loading renders skeleton cards shaped like
// the real content, so the panel never looks broken while data is in
// flight, and empty/error both keep the same rounded-card language as the
// rest of the dark panel rather than generic browser text.

export function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-[#f4f2ea]/10" />
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-5 text-center text-xs text-zinc-500">
      {message}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[#e2554f]/20 bg-[#e2554f]/[0.06] px-4 py-4 text-xs text-[#e2554f]/90">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
