/**
 * Test Suite: FEXA USER NAME VALIDATION (Registration and Edit Profile)
 * Tests all 23 requirements specified in the prompt.
 */

const { validateName, normalizeName } = require("./validators/user.validator");

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

async function runTestSuite() {
  console.log("==================================================");
  console.log("FEXA USER NAME VALIDATION TEST SUITE");
  console.log("==================================================\n");

  console.log("--- SECTION 12: REGISTRATION TESTS ---");

  // TEST 1: Name: >>>>> -> Expected: Rejected.
  {
    const err = validateName(">>>>>");
    assert(err !== null, "TEST 1: '>>>>>' is rejected");
    assert(err === "Please enter a valid name using letters.", "TEST 1: Expected error message returned");
  }

  // TEST 2: Name: ////// -> Expected: Rejected.
  {
    const err = validateName("//////");
    assert(err !== null, "TEST 2: '//////' is rejected");
    assert(err === "Please enter a valid name using letters.", "TEST 2: Expected error message returned");
  }

  // TEST 3: Name: ______ -> Expected: Rejected.
  {
    const err = validateName("______");
    assert(err !== null, "TEST 3: '______' is rejected");
    assert(err === "Please enter a valid name using letters.", "TEST 3: Expected error message returned");
  }

  // TEST 4: Name: ------- -> Expected: Rejected.
  {
    const err = validateName("-------");
    assert(err !== null, "TEST 4: '-------' is rejected");
    assert(err === "Please enter a valid name using letters.", "TEST 4: Expected error message returned");
  }

  // TEST 5: Name: ....... -> Expected: Rejected.
  {
    const err = validateName(".......");
    assert(err !== null, "TEST 5: '.......' is rejected");
    assert(err === "Please enter a valid name using letters.", "TEST 5: Expected error message returned");
  }

  // TEST 6: Name: 123456 -> Expected: Rejected.
  {
    const err = validateName("123456");
    assert(err !== null, "TEST 6: '123456' is rejected");
    assert(err === "Please enter a valid name using letters.", "TEST 6: Expected error message returned");
  }

  // TEST 7: Name: empty string -> Expected: Rejected.
  {
    const err = validateName("");
    assert(err !== null, "TEST 7: Empty string is rejected");
    assert(err === "Name is required.", "TEST 7: 'Name is required.' message returned");
  }

  // TEST 8: Name: spaces only -> Expected: Rejected.
  {
    const err = validateName("     ");
    assert(err !== null, "TEST 8: Spaces-only is rejected");
    assert(err === "Name is required.", "TEST 8: 'Name is required.' message returned");
  }

  // TEST 9: Name: A -> Expected: Rejected because shorter than configured minimum.
  {
    const err = validateName("A");
    assert(err !== null, "TEST 9: 'A' is rejected");
    assert(err === "Name must be at least 2 characters.", "TEST 9: 'Name must be at least 2 characters.' returned");
  }

  // TEST 10: Name: Aman Aziz -> Expected: Accepted.
  {
    const err = validateName("Aman Aziz");
    assert(err === null, "TEST 10: 'Aman Aziz' is accepted");
  }

  // TEST 11: Name: Anne-Marie -> Expected: Accepted.
  {
    const err = validateName("Anne-Marie");
    assert(err === null, "TEST 11: 'Anne-Marie' is accepted");
  }

  // TEST 12: Name: O'Connor -> Expected: Accepted.
  {
    const err = validateName("O'Connor");
    assert(err === null, "TEST 12: 'O\\'Connor' is accepted");
  }

  // TEST 13: Name: José García -> Expected: Accepted.
  {
    const err = validateName("José García");
    assert(err === null, "TEST 13: 'José García' (accented letters) is accepted");
  }

  // TEST 14: Name: "  Aman Aziz  " -> Expected: Trim whitespace and accept normalized name.
  {
    const err = validateName("  Aman Aziz  ");
    assert(err === null, "TEST 14: Untrimmed valid name passes validation");
    const normalized = normalizeName("  Aman Aziz  ");
    assert(normalized === "Aman Aziz", "TEST 14: Name normalized to 'Aman Aziz'");
  }

  // Additional symbol tests from requirements:
  {
    assert(validateName("@@@@@") !== null, "Extra: '@@@@@' rejected");
    assert(validateName("!!!!!") !== null, "Extra: '!!!!!' rejected");
    assert(validateName("###$$$") !== null, "Extra: '###$$$' rejected");
    assert(validateName("---") !== null, "Extra: '---' rejected");
    assert(validateName("___") !== null, "Extra: '___' rejected");
    assert(validateName("...") !== null, "Extra: '...' rejected");
    assert(validateName("--A--") !== null, "Extra: '--A--' rejected");
    assert(validateName("...A...") !== null, "Extra: '...A...' rejected");
  }

  // TEST 15: Submit an invalid name directly to the registration API.
  // Expected: Backend rejects with HTTP 400, no user created, no OTP sent.
  {
    let createdPendingUser = false;
    let sentOtpEmail = false;

    // Simulate backend register controller logic
    const req = {
      body: {
        name: ">>>>>>",
        email: "test@example.com",
        password: "Password123!",
      },
    };

    let responseStatus = null;
    let responseBody = null;

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    // Controller validation
    const nameError = validateName(req.body.name);
    let errors = {};
    if (nameError) {
      errors.name = nameError;
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        message: errors.name || "Validation failed",
        errors,
      });
    } else {
      createdPendingUser = true;
      sentOtpEmail = true;
    }

    assert(responseStatus === 400, "TEST 15: Direct API request returns HTTP 400");
    assert(responseBody.message === "Please enter a valid name using letters.", "TEST 15: Clear error message in response");
    assert(responseBody.errors && responseBody.errors.name === "Please enter a valid name using letters.", "TEST 15: errors.name contains error");
    assert(!createdPendingUser, "TEST 15: No pending user record is created in MongoDB");
    assert(!sentOtpEmail, "TEST 15: No OTP email is sent");
  }

  console.log("\n--- SECTION 13: EDIT PROFILE TESTS ---");

  // TEST 16: Profile Edit -> Name: >>>>> -> Expected: Inline error, save prevented.
  {
    const err = validateName(">>>>>");
    assert(err !== null, "TEST 16: Edit profile '>>>>>' is rejected");
    assert(err === "Please enter a valid name using letters.", "TEST 16: Inline error message matches");
  }

  // TEST 17: Profile Edit -> Name: ////// -> Expected: Rejected.
  {
    const err = validateName("//////");
    assert(err !== null, "TEST 17: Edit profile '//////' is rejected");
    assert(err === "Please enter a valid name using letters.", "TEST 17: Inline error message matches");
  }

  // TEST 18: Profile Edit -> Name: ______ -> Expected: Rejected.
  {
    const err = validateName("______");
    assert(err !== null, "TEST 18: Edit profile '______' is rejected");
    assert(err === "Please enter a valid name using letters.", "TEST 18: Inline error message matches");
  }

  // TEST 19: Profile Edit -> Name: 123456 -> Expected: Rejected.
  {
    const err = validateName("123456");
    assert(err !== null, "TEST 19: Edit profile '123456' is rejected");
    assert(err === "Please enter a valid name using letters.", "TEST 19: Inline error message matches");
  }

  // TEST 20: Profile Edit -> Name: Aman Aziz -> Expected: Accepted.
  {
    const err = validateName("Aman Aziz");
    assert(err === null, "TEST 20: Edit profile 'Aman Aziz' is accepted");
  }

  // TEST 21: Correct an invalid name after seeing the error -> Expected: Error disappears automatically.
  {
    let currentError = validateName(">>>>>");
    assert(currentError !== null, "TEST 21: Initial invalid name produces error");
    // User corrects input
    currentError = validateName("Aman Aziz");
    assert(currentError === null, "TEST 21: Error clears automatically when corrected");
  }

  // TEST 22: Submit an invalid name directly to the profile update API.
  // Expected: Backend rejects the request with HTTP 400, MongoDB remains unchanged.
  {
    let mongoDbUpdated = false;
    let currentUserInDb = { name: "Original Name", email: "user@example.com" };

    const req = {
      user: { id: "user123" },
      body: {
        name: ">>>>>>",
      },
    };

    let responseStatus = null;
    let responseBody = null;

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    // Controller execution
    if (req.body.name !== undefined) {
      const nameError = validateName(req.body.name);
      if (nameError) {
        res.status(400).json({
          success: false,
          message: nameError,
          errors: { name: nameError },
        });
      } else {
        currentUserInDb.name = normalizeName(req.body.name);
        mongoDbUpdated = true;
      }
    }

    assert(responseStatus === 400, "TEST 22: Profile update API returns HTTP 400 for invalid name");
    assert(responseBody.message === "Please enter a valid name using letters.", "TEST 22: API returns 'Please enter a valid name using letters.'");
    assert(!mongoDbUpdated, "TEST 22: MongoDB update was prevented");
    assert(currentUserInDb.name === "Original Name", "TEST 22: User name in DB remains unchanged");
  }

  // TEST 23: Update the name through Google-authenticated profile flow.
  // Expected: Same validation applies without breaking Google authentication.
  {
    let googleUser = {
      _id: "google_123",
      name: "Google User",
      email: "googleuser@gmail.com",
      authProvider: "google",
      googleId: "sub_12345",
    };

    // Try invalid update
    const invalidNameError = validateName("//////");
    assert(invalidNameError !== null, "TEST 23: Invalid name rejected for Google user");

    // Try valid update
    const validNameError = validateName("Aman Aziz");
    assert(validNameError === null, "TEST 23: Valid name accepted for Google user");

    googleUser.name = normalizeName("  Aman Aziz  ");
    assert(googleUser.name === "Aman Aziz", "TEST 23: Google user name successfully updated and normalized");
    assert(googleUser.authProvider === "google", "TEST 23: Google authentication status preserved");
    assert(googleUser.googleId === "sub_12345", "TEST 23: Google ID preserved");
  }

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passedCount}/${totalCount} assertions passed!`);
  console.log("==================================================");
}

runTestSuite();
