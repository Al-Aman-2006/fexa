import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/fexa-project";

function normalizeDirection(d) {
  if (!d) return "Credit";
  const upper = String(d).trim().toUpperCase();
  if (upper === "CREDIT") return "Credit";
  if (upper === "DEBIT") return "Debit";
  return d;
}

function normalizeStatus(s) {
  if (!s) return "Completed";
  const upper = String(s).trim().toUpperCase();
  if (upper === "SUCCESS" || upper === "COMPLETED") return "Completed";
  if (upper === "PENDING") return "Pending";
  if (upper === "FAILED") return "Failed";
  return s;
}

function normalizeType(t) {
  if (!t) return "Top-up";
  const upper = String(t).trim().toUpperCase().replace(/[- ]/g, "_");
  if (upper === "TOPUP" || upper === "TOP_UP") return "Top-up";
  if (upper === "REFUND" || upper === "RETURN_REFUND") return "Return Refund";
  if (upper === "PURCHASE" || upper === "PURCHASE_DEBIT" || upper === "DEBIT") return "Purchase Debit";
  if (upper === "CANCELLATION" || upper === "CANCELLATION_REFUND") return "Cancellation Refund";
  if (upper === "ADMIN_ADJUSTMENT" || upper === "ADJUSTMENT") return "Admin Adjustment";
  return t;
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB:", mongoUri);

  const db = mongoose.connection.db;
  const wallets = await db.collection("wallets").find({}).toArray();

  let modifiedWallets = 0;
  let modifiedTransactions = 0;

  for (const wallet of wallets) {
    if (!wallet.transactions || wallet.transactions.length === 0) continue;

    let hasChanges = false;
    const updatedTransactions = wallet.transactions.map((tx) => {
      const newType = normalizeType(tx.type);
      const newDir = normalizeDirection(tx.direction);
      const newStatus = normalizeStatus(tx.status);

      if (newType !== tx.type || newDir !== tx.direction || newStatus !== tx.status) {
        hasChanges = true;
        modifiedTransactions++;
        return {
          ...tx,
          type: newType,
          direction: newDir,
          status: newStatus,
        };
      }
      return tx;
    });

    if (hasChanges) {
      await db.collection("wallets").updateOne(
        { _id: wallet._id },
        { $set: { transactions: updatedTransactions } }
      );
      modifiedWallets++;
      console.log(`Updated wallet ${wallet._id} (User: ${wallet.user})`);
    }
  }

  console.log(`Migration complete: ${modifiedWallets} wallet(s) updated, ${modifiedTransactions} transaction(s) normalized.`);
  await mongoose.disconnect();
}

run().catch(console.error);
