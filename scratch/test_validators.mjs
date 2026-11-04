import { validateName, normalizeName, validateEmail, normalizeEmail, validateProfilePhone } from '../backend/validators/user.validator.js';
import { 
  validateName as feValidateName, 
  normalizeName as feNormalizeName, 
  validateEmail as feValidateEmail, 
  normalizeEmail as feNormalizeEmail, 
  validateProfilePhone as feValidatePhone 
} from '../frontend/src/utils/validation.js';

let passed = 0;
let failed = 0;

function assert(description, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log(`  ✓ ${description}`);
  } else {
    failed++;
    console.error(`  ✗ ${description} -> Expected: "${expected}", Actual: "${actual}"`);
  }
}

console.log('--- Testing Full Name Validation (Backend & Frontend) ---');
const validNames = ["Aman Aziz", "John Peter", "Anne-Marie", "O'Connor", "José Manuel"];
for (const n of validNames) {
  assert(`Backend valid: "${n}"`, validateName(n), null);
  assert(`Frontend valid: "${n}"`, feValidateName(n), null);
}

const invalidNameCases = [
  { val: "", err: "Name is required." },
  { val: "   ", err: "Name is required." },
  { val: "123456", err: "Please enter a valid name using letters." },
  { val: "!!!!!!", err: "Please enter a valid name using letters." },
  { val: "@@@@@", err: "Please enter a valid name using letters." },
  { val: "John   Doe", err: "Name cannot contain consecutive spaces." },
  { val: "A", err: "Name must be at least 2 characters." },
  { val: "A".repeat(101), err: "Name cannot exceed 100 characters." },
];

for (const c of invalidNameCases) {
  assert(`Backend reject "${c.val.slice(0, 15)}..."`, validateName(c.val), c.err);
  assert(`Frontend reject "${c.val.slice(0, 15)}..."`, feValidateName(c.val), c.err);
}

console.log('\n--- Testing Email Validation (Backend & Frontend) ---');
const validEmails = ["user@example.com", "aman.aziz@fexa.co.in", "john+tag@gmail.com", "test.user@domain.org"];
for (const e of validEmails) {
  assert(`Backend valid email: "${e}"`, validateEmail(e), null);
  assert(`Frontend valid email: "${e}"`, feValidateEmail(e), null);
}

const invalidEmailCases = [
  { val: "", err: "Email address is required." },
  { val: "   ", err: "Email address is required." },
  { val: "user @domain.com", err: "Email address cannot contain spaces." },
  { val: "user@ domain.com", err: "Email address cannot contain spaces." },
  { val: "notanemail", err: "Please enter a valid email address." },
  { val: "user@", err: "Please enter a valid email address." },
  { val: "@domain.com", err: "Please enter a valid email address." },
  { val: "user@domain", err: "Please enter a valid email address." },
  { val: "user@.com", err: "Please enter a valid email address." },
];

for (const c of invalidEmailCases) {
  assert(`Backend reject email "${c.val}"`, validateEmail(c.val), c.err);
  assert(`Frontend reject email "${c.val}"`, feValidateEmail(c.val), c.err);
}

console.log('\n--- Testing Phone Validation (Backend & Frontend) ---');
const validPhones = ["", "   ", "9876543210", "+91 9876543210", "+919876543210", "+14155552671", "+447911123456"];
for (const p of validPhones) {
  assert(`Backend valid phone: "${p}"`, validateProfilePhone(p), null);
  assert(`Frontend valid phone: "${p}"`, feValidatePhone(p), null);
}

const invalidPhoneCases = [
  { val: "98765abcde", err: "Phone number cannot contain letters." },
  { val: "+++++----", err: "Please enter a valid phone number." },
  { val: "1234567890", err: "10-digit mobile numbers must start with 6, 7, 8, or 9." },
  { val: "0987654321", err: "10-digit mobile numbers must start with 6, 7, 8, or 9." },
  { val: "9999999999", err: "Please enter a valid phone number (repeated digits not allowed)." },
  { val: "8888888888", err: "Please enter a valid phone number (repeated digits not allowed)." },
  { val: "12345", err: "Phone number must have at least 7 digits." },
  { val: "12345678901234567", err: "Phone number cannot exceed 15 digits." },
];

for (const c of invalidPhoneCases) {
  assert(`Backend reject phone "${c.val}"`, validateProfilePhone(c.val), c.err);
  assert(`Frontend reject phone "${c.val}"`, feValidatePhone(c.val), c.err);
}

console.log(`\n========================================`);
console.log(`SUMMARY: Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) process.exit(1);
