/**
 * FEXA — Product-Level Coupon Discount Allocation & Refund Calculator
 *
 * Implements authoritative per-product discount allocation for percentage coupons,
 * supports maximum discount caps with proportional distribution, deterministic
 * paise/rupee rounding reconciliation, and unit-level return/refund calculations.
 */

/**
 * Deterministically rounds a number to 2 decimal places (paise precision).
 * @param {number} val
 * @returns {number}
 */
export const roundToPaise = (val) => {
  return Math.round((Number(val) || 0) * 100) / 100;
};

/**
 * Allocates coupon discounts to each individual product line.
 *
 * Formula for uncapped percentage coupon:
 *   Product Original Amount = unitPrice × quantity
 *   Product Coupon Discount = Product Original Amount × percentage / 100
 *   Product Net Amount = Product Original Amount - Product Coupon Discount
 *
 * For coupons with a maximum discount cap (maxDiscount):
 *   1. Calculate uncapped percentage discount for each eligible line.
 *   2. Determine actual permitted coupon discount = min(maxDiscount, totalUncappedDiscount).
 *   3. If capped, allocate proportionally across lines based on uncapped discount contribution.
 *   4. Reconcile any rounding difference (paise) deterministically to the largest line item so:
 *      Sum of Allocated Product Discounts ≡ Actual Order Coupon Discount
 *
 * @param {Object} params
 * @param {Array} params.items - Array of order items with { unitPrice, quantity, lineTotal, ... }
 * @param {Object|null} params.coupon - Coupon document or coupon details
 * @param {number} params.merchandiseSubtotal - Sum of original line amounts
 * @returns {Object} { allocatedItems, totalCouponDiscount, discountedMerchandiseTotal }
 */
export const calculateItemCouponAllocations = ({ items, coupon, merchandiseSubtotal }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      allocatedItems: [],
      totalCouponDiscount: 0,
      discountedMerchandiseTotal: 0,
    };
  }

  // 1. Calculate baseline original line amounts for each item
  const preparedItems = items.map((item) => {
    const unitPrice = roundToPaise(item.unitPrice || 0);
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
    const originalLineAmount = roundToPaise(unitPrice * quantity);

    return {
      ...item,
      unitPrice,
      quantity,
      originalLineAmount,
      lineTotal: originalLineAmount,
    };
  });

  const subtotal = roundToPaise(
    merchandiseSubtotal !== undefined && merchandiseSubtotal !== null
      ? merchandiseSubtotal
      : preparedItems.reduce((acc, it) => acc + it.originalLineAmount, 0)
  );

  // If no coupon applied, all allocations are 0
  if (!coupon || !coupon.discountPercentage || coupon.discountPercentage <= 0) {
    const allocatedItems = preparedItems.map((item) => ({
      ...item,
      allocatedCouponDiscount: 0,
      discountedLineAmount: item.originalLineAmount,
      perUnitDiscount: 0,
      discountedUnitAmount: item.unitPrice,
      returnedQuantity: item.returnedQuantity || 0,
      refundAmount: item.refundAmount || 0,
      itemStatus: item.itemStatus || "Active",
      refundStatus: item.refundStatus || "None",
    }));

    return {
      allocatedItems,
      totalCouponDiscount: 0,
      discountedMerchandiseTotal: subtotal,
    };
  }

  const percentage = Number(coupon.discountPercentage);
  const maxCap =
    coupon.maxDiscount !== undefined && coupon.maxDiscount !== null
      ? Number(coupon.maxDiscount)
      : coupon.maximumDiscount !== undefined && coupon.maximumDiscount !== null
      ? Number(coupon.maximumDiscount)
      : null;

  // Step A: Calculate uncapped discount for each line
  const itemsWithUncapped = preparedItems.map((item) => {
    // Uncapped discount = lineAmount * percentage / 100
    const rawDiscount = (item.originalLineAmount * percentage) / 100;
    return {
      ...item,
      rawUncappedDiscount: rawDiscount,
      uncappedDiscount: roundToPaise(rawDiscount),
    };
  });

  const totalUncappedDiscount = itemsWithUncapped.reduce(
    (acc, it) => acc + it.uncappedDiscount,
    0
  );

  // Step B: Determine actual permitted order coupon discount
  let actualOrderCouponDiscount = roundToPaise(totalUncappedDiscount);
  const isCapped = Boolean(maxCap && maxCap > 0 && totalUncappedDiscount > maxCap);

  if (isCapped) {
    actualOrderCouponDiscount = roundToPaise(Math.min(maxCap, subtotal));
  } else {
    actualOrderCouponDiscount = roundToPaise(Math.min(actualOrderCouponDiscount, subtotal));
  }

  // Step C: Proportional allocation across items
  let runningAllocatedSum = 0;
  const allocatedLines = itemsWithUncapped.map((item) => {
    let lineDiscount = 0;

    if (totalUncappedDiscount <= 0 || actualOrderCouponDiscount <= 0) {
      lineDiscount = 0;
    } else if (isCapped) {
      // Proportional allocation based on contribution to uncapped discount
      const proportion = item.uncappedDiscount / totalUncappedDiscount;
      lineDiscount = roundToPaise(actualOrderCouponDiscount * proportion);
    } else {
      lineDiscount = item.uncappedDiscount;
    }

    // Never exceed the line's original amount
    lineDiscount = Math.min(lineDiscount, item.originalLineAmount);
    runningAllocatedSum = roundToPaise(runningAllocatedSum + lineDiscount);

    return {
      ...item,
      allocatedCouponDiscount: lineDiscount,
    };
  });

  // Step D: Deterministic Rounding Reconciliation
  // If rounded line allocations create a difference of a few paise from actualOrderCouponDiscount,
  // reconcile the difference deterministically on the line with the largest originalLineAmount.
  const roundingDifference = roundToPaise(actualOrderCouponDiscount - runningAllocatedSum);

  if (roundingDifference !== 0 && allocatedLines.length > 0) {
    // Find index of item with largest original line amount (tie breaker: highest index)
    let maxIdx = 0;
    let maxAmount = -1;

    for (let i = 0; i < allocatedLines.length; i++) {
      if (allocatedLines[i].originalLineAmount >= maxAmount) {
        maxAmount = allocatedLines[i].originalLineAmount;
        maxIdx = i;
      }
    }

    const targetItem = allocatedLines[maxIdx];
    const adjustedDiscount = roundToPaise(targetItem.allocatedCouponDiscount + roundingDifference);

    // Safety: discount cannot exceed original line amount or fall below 0
    if (adjustedDiscount >= 0 && adjustedDiscount <= targetItem.originalLineAmount) {
      targetItem.allocatedCouponDiscount = adjustedDiscount;
    }
  }

  // Step E: Compute discountedLineAmount, perUnitDiscount, and discountedUnitAmount
  let finalTotalDiscount = 0;
  const allocatedItems = allocatedLines.map((item) => {
    const allocatedCouponDiscount = roundToPaise(item.allocatedCouponDiscount);
    const discountedLineAmount = roundToPaise(item.originalLineAmount - allocatedCouponDiscount);

    const perUnitDiscount =
      item.quantity > 0
        ? roundToPaise(allocatedCouponDiscount / item.quantity)
        : 0;

    const discountedUnitAmount = roundToPaise(item.unitPrice - perUnitDiscount);

    finalTotalDiscount = roundToPaise(finalTotalDiscount + allocatedCouponDiscount);

    return {
      ...item,
      allocatedCouponDiscount,
      discountedLineAmount,
      perUnitDiscount,
      discountedUnitAmount,
      returnedQuantity: item.returnedQuantity || 0,
      refundAmount: item.refundAmount || 0,
      itemStatus: item.itemStatus || "Active",
      refundStatus: item.refundStatus || "None",
    };
  });

  const discountedMerchandiseTotal = roundToPaise(subtotal - finalTotalDiscount);

  return {
    allocatedItems,
    totalCouponDiscount: finalTotalDiscount,
    discountedMerchandiseTotal,
  };
};

/**
 * Calculates the exact merchandise refund base for returning a specific quantity of an item.
 *
 * Rules:
 * - Return quantity k must be 1 <= k <= (quantity - alreadyReturned).
 * - Base refund for partial return = k × discountedUnitAmount.
 * - When all remaining units are returned, base refund is exactly
 *   (discountedLineAmount - previousRefunds) to protect against any fraction rounding.
 *
 * @param {Object} item - Order item with stored discount allocation snapshot
 * @param {number} returnQty - Number of units being returned
 * @returns {Object} { refundAmount, remainingQuantity, newReturnedQuantity, isFullyReturned }
 */
export const calculateItemRefund = (item, returnQty) => {
  const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
  const alreadyReturned = Math.max(0, parseInt(item.returnedQuantity, 10) || 0);
  const alreadyRefunded = roundToPaise(item.refundAmount || 0);

  const availableToReturn = Math.max(0, quantity - alreadyReturned);
  const requestedQty = Math.max(1, parseInt(returnQty, 10) || 1);

  if (requestedQty > availableToReturn) {
    throw new Error(
      `Cannot return ${requestedQty} units. Only ${availableToReturn} units remain eligible for return.`
    );
  }

  const discountedUnitAmount =
    item.discountedUnitAmount !== undefined && item.discountedUnitAmount !== null
      ? Number(item.discountedUnitAmount)
      : roundToPaise(
          (item.discountedLineAmount || item.lineTotal || item.unitPrice * quantity) / quantity
        );

  const discountedLineAmount =
    item.discountedLineAmount !== undefined && item.discountedLineAmount !== null
      ? roundToPaise(item.discountedLineAmount)
      : roundToPaise(discountedUnitAmount * quantity);

  let refundAmount = 0;
  const isReturningAllRemaining = requestedQty === availableToReturn;

  if (isReturningAllRemaining) {
    // Reconcile remaining merchandise paid
    refundAmount = roundToPaise(discountedLineAmount - alreadyRefunded);
  } else {
    refundAmount = roundToPaise(requestedQty * discountedUnitAmount);
  }

  // Safety: never refund more than remaining discounted line amount
  refundAmount = Math.max(0, Math.min(refundAmount, roundToPaise(discountedLineAmount - alreadyRefunded)));

  const newReturnedQuantity = alreadyReturned + requestedQty;
  const remainingQuantity = quantity - newReturnedQuantity;
  const isFullyReturned = newReturnedQuantity >= quantity;

  return {
    refundAmount,
    requestedQty,
    alreadyReturned,
    newReturnedQuantity,
    remainingQuantity,
    isFullyReturned,
    discountedUnitAmount,
    discountedLineAmount,
  };
};

/**
 * Normalizes an order item for historical orders that were created before
 * product-level coupon allocation was recorded.
 *
 * Safely reconstructs allocations using recorded order prices, original coupon,
 * and order discount, or leaves values clean without fabricated data.
 *
 * @param {Object} order - Full order document or lean object
 * @returns {Object} Normalized order with every item containing allocation fields
 */
export const normalizeOrderWithAllocations = (order) => {
  if (!order || !Array.isArray(order.items)) return order;

  // Check if items already have allocatedCouponDiscount populated
  const hasAllocations = order.items.some(
    (it) => it.allocatedCouponDiscount !== undefined && it.allocatedCouponDiscount !== null
  );

  if (hasAllocations) {
    return order;
  }

  // If no coupon was applied to the order
  if (!order.discountAmount || order.discountAmount <= 0 || !order.subtotal || order.subtotal <= 0) {
    const normalizedItems = order.items.map((it) => {
      const unitPrice = roundToPaise(it.unitPrice || 0);
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      const originalLineAmount = roundToPaise(it.lineTotal || unitPrice * qty);

      return {
        ...it,
        originalLineAmount,
        allocatedCouponDiscount: 0,
        discountedLineAmount: originalLineAmount,
        perUnitDiscount: 0,
        discountedUnitAmount: unitPrice,
        returnedQuantity: it.returnedQuantity || 0,
        refundAmount: it.refundAmount || 0,
        itemStatus: it.itemStatus || "Active",
        refundStatus: it.refundStatus || "None",
      };
    });

    return {
      ...order,
      items: normalizedItems,
    };
  }

  // Historical order had a coupon: reconstruct safe proportional allocation
  const totalDiscount = roundToPaise(order.discountAmount);
  const subtotal = roundToPaise(order.subtotal);

  let runningAllocated = 0;
  const reconstructedItems = order.items.map((it) => {
    const unitPrice = roundToPaise(it.unitPrice || 0);
    const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
    const originalLineAmount = roundToPaise(it.lineTotal || unitPrice * qty);

    const proportion = originalLineAmount / subtotal;
    const lineDiscount = roundToPaise(totalDiscount * proportion);
    runningAllocated = roundToPaise(runningAllocated + lineDiscount);

    return {
      ...it,
      unitPrice,
      quantity: qty,
      originalLineAmount,
      allocatedCouponDiscount: lineDiscount,
      discountedLineAmount: roundToPaise(originalLineAmount - lineDiscount),
      perUnitDiscount: roundToPaise(lineDiscount / qty),
      discountedUnitAmount: roundToPaise(unitPrice - roundToPaise(lineDiscount / qty)),
      returnedQuantity: it.returnedQuantity || 0,
      refundAmount: it.refundAmount || 0,
      itemStatus: it.itemStatus || "Active",
      refundStatus: it.refundStatus || "None",
    };
  });

  // Reconcile rounding difference on largest item
  const diff = roundToPaise(totalDiscount - runningAllocated);
  if (diff !== 0 && reconstructedItems.length > 0) {
    let maxIdx = 0;
    let maxAmount = -1;
    for (let i = 0; i < reconstructedItems.length; i++) {
      if (reconstructedItems[i].originalLineAmount > maxAmount) {
        maxAmount = reconstructedItems[i].originalLineAmount;
        maxIdx = i;
      }
    }
    reconstructedItems[maxIdx].allocatedCouponDiscount = roundToPaise(
      reconstructedItems[maxIdx].allocatedCouponDiscount + diff
    );
    reconstructedItems[maxIdx].discountedLineAmount = roundToPaise(
      reconstructedItems[maxIdx].originalLineAmount -
        reconstructedItems[maxIdx].allocatedCouponDiscount
    );
    reconstructedItems[maxIdx].perUnitDiscount = roundToPaise(
      reconstructedItems[maxIdx].allocatedCouponDiscount / reconstructedItems[maxIdx].quantity
    );
    reconstructedItems[maxIdx].discountedUnitAmount = roundToPaise(
      reconstructedItems[maxIdx].unitPrice - reconstructedItems[maxIdx].perUnitDiscount
    );
  }

  return {
    ...order,
    items: reconstructedItems,
  };
};

export default {
  roundToPaise,
  calculateItemCouponAllocations,
  calculateItemRefund,
  normalizeOrderWithAllocations,
};
