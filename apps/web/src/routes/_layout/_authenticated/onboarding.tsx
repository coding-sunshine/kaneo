import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import PageTitle from "@/components/page-title";
import createWelcomeWorkspace from "@/fetchers/onboarding/create-welcome-workspace";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { readCheckoutIntent } from "@/lib/checkout-intent";
import { handleUnauthorized, isUnauthorizedError } from "@/lib/http-error";

export const Route = createFileRoute("/_layout/_authenticated/onboarding")({
  beforeLoad: async () => {
    let hasWorkspace = false;
    try {
      hasWorkspace = (await getWorkspaces()).length > 0;
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }
      throw error;
    }
    if (hasWorkspace) {
      throw redirect({ to: "/dashboard" });
    }
    // Someone who came to buy a plan needs the flow's plan step.
    if (readCheckoutIntent()) return;
    // A new hire gets a welcome workspace instead of the setup flow. The
    // server decides who qualifies; anyone else, or a failure, sees the flow.
    const welcome = await createWelcomeWorkspace().catch(() => null);
    if (welcome?.workspaceId) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle title={t("auth:onboarding.pageTitle")} />
      <OnboardingFlow />
    </>
  );
}
