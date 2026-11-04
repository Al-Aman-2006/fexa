import mongoose from "mongoose";
import Order from "./models/order.model.js";
import User from "./models/user.model.js";
import Product from "./models/product.model.js";
import Category from "./models/category.model.js";
import Coupon from "./models/coupon.model.js";
import Wallet from "./models/wallet.model.js";
import { cancelOrderItem } from "./controllers/order.controller.js";
import { getWalletBalance, getWalletTransactions } from "./controllers/wallet.controller.js";
import {
  getAdminWalletRefunds,
  getAdminWalletTransactionById,
} from "./controllers/adminWallet.controller.js";
import { roundToPaise } from "./utils/couponAllocation.js";

const MONGO_URI = "mongodb://127.0.0.1:27017/fexa-project";

const runTests = async () => {
  console.log("======================================================");
  console.log("FEXA WALLET REFUND MANAGEMENT SYSTEM — VERIFICATION SUITE");
  console.log("======================================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("✓ Connected to MongoDB");

  let testPassed = 0;
  let testFailed = 0;

  const assert = (condition, desc) => {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`);
      testPassed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      testFailed++;
    }
  };

  try {
    // 0. Clean up test artifacts
    await User.deleteMany({ email: { $in: ["wallet_patron_a@fexa.com", "wallet_patron_b@fexa.com", "wallet_admin@fexa.com"] } });
    await Order.deleteMany({ orderNumber: { $in: ["FEXA-WLT-TEST-01", "FEXA-WLT-TEST-COD", "FEXA-WLT-TEST-MULTI"] } });
    await Coupon.deleteMany({ code: "WLTREFUND10" });

    // Create Test Category & Products
    let testCategory = await Category.findOne({ name: "Wallet Test Cat" });
    if (!testCategory) {
      testCategory = await Category.create({ name: "Wallet Test Cat", slug: "wallet-test-cat", description: "Testing" });
    }

    const prodA = await Product.create({
      name: "Flacon Imperial Gold " + Date.now(),
      description: "Gold flacon",
      category: "Unisex",
      brand: "FEXA Atelier",
      price: 1000,
      stock: 50,
      variants: [{ volumeMl: 50, originalPrice: 1000, price: 1000, sellingPrice: 1000, stock: 50, isAvailable: true }],
      status: "Active",
    });

    const prodB = await Product.create({
      name: "Santal Velours Reserve " + Date.now(),
      description: "Santal velvet",
      category: "Men",
      brand: "FEXA Atelier",
      price: 1800,
      stock: 50,
      variants: [{ volumeMl: 100, originalPrice: 2000, price: 1800, sellingPrice: 1800, stock: 50, isAvailable: true }], // ₹200 offer
      status: "Active",
    });

    const prodC = await Product.create({
      name: "Ambre Nuit Royale " + Date.now(),
      description: "Royal amber",
      category: "Women",
      brand: "FEXA Atelier",
      price: 1500,
      stock: 50,
      variants: [{ volumeMl: 50, originalPrice: 1500, price: 1500, sellingPrice: 1500, stock: 50, isAvailable: true }],
      status: "Active",
    });

    // Create Test Users
    const userA = await User.create({
      name: "Alain Patron",
      email: "wallet_patron_a@fexa.com",
      password: "HashedPassword123",
      role: "user",
      isEmailVerified: true,
    });

    const userB = await User.create({
      name: "Benoit Patron",
      email: "wallet_patron_b@fexa.com",
      password: "HashedPassword123",
      role: "user",
      isEmailVerified: true,
    });

    const adminUser = await User.create({
      name: "Fexa Financial Controller",
      email: "wallet_admin@fexa.com",
      password: "HashedPassword123",
      role: "admin",
      isEmailVerified: true,
    });

    // Delete existing wallets for test users if any
    await Wallet.deleteMany({ user: { $in: [userA._id, userB._id] } });

    // Mock Express res generator
    const mockRes = () => {
      const res = {};
      res.statusCode = 200;
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.data = data;
        return res;
      };
      return res;
    };

    console.log("\n--- TEST SCENARIO 1: Multi-Item Paid Order with Product Offer & Coupon Discount ---");
    // Order Calculation:
    // Prod A: 1 unit @ 1000 (orig 1000, eff 1000)
    // Prod B: 1 unit @ 1800 (orig 2000, eff 1800) -> Offer savings ₹200
    // Prod C: 1 unit @ 1500 (orig 1500, eff 1500)
    // Total Merchandise Original: 4500. Total Effective: 4300.
    // Coupon WLTREFUND10: 10% coupon
    // Coupon Discount: 4500 * 10% = ₹450
    // Allocated Coupon Discounts (proportional to original 1000 : 2000 : 1500):
    // Prod A coupon: 100 (net line: 1000 - 100 = 900)
    // Prod B coupon: 200 (net line: 1800 - 200 = 1600)
    // Prod C coupon: 150 (net line: 1500 - 150 = 1350)
    // Final Payable Amount: 900 + 1600 + 1350 = ₹3850
    const orderMulti = await Order.create({
      orderNumber: "FEXA-WLT-TEST-MULTI",
      user: userA._id,
      items: [
        {
          product: prodA._id,
          variantId: prodA.variants[0]._id,
          volumeMl: 50,
          name: prodA.name,
          quantity: 1,
          unitPrice: 1000,
          originalPrice: 1000,
          offerAdjustedUnitPrice: 1000,
          lineTotal: 1000,
          allocatedCouponDiscount: 100,
          discountedLineAmount: 900,
          itemStatus: "Active",
          refundStatus: "None",
        },
        {
          product: prodB._id,
          variantId: prodB.variants[0]._id,
          volumeMl: 100,
          name: prodB.name,
          quantity: 1,
          unitPrice: 1800,
          originalPrice: 2000,
          offerAdjustedUnitPrice: 1800,
          lineTotal: 1800,
          allocatedCouponDiscount: 200,
          discountedLineAmount: 1600,
          itemStatus: "Active",
          refundStatus: "None",
        },
        {
          product: prodC._id,
          variantId: prodC.variants[0]._id,
          volumeMl: 50,
          name: prodC.name,
          quantity: 1,
          unitPrice: 1500,
          originalPrice: 1500,
          offerAdjustedUnitPrice: 1500,
          lineTotal: 1500,
          allocatedCouponDiscount: 150,
          discountedLineAmount: 1350,
          itemStatus: "Active",
          refundStatus: "None",
        },
      ],
      totalAmount: 3850,
      subtotal: 4300,
      originalSubtotal: 4500,
      discountAmount: 450,
      paymentMethod: "Razorpay",
      paymentStatus: "Paid",
      razorpayPaymentId: "pay_test_multi_12345",
      orderStatus: "Processing",
      shippingAddress: {
        fullName: "Alain Patron",
        addressLine1: "123 Vendome",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "India",
      },
    });

    const itemB = orderMulti.items.find((it) => it.name.includes("Santal Velours"));
    const initialBStock = prodB.variants[0].stock;

    // Execute cancellation of Product B
    const reqCancelB = {
      user: { id: userA._id.toString() },
      params: { orderId: orderMulti._id.toString(), itemId: itemB._id.toString() },
      body: { reason: "Changed mind on fragrance choice" },
    };
    const resCancelB = mockRes();
    await cancelOrderItem(reqCancelB, resCancelB);

    assert(resCancelB.statusCode === 200, "User successfully cancelled Product B (status 200)");
    assert(resCancelB.data.success === true, "Cancellation returned success: true");
    assert(resCancelB.data.refundAmount === 1600, `Refund calculated as exactly ₹1,600 (actual paid post ₹200 offer and ₹200 coupon), got ₹${resCancelB.data.refundAmount}`);

    // Verify User Wallet Balance in MongoDB
    const walletA = await Wallet.findOne({ user: userA._id });
    assert(walletA !== null, "User A wallet document created in MongoDB");
    assert(walletA.balance === 1600, `User A wallet balance credited with exactly ₹1,600, got ₹${walletA.balance}`);

    // Verify Wallet Transaction record
    const cnclTx = walletA.transactions.find((tx) => tx.type === "Cancellation Refund");
    assert(cnclTx !== undefined, "Recorded transaction with type 'Cancellation Refund'");
    assert(cnclTx.amount === 1600, "Transaction amount is ₹1,600");
    assert(cnclTx.direction === "Credit", "Transaction direction is 'Credit'");
    assert(cnclTx.status === "Completed", "Transaction status is 'Completed'");
    assert(cnclTx.productName === prodB.name, `Transaction stores product name: "${prodB.name}"`);
    assert(cnclTx.itemPrice === 2000, `Transaction stores catalog original price: ₹${cnclTx.itemPrice}`);
    assert(cnclTx.itemOfferDiscount === 200, `Transaction stores offer discount: ₹${cnclTx.itemOfferDiscount}`);
    assert(cnclTx.itemCouponDiscount === 200, `Transaction stores allocated coupon discount: ₹${cnclTx.itemCouponDiscount}`);

    // Verify Inventory Restocked
    const updatedProdB = await Product.findById(prodB._id);
    assert(updatedProdB.variants[0].stock === initialBStock + 1, `Restored variant stock from ${initialBStock} to ${updatedProdB.variants[0].stock}`);

    // Verify Remaining Items state in Order
    const updatedOrderMulti = await Order.findById(orderMulti._id);
    const updatedItemB = updatedOrderMulti.items.id(itemB._id);
    const updatedItemA = updatedOrderMulti.items.find((it) => it.name.includes("Flacon Imperial"));
    const updatedItemC = updatedOrderMulti.items.find((it) => it.name.includes("Ambre Nuit"));

    assert(updatedItemB.itemStatus === "Cancelled", "Cancelled item status is 'Cancelled'");
    assert(updatedItemB.refundStatus === "Refunded", "Cancelled item refundStatus is 'Refunded'");
    assert(updatedItemA.itemStatus === "Active", "Remaining Item A remains 'Active'");
    assert(updatedItemC.itemStatus === "Active", "Remaining Item C remains 'Active'");
    assert(updatedOrderMulti.orderStatus === "Processing", "Overall order status remains 'Processing'");
    assert(updatedOrderMulti.totalRefundedAmount === 1600, `Order totalRefundedAmount updated to ₹${updatedOrderMulti.totalRefundedAmount}`);

    console.log("\n--- TEST SCENARIO 2: Idempotency & Duplicate Cancellation Guard ---");
    // Attempting to cancel Product B again
    const resCancelBRepeat = mockRes();
    await cancelOrderItem(reqCancelB, resCancelBRepeat);

    assert(resCancelBRepeat.statusCode === 400, "Second cancellation attempt rejected with 400 Bad Request");
    const walletAfterRepeat = await Wallet.findOne({ user: userA._id });
    assert(walletAfterRepeat.balance === 1600, `Wallet balance NOT doubled (remains ₹1,600), got ₹${walletAfterRepeat.balance}`);
    assert(walletAfterRepeat.transactions.length === 1, `Wallet transactions count remains 1 (no duplicate credit), got ${walletAfterRepeat.transactions.length}`);

    console.log("\n--- TEST SCENARIO 3: Unpaid Cash on Delivery (COD) Cancellation ---");
    const orderCOD = await Order.create({
      orderNumber: "FEXA-WLT-TEST-COD",
      user: userA._id,
      items: [
        {
          product: prodA._id,
          variantId: prodA.variants[0]._id,
          volumeMl: 50,
          name: prodA.name,
          quantity: 1,
          unitPrice: 1000,
          originalPrice: 1000,
          lineTotal: 1000,
          discountedLineAmount: 1000,
          itemStatus: "Active",
          refundStatus: "None",
        },
      ],
      totalAmount: 1000,
      subtotal: 1000,
      originalSubtotal: 1000,
      paymentMethod: "COD",
      paymentStatus: "Pending", // Unpaid
      orderStatus: "Processing",
      shippingAddress: {
        fullName: "Alain Patron",
        addressLine1: "123 Vendome",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "India",
      },
    });

    const codItemId = orderCOD.items[0]._id;
    const reqCancelCOD = {
      user: { id: userA._id.toString() },
      params: { orderId: orderCOD._id.toString(), itemId: codItemId.toString() },
      body: { reason: "COD test cancellation" },
    };
    const resCancelCOD = mockRes();
    await cancelOrderItem(reqCancelCOD, resCancelCOD);

    assert(resCancelCOD.statusCode === 200, "Unpaid COD item successfully cancelled (status 200)");
    assert(resCancelCOD.data.refundAmount === 0, `COD item refundAmount is ₹0 (no money paid), got ₹${resCancelCOD.data.refundAmount}`);
    assert(resCancelCOD.data.refundStatus === "None", "COD item refundStatus is 'None'");

    const walletAfterCOD = await Wallet.findOne({ user: userA._id });
    assert(walletAfterCOD.balance === 1600, `Wallet balance remains ₹1,600 (COD did not credit unpaid money)`);
    assert(walletAfterCOD.transactions.length === 1, "No transaction created for COD cancellation");

    console.log("\n--- TEST SCENARIO 4: User-Side Wallet Balance & Summary API ---");
    const reqUserBal = { user: { id: userA._id.toString() } };
    const resUserBal = mockRes();
    await getWalletBalance(reqUserBal, resUserBal);

    assert(resUserBal.statusCode === 200, "getWalletBalance returned 200");
    assert(resUserBal.data.balance === 1600, `Returned balance ₹1,600, got ₹${resUserBal.data.balance}`);
    assert(resUserBal.data.totalCredited === 1600, `Returned totalCredited ₹1,600, got ₹${resUserBal.data.totalCredited}`);
    assert(resUserBal.data.totalDebited === 0, `Returned totalDebited ₹0, got ₹${resUserBal.data.totalDebited}`);

    console.log("\n--- TEST SCENARIO 5: User-Side Wallet Paginated Transactions API ---");
    const reqUserTx = {
      user: { id: userA._id.toString() },
      query: { page: 1, limit: 10, type: "All" },
    };
    const resUserTx = mockRes();
    await getWalletTransactions(reqUserTx, resUserTx);

    assert(resUserTx.statusCode === 200, "getWalletTransactions returned 200");
    assert(resUserTx.data.transactions.length === 1, `Customer sees their 1 transaction`);
    assert(resUserTx.data.transactions[0].type === "Cancellation Refund", `Transaction type is 'Cancellation Refund'`);

    console.log("\n--- TEST SCENARIO 6: Cross-User Security (User B cannot see User A's wallet) ---");
    const reqUserBBal = { user: { id: userB._id.toString() } };
    const resUserBBal = mockRes();
    await getWalletBalance(reqUserBBal, resUserBBal);

    assert(resUserBBal.data.balance === 0, `User B sees ₹0 balance (isolated from User A)`);
    const reqUserBTx = {
      user: { id: userB._id.toString() },
      query: { page: 1, limit: 10 },
    };
    const resUserBTx = mockRes();
    await getWalletTransactions(reqUserBTx, resUserBTx);
    assert(resUserBTx.data.transactions.length === 0, `User B has 0 transactions (cannot access User A's history)`);

    console.log("\n--- TEST SCENARIO 7: Admin-Side Wallet Refund Management API ---");
    const reqAdminRefunds = {
      admin: adminUser,
      query: { page: 1, limit: 10, type: "All", status: "All" },
    };
    const resAdminRefunds = mockRes();
    await getAdminWalletRefunds(reqAdminRefunds, resAdminRefunds);

    assert(resAdminRefunds.statusCode === 200, "getAdminWalletRefunds returned 200");
    assert(resAdminRefunds.data.success === true, "Admin API success: true");
    assert(resAdminRefunds.data.stats.totalRefunds >= 1, `Live stats calculate totalRefunds >= 1 (${resAdminRefunds.data.stats.totalRefunds})`);
    assert(resAdminRefunds.data.stats.totalRefundAmount >= 1600, `Live stats calculate totalRefundAmount >= ₹1,600 (₹${resAdminRefunds.data.stats.totalRefundAmount})`);
    assert(resAdminRefunds.data.stats.successfulRefunds >= 1, `Live stats calculate successfulRefunds >= 1`);
    assert(resAdminRefunds.data.transactions.length >= 1, `Admin can view transaction list`);

    // Find our specific transaction in admin listing
    const adminTx = resAdminRefunds.data.transactions.find((t) => t.transactionId === cnclTx.transactionId);
    assert(adminTx !== undefined, "Admin listing contains our cancellation transaction");
    assert(adminTx.customer.email === userA.email, `Admin listing populated customer email: ${adminTx.customer.email}`);
    assert(adminTx.productName === prodB.name, `Admin listing populated product name: ${adminTx.productName}`);
    assert(adminTx.amount === 1600, `Admin listing shows amount: ₹${adminTx.amount}`);

    console.log("\n--- TEST SCENARIO 8: Admin Transaction Inspection Modal API ---");
    const reqAdminInspect = {
      admin: adminUser,
      params: { transactionId: cnclTx.transactionId },
    };
    const resAdminInspect = mockRes();
    await getAdminWalletTransactionById(reqAdminInspect, resAdminInspect);

    assert(resAdminInspect.statusCode === 200, "getAdminWalletTransactionById returned 200");
    assert(resAdminInspect.data.success === true, "Inspection API success: true");
    const detail = resAdminInspect.data.transaction;
    assert(detail.customer.name === userA.name, `Inspection modal customer name: "${detail.customer.name}"`);
    assert(detail.order.orderNumber === orderMulti.orderNumber, `Inspection modal order number: "${detail.order.orderNumber}"`);
    assert(detail.item.name === prodB.name, `Inspection modal product name: "${detail.item.name}"`);
    assert(detail.item.originalPrice === 2000, `Inspection modal original price: ₹${detail.item.originalPrice}`);
    assert(detail.item.offerDiscount === 200, `Inspection modal offer discount: ₹${detail.item.offerDiscount}`);
    assert(detail.item.couponDiscount === 200, `Inspection modal coupon discount: ₹${detail.item.couponDiscount}`);
    assert(detail.item.refundableAmount === 1600, `Inspection modal final refundable amount: ₹${detail.item.refundableAmount}`);
    assert(detail.balanceBefore === 0, `Inspection modal balance before: ₹${detail.balanceBefore}`);
    assert(detail.balanceAfter === 1600, `Inspection modal balance after: ₹${detail.balanceAfter}`);

    console.log("\n--- TEST SCENARIO 9: Admin Search & Filter Governance ---");
    // Filter by type: Top-up should return 0 for User A
    const reqFilterTopup = {
      admin: adminUser,
      query: { page: 1, limit: 10, type: "Top-up", search: userA.email },
    };
    const resFilterTopup = mockRes();
    await getAdminWalletRefunds(reqFilterTopup, resFilterTopup);
    assert(resFilterTopup.data.transactions.length === 0, "Filter by Top-up correctly excluded Cancellation Refund");

    // Search by customer name
    const reqSearch = {
      admin: adminUser,
      query: { page: 1, limit: 10, search: "Alain" },
    };
    const resSearch = mockRes();
    await getAdminWalletRefunds(reqSearch, resSearch);
    assert(resSearch.data.transactions.some((t) => t.transactionId === cnclTx.transactionId), "Search by customer name found transaction");

    // Clean up
    await User.deleteMany({ email: { $in: ["wallet_patron_a@fexa.com", "wallet_patron_b@fexa.com", "wallet_admin@fexa.com"] } });
    await Order.deleteMany({ orderNumber: { $in: ["FEXA-WLT-TEST-01", "FEXA-WLT-TEST-COD", "FEXA-WLT-TEST-MULTI"] } });
    await Wallet.deleteMany({ user: { $in: [userA._id, userB._id] } });
    await Product.deleteMany({ _id: { $in: [prodA._id, prodB._id, prodC._id] } });
    await Category.deleteOne({ _id: testCategory._id });

    console.log("\n======================================================");
    console.log(`RESULTS: ${testPassed} PASSED, ${testFailed} FAILED`);
    console.log("======================================================");

    await mongoose.disconnect();
    process.exit(testFailed === 0 ? 0 : 1);
  } catch (err) {
    console.error("Test execution exception:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

runTests();
