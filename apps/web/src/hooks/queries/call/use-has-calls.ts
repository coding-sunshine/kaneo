import useGetConfig from "@/hooks/queries/config/use-get-config";

/** Calls exist only when the server has a LiveKit server configured. */
export function useHasCalls() {
  const { data } = useGetConfig();
  return Boolean(data?.hasCalls);
}
