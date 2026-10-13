import { useState, useEffect, type ReactNode } from "react";
import { LogOut, Menu, UserCheck, Shield } from "lucide-react";
import { useRouter, useRouterState } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { getPageTitle } from "@/config/navigation";
import { api, getStoredUser, type UserData } from "@/services/api";

function AppHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { toggleSidebar } = useSidebar();
  const router = useRouter();
  const title = getPageTitle(pathname);
  const [user, setUser] = useState<UserData | null>(getStoredUser());
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Carrega dados atualizados do usuário autenticado
    const stored = getStoredUser();
    if (stored) setUser(stored);

    api.getMe()
      .then((data) => setUser(data))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await api.logout();
    } catch {
      // Ignora erro e prossegue com redirecionamento
    } finally {
      setIsLoggingOut(false);
      router.navigate({ to: "/login" });
    }
  };

  const roleDisplay = user?.profile?.role_display || (user?.profile?.role === "ADMIN" ? "Administrador" : "Usuário");

  return (
    <header className="sticky top-0 z-20 grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Abrir ou recolher navegação">
        <Menu />
      </Button>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-muted-foreground">Gestão agrícola</p>
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="flex items-center gap-2.5" aria-label="Status do sistema e usuário">
        {user && (
          <div className="hidden sm:flex items-center gap-2 border-r border-border pr-3">
            <div className="flex flex-col text-right">
              <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                {user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.username}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {roleDisplay}
              </span>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] uppercase font-bold px-1.5 py-0 ${
                user.profile?.role === "ADMIN"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : user.profile?.role === "GESTOR"
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              <Shield className="mr-0.5 size-2.5 inline" />
              {user.profile?.role || "USER"}
            </Badge>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          <span className="hidden text-xs font-medium text-muted-foreground md:inline">Online</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          title="Encerrar sessão"
          aria-label="Encerrar sessão"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="cursor-pointer gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="size-4" />
          <span className="hidden text-xs md:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-workspace">
        <AppHeader />
        <div className="min-w-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}