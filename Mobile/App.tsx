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
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  Menu,
  X,
  CircleGauge,
  CalendarDays,
  Calendar,
  Building2,
  Grid3x3,
  Sprout,
  RefreshCw,
  Settings,
  LogOut,
  Leaf,
  ChevronRight,
  AlertCircle,
  Server,
  Check,
} from "lucide-react-native";
import { SyncQueueScreen } from "./src/screens/SyncQueueScreen";
import { PlanningScreen } from "./src/screens/PlanningScreen";
import { FarmsScreen } from "./src/screens/FarmsScreen";
import { FieldsScreen } from "./src/screens/FieldsScreen";
import { SeasonsScreen } from "./src/screens/SeasonsScreen";
import { CropsScreen } from "./src/screens/CropsScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { mobileApi, setOnUnauthorized, getApiUrl, setApiUrl } from "./src/services/api";

type ScreenName =
  | "cockpit"
  | "planning"
  | "seasons"
  | "farms"
  | "fields"
  | "crops"
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
          <StatusBar barStyle="light-content" backgroundColor="#0d281e" />
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

  // Tela padrão: Cockpit Operacional (Gantt)
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("cockpit");
  const [previousScreen, setPreviousScreen] = useState<ScreenName>("cockpit");
  const [targetFarmIdForFields, setTargetFarmIdForFields] = useState<string | undefined>(undefined);

  // Controle do Menu Lateral (Drawer) e Modal de Configurações
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState(getApiUrl());
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);

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
    setCurrentScreen("cockpit");
  };

  const handleLogout = async () => {
    setIsDrawerOpen(false);
    await mobileApi.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const navigateTo = (screen: ScreenName) => {
    setCurrentScreen(screen);
    setIsDrawerOpen(false);
  };

  const handleSaveApiUrl = async () => {
    if (!customApiUrl.trim()) return;
    await setApiUrl(customApiUrl.trim());
    setSettingsFeedback("URL da API atualizada com sucesso!");
    setTimeout(() => setSettingsFeedback(null), 3000);
  };

  const handleTestApiConnection = async () => {
    setIsTestingApi(true);
    setSettingsFeedback(null);
    try {
      if (customApiUrl.trim()) {
        await setApiUrl(customApiUrl.trim());
      }
      await mobileApi.checkHealth();
      setSettingsFeedback("✓ Conexão bem-sucedida com a API!");
    } catch (err: any) {
      setSettingsFeedback(`❌ Inacessível: ${err.message}`);
    } finally {
      setIsTestingApi(false);
    }
  };

  const getScreenTitle = () => {
    switch (currentScreen) {
      case "cockpit":
        return "Cockpit";
      case "planning":
        return "Planejamento";
      case "seasons":
        return "Safras";
      case "farms":
        return "Fazendas";
      case "fields":
        return "Talhões";
      case "crops":
        return "Culturas";
      case "sync_queue":
        return "Sincronização Offline";
      default:
        return "Cockpit";
    }
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0d281e" />
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.splashText}>Cockpit de Pivôs · Carregando...</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0d281e" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0d281e" />

      {/* TOP HEADER MODERNO — DESIGN IDÊNTICO AO NAVEGADOR (Com ícone de 3 traços no topo) */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          {/* Botão de 3 traços para abrir o Menu Lateral */}
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setIsDrawerOpen(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Menu size={22} color="#ffffff" strokeWidth={2.2} />
          </TouchableOpacity>

          {/* Marca / Logo Idêntica ao Navegador */}
          <TouchableOpacity
            style={styles.brandContainer}
            onPress={() => navigateTo("cockpit")}
            activeOpacity={0.8}
          >
            <View style={styles.brandIconBox}>
              <Leaf size={16} color="#10b981" strokeWidth={2.4} />
            </View>
            <View style={styles.brandTitles}>
              <Text style={styles.brandTitleText}>COCKPIT</Text>
              <Text style={styles.brandSubtitleText}>DE PIVÔS</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTEÚDO PRINCIPAL (100% da Altura sem Barra Inferior) */}
      <View style={styles.mainContainer}>
        <View style={styles.screenContainer}>
          {/* 1. Cockpit: Mapa de Gantt Operacional em Tela Cheia */}
          {currentScreen === "cockpit" && (
            <PlanningScreen
              initialViewMode="GANTT"
              onOpenSync={() => {
                setPreviousScreen("cockpit");
                setCurrentScreen("sync_queue");
              }}
              userRole={role}
            />
          )}

          {/* 2. Planejamento: Lista Detalhada de Planos e Cadastros */}
          {currentScreen === "planning" && (
            <PlanningScreen
              initialViewMode="LISTA"
              onOpenSync={() => {
                setPreviousScreen("planning");
                setCurrentScreen("sync_queue");
              }}
              userRole={role}
            />
          )}

          {/* 3. Safras */}
          {currentScreen === "seasons" && <SeasonsScreen />}

          {/* 4. Fazendas */}
          {currentScreen === "farms" && (
            <FarmsScreen
              onNavigateToFields={(farmId) => {
                setTargetFarmIdForFields(farmId);
                setCurrentScreen("fields");
              }}
            />
          )}

          {/* 5. Talhões */}
          {currentScreen === "fields" && (
            <FieldsScreen
              onNavigateToFarms={() => setCurrentScreen("farms")}
              initialFarmId={targetFarmIdForFields}
            />
          )}

          {/* 6. Culturas */}
          {currentScreen === "crops" && <CropsScreen />}

          {/* 7. Sincronização Offline */}
          {currentScreen === "sync_queue" && (
            <SyncQueueScreen onBack={() => setCurrentScreen(previousScreen || "cockpit")} />
          )}
        </View>
      </View>

      {/* MENU LATERAL RETRÁTIL (DRAWER) — MENUS IGUAIS AO NAVEGADOR WEB */}
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
                  <Text style={styles.drawerBrandSubtitle}>DE PIVÔS</Text>
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
                    ? `${currentUser.first_name} ${currentUser.last_name || ""}`.trim()
                    : currentUser?.username || "Usuário"}
                </Text>
                <View style={styles.drawerRoleTag}>
                  <Text style={styles.drawerRoleTagText}>{roleDisplay}</Text>
                </View>
              </View>
            </View>

            {/* Lista de Rotas — Idêntica ao Navegador (Sidebar) */}
            <ScrollView style={styles.drawerScroll} bounces={false}>
              {/* GRUPO 1: GESTÃO AGRÍCOLA */}
              <Text style={styles.drawerSectionLabel}>GESTÃO AGRÍCOLA</Text>

              <TouchableOpacity
                style={[
                  styles.drawerItem,
                  currentScreen === "cockpit" && styles.drawerItemActive,
                ]}
                onPress={() => navigateTo("cockpit")}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerItemIcon, currentScreen === "cockpit" && styles.drawerItemIconActive]}>
                  <CircleGauge
                    size={18}
                    color={currentScreen === "cockpit" ? "#10b981" : "#94a3b8"}
                  />
                </View>
                <Text
                  style={[
                    styles.drawerItemText,
                    currentScreen === "cockpit" && styles.drawerItemTextActive,
                  ]}
                >
                  Cockpit
                </Text>
                <ChevronRight size={16} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.drawerItem,
                  currentScreen === "planning" && styles.drawerItemActive,
                ]}
                onPress={() => navigateTo("planning")}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerItemIcon, currentScreen === "planning" && styles.drawerItemIconActive]}>
                  <CalendarDays
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
                  Planejamento
                </Text>
                <ChevronRight size={16} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.drawerItem,
                  currentScreen === "seasons" && styles.drawerItemActive,
                ]}
                onPress={() => navigateTo("seasons")}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerItemIcon, currentScreen === "seasons" && styles.drawerItemIconActive]}>
                  <Calendar
                    size={18}
                    color={currentScreen === "seasons" ? "#10b981" : "#94a3b8"}
                  />
                </View>
                <Text
                  style={[
                    styles.drawerItemText,
                    currentScreen === "seasons" && styles.drawerItemTextActive,
                  ]}
                >
                  Safras
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
                  Fazendas
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
                  Talhões
                </Text>
                <ChevronRight size={16} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.drawerItem,
                  currentScreen === "crops" && styles.drawerItemActive,
                ]}
                onPress={() => navigateTo("crops")}
                activeOpacity={0.7}
              >
                <View style={[styles.drawerItemIcon, currentScreen === "crops" && styles.drawerItemIconActive]}>
                  <Sprout
                    size={18}
                    color={currentScreen === "crops" ? "#10b981" : "#94a3b8"}
                  />
                </View>
                <Text
                  style={[
                    styles.drawerItemText,
                    currentScreen === "crops" && styles.drawerItemTextActive,
                  ]}
                >
                  Culturas
                </Text>
                <ChevronRight size={16} color="#cbd5e1" />
              </TouchableOpacity>

              {/* GRUPO 2: OPERAÇÕES */}
              <Text style={styles.drawerSectionLabel}>OPERAÇÕES</Text>

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

              {/* GRUPO 3: SISTEMA */}
              <Text style={styles.drawerSectionLabel}>SISTEMA</Text>

              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setIsDrawerOpen(false);
                  setIsSettingsOpen(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.drawerItemIcon}>
                  <Settings size={18} color="#94a3b8" />
                </View>
                <Text style={styles.drawerItemText}>Configurações</Text>
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
                Interface inicial · v0.1
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONFIGURAÇÕES DE REDE / API */}
      <Modal
        visible={isSettingsOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSettingsOpen(false)}
      >
        <View style={styles.settingsOverlay}>
          <View style={styles.settingsSheet}>
            <View style={styles.settingsHeader}>
              <View style={styles.settingsHeaderIcon}>
                <Settings size={20} color="#10b981" />
              </View>
              <Text style={styles.settingsTitle}>Configurações de Rede</Text>
              <TouchableOpacity
                onPress={() => setIsSettingsOpen(false)}
                style={styles.settingsCloseBtn}
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }}>
              <Text style={styles.settingsLabel}>Endereço da API Django:</Text>
              <TextInput
                style={styles.settingsInput}
                value={customApiUrl}
                onChangeText={setCustomApiUrl}
                placeholder="http://192.168.0.15:8000/api/v1"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />

              {settingsFeedback && (
                <View style={styles.feedbackBanner}>
                  <Text style={styles.feedbackText}>{settingsFeedback}</Text>
                </View>
              )}

              <View style={styles.settingsActions}>
                <TouchableOpacity
                  style={[styles.testBtn, isTestingApi && { opacity: 0.6 }]}
                  onPress={handleTestApiConnection}
                  disabled={isTestingApi}
                >
                  {isTestingApi ? (
                    <ActivityIndicator size="small" color="#334155" />
                  ) : (
                    <Text style={styles.testBtnText}>Testar Conexão</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveApiUrl}
                >
                  <Text style={styles.saveBtnText}>Salvar IP</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingsTipBox}>
                <Server size={16} color="#64748b" />
                <Text style={styles.settingsTipText}>
                  Para uso em celular físico, configure o endereço IP da máquina na rede Wi-Fi local (ex: http://192.168.0.15:8000/api/v1).
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0d281e",
  },
  splashContainer: {
    flex: 1,
    backgroundColor: "#0d281e",
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
    paddingVertical: 12,
    backgroundColor: "#0d281e",
    borderBottomWidth: 1,
    borderBottomColor: "#17382b",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuButton: {
    width: 40,
    height: 40,
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
    width: 32,
    height: 32,
    borderRadius: 8,
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
    color: "rgba(255, 255, 255, 0.65)",
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
    backgroundColor: "#0d281e",
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
    paddingVertical: 8,
  },
  drawerSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginTop: 14,
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
  settingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  settingsSheet: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    maxHeight: "80%",
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 10,
  },
  settingsHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  settingsTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  settingsCloseBtn: {
    padding: 4,
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  settingsInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  feedbackBanner: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#15803d",
  },
  settingsActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  testBtn: {
    flex: 1,
    height: 40,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  saveBtn: {
    flex: 1,
    height: 40,
    backgroundColor: "#10b981",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  settingsTipBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: "center",
  },
  settingsTipText: {
    flex: 1,
    fontSize: 11,
    color: "#64748b",
    lineHeight: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#0d281e",
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
