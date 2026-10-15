import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal,
  SafeAreaView,
} from "react-native";
import {
  Leaf,
  AlertCircle,
  ArrowRight,
  Shield,
  Lock,
  X,
} from "lucide-react-native";
import { WebView } from "react-native-webview";
import { mobileApi } from "../services/api";

const AZURE_CLIENT_ID = "a09b13cd-3aa7-467f-8972-3deb74ce4d03";
const AZURE_TENANT_ID = "9252a619-b1c5-4386-8a85-db9248d55a49";
// URI oficial Microsoft já registrado no Azure AD para aplicativos móveis
const AZURE_REDIRECT_URI = "https://login.microsoftonline.com/common/oauth2/nativeclient";

// Script injetado na WebView para capturar redirecionamentos internos e hash imediatamente
const INJECTED_INTERCEPT_SCRIPT = `
  (function() {
    function checkUrl() {
      try {
        var h = window.location.href;
        if (h && (h.indexOf('access_token=') !== -1 || h.indexOf('error=') !== -1 || h.indexOf('error_description=') !== -1)) {
          window.ReactNativeWebView.postMessage(h);
        }
      } catch(e) {}
    }
    window.addEventListener('hashchange', checkUrl);
    window.addEventListener('popstate', checkUrl);
    setInterval(checkUrl, 250);
    checkUrl();
  })();
  true;
`;

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  // Controle da WebView de Login Direto Microsoft 365
  const [showWebView, setShowWebView] = useState(false);
  const [webViewKey, setWebViewKey] = useState(1);
  const hasHandledAuthRef = useRef(false);

  // URL de autorização da Microsoft idêntica à do navegador web (Entra ID)
  const authUrl =
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize?` +
    new URLSearchParams({
      client_id: AZURE_CLIENT_ID,
      response_type: "token",
      redirect_uri: AZURE_REDIRECT_URI,
      scope: "openid profile email User.Read",
      response_mode: "fragment",
      prompt: "select_account",
    }).toString();

  const handleStartLogin = () => {
    hasHandledAuthRef.current = false;
    setErrorMessage(null);
    setErrorDetails(null);
    setWebViewKey((k) => k + 1);
    setShowWebView(true);
  };

  /**
   * Intercepta a URL retornada pela Microsoft ao concluir a autenticação com e-mail e senha
   */
  const handleInterceptUrl = (url: string): boolean => {
    if (!url || hasHandledAuthRef.current) return false;

    // 1. Detecta sucesso na autenticação pelo retorno do access_token (no fragmento '#' ou query '?')
    if (url.includes("access_token=")) {
      hasHandledAuthRef.current = true;
      let accessToken: string | null = null;
      let idToken: string | null = null;

      if (url.includes("#")) {
        const hashPart = url.substring(url.indexOf("#") + 1);
        const hashParams = new URLSearchParams(hashPart);
        accessToken = hashParams.get("access_token");
        idToken = hashParams.get("id_token");
      }

      if (!accessToken && url.includes("?")) {
        const queryPart = url.substring(url.indexOf("?") + 1).split("#")[0];
        const queryParams = new URLSearchParams(queryPart);
        accessToken = queryParams.get("access_token");
        idToken = queryParams.get("id_token");
      }

      if (accessToken) {
        setShowWebView(false);
        processSuccessfulLogin(accessToken, idToken || undefined);
        return false;
      }
    }

    // 2. Detecta se houve erro ou cancelamento na tela da Microsoft
    if (url.includes("error=") || url.includes("error_description=")) {
      hasHandledAuthRef.current = true;
      let errorDesc: string | null = null;

      if (url.includes("?")) {
        const queryPart = url.substring(url.indexOf("?") + 1).split("#")[0];
        const queryParams = new URLSearchParams(queryPart);
        errorDesc = queryParams.get("error_description");
      }
      if (!errorDesc && url.includes("#")) {
        const hashPart = url.substring(url.indexOf("#") + 1);
        const hashParams = new URLSearchParams(hashPart);
        errorDesc = hashParams.get("error_description");
      }

      setShowWebView(false);
      setErrorMessage("Autenticação cancelada ou recusada na Microsoft.");
      setErrorDetails(errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, " ")) : null);
      return false;
    }

    // Se chegou ao endpoint de redirect sem tokens ainda
    if (url.includes("nativeclient") || url.includes("localhost:5173") || url.includes("cockpit://")) {
      return false;
    }

    return true; // Permite a navegação normal pelas etapas da Microsoft (e-mail, senha, MFA)
  };

  /**
   * Envia o token oficial emitido pela Microsoft para o backend validar no Microsoft Graph
   */
  const processSuccessfulLogin = async (accessToken: string, idToken?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setErrorDetails(null);

    try {
      const data = await mobileApi.loginAzure({
        access_token: accessToken,
        id_token: idToken,
      });
      onLoginSuccess(data.user);
    } catch (err: any) {
      const message = err?.message || "Erro ao validar sessão corporativa no servidor.";
      setErrorMessage(message);

      if (message.includes("não possui pré-cadastro") || message.includes("USER_NOT_REGISTERED")) {
        setErrorDetails(
          "O auto-cadastro é restrito no Grupo Farroupilha. Solicite ao administrador a liberação da sua conta."
        );
      } else if (message.includes("Active Directory") || message.includes("bloqueado")) {
        setErrorDetails(
          "Sua conta corporativa está bloqueada no Active Directory. Contate o TI corporativo."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Banner Visual Superior com Foto das Lavouras */}
        <View style={styles.bannerContainer}>
          <Image
            source={require("../../assets/login-fields.jpg")}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          <View style={styles.bannerOverlay} />

          <View style={styles.bannerContent}>
            {/* Logo e Tag Institucional */}
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Leaf size={22} color="#ffffff" strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.brandTag}>GRUPO FARROUPILHA</Text>
                <Text style={styles.brandSub}>Gestão Agronômica</Text>
              </View>
            </View>

            {/* Títulos do Topo */}
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerEyebrow}>
                Planejamento · Irrigação · Operações
              </Text>
              <Text style={styles.bannerTitle}>Cockpit de Pivôs</Text>
            </View>
          </View>
        </View>

        {/* Card Principal — Perfeitamente Centralizado e Proporcional */}
        <View style={styles.formCard}>
          {/* Seção Superior do Card */}
          <View style={styles.cardHeaderSection}>
            <View style={styles.securityBadge}>
              <Shield size={14} color="#16a34a" />
              <Text style={styles.securityBadgeText}>Ambiente Corporativo Seguro</Text>
            </View>

            <Text style={styles.cardTitle}>Bem-vindo de volta</Text>
            <Text style={styles.cardSubtitle}>
              Autentique-se com seu e-mail e senha institucional Microsoft 365 para sincronizar pivôs e apontamentos.
            </Text>
          </View>

          {/* Seção Central de Ação */}
          <View style={styles.cardActionSection}>
            {/* Banner de Erro com feedback claro */}
            {errorMessage && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#dc2626" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                  {errorDetails && (
                    <Text style={styles.errorSubtext}>{errorDetails}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Botão Oficial Microsoft 365 — Abre a tela oficial de e-mail e senha */}
            <TouchableOpacity
              style={[styles.msButton, isLoading && styles.buttonDisabled]}
              onPress={handleStartLogin}
              disabled={isLoading}
              activeOpacity={0.88}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#0f172a" size="small" />
                  <Text style={styles.loadingText}>Validando credencial 365...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <View style={styles.msLogo}>
                    <View style={[styles.msDot, { backgroundColor: "#f25022" }]} />
                    <View style={[styles.msDot, { backgroundColor: "#7fba00" }]} />
                    <View style={[styles.msDot, { backgroundColor: "#00a4ef" }]} />
                    <View style={[styles.msDot, { backgroundColor: "#ffb900" }]} />
                  </View>
                  <Text style={styles.msButtonText}>Entrar com Microsoft 365</Text>
                  <ArrowRight size={18} color="#64748b" style={{ marginLeft: "auto" }} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.singleSignOnNote}>
              <Lock size={12} color="#64748b" />
              <Text style={styles.singleSignOnText}>
                Autenticação direta com seu e-mail e senha Microsoft
              </Text>
            </View>
          </View>

          {/* Rodapé Institucional */}
          <View style={styles.cardFooterSection}>
            <View style={styles.footerDivider} />
            <Text style={styles.footerText}>
              Cockpit de Pivôs — Grupo Farroupilha
            </Text>
            <Text style={styles.footerSubtext}>
              Tecnologia da Informação & Operações Agrícolas
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Modal com WebView Oficial da Microsoft — E-mail, Senha e MFA */}
      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          hasHandledAuthRef.current = true;
          setShowWebView(false);
        }}
      >
        <SafeAreaView style={styles.webViewContainer}>
          {/* Barra Superior do Navegador */}
          <View style={styles.webViewHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.msLogoMini}>
                <View style={[styles.msDotMini, { backgroundColor: "#f25022" }]} />
                <View style={[styles.msDotMini, { backgroundColor: "#7fba00" }]} />
                <View style={[styles.msDotMini, { backgroundColor: "#00a4ef" }]} />
                <View style={[styles.msDotMini, { backgroundColor: "#ffb900" }]} />
              </View>
              <Text style={styles.webViewTitle}>Login Microsoft 365</Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                hasHandledAuthRef.current = true;
                setShowWebView(false);
              }}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color="#334155" />
            </TouchableOpacity>
          </View>

          {/* Navegador Integrado com a Página Oficial da Microsoft */}
          <WebView
            key={webViewKey}
            source={{ uri: authUrl }}
            onShouldStartLoadWithRequest={(request) => {
              return handleInterceptUrl(request.url);
            }}
            onNavigationStateChange={(navState) => {
              handleInterceptUrl(navState.url);
            }}
            onLoadProgress={({ nativeEvent }) => {
              handleInterceptUrl(nativeEvent.url);
            }}
            injectedJavaScriptBeforeContentLoaded={INJECTED_INTERCEPT_SCRIPT}
            injectedJavaScript={INJECTED_INTERCEPT_SCRIPT}
            onMessage={(event) => {
              handleInterceptUrl(event.nativeEvent.data);
            }}
            userAgent={
              Platform.OS === "android"
                ? "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                : undefined
            }
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#16a34a" />
                <Text style={styles.loaderText}>Carregando Microsoft 365...</Text>
              </View>
            )}
            style={styles.webView}
            incognito={false}
          />
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d281e",
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: "100%",
  },
  bannerContainer: {
    height: 250,
    width: "100%",
    position: "relative",
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(13, 40, 30, 0.50)",
  },
  bannerContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 54 : 40,
    paddingBottom: 28,
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  brandTag: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  brandSub: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 11,
    fontWeight: "500",
  },
  bannerTextContainer: {
    marginBottom: 4,
  },
  bannerEyebrow: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  bannerTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  formCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -22,
    paddingHorizontal: 26,
    paddingTop: 32,
    paddingBottom: Platform.OS === "ios" ? 36 : 28,
    justifyContent: "space-between",
  },
  cardHeaderSection: {
    alignItems: "flex-start",
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  securityBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803d",
    letterSpacing: 0.3,
  },
  cardTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 6,
    lineHeight: 19,
  },
  cardActionSection: {
    marginVertical: 24,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  errorSubtext: {
    color: "#991b1b",
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  msButton: {
    height: 56,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingHorizontal: 18,
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  msLogo: {
    width: 18,
    height: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  msDot: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  msButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  singleSignOnNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  singleSignOnText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
  },
  cardFooterSection: {
    alignItems: "center",
    paddingTop: 10,
  },
  footerDivider: {
    width: 40,
    height: 2,
    backgroundColor: "#e2e8f0",
    borderRadius: 1,
    marginBottom: 12,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  footerSubtext: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
  },
  // Estilos da WebView Oficial Microsoft
  webViewContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webViewHeader: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  msLogoMini: {
    width: 14,
    height: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1.5,
  },
  msDotMini: {
    width: 6,
    height: 6,
  },
  webViewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  webView: {
    flex: 1,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
});
