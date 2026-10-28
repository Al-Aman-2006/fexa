import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { CartProvider } from "./context/CartContext";
import CartDrawer from "./components/cart/CartDrawer";
import { WishlistProvider } from "./context/WishlistContext";
import WishlistDrawer from "./components/wishlist/WishlistDrawer";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminPublicRoute from "./components/AdminPublicRoute";

import Login from "./pages/auth/login";
import Register from "./pages/auth/Register";
import VerifyOtp from "./pages/auth/VerifyOtp";
import Home from "./pages/user/Home";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Profile from "./pages/user/Profile";
import Collections from "./pages/user/Collections";
import MenCollection from "./pages/user/MenCollection";
import WomenCollection from "./pages/user/WomenCollection";
import UnisexCollection from "./pages/user/UnisexCollection";
import ProductDetails from "./pages/user/ProductDetails";
import Cart from "./pages/user/Cart";
import Checkout from "./pages/user/Checkout";
import Wishlist from "./pages/user/Wishlist";
import About from "./pages/user/About";
import Contact from "./pages/user/Contact";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminOffers from "./pages/admin/AdminOffers";
import AdminSales from "./pages/admin/AdminSales";
import AdminCategoryPage from "./pages/admin/AdminCategoryPage";
import AdminReviews from "./pages/admin/AdminReviews";
import ScrollToTop from "./components/common/ScrollToTop";
import ErrorBoundary from "./components/common/ErrorBoundary";

import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "820283850276-8fs6ffg5v8imran19v2a4ehvj7q4rb27.apps.googleusercontent.com";

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <CartProvider>
            <CartDrawer />
            <WishlistProvider>
              <WishlistDrawer />
              <AdminAuthProvider>
              <ErrorBoundary>
              <Routes>
                {/* User Login page */}
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

                {/* User Register page */}
                <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

                {/* User Verify OTP page */}
                <Route path="/verify-otp" element={<PublicRoute><VerifyOtp /></PublicRoute>} />

                {/* Public Collections Routes */}
                <Route path="/collections" element={<Collections />} />
                <Route path="/collections/men" element={<MenCollection />} />
                <Route path="/collections/women" element={<WomenCollection />} />
                <Route path="/collections/unisex" element={<UnisexCollection />} />
                <Route path="/shop" element={<Navigate to="/collections" replace />} />

                {/* Public Product Details Route */}
                <Route path="/products/:id" element={<ProductDetails />} />
                <Route path="/products" element={<Navigate to="/collections" replace />} />

                {/* Shopping Bag Route */}
                <Route path="/cart" element={<Cart />} />

                {/* Checkout Route */}
                <Route path="/checkout" element={<Checkout />} />

                {/* Central Brand Landing Page Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/home" element={<Home />} />

                {/* Legacy About & Contact redirects to Home sections */}
                <Route path="/about" element={<Navigate to="/home#about-section" replace />} />
                <Route path="/contact" element={<Navigate to="/home#contact-section" replace />} />
                <Route path="/contact-us" element={<Navigate to="/home#contact-section" replace />} />

              <Route 
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/wishlist"
                element={
                  <ProtectedRoute>
                    <Wishlist />
                  </ProtectedRoute>
                } 
              />

              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />

              {/* Admin Routes */}
              <Route
                path="/admin/login"
                element={
                  <AdminPublicRoute>
                    <AdminLogin />
                  </AdminPublicRoute>
                }
              />

              <Route
                path="/admin/dashboard"
                element={
                  <AdminProtectedRoute>
                    <AdminDashboard />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/users"
                element={
                  <AdminProtectedRoute>
                    <AdminDashboard />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/products"
                element={<Navigate to="/admin/categories/all" replace />}
              />

              <Route
                path="/admin/coupons"
                element={
                  <AdminProtectedRoute>
                    <AdminCoupons />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/offers"
                element={
                  <AdminProtectedRoute>
                    <AdminOffers />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/sales"
                element={
                  <AdminProtectedRoute>
                    <AdminSales />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/reviews"
                element={
                  <AdminProtectedRoute>
                    <AdminReviews />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/categories/all"
                element={
                  <AdminProtectedRoute>
                    <AdminCategoryPage category="All" />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/categories/men"
                element={
                  <AdminProtectedRoute>
                    <AdminCategoryPage category="Men" />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/categories/women"
                element={
                  <AdminProtectedRoute>
                    <AdminCategoryPage category="Women" />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/categories/unisex"
                element={
                  <AdminProtectedRoute>
                    <AdminCategoryPage category="Unisex" />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/categories"
                element={<Navigate to="/admin/categories/all" replace />}
              />

              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

              {/* Default page */}
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
            </ErrorBoundary>
          </AdminAuthProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
    </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;