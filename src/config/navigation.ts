import {
  Building2,
  Calendar,
  CalendarDays,
  CircleGauge,
  Grid3x3,
  Leaf,
  Settings,
  Sprout,
  type LucideIcon,
} from "lucide-react";

export type AppPath =
  | "/"
  | "/safras"
  | "/fazendas"
  | "/talhoes"
  | "/culturas"
  | "/mapa"
  | "/planejamento"
  | "/janelas-de-oportunidade"
  | "/calendario"
  | "/irrigacao"
  | "/operacoes"
  | "/alertas"
  | "/indicadores"
  | "/configuracoes"
  | "/sistema";

export type NavigationItem = {
  label: string;
  path: AppPath;
  icon: LucideIcon;
  modulo?: string;
};

// Rotas ativas exibidas no painel esquerdo
export const primaryNavigation: NavigationItem[] = [
  { label: "Cockpit", path: "/", icon: CircleGauge, modulo: "cockpit" },
  { label: "Planejamento", path: "/planejamento", icon: CalendarDays, modulo: "planejamento" },
  { label: "Safras", path: "/safras", icon: Calendar, modulo: "safras" },
  { label: "Fazendas", path: "/fazendas", icon: Building2, modulo: "fazendas" },
  { label: "Talhões", path: "/talhoes", icon: Grid3x3, modulo: "talhoes" },
  { label: "Culturas", path: "/culturas", icon: Sprout, modulo: "culturas" },
];

export const secondaryNavigation: NavigationItem[] = [
  { label: "Usuários & Acessos", path: "/configuracoes", icon: Settings, modulo: "usuarios_grupos" },
];

export const BrandIcon = Leaf;

export function getPageTitle(pathname: string) {
  return [...primaryNavigation, ...secondaryNavigation].find((item) => item.path === pathname)?.label ?? "Cockpit";
}