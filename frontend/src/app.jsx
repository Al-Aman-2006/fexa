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
import ProductDetails from "./pages/user/ProductDetails";
import Cart from "./pages/user/Cart";
import Checkout from "./pages/user/Checkout";
import Wishlist from "./pages/user/Wishlist";
import About from "./pages/user/About";
import Contact from "./pages/user/Contact";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
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

                {/* Public Collections Route */}
                <Route path="/collections" element={<Collections />} />
                <Route path="/shop" element={<Collections />} />

                {/* Public Product Details Route */}
                <Route path="/products/:id" element={<ProductDetails />} />
                <Route path="/products" element={<Navigate to="/collections" replace />} />

                {/* Shopping Bag Route */}
                <Route path="/cart" element={<Cart />} />

                {/* Checkout Route */}
                <Route path="/checkout" element={<Checkout />} />

                {/* About Page Route */}
                <Route path="/about" element={<About />} />

                {/* Contact Page Routes */}
                <Route path="/contact" element={<Contact />} />
                <Route path="/contact-us" element={<Navigate to="/contact" replace />} />

              {/* User Protected Routes */}
              <Route 
                path="/home" 
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                } 
              />

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
                element={
                  <AdminProtectedRoute>
                    <AdminProducts />
                  </AdminProtectedRoute>
                }
              />

              <Route
                path="/admin/categories"
                element={<Navigate to="/admin/products" replace />}
              />

              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

              {/* Default page */}
              <Route path="*" element={<Navigate to="/login" replace />} />
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