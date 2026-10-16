import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

function AdminPublicRoute({ children }) {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#0d0b10",
          color: "#d8c4eb",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "sans-serif",
          fontSize: "14px",
          letterSpacing: "1px",
        }}
      >
        LOADING...
      </div>
    );
  }

  if (admin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}

export default AdminPublicRoute;
