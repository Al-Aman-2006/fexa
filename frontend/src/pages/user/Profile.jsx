import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ========================================
  // EDIT PROFILE STATES
  // ========================================

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // ========================================
  // PROFILE IMAGE STATES
  // ========================================

  const [uploadingImage, setUploadingImage] = useState(false);

  // ========================================
  // ADDRESS STATES
  // ========================================

  const [showAddressForm, setShowAddressForm] =
    useState(false);

  const [savingAddress, setSavingAddress] =
    useState(false);

  const [addressForm, setAddressForm] = useState({
    label: "Home",
    fullName: "",
    phone: "",
    house: "",
    street: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    isDefault: false,
  });

  // ========================================
  // FETCH PROFILE
  // ========================================

  const fetchProfile = async () => {
    try {
      

      

      const response = await fetch(
        "http://localhost:5000/api/profile",
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          

          navigate("/login");
          return;
        }

        setError(
          data.message ||
            "Unable to load profile."
        );

        return;
      }

      setUser(data.user);

      setName(data.user.name || "");
      setPhone(data.user.phone || "");
    } catch (error) {
      console.error(
        "Profile error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // ========================================
  // EDIT PROFILE
  // ========================================

  const handleEdit = () => {
    setName(user?.name || "");
    setPhone(user?.phone || "");

    setSuccessMessage("");
    setError("");

    setIsEditing(true);
  };

  // ========================================
  // CANCEL PROFILE EDIT
  // ========================================

  const handleCancel = () => {
    setName(user?.name || "");
    setPhone(user?.phone || "");

    setIsEditing(false);
    setError("");
  };

  // ========================================
  // SAVE PROFILE
  // ========================================

  const handleSave = async () => {
    try {
      setError("");
      setSuccessMessage("");

      if (!name.trim()) {
        setError("Name cannot be empty.");
        return;
      }

      

      setSaving(true);

      const response = await fetch(
        "http://localhost:5000/api/profile",
        {
          method: "PUT",

          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          

          navigate("/login");
          return;
        }

        setError(
          data.message ||
            "Unable to update profile."
        );

        return;
      }

      // Update profile on screen
      setUser((previousUser) => ({
        ...previousUser,
        ...data.user,
      }));

      // Update localStorage
      const storedUser = null; // 
        localStorage.getItem("user");

      if (storedUser) {
        const parsedUser =
          JSON.parse(storedUser);

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...parsedUser,
            ...data.user,
          })
        );
      }

      setIsEditing(false);

      setSuccessMessage(
        "Profile updated successfully."
      );
    } catch (error) {
      console.error(
        "Update profile error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setSaving(false);
    }
  };

  // ========================================
  // PROFILE IMAGE UPLOAD
  // ========================================

  const handleImageChange = async (
    event
  ) => {
    const file =
      event.target.files[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Only JPG, JPEG, PNG and WEBP images are allowed."
      );

      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Image size must be less than 5MB."
      );

      event.target.value = "";
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      setUploadingImage(true);

      

      const formData = new FormData();

      formData.append(
        "profileImage",
        file
      );

      const response = await fetch(
        "http://localhost:5000/api/profile/upload-image",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          

          navigate("/login");
          return;
        }

        setError(
          data.message ||
            "Unable to upload profile image."
        );

        return;
      }

      const imageUrl =
        `http://localhost:5000${data.profileImage}`;

      setUser((previousUser) => ({
        ...previousUser,
        profileImage: imageUrl,
      }));

      const storedUser = null; // 
        localStorage.getItem("user");

      if (storedUser) {
        const parsedUser =
          JSON.parse(storedUser);

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...parsedUser,
            profileImage: imageUrl,
          })
        );
      }

      setSuccessMessage(
        "Profile picture updated successfully."
      );
    } catch (error) {
      console.error(
        "Profile image upload error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setUploadingImage(false);

      event.target.value = "";
    }
  };

  // ========================================
  // ADDRESS INPUT CHANGE
  // ========================================

  const handleAddressChange = (
    event
  ) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setAddressForm((previous) => ({
      ...previous,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  // ========================================
  // OPEN ADDRESS FORM
  // ========================================

  const openAddressForm = () => {
    setError("");
    setSuccessMessage("");

    setAddressForm({
      label: "Home",
      fullName: user?.name || "",
      phone: user?.phone || "",
      house: "",
      street: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      isDefault:
        !user?.addresses ||
        user.addresses.length === 0,
    });

    setShowAddressForm(true);
  };

  // ========================================
  // CLOSE ADDRESS FORM
  // ========================================

  const closeAddressForm = () => {
    setShowAddressForm(false);

    setAddressForm({
      label: "Home",
      fullName: "",
      phone: "",
      house: "",
      street: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      isDefault: false,
    });
  };

  // ========================================
  // ADD ADDRESS
  // ========================================

  const handleAddAddress = async (
    event
  ) => {
    event.preventDefault();

    try {
      setError("");
      setSuccessMessage("");
      setSavingAddress(true);

      

      const response = await fetch(
        "http://localhost:5000/api/profile/addresses",
        {
          method: "POST",

          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(
            addressForm
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await logout();
          

          navigate("/login");
          return;
        }

        setError(
          data.message ||
            "Unable to add address."
        );

        return;
      }

      // Update addresses on screen
      setUser((previousUser) => ({
        ...previousUser,
        addresses: data.addresses,
      }));

      closeAddressForm();

      setSuccessMessage(
        "Address added successfully."
      );
    } catch (error) {
      console.error(
        "Add address error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setSavingAddress(false);
    }
  };

  // ========================================
  // LOGOUT
  // ========================================

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <main className="profile-page">
        <div className="profile-loading">
          Loading profile...
        </div>
      </main>
    );
  }

  // ========================================
  // ERROR
  // ========================================

  if (error && !user) {
    return (
      <main className="profile-page">
        <div className="profile-error">
          <h2>
            Something went wrong
          </h2>

          <p>{error}</p>

          <button
            onClick={() =>
              navigate("/home")
            }
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-page">

      {/* ========================================
          NAVBAR
      ======================================== */}

      <nav className="profile-navbar">

        <div
          className="profile-logo"
          onClick={() =>
            navigate("/home")
          }
        >
          FEXA
        </div>

        <div className="profile-nav-links">

          <button
            onClick={() =>
              navigate("/home")
            }
          >
            HOME
          </button>

          <button>
            SHOP
          </button>

          <button>
            COLLECTIONS
          </button>

          <button>
            ABOUT
          </button>

        </div>

        <div className="profile-nav-actions">

          <button className="profile-nav-user">
            ◯
          </button>

          <button
            className="profile-logout"
            onClick={handleLogout}
          >
            LOGOUT
          </button>

        </div>

      </nav>

      {/* ========================================
          MAIN CONTENT
      ======================================== */}

      <section className="profile-content">

        <div className="profile-heading">

          <span>
            FEXA ACCOUNT
          </span>

          <h1>
            My Profile
          </h1>

          <p>
            Manage your personal information
            and account details.
          </p>

        </div>

        {/* SUCCESS MESSAGE */}

        {successMessage && (
          <div className="profile-success">
            {successMessage}
          </div>
        )}

        {/* ERROR MESSAGE */}

        {error && (
          <div className="profile-form-error">
            {error}
          </div>
        )}

        {/* ========================================
            PROFILE CARD
        ======================================== */}

        <section className="profile-card">

          {/* PROFILE PHOTO */}

          <div className="profile-photo-section">

            <div className="profile-photo">

              {user?.profileImage ? (
                <img
                  src={user.profileImage}
                  alt="Profile"
                />
              ) : (
                <span>
                  {user?.name
                    ?.charAt(0)
                    ?.toUpperCase() || "F"}
                </span>
              )}

            </div>

            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              id="profile-image-input"
              style={{
                display: "none",
              }}
              onChange={
                handleImageChange
              }
            />

            <label
              htmlFor="profile-image-input"
              className="photo-button"
            >
              {uploadingImage
                ? "UPLOADING..."
                : user?.profileImage
                ? "CHANGE PHOTO"
                : "ADD PHOTO"}
            </label>

          </div>

          {/* ========================================
              PERSONAL DETAILS
          ======================================== */}

          <div className="profile-details">

            <div className="profile-details-header">

              <div>

                <span>
                  PERSONAL DETAILS
                </span>

                <h2>
                  {user?.name ||
                    "User"}
                </h2>

              </div>

              {!isEditing && (
                <button
                  className="edit-profile-button"
                  onClick={
                    handleEdit
                  }
                >
                  EDIT PROFILE
                </button>
              )}

            </div>

            {/* EDIT MODE */}

            {isEditing ? (
              <div className="profile-edit-form">

                <div className="profile-input-group">

                  <label>
                    FULL NAME
                  </label>

                  <input
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target.value
                      )
                    }
                    placeholder="Enter your name"
                  />

                </div>

                <div className="profile-input-group">

                  <label>
                    EMAIL ADDRESS
                  </label>

                  <input
                    type="email"
                    value={
                      user?.email || ""
                    }
                    disabled
                  />

                  <small>
                    Email cannot be changed
                    here.
                  </small>

                </div>

                <div className="profile-input-group">

                  <label>
                    PHONE NUMBER
                  </label>

                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      setPhone(
                        e.target.value
                      )
                    }
                    placeholder="Enter your phone number"
                  />

                </div>

                <div className="profile-edit-actions">

                  <button
                    className="cancel-profile-button"
                    onClick={
                      handleCancel
                    }
                    disabled={saving}
                  >
                    CANCEL
                  </button>

                  <button
                    className="save-profile-button"
                    onClick={
                      handleSave
                    }
                    disabled={saving}
                  >
                    {saving
                      ? "SAVING..."
                      : "SAVE CHANGES"}
                  </button>

                </div>

              </div>
            ) : (

              /* NORMAL MODE */

              <>

                <div className="profile-info">

                  <span>
                    FULL NAME
                  </span>

                  <p>
                    {user?.name ||
                      "Not added"}
                  </p>

                </div>

                <div className="profile-info">

                  <span>
                    EMAIL ADDRESS
                  </span>

                  <p>
                    {user?.email ||
                      "Not available"}
                  </p>

                </div>

                <div className="profile-info">

                  <span>
                    PHONE NUMBER
                  </span>

                  <p>
                    {user?.phone ||
                      "Not added"}
                  </p>

                </div>

              </>
            )}

          </div>

        </section>

        {/* ========================================
            ADDRESSES
        ======================================== */}

        <section className="addresses-section">

          <div className="addresses-header">

            <div>

              <span>
                DELIVERY
              </span>

              <h2>
                My Addresses
              </h2>

            </div>

            <button
              className="add-address-button"
              onClick={
                openAddressForm
              }
            >
              + ADD ADDRESS
            </button>

          </div>

          {/* ========================================
              ADDRESS FORM
          ======================================== */}

          {showAddressForm && (

            <div className="address-form-wrapper">

              <div className="address-form-header">

                <div>

                  <span>
                    NEW ADDRESS
                  </span>

                  <h3>
                    Add Delivery Address
                  </h3>

                </div>

                <button
                  type="button"
                  className="close-address-button"
                  onClick={
                    closeAddressForm
                  }
                >
                  ×
                </button>

              </div>

              <form
                className="address-form"
                onSubmit={
                  handleAddAddress
                }
              >

                {/* ADDRESS TYPE */}

                <div className="address-field">

                  <label>
                    ADDRESS TYPE
                  </label>

                  <select
                    name="label"
                    value={
                      addressForm.label
                    }
                    onChange={
                      handleAddressChange
                    }
                  >
                    <option value="Home">
                      Home
                    </option>

                    <option value="Work">
                      Work
                    </option>

                    <option value="Other">
                      Other
                    </option>

                  </select>

                </div>

                {/* FULL NAME */}

                <div className="address-field">

                  <label>
                    FULL NAME
                  </label>

                  <input
                    type="text"
                    name="fullName"
                    value={
                      addressForm.fullName
                    }
                    onChange={
                      handleAddressChange
                    }
                    placeholder="Enter full name"
                    required
                  />

                </div>

                {/* PHONE */}

                <div className="address-field">

                  <label>
                    PHONE NUMBER
                  </label>

                  <input
                    type="tel"
                    name="phone"
                    value={
                      addressForm.phone
                    }
                    onChange={
                      handleAddressChange
                    }
                    placeholder="Enter phone number"
                    required
                  />

                </div>

                {/* HOUSE */}

                <div className="address-field">

                  <label>
                    HOUSE / BUILDING
                  </label>

                  <input
                    type="text"
                    name="house"
                    value={
                      addressForm.house
                    }
                    onChange={
                      handleAddressChange
                    }
                    placeholder="House / Building name"
                    required
                  />

                </div>

                {/* STREET */}

                <div className="address-field">

                  <label>
                    STREET
                  </label>

                  <input
                    type="text"
                    name="street"
                    value={
                      addressForm.street
                    }
                    onChange={
                      handleAddressChange
                    }
                    placeholder="Street / Area"
                    required
                  />

                </div>

                {/* CITY */}

                <div className="address-field">

                  <label>
                    CITY
                  </label>

                  <input
                    type="text"
                    name="city"
                    value={
                      addressForm.city
                    }
                    onChange={
                      handleAddressChange
                    }
                    placeholder="City"
                    required
                  />

                </div>

                {/* STATE */}

                <div className="address-field">

                  <label>
                    STATE
                  </label>

                  <input
                    type="text"
                    name="state"
                    value={
                      addressForm.state
                    }
                    onChange={
                      handleAddressChange
                    }
                    placeholder="State"
                    required
                  />

                </div>

                {/* PINCODE */}

                <div className="address-field">

                  <label>
                    PINCODE
                  </label>

                  <input
                    type="text"
                    name="pincode"
                    value={
                      addressForm.pincode
                    }
                    onChange={
                      handleAddressChange
                    }
                    placeholder="Pincode"
                    required
                  />

                </div>

                {/* COUNTRY */}

                <div className="address-field">

                  <label>
                    COUNTRY
                  </label>

                  <input
                    type="text"
                    name="country"
                    value={
                      addressForm.country
                    }
                    onChange={
                      handleAddressChange
                    }
                  />

                </div>

                {/* DEFAULT ADDRESS */}

                <label className="default-address">

                  <input
                    type="checkbox"
                    name="isDefault"
                    checked={
                      addressForm.isDefault
                    }
                    onChange={
                      handleAddressChange
                    }
                  />

                  <span>
                    Make this my default
                    address
                  </span>

                </label>

                {/* FORM BUTTONS */}

                <div className="address-form-actions">

                  <button
                    type="button"
                    className="cancel-address-button"
                    onClick={
                      closeAddressForm
                    }
                    disabled={
                      savingAddress
                    }
                  >
                    CANCEL
                  </button>

                  <button
                    type="submit"
                    className="save-address-button"
                    disabled={
                      savingAddress
                    }
                  >
                    {savingAddress
                      ? "SAVING..."
                      : "SAVE ADDRESS"}
                  </button>

                </div>

              </form>

            </div>
          )}

          {/* ========================================
              NO ADDRESS
          ======================================== */}

          {(!user?.addresses ||
            user.addresses.length === 0) &&
            !showAddressForm && (

              <div className="no-address">

                <div>
                  +
                </div>

                <h3>
                  No addresses added
                </h3>

                <p>
                  Add an address for a faster
                  checkout experience.
                </p>

                <button
                  className="add-address-empty"
                  onClick={
                    openAddressForm
                  }
                >
                  ADD YOUR FIRST ADDRESS
                </button>

              </div>
            )}

          {/* ========================================
              ADDRESS CARDS
          ======================================== */}

          {user?.addresses?.length > 0 && (

            <div className="address-grid">

              {user.addresses.map(
                (address, index) => (

                  <div
                    className="address-card"
                    key={
                      address._id ||
                      index
                    }
                  >

                    <div className="address-card-top">

                      <span>
                        {address.label ||
                          "ADDRESS"}
                      </span>

                      {address.isDefault && (
                        <small>
                          DEFAULT
                        </small>
                      )}

                    </div>

                    <h3>
                      {address.fullName}
                    </h3>

                    <p>
                      {address.house}
                      <br />

                      {address.street}
                      <br />

                      {address.city},{" "}
                      {address.state}
                      <br />

                      {address.pincode}
                      <br />

                      {address.country}
                    </p>

                    <div className="address-actions">

                      <button>
                        EDIT
                      </button>

                      <button>
                        DELETE
                      </button>

                    </div>

                  </div>

                )
              )}

            </div>
          )}

        </section>

      </section>

    </main>
  );
}

export default Profile;
