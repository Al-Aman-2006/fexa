import Product from "../models/product.model.js";

/**
 * Authoritative Inventory Service for FEXA Haute Parfumerie
 * Manages atomic variant-level and product-level stock deduction and restoration.
 */

/**
 * Deduct inventory for an entire order.
 * Idempotent: If order.inventoryProcessed is already true, skips deduction.
 * 
 * @param {Object} order - Mongoose Order document
 * @returns {Promise<{ success: boolean, alreadyProcessed?: boolean, failedItem?: Object, message?: string }>}
 */
export const deductOrderStock = async (order) => {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return { success: false, message: "No items present in order to deduct inventory." };
  }

  // Idempotency: Do not deduct twice
  if (order.inventoryProcessed === true) {
    return { success: true, alreadyProcessed: true };
  }

  const successfullyDeductedItems = [];

  for (const item of order.items) {
    // Only deduct if this item was not already marked deducted
    if (item.stockDeducted) continue;

    const prodId = item.product?._id || item.product;
    const varId = item.variantId;
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);

    if (!prodId || !varId) {
      continue;
    }

    // Atomic conditional decrement to strictly prevent overselling and negative stock
    const updateResult = await Product.updateOne(
      {
        _id: prodId,
        "variants._id": varId,
        "variants.stock": { $gte: qty },
      },
      {
        $inc: {
          "variants.$.stock": -qty,
          stock: -qty,
        },
      }
    );

    if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
      // Stock unavailable or taken by concurrent request - Rollback already deducted items!
      for (const rolled of successfullyDeductedItems) {
        await Product.updateOne(
          { _id: rolled.prodId, "variants._id": rolled.varId },
          {
            $inc: {
              "variants.$.stock": rolled.qty,
              stock: rolled.qty,
            },
          }
        );
      }

      return {
        success: false,
        failedItem: item,
        message: "Sorry, this product is currently out of stock or the requested quantity is unavailable.",
      };
    }

    successfullyDeductedItems.push({ prodId, varId, qty, item });
  }

  // Mark items as deducted
  for (const deducted of successfullyDeductedItems) {
    deducted.item.stockDeducted = true;
    deducted.item.stockRestored = false;

    // Synchronize variant availability and product status
    const productDoc = await Product.findById(deducted.prodId);
    if (productDoc) {
      const variant = productDoc.variants.id(deducted.varId);
      if (variant && variant.stock <= 0) {
        variant.isAvailable = false;
      }
      if (productDoc.stock <= 0 && productDoc.status === "Active") {
        productDoc.status = "Out of Stock";
      }
      await productDoc.save();
    }
  }

  // Mark order-level inventory processed
  order.inventoryProcessed = true;
  order.stockDeductedAt = new Date();
  order.stockRestored = false;
  order.stockRestoredAt = null;

  return { success: true };
};

/**
 * Restore inventory for an entire order upon cancellation.
 * Idempotent: If order was never deducted, or has already been restored, skips restoration.
 * 
 * @param {Object} order - Mongoose Order document
 * @returns {Promise<{ success: boolean, alreadyRestored?: boolean, neverDeducted?: boolean, restoredCount: number }>}
 */
export const restoreOrderStock = async (order) => {
  if (!order || !Array.isArray(order.items)) {
    return { success: false, message: "Invalid order document." };
  }

  // If inventory was never deducted, do NOT restore stock
  if (!order.inventoryProcessed) {
    return { success: true, neverDeducted: true, restoredCount: 0 };
  }

  // Idempotency: Do not restore twice
  if (order.stockRestored === true) {
    return { success: true, alreadyRestored: true, restoredCount: 0 };
  }

  let restoredCount = 0;

  for (const item of order.items) {
    const prodId = item.product?._id || item.product;
    const varId = item.variantId;
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);

    // Only restore if item was deducted and not yet restored
    if (item.stockDeducted && !item.stockRestored && prodId && varId) {
      await Product.updateOne(
        { _id: prodId, "variants._id": varId },
        {
          $inc: {
            "variants.$.stock": qty,
            stock: qty,
          },
        }
      );

      item.stockRestored = true;
      item.stockRestoredAt = new Date();
      restoredCount += qty;

      // Reactivate variant and product if previously marked Out of Stock
      const productDoc = await Product.findById(prodId);
      if (productDoc) {
        const variant = productDoc.variants.id(varId);
        if (variant && variant.stock > 0) {
          variant.isAvailable = true;
        }
        if (productDoc.stock > 0 && productDoc.status === "Out of Stock") {
          productDoc.status = "Active";
        }
        await productDoc.save();
      }
    }
  }

  order.stockRestored = true;
  order.stockRestoredAt = new Date();

  return { success: true, restoredCount };
};

/**
 * Restore inventory for a single order item (Partial cancellation).
 * Idempotent: If item was never deducted or already restored, skips.
 * 
 * @param {Object} order - Mongoose Order document
 * @param {string|ObjectId} itemId - Item ID inside order.items
 * @returns {Promise<{ success: boolean, alreadyRestored?: boolean, neverDeducted?: boolean, restoredQty: number }>}
 */
export const restoreOrderItemStock = async (order, itemId) => {
  if (!order || !Array.isArray(order.items)) {
    return { success: false, message: "Invalid order document." };
  }

  const item = order.items.id ? order.items.id(itemId) : order.items.find((it) => it._id.toString() === itemId.toString());
  if (!item) {
    return { success: false, message: "Item not found in order." };
  }

  // If order or item was never deducted, do NOT restore
  if (!order.inventoryProcessed && !item.stockDeducted) {
    return { success: true, neverDeducted: true, restoredQty: 0 };
  }

  // Idempotency: Do not restore item twice
  if (item.stockRestored === true) {
    return { success: true, alreadyRestored: true, restoredQty: 0 };
  }

  const prodId = item.product?._id || item.product;
  const varId = item.variantId;
  const qty = Math.max(1, parseInt(item.quantity, 10) || 1);

  if (prodId && varId) {
    await Product.updateOne(
      { _id: prodId, "variants._id": varId },
      {
        $inc: {
          "variants.$.stock": qty,
          stock: qty,
        },
      }
    );

    item.stockRestored = true;
    item.stockRestoredAt = new Date();

    // Reactivate variant and product if previously marked Out of Stock
    const productDoc = await Product.findById(prodId);
    if (productDoc) {
      const variant = productDoc.variants.id(varId);
      if (variant && variant.stock > 0) {
        variant.isAvailable = true;
      }
      if (productDoc.stock > 0 && productDoc.status === "Out of Stock") {
        productDoc.status = "Active";
      }
      await productDoc.save();
    }
  }

  // If all items in this order are now restored, mark the whole order as stockRestored
  const allItemsRestored = order.items.every((it) => it.stockRestored === true || !it.stockDeducted);
  if (allItemsRestored) {
    order.stockRestored = true;
    order.stockRestoredAt = new Date();
  }

  return { success: true, restoredQty: qty };
};

