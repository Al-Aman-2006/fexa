import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { MongoClient, BSON } from 'mongodb';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(__dirname, '../.env') });

const SOURCE_DB_NAME = 'fexa-project';
const TARGET_DB_NAME = 'fexa-backup-test';
const BACKUP_DIR = path.join(rootDir, 'backup/atlas_fexa-project_20261117080756/fexa-project');

async function runRestoreVerification() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is missing from backend/.env');
  }

  console.log('===============================================================');
  console.log('      FEXA BACKUP RESTORE VERIFICATION PROTOCOL                ');
  console.log('===============================================================\n');

  // Verify backup folder exists
  if (!fs.existsSync(BACKUP_DIR)) {
    throw new Error(`Backup directory not found at: ${BACKUP_DIR}`);
  }
  console.log(`✓ Backup source verified at: ${BACKUP_DIR}`);

  const client = new MongoClient(mongoUri);
  await client.connect();
  console.log('✓ Connected to MongoDB Atlas cluster');

  const sourceDb = client.db(SOURCE_DB_NAME);
  const targetDb = client.db(TARGET_DB_NAME);

  // STRICT SAFETY GUARD
  if (targetDb.databaseName === SOURCE_DB_NAME || targetDb.databaseName !== 'fexa-backup-test') {
    throw new Error(`CRITICAL ABORT: Attempting to target '${targetDb.databaseName}'. Target MUST be 'fexa-backup-test'!`);
  }
  console.log(`✓ Safety check passed: Source is '${sourceDb.databaseName}', Target is '${targetDb.databaseName}'`);

  // Drop existing collections in target test DB to ensure a clean restore
  const existingTargetColls = await targetDb.listCollections().toArray();
  for (const c of existingTargetColls) {
    await targetDb.collection(c.name).drop();
  }
  console.log(`✓ Prepared clean temporary database: '${TARGET_DB_NAME}'`);

  // Get backup files
  const backupFiles = fs.readdirSync(BACKUP_DIR);
  const bsonFiles = backupFiles.filter(f => f.endsWith('.bson'));
  console.log(`✓ Found ${bsonFiles.length} BSON files to restore\n`);

  const restoreReport = [];

  for (const bFile of bsonFiles) {
    const collName = bFile.replace('.bson', '');
    const bsonPath = path.join(BACKUP_DIR, bFile);
    const metaPath = path.join(BACKUP_DIR, `${collName}.metadata.json`);

    const bsonBuffer = fs.readFileSync(bsonPath);
    let meta = null;
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }

    // 1. Deserialize BSON documents
    const docs = [];
    if (bsonBuffer.length > 0) {
      let offset = 0;
      while (offset < bsonBuffer.length) {
        const docSize = bsonBuffer.readInt32LE(offset);
        const docBuf = bsonBuffer.subarray(offset, offset + docSize);
        const doc = BSON.deserialize(docBuf);
        docs.push(doc);
        offset += docSize;
      }
    }

    // 2. Insert into target collection
    const targetColl = targetDb.collection(collName);
    if (docs.length > 0) {
      await targetColl.insertMany(docs, { ordered: true });
    }

    // 3. Restore Indexes from metadata
    let restoredIndexCount = 0;
    if (meta && meta.indexes && Array.isArray(meta.indexes)) {
      for (const idx of meta.indexes) {
        // Skip default _id_ index as it is created automatically
        if (idx.name === '_id_') continue;

        try {
          const indexOptions = { name: idx.name };
          if (idx.unique) indexOptions.unique = true;
          if (idx.sparse) indexOptions.sparse = true;
          if (idx.expireAfterSeconds !== undefined) indexOptions.expireAfterSeconds = idx.expireAfterSeconds;
          if (idx.default_language) indexOptions.default_language = idx.default_language;
          if (idx.weights) indexOptions.weights = idx.weights;

          await targetColl.createIndex(idx.key, indexOptions);
          restoredIndexCount++;
        } catch (idxErr) {
          console.warn(`  ⚠️ Warning on index ${idx.name} for ${collName}: ${idxErr.message}`);
        }
      }
    }

    // 4. Verify counts against live source database
    const sourceCount = await sourceDb.collection(collName).countDocuments();
    const restoredCount = await targetColl.countDocuments();
    const sourceIndexes = await sourceDb.collection(collName).indexes();
    const restoredIndexes = await targetColl.indexes();

    const countMatch = sourceCount === restoredCount;
    const indexMatch = sourceIndexes.length === restoredIndexes.length;

    restoreReport.push({
      collection: collName,
      sourceCount,
      restoredCount,
      countMatch,
      sourceIndexesCount: sourceIndexes.length,
      restoredIndexesCount: restoredIndexes.length,
      indexMatch,
      status: countMatch && indexMatch ? 'SUCCESS' : 'FAILED'
    });

    console.log(`✓ [${collName}] Restored: ${restoredCount}/${sourceCount} docs | Indexes: ${restoredIndexes.length}/${sourceIndexes.length} | Status: ${countMatch && indexMatch ? 'SUCCESS' : 'FAILED'}`);
  }

  // -----------------------------------------------------------------
  // DEEP DATA INTEGRITY & RELATIONSHIP AUDIT
  // -----------------------------------------------------------------
  console.log('\n--- Performing Deep Data & Relationship Integrity Audit ---');

  // Test 1: Products Integrity Check
  const sampleProduct = await targetDb.collection('products').findOne({ name: 'AMBER ELIXIR' });
  const pCheck = sampleProduct &&
    sampleProduct.variants &&
    sampleProduct.variants.length > 0 &&
    sampleProduct.variants[0]._id &&
    sampleProduct.images &&
    sampleProduct.images.length === 3 &&
    typeof sampleProduct.price === 'number';
  console.log(`  ${pCheck ? '✓' : '✗'} Product Schema & Variants Integrity: ${pCheck ? 'PASSED' : 'FAILED'}`);

  // Test 2: Orders Integrity Check
  const sampleOrder = await targetDb.collection('orders').findOne({ orderNumber: { $exists: true } });
  const oCheck = sampleOrder &&
    sampleOrder.items &&
    sampleOrder.items.length > 0 &&
    sampleOrder.shippingAddress &&
    sampleOrder.shippingAddress.fullName &&
    sampleOrder.createdAt instanceof Date;
  console.log(`  ${oCheck ? '✓' : '✗'} Order Manifest & Snapshot Integrity: ${oCheck ? 'PASSED' : 'FAILED'}`);

  // Test 3: Users & Wishlist Integrity Check
  const sampleUser = await targetDb.collection('users').findOne({ email: 'soumyaazeez0313@gmail.com' });
  const uCheck = sampleUser &&
    sampleUser.authProvider === 'google' &&
    sampleUser.profileImage.startsWith('https://lh3.googleusercontent.com');
  console.log(`  ${uCheck ? '✓' : '✗'} User Entity & Auth Identity: ${uCheck ? 'PASSED' : 'FAILED'}`);

  // Test 4: Wallets & Transactions Integrity Check
  const sampleWallet = await targetDb.collection('wallets').findOne({ balance: { $gt: 0 } });
  const wCheck = sampleWallet &&
    Array.isArray(sampleWallet.transactions) &&
    typeof sampleWallet.balance === 'number';
  console.log(`  ${wCheck ? '✓' : '✗'} Wallet Ledger & Numeric Precision: ${wCheck ? 'PASSED' : 'FAILED'}`);

  // Test 5: Categories Hierarchy Integrity Check
  const sampleCategory = await targetDb.collection('categories').findOne({ name: 'Men' });
  const cCheck = sampleCategory && sampleCategory.slug === 'men' && sampleCategory.isActive === true;
  console.log(`  ${cCheck ? '✓' : '✗'} Category Architecture: ${cCheck ? 'PASSED' : 'FAILED'}`);

  const allDeepPassed = pCheck && oCheck && uCheck && wCheck && cCheck;

  // -----------------------------------------------------------------
  // WRITE VERIFICATION ARTIFACT
  // -----------------------------------------------------------------
  const verificationResult = {
    testDate: new Date().toISOString(),
    sourceDatabase: SOURCE_DB_NAME,
    targetTemporaryDatabase: TARGET_DB_NAME,
    backupSourceDirectory: BACKUP_DIR,
    overallStatus: allDeepPassed && restoreReport.every(r => r.status === 'SUCCESS') ? 'SUCCESS' : 'FAILED',
    collectionsReport: restoreReport,
    deepIntegrityAudit: {
      products: pCheck ? 'SUCCESS' : 'FAILED',
      orders: oCheck ? 'SUCCESS' : 'FAILED',
      users: uCheck ? 'SUCCESS' : 'FAILED',
      wallets: wCheck ? 'SUCCESS' : 'FAILED',
      categories: cCheck ? 'SUCCESS' : 'FAILED'
    }
  };

  const outReportPath = path.join(rootDir, 'backup/restore_verification_report.json');
  fs.writeFileSync(outReportPath, JSON.stringify(verificationResult, null, 2), 'utf8');
  console.log(`\n✓ Restore verification manifest saved to: ${outReportPath}`);

  await client.close();
  console.log('✓ Disconnected from MongoDB Atlas');
}

runRestoreVerification().catch(err => {
  console.error('\n❌ Restore Verification FAILED:', err);
  process.exit(1);
});

