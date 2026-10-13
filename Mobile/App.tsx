import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MobilePivot } from "./src/types";
import { PivotsScreen } from "./src/screens/PivotsScreen";
import { PivotDetailScreen } from "./src/screens/PivotDetailScreen";
import { IrrigationFormScreen } from "./src/screens/IrrigationFormScreen";
import { SyncQueueScreen } from "./src/screens/SyncQueueScreen";
import { PlanningScreen } from "./src/screens/PlanningScreen";
import { OpportunitiesScreen } from "./src/screens/OpportunitiesScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { mobileApi, setOnUnauthorized } from "./src/services/api";

type ScreenName = "pivots" | "planning" | "opportunities" | "pivot_detail" | "irrigation_form" | "sync_queue";

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const [currentScreen, setCurrentScreen] = useState<ScreenName>("pivots");
  const [previousScreen, setPreviousScreen] = useState<ScreenName>("pivots");
  const [selectedPivot, setSelectedPivot] = useState<MobilePivot | undefined>(undefined);

  const role = currentUser?.profile?.role || "OPERADOR";
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
          // Atualiza perfil silenciosamente se houver conexão
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

  if (isInitializing) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.splashContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#132a22" />
          <ActivityIndicator size="large" color="#1b7d52" />
          <Text style={styles.splashText}>Cockpit de Pivôs · Carregando...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="#132a22" />
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#132a22" />

        {/* Top Header com Usuário e Logout */}
        <View style={styles.topHeader}>
          <View style={styles.brandGroup}>
            <Text style={styles.topHeaderTitle}>COCKPIT</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{role}</Text>
            </View>
          </View>

          <View style={styles.userActionsGroup}>
            <Text style={styles.userNameText} numberOfLines={1}>
              @{currentUser?.username || "usuario"}
            </Text>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutButtonText}>Sair</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.container}>
          {/* Renderização da Tela Ativa */}
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

          {/* Barra de Navegação Inferior (Mobile Tabs) */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.tabButton, currentScreen === "pivots" && styles.tabButtonActive]}
              onPress={() => setCurrentScreen("pivots")}
            >
              <Text style={[styles.tabButtonText, currentScreen === "pivots" && styles.tabButtonTextActive]}>
                Pivôs
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, currentScreen === "planning" && styles.tabButtonActive]}
              onPress={() => setCurrentScreen("planning")}
            >
              <Text style={[styles.tabButtonText, currentScreen === "planning" && styles.tabButtonTextActive]}>
                Planejamento
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, currentScreen === "opportunities" && styles.tabButtonActive]}
              onPress={() => setCurrentScreen("opportunities")}
            >
              <Text style={[styles.tabButtonText, currentScreen === "opportunities" && styles.tabButtonTextActive]}>
                Janelas
              </Text>
            </TouchableOpacity>

            {!isConsultor && (
              <TouchableOpacity
                style={[styles.tabButton, currentScreen === "irrigation_form" && styles.tabButtonActive]}
                onPress={() => handleOpenIrrigation(selectedPivot)}
              >
                <Text style={[styles.tabButtonText, currentScreen === "irrigation_form" && styles.tabButtonTextActive]}>
                  + Apontar
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.tabButton, currentScreen === "sync_queue" && styles.tabButtonActive]}
              onPress={() => {
                if (currentScreen !== "sync_queue") {
                  setPreviousScreen(currentScreen);
                  setCurrentScreen("sync_queue");
                }
              }}
            >
              <Text style={[styles.tabButtonText, currentScreen === "sync_queue" && styles.tabButtonTextActive]}>
                Sincronização
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#132a22",
  },
  splashContainer: {
    flex: 1,
    backgroundColor: "#132a22",
    justifyContent: "center",
    alignItems: "center",
  },
  splashText: {
    color: "#a7f3d0",
    fontSize: 13,
    marginTop: 12,
    fontWeight: "500",
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#0d1f18",
    borderBottomWidth: 1,
    borderBottomColor: "#1f4033",
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topHeaderTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  roleBadge: {
    backgroundColor: "#1b7d52",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  userActionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  userNameText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "500",
    maxWidth: 110,
  },
  logoutButton: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  logoutButtonText: {
    color: "#fca5a5",
    fontSize: 11,
    fontWeight: "700",
  },
  container: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },
  screenContainer: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: "row",
    height: 60,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  tabButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabButtonActive: {
    borderTopWidth: 3,
    borderTopColor: "#1b7d52",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  tabButtonTextActive: {
    color: "#1b7d52",
    fontWeight: "700",
  },
});
