import { useId } from "react";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: { mark: "h-9 w-[5.25rem]", title: "text-sm", subtitle: "text-[.65rem]" },
  md: { mark: "h-11 w-[6.5rem]", title: "text-base", subtitle: "text-[.7rem]" },
  lg: { mark: "h-14 w-[8.25rem]", title: "text-lg", subtitle: "text-xs" },
};

export function MaLogo({ className, compact = false, inverse = false, size = "md" }: BrandLogoProps) {
  const scale = sizes[size];
  const id = useId().replaceAll(":", "");
  const metalId = `${id}-metal`;
  const orbitId = `${id}-orbit`;
  const shadowId = `${id}-shadow`;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-3", className)} aria-label="MA Maintenance Management System">
      <svg className={cn("shrink-0 overflow-visible", scale.mark)} viewBox="0 0 168 72" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={metalId} x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#dbe7f3" />
            <stop offset="1" stopColor="#8198b3" />
          </linearGradient>
          <linearGradient id={orbitId} x1="0" y1="0" x2="1" y2="0.7">
            <stop offset="0" stopColor="#67e8f9" />
            <stop offset="0.5" stopColor="#1689ea" />
            <stop offset="1" stopColor="#0a4abf" />
          </linearGradient>
          <filter id={shadowId} x="-20%" y="-30%" width="150%" height="170%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#082b58" floodOpacity=".24" />
          </filter>
        </defs>
        <g filter={`url(#${shadowId})`}>
          <path d="M20 49 27 15h12l14 20 17-20h12l-7 34H63l4-19-15 19h-4L37 30l-4 19Z" fill={`url(#${metalId})`} stroke="#7089a5" strokeWidth="1" />
          <path d="m76 49 23-34h12l18 34h-13l-4-8H94l-5 8Zm24-18h8l-3-8Z" fill={`url(#${metalId})`} stroke="#7089a5" strokeWidth="1" fillRule="evenodd" />
          <path d="M10 43c21 17 81 22 124 2 25-12 34-28 20-36-10-6-31-4-48 2 22-4 38-2 43 5 7 10-12 24-31 31C79 62 34 55 10 43Z" fill={`url(#${orbitId})`} />
          <path d="M14 44c23 12 62 15 97 5-35 16-78 13-101 0-7-4-8-9-2-15-2 4 0 7 6 10Z" fill="#c8d7e7" stroke="#8198b3" strokeWidth=".7" />
          <path d="m130 48 9 17h12l-9-22Z" fill={`url(#${metalId})`} stroke="#7089a5" strokeWidth="1" />
        </g>
      </svg>
      {!compact && (
        <span className="min-w-0 leading-none">
          <strong className={cn("block whitespace-nowrap font-bold tracking-[-.02em]", scale.title, inverse ? "text-white" : "text-[#0b2a4a]")}>MA Maintenance</strong>
          <small className={cn("mt-1 block whitespace-nowrap font-medium tracking-[.04em]", scale.subtitle, inverse ? "text-blue-100/75" : "text-slate-500")}>Management System</small>
        </span>
      )}
    </span>
  );
}
