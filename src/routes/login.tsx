import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BrandIcon } from "@/config/navigation";
import loginFields from "@/assets/login-fields.jpg";
import { api } from "@/services/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Cockpit de Pivôs" },
      { name: "description", content: "Acesso autenticado ao Cockpit de Pivôs." },
      { property: "og:title", content: "Login — Cockpit de Pivôs" },
      { property: "og:description", content: "Acesso autenticado ao Cockpit de Pivôs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMessage("Por favor, informe seu usuário ou e-mail de acesso.");
      return;
    }
    if (!password) {
      setErrorMessage("Por favor, digite sua senha de acesso.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.login(cleanUsername, password);
      // Login validado pelo backend Django REST Framework
      if (typeof window !== "undefined") {
        localStorage.setItem("cockpit_authenticated", "true");
      }
      navigate({ to: "/" });
    } catch (error: any) {
      const message =
        error?.message ||
        "Não foi possível autenticar. Verifique suas credenciais e conexão com o servidor.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Lado Visual Corporativo / Agrícola */}
      <section
        className="relative hidden overflow-hidden bg-sidebar lg:block"
        aria-label="Área agrícola irrigada por pivô central"
      >
        <img
          src={loginFields}
          width={1536}
          height={1024}
          alt="Vista aérea de lavouras verdes com irrigação por pivô central"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-sidebar/55" />
        <div className="relative flex h-full min-h-svh flex-col justify-between p-12 text-sidebar-foreground">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
              <BrandIcon className="size-6" />
            </span>
            <div className="leading-tight">
              <span className="block text-sm font-semibold tracking-wide">COCKPIT DE PIVÔS</span>
              <span className="block text-xs text-sidebar-foreground/75">Controle de Irrigação & Operações</span>
            </div>
          </div>

          <div className="max-w-lg pb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sidebar-foreground/20 bg-sidebar/60 px-3.5 py-1 text-xs font-medium uppercase tracking-wider backdrop-blur-sm text-sidebar-foreground/90">
              <ShieldCheck className="size-3.5 text-primary" />
              Acesso Seguro e Auditado
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Gestão Inteligente de Pivôs Centrais
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-sidebar-foreground/85">
              Monitoramento em tempo real, controle de pressão e lâmina, gestão de janelas tarifárias e sincronização contínua entre campo e escritório.
            </p>
          </div>
        </div>
      </section>

      {/* Formulário de Autenticação */}
      <section className="flex min-h-svh min-w-0 flex-col justify-between px-6 py-8 sm:px-12 sm:py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
              <BrandIcon className="size-5" />
            </span>
            <span className="text-sm font-bold tracking-tight text-foreground uppercase">Cockpit</span>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Building2 className="size-3.5 text-muted-foreground" />
            Ambiente Local Integrado
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Acesso ao Sistema
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Insira suas credenciais de usuário para acessar suas fazendas e equipamentos.
            </p>
          </div>

          {errorMessage && (
            <Alert variant="destructive" className="mb-6 border-destructive/30 bg-destructive/10 text-destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="text-xs font-medium leading-relaxed">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-medium text-foreground">
                Usuário ou E-mail
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Seu usuário ou e-mail"
                  className="pl-9 h-11 text-sm bg-background border-input focus-visible:ring-primary"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-foreground">
                  Senha
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10 h-11 text-sm bg-background border-input focus-visible:ring-primary"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isLoading}
              className="w-full h-11 text-sm font-semibold transition-all shadow-sm cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                "Entrar no Cockpit"
              )}
            </Button>
          </form>

          {/* Opção secundária: SSO Corporativo Microsoft */}
          <div className="mt-8 border-t border-border pt-6">
            <p className="text-center text-xs font-medium text-muted-foreground mb-3">
              Conta Corporativa SSO
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => {
                setErrorMessage(
                  "A autenticação via Microsoft Entra ID (SSO) está reservada para o ambiente corporativo com tenant homologado. Utilize suas credenciais locais para desenvolvimento e testes."
                );
              }}
              className="w-full h-10 justify-center gap-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <span className="microsoft-mark grid size-3.5 shrink-0 grid-cols-2 gap-0.5" aria-hidden="true">
                <span className="bg-[#f25022]" />
                <span className="bg-[#7fba00]" />
                <span className="bg-[#00a4ef]" />
                <span className="bg-[#ffb900]" />
              </span>
              <span>Entrar com Microsoft 365 (SSO)</span>
            </Button>
          </div>
        </div>

        <footer className="text-center text-xs text-muted-foreground border-t border-border/60 pt-4">
          <p>© {new Date().getFullYear()} Cockpit de Pivôs — Todos os acessos são registrados e auditados.</p>
        </footer>
      </section>
    </main>
  );
}