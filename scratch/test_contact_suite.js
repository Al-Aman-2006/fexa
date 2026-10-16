const path = require("path");
const fs = require("fs");
const mongoose = require(path.resolve(__dirname, "../backend/node_modules/mongoose"));

async function runContactTestSuite() {
  console.log("==================================================");
  console.log("RUNNING COMPREHENSIVE FEXA CONTACT US TEST SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. TEST A: Routing & Navigation
    console.log("\n--- TEST GROUP A: Routing, Architecture & Navigation ---");
    const appJsxContent = fs.readFileSync(
      path.resolve(__dirname, "../frontend/src/app.jsx"),
      "utf8"
    );
    assert(
      appJsxContent.includes('import Contact from "./pages/user/Contact"') ||
      appJsxContent.includes("import Contact from './pages/user/Contact'"),
      "App.jsx imports Contact component"
    );
    assert(
      appJsxContent.includes('path="/contact"') &&
      appJsxContent.includes("<Contact />"),
      "App.jsx has route path='/contact' rendering <Contact />"
    );
    assert(
      appJsxContent.includes('path="/contact-us"'),
      "App.jsx redirects /contact-us to /contact"
    );

    const navbarContent = fs.readFileSync(
      path.resolve(__dirname, "../frontend/src/components/common/Navbar.jsx"),
      "utf8"
    );
    assert(
      navbarContent.includes('navigate("/contact")') &&
      navbarContent.includes("CONTACT US"),
      "Navbar CONTACT US button navigates to /contact"
    );
    assert(
      navbarContent.includes('activePage === "contact"'),
      "Navbar highlights CONTACT US when activePage === 'contact'"
    );

    // 2. TEST B: Theme & Aesthetics (No Black Backgrounds)
    console.log("\n--- TEST GROUP B: Visual Design & Color Palette ---");
    const contactCssContent = fs.readFileSync(
      path.resolve(__dirname, "../frontend/src/pages/user/Contact.css"),
      "utf8"
    );
    assert(
      contactCssContent.includes("#faf8fc") &&
      contactCssContent.includes("#ffffff"),
      "Contact.css utilizes FEXA lavender-and-white foundation"
    );
    assert(
      !contactCssContent.includes("background: #000000") &&
      !contactCssContent.includes("background-color: #000000") &&
      !contactCssContent.includes("background: black") &&
      !contactCssContent.includes("background: #000;"),
      "Contact.css contains no unwanted black background declarations"
    );
    assert(
      fs.existsSync(
        path.resolve(__dirname, "../frontend/src/assets/images/contact/contact_hero.jpg")
      ),
      "High-resolution luxury perfume lifestyle asset exists in contact directory"
    );

    // 3. TEST C: Server-Side Validation & Bad Input Rejection
    console.log("\n--- TEST GROUP C: Server-Side Validation ---");
    // C.1: Empty body
    const emptyRes = await fetch("http://localhost:5000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const emptyData = await emptyRes.json();
    assert(emptyRes.status === 400 && !emptyData.success, "Rejects empty submission with 400");

    // C.2: Whitespace-only name
    const spaceNameRes = await fetch("http://localhost:5000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "     ",
        email: "test@example.com",
        reason: "General Inquiry",
        subject: "Valid Subject",
        message: "This is a valid test message with sufficient length.",
      }),
    });
    const spaceNameData = await spaceNameRes.json();
    assert(spaceNameRes.status === 400 && spaceNameData.field === "fullName", "Rejects whitespace-only name");

    // C.3: Symbol-only name
    const symNameRes = await fetch("http://localhost:5000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "@@@###$$$",
        email: "test@example.com",
        reason: "General Inquiry",
        subject: "Valid Subject",
        message: "This is a valid test message with sufficient length.",
      }),
    });
    assert(symNameRes.status === 400, "Rejects symbol-only name");

    // C.4: Invalid email
    const badEmailRes = await fetch("http://localhost:5000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Eleanor Vance",
        email: "notanemail",
        reason: "General Inquiry",
        subject: "Valid Subject",
        message: "This is a valid test message with sufficient length.",
      }),
    });
    const badEmailData = await badEmailRes.json();
    assert(badEmailRes.status === 400 && badEmailData.field === "email", "Rejects invalid email format");

    // C.5: Invalid / Unexpected reason
    const badReasonRes = await fetch("http://localhost:5000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Eleanor Vance",
        email: "eleanor@example.com",
        reason: "UnauthorizedReasonHack",
        subject: "Valid Subject",
        message: "This is a valid test message with sufficient length.",
      }),
    });
    assert(badReasonRes.status === 400, "Rejects unapproved reason value");

    // C.6: Message too short (< 10 chars)
    const shortMsgRes = await fetch("http://localhost:5000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Eleanor Vance",
        email: "eleanor@example.com",
        reason: "General Inquiry",
        subject: "Valid Subject",
        message: "Hi",
      }),
    });
    assert(shortMsgRes.status === 400, "Rejects short message (< 10 chars)");

    // C.7: Message too long (> 1500 chars)
    const longMsgRes = await fetch("http://localhost:5000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Eleanor Vance",
        email: "eleanor@example.com",
        reason: "General Inquiry",
        subject: "Valid Subject",
        message: "A".repeat(1501),
      }),
    });
    assert(longMsgRes.status === 400, "Rejects message exceeding 1500 character limit");

    // 4. TEST D: Valid Submission & Database Persistence
    console.log("\n--- TEST GROUP D: Valid Submission & Database Storage ---");
    const validPayload = {
      fullName: "Clarisse Grasse",
      email: "clarisse.grasse@atelier-fexa.com",
      reason: "Fragrance Information",
      orderNumber: "FEXA-2026-9901",
      subject: "Inquiry on Centifolia Rose harvest",
      message: "Could you kindly provide information on the 2026 harvest distillation for Rose Impériale?",
    };

    const validRes = await fetch("http://localhost:5000/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });
    const validData = await validRes.json();
    assert(validRes.status === 201 && validData.success === true, "Valid submission returns 201 Created");
    assert(validData.inquiry && validData.inquiry.id, "Returns created inquiry ID");

    // Connect to MongoDB and verify document directly
    await mongoose.connect("mongodb://localhost:27017/fexa-project");
    const { ContactMessage } = require("../backend/models/contact.model");
    const savedDoc = await ContactMessage.findById(validData.inquiry.id);
    assert(savedDoc !== null, "Inquiry is genuinely saved in MongoDB collection");
    assert(savedDoc.name === "Clarisse Grasse", "Saved document has correct name");
    assert(savedDoc.email === "clarisse.grasse@atelier-fexa.com", "Saved document has correct email");
    assert(savedDoc.reason === "Fragrance Information", "Saved document has correct reason");
    assert(savedDoc.orderNumber === "FEXA-2026-9901", "Saved document has correct order number");
    assert(savedDoc.status === "New", "Saved document initial status is 'New'");
    await mongoose.disconnect();

    // 5. TEST E: Reasons endpoint
    console.log("\n--- TEST GROUP E: Reasons Endpoint ---");
    const reasonsRes = await fetch("http://localhost:5000/api/contact/reasons");
    const reasonsData = await reasonsRes.json();
    assert(reasonsRes.status === 200 && Array.isArray(reasonsData.reasons), "GET /api/contact/reasons returns 200 array");
    assert(reasonsData.reasons.includes("Order Support"), "Includes 'Order Support'");
    assert(reasonsData.reasons.includes("Fragrance Information"), "Includes 'Fragrance Information'");

    // 6. TEST F: Regression Check
    console.log("\n--- TEST GROUP F: System Regression Check ---");
    const productsRes = await fetch("http://localhost:5000/api/products?category=men");
    const productsData = await productsRes.json();
    assert(productsRes.ok && productsData.products.length > 0, "Public products API remains functional");

    const collectionsPageRes = await fetch("http://localhost:5173/collections?category=men");
    assert(collectionsPageRes.status === 200, "Vite frontend serves /collections?category=men");

    const contactPageRes = await fetch("http://localhost:5173/contact");
    assert(contactPageRes.status === 200, "Vite frontend serves /contact");

    console.log("\n==================================================");
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED.`);
    console.log("==================================================");

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("Test Suite execution failed with error:", error);
    process.exit(1);
  }
}

runContactTestSuite();
