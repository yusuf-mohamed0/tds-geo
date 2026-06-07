import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { authApi, TOKEN_KEY } from '../services/api';
import { User } from '../types';

/**
 * Extended user type that includes Shopify-specific fields.
 */
interface ShopifyUser extends User {
  shop?: string;
  is_shopify_auth?: boolean;
  device?: DeviceInfo;
}

interface DeviceInfo {
  enrolled: boolean;
  trustScore: number;
  deviceId: string;
}

interface AuthContextType {
  user: ShopifyUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; role?: string }) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  /** Whether the user authenticated via Shopify embedded session */
  isShopifyAuth: boolean;
  /** The shop domain if authenticated via Shopify */
  shop: string | null;
  /** Device authorization info */
  deviceInfo: DeviceInfo | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ShopifyUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const authAttempted = useRef(false);

  const fetchUser = useCallback(async () => {
    if (authAttempted.current) return;
    authAttempted.current = true;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await authApi.me();
      setUser(userData);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      // Capture device authorization info from login response
      if (data.device) {
        setDeviceInfo({
          enrolled: data.device.enrolled,
          trustScore: data.device.trustScore,
          deviceId: data.device.deviceId,
        });
      }
    } catch (err: any) {
      const message = err.response?.data?.error || 'Login failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (data: { email: string; password: string; name: string; role?: string }) => {
    setError(null);
    setLoading(true);
    try {
      const result = await authApi.register(data);
      localStorage.setItem(TOKEN_KEY, result.token);
      setUser(result.user);
    } catch (err: any) {
      const message = err.response?.data?.error || 'Registration failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setDeviceInfo(null);
  }, []);

  const isShopifyAuth = user?.id?.startsWith('shop:') ?? false;
  const shop = isShopifyAuth ? (user as ShopifyUser).shop ?? user?.id?.replace('shop:', '') ?? null : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'super_admin' || user?.role === 'admin',
        isShopifyAuth,
        shop,
        deviceInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
