import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  Menu,
  X,
  CircleGauge,
  Building2,
  Grid3x3,
  Calendar,
  Zap,
  RefreshCw,
  LogOut,
  Leaf,
  ChevronRight,
  User as UserIcon,
  Layers,
  AlertCircle,
} from "lucide-react-native";
import { MobilePivot } from "./src/types";
import { PivotsScreen } from "./src/screens/PivotsScreen";
import { PivotDetailScreen } from "./src/screens/PivotDetailScreen";
import { IrrigationFormScreen } from "./src/screens/IrrigationFormScreen";
import { SyncQueueScreen } from "./src/screens/SyncQueueScreen";
import { PlanningScreen } from "./src/screens/PlanningScreen";
import { OpportunitiesScreen } from "./src/screens/OpportunitiesScreen";
import { FarmsScreen } from "./src/screens/FarmsScreen";
import { FieldsScreen } from "./src/screens/FieldsScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { mobileApi, setOnUnauthorized } from "./src/services/api";

type ScreenName =
  | "pivots"
  | "farms"
  | "fields"
  | "planning"
  | "opportunities"
  | "pivot_detail"
  | "irrigation_form"
  | "sync_queue";

const { width } = Dimensions.get("window");

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("App Crash caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#0a1812" />
          <View style={styles.errorIconBox}>
            <AlertCircle size={32} color="#ef4444" />
          </View>
          <Text style={styles.errorTitle}>Falha ao renderizar a tela</Text>
          <Text style={styles.errorMessage}>
            {this.state.error?.message || String(this.state.error) || "Erro inesperado."}
          </Text>
          <TouchableOpacity
            style={styles.errorRetryBtn}
            onPress={() => this.setState({ hasError: false, error: null })}
            activeOpacity={0.8}
          >
            <Text style={styles.errorRetryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppContent />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const [currentScreen, setCurrentScreen] = useState<ScreenName>("pivots");
  const [previousScreen, setPreviousScreen] = useState<ScreenName>("pivots");
  const [selectedPivot, setSelectedPivot] = useState<MobilePivot | undefined>(undefined);
  const [targetFarmIdForFields, setTargetFarmIdForFields] = useState<string | undefined>(undefined);

  // Controle do Menu Lateral (Drawer)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const role = currentUser?.profile?.role || "OPERADOR";
  const roleDisplay = currentUser?.profile?.role_display || role;
  const isConsultor = role === "CONSULTOR";

  // Inicializa e restaura a sessão segura
  useEffect(() => {
    setOnUnauthorized(() => {
      setIsAuthenticated(false);
      setCurrentUser(null);
    });

    const restoreSession = async () => {
      try {
        const { token, user } = await mobileApi.initSession();
        if (token) {
          setIsAuthenticated(true);
          setCurrentUser(user);
          mobileApi.getMe().then((updated) => setCurrentUser(updated)).catch(() => {});
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsInitializing(false);
      }
    };

    restoreSession();
  }, []);

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setCurrentScreen("pivots");
  };

  const handleLogout = async () => {
    setIsDrawerOpen(false);
    await mobileApi.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const handleSelectPivot = (pivot: MobilePivot) => {
    setSelectedPivot(pivot);
    setCurrentScreen("pivot_detail");
  };

  const handleOpenIrrigation = (pivot?: MobilePivot) => {
    if (isConsultor) {
      alert("Acesso de consulta: Consultores não têm permissão para criar apontamentos de irrigação.");
      return;
    }
    if (pivot) setSelectedPivot(pivot);
    setCurrentScreen("irrigation_form");
  };

  const navigateTo = (screen: ScreenName) => {
    setCurrentScreen(screen);
    setIsDrawerOpen(false);
  };

  const getScreenTitle = () => {
    switch (currentScreen) {
      case "pivots":
        return "Cockpit de Pivôs";
      case "farms":
        return "Cadastro de Fazendas";
      case "fields":
        return "Cadastro de Talhões";
      case "planning":
        return "Planejamento de Safras";
      case "opportunities":
        return "Janelas de Oportunidade";
      case "sync_queue":
        return "Fila de Sincronização";
      case "pivot_detail":
        return selectedPivot ? `Pivô ${selectedPivot.codigo}` : "Detalhes do Pivô";
      case "irrigation_form":
        return "Novo Apontamento";
      default:
        return "Cockpit";
    }
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a1812" />
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.splashText}>Cockpit de Pivôs · Carregando...</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0a1812" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1812" />

        {/* TOP HEADER MODERNO (Estilo Cockpit PC adaptado para Mobile) */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeft}>
            {/* Botão para abrir Menu Lateral */}
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => setIsDrawerOpen(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Menu size={22} color="#ffffff" />
            </TouchableOpacity>

            {/* Brand Logo e Nome */}
            <View style={styles.brandContainer}>
              <View style={styles.brandIconBox}>
                <Leaf size={16} color="#10b981" strokeWidth={2.5} />
              </View>
              <View style={styles.brandTitles}>
                <Text style={styles.brandTitleText}>COCKPIT</Text>
                <Text style={styles.brandSubtitleText}>DE PIVÔS</Text>
              </View>
            </View>
          </View>

          {/* Usuário e Role no Header */}
          <View style={styles.headerRight}>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{role}</Text>
            </View>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => setIsDrawerOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.avatarButtonText}>
                {(currentUser?.first_name?.[0] || currentUser?.username?.[0] || "U").toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CONTEÚDO PRINCIPAL (Telas Selecionadas) */}
        <View style={styles.mainContainer}>
          <View style={styles.screenContainer}>
            {currentScreen === "pivots" && (
              <PivotsScreen
                onSelectPivot={handleSelectPivot}
                onOpenSync={() => {
                  setPreviousScreen("pivots");
                  setCurrentScreen("sync_queue");
                }}
                onOpenNewIrrigation={handleOpenIrrigation}
              />
            )}

            {currentScreen === "farms" && (
              <FarmsScreen
                onNavigateToFields={(farmId) => {
                  setTargetFarmIdForFields(farmId);
                  setCurrentScreen("fields");
                }}
              />
            )}

            {currentScreen === "fields" && (
              <FieldsScreen
                onNavigateToFarms={() => setCurrentScreen("farms")}
                initialFarmId={targetFarmIdForFields}
              />
            )}

            {currentScreen === "pivot_detail" && selectedPivot && (
              <PivotDetailScreen
                pivot={selectedPivot}
                onBack={() => setCurrentScreen("pivots")}
                onOpenIrrigationForm={handleOpenIrrigation}
              />
            )}

            {currentScreen === "irrigation_form" && !isConsultor && (
              <IrrigationFormScreen
                pivot={selectedPivot}
                onBack={() => setCurrentScreen(selectedPivot ? "pivot_detail" : "pivots")}
                onSuccess={() => setCurrentScreen("pivots")}
              />
            )}

            {currentScreen === "planning" && (
              <PlanningScreen
                onOpenSync={() => {
                  setPreviousScreen("planning");
                  setCurrentScreen("sync_queue");
                }}
                userRole={role}
              />
            )}

            {currentScreen === "opportunities" && (
              <OpportunitiesScreen
                onOpenSync={() => {
                  setPreviousScreen("opportunities");
                  setCurrentScreen("sync_queue");
                }}
                userRole={role}
              />
            )}

            {currentScreen === "sync_queue" && (
              <SyncQueueScreen onBack={() => setCurrentScreen(previousScreen || "pivots")} />
            )}
          </View>

          {/* BARRA INFERIOR (Atalhos Rápidos Ergonômicos) */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.bottomTab, currentScreen === "pivots" && styles.bottomTabActive]}
              onPress={() => setCurrentScreen("pivots")}
              activeOpacity={0.7}
            >
              <CircleGauge
                size={20}
                color={currentScreen === "pivots" ? "#10b981" : "#64748b"}
              />
              <Text
                style={[
                  styles.bottomTabText,
                  currentScreen === "pivots" && styles.bottomTabTextActive,
                ]}
              >
                Cockpit
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bottomTab, currentScreen === "farms" && styles.bottomTabActive]}
              onPress={() => setCurrentScreen("farms")}
              activeOpacity={0.7}
            >
              <Building2
                size={20}
                color={currentScreen === "farms" ? "#10b981" : "#64748b"}
              />
              <Text
                style={[
                  styles.bottomTabText,
                  currentScreen === "farms" && styles.bottomTabTextActive,
                ]}
              >
                Fazendas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bottomTab, currentScreen === "fields" && styles.bottomTabActive]}
              onPress={() => setCurrentScreen("fields")}
              activeOpacity={0.7}
            >
              <Grid3x3
                size={20}
                color={currentScreen === "fields" ? "#10b981" : "#64748b"}
              />
              <Text
                style={[
                  styles.bottomTabText,
                  currentScreen === "fields" && styles.bottomTabTextActive,
                ]}
              >
                Talhões
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bottomTab, currentScreen === "planning" && styles.bottomTabActive]}
              onPress={() => setCurrentScreen("planning")}
              activeOpacity={0.7}
            >
              <Calendar
                size={20}
                color={currentScreen === "planning" ? "#10b981" : "#64748b"}
              />
              <Text
                style={[
                  styles.bottomTabText,
                  currentScreen === "planning" && styles.bottomTabTextActive,
                ]}
              >
                Planejamento
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bottomTab}
              onPress={() => setIsDrawerOpen(true)}
              activeOpacity={0.7}
            >
              <Menu size={20} color="#64748b" />
              <Text style={styles.bottomTabText}>Menu</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* MENU LATERAL RETRÁTIL (DRAWER ELEGANTE) */}
        <Modal
          visible={isDrawerOpen}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsDrawerOpen(false)}
        >
          <View style={styles.drawerOverlay}>
            <TouchableOpacity
              style={styles.drawerBackdrop}
              activeOpacity={1}
              onPress={() => setIsDrawerOpen(false)}
            />

            <View style={styles.drawerSheet}>
              {/* Header do Drawer */}
              <View style={styles.drawerHeader}>
                <View style={styles.drawerBrandGroup}>
                  <View style={styles.drawerLogoBox}>
                    <Leaf size={18} color="#10b981" strokeWidth={2.5} />
                  </View>
                  <View>
                    <Text style={styles.drawerBrandTitle}>COCKPIT</Text>
                    <Text style={styles.drawerBrandSubtitle}>FARROUPILHA</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.drawerCloseButton}
                  onPress={() => setIsDrawerOpen(false)}
                  activeOpacity={0.7}
                >
                  <X size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Card do Usuário */}
              <View style={styles.drawerUserCard}>
                <View style={styles.drawerUserAvatar}>
                  <Text style={styles.drawerUserAvatarText}>
                    {(currentUser?.first_name?.[0] || currentUser?.username?.[0] || "U").toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerUserName} numberOfLines={1}>
                    {currentUser?.first_name
                      ? `${currentUser.first_name} ${currentUser.last_name || ""}`
                      : currentUser?.username || "Usuário"}
                  </Text>
                  <Text style={styles.drawerUserEmail} numberOfLines={1}>
                    @{currentUser?.username || "usuario"}
                  </Text>
                  <View style={styles.drawerRoleTag}>
                    <Text style={styles.drawerRoleTagText}>{roleDisplay}</Text>
                  </View>
                </View>
              </View>

              {/* Lista de Rotas / Menu */}
              <ScrollView style={styles.drawerScroll} bounces={false}>
                {/* Grupo 1: Gestão Agrícola */}
                <Text style={styles.drawerSectionLabel}>GESTÃO AGRÍCOLA</Text>

                <TouchableOpacity
                  style={[
                    styles.drawerItem,
                    currentScreen === "pivots" && styles.drawerItemActive,
                  ]}
                  onPress={() => navigateTo("pivots")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.drawerItemIcon, currentScreen === "pivots" && styles.drawerItemIconActive]}>
                    <CircleGauge
                      size={18}
                      color={currentScreen === "pivots" ? "#10b981" : "#94a3b8"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.drawerItemText,
                      currentScreen === "pivots" && styles.drawerItemTextActive,
                    ]}
                  >
                    Cockpit (Pivôs)
                  </Text>
                  <ChevronRight size={16} color="#cbd5e1" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.drawerItem,
                    currentScreen === "farms" && styles.drawerItemActive,
                  ]}
                  onPress={() => navigateTo("farms")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.drawerItemIcon, currentScreen === "farms" && styles.drawerItemIconActive]}>
                    <Building2
                      size={18}
                      color={currentScreen === "farms" ? "#10b981" : "#94a3b8"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.drawerItemText,
                      currentScreen === "farms" && styles.drawerItemTextActive,
                    ]}
                  >
                    Cadastro de Fazendas
                  </Text>
                  <ChevronRight size={16} color="#cbd5e1" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.drawerItem,
                    currentScreen === "fields" && styles.drawerItemActive,
                  ]}
                  onPress={() => navigateTo("fields")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.drawerItemIcon, currentScreen === "fields" && styles.drawerItemIconActive]}>
                    <Grid3x3
                      size={18}
                      color={currentScreen === "fields" ? "#10b981" : "#94a3b8"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.drawerItemText,
                      currentScreen === "fields" && styles.drawerItemTextActive,
                    ]}
                  >
                    Cadastro de Talhões
                  </Text>
                  <ChevronRight size={16} color="#cbd5e1" />
                </TouchableOpacity>

                {/* Grupo 2: Operações & Planejamento */}
                <Text style={styles.drawerSectionLabel}>OPERAÇÕES E CAMPO</Text>

                <TouchableOpacity
                  style={[
                    styles.drawerItem,
                    currentScreen === "planning" && styles.drawerItemActive,
                  ]}
                  onPress={() => navigateTo("planning")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.drawerItemIcon, currentScreen === "planning" && styles.drawerItemIconActive]}>
                    <Calendar
                      size={18}
                      color={currentScreen === "planning" ? "#10b981" : "#94a3b8"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.drawerItemText,
                      currentScreen === "planning" && styles.drawerItemTextActive,
                    ]}
                  >
                    Planejamento de Safras
                  </Text>
                  <ChevronRight size={16} color="#cbd5e1" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.drawerItem,
                    currentScreen === "opportunities" && styles.drawerItemActive,
                  ]}
                  onPress={() => navigateTo("opportunities")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.drawerItemIcon, currentScreen === "opportunities" && styles.drawerItemIconActive]}>
                    <Zap
                      size={18}
                      color={currentScreen === "opportunities" ? "#10b981" : "#94a3b8"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.drawerItemText,
                      currentScreen === "opportunities" && styles.drawerItemTextActive,
                    ]}
                  >
                    Janelas de Oportunidade
                  </Text>
                  <ChevronRight size={16} color="#cbd5e1" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.drawerItem,
                    currentScreen === "sync_queue" && styles.drawerItemActive,
                  ]}
                  onPress={() => navigateTo("sync_queue")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.drawerItemIcon, currentScreen === "sync_queue" && styles.drawerItemIconActive]}>
                    <RefreshCw
                      size={18}
                      color={currentScreen === "sync_queue" ? "#10b981" : "#94a3b8"}
                    />
                  </View>
                  <Text
                    style={[
                      styles.drawerItemText,
                      currentScreen === "sync_queue" && styles.drawerItemTextActive,
                    ]}
                  >
                    Sincronização Offline
                  </Text>
                  <ChevronRight size={16} color="#cbd5e1" />
                </TouchableOpacity>
              </ScrollView>

              {/* Rodapé do Drawer com Logout */}
              <View style={styles.drawerFooter}>
                <TouchableOpacity
                  style={styles.drawerLogoutBtn}
                  onPress={handleLogout}
                  activeOpacity={0.7}
                >
                  <LogOut size={18} color="#ef4444" />
                  <Text style={styles.drawerLogoutText}>Sair da Conta</Text>
                </TouchableOpacity>

                <Text style={styles.drawerVersionText}>
                  Cockpit de Pivôs Mobile · v1.0
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0a1812",
  },
  splashContainer: {
    flex: 1,
    backgroundColor: "#0a1812",
    justifyContent: "center",
    alignItems: "center",
  },
  splashText: {
    color: "#a7f3d0",
    fontSize: 13,
    marginTop: 14,
    fontWeight: "600",
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0d1f18",
    borderBottomWidth: 1,
    borderBottomColor: "#17382b",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandIconBox: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  brandTitles: {
    justifyContent: "center",
  },
  brandTitleText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    lineHeight: 15,
  },
  brandSubtitleText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    lineHeight: 11,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleTag: {
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderColor: "rgba(16, 185, 129, 0.35)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  roleTagText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "800",
  },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  screenContainer: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: "row",
    height: 62,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingBottom: 4,
    paddingTop: 6,
  },
  bottomTab: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  bottomTabActive: {
    borderTopWidth: 2,
    borderTopColor: "#10b981",
    marginTop: -6,
    paddingTop: 4,
  },
  bottomTabText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  bottomTabTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  drawerSheet: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.82,
    maxWidth: 320,
    backgroundColor: "#0d1f18",
    borderRightWidth: 1,
    borderRightColor: "#1a3a2e",
    flexDirection: "column",
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#17382b",
  },
  drawerBrandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  drawerLogoBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  drawerBrandTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  drawerBrandSubtitle: {
    color: "rgba(16, 185, 129, 0.9)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  drawerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  drawerUserCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderBottomWidth: 1,
    borderBottomColor: "#17382b",
  },
  drawerUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
  },
  drawerUserAvatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  drawerUserName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  drawerUserEmail: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 1,
  },
  drawerRoleTag: {
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  drawerRoleTagText: {
    color: "#34d399",
    fontSize: 9,
    fontWeight: "800",
  },
  drawerScroll: {
    flex: 1,
    paddingVertical: 12,
  },
  drawerSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 6,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  drawerItemActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderLeftWidth: 3,
    borderLeftColor: "#10b981",
  },
  drawerItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  drawerItemIconActive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  drawerItemText: {
    flex: 1,
    fontSize: 13,
    color: "#cbd5e1",
    fontWeight: "600",
  },
  drawerItemTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#17382b",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    gap: 10,
  },
  drawerLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  drawerLogoutText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "700",
  },
  drawerVersionText: {
    color: "#475569",
    fontSize: 10,
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#0a1812",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  errorRetryBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorRetryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
});
