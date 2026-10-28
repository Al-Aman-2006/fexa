import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./AdminSidebar.css";

function AdminSidebar({ activeTab, setActiveTab, onLogout, isMobileOpen, setIsMobileOpen }) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;
  const isCategoryRouteActive = currentPath.startsWith("/admin/categories");

  // Keep parent menu expanded if activeTab or currentPath is within categories
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(
    isCategoryRouteActive || activeTab?.startsWith("category-")
  );

  useEffect(() => {
    if (isCategoryRouteActive || activeTab?.startsWith("category-")) {
      setIsCategoryMenuOpen(true);
    }
  }, [isCategoryRouteActive, activeTab]);

  const adminNavItems = [
    { id: "dashboard", label: "Dashboard", path: "/admin/dashboard", icon: "📊" },
    { id: "sales", label: "Sales", path: "/admin/sales", icon: "📈" },
    { id: "users", label: "Users", path: "/admin/users", icon: "👥" },
    {
      id: "category-management",
      label: "Category Management",
      icon: "🗂️",
      isParent: true,
      subItems: [
        { id: "category-all", label: "All Products", path: "/admin/categories/all", icon: "📦" },
        { id: "category-men", label: "Men", path: "/admin/categories/men", icon: "🎩" },
        { id: "category-women", label: "Women", path: "/admin/categories/women", icon: "🌸" },
        { id: "category-unisex", label: "Unisex", path: "/admin/categories/unisex", icon: "✨" },
      ],
    },
    { id: "orders", label: "Orders", path: "/admin/dashboard", icon: "📦", badge: "LIVE" },
    { id: "reviews", label: "Reviews", path: "/admin/reviews", icon: "⭐" },
    { id: "offers", label: "Offers", path: "/admin/offers", icon: "🏷️" },
    { id: "collections", label: "Collections", path: "/admin/dashboard", icon: "🗃️" },
    { id: "coupons", label: "Coupons", path: "/admin/coupons", icon: "🎟️" },
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

  const handleSubItemClick = (subItem) => {
    if (setActiveTab) {
      setActiveTab(subItem.id);
    }
    if (subItem.path && subItem.path !== currentPath) {
      navigate(subItem.path);
    }
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  // Close on Escape key on mobile
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isMobileOpen && setIsMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, setIsMobileOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  return (
    <>
      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`fexa-admin-sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
        {/* BRAND HEADER & CLOSE BUTTON */}
        <div className="admin-sidebar-brand">
          <div className="brand-logo-row">
            <span className="brand-dot">●</span>
            <span className="brand-name">F E X A</span>
            <span className="brand-icon">⚗️</span>
            {isMobileOpen && (
              <button
                type="button"
                className="admin-sidebar-close-btn"
                onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
                aria-label="Close admin menu"
              >
                ✕
              </button>
            )}
          </div>
          <div className="brand-subtext">ADMIN TERMINAL // v2.4</div>
        </div>

        <div className="admin-sidebar-divider"></div>

      {/* NAVIGATION MENU */}
      <nav className="admin-sidebar-nav">
        {adminNavItems.map((item) => {
          if (item.isParent) {
            const isParentActive = isCategoryRouteActive || activeTab?.startsWith("category-");

            return (
              <div key={item.id} className="admin-nav-parent-group">
                <button
                  type="button"
                  className={`admin-nav-item admin-nav-parent-btn ${
                    isParentActive ? "parent-active" : ""
                  }`}
                  onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
                  aria-expanded={isCategoryMenuOpen}
                >
                  <div className="admin-nav-item-left">
                    <span className="admin-nav-icon">{item.icon}</span>
                    <span className="admin-nav-label">{item.label}</span>
                  </div>
                  <span className={`admin-nav-chevron ${isCategoryMenuOpen ? "open" : ""}`}>
                    ▾
                  </span>
                </button>

                {isCategoryMenuOpen && (
                  <div className="admin-submenu-list">
                    {item.subItems.map((sub) => {
                      const isSubActive =
                        currentPath === sub.path ||
                        activeTab === sub.id;

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          className={`admin-submenu-item ${isSubActive ? "active" : ""}`}
                          onClick={() => handleSubItemClick(sub)}
                        >
                          <span className="admin-submenu-icon">{sub.icon}</span>
                          <span className="admin-submenu-label">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          let isActive = false;
          if (item.id === "dashboard" && (currentPath === "/admin/dashboard" || activeTab === "dashboard")) {
            isActive = true;
          } else if (item.id === "sales" && (currentPath === "/admin/sales" || activeTab === "sales")) {
            isActive = true;
          } else if (item.id === "users" && (currentPath === "/admin/users" || activeTab === "users")) {
            isActive = true;
          } else if (item.id === "coupons" && (currentPath === "/admin/coupons" || activeTab === "coupons")) {
            isActive = true;
          } else if (item.id === "reviews" && (currentPath === "/admin/reviews" || activeTab === "reviews")) {
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
    </>
  );
}

export default AdminSidebar;
