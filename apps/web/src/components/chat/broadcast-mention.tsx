/** @channel or @here in a message, marked so the whole channel notices it. */
export function BroadcastMention({ token }: { token: string }) {
  return (
    <mark className="rounded bg-primary/15 px-0.5 font-medium text-primary">
      {token}
    </mark>
  );
}
