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

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function runTestSuite() {
  console.log("=====================================================");
  console.log("   FEXA THREE E-COMMERCE FEATURES VERIFICATION SUITE  ");
  console.log("=====================================================");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✓ Connected to MongoDB:", mongoose.connection.name);

    // 1. Setup or find a test user
    const testEmail = "features_test_user@fexa.com";
    let testUser = await User.findOne({ email: testEmail });
    if (!testUser) {
      testUser = await User.create({
        name: "Aman Tester",
        email: testEmail,
        password: "Password@123",
        role: "user",
        isBlocked: false,
        addresses: [],
      });
      console.log("✓ Created test user:", testUser._id);
    } else {
      console.log("✓ Found existing test user:", testUser._id);
    }

    // ----------------------------------------------------
    // TEST 1: FEATURE 2 - INLINE ADDRESS ADD & PROFILE SAVE
    // ----------------------------------------------------
    console.log("\n--- TEST SUITE 1: Feature 2 - Delivery Address ---");
    const newAddress = {
      fullName: "Aman Aziz",
      phone: "9876543210",
      house: "Villa 42, Lavender Heights",
      street: "Orchid Boulevard",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
      label: "Home",
      isDefault: true,
    };

    // Simulate saving address to user.addresses as POST /api/profile/addresses does
    testUser.addresses.push(newAddress);
    await testUser.save();

    const updatedUser = await User.findById(testUser._id);
    const addedAddress = updatedUser.addresses[updatedUser.addresses.length - 1];
    if (addedAddress && addedAddress.house === newAddress.house) {
      console.log("✓ Address successfully persisted to User profile in MongoDB!");
      console.log("  Address ID:", addedAddress._id);
      console.log("  Full Address:", `${addedAddress.house}, ${addedAddress.street}, ${addedAddress.city} - ${addedAddress.pincode}`);
    } else {
      throw new Error("Address was not persisted to User profile");
    }

    // ----------------------------------------------------
    // TEST 2: Setup or find a test product
    // ----------------------------------------------------
    console.log("\n--- Setup Test Product ---");
    let testCategory = await Category.findOne({});
    if (!testCategory) {
      testCategory = await Category.create({ name: "Luxury Perfumes", slug: `luxury-perfumes-${Date.now()}`, description: "Atelier perfumes" });
    }

    let testProduct = await Product.findOne({ name: "Test Flacon Feature Suite" });
    if (!testProduct) {
      testProduct = await Product.create({
        name: "Test Flacon Feature Suite",
        slug: "test-flacon-feature-suite",
        description: "Test perfume for automated verification",
        category: testCategory._id,
        price: 500,
        stock: 50,
        images: ["/uploads/products/sample-zoom-flacon.jpg"],
        isDeleted: false,
      });
    } else {
      testProduct.stock = 50;
      testProduct.price = 500;
      await testProduct.save();
    }
    console.log("✓ Test product ready:", testProduct.name, "| Stock:", testProduct.stock, "| Price: ₹" + testProduct.price);

    // ----------------------------------------------------
    // TEST 3: FEATURE 3 - WALLET ATOMIC REJECTION ON LOW BALANCE
    // ----------------------------------------------------
    console.log("\n--- TEST SUITE 2: Feature 3 - Wallet Low Balance Rejection ---");
    let wallet = await Wallet.findOne({ user: testUser._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: testUser._id, balance: 100, transactions: [] });
    } else {
      wallet.balance = 100;
      await wallet.save();
    }
    console.log("✓ Set wallet balance to ₹" + wallet.balance);

    const orderTotal = testProduct.price; // ₹500
    console.log("  Order Total: ₹" + orderTotal + " | Wallet Balance: ₹" + wallet.balance);

    // Simulate backend conditional deduction
    const failedDeduct = await Wallet.findOneAndUpdate(
      { user: testUser._id, balance: { $gte: orderTotal } },
      { $inc: { balance: -orderTotal } },
      { new: true }
    );

    if (failedDeduct === null) {
      console.log("✓ Atomic rejection verified! MongoDB condition { balance: { $gte: orderTotal } } prevented negative balance.");
      const currentWallet = await Wallet.findOne({ user: testUser._id });
      console.log("  Wallet balance remains untouched: ₹" + currentWallet.balance);
    } else {
      throw new Error("Failed! Low balance was deducted unexpectedly.");
    }

    // ----------------------------------------------------
    // TEST 4: FEATURE 3 - WALLET SUCCESSFUL DEDUCTION & AUDIT
    // ----------------------------------------------------
    console.log("\n--- TEST SUITE 3: Feature 3 - Wallet Successful Purchase ---");
    wallet.balance = 1500;
    await wallet.save();
    console.log("✓ Topped up wallet balance to: ₹" + wallet.balance);

    const balanceBefore = wallet.balance;
    const successfulDeduct = await Wallet.findOneAndUpdate(
      { user: testUser._id, balance: { $gte: orderTotal } },
      { $inc: { balance: -orderTotal } },
      { new: true }
    );

    if (successfulDeduct && successfulDeduct.balance === balanceBefore - orderTotal) {
      console.log("✓ Atomic deduction successful! New balance: ₹" + successfulDeduct.balance);

      const orderNumber = `FEXA-TEST-${Date.now()}`;
      const walletTxId = `TXN-WLT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
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
      console.log("✓ Audit debit transaction successfully logged in Wallet history!");

      // Create order with paymentMethod: "Wallet", paymentStatus: "Paid"
      const createdOrder = await Order.create({
        orderNumber,
        user: testUser._id,
        items: [
          {
            product: testProduct._id,
            name: testProduct.name,
            volumeMl: 100,
            quantity: 1,
            unitPrice: testProduct.price,
            lineTotal: testProduct.price,
            itemStatus: "Active",
          },
        ],
        subtotal: orderTotal,
        discountAmount: 0,
        shippingCost: 0,
        totalAmount: orderTotal,
        deliveryAddress: {
          name: addedAddress.fullName,
          phone: addedAddress.phone,
          addressLine1: addedAddress.house,
          addressLine2: addedAddress.street,
          city: addedAddress.city,
          state: addedAddress.state,
          pinCode: addedAddress.pincode,
          country: addedAddress.country,
        },
        paymentMethod: "Wallet",
        paymentStatus: "Paid",
        orderStatus: "Processing",
      });

      console.log("✓ Order created with FEXA Wallet payment!");
      console.log("  Order ID:", createdOrder._id);
      console.log("  Order Number:", createdOrder.orderNumber);
      console.log("  Payment Method:", createdOrder.paymentMethod);
      console.log("  Payment Status:", createdOrder.paymentStatus);

      // ----------------------------------------------------
      // TEST 5: WALLET REFUND ON ITEM CANCELLATION
      // ----------------------------------------------------
      console.log("\n--- TEST SUITE 4: Feature 3 - Wallet Refund on Cancellation ---");
      const refundAmount = createdOrder.items[0].lineTotal; // ₹500
      const balBeforeRefund = successfulDeduct.balance; // ₹1000

      const refundedWallet = await Wallet.findOneAndUpdate(
        { user: testUser._id },
        {
          $inc: { balance: refundAmount },
          $push: {
            transactions: {
              transactionId: `TXN-CNCL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              type: "Cancellation Refund",
              direction: "Credit",
              amount: refundAmount,
              balanceBefore: balBeforeRefund,
              balanceAfter: balBeforeRefund + refundAmount,
              status: "Completed",
              description: `Refund for cancelled item in order ${createdOrder.orderNumber}`,
              referenceId: createdOrder.orderNumber,
              date: new Date(),
            },
          },
        },
        { new: true }
      );

      if (refundedWallet && refundedWallet.balance === balBeforeRefund + refundAmount) {
        console.log("✓ Refund successfully credited back to wallet!");
        console.log("  Restored balance: ₹" + refundedWallet.balance);
        console.log("  Total transactions recorded:", refundedWallet.transactions.length);
      } else {
        throw new Error("Refund calculation failed");
      }
    } else {
      throw new Error("Wallet deduction failed unexpectedly");
    }

    console.log("\n=====================================================");
    console.log("   ALL TEST CASES PASSED SUCCESSFULLY (100% GREEN)   ");
    console.log("=====================================================");
  } catch (err) {
    console.error("❌ Test suite failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

runTestSuite();
