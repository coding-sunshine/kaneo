import type { WorkProjectStatus } from "@/fetchers/work-project/types";

const GREY = "#95a2b3";
const YELLOW = "#f2c94c";
const BLUE = "#5e6ad2";

type WorkProjectStatusIconProps = {
  status: WorkProjectStatus;
  // 0-100; only the in-progress ring fills with it.
  percent?: number;
  className?: string;
};

// 14px glyphs in Linear's project-status vocabulary.
export function WorkProjectStatusIcon({
  status,
  percent = 0,
  className = "size-3.5 shrink-0",
}: WorkProjectStatusIconProps) {
  const svg = (children: React.ReactNode) => (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
  const ring = (color: string, dash?: string) => (
    <circle
      cx="7"
      cy="7"
      r="6"
      stroke={color}
      strokeWidth="1.5"
      strokeDasharray={dash}
    />
  );

  switch (status) {
    case "backlog":
      return svg(ring(GREY, "1.4 1.74"));
    case "planned":
      return svg(ring(GREY));
    case "started":
      return svg(
        <>
          {ring(YELLOW)}
          <circle
            cx="7"
            cy="7"
            r="2"
            stroke={YELLOW}
            strokeWidth="4"
            strokeDasharray={`${(percent / 100) * 12.57} 12.57`}
            transform="rotate(-90 7 7)"
          />
        </>,
      );
    case "paused":
      return svg(
        <>
          {ring(GREY)}
          <path
            d="M5.5 4.5v5M8.5 4.5v5"
            stroke={GREY}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>,
      );
    case "completed":
      return svg(
        <>
          <circle cx="7" cy="7" r="7" fill={BLUE} />
          <path
            d="m4.2 7.2 2 2 3.6-3.8"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>,
      );
    case "canceled":
      return svg(
        <>
          <circle cx="7" cy="7" r="7" fill={GREY} />
          <path
            d="m4.8 4.8 4.4 4.4m0-4.4-4.4 4.4"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>,
      );
  }
}
