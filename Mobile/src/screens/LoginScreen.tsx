import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import {
  Leaf,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Server,
  AlertCircle,
  Check,
} from "lucide-react-native";
import { mobileApi, getApiUrl, setApiUrl } from "../services/api";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

const { width } = Dimensions.get("window");

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Configuração de IP / URL do servidor para Expo Go no celular físico
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(getApiUrl());
  const [serverSavedMessage, setServerSavedMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);
    setServerSavedMessage(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMessage("Por favor, informe seu usuário ou e-mail.");
      return;
    }
    if (!password) {
      setErrorMessage("Por favor, digite sua senha de acesso.");
      return;
    }

    setIsLoading(true);

    try {
      const data = await mobileApi.login(cleanUsername, password);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Não foi possível autenticar. Verifique o usuário, senha e o endereço da API."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveServerUrl = async () => {
    const cleanUrl = customServerUrl.trim();
    if (cleanUrl) {
      await setApiUrl(cleanUrl);
      setServerSavedMessage("Endereço da API atualizado com sucesso!");
      setTimeout(() => setServerSavedMessage(null), 3000);
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
            {/* Logo e Tag */}
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Leaf size={22} color="#ffffff" strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.brandTag}>GESTÃO AGRÍCOLA</Text>
                <Text style={styles.brandSub}>Cockpit de Pivôs</Text>
              </View>
            </View>

            {/* Títulos do Topo */}
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerEyebrow}>
                Planejamento · Irrigação · Operação
              </Text>
              <Text style={styles.bannerTitle}>Cockpit de Pivôs</Text>
            </View>
          </View>
        </View>

        {/* Card Inferior Arredondado (Bottom Sheet) */}
        <View style={styles.formCard}>
          {/* Indicador de Acesso */}
          <View style={styles.indicatorRow}>
            <View style={styles.indicatorLine} />
            <Text style={styles.indicatorText}>Acesso ao Sistema</Text>
          </View>

          <Text style={styles.cardTitle}>Bem-vindo de volta</Text>
          <Text style={styles.cardSubtitle}>
            Acesse com seu usuário e senha corporativos.
          </Text>

          {/* Banner de Erro */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <AlertCircle size={16} color="#dc2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Banner de Sucesso de Configuração */}
          {serverSavedMessage && (
            <View style={styles.successBanner}>
              <Check size={16} color="#16a34a" />
              <Text style={styles.successText}>{serverSavedMessage}</Text>
            </View>
          )}

          {/* Campo Usuário */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Usuário ou E-mail</Text>
            <View style={styles.inputWrapper}>
              <User size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ex: hiago"
                placeholderTextColor="#94a3b8"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Campo Senha */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#64748b" />
                ) : (
                  <Eye size={18} color="#64748b" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Botão Entrar */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.loginButtonText}>Entrar no Cockpit</Text>
                <ArrowRight size={18} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Divisor Institucional */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou acesso institucional</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botão Microsoft 365 */}
          <TouchableOpacity
            style={styles.msButton}
            onPress={() => {
              setErrorMessage("O login Microsoft 365 corporativo será ativado na homologação. Entre com usuário e senha acima.");
            }}
            activeOpacity={0.8}
          >
            <View style={styles.msLogo}>
              <View style={[styles.msDot, { backgroundColor: "#f25022" }]} />
              <View style={[styles.msDot, { backgroundColor: "#7fba00" }]} />
              <View style={[styles.msDot, { backgroundColor: "#00a4ef" }]} />
              <View style={[styles.msDot, { backgroundColor: "#ffb900" }]} />
            </View>
            <Text style={styles.msButtonText}>Entrar com Microsoft 365</Text>
          </TouchableOpacity>

          {/* Informação de Conexão Segura */}
          <View style={styles.securityRow}>
            <ShieldCheck size={14} color="#16a34a" />
            <Text style={styles.securityText}>Conexão auditada e offline-first</Text>
          </View>

          {/* Seção Expansível para Configurar o IP da API */}
          <TouchableOpacity
            onPress={() => setShowServerConfig(!showServerConfig)}
            style={styles.serverToggle}
          >
            <Server size={12} color="#64748b" />
            <Text style={styles.serverToggleText}>
              {showServerConfig ? "Ocultar IP da API" : `API: ${customServerUrl.replace(/https?:\/\//, "").replace(/\/api\/v1\/?/, "")}`}
            </Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={styles.serverConfigBox}>
              <Text style={styles.serverConfigLabel}>
                Endereço da API Django na rede local:
              </Text>
              <TextInput
                style={styles.serverInput}
                value={customServerUrl}
                onChangeText={setCustomServerUrl}
                placeholder="http://192.168.1.100:8000/api/v1"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
              <View style={styles.serverButtonsRow}>
                <TouchableOpacity
                  style={styles.presetButton}
                  onPress={() => setCustomServerUrl("http://10.0.2.2:8000/api/v1")}
                >
                  <Text style={styles.presetButtonText}>Emulador (10.0.2.2)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveServerButton}
                  onPress={handleSaveServerUrl}
                >
                  <Text style={styles.saveServerButtonText}>Salvar IP</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Rodapé */}
          <Text style={styles.footerText}>
            Cockpit de Pivôs — Grupo Farroupilha
          </Text>
        </View>
      </ScrollView>
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
  },
  bannerContainer: {
    height: 250,
    width: "100%",
    position: "relative",
    justifyContent: "space-between",
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(13, 40, 30, 0.45)",
  },
  bannerContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 54 : 38,
    paddingBottom: 32,
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  brandTag: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  brandSub: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    fontWeight: "500",
  },
  bannerTextContainer: {
    marginBottom: 6,
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
    letterSpacing: 0.5,
  },
  formCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -22,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  indicatorLine: {
    width: 20,
    height: 2,
    backgroundColor: "#16a34a",
    borderRadius: 1,
  },
  indicatorText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16a34a",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "500",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    color: "#15803d",
    fontSize: 12,
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: "#0f172a",
  },
  eyeButton: {
    padding: 8,
  },
  loginButton: {
    height: 50,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: "#94a3b8",
    shadowOpacity: 0,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dividerText: {
    fontSize: 11,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "500",
  },
  msButton: {
    height: 46,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  msLogo: {
    width: 14,
    height: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  msDot: {
    width: 6,
    height: 6,
  },
  msButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },
  securityText: {
    fontSize: 11,
    color: "#64748b",
  },
  serverToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 6,
  },
  serverToggleText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  serverConfigBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  serverConfigLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 6,
  },
  serverInput: {
    height: 38,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 12,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  serverButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  presetButton: {
    flex: 1,
    backgroundColor: "#e2e8f0",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  presetButtonText: {
    fontSize: 11,
    color: "#334155",
    fontWeight: "600",
  },
  saveServerButton: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  saveServerButtonText: {
    fontSize: 11,
    color: "#ffffff",
    fontWeight: "700",
  },
  footerText: {
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 22,
  },
});
