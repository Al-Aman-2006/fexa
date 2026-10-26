import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminPagination from "../../components/admin/AdminPagination";
import "./AdminDashboard.css";

function AdminDashboard() {
  const { admin, logoutAdmin } = useAdminAuth();
  const location = useLocation();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalUsers: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Sidebar & Mobile navigation state
  const [activeTab, setActiveTab] = useState(
    location.pathname === "/admin/users" ? "users" : "dashboard"
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === "/admin/users") {
      setActiveTab("users");
    } else if (location.pathname === "/admin/dashboard") {
      setActiveTab("dashboard");
    }
  }, [location.pathname]);

  // Modal State
  const [activeModal, setActiveModal] = useState(null); // null | "create" | "edit" | "block" | "unblock" | "delete"
  const [modalUser, setModalUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [modalErrors, setModalErrors] = useState({});
  const [actionProcessing, setActionProcessing] = useState(false);

  const fetchUsers = useCallback(async (targetPage = 1, targetSearch = "") => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: targetPage,
        limit: 10,
      });

      if (targetSearch.trim()) {
        queryParams.set("search", targetSearch.trim());
      }

      const response = await fetch(
        `http://localhost:5000/api/admin/users?${queryParams.toString()}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setUsers(data.users || []);
        setPagination(
          data.pagination || { page: 1, limit: 10, totalUsers: 0, totalPages: 1 }
        );
        setAppliedSearch(targetSearch.trim());
      } else {
        setToast({
          type: "error",
          text: data.message || "Unable to fetch user list.",
        });
      }
    } catch (error) {
      console.error("Fetch admin users error:", error);
      setToast({
        type: "error",
        text: "Unable to connect to the server.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(page, appliedSearch);
  }, [fetchUsers, page, appliedSearch]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, search);
  };

  const handleClearSearch = () => {
    setSearch("");
    setPage(1);
    fetchUsers(1, "");
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  };

  const closeModal = () => {
    if (actionProcessing) return;
    setActiveModal(null);
    setModalUser(null);
    setFormData({ name: "", email: "", phone: "", password: "" });
    setModalErrors({});
  };

  // Open Create Modal
  const openCreateModal = () => {
    setToast(null);
    setFormData({ name: "", email: "", phone: "", password: "" });
    setModalErrors({});
    setActiveModal("create");
  };

  // Open Edit Modal
  const openEditModal = (targetUser) => {
    setToast(null);
    setModalUser(targetUser);
    setFormData({
      name: targetUser.name || "",
      email: targetUser.email || "",
      phone: targetUser.phone || "",
      password: "",
    });
    setModalErrors({});
    setActiveModal("edit");
  };

  // Open Block / Unblock / Delete Modal
  const openConfirmModal = (targetUser, type) => {
    setToast(null);
    setModalUser(targetUser);
    setModalErrors({});
    setActiveModal(type);
  };

  // Submit Create User
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalErrors({});

    const errors = {};
    if (!formData.name.trim()) errors.name = "Name is required.";
    if (!formData.email.trim()) errors.email = "Email is required.";
    if (!formData.password) errors.password = "Password is required.";

    if (Object.keys(errors).length > 0) {
      setModalErrors(errors);
      return;
    }

    try {
      setActionProcessing(true);
      const response = await fetch("http://localhost:5000/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setToast({ type: "success", text: "User created successfully." });
        closeModal();
        setPage(1);
        fetchUsers(1, appliedSearch);
      } else {
        if (data.errors) {
          setModalErrors(data.errors);
        }
        setModalErrors((prev) => ({
          ...prev,
          general: data.message || "Unable to create user.",
        }));
      }
    } catch (error) {
      console.error("Create user error:", error);
      setModalErrors({ general: "Unable to connect to server." });
    } finally {
      setActionProcessing(false);
    }
  };

  // Submit Edit User
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalErrors({});

    if (!formData.name.trim()) {
      setModalErrors({ name: "Name is required." });
      return;
    }

    try {
      setActionProcessing(true);
      const response = await fetch(
        `http://localhost:5000/api/admin/users/${modalUser._id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setToast({ type: "success", text: "User updated successfully." });
        closeModal();
        fetchUsers(page, appliedSearch);
      } else {
        setModalErrors({ general: data.message || "Unable to update user." });
      }
    } catch (error) {
      console.error("Edit user error:", error);
      setModalErrors({ general: "Unable to connect to server." });
    } finally {
      setActionProcessing(false);
    }
  };

  // Submit Block / Unblock / Delete Action
  const handleConfirmAction = async () => {
    if (!modalUser) return;

    try {
      setActionProcessing(true);
      setToast(null);

      let endpoint = "";
      let method = "PATCH";

      if (activeModal === "block" || activeModal === "unblock") {
        endpoint = `http://localhost:5000/api/admin/users/${modalUser._id}/${activeModal}`;
      } else if (activeModal === "delete") {
        endpoint = `http://localhost:5000/api/admin/users/${modalUser._id}`;
        method = "DELETE";
      }

      const response = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setToast({
          type: "success",
          text: data.message || `Operation completed successfully.`,
        });
        closeModal();
        const nextPage = (activeModal === "delete" && users.length === 1 && page > 1) ? page - 1 : page;
        if (nextPage !== page) {
          setPage(nextPage);
        }
        fetchUsers(nextPage, appliedSearch);
      } else {
        setToast({
          type: "error",
          text: data.message || `Operation failed.`,
        });
        closeModal();
      }
    } catch (error) {
      console.error(`Admin action error (${activeModal}):`, error);
      setToast({
        type: "error",
        text: "Unable to connect to the server.",
      });
      closeModal();
    } finally {
      setActionProcessing(false);
    }
  };

  const activeCount = users.filter((u) => !u.isBlocked).length;
  const blockedCount = users.filter((u) => u.isBlocked).length;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="admin-dashboard-page">
      {/* ADMIN PERMANENT SIDEBAR (REFERENCE 2) */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* MAIN CONTAINER (OFFSET RIGHT FOR SIDEBAR) */}
      <div className="admin-main-wrapper">
        {/* EXECUTIVE TOP COMMAND BAR (REFERENCE 2 MATCH) */}
        <nav className="admin-command-bar">
          <div className="command-bar-left">
            <button
              className="admin-hamburger-btn"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            >
              ☰
            </button>
            <div className="command-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search orders, SKU, or users... (⌘K)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit(e);
                }}
              />
            </div>
          </div>

          <div className="command-bar-right">
            <button className="command-btn telemetry-btn">
              <span>🎛️</span> TELEMETRY
            </button>
            <button className="command-btn batch-btn">
              <span>+</span> NEW FORMULA BATCH
            </button>
            <button className="command-btn notif-btn" title="Notifications">
              <span>🔔</span>
              <span className="notif-count">3</span>
            </button>

            <div className="admin-user-pill">
              <div className="admin-user-avatar">
                {admin?.name ? admin.name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="admin-user-details">
                <span className="admin-user-name">{admin?.name || "Master Perfumer"}</span>
                <span className="admin-user-role">Superuser / Admin</span>
              </div>
            </div>

            <button className="admin-top-logout" onClick={logoutAdmin}>
              LOGOUT
            </button>
          </div>
        </nav>

        {/* MAIN CONTENT AREA */}
        <main className="admin-main-container">
          {/* EXECUTIVE SUBHEADER & BREADCRUMB */}
          <div className="admin-executive-header">
            <div className="breadcrumb-line">
              <span>MAISON ATELIER</span> / <span>GLOBAL DISPATCH REALTIME</span>
            </div>
            <h1 className="executive-title">Executive Olfactory Command</h1>
            <div className="sync-badge">
              <span className="sync-dot"></span> LAST DISPATCH SYNC: 14:02:18 UTC
            </div>
          </div>

          {/* TOAST NOTIFICATION */}
          {toast && (
            <div className={toast.type === "success" ? "admin-toast-success" : "admin-toast-error"}>
              {toast.text}
            </div>
          )}

          {/* QUICK STATS */}
          <section className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-label">TOTAL REGISTERED USERS</span>
              <span className="admin-stat-value">{pagination.totalUsers}</span>
            </div>
            <div className="admin-stat-card active">
              <span className="admin-stat-label">CURRENT PAGE ACTIVE USERS</span>
              <span className="admin-stat-value">{activeCount}</span>
            </div>
            <div className="admin-stat-card blocked">
              <span className="admin-stat-label">CURRENT PAGE BLOCKED USERS</span>
              <span className="admin-stat-value">{blockedCount}</span>
            </div>
          </section>

          {/* SECTION HEADER & CONTROLS */}
          <div className="admin-section-header">
            <div className="admin-section-title">
              <h2>User Management</h2>
              <p>Create, view, search, edit, block, unblock and delete FEXA users.</p>
            </div>

            <div className="admin-controls-group">
              <button className="admin-create-user-btn" onClick={openCreateModal}>
                <span>+</span> ADD NEW USER
              </button>

              <form className="admin-search-form" onSubmit={handleSearchSubmit}>
                <div className="admin-search-wrapper">
                  <input
                    type="text"
                    placeholder="Search by name, email, phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="admin-search-input"
                  />
                </div>
                <button type="submit" className="admin-search-btn">
                  SEARCH
                </button>
                {(search || appliedSearch) && (
                  <button
                    type="button"
                    className="admin-clear-btn"
                    onClick={handleClearSearch}
                  >
                    ✕ Clear
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* USERS TABLE CARD */}
          <div className="admin-table-card">
            <div className="admin-table-scroll-wrapper">
              <table className="admin-users-table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>EMAIL</th>
                  <th>PHONE</th>
                  <th>STATUS</th>
                  <th>JOINED DATE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="admin-loading-row">
                      Loading users list...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="admin-empty-row">
                      {appliedSearch
                        ? `No users found matching "${appliedSearch}"`
                        : "No registered users found."}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = admin?.id === u._id || admin?._id === u._id;
                    const isGoogleUser = u.authProvider === "google" || Boolean(u.googleId);

                    return (
                      <tr key={u._id}>
                        <td className="user-name-cell">{u.name || "N/A"}</td>
                        <td className="user-email-cell">
                          {u.email}
                          {isGoogleUser && (
                            <small style={{ color: "#4285f4", marginLeft: "6px" }}>(Google)</small>
                          )}
                        </td>
                        <td className="user-phone-cell">{u.phone || "Not added"}</td>
                        <td>
                          {u.isBlocked ? (
                            <span className="status-badge blocked">● Blocked</span>
                          ) : (
                            <span className="status-badge active">● Active</span>
                          )}
                        </td>
                        <td>{formatDate(u.createdAt)}</td>
                        <td>
                          {isSelf ? (
                            <span className="action-self-label">Current Admin</span>
                          ) : (
                            <div className="admin-actions-cell">
                              <button
                                className="action-edit-btn"
                                onClick={() => openEditModal(u)}
                              >
                                EDIT
                              </button>

                              {u.isBlocked ? (
                                <button
                                  className="action-unblock-btn"
                                  onClick={() => openConfirmModal(u, "unblock")}
                                >
                                  UNBLOCK
                                </button>
                              ) : (
                                <button
                                  className="action-block-btn"
                                  onClick={() => openConfirmModal(u, "block")}
                                >
                                  BLOCK
                                </button>
                              )}

                              <button
                                className="action-delete-btn"
                                onClick={() => openConfirmModal(u, "delete")}
                              >
                                DELETE
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>

            {/* PAGINATION CONTROLS */}
            {!loading && (
              <AdminPagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalUsers}
                pageSize={pagination.limit || 10}
                itemName="users"
                onPageChange={handlePageChange}
                loading={loading}
                variant="card-footer"
              />
            )}
          </div>
        </main>
      </div>

      {/* CREATE USER MODAL */}
      {activeModal === "create" && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Create New User</h3>
            </div>
            {modalErrors.general && (
              <div className="admin-toast-error" style={{ marginBottom: "16px" }}>
                {modalErrors.general}
              </div>
            )}
            <form onSubmit={handleCreateSubmit} className="admin-modal-form">
              <div className="admin-modal-field">
                <label>FULL NAME</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                {modalErrors.name && (
                  <span className="modal-field-error">{modalErrors.name}</span>
                )}
              </div>

              <div className="admin-modal-field">
                <label>EMAIL ADDRESS</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
                {modalErrors.email && (
                  <span className="modal-field-error">{modalErrors.email}</span>
                )}
              </div>

              <div className="admin-modal-field">
                <label>PHONE NUMBER (OPTIONAL)</label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="admin-modal-field">
                <label>PASSWORD</label>
                <input
                  type="password"
                  placeholder="Create user password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                {modalErrors.password && (
                  <span className="modal-field-error">{modalErrors.password}</span>
                )}
              </div>

              <div className="admin-modal-actions" style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={closeModal}
                  disabled={actionProcessing}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="modal-submit-btn"
                  disabled={actionProcessing}
                >
                  {actionProcessing ? "CREATING..." : "CREATE USER"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {activeModal === "edit" && modalUser && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Edit User Details</h3>
            </div>
            {modalErrors.general && (
              <div className="admin-toast-error" style={{ marginBottom: "16px" }}>
                {modalErrors.general}
              </div>
            )}
            <form onSubmit={handleEditSubmit} className="admin-modal-form">
              <div className="admin-modal-field">
                <label>FULL NAME</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                {modalErrors.name && (
                  <span className="modal-field-error">{modalErrors.name}</span>
                )}
              </div>

              <div className="admin-modal-field">
                <label>EMAIL ADDRESS</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={modalUser.authProvider === "google" || Boolean(modalUser.googleId)}
                  required
                />
                {(modalUser.authProvider === "google" || Boolean(modalUser.googleId)) && (
                  <small style={{ color: "#4285f4" }}>
                    Email cannot be updated for accounts authenticated with Google.
                  </small>
                )}
                {modalErrors.email && (
                  <span className="modal-field-error">{modalErrors.email}</span>
                )}
              </div>

              <div className="admin-modal-field">
                <label>PHONE NUMBER</label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="admin-modal-actions" style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={closeModal}
                  disabled={actionProcessing}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="modal-submit-btn"
                  disabled={actionProcessing}
                >
                  {actionProcessing ? "SAVING..." : "SAVE CHANGES"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL (BLOCK / UNBLOCK / DELETE) */}
      {(activeModal === "block" || activeModal === "unblock" || activeModal === "delete") && modalUser && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>
                {activeModal === "block"
                  ? "Confirm Block User"
                  : activeModal === "unblock"
                  ? "Confirm Unblock User"
                  : "Confirm Delete User"}
              </h3>
            </div>
            <div className="admin-modal-body">
              <p>
                Are you sure you want to <strong>{activeModal}</strong> user{" "}
                <strong>"{modalUser.name || modalUser.email}"</strong>?
                {activeModal === "block" &&
                  " This user will be immediately logged out and prevented from signing into FEXA."}
                {activeModal === "unblock" &&
                  " This user will regain access to their FEXA account."}
                {activeModal === "delete" &&
                  " This user account will be permanently deleted from the database. This action cannot be undone."}
              </p>
            </div>
            <div className="admin-modal-actions">
              <button
                className="modal-cancel-btn"
                onClick={closeModal}
                disabled={actionProcessing}
              >
                CANCEL
              </button>
              <button
                className={
                  activeModal === "delete"
                    ? "modal-confirm-delete-btn"
                    : activeModal === "block"
                    ? "modal-confirm-block-btn"
                    : "modal-confirm-unblock-btn"
                }
                onClick={handleConfirmAction}
                disabled={actionProcessing}
              >
                {actionProcessing
                  ? "PROCESSING..."
                  : activeModal === "delete"
                  ? "CONFIRM DELETE"
                  : activeModal === "block"
                  ? "CONFIRM BLOCK"
                  : "CONFIRM UNBLOCK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
