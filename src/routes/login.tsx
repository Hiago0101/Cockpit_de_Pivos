import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  AlertCircle,
  ArrowRight,
  Building2,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandIcon } from "@/config/navigation";
import loginFields from "@/assets/login-fields.jpg";
import { api } from "@/services/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login Microsoft 365 — Cockpit de Pivôs" },
      { name: "description", content: "Acesso corporativo exclusivo Microsoft 365 ao Cockpit de Pivôs." },
      { property: "og:title", content: "Login Microsoft 365 — Cockpit de Pivôs" },
      { property: "og:description", content: "Acesso corporativo exclusivo Microsoft 365 ao Cockpit de Pivôs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Modo de teste homologado / fallback para desenvolvimento
  const [showDevLogin, setShowDevLogin] = useState(false);
  const [devEmail, setDevEmail] = useState("");

  // Processa tokens retornados via Hash OAuth (se redirect direto do Microsoft 365)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    const search = window.location.search;

    if (hash && hash.includes("access_token=")) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      if (accessToken) {
        handleAzureLogin({ access_token: accessToken });
      }
    } else if (search && search.includes("code=")) {
      const params = new URLSearchParams(search);
      const code = params.get("code");
      if (code) {
        handleAzureLogin({ code });
      }
    }
  }, []);

  const handleAzureLogin = async (payload: { access_token?: string; id_token?: string; code?: string; email?: string }) => {
    setErrorMessage(null);
    setErrorDetails(null);
    setIsLoading(true);

    try {
      await api.loginAzure(payload);
      if (typeof window !== "undefined") {
        localStorage.setItem("cockpit_authenticated", "true");
        // Limpa hash da URL por segurança
        window.history.replaceState(null, "", window.location.pathname);
      }
      navigate({ to: "/" });
    } catch (error: any) {
      const message = error?.message || "Não foi possível validar seu acesso via Microsoft 365.";
      setErrorMessage(message);

      if (message.includes("não possui pré-cadastro") || message.includes("USER_NOT_REGISTERED")) {
        setErrorDetails(
          "Por diretriz de segurança do Grupo Farroupilha, o auto-cadastro é bloqueado. Contate o Administrador de TI para solicitar a inclusão da sua conta."
        );
      } else if (message.includes("Active Directory") || message.includes("bloqueado")) {
        setErrorDetails(
          "Sua conta corporativa consta como inativa ou bloqueada no Microsoft Entra ID (Azure AD). Procure o suporte interno de TI."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMicrosoftLogin = async () => {
    setErrorMessage(null);
    setErrorDetails(null);

    // Consulta configuração do Azure AD
    try {
      const azureConfig = await api.getAzureStatus().catch(() => null);
      const clientId =
        (import.meta.env as Record<string, string>)["VITE_AZURE_CLIENT_ID"] ||
        azureConfig?.client_id;
      const tenantId =
        (import.meta.env as Record<string, string>)["VITE_AZURE_TENANT_ID"] ||
        azureConfig?.tenant_id ||
        "common";
      const currentOriginRedirect =
        typeof window !== "undefined" && window.location.origin
          ? `${window.location.origin}/login`
          : "";

      const redirectUri =
        currentOriginRedirect ||
        (import.meta.env as Record<string, string>)["VITE_AZURE_REDIRECT_URI"] ||
        "http://localhost:8080/login";

      // Se temos App ID configurado no Azure, redireciona para login da Microsoft
      if (clientId && clientId.length > 10 && !clientId.includes("...")) {
        const authUrl =
          `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
          new URLSearchParams({
            client_id: clientId,
            response_type: "token",
            redirect_uri: redirectUri,
            scope: "openid profile email User.Read",
            response_mode: "fragment",
            prompt: "select_account",
          }).toString();

        window.location.href = authUrl;
        return;
      }
    } catch (e) {
      console.warn("Falha ao checar status do Azure:", e);
    }

    // Se o app no Azure ainda não tem o CLIENT_ID preenchido no .env,
    // abre o campo para digitar o e-mail corporativo para validação no backend
    setShowDevLogin(true);
  };

  const handleDevSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = devEmail.trim().toLowerCase();
    if (!clean) {
      setErrorMessage("Por favor, digite seu e-mail corporativo.");
      return;
    }
    handleAzureLogin({ email: clean });
  };

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Banner Visual Superior (Mobile) e Lateral (Desktop) */}
      <section
        className="relative h-[34svh] min-h-60 max-h-[380px] overflow-hidden bg-sidebar lg:h-auto lg:min-h-svh lg:max-h-none"
        aria-label="Área agrícola irrigada por pivô central"
      >
        <img
          src={loginFields}
          width={1536}
          height={1024}
          alt="Vista aérea de lavouras verdes com irrigação por pivô central"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-sidebar/35 lg:bg-sidebar/45 backdrop-blur-[0.5px]" />
        <div className="relative flex h-full flex-col justify-between gap-6 px-6 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] text-sidebar-foreground sm:px-12 lg:min-h-svh lg:p-12">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm lg:size-11">
              <BrandIcon className="size-5.5 lg:size-6" />
            </span>
            <div className="leading-tight">
              <span className="block text-xs font-semibold uppercase tracking-wider lg:text-sm">Gestão agrícola</span>
              <span className="block text-[11px] text-sidebar-foreground/75">Cockpit de Pivôs</span>
            </div>
          </div>

          <div className="max-w-md pb-2 lg:pb-8">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/90 lg:mb-4 lg:text-xs">
              Planejamento · Irrigação · Operação
            </p>
            <h1 className="max-w-64 text-3xl font-semibold leading-tight sm:max-w-none sm:text-4xl lg:text-5xl">
              Cockpit de Pivôs
            </h1>
            <p className="mt-4 hidden max-w-sm text-sm leading-relaxed text-sidebar-foreground/90 lg:block lg:text-base">
              Uma visão integrada do campo, do planejamento à operação em tempo real.
            </p>
          </div>
        </div>
      </section>

      {/* Card de Autenticação Microsoft 365 */}
      <section className="relative -mt-6 flex min-h-[calc(66svh+1.5rem)] min-w-0 flex-col rounded-t-3xl bg-background px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 shadow-2xl sm:px-12 lg:mt-0 lg:min-h-svh lg:rounded-none lg:shadow-none lg:py-10">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-start pb-8 pt-1 lg:justify-center lg:py-12">
          <span className="mb-6 hidden size-12 place-items-center rounded-md bg-accent text-primary lg:grid">
            <BrandIcon className="size-7" />
          </span>
          <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">
            Cockpit de Pivôs — Grupo Farroupilha
          </p>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary lg:hidden">
            <span className="h-px w-6 bg-primary" />
            Acesso Corporativo
          </div>
          <h2 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Acesso Microsoft 365
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Autenticação integrada com conta corporativa Microsoft Entra ID.
          </p>

          {/* Alerta de Erro com Detalhamento de Bloqueio */}
          {errorMessage && (
            <div className="mt-5 space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span className="font-semibold leading-normal break-words">
                  {errorMessage}
                </span>
              </div>
              {errorDetails && (
                <p className="pl-6 text-[11px] text-destructive/80 leading-relaxed">
                  {errorDetails}
                </p>
              )}
            </div>
          )}

          {/* Botão Oficial Microsoft 365 */}
          <div className="mt-8 space-y-4">
            <Button
              type="button"
              disabled={isLoading}
              onClick={handleStartMicrosoftLogin}
              className="h-13 w-full justify-center gap-3 border border-border bg-card text-foreground hover:bg-accent/80 hover:border-primary/50 text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span>Validando conta corporativa...</span>
                </>
              ) : (
                <>
                  <span className="microsoft-mark grid size-4 grid-cols-2 gap-0.5" aria-hidden="true">
                    <span className="bg-[#f25022] rounded-[1px]" />
                    <span className="bg-[#7fba00] rounded-[1px]" />
                    <span className="bg-[#00a4ef] rounded-[1px]" />
                    <span className="bg-[#ffb900] rounded-[1px]" />
                  </span>
                  <span>Entrar com Microsoft 365</span>
                  <ArrowRight className="size-4 text-muted-foreground ml-auto" />
                </>
              )}
            </Button>
          </div>

          {/* Fallback Homologação / Dev para Simulação de E-mail 365 */}
          {showDevLogin && (
            <form onSubmit={handleDevSubmit} className="mt-6 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="dev-email" className="text-xs font-semibold text-primary">
                  Validar E-mail Corporativo (AD 365)
                </Label>
                <span className="text-[10px] text-muted-foreground">Homologação</span>
              </div>
              <Input
                id="dev-email"
                type="email"
                required
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="colaborador@grupofarroupilha.com"
                className="h-10 text-xs bg-background"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-9 text-xs font-semibold gap-1.5 cursor-pointer"
              >
                {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                Confirmar Login com E-mail 365
              </Button>
            </form>
          )}
        </div>

        {/* Rodapé */}
        <footer className="mt-auto flex items-center justify-center gap-2 pt-4 text-[11px] text-muted-foreground lg:text-xs">
          <BrandIcon className="size-3.5 text-primary lg:hidden" />
          <span>Cockpit de Pivôs — Grupo Farroupilha</span>
        </footer>
      </section>
    </main>
  );
}