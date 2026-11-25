import { useMutation } from "@tanstack/react-query";
import type { McpAccess } from "@/components/auth/mcp-access";
import { submitMcpAuthorizationDecision } from "@/fetchers/mcp/submit-authorization-decision";
import { toast } from "@/lib/toast";

export function useMcpAuthorizationDecision() {
  return useMutation({
    mutationFn: ({
      requestId,
      approved,
      access,
    }: {
      requestId: string;
      approved: boolean;
      access?: McpAccess;
    }) => submitMcpAuthorizationDecision(requestId, approved, access),
    onError: (error) => toast.error(error.message),
  });
}
