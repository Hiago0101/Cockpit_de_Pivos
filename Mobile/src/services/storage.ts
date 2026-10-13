/**
 * Camada de armazenamento seguro do aplicativo mobile.
 * Utiliza expo-secure-store (Keychain no iOS / Keystore criptografado no Android).
 * Não armazena senhas em texto simples e não registra tokens nos logs do console.
 */
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "cockpit_secure_token";
const USER_KEY = "cockpit_secure_user";
const API_URL_KEY = "cockpit_api_url";

// Memória temporária para fallbacks
let memoryFallback: Record<string, string> = {};

const isSecureStoreAvailable = async (): Promise<boolean> => {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

export const secureStorage = {
  // --- TOKEN DE AUTENTICAÇÃO ---
  saveAuthToken: async (token: string): Promise<void> => {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      } else {
        memoryFallback[TOKEN_KEY] = token;
      }
    } catch {
      memoryFallback[TOKEN_KEY] = token;
    }
  },

  getAuthToken: async (): Promise<string | null> => {
    try {
      if (await isSecureStoreAvailable()) {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) return token;
      }
      return memoryFallback[TOKEN_KEY] || null;
    } catch {
      return memoryFallback[TOKEN_KEY] || null;
    }
  },

  removeAuthToken: async (): Promise<void> => {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch {
      // Ignora erro
    }
    delete memoryFallback[TOKEN_KEY];
  },

  // --- PERFIL DO USUÁRIO ---
  saveUserProfile: async (user: any): Promise<void> => {
    try {
      const data = JSON.stringify(user);
      if (await isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(USER_KEY, data);
      } else {
        memoryFallback[USER_KEY] = data;
      }
    } catch {
      memoryFallback[USER_KEY] = JSON.stringify(user);
    }
  },

  getUserProfile: async (): Promise<any | null> => {
    try {
      let raw: string | null = null;
      if (await isSecureStoreAvailable()) {
        raw = await SecureStore.getItemAsync(USER_KEY);
      }
      if (!raw) {
        raw = memoryFallback[USER_KEY] || null;
      }
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  removeUserProfile: async (): Promise<void> => {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.deleteItemAsync(USER_KEY);
      }
    } catch {
      // Ignora erro
    }
    delete memoryFallback[USER_KEY];
  },

  // --- URL DA API ---
  saveApiUrl: async (url: string): Promise<void> => {
    try {
      if (await isSecureStoreAvailable()) {
        await SecureStore.setItemAsync(API_URL_KEY, url);
      } else {
        memoryFallback[API_URL_KEY] = url;
      }
    } catch {
      memoryFallback[API_URL_KEY] = url;
    }
  },

  getApiUrl: async (): Promise<string | null> => {
    try {
      if (await isSecureStoreAvailable()) {
        const url = await SecureStore.getItemAsync(API_URL_KEY);
        if (url) return url;
      }
      return memoryFallback[API_URL_KEY] || null;
    } catch {
      return memoryFallback[API_URL_KEY] || null;
    }
  },

  // --- LIMPEZA COMPLETA DE SESSÃO (LOGOUT) ---
  clearSession: async (): Promise<void> => {
    await secureStorage.removeAuthToken();
    await secureStorage.removeUserProfile();
  },
};
