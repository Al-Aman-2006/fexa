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
      {/* ================= NAVBAR ================= */}
      <Navbar activePage="home" />


      {/* ================= MAIN ================= */}

      <main className="home-content">

        <section className="welcome-section">

          <span className="small-label">
            WELCOME TO FEXA
          </span>

          <h2>
            The Art of
            <br />
            Fragrance
          </h2>

          <p>
            Discover a world of refined fragrances,
            carefully created for unforgettable moments.
          </p>

          <button className="explore-button" onClick={() => navigate("/collections")}>
            EXPLORE COLLECTION
            <span>→</span>
          </button>

        </section>


        {/* Simple feature cards */}

        <section className="home-features">

          <div className="feature-card">
            <span>01</span>

            <h3>
              Signature
              <br />
              Fragrances
            </h3>

            <p>
              Explore scents crafted with
              exceptional ingredients.
            </p>
          </div>


          <div className="feature-card">
            <span>02</span>

            <h3>
              Haute
              <br />
              Parfumerie
            </h3>

            <p>
              A collection inspired by the
              art of fine perfumery.
            </p>
          </div>


          <div className="feature-card">
            <span>03</span>

            <h3>
              Your
              <br />
              Collection
            </h3>

            <p>
              Save and discover fragrances
              made for your taste.
            </p>
          </div>

        </section>


        {/* Authentication status */}

        <section className="auth-status">

          <span className="status-dot"></span>

          <div>
            <strong>You are logged in</strong>

            <p>
              Welcome back, {user?.name || "User"}.
            </p>
          </div>

        </section>


        {/* Logout */}

        <button
          className="logout-button"
          onClick={handleLogout}
        >
          SIGN OUT
        </button>

      </main>


      {/* ================= FOOTER ================= */}

      <footer className="home-footer">

        <span>FEXA</span>

        <span>•</span>

        <span>CRAFTED FOR THE SENSES</span>

      </footer>

    </div>
  );
}

export default Home;