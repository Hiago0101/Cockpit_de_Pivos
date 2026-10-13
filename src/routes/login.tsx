import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  LockKeyhole,
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
      setErrorMessage("Por favor, informe seu usuário de acesso.");
      return;
    }
    if (!password) {
      setErrorMessage("Por favor, digite sua senha.");
      return;
    }

    setIsLoading(true);

    try {
      await api.login(cleanUsername, password);
      if (typeof window !== "undefined") {
        localStorage.setItem("cockpit_authenticated", "true");
      }
      navigate({ to: "/" });
    } catch (error: any) {
      const message =
        error?.message ||
        "Não foi possível autenticar. Verifique seu usuário e senha.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
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
              Uma visão integrada do campo, do planejamento à operação.
            </p>
          </div>
        </div>
      </section>

      {/* Card do Formulário (Com curva arredondada de sobreposição no mobile) */}
      <section className="relative -mt-6 flex min-h-[calc(66svh+1.5rem)] min-w-0 flex-col rounded-t-3xl bg-background px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8 shadow-2xl sm:px-12 lg:mt-0 lg:min-h-svh lg:rounded-none lg:shadow-none lg:py-10">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-start pb-8 pt-1 lg:justify-center lg:py-12">
          <span className="mb-6 hidden size-12 place-items-center rounded-md bg-accent text-primary lg:grid">
            <BrandIcon className="size-7" />
          </span>
          <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">
            Cockpit de Pivôs
          </p>
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary lg:hidden">
            <span className="h-px w-6 bg-primary" />
            Acesso ao Sistema
          </div>
          <h2 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Bem-vindo de volta
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Acesse com seu usuário e senha corporativos.
          </p>

          {/* Alerta de Erro com Ícone Centralizado */}
          {errorMessage && (
            <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span className="font-medium leading-normal break-words">
                {errorMessage}
              </span>
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Campo Usuário */}
            <div className="space-y-1.5">
              <Label htmlFor="login-username" className="text-xs font-medium text-foreground">
                Usuário ou E-mail
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Seu usuário de acesso"
                  className="h-11 pl-10 text-sm bg-background"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password" className="text-xs font-medium text-foreground">
                  Senha
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="h-11 pl-10 pr-10 text-sm bg-background font-mono"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title={showPassword ? "Ocultar senha" : "Exibir senha"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Botão de Entrar */}
            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 h-11 w-full justify-center gap-2 font-semibold text-sm cursor-pointer shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                <>
                  Entrar no Cockpit
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          {/* Divisor Corporativo */}
          <div className="relative my-6 flex items-center justify-center text-xs text-muted-foreground">
            <span className="absolute inset-x-0 h-px bg-border/70" />
            <span className="relative bg-background px-2.5 uppercase tracking-wider text-[10px] font-medium text-muted-foreground">
              ou acesso institucional
            </span>
          </div>

          {/* Botão Microsoft 365 (Fiel ao design original) */}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-center gap-2.5 border-input hover:bg-accent text-xs font-medium cursor-pointer"
            title="Autenticação integrada com conta corporativa Microsoft 365"
            onClick={() => {
              setErrorMessage("O Single Sign-On Microsoft 365 corporativo será ativado na homologação. Utilize seu usuário e senha acima.");
            }}
          >
            <span className="microsoft-mark grid size-3.5 grid-cols-2 gap-0.5" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            <span>Entrar com Microsoft 365</span>
          </Button>

          {/* Informações de Segurança */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground lg:justify-start">
            <LockKeyhole className="size-3.5 text-primary" />
            <span>Acesso seguro com permissões RBAC</span>
          </div>
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