import mongoose from 'mongoose';
import { WalletTransaction } from './models';
import { PACKAGE_LIMITS } from './earning-limits';

export async function checkEarningLimit(
  user: any,
  incomingAmount: number,
  session?: mongoose.ClientSession
): Promise<'PAID' | 'HELD'> {

  // TESTING MODE: commission hatalarını debuglamak için
  if (process.env.DISABLE_EARNING_LIMITS === 'true') {
    console.log(`🧪 Testing mode: Earning limits disabled`);
    return 'PAID';
  }

  // Paket yoksa veya tanımsızsa HELD yap (monthly reset ile serbest bırakılacak)
  if (!user.membershipType || user.membershipType === 'NONE' || user.membershipType === 'free') {
    return 'HELD';
  }

  // @ts-expect-error - PACKAGE_LIMITS tip tanımlaması basit
  let limits = PACKAGE_LIMITS[user.membershipType];

  // Fallback: Unknown package type → use BASIC as default
  if (!limits) {
    console.warn(`⚠️ Unknown package type: ${user.membershipType}, using BASIC limits`);
    limits = PACKAGE_LIMITS['BASIC'] || { daily: 200, monthly: 2000 };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(
    startOfDay.getFullYear(),
    startOfDay.getMonth(),
    1
  );

  try {
    // Günlük ve aylık toplam kazançları hesapla (Sadece PAID olanlar)
    const aggregationOptions = session ? { session } : {};

    const [daily, monthly] = await Promise.all([
      WalletTransaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(user._id),
            status: 'PAID',
            createdAt: { $gte: startOfDay }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).session(session || null),

      WalletTransaction.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(user._id),
            status: 'PAID',
            createdAt: { $gte: startOfMonth }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).session(session || null)
    ]);

    const dailyTotal = daily[0]?.total || 0;
    const monthlyTotal = monthly[0]?.total || 0;

    // Log check
    console.log(`📊 Earning limit check for ${user._id}:`, {
      daily: { current: dailyTotal, incoming: incomingAmount, limit: limits.daily },
      monthly: { current: monthlyTotal, incoming: incomingAmount, limit: limits.monthly }
    });

    if (dailyTotal + incomingAmount > limits.daily) {
      console.log(`⚠️ Daily limit exceeded for ${user._id}`);
      return 'HELD';
    }
    if (monthlyTotal + incomingAmount > limits.monthly) {
      console.log(`⚠️ Monthly limit exceeded for ${user._id}`);
      return 'HELD';
    }

    return 'PAID';

  } catch (error) {
    console.error('Error checking earning limit:', error);
    // Default to HELD if error (safe approach)
    return 'HELD';
  }
}
