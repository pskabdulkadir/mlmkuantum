import mongoose from 'mongoose';
import { User as IUser, MonolineMLMSettings, MonolineCommissionStructure, MonolineCommissionTransaction, PassiveIncomeDistribution } from '../../shared/mlm-types';
import { User } from './models';
import { applyWalletTransactions } from './wallet-transaction.service';
import { MonolineSettings, PassiveIncomePool, CommissionAudit, CompanyFund, CommissionLog } from './models';
import { MONOLINE_LEVEL_COMMISSIONS, MAX_MONOLINE_LEVEL } from './commission';
import LoggerService, { LogContext } from './logger';

type SponsorLevel = {
  userId: string;
  level: number;
};

/**
 * Monoline Commission Service (REFACTORED)
 * 
 * - Sadece MongoDB kullanır (file-based fallback kaldırıldı)
 * - Idempotency desteği (CommissionLog ile duplicate prevention)
 * - applyWalletTransactions ile tam uyumlu
 * - Atomic transactions desteği
 */
export class MonolineCommissionService {

  // ==================== IDEMPOTENCY MECHANISMS ====================

  /**
   * Commission dağıtımının zaten işlenip işlenmediğini kontrol et
   */
  static async isCommissionAlreadyProcessed(reference: string): Promise<boolean> {
    const existing = await CommissionLog.findOne({ reference });
    return existing !== null;
  }

  /**
   * Transaction reference'ının unique olduğunu doğrula
   */
  static async validateTransactionReference(reference: string): Promise<void> {
    const existing = await mongoose.model('WalletTransaction').findOne({ reference });
    if (existing) {
      throw new Error(`Duplicate transaction reference: ${reference}`);
    }
  }

  // ==================== UPLINE QUERIES (MongoDB Only) ====================

  /**
   * Zinciri yukarı doğru tarar ve sponsorları listeler (SADECE MONGODB)
   * File-based fallback KALDIRILDI - sadece MongoDB kullanılır
   */
  static async getMonolineUpline(
    userId: string,
    session?: mongoose.ClientSession,
    maxLevels: number = MAX_MONOLINE_LEVEL
  ): Promise<SponsorLevel[]> {
    const sponsors: SponsorLevel[] = [];

    const currentUser = await User.findOne({ id: userId }).session(session || null);
    
    if (!currentUser) {
      throw new Error(`User not found: ${userId}`);
    }

    let searchUser = currentUser;
    let level = 1;
    let loopCount = 0;

    // Search for next active parents until we fill all levels
    while (
      searchUser?.previousUserId &&
      level <= maxLevels
    ) {
      const parent = await User.findOne({ id: searchUser.previousUserId }).session(session || null);
      if (!parent) break;

      // Dynamic Compression: Check if parent is active for current month
      const isActive = parent.isActive && parent.membershipType !== 'NONE' && (parent.monthlySalesVolume || 0) >= 20; // 20$ is current active min, will update later if needed

      if (isActive) {
        sponsors.push({
          userId: parent._id.toString(),
          level: level
        });
        level++;
      }

      // Circular check
      if (parent.id === searchUser.id || (isActive && sponsors.some(s => s.userId === parent._id.toString() && s.level < level - 1))) {
        LoggerService.warn(`Circular dependency in Global Monoline structure: ${searchUser.id} -> ${parent.id}`, { context: LogContext.SYSTEM });
        break;
      }

      searchUser = parent;
      
      // Limit search depth to avoid infinite loops and excessive DB queries
      loopCount++;
      if (sponsors.length >= maxLevels || loopCount > 500) break;
    }

    return sponsors;
  }

  // Admin servisi için alias fonksiyon
  static async getMonolineChain(
    userId: string,
    levels: number = 5,
    session?: mongoose.ClientSession
  ): Promise<SponsorLevel[]> {
    return MonolineCommissionService.getMonolineUpline(userId, session);
  }

  // ==================== COMMISSION DISTRIBUTION (Idempotent) ====================

  /**
   * Komisyonu hesaplar ve cüzdanlara dağıtır (IDEMPOTENT - duplicate prevention)
   * 
   * @param sourceUserId Kaynak kullanıcı ID
   * @param baseAmount Temel tutar
   * @param saleReference Unique sale reference (idempotency key)
   * @param session MongoDB session (atomic transactions için)
   */
  static async distributeMonolineCommission(
    sourceUserId: string,
    baseAmount: number,
    saleReference: string, // Unique sale reference - idempotency için gerekli
    session?: mongoose.ClientSession
  ) {
    // 1. İDEMPOTENCY CHECK: Aynı sale için birden fazla dağıtımı engelle
    const alreadyProcessed = await this.isCommissionAlreadyProcessed(saleReference);
    if (alreadyProcessed) {
      console.log(`⏭️ Commission zaten dağıtılmış: ${saleReference}`);
      return;
    }

    // 2. Upline'ı getir ve ayarları al
    const upline = await this.getMonolineUpline(sourceUserId, session);
    const settings = await this.getMonolineSettings(session);
    const structure = settings.commissionStructure;
    const transactions = [];

    for (const sponsor of upline) {
      const levelKey = `level${sponsor.level}` as keyof typeof structure.depthCommissions;
      const levelConfig = (structure.depthCommissions as any)[levelKey];

      if (!levelConfig || !levelConfig.percentage) continue;
      
      const sponsorUser = await User.findOne({ id: sponsor.userId }).session(session || null);
      if (!sponsorUser) continue;

      // Pasif / üyeliksiz kullanıcı alamaz
      if (!sponsorUser.isActive || sponsorUser.membershipType === 'NONE' || sponsorUser.membershipType === 'free') {
        continue;
      }

      const commissionAmount = (baseAmount * levelConfig.percentage) / 100;
      if (commissionAmount <= 0) continue;

      // Transaction reference'ı unique olmalı: saleReference-level
      const transactionReference = `${saleReference}-L${sponsor.level}`;
      
      // Reference unique kontrolü
      await this.validateTransactionReference(transactionReference);

      transactions.push({
        userId: sponsorUser.id,
        amount: commissionAmount,
        type: 'CAREER' as const,
        reference: transactionReference,
        description: `Level ${sponsor.level} monoline commission`,
        sourceUserId: sourceUserId,
        status: 'PAID' as const
      });
    }

    // 3. Şirket Fonu (%60) — cüzdana dağıtılmaz, sadece loglama yapılır
    const companyFundAmount = Math.round((baseAmount * 60) / 100 * 100) / 100;
    try {
      const CompanyFundModel = mongoose.models['CompanyFund'] || mongoose.model('CompanyFund', new mongoose.Schema({
        reference: String, amount: Number, source: String, createdAt: { type: Date, default: Date.now }
      }));
      await CompanyFundModel.create([{
        reference: `CF-${saleReference}`,
        amount: companyFundAmount,
        source: sourceUserId,
        createdAt: new Date(),
      }], session ? { session } : {});
    } catch (_) { /* log best-effort */ }

    // 4. Toplu işlem uygula
    if (transactions.length > 0) {
      await applyWalletTransactions(transactions, session);
    }

    // 5. İşlendi olarak işaretle (idempotency log)
    await CommissionLog.create([{
      reference: saleReference,
      totalAmount: baseAmount,
      companyFundAmount,
      transactionCount: transactions.length,
      processedAt: new Date(),
      processedBy: 'system',
    }], session ? { session } : {});

    console.log(`✅ Komisyon dağıtıldı: ${saleReference} | Şirket Fonu: $${companyFundAmount} | Dağıtılan: ${transactions.length} işlem`);
  }

  // ==================== SETTINGS & STRUCTURE ====================

  static async getMonolineSettings(session?: mongoose.ClientSession): Promise<MonolineMLMSettings> {
    let settings = await MonolineSettings.findOne().session(session || null);

    if (!settings) {
      const defaultStructure = MonolineCommissionService.getDefaultCommissionStructure();
      settings = await MonolineSettings.create([{
        isEnabled: true,
        productPrice: defaultStructure.productPrice,
        commissionStructure: defaultStructure,
        membershipRequirements: {},
        passiveIncomeSettings: {},
        activityRequirements: {},
        levelRequirements: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }], session ? { session } : {});
    }

    return {
      isEnabled: settings.isEnabled,
      productPrice: settings.productPrice,
      commissionStructure: settings.commissionStructure || MonolineCommissionService.getDefaultCommissionStructure(),
      membershipRequirements: settings.membershipRequirements,
      passiveIncomeSettings: {
        minimumActiveMembers: settings.settings?.minimumActiveMembers || 10,
        distributionFrequency: settings.settings?.distributionFrequency || 'monthly',
        lastDistribution: settings.lastDistributedAt || new Date(),
        totalPoolAmount: 0
      },
      activityRequirements: settings.activityRequirements,
      levelRequirements: settings.levelRequirements || [],
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    };
  }

  static getDefaultCommissionStructure(): MonolineCommissionStructure {
    // %60 Şirket Fonu | %25 Direkt Sponsor | %10 Unilevel (7 sev.) | %5 Monoline Havuz
    return {
      productPrice: 20,
      directSponsorBonus: { percentage: 25, amount: 5 },
      depthCommissions: {
        level1: { percentage: 3,   amount: 0.6 },
        level2: { percentage: 2,   amount: 0.4 },
        level3: { percentage: 1.5, amount: 0.3 },
        level4: { percentage: 1.5, amount: 0.3 },
        level5: { percentage: 1,   amount: 0.2 },
        level6: { percentage: 0.5, amount: 0.1 },
        level7: { percentage: 0.5, amount: 0.1 },
        totalPercentage: 10,
        totalAmount: 2.0
      },
      passiveIncomePool: { percentage: 5, amount: 1.0, distribution: 'equal_among_active' },
      companyFund: { percentage: 60, amount: 12 }
    };
  }

  // ==================== COMMISSION CALCULATION ====================

  static async calculateMonolineCommissions(
    buyerId: string,
    productPrice: number,
    allUsers?: IUser[],
    commissionStructure?: MonolineCommissionStructure,
    session?: mongoose.ClientSession
  ): Promise<{
    transactions: MonolineCommissionTransaction[],
    totalDistributed: number,
    passivePoolAmount: number,
    companyFundAmount: number
  }> {
    const {
      COMMISSION_RATES,
      UNILEVEL_RATES,
      MAX_UNILEVEL_DEPTH,
      CAREER_CONFIG_MAP,
      getMonolineDepthLimit,
      LEGACY_CAREER_MAP
    } = await import('../../shared/mlmRules');

    const transactions: MonolineCommissionTransaction[] = [];
    let totalDistributed = 0;

    const buyer = await User.findOne({ id: buyerId }).session(session || null);
    if (!buyer) {
      console.warn(`Buyer ${buyerId} not found`);
      return { transactions: [], totalDistributed: 0, passivePoolAmount: 0, companyFundAmount: 0 };
    }

    // 1. Şirket Fonu (%60)
    const companyFundAmount = Math.round((productPrice * (COMMISSION_RATES.companyFund / 100)) * 100) / 100;

    // 2. DIREKT SPONSOR PRİMİ (%25) - sponsorId ile
    console.log(`💰 Direct sponsor commission starting for buyer: ${buyerId}`);
    let directSponsor: any = null;
    let searchSponsorId = buyer.sponsorId;
    let compressionCount = 0;

    while (searchSponsorId && compressionCount < 100) {
      const potentialSponsor = await User.findOne({ id: searchSponsorId }).session(session || null);
      if (!potentialSponsor) break;

      const isSponsorActive = potentialSponsor.isActive && potentialSponsor.membershipType !== 'NONE' && potentialSponsor.membershipType !== 'free';

      if (isSponsorActive) {
        directSponsor = potentialSponsor;
        console.log(`✅ Found active direct sponsor: ${directSponsor.id}`);
        break;
      }

      searchSponsorId = potentialSponsor.sponsorId;
      compressionCount++;
    }

    if (directSponsor) {
      const directSponsorAmount = Math.round((productPrice * (COMMISSION_RATES.directSponsor / 100)) * 100) / 100;
      if (directSponsorAmount > 0) {
        transactions.push({
          id: `DIRECT-${Date.now()}-${directSponsor.id}`,
          userId: directSponsor.id,
          recipientId: directSponsor.id,
          amount: directSponsorAmount,
          type: 'direct',
          reference: `DIRECT-${Date.now()}-${directSponsor.id}`,
          description: `Direkt Sponsor Primi (%${COMMISSION_RATES.directSponsor})`,
          createdAt: new Date(),
          status: 'pending',
          sourceUserId: buyerId
        });
        totalDistributed += directSponsorAmount;
        console.log(`✅ Direct sponsor (${directSponsor.id}): ${directSponsorAmount}$`);
      }
    }

    // 3. MONOLINE UPLINE ZINCIRI - previousUserId ile üst sponsorlara dağıt (%10 unilevel)
    console.log(`🔗 Monoline upline distribution starting for buyer: ${buyerId}`);
    const monolineUpline = await this.getMonolineUpline(buyerId, session, 7); // 7 level monoline unilevel

    // Her upline sponsor seviyesine dağıt (dinamik oran)
    for (const uplineSponsor of monolineUpline) {
      const uplineUser = await User.findOne({ id: uplineSponsor.userId }).session(session || null);
      if (!uplineUser) continue;

      // Pasif üye: Commission almaz
      const isActive = uplineUser.isActive && uplineUser.membershipType !== 'NONE' && uplineUser.membershipType !== 'free';
      if (!isActive) {
        console.log(`⏭️ Upline ${uplineUser.id} passive, skipping level ${uplineSponsor.level}`);
        continue;
      }

      // Kariyer bazlı unilevel depth limiti kontrolü
      const rawCareerName = (uplineUser.careerLevel as any)?.name || uplineUser.careerLevel || 'Mülhime';
      const careerName = LEGACY_CAREER_MAP[rawCareerName] || rawCareerName;
      const depthLimit = getMonolineDepthLimit(careerName);

      // Eğer bu upline'ın derinlik limiti seviyesi aşıyorsa, prim almaz
      if (uplineSponsor.level > depthLimit) {
        console.log(`🚫 Upline ${uplineUser.id} (${careerName}) depth limit ${depthLimit}, level ${uplineSponsor.level} exceeds, skipping`);
        continue;
      }

      // Unilevel oranını al (7 derinlik L1:%3, L2:%2, ... vs)
      const unilevelRate = UNILEVEL_RATES[uplineSponsor.level] || 0;
      if (unilevelRate <= 0) continue;

      const commissionAmount = Math.round((productPrice * (unilevelRate / 100)) * 100) / 100;
      if (commissionAmount <= 0) continue;

      transactions.push({
        id: `UNILEVEL-L${uplineSponsor.level}-${Date.now()}-${uplineUser.id}`,
        userId: uplineUser.id,
        recipientId: uplineUser.id,
        amount: commissionAmount,
        type: 'depth',
        reference: `UNILEVEL-L${uplineSponsor.level}-${Date.now()}-${uplineUser.id}`,
        description: `Unilevel L${uplineSponsor.level} Monoline Primi (%${unilevelRate})`,
        createdAt: new Date(),
        status: 'pending',
        level: uplineSponsor.level,
        sourceUserId: buyerId
      });
      totalDistributed += commissionAmount;
      console.log(`✅ Upline L${uplineSponsor.level} (${uplineUser.id}): ${commissionAmount}$`);
    }

    // 4. Monoline Havuzu & Liderlik Bonusu (%5)
    const passivePoolAmount = Math.round((productPrice * (COMMISSION_RATES.monolinePool / 100)) * 100) / 100;

    return { transactions, totalDistributed, passivePoolAmount, companyFundAmount };
  }

  // ==================== MEMBERSHIP VALIDATION ====================

  static async validateInitialMembership(
    userId: string,
    purchaseAmount: number,
    session?: mongoose.ClientSession
  ): Promise<{
    isValid: boolean;
    message: string;
    minimumRequired: number;
  }> {
    try {
      const settings = await MonolineSettings.findOne().session(session || null);
      const minAmount = settings?.membershipRequirements?.initialPurchase?.minimumAmount || 100;

      if (purchaseAmount < minAmount) {
        return {
          isValid: false,
          message: `Minimum purchase required: $${minAmount}`,
          minimumRequired: minAmount
        };
      }

      const user = await User.findOne({ id: userId }).session(session || null);
      if (user?.membershipType && user.membershipType !== 'free' && user.membershipType !== 'NONE') {
        return {
          isValid: false,
          message: `User already has active ${user.membershipType} membership`,
          minimumRequired: minAmount
        };
      }

      return {
        isValid: true,
        message: 'Valid initial membership purchase',
        minimumRequired: minAmount
      };

    } catch (error) {
      console.error('Membership validation error:', error);
      return {
        isValid: false,
        message: 'Validation error',
        minimumRequired: 100
      };
    }
  }

  static async checkUserActivity(
    userId: string,
    session?: mongoose.ClientSession
  ): Promise<{
    isActive: boolean;
    lastActivityDate: Date | null;
    monthlyVolume: number;
    annualVolume: number;
    message: string;
  }> {
    try {
      const user = await User.findOne({ id: userId }).session(session || null);
      if (!user) {
        return {
          isActive: false,
          lastActivityDate: null,
          monthlyVolume: 0,
          annualVolume: 0,
          message: 'User not found'
        };
      }

      const settings = await MonolineSettings.findOne().session(session || null);
      const monthlyMin = settings?.membershipRequirements?.monthlyActivity?.minimumAmount || 20;

      const isUserActive = user.isActive && user.membershipType !== 'free' && user.membershipType !== 'NONE';
      const monthlyVolume = user.monthlySalesVolume || 0;
      const annualVolume = user.annualSalesVolume || user.totalInvestment || 0;

      const isActivityValid = monthlyVolume >= monthlyMin;

      return {
        isActive: isUserActive && isActivityValid,
        lastActivityDate: user.lastActivityDate || null,
        monthlyVolume,
        annualVolume,
        message: !isUserActive ? 'User not active or no membership' : isActivityValid ? 'Active member with sufficient activity' : `Below monthly minimum ($${monthlyMin})`
      };

    } catch (error) {
      console.error('Activity check error:', error);
      return {
        isActive: false,
        lastActivityDate: null,
        monthlyVolume: 0,
        annualVolume: 0,
        message: 'Activity check error'
      };
    }
  }

  // ==================== PASSIVE INCOME DISTRIBUTION ====================

  static async calculatePassiveIncomeDistribution(
    poolAmount: number,
    activeUsers: IUser[],
    distributionMethod: 'equal' | 'weighted_by_career' | 'weighted_by_activity' = 'equal',
    session?: mongoose.ClientSession
  ): Promise<PassiveIncomeDistribution> {

    if (activeUsers.length === 0) {
      return {
        id: new mongoose.Types.ObjectId().toString(),
        totalPool: poolAmount,
        activeMembers: 0,
        amountPerMember: 0,
        distributionDate: new Date(),
        recipients: [],
        method: distributionMethod
      };
    }

    const recipients: any[] = [];
    let totalDistributed = 0;

    switch (distributionMethod) {
      case 'weighted_by_career': {
        // Fetch dynamic career levels
        const { mongoDb } = await import('./mongo-database');
        const careerLevels = await mongoDb.getCareerLevels();
        
        const careerWeights = activeUsers.map(u => {
          const userLevelName = (u.careerLevel as any)?.name || u.careerLevel || 'Emmare';
          const levelData = careerLevels.find(l => l.name.toLowerCase() === userLevelName.toLowerCase());
          return {
            user: u,
            weight: (levelData?.passiveIncomeRate || levelData?.level || 1) * 1.0
          };
        });

        const totalWeight = careerWeights.reduce((sum, w) => sum + w.weight, 0);
        const amountPerWeight = poolAmount / totalWeight;

        for (const item of careerWeights) {
          const amount = Math.floor((item.weight * amountPerWeight) * 100) / 100;
          recipients.push({
            userId: item.user.id,
            memberId: item.user.memberId,
            amount,
            weight: item.weight,
            status: 'pending'
          });
          totalDistributed += amount;
        }
        break;
      }

      case 'weighted_by_activity': {
        const activityWeights = activeUsers.map(u => ({
          user: u,
          weight: (u.monthlySalesVolume || 0) || 1
        }));

        const totalWeight = activityWeights.reduce((sum, w) => sum + w.weight, 0);
        const amountPerWeight = poolAmount / Math.max(totalWeight, 1);

        for (const item of activityWeights) {
          const amount = Math.floor((item.weight * amountPerWeight) * 100) / 100;
          recipients.push({
            userId: item.user.id,
            memberId: item.user.memberId,
            amount,
            activity: item.weight,
            status: 'pending'
          });
          totalDistributed += amount;
        }
        break;
      }

      case 'weighted_by_monoline_depth': {
        const totalUsers = await User.countDocuments().session(session || null);
        const depthWeights = activeUsers.map(u => ({
          user: u,
          // Weight is based on how many people joined after them
          weight: Math.max(1, totalUsers - (u.globalRank || totalUsers))
        }));

        const totalWeight = depthWeights.reduce((sum, w) => sum + w.weight, 0);
        const amountPerWeight = poolAmount / Math.max(totalWeight, 1);

        for (const item of depthWeights) {
          const amount = Math.floor((item.weight * amountPerWeight) * 100) / 100;
          recipients.push({
            userId: item.user.id,
            memberId: item.user.memberId,
            amount,
            weight: item.weight,
            status: 'pending'
          });
          totalDistributed += amount;
        }
        break;
      }

      default: { // 'equal'
        const amountPerMember = Math.floor((poolAmount / activeUsers.length) * 100) / 100;
        for (const user of activeUsers) {
          recipients.push({
            userId: user.id,
            memberId: user.memberId,
            amount: amountPerMember,
            status: 'pending'
          });
          totalDistributed += amountPerMember;
        }
      }
    }

    return {
      id: new mongoose.Types.ObjectId().toString(),
      totalPool: poolAmount,
      activeMembers: activeUsers.length,
      amountPerMember: totalDistributed / activeUsers.length,
      distributionDate: new Date(),
      recipients,
      method: distributionMethod
    };
  }

  // ==================== NETWORK STATISTICS ====================

  static async getMonolineNetworkStats(allUsers?: IUser[]): Promise<any> {
    let users: any[];

    if (allUsers) {
      users = allUsers;
    } else {
      users = await User.find();
    }

    const totalMembers = users.length;
    const activeMembers = users.filter(u => u.isActive).length;
    const totalSales = users.reduce((sum, u) => sum + ((u.totalInvestment || 0)), 0);
    const totalTeamSize = users.reduce((sum, u) => sum + ((u.totalTeamSize || 0)), 0);

    return {
      totalMembers,
      activeMembers,
      inactiveMembers: totalMembers - activeMembers,
      activePercentage: totalMembers > 0 ? ((activeMembers / totalMembers) * 100).toFixed(2) : '0',
      totalSales: parseFloat(totalSales.toFixed(2)),
      totalTeamSize,
      averageSalesPerMember: totalMembers > 0 ? parseFloat((totalSales / totalMembers).toFixed(2)) : 0
    };
  }

  // ==================== SIMULATION ====================

  static async simulateSalesTransaction(buyerId: string, productPrice: number): Promise<any> {
    try {
      const calc = await MonolineCommissionService.calculateMonolineCommissions(buyerId, productPrice);

      const transactions = calc.transactions.map(t => ({
        userId: t.userId,
        amount: t.amount,
        type: 'CAREER',
        reference: t.reference,
        description: t.description
      }));

      if (transactions.length > 0) {
        await applyWalletTransactions(transactions);
      }

      return {
        success: true,
        message: 'Simulation complete',
        distributed: calc.totalDistributed,
        passivePool: calc.passivePoolAmount,
        companyFund: calc.companyFundAmount,
        transactionCount: transactions.length
      };
    } catch (error) {
      console.error('Simulation error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ==================== HELPER FUNCTIONS ====================

  static async processCommissionTransaction(transaction: MonolineCommissionTransaction, recipient: IUser): Promise<IUser> {
    recipient.wallet = recipient.wallet || {
      balance: 0,
      totalEarnings: 0,
      sponsorBonus: 0,
      careerBonus: 0,
      passiveIncome: 0,
      leadershipBonus: 0
    };
    recipient.wallet.balance = (recipient.wallet.balance || 0) + transaction.amount;
    recipient.wallet.totalEarnings = (recipient.wallet.totalEarnings || 0) + transaction.amount;
    return recipient;
  }

  static async addToSystemPools(
    passiveAmount: number,
    companyAmount: number,
    reference?: string,
    session?: mongoose.ClientSession
  ) {
    try {
      if (passiveAmount > 0) {
        await PassiveIncomePool.updateOne(
          {},
          {
            $inc: { totalAmount: passiveAmount },
            $set: { lastUpdated: new Date() }
          },
          { upsert: true, session }
        );
      }

      if (companyAmount > 0) {
        await CompanyFund.updateOne(
          {},
          {
            $inc: { totalAmount: companyAmount },
            $push: {
              transactions: {
                amount: companyAmount,
                reference: reference || `FUND-${Date.now()}`,
                createdAt: new Date()
              }
            },
            $set: { lastUpdated: new Date() }
          },
          { upsert: true, session }
        );
      }
      return true;
    } catch (error) {
      console.error("Error adding to system pools:", error);
      return false;
    }
  }

  /**
   * Distribute the accumulated passive income pool to active members
   */
  static async distributePassivePool(): Promise<{
    success: boolean;
    distributedAmount: number;
    recipientsCount: number;
    sharePerMember: number;
  }> {
    try {
      const { PassiveIncomePool } = await import('./models');
      const pool = await PassiveIncomePool.findOne({});
      if (!pool || pool.totalAmount <= 0) {
        return { success: false, distributedAmount: 0, recipientsCount: 0, sharePerMember: 0 };
      }

      // Find all active users (those who are qualified for Kardeş Payı)
      const { mongoDb } = await import('./mongo-database');
      const allUsers = await mongoDb.getAllUsers();
      const activeUsers = allUsers.filter(u => u.isActive && u.monthlyActivityStatus === 'active');

      if (activeUsers.length === 0) {
        console.log("No active users to distribute pool to.");
        return { success: false, distributedAmount: 0, recipientsCount: 0, sharePerMember: 0 };
      }

      const totalAmount = pool.totalAmount;
      const share = totalAmount / activeUsers.length;
      const { applyWalletTransactions } = await import('./wallet-transaction.service');
      
      const transactions = activeUsers.map(user => ({
        userId: user.id,
        amount: share,
        type: 'PASSIVE' as any,
        reference: `POOL-DIST-${new Date().toISOString().slice(0, 10)}-${user.id}`,
        description: `Global Pasif Havuz (Kardeş Payı) Dağıtımı (${activeUsers.length} kişi paylaştı)`
      }));

      // Apply transactions
      await applyWalletTransactions(transactions);

      // Update pool record
      await PassiveIncomePool.updateOne({}, {
        $set: { 
          totalAmount: 0,
          lastDistributedAt: new Date()
        },
        $push: {
          distributionHistory: {
            distributedAt: new Date(),
            amount: totalAmount,
            recipients: activeUsers.length,
            method: 'equal'
          }
        }
      });

      return {
        success: true,
        distributedAmount: totalAmount,
        recipientsCount: activeUsers.length,
        sharePerMember: share
      };
    } catch (error) {
      console.error("Error distributing passive pool:", error);
      return { success: false, distributedAmount: 0, recipientsCount: 0, sharePerMember: 0 };
    }
  }
}

export default MonolineCommissionService;
