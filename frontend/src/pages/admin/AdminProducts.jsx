import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import AdminSidebar from "../../components/admin/AdminSidebar";
import ProductFormModal from "../../components/admin/ProductFormModal";
import ProductViewModal from "../../components/admin/ProductViewModal";
import DeleteProductModal from "../../components/admin/DeleteProductModal";
import "./AdminDashboard.css";
import "./AdminProducts.css";

const CATEGORY_TABS = [
  { id: "All", label: "ALL PRODUCTS", icon: "🧪", countKey: "all" },
  { id: "Men", label: "MEN", icon: "🎩", countKey: "men" },
  { id: "Women", label: "WOMEN", icon: "🌸", countKey: "women" },
  { id: "Unisex", label: "UNISEX", icon: "✨", countKey: "unisex" },
];

function AdminProducts() {
  const { admin, logoutAdmin } = useAdminAuth();
  const location = useLocation();

  // Active Category Tab: "All" | "Men" | "Women" | "Unisex" (Defaults to "All")
  const [activeCategoryTab, setActiveCategoryTab] = useState("All");

  const [products, setProducts] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({
    all: 0,
    men: 0,
    women: 0,
    unisex: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalProducts: 0,
    totalPages: 1,
  });

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  // Loading & Feedback states
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  // Sidebar state
  const [activeTab, setActiveTab] = useState("products");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modal State: null | "create" | "edit" | "view" | "delete"
  const [activeModal, setActiveModal] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Request race-condition tracking
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (location.pathname === "/admin/products") {
      setActiveTab("products");
    }
  }, [location.pathname]);

  // Debounce search input (350ms)
  useEffect(() => {
    setSearchLoading(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setSearchLoading(false);
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Products from MongoDB
  const fetchProducts = useCallback(
    async (targetCategory, targetPage, targetSearch, targetStatus) => {
      const currentReqId = ++requestIdRef.current;

      try {
        setLoading(true);
        setFetchError(null);

        const queryParams = new URLSearchParams({
          page: targetPage,
          limit: 10,
        });

        if (targetCategory && targetCategory !== "All") {
          queryParams.set("category", targetCategory);
        }

        if (targetSearch) {
          queryParams.set("search", targetSearch);
        }

        if (targetStatus && targetStatus !== "All") {
          queryParams.set("status", targetStatus);
        }

        const response = await fetch(
          `http://localhost:5000/api/admin/products?${queryParams.toString()}`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (currentReqId !== requestIdRef.current) return;

        const data = await response.json();

        if (response.ok && data.success) {
          setProducts(data.products || []);
          setPagination(
            data.pagination || { page: 1, limit: 10, totalProducts: 0, totalPages: 1 }
          );
          if (data.categoryCounts) {
            setCategoryCounts(data.categoryCounts);
          } else {
            // Fallback: fetch category counts from public products endpoint
            try {
              const countRes = await fetch("http://localhost:5000/api/products?limit=1");
              const countData = await countRes.json();
              if (countData?.categoryCounts) {
                setCategoryCounts(countData.categoryCounts);
              }
            } catch (cErr) {
              console.warn("Could not fetch category counts fallback:", cErr);
            }
          }
        } else {
          setFetchError(data.message || "Unable to fetch product catalogue.");
        }
      } catch (err) {
        if (currentReqId !== requestIdRef.current) return;
        console.error("Fetch admin products error:", err);
        setFetchError("Unable to connect to the server. Please ensure the backend is running.");
      } finally {
        if (currentReqId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Refetch products when category, page, search, or status filter changes
  useEffect(() => {
    fetchProducts(activeCategoryTab, page, debouncedSearch, statusFilter);
  }, [fetchProducts, activeCategoryTab, page, debouncedSearch, statusFilter]);

  // Tab click handler
  const handleTabClick = (tabId) => {
    if (tabId === activeCategoryTab) return;
    setActiveCategoryTab(tabId);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
    }
  };

  // Status Filter Change
  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  // Toggle Product Status (Activate / Deactivate)
  const handleToggleStatus = async (prod) => {
    try {
      setToast(null);
      const response = await fetch(
        `http://localhost:5000/api/admin/products/${prod._id}/status`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setToast({
          type: "success",
          text: data.message || `Status updated to ${data.product.status}.`,
        });
        fetchProducts(activeCategoryTab, page, debouncedSearch, statusFilter);
      } else {
        setToast({
          type: "error",
          text: data.message || "Failed to update product status.",
        });
      }
    } catch (err) {
      console.error("Toggle product status error:", err);
      setToast({
        type: "error",
        text: "Network error while toggling product status.",
      });
    }
  };

  // Delete Action Confirmation
  const handleConfirmDelete = async (prod) => {
    try {
      setIsDeleting(true);
      setToast(null);

      const response = await fetch(
        `http://localhost:5000/api/admin/products/${prod._id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setToast({
          type: "success",
          text: data.message || "Product deleted successfully.",
        });
        setActiveModal(null);
        setSelectedProduct(null);
        fetchProducts(activeCategoryTab, page, debouncedSearch, statusFilter);
      } else {
        setToast({
          type: "error",
          text: data.message || "Failed to delete product.",
        });
      }
    } catch (err) {
      console.error("Delete product error:", err);
      setToast({
        type: "error",
        text: "Network error while deleting product.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Callback on successful create or edit in ProductFormModal
  const handleFormSuccess = (savedProduct, mode) => {
    setToast({
      type: "success",
      text:
        mode === "create"
          ? `Product "${savedProduct.name}" created successfully in ${savedProduct.category}.`
          : `Product "${savedProduct.name}" updated successfully.`,
    });
    fetchProducts(activeCategoryTab, page, debouncedSearch, statusFilter);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Quick Stats
  const activeCount = products.filter((p) => p.status === "Active").length;
  const outOfStockCount = products.filter(
    (p) => p.stock === 0 || p.status === "Out of Stock"
  ).length;
  const inactiveCount = products.filter((p) => p.status === "Inactive").length;

  return (
    <div className="admin-dashboard-page">
      {/* SIDEBAR NAVIGATION */}
      <AdminSidebar
        activeTab="products"
        setActiveTab={setActiveTab}
        onLogout={logoutAdmin}
        isMobileOpen={isMobileSidebarOpen}
        setIsMobileOpen={setIsMobileSidebarOpen}
      />

      {/* MAIN CONTENT AREA */}
      <div className="admin-main-wrapper">
        {/* EXECUTIVE TOP COMMAND BAR */}
        <nav className="admin-command-bar">
          <div className="command-bar-left">
            <button
              className="admin-hamburger-btn"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              aria-label="Toggle mobile menu"
            >
              ☰
            </button>
            <div className="breadcrumb-line">
              <span className="breadcrumb-root">FEXA CONTROL</span> /{" "}
              <span className="breadcrumb-current">PRODUCT CATALOGUE</span>
            </div>
          </div>

          <div className="command-bar-right">
            <button
              type="button"
              className="command-btn batch-btn"
              onClick={() => {
                setSelectedProduct(null);
                setActiveModal("create");
              }}
            >
              <span>+</span> NEW FRAGRANCE
            </button>

            <div className="admin-user-pill">
              <div className="admin-user-avatar">
                {(admin?.name || "A").charAt(0).toUpperCase()}
              </div>
              <div className="admin-user-details">
                <span className="admin-user-name">{admin?.name || "Fexa Admin"}</span>
                <span className="admin-user-role">ROOT ADMIN</span>
              </div>
            </div>

            <button type="button" className="admin-top-logout" onClick={logoutAdmin}>
              LOGOUT
            </button>
          </div>
        </nav>

        {/* NOTIFICATION TOAST */}
        {toast && (
          <div className={`admin-toast-banner ${toast.type}`}>
            <span className="toast-icon">{toast.type === "success" ? "✓" : "⚠"}</span>
            <span className="toast-text">{toast.text}</span>
            <button
              className="toast-close-btn"
              onClick={() => setToast(null)}
              aria-label="Dismiss toast"
            >
              ✕
            </button>
          </div>
        )}

        <main className="admin-main-container">
          {/* EXECUTIVE SUBHEADER & BREADCRUMB */}
          <div className="admin-executive-header">
            <div className="breadcrumb-line">
              <span>MAISON ATELIER</span> / <span>GLOBAL DISPATCH REALTIME</span>
            </div>
            <h1 className="executive-title">Catalogue Olfactory Command</h1>
            <div className="sync-badge">
              <span className="sync-dot"></span> LIVE CATALOGUE SYSTEM
            </div>
          </div>
          {/* QUICK STATS GRID */}
          <section className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-label">TOTAL CATALOGUE PRODUCTS</span>
              <span className="admin-stat-value">{categoryCounts.all}</span>
            </div>
            <div className="admin-stat-card active">
              <span className="admin-stat-label">ACTIVE / AVAILABLE</span>
              <span className="admin-stat-value">{activeCount}</span>
            </div>
            <div className="admin-stat-card blocked">
              <span className="admin-stat-label">OUT OF STOCK</span>
              <span className="admin-stat-value">{outOfStockCount}</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-label">INACTIVE PRODUCTS</span>
              <span className="admin-stat-value">{inactiveCount}</span>
            </div>
          </section>

          {/* SECTION HEADER */}
          <div className="admin-section-header">
            <div className="admin-section-title">
              <h2>Product & Category Management</h2>
              <p>Unified fragrance catalogue, category distribution, search, and inventory controls.</p>
            </div>
          </div>

          {/* UNIFIED CATEGORY TABS: ALL PRODUCTS | MEN | WOMEN | UNISEX */}
          <div className="category-tabs-nav" role="tablist">
            {CATEGORY_TABS.map((tab) => {
              const count = categoryCounts[tab.countKey] || 0;
              const isActive = activeCategoryTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`category-tab-btn ${isActive ? "active" : ""}`}
                  onClick={() => handleTabClick(tab.id)}
                >
                  <span className="category-tab-icon">{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span className="category-count-badge">{count}</span>
                </button>
              );
            })}
          </div>

          {/* TOOLBAR: SEARCH, STATUS FILTER, AND ADD PRODUCT */}
          <div className="category-toolbar">
            {/* Search Input with 350ms Debounce */}
            <div className="category-search-wrapper">
              <span className="search-leading-icon">🔍</span>
              <input
                type="text"
                className="category-search-input"
                placeholder={
                  activeCategoryTab === "All"
                    ? "Search all fragrances by name or brand..."
                    : `Search ${activeCategoryTab} fragrances by name or brand...`
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searchLoading && <span className="search-spinner-inline" />}
              {search && (
                <button
                  type="button"
                  className="search-clear-cross"
                  onClick={handleClearSearch}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Right Controls: Status Filter & Add Product */}
            <div className="category-actions-right">
              <select
                className="admin-filter-select"
                value={statusFilter}
                onChange={handleStatusFilterChange}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>

              <button
                type="button"
                className="admin-create-user-btn"
                onClick={() => {
                  setSelectedProduct(null);
                  setActiveModal("create");
                }}
              >
                <span>+</span>
                <span>
                  ADD{" "}
                  {activeCategoryTab === "All"
                    ? "PRODUCT"
                    : `${activeCategoryTab.toUpperCase()} PRODUCT`}
                </span>
              </button>
            </div>
          </div>

          {/* FETCH ERROR BANNER */}
          {fetchError && (
            <div className="admin-toast-banner error">
              <span>⚠ {fetchError}</span>
              <button
                type="button"
                className="empty-state-btn"
                style={{ marginLeft: "auto" }}
                onClick={() =>
                  fetchProducts(activeCategoryTab, page, debouncedSearch, statusFilter)
                }
              >
                Retry
              </button>
            </div>
          )}

          {/* PRODUCTS TABLE CARD */}
          <div className="admin-table-card">
            {/* Scroll wrapper: ONLY the table scrolls horizontally; pagination stays outside */}
            <div className="admin-table-scroll-wrapper">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>IMAGE</th>
                  <th>PRODUCT NAME</th>
                  <th>BRAND</th>
                  <th>CATEGORY</th>
                  <th>PRICE</th>
                  <th>STOCK</th>
                  <th>STATUS</th>
                  <th>CREATED DATE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="admin-loading-row">
                      Loading{" "}
                      {activeCategoryTab === "All"
                        ? "catalogue products"
                        : `${activeCategoryTab} products`}
                      ...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ padding: "0" }}>
                      <div className="category-empty-state">
                        <span className="empty-state-icon">⚗️</span>
                        <h4 className="empty-state-title">
                          {debouncedSearch
                            ? `No products found matching "${debouncedSearch}"${
                                activeCategoryTab !== "All"
                                  ? ` in ${activeCategoryTab}`
                                  : ""
                              }`
                            : activeCategoryTab === "All"
                            ? "No products found in the catalogue."
                            : `No products found in ${activeCategoryTab} category.`}
                        </h4>
                        <p className="empty-state-sub">
                          {debouncedSearch
                            ? "Check your spelling, try different keywords, or clear the search filter."
                            : "Click '+ ADD PRODUCT' to add your first fragrance to this collection."}
                        </p>
                        {debouncedSearch ? (
                          <button
                            type="button"
                            className="empty-state-btn"
                            onClick={handleClearSearch}
                          >
                            Clear Search Filter
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="empty-state-btn"
                            onClick={() => {
                              setSelectedProduct(null);
                              setActiveModal("create");
                            }}
                          >
                            + Add New Product
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => {
                    const primaryImage =
                      prod.images && prod.images.length > 0
                        ? prod.images[0].startsWith("http")
                          ? prod.images[0]
                          : `http://localhost:5000${prod.images[0]}`
                        : null;

                    return (
                      <tr key={prod._id}>
                        <td>
                          <div className="product-img-thumbnail">
                            {primaryImage ? (
                              <img src={primaryImage} alt={prod.name} />
                            ) : (
                              <span className="no-img-icon">⚗️</span>
                            )}
                          </div>
                        </td>
                        <td className="user-name-cell">
                          <div>{prod.name}</div>
                          {prod.slug && <small className="product-slug-sub">/{prod.slug}</small>}
                        </td>
                        <td>{prod.brand || "FEXA"}</td>
                        <td>
                          <span className="category-pill">{prod.category}</span>
                        </td>
                        <td className="product-price-cell">
                          {prod.variants && prod.variants.length > 1 ? (
                            <>
                              <span>From {formatCurrency(Math.min(...prod.variants.map((v) => Number(v.sellingPrice))))}</span>
                              <span className="compare-price-sub">
                                {prod.variants.length} sizes configured
                              </span>
                            </>
                          ) : (
                            <>
                              {formatCurrency(prod.price)}
                              {prod.compareAtPrice > prod.price && (
                                <span className="compare-price-sub">
                                  {formatCurrency(prod.compareAtPrice)}
                                </span>
                              )}
                            </>
                          )}
                        </td>
                        <td>
                          {prod.stock === 0 ? (
                            <span className="stock-pill zero">0 (Out of Stock)</span>
                          ) : prod.stock <= 5 ? (
                            <span className="stock-pill low">{prod.stock} (Low Stock)</span>
                          ) : (
                            <span className="stock-pill in-stock">{prod.stock} in stock</span>
                          )}
                        </td>
                        <td>
                          {prod.status === "Active" && (
                            <span className="status-badge active">● Active</span>
                          )}
                          {prod.status === "Inactive" && (
                            <span className="status-badge blocked">● Inactive</span>
                          )}
                          {prod.status === "Out of Stock" && (
                            <span className="status-badge out-of-stock">● Out of Stock</span>
                          )}
                        </td>
                        <td>{formatDate(prod.createdAt)}</td>
                        <td>
                          <div className="admin-actions-cell">
                            <button
                              type="button"
                              className="action-view-btn"
                              onClick={() => {
                                setSelectedProduct(prod);
                                setActiveModal("view");
                              }}
                            >
                              VIEW
                            </button>

                            <button
                              type="button"
                              className="action-edit-btn"
                              onClick={() => {
                                setSelectedProduct(prod);
                                setActiveModal("edit");
                              }}
                            >
                              EDIT
                            </button>

                            {prod.stock > 0 && (
                              <button
                                type="button"
                                className={
                                  prod.status === "Active"
                                    ? "action-block-btn"
                                    : "action-unblock-btn"
                                }
                                onClick={() => handleToggleStatus(prod)}
                              >
                                {prod.status === "Active" ? "DEACTIVATE" : "ACTIVATE"}
                              </button>
                            )}

                            <button
                              type="button"
                              className="action-delete-btn"
                              onClick={() => {
                                setSelectedProduct(prod);
                                setActiveModal("delete");
                              }}
                            >
                              DELETE
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>{/* end admin-table-scroll-wrapper */}

            {/* PAGINATION CONTROLS */}
            {!loading && pagination.totalPages > 1 && (
              <div className="admin-pagination-container">
                <div className="admin-pagination-info">
                  Showing page <strong>{pagination.page}</strong> of{" "}
                  <strong>{pagination.totalPages}</strong> ({pagination.totalProducts} total products)
                </div>

                <div className="admin-pagination-controls">
                  <button
                    className="page-nav-btn"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    PREVIOUS
                  </button>

                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      className={`page-num-btn ${pageNum === pagination.page ? "active" : ""}`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    className="page-nav-btn"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CREATE & EDIT PRODUCT MODAL */}
      <ProductFormModal
        isOpen={activeModal === "create" || activeModal === "edit"}
        mode={activeModal === "edit" ? "edit" : "create"}
        product={selectedProduct}
        initialCategory={activeCategoryTab === "All" ? "Men" : activeCategoryTab}
        onClose={() => {
          setActiveModal(null);
          setSelectedProduct(null);
        }}
        onSuccess={handleFormSuccess}
      />

      {/* VIEW PRODUCT MODAL */}
      <ProductViewModal
        isOpen={activeModal === "view"}
        product={selectedProduct}
        onClose={() => {
          setActiveModal(null);
          setSelectedProduct(null);
        }}
        onEdit={(prod) => {
          setSelectedProduct(prod);
          setActiveModal("edit");
        }}
      />

      {/* DELETE PRODUCT CONFIRMATION MODAL */}
      <DeleteProductModal
        isOpen={activeModal === "delete"}
        product={selectedProduct}
        onClose={() => {
          if (!isDeleting) {
            setActiveModal(null);
            setSelectedProduct(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}

export default AdminProducts;
