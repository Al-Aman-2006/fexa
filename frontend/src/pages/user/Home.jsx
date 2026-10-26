import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/common/Navbar";
import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="home-page">
      {/* ── Navbar ── */}
      <Navbar activePage="home" />

      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="home-hero-inner">
          {/* Left: Editorial Copy */}
          <div className="home-hero-content">
            <span className="home-eyebrow">Welcome to Fexa</span>
            <h1 className="home-hero-title">
              The Art of<br />
              <em>Fragrance.</em>
            </h1>
            <p className="home-hero-desc">
              Discover a world of refined fragrances, carefully crafted for
              unforgettable moments. Explore curated Men's, Women's, and
              Unisex collections.
            </p>
            <div className="home-hero-actions">
              <button
                className="home-btn-primary"
                onClick={() => navigate("/collections")}
              >
                EXPLORE COLLECTION
                <span className="btn-arrow">→</span>
              </button>
              <button
                className="home-btn-secondary"
                onClick={() => navigate("/about")}
              >
                OUR STORY
              </button>
            </div>
          </div>

          {/* Right: Welcome Card */}
          <div className="home-welcome-card">
            <span className="welcome-card-tag">Patron Privé</span>
            <p className="welcome-card-greeting">
              Welcome back,<br />
              <strong>{user?.name || "Valued Patron"}.</strong>
            </p>

            <div className="welcome-status-row">
              <span className="status-dot"></span>
              <span className="status-text">
                <strong>Signed in</strong> — your collection awaits.
              </span>
            </div>

            <div className="welcome-quick-links">
              <button
                className="quick-link-btn"
                onClick={() => navigate("/collections")}
              >
                <span>Browse Fragrances</span>
                <span className="ql-arrow">→</span>
              </button>
              <button
                className="quick-link-btn"
                onClick={() => navigate("/profile")}
              >
                <span>My Profile & Orders</span>
                <span className="ql-arrow">→</span>
              </button>
              <button
                className="quick-link-btn"
                onClick={() => navigate("/wishlist")}
              >
                <span>My Wishlist</span>
                <span className="ql-arrow">→</span>
              </button>
            </div>

            <button className="welcome-logout-btn" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </section>

      {/* ── Features Strip ── */}
      <section className="home-features-strip">
        <div className="home-features-inner">
          <div className="feature-card">
            <span className="feature-num">01</span>
            <h3>Signature<br />Fragrances</h3>
            <p>
              Explore scents crafted with exceptional botanical ingredients
              and precious natural extracts.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-num">02</span>
            <h3>Haute<br />Parfumerie</h3>
            <p>
              A curated collection inspired by the art of fine perfumery and
              olfactory mastery.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-num">03</span>
            <h3>Your<br />Collection</h3>
            <p>
              Save fragrances to your wishlist and discover scents made for
              your unique taste.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="home-footer">
        <span className="home-footer-brand">FEXA</span>
        <span className="home-footer-sep">•</span>
        <span className="home-footer-tagline">Crafted for the Senses</span>
      </footer>
    </div>
  );
}

export default Home;
