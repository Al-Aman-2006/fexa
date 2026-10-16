const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");

// ========================================================
// CREATE ORDER (With Re-validation & Atomic Variant Stock Deduction)
// ========================================================
const createOrder = async (req, res) => {
  const deductedItems = []; // Tracking for rollback in case of concurrency failure

  try {
    const userId = req.user.id;
    const { addressId, shippingAddressId, paymentMethod = "COD" } = req.body;

    // 0. Verify authenticated user and validate saved address
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    const targetAddressId =
      addressId ||
      shippingAddressId ||
      (req.body.shippingAddress && req.body.shippingAddress._id);

    if (!targetAddressId) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid saved delivery address from your profile.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(targetAddressId)) {
      return res.status(400).json({
        success: false,
        message: "The selected delivery address identifier is invalid.",
      });
    }

    const selectedAddress = user.addresses.id(targetAddressId);
    if (!selectedAddress) {
      return res.status(400).json({
        success: false,
        message: "The selected delivery address does not exist or does not belong to your account.",
      });
    }

    const hasStreetAddress = Boolean(
      (selectedAddress.house && selectedAddress.house.trim()) ||
      (selectedAddress.street && selectedAddress.street.trim()) ||
      (selectedAddress.addressLine && selectedAddress.addressLine.trim())
    );

    if (
      !selectedAddress.fullName ||
      !selectedAddress.fullName.trim() ||
      !selectedAddress.phone ||
      !selectedAddress.phone.trim() ||
      !selectedAddress.city ||
      !selectedAddress.city.trim() ||
      !selectedAddress.pincode ||
      !selectedAddress.pincode.trim() ||
      !hasStreetAddress
    ) {
      return res.status(400).json({
        success: false,
        message: "The selected delivery address is incomplete. Please update it in your profile before ordering.",
      });
    }

    const addressLineSnapshot =
      [selectedAddress.house, selectedAddress.street]
        .filter((part) => part && part.trim())
        .join(", ") || selectedAddress.addressLine || "";

    const shippingAddressSnapshot = {
      addressId: selectedAddress._id,
      label: selectedAddress.label || "Home",
      fullName: selectedAddress.fullName.trim(),
      phone: selectedAddress.phone.trim(),
      house: (selectedAddress.house || "").trim(),
      street: (selectedAddress.street || "").trim(),
      addressLine: addressLineSnapshot.trim(),
      city: selectedAddress.city.trim(),
      state: (selectedAddress.state || "").trim(),
      pincode: selectedAddress.pincode.trim(),
      country: selectedAddress.country || "India",
    };

    // 1. Fetch source items (from body if supplied, or from user's active cart)
    const cart = await Cart.findOne({ user: userId });
    const sourceItems =
      Array.isArray(req.body.items) && req.body.items.length > 0
        ? req.body.items
        : cart && cart.items
        ? cart.items
        : [];

    if (sourceItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your shopping bag is empty. Please add fragrances before placing an order.",
      });
    }

    const orderItems = [];
    let calculatedSubtotal = 0;

    // 2. Validate every item against live MongoDB product & variant records
    for (const item of sourceItems) {
      const prodId = item.productId || item.product;
      const product = await Product.findById(prodId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "One of the fragrances is no longer available.",
        });
      }

      if (product.status === "Inactive") {
        return res.status(400).json({
          success: false,
          message: `"${product.name}" is currently unavailable.`,
        });
      }

      // Locate variant
      let variant = null;
      if (product.variants && product.variants.length > 0) {
        if (item.variantId) {
          variant = product.variants.find(
            (v) => v._id.toString() === item.variantId.toString()
          );
        } else if (product.variants.length === 1) {
          variant = product.variants[0];
        }
      }

      if (!variant) {
        return res.status(400).json({
          success: false,
          message: `Please choose a valid size variant for "${product.name}".`,
        });
      }

      if (variant.isAvailable === false) {
        return res.status(400).json({
          success: false,
          message: `The ${variant.volumeMl} ml size of "${product.name}" is currently discontinued or unavailable.`,
        });
      }

      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty < 1 || qty > 5) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for "${product.name}" (${variant.volumeMl} ml). Max 5 units allowed.`,
        });
      }

      if (qty > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}" (${variant.volumeMl} ml). Available stock: ${variant.stock}.`,
        });
      }

      // Live MongoDB price calculation
      const unitPrice = Number(variant.sellingPrice);
      const originalPrice = variant.originalPrice ? Number(variant.originalPrice) : null;
      const lineTotal = unitPrice * qty;

      calculatedSubtotal += lineTotal;

      orderItems.push({
        product: product._id,
        variantId: variant._id,
        name: product.name,
        brand: product.brand || "FEXA",
        category: product.category,
        volumeMl: variant.volumeMl,
        quantity: qty,
        unitPrice,
        originalPrice,
        lineTotal,
        image: product.images && product.images.length > 0 ? product.images[0] : null,
      });
    }

    // 3. Atomically deduct stock from selected variants
    for (const it of orderItems) {
      const updateResult = await Product.updateOne(
        {
          _id: it.product,
          "variants._id": it.variantId,
          "variants.stock": { $gte: it.quantity },
        },
        {
          $inc: {
            "variants.$.stock": -it.quantity,
            stock: -it.quantity,
          },
        }
      );

      if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
        // Rollback already deducted items
        for (const rolled of deductedItems) {
          await Product.updateOne(
            { _id: rolled.product, "variants._id": rolled.variantId },
            {
              $inc: {
                "variants.$.stock": rolled.quantity,
                stock: rolled.quantity,
              },
            }
          );
        }

        return res.status(400).json({
          success: false,
          message: `Could not reserve stock for ${it.name} (${it.volumeMl} ml). Another customer may have just placed an order.`,
        });
      }

      deductedItems.push({
        product: it.product,
        variantId: it.variantId,
        quantity: it.quantity,
      });

      // Update product status to Out of Stock if total stock reached 0
      const updatedProd = await Product.findById(it.product);
      if (updatedProd && updatedProd.stock <= 0 && updatedProd.status === "Active") {
        updatedProd.status = "Out of Stock";
        await updatedProd.save();
      }
    }

    // 4. Calculate shipping cost
    const shippingCost = calculatedSubtotal >= 5000 ? 0 : 250;
    const totalAmount = calculatedSubtotal + shippingCost;

    // 5. Generate unique order number
    const orderNumber = `FEXA-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 6. Create immutable order snapshot
    const order = await Order.create({
      orderNumber,
      user: userId,
      items: orderItems,
      shippingAddress: shippingAddressSnapshot,
      subtotal: calculatedSubtotal,
      shippingCost,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Paid",
      orderStatus: "Processing",
    });

    // 7. Clear user's cart if exists
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      order,
    });
  } catch (error) {
    console.error("Create order error:", error);

    // Rollback any deducted inventory
    for (const rolled of deductedItems) {
      try {
        await Product.updateOne(
          { _id: rolled.product, "variants._id": rolled.variantId },
          {
            $inc: {
              "variants.$.stock": rolled.quantity,
              stock: rolled.quantity,
            },
          }
        );
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process order. Please try again.",
    });
  }
};

// ========================================================
// GET CURRENT USER ORDERS
// ========================================================
const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Get my orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve order history.",
    });
  }
};

// ========================================================
// GET SINGLE ORDER BY ID
// ========================================================
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      _id: id,
      user: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get order by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve order details.",
    });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
};
