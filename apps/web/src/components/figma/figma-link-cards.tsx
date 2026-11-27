import { useMemo } from "react";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { cn } from "@/lib/cn";
import { FigmaLinkCard } from "./figma-link-card";
import { findFigmaUrls } from "./find-figma-urls";

/**
 * Cards for the Figma links in a ticket, comment or document body. Without a
 * Figma token on the server the links stay plain links and nothing is fetched.
 */
export function FigmaLinkCards({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const { data: config } = useGetConfig();
  const { data: workspace } = useActiveWorkspace();
  const urls = useMemo(() => findFigmaUrls(content), [content]);

  if (!config?.hasFigmaPreviews || !workspace?.id || urls.length === 0)
    return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {urls.map((url) => (
        <FigmaLinkCard key={url} workspaceId={workspace.id} url={url} />
      ))}
    </div>
  );
}
