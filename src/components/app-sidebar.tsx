import { Link, useRouterState } from "@tanstack/react-router";

import { BrandIcon, primaryNavigation, secondaryNavigation } from "@/config/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

function Brand() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Link
      to="/"
      className="flex h-13 min-w-0 items-center justify-start gap-2.5 overflow-hidden px-1"
      aria-label="Cockpit de Pivôs"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        <BrandIcon className="size-4.5" strokeWidth={2.2} />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-bold uppercase text-sidebar-foreground">Cockpit</span>
          <span className="block truncate text-[10px] font-medium uppercase text-sidebar-foreground/65">de Pivôs</span>
        </span>
      )}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { setOpenMobile } = useSidebar();

  const renderItems = (items: typeof primaryNavigation) =>
    items.map((item) => (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton
          asChild
          isActive={pathname === item.path}
          tooltip={item.label}
          className="h-8.5 gap-2.5 px-2.5 text-[13px] text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground"
        >
          <Link to={item.path} onClick={() => setOpenMobile(false)}>
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-2 py-0">
        <Brand />
      </SidebarHeader>
      <SidebarContent className="py-1 px-1">
        <SidebarGroup className="p-1">
          <SidebarGroupLabel className="h-6 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
            Gestão agrícola
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{renderItems(primaryNavigation)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-1.5">
        <SidebarMenu className="gap-0.5">{renderItems(secondaryNavigation)}</SidebarMenu>
        <p className="px-2.5 pb-1 pt-0.5 text-[10px] text-sidebar-foreground/35 group-data-[collapsible=icon]:hidden">
          Interface inicial · v0.1
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}