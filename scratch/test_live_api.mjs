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

async function testLiveApi() {
  console.log('--- Testing Live FEXA Backend API on http://localhost:5000 ---');

  // Step 1: Login
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'ali@gmail.com',
      password: 'Password123@'
    })
  });

  const loginData = await loginRes.json();
  assert('Login succeeds with 200', loginRes.status === 200);
  assert('Token returned in response or cookie', Boolean(loginData.token));

  const token = loginData.token;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Step 2: Fetch Profile
  const profileRes = await fetch('http://localhost:5000/api/profile', {
    method: 'GET',
    headers
  });
  const profileData = await profileRes.json();
  assert('Fetch profile returns 200', profileRes.status === 200);
  assert('User profile email matches', profileData.user?.email === 'ali@gmail.com');

  // Step 3: Reject numbers-only name
  const badNameRes = await fetch('http://localhost:5000/api/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name: '123456' })
  });
  const badNameData = await badNameRes.json();
  assert('Direct API rejects numbers-only name with 400', badNameRes.status === 400);
  assert('Error message returned for name', Boolean(badNameData.errors?.name));

  // Step 4: Reject consecutive spaces in name
  const spacesNameRes = await fetch('http://localhost:5000/api/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name: 'Ali   Khan' })
  });
  const spacesNameData = await spacesNameRes.json();
  assert('Direct API rejects consecutive spaces in name with 400', spacesNameRes.status === 400);
  assert('Consecutive spaces error message', spacesNameData.errors?.name === 'Name cannot contain consecutive spaces.');

  // Step 5: Reject invalid phone (letters in phone)
  const badPhoneRes = await fetch('http://localhost:5000/api/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ phone: '98765abc' })
  });
  const badPhoneData = await badPhoneRes.json();
  assert('Direct API rejects letters in phone with 400', badPhoneRes.status === 400);
  assert('Error message returned for phone', Boolean(badPhoneData.errors?.phone));

  // Step 6: Reject invalid email format
  const badEmailRes = await fetch('http://localhost:5000/api/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ email: 'notanemail' })
  });
  const badEmailData = await badEmailRes.json();
  assert('Direct API rejects invalid email with 400', badEmailRes.status === 400);
  assert('Error message returned for email', Boolean(badEmailData.errors?.email));

  // Step 7: Reject duplicate email belonging to another account
  const dupEmailRes = await fetch('http://localhost:5000/api/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ email: 'ameen@gmail.com' })
  });
  const dupEmailData = await dupEmailRes.json();
  assert('Direct API rejects duplicate email with 400', dupEmailRes.status === 400);
  assert('Duplicate email error message', dupEmailData.errors?.email === 'This email address is already registered.');

  // Step 8: Update valid name and phone
  const updateRes = await fetch('http://localhost:5000/api/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: 'Ali Khan',
      phone: '9876543210',
      email: 'ali@gmail.com'
    })
  });
  const updateData = await updateRes.json();
  assert('Valid update returns 200', updateRes.status === 200);
  assert('Updated name is saved', updateData.user?.name === 'Ali Khan');
  assert('Updated phone is saved', updateData.user?.phone === '9876543210');

  // Step 9: Verify unauthenticated request is rejected
  const unauthRes = await fetch('http://localhost:5000/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Hacker' })
  });
  assert('Unauthenticated request is rejected with 401', unauthRes.status === 401);

  // Step 10: Attempt mass assignment attack
  const massAssignRes = await fetch('http://localhost:5000/api/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      name: 'Ali Khan',
      role: 'admin',
      wallet: 9999999,
      isBlocked: true,
      password: 'new_hashed_password'
    })
  });
  assert('Mass assignment attempt handled', massAssignRes.status === 200);
  const verifyRes = await fetch('http://localhost:5000/api/profile', {
    method: 'GET',
    headers
  });
  const verifyData = await verifyRes.json();
  assert('User role remained "user"', verifyData.user?.role === 'user');
  assert('User is not admin', verifyData.user?.role !== 'admin');

  console.log(`\n========================================`);
  console.log(`LIVE API TESTS SUMMARY: Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

testLiveApi().catch(err => {
  console.error('Fatal error in live API tests:', err);
  process.exit(1);
});
