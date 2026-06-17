import mongoose from 'mongoose';
import { WalletTransaction, User, CommissionAudit } from './models';
import { checkEarningLimit } from './earning-checker';
import { runInTransaction } from './utils';

export async function applyWalletTransactions(
  transactions: {
    userId: string;
    amount: number;
    type: string;
    reference: string;
    description?: string;
  }[],
  performedBy: string = 'system'
) {
  return runInTransaction(async (session) => {
    let processedCount = 0;
    let heldCount = 0;

    for (const tx of transactions) {
      // Idempotency: Check if transaction reference already exists
      if (tx.reference) {
        const existingTx = await WalletTransaction.findOne({ reference: tx.reference }).session(session);
        if (existingTx) {
          console.log(`⚠️ Transaction with reference ${tx.reference} already exists, skipping.`);
          continue;
        }
      }

      // Find user by id (string field, not _id)
      const user = await User.findOne({ id: tx.userId }).session(session || null);
      if (!user) {
        console.warn(`User ${tx.userId} not found, skipping transaction`);
        continue;
      }

      console.log(`💳 Processing transaction for user ${tx.userId}: ${tx.amount}${tx.description ? ` (${tx.description})` : ''}`);

      // Limit kontrolü yap
      const status = await checkEarningLimit(user, tx.amount, session);
      console.log(`📌 Status for ${tx.userId}: ${status} (amount: ${tx.amount}${tx.type ? `, type: ${tx.type}` : ''})`);

      // İşlem kaydını oluştur (Ledger)
      const txRecord = await WalletTransaction.create([{
        userId: user._id,
        amount: tx.amount,
        type: tx.type,
        reference: tx.reference,
        description: tx.description,
        status
      }], { session });
      console.log(`✅ Transaction record created: ${txRecord[0]?._id}`);

      // Eğer limit aşılmadıysa cüzdanı güncelle (Atomik işlem)
      if (status === 'PAID') {
        const updateQuery: any = {
          $inc: {
            "wallet.balance": tx.amount,
            "wallet.totalEarnings": tx.amount
          }
        };

        // Bonus tipine göre alt kırılımları da atomik güncelle
        if (tx.type === 'SPONSOR') updateQuery.$inc["wallet.sponsorBonus"] = tx.amount;
        else if (tx.type === 'CAREER') updateQuery.$inc["wallet.careerBonus"] = tx.amount;
        else if (tx.type === 'PASSIVE') updateQuery.$inc["wallet.passiveIncome"] = tx.amount;
        else if (tx.type === 'LEADERSHIP') updateQuery.$inc["wallet.leadershipBonus"] = tx.amount;

        console.log(`🔄 Updating wallet for ${user._id} with query:`, updateQuery);

        const updatedUser = await User.findOneAndUpdate(
          { _id: user._id },
          updateQuery,
          { session: session || null, new: true }
        );

        if (!updatedUser) {
          console.error(`❌ Failed to update wallet for user ${user._id}`);
          throw new Error(`Failed to update wallet for user ${user._id}`);
        }

        console.log(`✅ Wallet updated for ${user._id}. New balance: ${updatedUser.wallet?.balance}`);
        processedCount++;
      } else if (status === 'HELD') {
        console.log(`⏳ Transaction HELD for ${user._id} (limit exceeded)`);
        heldCount++;
      }
      // NOT: user.save() artık çağrılmıyor çünkü findOneAndUpdate her şeyi yaptı
    }

    // Audit log
    if (processedCount > 0 || heldCount > 0) {
      const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

      await CommissionAudit.create([{
        userId: 'system',
        action: 'DISTRIBUTED',
        amount: totalAmount,
        reason: `Applied ${transactions.length} transactions (${processedCount} PAID, ${heldCount} HELD)`,
        performedBy,
        timestamp: new Date(),
        metadata: {
          processedCount,
          heldCount,
          totalTransactions: transactions.length,
          references: transactions.map(t => t.reference)
        }
      }], { session });
    }

    console.log(`✅ Applied ${processedCount} transactions (${heldCount} held)`);
    return { processedCount, heldCount };
  });
}
