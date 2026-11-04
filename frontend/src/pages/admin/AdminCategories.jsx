import { useEffect, useState, useCallback } from "react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "./AdminDashboard.css";
import "./AdminCategories.css";

const API_BASE = "http://localhost:5000/api/admin/categories";

export default function AdminCategories() {
  const { admin, logoutAdmin } = useAdminAuth();

  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({
    totalParents: 0,
    totalChildren: 0,
    activeCount: 0,
    inactiveCount: 0,
  });

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [expandedParents, setExpandedParents] = useState({});

  // Sidebar state
  const [activeTab, setActiveTab] = useState("category-management");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal State
  // modalMode: null | "add-parent" | "edit-parent" | "add-child" | "edit-child" | "delete"
  const [modalMode, setModalMode] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [actionProcessing, setActionProcessing] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image: "",
    parentCategory: "",
    parentCategoryName: "",
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState({});

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch all categories and hierarchy
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) {
        setCategories(data.categories || []);
        if (data.stats) {
          setStats(data.stats);
        }
        // Expand all parents by default on initial load
        const initialExpanded = {};
        (data.categories || []).forEach((cat) => {
          initialExpanded[cat._id] = true;
        });
        setExpandedParents((prev) => (Object.keys(prev).length === 0 ? initialExpanded : prev));
      } else {
        showToast(data.message || "Failed to load categories.", "error");
      }
    } catch (err) {
      console.error("Fetch categories error:", err);
      showToast("Network error while loading categories.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const toggleExpand = (parentId) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }));
  };

  // Open Modal Helpers
  const handleOpenAddParent = () => {
    setFormData({
      name: "",
      description: "",
      image: "",
      parentCategory: "",
      parentCategoryName: "",
      isActive: true,
    });
    setFormErrors({});
    setSelectedCategory(null);
    setModalMode("add-parent");
  };

  const handleOpenEditParent = (parent) => {
    setFormData({
      name: parent.name,
      description: parent.description || "",
      image: parent.image || "",
      parentCategory: "",
      parentCategoryName: "",
      isActive: parent.isActive,
    });
    setFormErrors({});
    setSelectedCategory(parent);
    setModalMode("edit-parent");
  };

  const handleOpenAddChild = (parent) => {
    setFormData({
      name: "",
      description: "",
      image: "",
      parentCategory: parent._id,
      parentCategoryName: parent.name,
      isActive: true,
    });
    setFormErrors({});
    setSelectedCategory(null);
    setModalMode("add-child");
  };

  const handleOpenEditChild = (child, parent) => {
    setFormData({
      name: child.name,
      description: child.description || "",
      image: child.image || "",
      parentCategory: parent._id,
      parentCategoryName: parent.name,
      isActive: child.isActive,
    });
    setFormErrors({});
    setSelectedCategory(child);
    setModalMode("edit-child");
  };

  const handleOpenDelete = (cat) => {
    setSelectedCategory(cat);
    setModalMode("delete");
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setSelectedCategory(null);
    setFormErrors({});
    setActionProcessing(false);
  };

  // Form Field Validation
  const validateCategoryForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = "Category name is required.";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters.";
    } else if (formData.name.trim().length > 50) {
      errors.name = "Name cannot exceed 50 characters.";
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = "Description cannot exceed 500 characters.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Handler for Add & Edit
  const handleSubmitCategory = async (e) => {
    e.preventDefault();
    if (!validateCategoryForm()) return;

    setActionProcessing(true);
    try {
      const isEdit = modalMode === "edit-parent" || modalMode === "edit-child";
      const url = isEdit ? `${API_BASE}/${selectedCategory._id}` : API_BASE;
      const method = isEdit ? "PUT" : "POST";

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        image: formData.image.trim(),
        isActive: formData.isActive,
      };

      if (modalMode === "add-child" || modalMode === "edit-child") {
        payload.parentCategory = formData.parentCategory;
      } else {
        payload.parentCategory = null;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          isEdit
            ? `Category "${data.category?.name || formData.name}" updated successfully.`
            : `Category "${data.category?.name || formData.name}" created successfully.`,
          "success"
        );
        handleCloseModal();
        fetchCategories();
      } else {
        showToast(data.message || "Failed to save category.", "error");
        if (data.errors) {
          setFormErrors(data.errors);
        }
      }
    } catch (err) {
      console.error("Save category error:", err);
      showToast("Network error while saving category.", "error");
    } finally {
      setActionProcessing(false);
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = async (cat) => {
    try {
      const newStatus = !cat.isActive;
      const res = await fetch(`${API_BASE}/${cat._id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          `"${cat.name}" is now ${newStatus ? "Active" : "Inactive"}.`,
          "success"
        );
        fetchCategories();
      } else {
        showToast(data.message || "Failed to update status.", "error");
      }
    } catch (err) {
      console.error("Toggle status error:", err);
      showToast("Network error while updating status.", "error");
    }
  };

  // Safe Delete Handler
  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    setActionProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/${selectedCategory._id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Category "${selectedCategory.name}" removed successfully.`, "success");
        handleCloseModal();
        fetchCategories();
      } else {
        showToast(data.message || "Failed to delete category.", "error");
      }
    } catch (err) {
      console.error("Delete category error:", err);
      showToast("Network error while deleting category.", "error");
    } finally {
      setActionProcessing(false);
    }
  };

  // Filter categories by search
  const filteredCategories = categories.filter((parent) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchParent =
      parent.name.toLowerCase().includes(q) ||
      (parent.description && parent.description.toLowerCase().includes(q));
    const matchChildren = (parent.children || []).some(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
    return matchParent || matchChildren;
  });

  return (
    <div className="admin-dashboard-container">
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      <div className="admin-dashboard-main">
        {/* TOP BAR */}
        <div className="admin-dashboard-header">
          <div className="admin-header-left-group">
            <button
              type="button"
              className="mobile-menu-toggle-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Toggle sidebar menu"
            >
              ☰
            </button>
            <div className="admin-header-title-wrapper">
              <span className="admin-header-breadcrumb">MAISON ATELIER / DEPARTMENT ARCHITECTURE</span>
              <h1 className="admin-dashboard-title">CATEGORY MANAGEMENT</h1>
              <p className="admin-header-subtitle">
                Manage parent fragrance departments and olfactory subcategories.
              </p>
            </div>
          </div>

          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-create-user-btn"
              onClick={handleOpenAddParent}
            >
              <span>+</span>
              <span>ADD CATEGORY</span>
            </button>
          </div>
        </div>

        {/* TOAST FEEDBACK */}
        {toast && (
          <div className={`admin-toast-banner ${toast.type}`}>
            <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setToast(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* SUMMARY STATS BAR */}
        <div className="category-stats-grid">
          <div className="category-stat-card">
            <div className="stat-card-icon">🗂️</div>
            <div className="stat-card-info">
              <span className="stat-card-label">PARENT CATEGORIES</span>
              <strong className="stat-card-value">{stats.totalParents}</strong>
            </div>
          </div>
          <div className="category-stat-card">
            <div className="stat-card-icon">🌿</div>
            <div className="stat-card-info">
              <span className="stat-card-label">SUBCATEGORIES</span>
              <strong className="stat-card-value">{stats.totalChildren}</strong>
            </div>
          </div>
          <div className="category-stat-card">
            <div className="stat-card-icon">●</div>
            <div className="stat-card-info">
              <span className="stat-card-label">ACTIVE TAXONOMIES</span>
              <strong className="stat-card-value" style={{ color: "#75db8b" }}>
                {stats.activeCount}
              </strong>
            </div>
          </div>
          <div className="category-stat-card">
            <div className="stat-card-icon">○</div>
            <div className="stat-card-info">
              <span className="stat-card-label">INACTIVE TAXONOMIES</span>
              <strong className="stat-card-value" style={{ color: "#ff737d" }}>
                {stats.inactiveCount}
              </strong>
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="category-toolbar-card">
          <div className="category-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search parent or child categories by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-search-input"
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch("")}
              >
                ✕
              </button>
            )}
          </div>
          <span className="categories-count-indicator">
            Showing {filteredCategories.length} of {categories.length} parent collections
          </span>
        </div>

        {/* CATEGORIES ACCORDION LIST */}
        <div className="categories-accordion-wrapper">
          {loading ? (
            <div className="categories-loading-state">
              <div className="spinner"></div>
              <p>Loading fragrance categories...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="category-empty-state">
              <span className="empty-state-icon">🏷️</span>
              <h3>No Categories Found</h3>
              <p>
                {search
                  ? `No categories matching "${search}".`
                  : "Start structuring your fragrance collections by adding a parent category."}
              </p>
              {!search && (
                <button
                  type="button"
                  className="admin-create-user-btn"
                  onClick={handleOpenAddParent}
                  style={{ marginTop: "12px" }}
                >
                  + Add First Category
                </button>
              )}
            </div>
          ) : (
            filteredCategories.map((parent) => {
              const isExpanded = !!expandedParents[parent._id];
              const children = parent.children || [];

              return (
                <div
                  key={parent._id}
                  className={`parent-category-card ${!parent.isActive ? "parent-inactive" : ""}`}
                >
                  {/* PARENT HEADER */}
                  <div className="parent-card-header">
                    <div
                      className="parent-title-group"
                      onClick={() => toggleExpand(parent._id)}
                    >
                      <button
                        type="button"
                        className={`accordion-toggle-btn ${isExpanded ? "expanded" : ""}`}
                        aria-label="Toggle Subcategories"
                      >
                        ▶
                      </button>
                      <div className="parent-name-meta">
                        <div className="parent-title-row">
                          <h3 className="parent-name">{parent.name}</h3>
                          <span className="parent-slug-badge">/{parent.slug}</span>
                          <span
                            className={`category-status-pill ${
                              parent.isActive ? "active" : "inactive"
                            }`}
                          >
                            ● {parent.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {parent.description && (
                          <p className="parent-description">{parent.description}</p>
                        )}
                        <span className="parent-sub-count">
                          {children.length} subcategories • {parent.productCount || 0} products
                        </span>
                      </div>
                    </div>

                    <div className="parent-actions-group">
                      <button
                        type="button"
                        className="btn-action-add-sub"
                        onClick={() => handleOpenAddChild(parent)}
                        title={`Add subcategory under ${parent.name}`}
                      >
                        + Add Subcategory
                      </button>
                      <button
                        type="button"
                        className="btn-action-icon edit"
                        onClick={() => handleOpenEditParent(parent)}
                        title="Edit parent category"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className={`btn-action-icon status ${parent.isActive ? "deactivate" : "activate"}`}
                        onClick={() => handleToggleStatus(parent)}
                        title={parent.isActive ? "Deactivate parent" : "Activate parent"}
                      >
                        {parent.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className="btn-action-icon delete"
                        onClick={() => handleOpenDelete(parent)}
                        title="Delete category"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {/* CHILD SUBCATEGORIES ACCORDION CONTENT */}
                  {isExpanded && (
                    <div className="subcategories-panel">
                      <div className="subcategories-panel-header">
                        <span className="panel-title">
                          OLFACTORY SUBCATEGORIES UNDER {parent.name.toUpperCase()}
                        </span>
                        <span className="panel-note">
                          {!parent.isActive
                            ? "⚠️ Note: Parent is inactive. These subcategories are hidden from the storefront."
                            : "Subcategories active below are available on the customer boutique storefront."}
                        </span>
                      </div>

                      {children.length === 0 ? (
                        <div className="subcategories-empty">
                          <p>No subcategories yet under {parent.name}.</p>
                          <button
                            type="button"
                            className="btn-action-add-sub"
                            onClick={() => handleOpenAddChild(parent)}
                          >
                            + Add Subcategory
                          </button>
                        </div>
                      ) : (
                        <div className="subcategories-table-container">
                          <table className="subcategories-table">
                            <thead>
                              <tr>
                                <th>SUBCATEGORY NAME</th>
                                <th>SLUG</th>
                                <th>DESCRIPTION</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {children.map((child) => (
                                <tr
                                  key={child._id}
                                  className={!child.isActive ? "child-inactive" : ""}
                                >
                                  <td className="sub-name-cell">
                                    <span className="tree-leaf-bullet">↳</span>
                                    <strong>{child.name}</strong>
                                  </td>
                                  <td>
                                    <span className="sub-slug-tag">/{child.slug}</span>
                                  </td>
                                  <td className="sub-desc-cell">
                                    {child.description || "—"}
                                  </td>
                                  <td>
                                    <span
                                      className={`category-status-pill ${
                                        child.isActive ? "active" : "inactive"
                                      }`}
                                    >
                                      ● {child.isActive ? "Active" : "Inactive"}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="sub-row-actions">
                                      <button
                                        type="button"
                                        className="sub-btn edit"
                                        onClick={() => handleOpenEditChild(child, parent)}
                                        title="Edit subcategory"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className={`sub-btn status ${
                                          child.isActive ? "deactivate" : "activate"
                                        }`}
                                        onClick={() => handleToggleStatus(child)}
                                      >
                                        {child.isActive ? "Deactivate" : "Activate"}
                                      </button>
                                      <button
                                        type="button"
                                        className="sub-btn delete"
                                        onClick={() => handleOpenDelete(child)}
                                        title="Delete subcategory"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT CATEGORY OR SUBCATEGORY               */}
      {/* ======================================================== */}
      {(modalMode === "add-parent" ||
        modalMode === "edit-parent" ||
        modalMode === "add-child" ||
        modalMode === "edit-child") && (
        <div className="category-modal-backdrop" onClick={handleCloseModal}>
          <div
            className="category-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="category-modal-header">
              <h2>
                {modalMode === "add-parent" && "ADD PARENT CATEGORY"}
                {modalMode === "edit-parent" && `EDIT PARENT: ${selectedCategory?.name}`}
                {modalMode === "add-child" && `ADD SUBCATEGORY UNDER ${formData.parentCategoryName}`}
                {modalMode === "edit-child" && `EDIT SUBCATEGORY: ${selectedCategory?.name}`}
              </h2>
              <button
                type="button"
                className="category-modal-close"
                onClick={handleCloseModal}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCategory} className="category-modal-form">
              {/* If Child Category, show preselected parent category info */}
              {(modalMode === "add-child" || modalMode === "edit-child") && (
                <div className="modal-form-group">
                  <label>PARENT CATEGORY</label>
                  <div className="readonly-parent-display">
                    <span className="readonly-icon">🗂️</span>
                    <strong>{formData.parentCategoryName}</strong>
                    <span className="readonly-lock-badge">Assigned</span>
                  </div>
                </div>
              )}

              {/* Category Name */}
              <div className="modal-form-group">
                <label>
                  {modalMode.includes("child") ? "SUBCATEGORY NAME *" : "CATEGORY NAME *"}
                </label>
                <input
                  type="text"
                  placeholder={
                    modalMode.includes("child")
                      ? "e.g. Woody, Floral, Aquatic, Citrus..."
                      : "e.g. Men, Women, Unisex, Kids..."
                  }
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={formErrors.name ? "input-error" : ""}
                />
                {formErrors.name && (
                  <span className="modal-field-error">{formErrors.name}</span>
                )}
              </div>

              {/* Description */}
              <div className="modal-form-group">
                <label>DESCRIPTION (OPTIONAL)</label>
                <textarea
                  rows="3"
                  placeholder="Notes, mood, or fragrance profile description..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className={formErrors.description ? "input-error" : ""}
                ></textarea>
                {formErrors.description && (
                  <span className="modal-field-error">{formErrors.description}</span>
                )}
              </div>

              {/* Status Toggle */}
              <div className="modal-form-group">
                <label>INITIAL STATUS</label>
                <select
                  value={formData.isActive ? "Active" : "Inactive"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isActive: e.target.value === "Active",
                    })
                  }
                  className="admin-modal-select"
                >
                  <option value="Active">Active (Visible on Storefront)</option>
                  <option value="Inactive">Inactive (Hidden from Storefront)</option>
                </select>
                <small className="modal-help-text">
                  {modalMode.includes("parent")
                    ? "Deactivating a parent category automatically hides all its child categories on the storefront."
                    : "Deactivating a child category affects only this specific subcategory."}
                </small>
              </div>

              {/* Action Buttons */}
              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={handleCloseModal}
                  disabled={actionProcessing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn-submit"
                  disabled={actionProcessing}
                >
                  {actionProcessing ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DELETE CATEGORY CONFIRMATION                     */}
      {/* ======================================================== */}
      {modalMode === "delete" && selectedCategory && (
        <div className="category-modal-backdrop" onClick={handleCloseModal}>
          <div
            className="category-modal-card delete-warning"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="category-modal-header">
              <h2>DELETE CATEGORY</h2>
              <button
                type="button"
                className="category-modal-close"
                onClick={handleCloseModal}
              >
                ✕
              </button>
            </div>

            <div className="delete-modal-body">
              <span className="delete-warning-icon">⚠️</span>
              <h3>Are you sure you want to delete "{selectedCategory.name}"?</h3>
              <p>
                This action is permanent and cannot be undone.
              </p>
              <div className="delete-safety-notice">
                <strong>Safety Protection:</strong> If this category has active child
                subcategories or is assigned to catalogue products, the server will
                reject deletion to prevent orphaned products or data corruption.
              </div>
            </div>

            <div className="modal-actions-footer">
              <button
                type="button"
                className="modal-btn-cancel"
                onClick={handleCloseModal}
                disabled={actionProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn-danger"
                onClick={handleDeleteCategory}
                disabled={actionProcessing}
              >
                {actionProcessing ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

