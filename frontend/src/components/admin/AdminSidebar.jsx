import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./AdminSidebar.css";

function AdminSidebar({ activeTab, setActiveTab, onLogout, isMobileOpen, setIsMobileOpen }) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  const adminNavItems = [
    { id: "dashboard", label: "Dashboard", path: "/admin/dashboard", icon: "📊" },
    { id: "sales", label: "Sales", path: "/admin/dashboard", icon: "📈" },
    { id: "users", label: "Users", path: "/admin/users", icon: "👥" },
    { id: "products", label: "Products", path: "/admin/products", icon: "🧪" },
    { id: "orders", label: "Orders", path: "/admin/dashboard", icon: "📦", badge: "LIVE" },
    { id: "reviews", label: "Reviews", path: "/admin/dashboard", icon: "⭐" },
    { id: "offers", label: "Offers", path: "/admin/dashboard", icon: "🏷️" },
    { id: "collections", label: "Collections", path: "/admin/dashboard", icon: "🗃️" },
    { id: "coupons", label: "Coupons", path: "/admin/dashboard", icon: "🎟️" },
    { id: "returns", label: "Returns", path: "/admin/dashboard", icon: "🔄" },
    { id: "settings", label: "Profile / Settings", path: "/admin/dashboard", icon: "⚙️" },
  ];

  const handleItemClick = (item) => {
    if (setActiveTab) {
      setActiveTab(item.id);
    }
    if (item.path && item.path !== currentPath) {
      navigate(item.path);
    }
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <aside className={`fexa-admin-sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
      {/* BRAND HEADER */}
      <div className="admin-sidebar-brand">
        <div className="brand-logo-row">
          <span className="brand-dot">●</span>
          <span className="brand-name">F E X A</span>
          <span className="brand-icon">⚗️</span>
        </div>
        <div className="brand-subtext">ADMIN TERMINAL // v2.4</div>
      </div>

      <div className="admin-sidebar-divider"></div>

      {/* NAVIGATION MENU */}
      <nav className="admin-sidebar-nav">
        {adminNavItems.map((item) => {
          let isActive = false;
          if (item.id === "dashboard" && (currentPath === "/admin/dashboard" || activeTab === "dashboard")) {
            isActive = true;
          } else if (item.id === "users" && (currentPath === "/admin/users" || activeTab === "users")) {
            isActive = true;
          } else if (item.id === "products" && (currentPath === "/admin/products" || activeTab === "products")) {
            isActive = true;
          } else if (activeTab === item.id) {
            isActive = true;
          }

          return (
            <button
              key={item.id}
              className={`admin-nav-item ${isActive ? "active" : ""}`}
              onClick={() => handleItemClick(item)}
            >
              <div className="admin-nav-item-left">
                <span className="admin-nav-icon">{item.icon}</span>
                <span className="admin-nav-label">{item.label}</span>
              </div>
              {item.badge && <span className="admin-nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* BOTTOM FOOTER / STATUS & LOGOUT */}
      <div className="admin-sidebar-footer">
        <div className="admin-system-status">
          <div className="status-indicator">
            <span className="pulse-dot">●</span>
            <span className="status-label">CLUSTERS ONLINE</span>
          </div>
          <span className="tls-version">TLS 1.3</span>
        </div>

        <button className="admin-terminate-btn" onClick={onLogout}>
          <span className="power-icon">⏻</span>
          <span>TERMINATE SESSION</span>
          <span className="esc-key">ESC</span>
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
