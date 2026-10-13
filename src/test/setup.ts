import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

(globalThis as any).__DEV__ = false;

vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: any) => obj.ios || obj.default },
  StyleSheet: { create: (styles: any) => styles },
  Alert: { alert: vi.fn() },
}));

vi.mock("expo-secure-store", () => ({
  isAvailableAsync: vi.fn().mockResolvedValue(false),
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
