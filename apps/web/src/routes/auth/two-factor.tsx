import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { getSafeRedirectPath } from "@/components/auth/auth-methods";
import { authLinkClassName } from "@/components/auth/auth-link-class";
import { AuthPage } from "@/components/auth/auth-page";
import { TwoFactorChallengeForm } from "@/components/auth/two-factor-challenge-form";
import PageTitle from "@/components/page-title";

export const Route = createFileRoute("/auth/two-factor")({
  component: TwoFactor,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
});

function TwoFactor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  return (
    <>
      <PageTitle title={t("auth:twoFactor.pageTitle")} />
      <AuthPage
        title={t("auth:twoFactor.heading")}
        description={t("auth:twoFactor.description")}
      >
        <TwoFactorChallengeForm
          onSuccess={() =>
            navigate({ to: getSafeRedirectPath(redirect) ?? "/dashboard" })
          }
        />
        <p className="pt-8 text-muted-foreground text-sm">
          <Link to="/auth/sign-in" className={authLinkClassName}>
            {t("auth:twoFactor.backToSignIn")}
          </Link>
        </p>
      </AuthPage>
    </>
  );
}
