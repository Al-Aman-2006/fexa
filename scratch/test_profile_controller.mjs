import { updateProfile } from '../backend/controllers/profile.controller.js';
import User from '../backend/models/user.model.js';

let passed = 0;
let failed = 0;

function assert(description, condition, extraInfo = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${description}`);
  } else {
    failed++;
    console.error(`  ✗ ${description} ${extraInfo}`);
  }
}

// Mock helper to create mock req and res
function createMockReqRes({ user = { id: 'mockUserId123' }, body = {} }) {
  const req = { user, body };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    getStatusCode() {
      return statusCode;
    },
    getResponseData() {
      return responseData;
    }
  };

  return { req, res };
}

async function runControllerTests() {
  console.log('--- Testing Backend updateProfile Controller Security & Validation ---');

  // Test 1: Reject invalid name
  {
    const originalFindById = User.findById;
    User.findById = async (id) => ({
      _id: id,
      name: 'Original Name',
      email: 'original@example.com',
      phone: '9876543210',
      save: async () => {}
    });

    const { req, res } = createMockReqRes({
      body: { name: '123456' } // Numbers only
    });

    await updateProfile(req, res);
    assert('Rejects numbers-only name with 400', res.getStatusCode() === 400);
    assert('Returns structured name error', res.getResponseData()?.errors?.name !== undefined);

    User.findById = originalFindById;
  }

  // Test 2: Reject consecutive spaces in name
  {
    const originalFindById = User.findById;
    User.findById = async (id) => ({
      _id: id,
      name: 'Original Name',
      email: 'original@example.com',
      phone: '9876543210',
      save: async () => {}
    });

    const { req, res } = createMockReqRes({
      body: { name: 'John   Doe' }
    });

    await updateProfile(req, res);
    assert('Rejects consecutive spaces in name with 400', res.getStatusCode() === 400);
    assert('Correct error message for consecutive spaces', res.getResponseData()?.errors?.name === 'Name cannot contain consecutive spaces.');

    User.findById = originalFindById;
  }

  // Test 3: Reject invalid phone (letters in phone)
  {
    const originalFindById = User.findById;
    User.findById = async (id) => ({
      _id: id,
      name: 'Original Name',
      email: 'original@example.com',
      phone: '9876543210',
      save: async () => {}
    });

    const { req, res } = createMockReqRes({
      body: { phone: '98765abcde' }
    });

    await updateProfile(req, res);
    assert('Rejects letters in phone with 400', res.getStatusCode() === 400);
    assert('Returns structured phone error', res.getResponseData()?.errors?.phone !== undefined);

    User.findById = originalFindById;
  }

  // Test 4: Reject invalid email format
  {
    const originalFindById = User.findById;
    User.findById = async (id) => ({
      _id: id,
      name: 'Original Name',
      email: 'original@example.com',
      phone: '9876543210',
      save: async () => {}
    });

    const { req, res } = createMockReqRes({
      body: { email: 'invalid-email-address' }
    });

    await updateProfile(req, res);
    assert('Rejects malformed email with 400', res.getStatusCode() === 400);
    assert('Returns structured email error', res.getResponseData()?.errors?.email !== undefined);

    User.findById = originalFindById;
  }

  // Test 5: Prevent email change for Google users
  {
    const originalFindById = User.findById;
    User.findById = async (id) => ({
      _id: id,
      name: 'Google User',
      email: 'google@gmail.com',
      authProvider: 'google',
      phone: '',
      save: async () => {}
    });

    const { req, res } = createMockReqRes({
      body: { email: 'newemail@gmail.com' }
    });

    await updateProfile(req, res);
    assert('Rejects email change for Google authenticated account with 400', res.getStatusCode() === 400);
    assert('Explains Google auth constraint', res.getResponseData()?.message?.includes('Google'));

    User.findById = originalFindById;
  }

  // Test 6: Detect duplicate email belonging to another user
  {
    const originalFindById = User.findById;
    const originalFindOne = User.findOne;

    User.findById = async (id) => ({
      _id: id,
      name: 'Local User',
      email: 'local@example.com',
      phone: '9876543210',
      save: async () => {}
    });

    User.findOne = async (query) => {
      // Simulate finding another user with this email
      if (query.email === 'taken@example.com') {
        return { _id: 'otherUserId456', email: 'taken@example.com' };
      }
      return null;
    };

    const { req, res } = createMockReqRes({
      body: { email: 'taken@example.com' }
    });

    await updateProfile(req, res);
    assert('Rejects duplicate email with 400', res.getStatusCode() === 400);
    assert('Returns duplicate email message', res.getResponseData()?.message === 'This email address is already registered.');

    User.findById = originalFindById;
    User.findOne = originalFindOne;
  }

  // Test 7: Mass Assignment Protection
  // Attempt to pass role="admin", isBlocked=false, wallet=1000000, password="hacked"
  {
    const originalFindById = User.findById;
    const userDoc = {
      _id: 'mockUserId123',
      name: 'Regular User',
      email: 'regular@example.com',
      phone: '9876543210',
      role: 'user',
      wallet: 50,
      isBlocked: false,
      save: async function() { return this; }
    };

    User.findById = async (id) => userDoc;

    const { req, res } = createMockReqRes({
      body: {
        name: 'Updated Name',
        role: 'admin',
        wallet: 9999999,
        isAdmin: true,
        isBlocked: true,
        password: 'hacked_password_hash'
      }
    });

    await updateProfile(req, res);
    assert('Allows legitimate name update', res.getStatusCode() === 200);
    assert('Protected field "role" was not modified', userDoc.role === 'user');
    assert('Protected field "wallet" was not modified', userDoc.wallet === 50);
    assert('Protected field "isAdmin" was not attached', userDoc.isAdmin === undefined);
    assert('Protected field "password" was not modified', userDoc.password === undefined);

    User.findById = originalFindById;
  }

  // Test 8: Allows user to retain own email without triggering OTP or duplicate error
  {
    const originalFindById = User.findById;
    let otpTriggered = false;

    User.findById = async (id) => ({
      _id: id,
      name: 'My Name',
      email: 'myemail@example.com',
      phone: '9876543210',
      save: async () => {}
    });

    const { req, res } = createMockReqRes({
      body: {
        name: 'New Valid Name',
        email: 'myemail@example.com', // retaining same email
        phone: '9876543210'
      }
    });

    await updateProfile(req, res);
    assert('Returns 200 when user keeps their own email', res.getStatusCode() === 200);
    assert('Email change is not pending', res.getResponseData()?.emailChangePending === false);

    User.findById = originalFindById;
  }

  // Test 9: Handle MongoDB 11000 duplicate key exception gracefully
  {
    const originalFindById = User.findById;
    User.findById = async (id) => ({
      _id: id,
      name: 'Current User',
      email: 'user@example.com',
      phone: '9876543210',
      save: async () => {
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      }
    });

    const { req, res } = createMockReqRes({
      body: { name: 'Valid Name' }
    });

    await updateProfile(req, res);
    assert('Catches 11000 duplicate key error and responds with 400', res.getStatusCode() === 400);
    assert('Sanitized user-facing message', res.getResponseData()?.message === 'This email address is already registered.');

    User.findById = originalFindById;
  }

  console.log(`\n========================================`);
  console.log(`CONTROLLER TESTS SUMMARY: Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runControllerTests().catch(err => {
  console.error('Fatal error during controller tests:', err);
  process.exit(1);
});
