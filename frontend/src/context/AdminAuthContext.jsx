import { createContext, useState, useEffect, useContext } from "react";
import {
  checkAdminSession,
  adminLogin,
  adminLogout,
} from "../services/admin.service.js";

const AdminAuthContext = createContext();

export const useAdminAuth = () => useContext(AdminAuthContext);

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check admin session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const data = await checkAdminSession();
        if (data && data.success && data.admin) {
          setAdmin(data.admin);
        } else {
          setAdmin(null);
        }
      } catch (error) {
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const loginAdmin = async (email, password) => {
    try {
      const data = await adminLogin({ email, password });
      if (data && data.success) {
        setAdmin(data.admin);
      }
      return { ok: true, data };
    } catch (error) {
      console.error("Login admin error:", error);
      const data = error.response?.data || { message: "Unable to connect to server." };
      return { ok: false, data };
    }
  };

  const logoutAdmin = async () => {
    try {
      await adminLogout();
    } catch (error) {
      console.error("Admin logout error:", error);
    } finally {
      setAdmin(null);
      localStorage.removeItem("adminToken");
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        loginAdmin,
        logoutAdmin,
        setAdmin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};
