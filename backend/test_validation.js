/**
 * Validation Test Suite for FEXA
 * Verifies all 23 test requirements from the specification.
 */

const {
  validateAddress,
  validateFullName,
  validatePhone,
  validatePincode,
} = require("./validators/address.validator");

const {
  validateProduct,
  validateProductName,
  validatePrice,
  validateCompareAtPrice,
  validateStock,
  validateCategory,
} = require("./validators/product.validator");

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    passedCount++;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING FEXA FORM VALIDATION TEST SUITE");
  console.log("==================================================\n");

  // ==========================================
  // ADDRESS VALIDATION TESTS
  // ==========================================
  console.log("--- Address Validation Tests ---");

  // TEST 1: Submit an empty address form
  {
    const result = validateAddress({});
    assert(!result.isValid, "TEST 1: Empty address form fails validation");
    assert(result.errors.fullName !== undefined, "TEST 1: fullName error present");
    assert(result.errors.phone !== undefined, "TEST 1: phone error present");
    assert(result.errors.street !== undefined, "TEST 1: street error present");
    assert(result.errors.city !== undefined, "TEST 1: city error present");
    assert(result.errors.state !== undefined, "TEST 1: state error present");
    assert(result.errors.pincode !== undefined, "TEST 1: pincode error present");
  }

  // TEST 2: Enter spaces into required fields
  {
    const result = validateAddress({
      fullName: "    ",
      phone: "          ",
      house: "  ",
      street: "     ",
      city: "   ",
      state: "  ",
      pincode: "      ",
    });
    assert(!result.isValid, "TEST 2: Spaces-only fields fail validation");
    assert(result.errors.fullName === "Full name is required.", "TEST 2: Name error for spaces");
    assert(result.errors.phone === "Phone number is required.", "TEST 2: Phone error for spaces");
  }

  // TEST 3: Enter an invalid phone number
  {
    assert(validatePhone("12345") !== null, "TEST 3: '12345' is rejected");
    assert(validatePhone("98765abc10") !== null, "TEST 3: '98765abc10' is rejected");
    assert(validatePhone("0000000000") !== null, "TEST 3: '0000000000' is rejected");
    assert(validatePhone("5876543210") !== null, "TEST 3: Starting with 5 is rejected");
    assert(validatePhone("9876543210") === null, "TEST 3: Standard 10-digit Indian number is valid");
    assert(validatePhone("+919876543210") === null, "TEST 3: +91 prefix is valid");
  }

  // TEST 4: Enter an invalid Indian PIN code
  {
    assert(validatePincode("123") !== null, "TEST 4: '123' is rejected");
    assert(validatePincode("1234567") !== null, "TEST 4: '1234567' is rejected");
    assert(validatePincode("012345") !== null, "TEST 4: PIN starting with 0 is rejected");
    assert(validatePincode("ABC123") !== null, "TEST 4: Alphabetic PIN is rejected");
    assert(validatePincode("673001") === null, "TEST 4: '673001' is valid");
    assert(validatePincode("682001") === null, "TEST 4: '682001' is valid");
  }

  // TEST 5: Correct an invalid field
  {
    let nameErr = validateFullName("A");
    assert(nameErr !== null, "TEST 5: Single letter name is invalid");
    nameErr = validateFullName("Aman Aziz");
    assert(nameErr === null, "TEST 5: Corrected name 'Aman Aziz' clears error");
  }

  // TEST 6: Submit a valid address
  {
    const validData = {
      label: "Home",
      fullName: "Aman Aziz",
      phone: "+91 98765 43210",
      house: "Villa 14",
      street: "Palm Avenue Road",
      city: "Kozhikode",
      state: "Kerala",
      pincode: "673001",
      country: "India",
      isDefault: true,
    };
    const result = validateAddress(validData);
    assert(result.isValid, "TEST 6: Valid address passes validation");
    assert(result.normalizedData.phone === "9876543210", "TEST 6: Phone normalized to 10 digits");
    assert(result.normalizedData.pincode === "673001", "TEST 6: Pincode normalized");
  }

  // TEST 7: Edit an existing address
  {
    const editData = {
      label: "Work",
      fullName: "Mary Ann",
      phone: "9876543210",
      house: "Office 4B",
      street: "Cyber Park, MG Road",
      city: "Kochi",
      state: "Kerala",
      pincode: "682001",
      country: "India",
      isDefault: false,
    };
    const result = validateAddress(editData);
    assert(result.isValid, "TEST 7: Valid edited address passes validation");
    assert(result.normalizedData.label === "Work", "TEST 7: Address type updated");
  }

  // TEST 8: Send invalid address data directly to the backend
  {
    const invalidBackendData = {
      fullName: "12345",
      phone: "abc",
      house: "!!",
      street: "...",
      city: "999",
      state: "888",
      pincode: "000000",
    };
    const result = validateAddress(invalidBackendData);
    assert(!result.isValid, "TEST 8: Backend validator rejects invalid payload");
    assert(result.errors.fullName !== undefined, "TEST 8: fullName rejected");
    assert(result.errors.phone !== undefined, "TEST 8: phone rejected");
    assert(result.errors.house !== undefined, "TEST 8: house rejected");
    assert(result.errors.street !== undefined, "TEST 8: street rejected");
    assert(result.errors.city !== undefined, "TEST 8: city rejected");
    assert(result.errors.state !== undefined, "TEST 8: state rejected");
    assert(result.errors.pincode !== undefined, "TEST 8: pincode rejected");
  }

  // TEST 9: Cross-user address modification prevention logic
  {
    const { updateAddress } = require("./controllers/profile.controller");
    // Verify that updateAddress checks user.addresses.id(addressId) on the authenticated user
    const mockUser = {
      addresses: {
        id: (targetId) => (targetId === "my-addr-id" ? { _id: "my-addr-id" } : null),
      },
      save: async () => {},
    };

    let statusCode = null;
    let jsonResponse = null;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
          },
        };
      },
    };

    // User A trying to edit User B's address
    const User = require("./models/user.model");
    const origFindById = User.findById;
    User.findById = async () => mockUser;

    try {
      await updateAddress(
        { user: { id: "user-a" }, params: { addressId: "other-user-addr" }, body: {} },
        mockRes
      );
      assert(statusCode === 404, "TEST 9: Modifying another user's address returns HTTP 404");
      assert(jsonResponse.success === false, "TEST 9: Modifying another user's address fails");
    } finally {
      User.findById = origFindById;
    }
  }

  // ==========================================
  // PRODUCT VALIDATION TESTS
  // ==========================================
  console.log("\n--- Admin Product Validation Tests ---");

  // TEST 10: Create a product with all fields empty
  {
    const result = validateProduct({}, { isEdit: false, newFilesCount: 0 });
    assert(!result.isValid, "TEST 10: Empty product creation fails validation");
    assert(result.errors.name !== undefined, "TEST 10: Name error present");
    assert(result.errors.price !== undefined, "TEST 10: Price error present");
    assert(result.errors.stock !== undefined, "TEST 10: Stock error present");
    assert(result.errors.category !== undefined, "TEST 10: Category error present");
    assert(result.errors.description !== undefined, "TEST 10: Description error present");
    assert(result.errors.images !== undefined, "TEST 10: Image required error present");
  }

  // TEST 11: Enter a negative price
  {
    assert(validatePrice("-100") !== null, "TEST 11: Negative price -100 rejected");
    assert(validatePrice("0") !== null, "TEST 11: Zero price rejected");
    assert(validatePrice("999") === null, "TEST 11: Positive price 999 accepted");
  }

  // TEST 12: Enter alphabetic text into price field
  {
    assert(validatePrice("abc") !== null, "TEST 12: Price 'abc' rejected");
    assert(validatePrice("12abc") !== null, "TEST 12: Price '12abc' rejected");
    assert(validatePrice("NaN") !== null, "TEST 12: Price 'NaN' rejected");
  }

  // TEST 13: Enter a negative stock quantity
  {
    assert(validateStock("-5") !== null, "TEST 13: Stock '-5' rejected");
    assert(validateStock("0") === null, "TEST 13: Stock '0' accepted (out of stock permitted)");
    assert(validateStock("25") === null, "TEST 13: Stock '25' accepted");
  }

  // TEST 14: Enter a decimal stock quantity
  {
    assert(validateStock("1.5") !== null, "TEST 14: Decimal stock '1.5' rejected");
    assert(validateStock("10.0") !== null, "TEST 14: Decimal stock '10.0' rejected");
    assert(validateStock("10") === null, "TEST 14: Integer stock '10' accepted");
  }

  // TEST 15: Select an invalid category through manipulated request
  {
    assert(validateCategory("InvalidCategory") !== null, "TEST 15: Arbitrary category rejected");
    assert(validateCategory("Shoes") !== null, "TEST 15: 'Shoes' rejected");
    assert(validateCategory("Men") === null, "TEST 15: 'Men' accepted");
    assert(validateCategory("Women") === null, "TEST 15: 'Women' accepted");
    assert(validateCategory("Unisex") === null, "TEST 15: 'Unisex' accepted");
  }

  // TEST 16: Enter Original Price lower than selling Price
  {
    assert(
      validateCompareAtPrice("1500", "2000") !== null,
      "TEST 16: Original price 1500 < selling price 2000 rejected"
    );
    assert(
      validateCompareAtPrice("2500", "2000") === null,
      "TEST 16: Original price 2500 >= selling price 2000 accepted"
    );
    assert(
      validateCompareAtPrice("2000", "2000") === null,
      "TEST 16: Original price 2000 == selling price 2000 accepted"
    );
  }

  // TEST 17: Upload an unsupported image type
  {
    const files = [{ mimetype: "image/gif", size: 1024 * 1024 }];
    const result = validateProduct(
      {
        name: "Test Perfume",
        brand: "FEXA",
        category: "Men",
        price: "1500",
        stock: "10",
        description: "A wonderful fragrance with oud notes.",
      },
      { isEdit: false, newFilesCount: 1, files }
    );
    assert(!result.isValid, "TEST 17: Unsupported GIF image rejected");
    assert(result.errors.images.includes("JPG, JPEG, PNG, and WEBP"), "TEST 17: Proper error message returned");
  }

  // TEST 18: Upload an image exceeding 5MB limit
  {
    const files = [{ mimetype: "image/jpeg", size: 6 * 1024 * 1024 }];
    const result = validateProduct(
      {
        name: "Test Perfume",
        brand: "FEXA",
        category: "Men",
        price: "1500",
        stock: "10",
        description: "A wonderful fragrance with oud notes.",
      },
      { isEdit: false, newFilesCount: 1, files }
    );
    assert(!result.isValid, "TEST 18: File > 5MB rejected");
    assert(result.errors.images.includes("5MB"), "TEST 18: 5MB error message returned");
  }

  // TEST 19: Edit product without changing its existing images
  {
    const editPayload = {
      name: "Fexa Noir Updated",
      brand: "FEXA",
      category: "Unisex",
      price: "2499.00",
      compareAtPrice: "2999.00",
      stock: "15",
      description: "Updated notes of spicy cardamom and smoky vetiver.",
      status: "Active",
    };
    const result = validateProduct(editPayload, {
      isEdit: true,
      existingImagesCount: 2, // 2 preserved images
      newFilesCount: 0,       // No new images uploaded
    });
    assert(result.isValid, "TEST 19: Edit product without uploading new images succeeds");
    assert(!result.errors.images, "TEST 19: No image re-upload error");
  }

  // TEST 20: Submit an invalid edit
  {
    const invalidEditPayload = {
      name: "",
      price: "-500",
      stock: "abc",
      category: "FakeCategory",
    };
    const result = validateProduct(invalidEditPayload, {
      isEdit: true,
      existingImagesCount: 1,
      newFilesCount: 0,
    });
    assert(!result.isValid, "TEST 20: Invalid edit fails validation");
    assert(result.errors.name !== undefined, "TEST 20: Name error on edit");
    assert(result.errors.price !== undefined, "TEST 20: Price error on edit");
    assert(result.errors.stock !== undefined, "TEST 20: Stock error on edit");
    assert(result.errors.category !== undefined, "TEST 20: Category error on edit");
  }

  // TEST 21: Correct the invalid values
  {
    const correctedPayload = {
      name: "Imperial Oud Eau de Parfum",
      brand: "FEXA",
      category: "Men",
      price: "3500",
      compareAtPrice: "4200",
      stock: "20",
      description: "Rich Cambodian agarwood paired with Bulgarian rose and vanilla.",
      status: "Active",
    };
    const result = validateProduct(correctedPayload, {
      isEdit: true,
      existingImagesCount: 1,
      newFilesCount: 0,
    });
    assert(result.isValid, "TEST 21: Corrected product passes validation");
  }

  // TEST 22: Max images constraint
  {
    const result = validateProduct(
      {
        name: "Too Many Images",
        brand: "FEXA",
        category: "Men",
        price: "1000",
        stock: "5",
        description: "Valid product description text.",
      },
      { isEdit: false, existingImagesCount: 0, newFilesCount: 6 }
    );
    assert(!result.isValid, "TEST 22: More than 5 images rejected");
    assert(result.errors.images.includes("Maximum 5"), "TEST 22: Max 5 images error message returned");
  }

  // TEST 23: Script and HTML injection rejection
  {
    assert(
      validateProductName("<script>alert(1)</script>") !== null,
      "TEST 23: Script injection in name rejected"
    );
    assert(
      validateProductName("!!!@@@###") !== null,
      "TEST 23: Only punctuation in name rejected"
    );
  }

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passedCount}/${totalCount} assertions passed!`);
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
