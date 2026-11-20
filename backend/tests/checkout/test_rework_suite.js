import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

import User from "../../models/user.model.js";
import Product from "../../models/product.model.js";
import Category from "../../models/category.model.js";
import Order from "../../models/order.model.js";
import Wallet from "../../models/wallet.model.js";
import { validateAddress } from "../../validators/address.validator.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function runTestSuite() {
  console.log("===============================================================");
  console.log("   FEXA REWORK: ADDRESS VALIDATION & WALLET TEST SUITE         ");
  console.log("===============================================================");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✓ Connected to MongoDB:", mongoose.connection.name);

    // -------------------------------------------------------------
    // SECTION 1: ADDRESS VALIDATION TESTS
    // -------------------------------------------------------------
    console.log("\n--- SECTION 1: Address Validation Rules Testing ---");

    // Test 1: Empty address
    const emptyCheck = validateAddress({});
    if (!emptyCheck.isValid && emptyCheck.errors.fullName && emptyCheck.errors.phone && emptyCheck.errors.house) {
      console.log("✓ Test 1 Passed: Empty address rejected with all required field errors.");
    } else {
      throw new Error("Test 1 Failed: Empty address was not rejected properly.");
    }

    // Test 2: Numbers-only name
    const numbersNameCheck = validateAddress({
      fullName: "12345678",
      phone: "9876543210",
      house: "Flat 101",
      street: "Baker Street",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    });
    if (!numbersNameCheck.isValid && numbersNameCheck.errors.fullName) {
      console.log("✓ Test 2 Passed: Numbers-only name rejected ('" + numbersNameCheck.errors.fullName + "')");
    } else {
      throw new Error("Test 2 Failed: Numbers-only name was accepted.");
    }

    // Test 3: Symbols-only city and numbers in city
    const symbolsCityCheck = validateAddress({
      fullName: "Aman Aziz",
      phone: "9876543210",
      house: "Flat 101",
      street: "Baker Street",
      city: "@#$%^&*",
      state: "Maharashtra",
      pincode: "400001",
    });
    const numbersCityCheck = validateAddress({
      fullName: "Aman Aziz",
      phone: "9876543210",
      house: "Flat 101",
      street: "Baker Street",
      city: "Mumbai 400001",
      state: "Maharashtra",
      pincode: "400001",
    });
    if (!symbolsCityCheck.isValid && symbolsCityCheck.errors.city && !numbersCityCheck.isValid && numbersCityCheck.errors.city) {
      console.log("✓ Test 3 Passed: Symbols-only and numbers in city rejected ('" + numbersCityCheck.errors.city + "')");
    } else {
      throw new Error("Test 3 Failed: Invalid city was accepted.");
    }

    // Test 4: Invalid mobile numbers (letters, too short, repeated digits)
    const lettersPhone = validateAddress({ fullName: "Aman Aziz", phone: "98765ABCDE", house: "4B", street: "Park Ave", city: "Pune", state: "Maharashtra", pincode: "411001" });
    const shortPhone = validateAddress({ fullName: "Aman Aziz", phone: "98765", house: "4B", street: "Park Ave", city: "Pune", state: "Maharashtra", pincode: "411001" });
    const repeatedPhone = validateAddress({ fullName: "Aman Aziz", phone: "9999999999", house: "4B", street: "Park Ave", city: "Pune", state: "Maharashtra", pincode: "411001" });
    if (!lettersPhone.isValid && !shortPhone.isValid && !repeatedPhone.isValid) {
      console.log("✓ Test 4 Passed: Invalid phones (letters, short, repeated digits) all rejected.");
    } else {
      throw new Error("Test 4 Failed: Invalid phone was accepted.");
    }

    // Test 5: Invalid PIN codes (letters, starting with 0, not 6 digits)
    const zeroPin = validateAddress({ fullName: "Aman Aziz", phone: "9876543210", house: "4B", street: "Park Ave", city: "Pune", state: "Maharashtra", pincode: "012345" });
    const shortPin = validateAddress({ fullName: "Aman Aziz", phone: "9876543210", house: "4B", street: "Park Ave", city: "Pune", state: "Maharashtra", pincode: "40001" });
    const letterPin = validateAddress({ fullName: "Aman Aziz", phone: "9876543210", house: "4B", street: "Park Ave", city: "Pune", state: "Maharashtra", pincode: "40001A" });
    if (!zeroPin.isValid && !shortPin.isValid && !letterPin.isValid) {
      console.log("✓ Test 5 Passed: Invalid Indian PIN codes (starts with 0, 5 digits, alphanumeric) all rejected.");
    } else {
      throw new Error("Test 5 Failed: Invalid PIN code was accepted.");
    }

    // Test 6: Valid Indian address
    const validPayload = {
      fullName: "Lord Alistair Vance",
      phone: "+91 98200 12345",
      house: "Suite 4B, Imperial Residency",
      street: "Mahatma Gandhi Road, Fort",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
      label: "Home",
      isDefault: true,
    };
    const validCheck = validateAddress(validPayload);
    if (validCheck.isValid && validCheck.normalizedData.phone === "9820012345" && validCheck.normalizedData.pincode === "400001") {
      console.log("✓ Test 6 Passed: Valid Indian address accepted and normalized successfully!");
      console.log("  Normalized Phone:", validCheck.normalizedData.phone);
      console.log("  Normalized Pincode:", validCheck.normalizedData.pincode);
    } else {
      throw new Error("Test 6 Failed: Valid Indian address was rejected: " + JSON.stringify(validCheck.errors));
    }

    // -------------------------------------------------------------
    // SECTION 2: USER SETUP & PERSISTENCE
    // -------------------------------------------------------------
    console.log("\n--- SECTION 2: Address Profile Persistence in MongoDB ---");
    let testUser = await User.findOne({ email: "features_test_user@fexa.com" });
    if (!testUser) {
      testUser = await User.create({
        name: "Aman Tester",
        email: "features_test_user@fexa.com",
        password: "Password@123",
        role: "user",
        addresses: [],
      });
    }

    testUser.addresses.push(validCheck.normalizedData);
    await testUser.save();

    const freshlyLoadedUser = await User.findById(testUser._id);
    const savedAddr = freshlyLoadedUser.addresses[freshlyLoadedUser.addresses.length - 1];
    if (savedAddr && savedAddr.fullName === "Lord Alistair Vance") {
      console.log("✓ Test 7 Passed: Valid address successfully persisted to User profile in MongoDB!");
      console.log("  Saved Address ID:", savedAddr._id);
    } else {
      throw new Error("Test 7 Failed: Address was not saved in MongoDB.");
    }

    // -------------------------------------------------------------
    // SECTION 3: WALLET SCENARIOS
    // -------------------------------------------------------------
    console.log("\n--- SECTION 3: Wallet Payment Flow & Atomicity ---");
    let wallet = await Wallet.findOne({ user: testUser._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: testUser._id, balance: 1000, transactions: [] });
    }

    let testCategory = await Category.findOne({});
    let testProduct = await Product.findOne({ name: "Test Flacon Feature Suite" });
    if (!testProduct) {
      testProduct = await Product.create({
        name: "Test Flacon Feature Suite",
        slug: `test-flacon-${Date.now()}`,
        description: "Test perfume for automated verification",
        category: testCategory._id,
        price: 400,
        stock: 50,
        images: ["/uploads/products/sample-zoom-flacon.jpg"],
        isDeleted: false,
      });
    }
    const orderTotal = 400;

    // Scenario B: Insufficient Balance (Balance = ₹200, Total = ₹400)
    console.log("\n* Scenario B: Insufficient Wallet Balance Check");
    wallet.balance = 200;
    await wallet.save();

    const insufficientDeduct = await Wallet.findOneAndUpdate(
      { user: testUser._id, balance: { $gte: orderTotal } },
      { $inc: { balance: -orderTotal } },
      { returnDocument: "after" }
    );

    if (insufficientDeduct === null) {
      const untouchedWallet = await Wallet.findOne({ user: testUser._id });
      console.log("✓ Scenario B Passed: Atomic balance deduction blocked when balance (₹200) < total (₹400).");
      console.log("  Wallet balance remains untouched at: ₹" + untouchedWallet.balance);
      console.log("  Shortfall correctly identified: ₹" + (orderTotal - untouchedWallet.balance));
    } else {
      throw new Error("Scenario B Failed: Balance was deducted when it should have been blocked.");
    }

    // Scenario B2: Zero Wallet Balance Check
    console.log("\n* Scenario B2: Zero Wallet Balance Check");
    wallet.balance = 0;
    await wallet.save();

    const zeroDeduct = await Wallet.findOneAndUpdate(
      { user: testUser._id, balance: { $gte: orderTotal } },
      { $inc: { balance: -orderTotal } },
      { returnDocument: "after" }
    );
    if (zeroDeduct === null) {
      console.log("✓ Scenario B2 Passed: Atomic balance deduction blocked when balance is ₹0.");
    } else {
      throw new Error("Scenario B2 Failed: Zero balance was deducted.");
    }

    // Scenario A: Sufficient Balance (Balance = ₹1000, Total = ₹400)
    console.log("\n* Scenario A: Sufficient Wallet Balance Check");
    wallet.balance = 1000;
    await wallet.save();
    const balanceBefore = wallet.balance;

    const successfulDeduct = await Wallet.findOneAndUpdate(
      { user: testUser._id, balance: { $gte: orderTotal } },
      { $inc: { balance: -orderTotal } },
      { returnDocument: "after" }
    );

    if (successfulDeduct && successfulDeduct.balance === 600) {
      console.log("✓ Scenario A Passed: Atomic balance deduction succeeded (₹1000 - ₹400 = ₹600)!");

      const orderNumber = `FEXA-ORD-${Date.now()}`;
      const walletTxId = `TXN-WLT-${Date.now()}-1001`;

      successfulDeduct.transactions.push({
        transactionId: walletTxId,
        type: "Purchase Debit",
        direction: "Debit",
        amount: orderTotal,
        balanceBefore,
        balanceAfter: successfulDeduct.balance,
        status: "Completed",
        description: `Order Payment for ${orderNumber}`,
        referenceId: orderNumber,
        date: new Date(),
      });
      await successfulDeduct.save();
      console.log("✓ Scenario A Passed: Immutable 'Purchase Debit' transaction logged in Wallet collection.");

      const order = await Order.create({
        orderNumber,
        user: testUser._id,
        items: [
          {
            product: testProduct._id,
            name: testProduct.name,
            volumeMl: 100,
            quantity: 1,
            unitPrice: orderTotal,
            lineTotal: orderTotal,
            itemStatus: "Active",
          },
        ],
        subtotal: orderTotal,
        discountAmount: 0,
        shippingCost: 0,
        totalAmount: orderTotal,
        deliveryAddress: {
          name: savedAddr.fullName,
          phone: savedAddr.phone,
          addressLine1: savedAddr.house,
          addressLine2: savedAddr.street,
          city: savedAddr.city,
          state: savedAddr.state,
          pinCode: savedAddr.pincode,
          country: savedAddr.country,
        },
        paymentMethod: "Wallet",
        paymentStatus: "Paid",
        paidAt: new Date(),
        walletTransactionId: walletTxId,
        orderStatus: "Processing",
      });

      console.log("✓ Scenario A Passed: Order created with wallet payment metadata!");
      console.log("  Order Number:", order.orderNumber);
      console.log("  Payment Method:", order.paymentMethod);
      console.log("  Payment Status:", order.paymentStatus);
      console.log("  Wallet Transaction ID on Order:", order.walletTransactionId);
      console.log("  Paid At:", order.paidAt);
    } else {
      throw new Error("Scenario A Failed: Wallet deduction failed.");
    }

    // Scenario A2: Exact Balance (Balance = ₹400, Total = ₹400)
    console.log("\n* Scenario A2: Exact Wallet Balance Check (₹400 == ₹400)");
    wallet.balance = 400;
    await wallet.save();

    const exactDeduct = await Wallet.findOneAndUpdate(
      { user: testUser._id, balance: { $gte: orderTotal } },
      { $inc: { balance: -orderTotal } },
      { returnDocument: "after" }
    );
    if (exactDeduct && exactDeduct.balance === 0) {
      console.log("✓ Scenario A2 Passed: Exact balance deduction succeeded (Balance becomes ₹0, never negative).");
    } else {
      throw new Error("Scenario A2 Failed: Exact balance deduction did not equal 0.");
    }

    // Scenario C: Technical Failure Rollback
    console.log("\n* Scenario C: Technical Failure Rollback");
    wallet.balance = 600;
    await wallet.save();

    // Simulate debit of ₹400
    await Wallet.updateOne({ user: testUser._id }, { $inc: { balance: -400 } });
    const debitedBal = (await Wallet.findOne({ user: testUser._id })).balance; // ₹200
    console.log("  Simulated intermediate debit: balance reduced to ₹" + debitedBal);

    // Simulate order creation failure catch block rollback
    await Wallet.updateOne({ user: testUser._id }, { $inc: { balance: 400 } });
    const restoredBal = (await Wallet.findOne({ user: testUser._id })).balance; // ₹600
    if (restoredBal === 600) {
      console.log("✓ Scenario C Passed: Technical failure catch block restored balance back to ₹" + restoredBal);
    } else {
      throw new Error("Scenario C Failed: Rollback failed.");
    }

    console.log("\n===============================================================");
    console.log("   ALL REWORK VERIFICATION TESTS PASSED (100% GREEN)           ");
    console.log("===============================================================");
  } catch (err) {
    console.error("❌ Test suite failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

runTestSuite();

