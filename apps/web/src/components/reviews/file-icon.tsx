import { File, FileImage, FileText } from "lucide-react";

const IMAGE = /\.(png|jpe?g|gif|webp|svg|ico|avif)$/i;

/** Linear marks a PDF and an image with their own icon; anything else is a plain file. */
export function FileIcon({ filename }: { filename: string }) {
  const className = "size-3.5 shrink-0 text-muted-foreground";
  if (/\.pdf$/i.test(filename))
    return <FileText aria-hidden className={className} />;
  if (IMAGE.test(filename))
    return <FileImage aria-hidden className={className} />;
  return <File aria-hidden className={className} />;
}
