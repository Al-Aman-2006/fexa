import crypto from "crypto";
import mongoose from "mongoose";
import Wallet from "../models/wallet.model.js";
import User from "../models/user.model.js";
import { getRazorpayInstance } from "../config/razorpay.js";
import { roundToPaise } from "../utils/couponAllocation.js";

// Helper: Ensure wallet document exists for a user
export const getOrCreateUserWallet = async (userId, session = null) => {
  const query = Wallet.findOne({ user: userId });
  if (session) query.session(session);
  let wallet = await query;
  if (!wallet) {
    const docs = await Wallet.create(
      [
        {
          user: userId,
          balance: 0,
          currency: "INR",
          transactions: [],
        },
      ],
      session ? { session } : {}
    );
    wallet = docs[0];
  }
  return wallet;
};

// ========================================================
// 1. GET USER WALLET BALANCE & RECENT SUMMARY
// ========================================================
export const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await getOrCreateUserWallet(userId);

    const sortedTransactions = [...(wallet.transactions || [])].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    let totalCredited = 0;
    let totalDebited = 0;
    for (const tx of wallet.transactions || []) {
      const isCompleted = !tx.status || tx.status === "Completed" || tx.status === "Success" || tx.status === "Successful";
      const dirUpper = String(tx.direction || "").trim().toUpperCase();
      if (isCompleted) {
        if (dirUpper === "CREDIT") {
          totalCredited += Number(tx.amount || 0);
        } else if (dirUpper === "DEBIT") {
          totalDebited += Number(tx.amount || 0);
        }
      }
    }

    return res.status(200).json({
      success: true,
      balance: roundToPaise(wallet.balance),
      totalCredited: roundToPaise(totalCredited),
      totalDebited: roundToPaise(totalDebited),
      currency: wallet.currency || "INR",
      totalTransactions: wallet.transactions.length,
      recentTransactions: sortedTransactions.slice(0, 5),
    });
  } catch (error) {
    console.error("Get wallet balance error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve wallet balance.",
    });
  }
};

// ========================================================
// 2. CREATE RAZORPAY ORDER FOR WALLET TOP-UP
// ========================================================
export const createTopUpOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || !isFinite(numAmount)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid numeric top-up amount.",
      });
    }

    const cleanAmount = roundToPaise(numAmount);
    if (cleanAmount < 10) {
      return res.status(400).json({
        success: false,
        message: "Minimum wallet top-up amount is ₹10.00.",
      });
    }

    if (cleanAmount > 100000) {
      return res.status(400).json({
        success: false,
        message: "Maximum wallet top-up per transaction is ₹1,00,000.00.",
      });
    }

    const user = await User.findById(userId).select("name email phone");
    if (!user) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    const razorpay = getRazorpayInstance();
    const receipt = `WLT-TOP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(cleanAmount * 100), // in paise
      currency: "INR",
      receipt,
      notes: {
        userId: userId.toString(),
        type: "wallet_topup",
        userEmail: user.email,
      },
    });

    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_TqUYTgZOU4T32M";

    return res.status(200).json({
      success: true,
      keyId,
      razorpayOrderId: rzpOrder.id,
      amount: cleanAmount,
      amountInPaise: rzpOrder.amount,
      currency: rzpOrder.currency,
      receipt,
      customer: {
        name: user.name || "FEXA Patron",
        email: user.email,
        phone: user.phone || "",
      },
    });
  } catch (error) {
    console.error("Create wallet top-up order error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to initialize wallet top-up gateway.",
    });
  }
};

// ========================================================
// 3. VERIFY RAZORPAY PAYMENT & CREDIT WALLET (IDEMPOTENT)
// ========================================================
export const verifyTopUpPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Incomplete payment verification credentials.",
      });
    }

    // 1. Verify HMAC SHA256 Signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "vlYvPndeLZ07y6a3ovxB3aPp";
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment authentication signature mismatch. Payment verification failed.",
      });
    }

    // 2. Load User Wallet
    const wallet = await getOrCreateUserWallet(userId);

    // 3. IDEMPOTENCY CHECK: Ensure payment has not already been credited
    const alreadyProcessed = wallet.transactions.find(
      (tx) => tx.razorpayPaymentId === razorpay_payment_id
    );

    if (alreadyProcessed) {
      return res.status(200).json({
        success: true,
        message: "This payment has already been credited to your wallet.",
        balance: roundToPaise(wallet.balance),
        transaction: alreadyProcessed,
      });
    }

    // 4. Retrieve Payment details from Razorpay to verify server-side amount
    let verifiedAmount = Number(amount);
    try {
      const razorpay = getRazorpayInstance();
      const paymentInfo = await razorpay.payments.fetch(razorpay_payment_id);

      if (paymentInfo && paymentInfo.amount) {
        verifiedAmount = roundToPaise(paymentInfo.amount / 100);
      }
    } catch (fetchErr) {
      console.warn("Could not fetch remote Razorpay payment info, using payload amount:", fetchErr.message);
    }

    if (!verifiedAmount || verifiedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid verified payment amount.",
      });
    }

    // 5. Atomic Balance Credit & Transaction Record
    const balanceBefore = roundToPaise(wallet.balance);
    const balanceAfter = roundToPaise(balanceBefore + verifiedAmount);
    const txId = `TXN-TOP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newTransaction = {
      transactionId: txId,
      type: "Top-up",
      amount: verifiedAmount,
      direction: "Credit",
      description: `Wallet Online Top-up (${razorpay_payment_id})`,
      referenceId: razorpay_order_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      balanceBefore,
      balanceAfter,
      status: "Completed",
      createdAt: new Date(),
    };

    wallet.balance = balanceAfter;
    wallet.transactions.push(newTransaction);
    await wallet.save();

    return res.status(200).json({
      success: true,
      message: `₹${verifiedAmount.toLocaleString("en-IN")} successfully added to your FEXA Wallet.`,
      balance: balanceAfter,
      transaction: newTransaction,
    });
  } catch (error) {
    console.error("Verify wallet top-up payment error:", error);
    if (error.name === "ValidationError") {
      const errorMsgs = Object.values(error.errors || {})
        .map((e) => e.message)
        .join("; ");
      return res.status(400).json({
        success: false,
        message: `Validation Error: ${errorMsgs || error.message}`,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to finalize wallet credit.",
    });
  }
};

// Helper: Canonical type normalization
const normalizeFilterType = (t) => {
  const s = String(t || "").trim().toUpperCase().replace(/[- ]/g, "_");
  if (s === "TOPUP" || s === "TOP_UP") return "Top-up";
  if (s === "REFUND" || s === "RETURN_REFUND") return "Return Refund";
  if (s === "PURCHASE" || s === "PURCHASE_DEBIT" || s === "DEBIT") return "Purchase Debit";
  if (s === "CANCELLATION" || s === "CANCELLATION_REFUND") return "Cancellation Refund";
  if (s === "ADMIN_ADJUSTMENT" || s === "ADJUSTMENT") return "Admin Adjustment";
  return t;
};

// Helper: Canonical direction normalization
const normalizeFilterDirection = (d) => {
  const s = String(d || "").trim().toUpperCase();
  if (s === "CREDIT") return "Credit";
  if (s === "DEBIT") return "Debit";
  return d;
};

// ========================================================
// 4. GET PAGINATED WALLET TRANSACTIONS WITH FILTERS
// ========================================================
export const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      type = "All",
      direction = "All",
      search = "",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));

    const wallet = await getOrCreateUserWallet(userId);
    let filtered = [...(wallet.transactions || [])];

    // Filter by type (with case-insensitive normalization)
    if (type && type !== "All") {
      const targetType = normalizeFilterType(type);
      filtered = filtered.filter((tx) => normalizeFilterType(tx.type) === targetType);
    }

    // Filter by direction (Credit / Debit with normalization)
    if (direction && direction !== "All") {
      const targetDir = normalizeFilterDirection(direction);
      filtered = filtered.filter((tx) => normalizeFilterDirection(tx.direction) === targetDir);
    }

    // Search filter (transactionId, description, referenceId)
    const trimmedSearch = search ? String(search).trim().toLowerCase() : "";
    if (trimmedSearch) {
      filtered = filtered.filter(
        (tx) =>
          tx.transactionId.toLowerCase().includes(trimmedSearch) ||
          tx.description.toLowerCase().includes(trimmedSearch) ||
          (tx.referenceId && tx.referenceId.toLowerCase().includes(trimmedSearch))
      );
    }

    // Sort descending by date
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalTransactions = filtered.length;
    const totalPages = Math.ceil(totalTransactions / limitNum) || 1;
    const skip = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(skip, skip + limitNum);

    return res.status(200).json({
      success: true,
      balance: roundToPaise(wallet.balance),
      currency: wallet.currency || "INR",
      transactions: paginated,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalTransactions,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Get wallet transactions error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve wallet transactions.",
    });
  }
};

export default {
  getWalletBalance,
  createTopUpOrder,
  verifyTopUpPayment,
  getWalletTransactions,
  getOrCreateUserWallet,
};
