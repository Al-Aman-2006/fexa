import { createContext, useState, useEffect, useContext } from "react";

const AdminAuthContext = createContext();

export const useAdminAuth = () => useContext(AdminAuthContext);

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check admin session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/admin/auth/session", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setAdmin(data.admin);
        } else {
          setAdmin(null);
        }
      } catch (error) {
        console.error("Admin session check error:", error);
        setAdmin(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const loginAdmin = async (email, password) => {
    try {
      const response = await fetch("http://localhost:5000/api/admin/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setAdmin(data.admin);
      }

      return { ok: response.ok, data };
    } catch (error) {
      console.error("Login admin error:", error);
      return { ok: false, data: { message: "Unable to connect to server." } };
    }
  };

  const logoutAdmin = async () => {
    try {
      await fetch("http://localhost:5000/api/admin/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Admin logout error:", error);
    } finally {
      setAdmin(null);
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
