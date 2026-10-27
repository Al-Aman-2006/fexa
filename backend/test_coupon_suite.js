import {
  calculateItemCouponAllocations,
  calculateItemRefund,
  normalizeOrderWithAllocations,
  roundToPaise,
} from "./utils/couponAllocation.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log("=================================================");
console.log("RUNNING FEXA PRODUCT-LEVEL COUPON TEST SUITE");
console.log("=================================================\n");

// -------------------------------------------------------------------------
// TEST A: SIMPLE PERCENTAGE COUPON
// -------------------------------------------------------------------------
console.log("--- TEST A: SIMPLE PERCENTAGE COUPON ---");
{
  const items = [
    { name: "Product 1", unitPrice: 1000, quantity: 1 },
    { name: "Product 2", unitPrice: 2000, quantity: 1 },
    { name: "Product 3", unitPrice: 3000, quantity: 1 },
  ];
  const coupon = { code: "FEXA10", discountPercentage: 10, maxDiscount: null };

  const result = calculateItemCouponAllocations({ items, coupon });

  assert(result.totalCouponDiscount === 600, `Total discount should be ₹600, got ${result.totalCouponDiscount}`);
  assert(result.discountedMerchandiseTotal === 5400, `Discounted total should be ₹5,400, got ${result.discountedMerchandiseTotal}`);

  const [p1, p2, p3] = result.allocatedItems;
  assert(p1.allocatedCouponDiscount === 100 && p1.discountedLineAmount === 900, `P1 discount should be 100, net 900 (got ${p1.allocatedCouponDiscount}, ${p1.discountedLineAmount})`);
  assert(p2.allocatedCouponDiscount === 200 && p2.discountedLineAmount === 1800, `P2 discount should be 200, net 1800 (got ${p2.allocatedCouponDiscount}, ${p2.discountedLineAmount})`);
  assert(p3.allocatedCouponDiscount === 300 && p3.discountedLineAmount === 2700, `P3 discount should be 300, net 2700 (got ${p3.allocatedCouponDiscount}, ${p3.discountedLineAmount})`);
}

// -------------------------------------------------------------------------
// TEST B: RETURN ONE PRODUCT
// -------------------------------------------------------------------------
console.log("\n--- TEST B: RETURN ONE PRODUCT ---");
{
  const items = [
    { name: "Product 1", unitPrice: 1000, quantity: 1 },
    { name: "Product 2", unitPrice: 2000, quantity: 1 },
    { name: "Product 3", unitPrice: 3000, quantity: 1 },
  ];
  const coupon = { code: "FEXA10", discountPercentage: 10, maxDiscount: null };
  const orderResult = calculateItemCouponAllocations({ items, coupon });
  const p2 = orderResult.allocatedItems[1];

  const refund = calculateItemRefund(p2, 1);
  assert(refund.refundAmount === 1800, `P2 refund should be ₹1,800, got ₹${refund.refundAmount}`);
  assert(refund.isFullyReturned === true, `P2 should be marked fully returned`);

  // Verify P1 and P3 keep their original discounts
  const p1 = orderResult.allocatedItems[0];
  const p3 = orderResult.allocatedItems[2];
  assert(p1.discountedLineAmount === 900 && p1.allocatedCouponDiscount === 100, `P1 remains unchanged at ₹900 net`);
  assert(p3.discountedLineAmount === 2700 && p3.allocatedCouponDiscount === 300, `P3 remains unchanged at ₹2,700 net`);
}

// -------------------------------------------------------------------------
// TEST C: MULTIPLE QUANTITIES OF SAME PRODUCT
// -------------------------------------------------------------------------
console.log("\n--- TEST C: MULTIPLE QUANTITIES ---");
{
  const items = [
    { name: "Velvet Oud", volumeMl: 50, unitPrice: 1000, quantity: 3 },
  ];
  const coupon = { code: "FEXA10", discountPercentage: 10, maxDiscount: null };

  const result = calculateItemCouponAllocations({ items, coupon });
  const item = result.allocatedItems[0];

  assert(item.originalLineAmount === 3000, `Original line amount should be ₹3,000, got ${item.originalLineAmount}`);
  assert(item.allocatedCouponDiscount === 300, `Allocated discount should be ₹300, got ${item.allocatedCouponDiscount}`);
  assert(item.discountedLineAmount === 2700, `Discounted line amount should be ₹2,700, got ${item.discountedLineAmount}`);
  assert(item.perUnitDiscount === 100, `Per unit discount should be ₹100, got ${item.perUnitDiscount}`);
  assert(item.discountedUnitAmount === 900, `Discounted unit amount should be ₹900, got ${item.discountedUnitAmount}`);

  // Return 1 unit
  const refund1 = calculateItemRefund(item, 1);
  assert(refund1.refundAmount === 900, `1 unit refund should be ₹900, got ${refund1.refundAmount}`);
  assert(refund1.remainingQuantity === 2, `2 units remaining`);

  // Simulate updating item state after 1st return
  const itemAfterFirstReturn = {
    ...item,
    returnedQuantity: 1,
    refundAmount: 900,
  };

  // Return remaining 2 units
  const refund2 = calculateItemRefund(itemAfterFirstReturn, 2);
  assert(refund2.refundAmount === 1800, `Remaining 2 units refund should be ₹1,800, got ${refund2.refundAmount}`);
  assert(refund2.isFullyReturned === true, `All 3 units now returned`);
  assert(refund1.refundAmount + refund2.refundAmount === 2700, `Total refunded ₹2,700 matches discounted line amount`);
}

// -------------------------------------------------------------------------
// TEST D: MAXIMUM DISCOUNT CAP WITH ROUNDING RECONCILIATION
// -------------------------------------------------------------------------
console.log("\n--- TEST D: MAXIMUM DISCOUNT CAP ---");
{
  const items = [
    { name: "Product 1", unitPrice: 1000, quantity: 1 },
    { name: "Product 2", unitPrice: 2000, quantity: 1 },
    { name: "Product 3", unitPrice: 3000, quantity: 1 },
  ];
  const coupon = { code: "FEXA50", discountPercentage: 50, maxDiscount: 1000 };

  const result = calculateItemCouponAllocations({ items, coupon });
  assert(result.totalCouponDiscount === 1000, `Total discount must equal maxDiscount cap ₹1,000, got ${result.totalCouponDiscount}`);

  const [p1, p2, p3] = result.allocatedItems;
  const sumOfLineDiscounts = roundToPaise(
    p1.allocatedCouponDiscount + p2.allocatedCouponDiscount + p3.allocatedCouponDiscount
  );

  assert(sumOfLineDiscounts === 1000, `Sum of allocations (${sumOfLineDiscounts}) must equal exactly ₹1,000.00`);
  assert(p1.allocatedCouponDiscount === 166.67, `P1 discount should be ₹166.67, got ${p1.allocatedCouponDiscount}`);
  assert(p2.allocatedCouponDiscount === 333.33, `P2 discount should be ₹333.33, got ${p2.allocatedCouponDiscount}`);
  assert(p3.allocatedCouponDiscount === 500.00, `P3 discount should be ₹500.00, got ${p3.allocatedCouponDiscount}`);

  // Return Product 1
  const refundP1 = calculateItemRefund(p1, 1);
  assert(refundP1.refundAmount === 833.33, `P1 refund base should be 1000 - 166.67 = ₹833.33, got ${refundP1.refundAmount}`);
}

// -------------------------------------------------------------------------
// TEST E: DIFFERENT PERFUME SIZES / VARIANTS
// -------------------------------------------------------------------------
console.log("\n--- TEST E: DIFFERENT PERFUME SIZES ---");
{
  const items = [
    { name: "Oud Royale", volumeMl: 50, unitPrice: 2500, quantity: 1 },
    { name: "Oud Royale", volumeMl: 100, unitPrice: 4500, quantity: 1 },
  ];
  const coupon = { code: "FEXA20", discountPercentage: 20, maxDiscount: null };

  const result = calculateItemCouponAllocations({ items, coupon });
  const [v50, v100] = result.allocatedItems;

  assert(v50.allocatedCouponDiscount === 500 && v50.discountedLineAmount === 2000, `50ml variant discount ₹500, net ₹2,000`);
  assert(v100.allocatedCouponDiscount === 900 && v100.discountedLineAmount === 3600, `100ml variant discount ₹900, net ₹3,600`);
  assert(result.totalCouponDiscount === 1400, `Total discount is ₹1,400`);

  const refund50 = calculateItemRefund(v50, 1);
  assert(refund50.refundAmount === 2000, `50ml refund is ₹2,000`);
}

// -------------------------------------------------------------------------
// TEST F: EXCLUDED / ZERO-DISCOUNT ITEMS
// -------------------------------------------------------------------------
console.log("\n--- TEST F: PRESERVING ZERO DISCOUNT ITEMS ---");
{
  const items = [
    { name: "Eligible Product", unitPrice: 2000, quantity: 1 },
    { name: "Accessory / Sample", unitPrice: 500, quantity: 1 },
  ];
  const coupon = { code: "FEXA10", discountPercentage: 10, maxDiscount: null };

  const result = calculateItemCouponAllocations({ items, coupon });
  assert(result.totalCouponDiscount === 250, `Subtotal ₹2,500 with 10% = ₹250 discount`);
}

// -------------------------------------------------------------------------
// TEST G: FULL RETURN WORKFLOW & DOUBLE REFUND PREVENTION
// -------------------------------------------------------------------------
console.log("\n--- TEST G: FULL RETURN & PREVENT OVER-REFUND ---");
{
  const items = [
    { name: "Fragrance A", unitPrice: 1500, quantity: 2 },
  ];
  const coupon = { code: "FEXA10", discountPercentage: 10, maxDiscount: null };
  const result = calculateItemCouponAllocations({ items, coupon });
  const item = result.allocatedItems[0]; // Total net: 3000 - 300 = 2700

  // 1st return: 1 unit (refund ₹1,350)
  const r1 = calculateItemRefund(item, 1);
  assert(r1.refundAmount === 1350, `First unit refunded at ₹1,350`);

  const itemAfterR1 = {
    ...item,
    returnedQuantity: 1,
    refundAmount: 1350,
  };

  // 2nd return: 1 unit (refund remaining ₹1,350)
  const r2 = calculateItemRefund(itemAfterR1, 1);
  assert(r2.refundAmount === 1350, `Second unit refunded at ₹1,350`);
  assert(r1.refundAmount + r2.refundAmount === 2700, `Total refunded equals full net merchandise amount`);

  // Attempting 3rd return when 0 units remain should throw error
  const itemFullyReturned = {
    ...item,
    returnedQuantity: 2,
    refundAmount: 2700,
  };

  let threw = false;
  try {
    calculateItemRefund(itemFullyReturned, 1);
  } catch (err) {
    threw = true;
    assert(err.message.includes("Only 0 units remain eligible for return"), `Double return prevented: ${err.message}`);
  }
  assert(threw, "Excess return properly blocked");
}

// -------------------------------------------------------------------------
// TEST H: HISTORICAL ORDER COMPATIBILITY FALLBACK
// -------------------------------------------------------------------------
console.log("\n--- TEST H: HISTORICAL ORDER COMPATIBILITY ---");
{
  const historicalOrder = {
    orderNumber: "FEXA-HISTORICAL-001",
    subtotal: 5000,
    discountAmount: 500,
    totalAmount: 4500,
    couponCode: "OLDCOUPON",
    items: [
      { name: "Old Flacon 1", unitPrice: 2000, quantity: 1, lineTotal: 2000 },
      { name: "Old Flacon 2", unitPrice: 3000, quantity: 1, lineTotal: 3000 },
    ],
  };

  const normalized = normalizeOrderWithAllocations(historicalOrder);
  assert(normalized.items[0].allocatedCouponDiscount === 200, `Historical Item 1 allocated ₹200 fallback discount`);
  assert(normalized.items[0].discountedLineAmount === 1800, `Historical Item 1 net amount ₹1,800`);
  assert(normalized.items[1].allocatedCouponDiscount === 300, `Historical Item 2 allocated ₹300 fallback discount`);
  assert(normalized.items[1].discountedLineAmount === 2700, `Historical Item 2 net amount ₹2,700`);
  assert(
    normalized.items[0].allocatedCouponDiscount + normalized.items[1].allocatedCouponDiscount === 500,
    `Sum of fallback allocations equals recorded order discountAmount ₹500`
  );

  // Return on historical order
  const histRefund = calculateItemRefund(normalized.items[0], 1);
  assert(histRefund.refundAmount === 1800, `Historical return calculates accurately using fallback allocation`);
}

console.log("\n=================================================");
console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
console.log("=================================================");
