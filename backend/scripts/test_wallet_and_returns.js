import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Wallet, {
  TRANSACTION_TYPES,
  TRANSACTION_DIRECTIONS,
  TRANSACTION_STATUSES,
} from "../models/wallet.model.js";
import ReturnRequest from "../models/returnRequest.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import { getOrCreateUserWallet } from "../controllers/wallet.controller.js";

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/fexa-project";

async function runTests() {
  console.log("=== STARTING FEXA WALLET & RETURN VALIDATION TEST SUITE ===");
  await mongoose.connect(mongoUri);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  // ==========================================
  // PART 1: SCHEMA VALIDATION TESTS
  // ==========================================
  console.log("\n--- PART 1: SCHEMA VALIDATION TESTS ---");

  // 1. Create a valid wallet top-up transaction
  const tempWallet = new Wallet({
    user: new mongoose.Types.ObjectId(),
    balance: 500,
  });

  tempWallet.transactions.push({
    transactionId: "TXN-TEST-TOPUP-01",
    type: "Top-up",
    amount: 500,
    direction: "Credit",
    description: "Test Top-up",
    balanceBefore: 0,
    balanceAfter: 500,
    status: "Completed",
  });

  let valErr = tempWallet.validateSync();
  assert(!valErr, "1. Valid Top-up transaction passes schema validation");

  // 2. Create a valid return refund transaction
  tempWallet.transactions.push({
    transactionId: "TXN-TEST-REFUND-01",
    type: "Return Refund",
    amount: 350,
    direction: "Credit",
    description: "Test Refund",
    balanceBefore: 500,
    balanceAfter: 850,
    status: "Completed",
  });
  valErr = tempWallet.validateSync();
  assert(!valErr, "2. Valid Return Refund transaction passes schema validation");

  // 3. Create a valid debit transaction
  tempWallet.transactions.push({
    transactionId: "TXN-TEST-DEBIT-01",
    type: "Purchase Debit",
    amount: 200,
    direction: "Debit",
    description: "Test Debit for Perfume Order",
    balanceBefore: 850,
    balanceAfter: 650,
    status: "Completed",
  });
  valErr = tempWallet.validateSync();
  assert(!valErr, "3. Valid Purchase Debit transaction passes schema validation");

  // 4. Test uppercase legacy enum values (TOPUP, REFUND, CREDIT, SUCCESS)
  tempWallet.transactions.push({
    transactionId: "TXN-TEST-LEGACY-01",
    type: "TOPUP",
    amount: 100,
    direction: "CREDIT",
    description: "Legacy uppercase format test",
    balanceBefore: 650,
    balanceAfter: 750,
    status: "SUCCESS",
  });
  valErr = tempWallet.validateSync();
  assert(!valErr, "4. Legacy uppercase values (TOPUP, CREDIT, SUCCESS) validate cleanly and normalize");

  // 5. Verify invalid transaction types are rejected
  const invalidTypeWallet = new Wallet({
    user: new mongoose.Types.ObjectId(),
    balance: 100,
    transactions: [
      {
        transactionId: "TXN-INV-01",
        type: "INVALID_RANDOM_TYPE",
        amount: 100,
        direction: "Credit",
        description: "Bad type",
        balanceBefore: 0,
        balanceAfter: 100,
        status: "Completed",
      },
    ],
  });
  const errType = invalidTypeWallet.validateSync();
  assert(
    errType && errType.errors["transactions.0.type"],
    "5. Invalid transaction type is correctly rejected by Mongoose"
  );

  // 6. Verify invalid directions are rejected
  const invalidDirWallet = new Wallet({
    user: new mongoose.Types.ObjectId(),
    balance: 100,
    transactions: [
      {
        transactionId: "TXN-INV-02",
        type: "Top-up",
        amount: 100,
        direction: "SIDEWAYS",
        description: "Bad direction",
        balanceBefore: 0,
        balanceAfter: 100,
        status: "Completed",
      },
    ],
  });
  const errDir = invalidDirWallet.validateSync();
  assert(
    errDir && errDir.errors["transactions.0.direction"],
    "6. Invalid direction ('SIDEWAYS') is correctly rejected by Mongoose"
  );

  // 7. Verify invalid statuses are rejected
  const invalidStatWallet = new Wallet({
    user: new mongoose.Types.ObjectId(),
    balance: 100,
    transactions: [
      {
        transactionId: "TXN-INV-03",
        type: "Top-up",
        amount: 100,
        direction: "Credit",
        description: "Bad status",
        balanceBefore: 0,
        balanceAfter: 100,
        status: "UNKNOWN_STATUS",
      },
    ],
  });
  const errStat = invalidStatWallet.validateSync();
  assert(
    errStat && errStat.errors["transactions.0.status"],
    "7. Invalid status ('UNKNOWN_STATUS') is correctly rejected by Mongoose"
  );

  // ==========================================
  // PART 2: RETURN APPROVAL WORKFLOW & IDEMPOTENCY
  // ==========================================
  console.log("\n--- PART 2: RETURN APPROVAL & IDEMPOTENCY TESTS ---");

  // Find a requested return request that has a valid order item
  const allRequested = await ReturnRequest.find({ status: "Requested" });
  let testReturn = null;
  for (const candidate of allRequested) {
    const ord = await Order.findById(candidate.order);
    if (ord && ord.items.id(candidate.item.orderItemId)) {
      testReturn = candidate;
      break;
    }
  }
  if (testReturn) {
    console.log(`Found pending return request: ${testReturn.requestNumber} (ID: ${testReturn._id})`);
    const initialUserWallet = await Wallet.findOne({ user: testReturn.user });
    const initialBalance = initialUserWallet ? initialUserWallet.balance : 0;
    console.log(`Customer wallet initial balance: ₹${initialBalance}`);

    // Mock an approval call using the controller logic via mock req/res
    const { approveReturnRequest } = await import("../controllers/adminReturn.controller.js");

    let responseData = null;
    let statusCode = null;

    const mockReq = {
      params: { id: testReturn._id.toString() },
      body: { adminNotes: "Automated test approval" },
      admin: { _id: new mongoose.Types.ObjectId(), email: "admin@fexa.com" },
    };

    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
            return data;
          },
        };
      },
    };

    // 1. Approve return
    await approveReturnRequest(mockReq, mockRes);
    assert(
      statusCode === 200 && responseData && responseData.success,
      `1. Admin return approval executes with HTTP 200 (message: "${responseData?.message}")`
    );

    // 2. Verify wallet balance changed by exact refund amount
    const updatedUserWallet = await Wallet.findOne({ user: testReturn.user });
    const expectedBalance = initialBalance + (responseData?.refundAmount || 0);
    assert(
      updatedUserWallet.balance === expectedBalance,
      `2. Wallet balance updated exactly: ₹${initialBalance} -> ₹${updatedUserWallet.balance} (+₹${responseData?.refundAmount})`
    );

    // 3. Verify refund transaction is saved
    const savedTx = updatedUserWallet.transactions.find(
      (tx) => tx.returnRequestId && tx.returnRequestId.toString() === testReturn._id.toString()
    );
    assert(
      savedTx && savedTx.type === "Return Refund" && savedTx.direction === "Credit" && savedTx.status === "Completed",
      `3. Refund transaction properly recorded with type="Return Refund", direction="Credit", status="Completed"`
    );

    // 4. Verify return request status is "Refunded"
    const reloadedReturn = await ReturnRequest.findById(testReturn._id);
    assert(
      reloadedReturn.status === "Refunded" && reloadedReturn.walletTransactionId === savedTx?.transactionId,
      `4. ReturnRequest status updated to "Refunded" and walletTransactionId linked`
    );

    // 5 & 6. Repeat approval request (Idempotency test)
    let replayResponse = null;
    let replayCode = null;
    const mockReplayRes = {
      status: (code) => {
        replayCode = code;
        return {
          json: (data) => {
            replayResponse = data;
            return data;
          },
        };
      },
    };

    await approveReturnRequest(mockReq, mockReplayRes);
    assert(
      replayCode === 200 && replayResponse.success,
      `5. Replaying approval request returns HTTP 200 idempotently`
    );

    const recheckWallet = await Wallet.findOne({ user: testReturn.user });
    assert(
      recheckWallet.balance === expectedBalance,
      `6. Wallet balance did NOT increase again (balance remained ₹${recheckWallet.balance})`
    );

    const matchingTxs = recheckWallet.transactions.filter(
      (tx) => tx.returnRequestId && tx.returnRequestId.toString() === testReturn._id.toString()
    );
    assert(
      matchingTxs.length === 1,
      `6b. Exactly 1 transaction exists for this return request (no duplicate credits)`
    );
  } else {
    console.log("No 'Requested' return request available in DB for live approval test.");
  }

  // ==========================================
  // PART 3: WALLET TOP-UP WORKFLOW & IDEMPOTENCY
  // ==========================================
  console.log("\n--- PART 3: WALLET TOP-UP WORKFLOW TESTS ---");

  const { verifyTopUpPayment } = await import("../controllers/wallet.controller.js");

  const testUserId = new mongoose.Types.ObjectId();
  const testUserWallet = await getOrCreateUserWallet(testUserId);
  const topUpBefore = testUserWallet.balance;
  const testPaymentId = `pay_mock_${Date.now()}`;
  const testOrderId = `order_mock_${Date.now()}`;

  // Generate valid HMAC signature for mock payment
  const crypto = await import("crypto");
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || "fexa_razorpay_secret_test";
  const signature = crypto
    .createHmac("sha256", razorpaySecret)
    .update(`${testOrderId}|${testPaymentId}`)
    .digest("hex");

  let topUpResData = null;
  let topUpCode = null;
  const mockTopUpReq = {
    user: { id: testUserId.toString() },
    body: {
      razorpay_order_id: testOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: signature,
      amount: 750,
    },
  };

  const mockTopUpRes = {
    status: (code) => {
      topUpCode = code;
      return {
        json: (data) => {
          topUpResData = data;
          return data;
        },
      };
    },
  };

  // 1. Process verified top-up
  await verifyTopUpPayment(mockTopUpReq, mockTopUpRes);
  assert(
    topUpCode === 200 && topUpResData && topUpResData.success,
    `1. Top-up verification succeeds with HTTP 200 (message: "${topUpResData?.message}")`
  );

  // 2. Verify wallet balance increased once
  const walletAfterTopUp = await Wallet.findOne({ user: testUserId });
  assert(
    walletAfterTopUp.balance === topUpBefore + 750,
    `2. Wallet balance correctly increased by ₹750: ₹${topUpBefore} -> ₹${walletAfterTopUp.balance}`
  );

  // 3. Verify top-up transaction saved with correct schema values
  const topUpTx = walletAfterTopUp.transactions.find(
    (tx) => tx.razorpayPaymentId === testPaymentId
  );
  assert(
    topUpTx && topUpTx.type === "Top-up" && topUpTx.direction === "Credit" && topUpTx.status === "Completed",
    `3. Top-up transaction record saved with type="Top-up", direction="Credit", status="Completed"`
  );

  // 4 & 5. Replay same payment callback (Idempotency test)
  let replayTopUpData = null;
  let replayTopUpCode = null;
  const mockReplayTopUpRes = {
    status: (code) => {
      replayTopUpCode = code;
      return {
        json: (data) => {
          replayTopUpData = data;
          return data;
        },
      };
    },
  };

  await verifyTopUpPayment(mockTopUpReq, mockReplayTopUpRes);
  assert(
    replayTopUpCode === 200 && replayTopUpData.success,
    `4. Replaying identical payment callback returns HTTP 200`
  );

  const walletAfterReplay = await Wallet.findOne({ user: testUserId });
  assert(
    walletAfterReplay.balance === walletAfterTopUp.balance,
    `5. Replay did not double-credit wallet: balance remained ₹${walletAfterReplay.balance}`
  );

  // 6 & 7. Test invalid / unverified signature
  let badSigData = null;
  let badSigCode = null;
  const mockBadSigReq = {
    user: { id: testUserId.toString() },
    body: {
      razorpay_order_id: `order_fake_${Date.now()}`,
      razorpay_payment_id: `pay_fake_${Date.now()}`,
      razorpay_signature: "INVALID_TAMPERED_SIGNATURE",
      amount: 1000,
    },
  };

  const mockBadSigRes = {
    status: (code) => {
      badSigCode = code;
      return {
        json: (data) => {
          badSigData = data;
          return data;
        },
      };
    },
  };

  await verifyTopUpPayment(mockBadSigReq, mockBadSigRes);
  assert(
    badSigCode === 400 && !badSigData.success,
    `6. Tampered / invalid signature is rejected with HTTP 400 ("${badSigData?.message}")`
  );

  const walletAfterBadSig = await Wallet.findOne({ user: testUserId });
  assert(
    walletAfterBadSig.balance === walletAfterReplay.balance,
    `7. Unverified payment did NOT increase wallet balance (balance remained ₹${walletAfterBadSig.balance})`
  );

  // Clean up mock test wallet
  await Wallet.deleteOne({ user: testUserId });

  console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
