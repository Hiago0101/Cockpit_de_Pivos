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
};

// Rotas ativas exibidas no painel esquerdo
export const primaryNavigation: NavigationItem[] = [
  { label: "Cockpit", path: "/", icon: CircleGauge },
  { label: "Planejamento", path: "/planejamento", icon: CalendarDays },
  { label: "Safras", path: "/safras", icon: Calendar },
  { label: "Fazendas", path: "/fazendas", icon: Building2 },
  { label: "Talhões", path: "/talhoes", icon: Grid3x3 },
  { label: "Culturas", path: "/culturas", icon: Sprout },
];

export const secondaryNavigation: NavigationItem[] = [
  { label: "Configurações", path: "/configuracoes", icon: Settings },
];

export const BrandIcon = Leaf;

export function getPageTitle(pathname: string) {
  return [...primaryNavigation, ...secondaryNavigation].find((item) => item.path === pathname)?.label ?? "Cockpit";
}