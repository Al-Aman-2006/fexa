import React from "react";
import { useWishlist } from "../../context/WishlistContext";
import "./UserSidebar.css";

const getProfileImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  return `http://localhost:5000${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
};

const getInitials = (name) => {
  if (!name) return "F";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

function UserSidebar({ user, activeTab, setActiveTab, onLogout, isMobileOpen, setIsMobileOpen, ordersCount = 0 }) {
  const { wishlistCount, openWishlist } = useWishlist();
  const isGoogleUser = user?.authProvider === "google" || Boolean(user?.googleId);
  const initials = getInitials(user?.name);
  const addressCount = user?.addresses?.length || 0;

  const navItems = [
    { id: "profile", label: "PROFILE", icon: "👤", badge: null },
    { id: "orders", label: "MY ORDERS", icon: "📦", badge: ordersCount > 0 ? String(ordersCount) : null },
    { id: "addresses", label: "MY ADDRESSES", icon: "📍", badge: addressCount > 0 ? addressCount : null },
    { id: "wishlist", label: "WISHLIST", icon: "♡", badge: wishlistCount > 0 ? String(wishlistCount) : "0" },
    { id: "wallet", label: "MY WALLET", icon: "👛", badge: null },
    { id: "security", label: "SECURITY", icon: "🛡️", badge: null },
    { id: "settings", label: "ACCOUNT SETTINGS", icon: "⚙️", badge: null },
  ];

  const handleTabClick = (tabId) => {
    if (tabId === "wishlist") {
      openWishlist();
      if (setIsMobileOpen) setIsMobileOpen(false);
      return;
    }
    setActiveTab(tabId);
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  return (
    <aside className={`fexa-user-sidebar-card ${isMobileOpen ? "mobile-open" : ""}`}>
      {/* USER IDENTITY HEADER */}
      <div className="sidebar-user-header">
        <div className="sidebar-avatar-wrapper">
          {user?.profileImage ? (
            <img
              src={getProfileImageUrl(user.profileImage)}
              alt={user?.name || "User Avatar"}
              className="sidebar-avatar-img"
            />
          ) : (
            <div className="sidebar-avatar-initials">{initials}</div>
          )}
          <span className="sidebar-online-dot" title="Active Patron"></span>
        </div>

        <div className="sidebar-user-info">
          <h3 className="sidebar-user-name">{user?.name || "FEXA Patron"}</h3>
          <p className="sidebar-user-email">{user?.email || "user@fexa.com"}</p>
          <div className="sidebar-user-badge">
            <span className="badge-check">✓</span>
            {isGoogleUser ? "VERIFIED GOOGLE PATRON" : "VERIFIED PATRON"}
          </div>
        </div>
      </div>

      <div className="sidebar-divider"></div>

      {/* NAVIGATION ITEMS */}
      <nav className="sidebar-nav-menu">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              onClick={() => handleTabClick(item.id)}
            >
              <div className="nav-item-left">
                <span className="nav-item-icon">{item.icon}</span>
                <span className="nav-item-label">{item.label}</span>
              </div>

              <div className="nav-item-right">
                {item.badge && <span className="nav-item-badge">{item.badge}</span>}
                <span className="nav-item-arrow">›</span>
              </div>
            </button>
          );
        })}

        {/* LOGOUT BUTTON */}
        <button className="sidebar-nav-item logout-item" onClick={onLogout}>
          <div className="nav-item-left">
            <span className="nav-item-icon">🚪</span>
            <span className="nav-item-label">LOGOUT</span>
          </div>
          <span className="logout-arrow">↳</span>
        </button>
      </nav>
    </aside>
  );
}

export default UserSidebar;
