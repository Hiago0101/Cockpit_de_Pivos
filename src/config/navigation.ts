import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CircleGauge,
  CloudSun,
  Droplets,
  Info,
  Leaf,
  Map,
  Settings,
  Sprout,
  Tractor,
  type LucideIcon,
} from "lucide-react";

export type AppPath =
  | "/"
  | "/mapa"
  | "/planejamento"
  | "/janelas-de-oportunidade"
  | "/calendario"
  | "/culturas"
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

export const primaryNavigation: NavigationItem[] = [
  { label: "Cockpit", path: "/", icon: CircleGauge },
  { label: "Mapa dos Pivôs", path: "/mapa", icon: Map },
  { label: "Planejamento", path: "/planejamento", icon: CalendarDays },
  { label: "Janelas de Oportunidade", path: "/janelas-de-oportunidade", icon: CloudSun },
  { label: "Calendário Operacional", path: "/calendario", icon: CalendarDays },
  { label: "Culturas", path: "/culturas", icon: Sprout },
  { label: "Irrigação", path: "/irrigacao", icon: Droplets },
  { label: "Operações", path: "/operacoes", icon: Tractor },
  { label: "Alertas", path: "/alertas", icon: AlertTriangle },
  { label: "Indicadores", path: "/indicadores", icon: BarChart3 },
];

export const secondaryNavigation: NavigationItem[] = [
  { label: "Configurações", path: "/configuracoes", icon: Settings },
  { label: "Informações do Sistema", path: "/sistema", icon: Info },
];

export const BrandIcon = Leaf;

export function getPageTitle(pathname: string) {
  return [...primaryNavigation, ...secondaryNavigation].find((item) => item.path === pathname)?.label ?? "Cockpit";
}