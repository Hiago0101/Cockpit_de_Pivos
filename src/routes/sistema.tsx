import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Server,
  Database,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Layers,
  Smartphone,
  Lock,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, getStoredUser } from "@/services/api";

export const Route = createFileRoute("/sistema")({
  head: () => ({
    meta: [
      { title: "Informações do Sistema — Cockpit de Pivôs" },
      { name: "description", content: "Arquitetura, telemetria e status operacional do Cockpit de Pivôs." },
      { property: "og:title", content: "Informações do Sistema — Cockpit de Pivôs" },
      { property: "og:description", content: "Arquitetura, telemetria e status operacional do Cockpit de Pivôs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SistemaPage,
});

function SistemaPage() {
  const [healthStatus, setHealthStatus] = useState<string>("Verificando...");
  const [isChecking, setIsChecking] = useState(false);
  const user = getStoredUser();

  const checkApi = async () => {
    setIsChecking(true);
    try {
      const res = await api.checkHealth();
      setHealthStatus(res.status === "ok" ? "Operacional (200 OK)" : res.status);
    } catch (err: any) {
      setHealthStatus("Indisponível / Erro de Conexão");
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkApi();
  }, []);

  return (
    <div className="flex-1 space-y-6 p-6 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Informações do Sistema & Diagnósticos
          </h1>
          <p className="text-sm text-muted-foreground">
            Estado da infraestrutura, arquitetura de software e conformidade operacional.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={checkApi}
          disabled={isChecking}
          className="cursor-pointer gap-1.5"
        >
          <RefreshCw className={`size-3.5 ${isChecking ? "animate-spin" : ""}`} />
          Testar Conectividade
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Backend API */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Server className="size-5" />
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                {healthStatus}
              </Badge>
            </div>
            <CardTitle className="text-base mt-2">API Central (Django REST)</CardTitle>
            <CardDescription className="text-xs">
              Serviços RESTful versionados sob /api/v1/
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between border-b border-border/40 pb-1.5">
              <span>Framework:</span>
              <span className="font-semibold text-foreground">Django 5.x / DRF 3.15</span>
            </div>
            <div className="flex justify-between border-b border-border/40 pb-1.5">
              <span>Endpoint de Saúde:</span>
              <span className="font-mono text-[11px] text-foreground">/api/v1/health/</span>
            </div>
            <div className="flex justify-between">
              <span>Status Operacional:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ativo</span>
            </div>
          </CardContent>
        </Card>

        {/* Banco de Dados */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-blue-500/10 text-blue-500">
                <Database className="size-5" />
              </span>
              <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-600 dark:text-blue-400">
                Desenvolvimento Local
              </Badge>
            </div>
            <CardTitle className="text-base mt-2">Banco de Dados</CardTitle>
            <CardDescription className="text-xs">
              Persistência relacional isolada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between border-b border-border/40 pb-1.5">
              <span>Motor Ativo:</span>
              <span className="font-semibold text-foreground">SQLite (Local)</span>
            </div>
            <div className="flex justify-between border-b border-border/40 pb-1.5">
              <span>Arquivo:</span>
              <span className="font-mono text-[11px] text-foreground">backend/db.sqlite3</span>
            </div>
            <div className="flex justify-between">
              <span>SQL Server Corporativo:</span>
              <span className="text-muted-foreground">Fase de Homologação</span>
            </div>
          </CardContent>
        </Card>

        {/* Segurança & RBAC */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-amber-500/10 text-amber-500">
                <ShieldCheck className="size-5" />
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400">
                Ativo & Auditado
              </Badge>
            </div>
            <CardTitle className="text-base mt-2">Segurança & RBAC</CardTitle>
            <CardDescription className="text-xs">
              Controle de acesso baseado em funções e escopo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between border-b border-border/40 pb-1.5">
              <span>Estratégia:</span>
              <span className="font-semibold text-foreground">Token DRF + Revogação</span>
            </div>
            <div className="flex justify-between border-b border-border/40 pb-1.5">
              <span>Perfis:</span>
              <span className="text-foreground">ADMIN, GESTOR, OPERADOR, CONSULTOR</span>
            </div>
            <div className="flex justify-between">
              <span>Restrição por Fazenda:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Habilitada</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Arquitetura Multiplataforma */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Arquitetura da Solução Cockpit de Pivôs</CardTitle>
          <CardDescription className="text-xs">
            Camadas desacopladas preparadas para implantação on-premises e operação em campo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3 text-xs leading-relaxed">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Globe className="size-4 text-primary" />
              Frontend Web
            </div>
            <p className="text-muted-foreground">
              Apresentação reativa construída com React e TanStack Router. Totalmente desacoplada da persistência direta, consumindo a API Central via HTTP/REST.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Smartphone className="size-4 text-blue-500" />
              Aplicativo Mobile (Expo / React Native)
            </div>
            <p className="text-muted-foreground">
              Cliente móvel para operadores de campo, com persistência local SQLite, autenticação segura via SecureStore e fila outbox para apontamentos offline.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Layers className="size-4 text-amber-500" />
              Sincronização & Auditoria
            </div>
            <p className="text-muted-foreground">
              Protocolo de sincronização bidirecional idempotente (/sync/pull/ e /sync/push/) com auditoria completa de comandos e rastreamento de acessos.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}