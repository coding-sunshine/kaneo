/** One label and value row in a pull request's property list (a `<dl>`). */
export function PullRequestProperty({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="flex h-8 items-center text-muted-foreground">{label}</dt>
      <dd className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
        {children}
      </dd>
    </>
  );
}
