/** Linear's stacked-pages artwork for empty document lists. */
export function DocumentsIllustration() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 80 84"
      className="h-[84px] w-20 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="14" width="56" height="66" rx="6" opacity="0.35" />
      <rect x="8" y="9" width="56" height="66" rx="6" opacity="0.55" />
      <rect
        x="16"
        y="3"
        width="56"
        height="66"
        rx="6"
        className="fill-background text-foreground"
      />
      <path
        d="M28 22h32M28 30h32M28 38h32M28 46h20"
        className="text-foreground"
        opacity="0.8"
      />
    </svg>
  );
}
