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
} from "react-native";
import { mobileApi, getApiUrl, setApiUrl } from "../services/api";

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Configuração avançada de IP / URL do servidor para desenvolvimento
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(getApiUrl());
  const [serverSavedMessage, setServerSavedMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);
    setServerSavedMessage(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMessage("Informe seu usuário ou e-mail.");
      return;
    }
    if (!password) {
      setErrorMessage("Informe sua senha de acesso.");
      return;
    }

    setIsLoading(true);

    try {
      const data = await mobileApi.login(cleanUsername, password);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro de autenticação no servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveServerUrl = async () => {
    const cleanUrl = customServerUrl.trim();
    if (cleanUrl) {
      await setApiUrl(cleanUrl);
      setServerSavedMessage("Endereço da API atualizado.");
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
      >
        {/* Cabeçalho Visual da Marca */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>CP</Text>
          </View>
          <Text style={styles.title}>COCKPIT DE PIVÔS</Text>
          <Text style={styles.subtitle}>Operação de Campo & Apontamentos</Text>
        </View>

        {/* Card de Formulário */}
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Acesso do Operador</Text>
          <Text style={styles.cardSubtitle}>
            Entre com suas credenciais para sincronizar ordens e pivôs.
          </Text>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {serverSavedMessage && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{serverSavedMessage}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Usuário ou E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: hiago ou operador@agro.com"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
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
                <Text style={styles.eyeButtonText}>
                  {showPassword ? "Ocultar" : "Mostrar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>Entrar no Aplicativo</Text>
            )}
          </TouchableOpacity>

          {/* Toggle de Configuração de Servidor / Rede */}
          <TouchableOpacity
            onPress={() => setShowServerConfig(!showServerConfig)}
            style={styles.serverToggle}
          >
            <Text style={styles.serverToggleText}>
              {showServerConfig ? "▲ Ocultar Servidor" : "▼ Configurar Servidor da API"}
            </Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={styles.serverConfigBox}>
              <Text style={styles.serverConfigLabel}>URL da API Django:</Text>
              <TextInput
                style={styles.serverInput}
                value={customServerUrl}
                onChangeText={setCustomServerUrl}
                placeholder="http://10.0.2.2:8000/api/v1"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
              <View style={styles.serverButtonsRow}>
                <TouchableOpacity
                  style={styles.presetButton}
                  onPress={() => setCustomServerUrl("http://127.0.0.1:8000/api/v1")}
                >
                  <Text style={styles.presetButtonText}>127.0.0.1 (Web)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetButton}
                  onPress={() => setCustomServerUrl("http://10.0.2.2:8000/api/v1")}
                >
                  <Text style={styles.presetButtonText}>10.0.2.2 (Android)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveServerButton}
                  onPress={handleSaveServerUrl}
                >
                  <Text style={styles.saveServerButtonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.footerText}>
          Cockpit de Pivôs Mobile · Sincronização Segura Offline
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#132a22",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#1b7d52",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  logoBadgeText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 12,
    color: "#a7f3d0",
    marginTop: 4,
    fontWeight: "500",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 18,
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "600",
  },
  successBanner: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  successText: {
    color: "#15803d",
    fontSize: 12,
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  passwordInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#0f172a",
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eyeButtonText: {
    fontSize: 12,
    color: "#1b7d52",
    fontWeight: "600",
  },
  loginButton: {
    height: 48,
    backgroundColor: "#1b7d52",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#1b7d52",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  serverToggle: {
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 4,
  },
  serverToggleText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  serverConfigBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
  },
  serverConfigLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
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
    gap: 6,
    marginTop: 8,
  },
  presetButton: {
    flex: 1,
    backgroundColor: "#e2e8f0",
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: "center",
  },
  presetButtonText: {
    fontSize: 10,
    color: "#334155",
    fontWeight: "600",
  },
  saveServerButton: {
    backgroundColor: "#1b7d52",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: "center",
  },
  saveServerButtonText: {
    fontSize: 10,
    color: "#ffffff",
    fontWeight: "700",
  },
  footerText: {
    textAlign: "center",
    fontSize: 11,
    color: "#6ee7b7",
    marginTop: 24,
  },
});
