import { createFileRoute, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { TwoFactorSetupFlow } from "@/components/account/two-factor/two-factor-setup-flow";
import { AuthPage } from "@/components/auth/auth-page";
import PageTitle from "@/components/page-title";
import { authClient } from "@/lib/auth-client";

// Where a session the instance holds to setting up two-factor is sent.
export const Route = createFileRoute("/auth/two-factor-setup")({
  component: TwoFactorSetup,
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data) throw redirect({ to: "/auth/sign-in" });
  },
});

function TwoFactorSetup() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("auth:twoFactor.setupPageTitle")} />
      <AuthPage
        title={t("auth:twoFactor.setupHeading")}
        description={t("auth:twoFactor.setupDescription")}
      >
        <TwoFactorSetupFlow
          // A full load drops the session cached from before setup.
          onDone={() => window.location.assign("/dashboard")}
        />
      </AuthPage>
    </>
  );
}
