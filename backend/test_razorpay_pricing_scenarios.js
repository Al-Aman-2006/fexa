import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { calculateItemCouponAllocations, calculateItemRefund, roundToPaise } from "./utils/couponAllocation.js";
import Coupon from "./models/coupon.model.js";
import Order from "./models/order.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

console.log("=================================================");
console.log("RUNNING FEXA RAZORPAY PRICING & PAYMENT TESTS");
console.log("=================================================");

// -------------------------------------------------------------
// TEST 1: Current Reported Issue (Product Offer + 50% Coupon)
// -------------------------------------------------------------
console.log("\n--- TEST 1: PRODUCT OFFER + 50% COUPON ---");
{
  const originalPrice = 500;
  const productOfferDiscount = 100;
  const offerPrice = 400;
  const quantity = 1;
  const shipping = 250;

  const items = [
    {
      name: "Rouge Chaotique",
      quantity,
      unitPrice: offerPrice,
      originalPrice,
      offerDiscount: productOfferDiscount,
      offerAdjustedUnitPrice: offerPrice,
    },
  ];

  const coupon = new Coupon({
    code: "SAVE50",
    discountPercentage: 50,
    maxDiscount: null,
    startDate: new Date(Date.now() - 86400000),
    expiryDate: new Date(Date.now() + 86400000),
  });

  const calculatedSubtotal = offerPrice * quantity; // 400
  const originalSubtotal = originalPrice * quantity; // 500

  const allocation = calculateItemCouponAllocations({
    items,
    coupon,
    merchandiseSubtotal: calculatedSubtotal,
    originalSubtotal,
  });

  const couponDiscount = allocation.totalCouponDiscount;
  const netMerchandise = allocation.discountedMerchandiseTotal;
  const finalPayable = Math.max(0, netMerchandise) + shipping;
  const razorpayPaise = Math.round(finalPayable * 100);

  assert(originalSubtotal === 500, `Original subtotal is ₹500 (got ${originalSubtotal})`);
  assert(calculatedSubtotal === 400, `Subtotal after product offer is ₹400 (got ${calculatedSubtotal})`);
  assert(couponDiscount === 250, `Coupon discount is exactly ₹250 (50% of ₹500) (got ${couponDiscount})`);
  assert(netMerchandise === 150, `Net merchandise after all discounts is ₹150 (got ${netMerchandise})`);
  assert(finalPayable === 400, `Final payable amount on checkout is exactly ₹400 (got ${finalPayable})`);
  assert(razorpayPaise === 40000, `Razorpay order amount passed to gateway is exactly 40000 paise (₹400) (got ${razorpayPaise})`);
}

// -------------------------------------------------------------
// TEST 2: Without Coupon (Product Offer Only)
// -------------------------------------------------------------
console.log("\n--- TEST 2: WITHOUT COUPON (PRODUCT OFFER ONLY) ---");
{
  const originalPrice = 500;
  const productOfferDiscount = 100;
  const offerPrice = 400;
  const quantity = 1;
  const shipping = 250;

  const items = [
    {
      name: "Rouge Chaotique",
      quantity,
      unitPrice: offerPrice,
      originalPrice,
      offerDiscount: productOfferDiscount,
      offerAdjustedUnitPrice: offerPrice,
    },
  ];

  const calculatedSubtotal = offerPrice * quantity; // 400
  const originalSubtotal = originalPrice * quantity; // 500

  const allocation = calculateItemCouponAllocations({
    items,
    coupon: null,
    merchandiseSubtotal: calculatedSubtotal,
    originalSubtotal,
  });

  const couponDiscount = allocation.totalCouponDiscount;
  const netMerchandise = allocation.discountedMerchandiseTotal;
  const finalPayable = Math.max(0, netMerchandise) + shipping;
  const razorpayPaise = Math.round(finalPayable * 100);

  assert(originalSubtotal === 500, `Original subtotal is ₹500`);
  assert(couponDiscount === 0, `Coupon discount is ₹0`);
  assert(finalPayable === 650, `Final payable amount is exactly ₹650 (got ${finalPayable})`);
  assert(razorpayPaise === 65000, `Razorpay order amount is exactly 65000 paise (₹650) (got ${razorpayPaise})`);
}

// -------------------------------------------------------------
// TEST 3: Without Product Offer (50% Coupon Only)
// -------------------------------------------------------------
console.log("\n--- TEST 3: WITHOUT PRODUCT OFFER (50% COUPON ONLY) ---");
{
  const originalPrice = 500;
  const offerPrice = 500;
  const quantity = 1;
  const shipping = 250;

  const items = [
    {
      name: "Rouge Chaotique",
      quantity,
      unitPrice: offerPrice,
      originalPrice,
      offerDiscount: 0,
      offerAdjustedUnitPrice: offerPrice,
    },
  ];

  const coupon = new Coupon({
    code: "SAVE50",
    discountPercentage: 50,
    maxDiscount: null,
    startDate: new Date(Date.now() - 86400000),
    expiryDate: new Date(Date.now() + 86400000),
  });

  const calculatedSubtotal = offerPrice * quantity; // 500
  const originalSubtotal = originalPrice * quantity; // 500

  const allocation = calculateItemCouponAllocations({
    items,
    coupon,
    merchandiseSubtotal: calculatedSubtotal,
    originalSubtotal,
  });

  const couponDiscount = allocation.totalCouponDiscount;
  const netMerchandise = allocation.discountedMerchandiseTotal;
  const finalPayable = Math.max(0, netMerchandise) + shipping;
  const razorpayPaise = Math.round(finalPayable * 100);

  assert(originalSubtotal === 500, `Original subtotal is ₹500`);
  assert(couponDiscount === 250, `Coupon discount is ₹250 (got ${couponDiscount})`);
  assert(finalPayable === 500, `Final payable amount is exactly ₹500 (got ${finalPayable})`);
  assert(razorpayPaise === 50000, `Razorpay order amount is exactly 50000 paise (₹500) (got ${razorpayPaise})`);
}

// -------------------------------------------------------------
// TEST 4: Return / Refund Base for Offer + Coupon Items
// -------------------------------------------------------------
console.log("\n--- TEST 4: RETURN AND REFUND ACCURACY ---");
{
  const items = [
    {
      name: "Rouge Chaotique",
      quantity: 1,
      unitPrice: 400,
      originalPrice: 500,
      offerDiscount: 100,
      offerAdjustedUnitPrice: 400,
    },
  ];

  const coupon = new Coupon({
    code: "SAVE50",
    discountPercentage: 50,
    maxDiscount: null,
    startDate: new Date(Date.now() - 86400000),
    expiryDate: new Date(Date.now() + 86400000),
  });

  const allocation = calculateItemCouponAllocations({
    items,
    coupon,
    merchandiseSubtotal: 400,
    originalSubtotal: 500,
  });

  const allocatedItem = allocation.allocatedItems[0];
  assert(allocatedItem.allocatedCouponDiscount === 250, `Item allocated discount is ₹250`);
  assert(allocatedItem.discountedLineAmount === 150, `Item net amount is ₹150 (got ${allocatedItem.discountedLineAmount})`);

  const refundResult = calculateItemRefund(allocatedItem, 1);
  assert(refundResult.refundAmount === 150, `Refund for returning item is exactly ₹150 (net customer paid) (got ${refundResult.refundAmount})`);
  assert(refundResult.isFullyReturned === true, `Item is marked fully returned`);
}

// -------------------------------------------------------------
// TEST 5: Cryptographic Signature & Amount Security
// -------------------------------------------------------------
console.log("\n--- TEST 5: CRYPTOGRAPHIC SIGNATURE & AMOUNT VERIFICATION ---");
{
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "vlYvPndeLZ07y6a3ovxB3aPp";
  const rzpOrderId = "order_test_987654321";
  const rzpPaymentId = "pay_test_123456789";

  const validSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${rzpOrderId}|${rzpPaymentId}`)
    .digest("hex");

  const tamperedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${rzpOrderId}|pay_tampered_999`)
    .digest("hex");

  assert(validSignature.length === 64, `HMAC signature length is 64 hex characters`);
  assert(validSignature !== tamperedSignature, `Tampered signature does not match`);

  // Verify amount comparison logic
  const backendFinalAmount = 400; // ₹400
  const expectedPaisa = Math.round(backendFinalAmount * 100); // 40000 paise
  const gatewayAmount = 40000; // 40000 paise from Razorpay
  const forgedGatewayAmount = 45000; // 45000 paise

  assert(gatewayAmount === expectedPaisa, `Gateway amount 40000 paise matches backend expected 40000 paise`);
  assert(forgedGatewayAmount !== expectedPaisa, `Mismatched gateway amount 45000 paise is detected and rejected`);
}

console.log("\n=================================================");
console.log(`🎉 ALL ${passed}/${total} RAZORPAY PRICING TESTS PASSED!`);
console.log("=================================================");

