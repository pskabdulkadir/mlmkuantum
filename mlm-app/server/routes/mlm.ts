import { RequestHandler } from "express";
import { mongoDb } from "../lib/mongo-database";
import LoggerService, { LogContext } from "../lib/logger";
import {
  generateReferralCode,
  hashPassword,
  verifyPassword,
  calculateSpiritualNumber,
  calculateMembershipExpiry,
  generateAccessToken,
  generateRefreshToken,
} from "../lib/utils";
import {
  User,
  MEMBERSHIP_PACKAGES,
  calculateCommissions,
  getCareerLevel,
} from "../../shared/mlm-types";
import { WalletTransaction } from "../lib/WalletTransaction";
import { CommissionLog } from "../lib/CommissionLog";
import PointsCareerService from "../lib/points-career-service";

// Helper to normalize career level from ID/number to full object
const normalizeCareerLevel = (levelInput: any) => {
  if (!levelInput) return undefined;
  if (typeof levelInput === 'object' && levelInput.id && levelInput.name) return levelInput;
  
  const levelIdOrNum = levelInput.toString();
  const allLevels = PointsCareerService.getDefaultCareerLevels();
  const foundLevel = allLevels.find(l => 
    l.level.toString() === levelIdOrNum || 
    l.id.toString() === levelIdOrNum || 
    l.name.toLowerCase() === levelIdOrNum.toLowerCase()
  );

  if (!foundLevel) {
    console.warn(`Career level not found for input: ${levelInput}, defaulting to first level`);
    return allLevels[0];
  }
  
  return foundLevel;
};

// Authentication
export const register: RequestHandler = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      sponsorCode,
      membershipType = "entry",
    } = req.body;

    // Check if user already exists
    const existingUser = await mongoDb.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Bu email zaten kullanımda" });
    }

    // Find sponsor
    let sponsorId: string | undefined;

    if (sponsorCode) {
      const sponsor = await mongoDb.getUserByReferralCode(sponsorCode);
      if (!sponsor) {
        return res.status(400).json({ error: "Geçersiz sponsor kodu" });
      }
      sponsorId = sponsor.memberId || sponsor.id;
    } else {
      // Default to admin as sponsor if none provided
      const adminUser = await mongoDb.getUserByEmail(
        "psikologabdulkadirkan@gmail.com",
      );
      if (adminUser) {
        sponsorId = adminUser.memberId || adminUser.id;
      }
    }

    // Create new user
    const referralCode = generateReferralCode(fullName);
    const hashedPassword = await hashPassword(password);

    const newUser: any = {
      name: fullName,
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: "user",
      sponsorId: sponsorId, // Direct sponsor assignment for monoline system
      membershipType: "free", // Start as free, upgrade after payment
      isActive: false,
      pointsSystem: {
        personalSalesPoints: 0,
        teamSalesPoints: 0,
        directReferrals: 0,
        minimumMonthlyPoints: 0,
        registrationPoints: 0,
        totalPoints: 0,
        monthlyPoints: 0,
      },
      careerLevel: {
        id: "1",
        name: "Mülhime",
        displayName: "Mülhime",
        description: "Giriş seviyesi",
        minInvestment: 100,
        minDirectReferrals: 2,
        personalSalesPoints: 0,
        teamSalesPoints: 0,
        commissionRate: 3,
        order: 1,
        isActive: true,
        level: 1,
        passiveIncomeRate: 0.5,
        bonus: 0,
        requirements: {
          personalSalesPoints: 0,
          teamSalesPoints: 100,
          directReferrals: 2,
          minimumMonthlyPoints: 0,
        },
        benefits: {
          directSalesCommission: 3,
          teamBonusRate: 0,
          monthlyBonus: 0,
          rankBonus: 0,
        },
      },
      totalInvestment: 0,
      teamTurnoverUSD: 0,
      directReferrals: 0,
      totalTeamSize: 0,
      monthlySalesVolume: 0,
      annualSalesVolume: 0,
      wallet: {
        balance: 0,
        totalEarnings: 0,
        sponsorBonus: 0,
        careerBonus: 0,
        passiveIncome: 0,
        leadershipBonus: 0,
      },
      kycStatus: "pending",
      motherName: req.body.motherName,
    };

    const creationResult = await mongoDb.adminCreateUser(newUser);
    if (!creationResult.success || !creationResult.user) {
      return res.status(400).json({ error: (creationResult as any).message || "Kullanıcı oluşturulamadı." });
    }
    const user = creationResult.user;

    // Register monoline placement with sponsor
    if (sponsorId) {
      // Create pending placement record
      await mongoDb.createPendingPlacement({
        sponsorId,
        newUserId: user.id,
        newUserData: {
          fullName: user.fullName,
          email: user.email,
          phone: user.phone || "",
          membershipType: user.membershipType || "standard"
        }
      });

      // Update sponsor's direct referrals count
      const sponsorUser = await mongoDb.getUserById(sponsorId);
      if (sponsorUser) {
        sponsorUser.directReferrals = (sponsorUser.directReferrals || 0) + 1;
        await mongoDb.updateUser(sponsorId, { directReferrals: sponsorUser.directReferrals });
      }
    }

    // Track conversion if user came through a sponsor's referral
    if (sponsorId) {
      try {
        await mongoDb.updateUserCloneStore(sponsorId, { $inc: { conversionCount: 1 } });
      } catch (error) {
        LoggerService.error("Error tracking conversion", { error, context: LogContext.SYSTEM });
      }
    }

    res.json({
      success: true,
      message: "Kayıt başarılı. Lütfen üyelik paketinizi seçin.",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        referralCode: user.referralCode,
      },
    });
  } catch (error) {
    LoggerService.error("Registration error", { error, context: LogContext.AUTH, body: { email: req.body.email } });
    res.status(500).json({ error: "Kayıt sırasında hata oluştu" });
  }
};

export const login: RequestHandler = async (req, res) => {
  try {
    console.log("Login request received");

    // Check if request body exists and is properly parsed
    if (!req.body) {
      console.error("Request body is missing");
      return res.status(400).json({ error: "Request body is required" });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      console.error("Missing email or password");
      return res.status(400).json({ error: "Email ve şifre gereklidir" });
    }

    console.log("Looking up user:", email);
    const user = await mongoDb.getUserByEmail(email);
    if (!user) {
      console.log("User not found:", email);
      return res.status(401).json({ error: "Geçersiz email veya şifre" });
    }

    console.log("Verifying password for user:", user.id);

    if (!user.password) {
      console.error("User password hash is missing for:", user.id);
      return res.status(500).json({ error: "Kullanıcı verisi hatalı (Şifre bulunamadı)" });
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      console.log("Invalid password for user:", user.id);
      return res.status(401).json({ error: "Geçersiz email veya şifre" });
    }

    console.log("Login successful for user:", user.id);

    // Update last login
    try {
      await mongoDb.updateUser(user.id, { lastLoginDate: new Date() });
    } catch (updateError) {
      console.error("Error updating last login:", updateError);
      // Continue with login even if update fails
    }

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user.id });

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        membershipType: user.membershipType,
        isActive: user.isActive,
        referralCode: user.referralCode,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    LoggerService.error("Login error", { error, context: LogContext.AUTH, body: { email: req.body.email } });

    // Ensure we always return JSON
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Giriş sırasında bir hata oluştu.",
      });
    }
  }
};

// Membership Management
export const purchaseMembership: RequestHandler = async (req, res) => {
  try {
    const { userId, packageType, paymentMethod, bankReceipt } = req.body;

    const user = await mongoDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    const membershipPackage = MEMBERSHIP_PACKAGES.find(
      (pkg) => pkg.type === packageType,
    );
    if (!membershipPackage) {
      return res.status(400).json({ error: "Geçersiz paket türü" });
    }

    // Create payment request
    const paymentRequest = await mongoDb.createPaymentRequest({
      userId,
      type: "deposit",
      amount: membershipPackage.price,
      method: paymentMethod,
      status: "pending",
      receipt: bankReceipt,
    });

    res.json({
      success: true,
      message: "Ödeme talebi oluşturuldu. Admin onayı bekleniyor.",
      paymentRequest,
    });
  } catch (error) {
    console.error("Purchase membership error:", error);
    res.status(500).json({ error: "Üyelik satın alma sırasında hata oluştu" });
  }
};

export const activateMembership: RequestHandler = async (req, res) => {
  try {
    const { paymentRequestId, approved } = req.body;

    const paymentRequest = await mongoDb.updatePaymentRequest(paymentRequestId, {
      status: approved ? "approved" : "rejected",
    });

    if (!paymentRequest || !approved) {
      return res.json({ success: true, message: "Ödeme talebi reddedildi" });
    }

    const user = await mongoDb.getUserById(paymentRequest.userId);
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    // Find membership package
    const membershipPackage = MEMBERSHIP_PACKAGES.find(
      (pkg) => pkg.price === paymentRequest.amount,
    );
    if (!membershipPackage) {
      return res.status(400).json({ error: "Geçersiz paket" });
    }

    // Activate membership
    const startDate = new Date();
    const endDate =
      membershipPackage.type !== "entry"
        ? calculateMembershipExpiry(startDate, (membershipPackage as any).durationDays || (membershipPackage as any).duration || 30)
        : undefined;

    await mongoDb.updateUser(user.id, {
      membershipType: membershipPackage.type,
      membershipStartDate: startDate,
      membershipEndDate: endDate,
      isActive: true,
      totalInvestment: (user.totalInvestment || 0) + paymentRequest.amount,
      lastPaymentDate: new Date(),
    });

    // Calculate and distribute commissions using Monoline MLM system
    try {
      const { MonolineCommissionService } = await import('../lib/monoline-commission-service');
      const PointsCareerService = (await import('../lib/points-career-service')).default;

      // 1. Monoline Commissions (Cash distribution)
      const allUsers = await mongoDb.getAllUsers();
      const commissionResult = await MonolineCommissionService.calculateMonolineCommissions(
        user.id,
        paymentRequest.amount,
        allUsers
      );

      // Distributions
      if (commissionResult.transactions.length > 0) {
        // Prepare wallet transactions for applyWalletTransactions helper
        const walletTxs = commissionResult.transactions.map(t => ({
          userId: t.userId,
          amount: t.amount,
          type: t.type === 'direct' ? 'SPONSOR' : 'CAREER',
          reference: t.reference || `ACT-${Date.now()}-${t.userId}`,
          description: t.description || `Üyelik aktivasyon komisyonu`
        }));
        
        const { applyWalletTransactions } = await import('../lib/wallet-transaction.service');
        await applyWalletTransactions(walletTxs as any);

        // Also log them in Monoline Transactions for panel views
        await mongoDb.createMonolineCommissionTransactions(commissionResult.transactions);
      }

      // System Pool & Company Fund
      if (commissionResult.passivePoolAmount > 0 || commissionResult.companyFundAmount > 0) {
        await MonolineCommissionService.addToSystemPools(
          commissionResult.passivePoolAmount,
          commissionResult.companyFundAmount,
          `ACT-${paymentRequestId}`
        );
      }

      console.log(`💰 Commissions distributed for activation: $${commissionResult.totalDistributed}`);

      // 2. Turnover propagation & Career updates
      // Note: awardSalePoints now handles teamTurnoverUSD propagation and automatic career selection
      const pointResult = await PointsCareerService.awardSalePoints(
        user.id,
        paymentRequest.amount,
        'membership',
        allUsers as any
      );

      // Persist all users who had their turnover or career changed
      // Comparison logic: find users in pointResult.updatedUsers who differ from allUsers
      for (const updatedUser of pointResult.updatedUsers) {
        const originalUser = allUsers.find(u => u.id === updatedUser.id);
        if (!originalUser) continue;

        // Check if turnover or career changed
        const turnoverChanged = updatedUser.teamTurnoverUSD !== originalUser.teamTurnoverUSD;
        const careerChanged = JSON.stringify(updatedUser.careerLevel) !== JSON.stringify(originalUser.careerLevel);

        if (turnoverChanged || careerChanged) {
          await mongoDb.updateUser(updatedUser.id, {
            teamTurnoverUSD: updatedUser.teamTurnoverUSD,
            careerLevel: updatedUser.careerLevel,
            pointsSystem: updatedUser.pointsSystem
          });
        }
      }

      console.log(`✅ Turnover propagated and careers updated for activation.`);

    } catch (commissionError: any) {
      console.error('Error processing membership activation effects:', commissionError);
    }

    // Create transaction record for membership payment
    await mongoDb.createTransaction({
      userId: user.id,
      type: "FEE",
      reference: `MEM-ACT-${paymentRequestId}`,
      amount: paymentRequest.amount,
      description: `${membershipPackage.name} üyelik ödemesi`,
      status: "completed",
    });

    res.json({
      success: true,
      message: "Üyelik başarıyla aktifleştirildi",
    });
  } catch (error) {
    console.error("Activate membership error:", error);
    res
      .status(500)
      .json({ error: "Üyelik aktifleştirme sırasında hata oluştu" });
  }
};

// Update Receipt File
export const updateReceipt: RequestHandler = async (req, res) => {
  try {
    const { userId, receiptFile } = req.body;

    if (!userId || !receiptFile) {
      return res.status(400).json({ error: "Kullanıcı ID ve dekont dosyası gereklidir" });
    }

    const user = await mongoDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    await mongoDb.updateUser(userId, {
      receiptFile: receiptFile,
      receiptUploadedAt: new Date(),
      receiptVerified: false,
    });

    res.json({
      success: true,
      message: "Ödeme dekontu başarıyla yüklendi. Admin onayı bekleniyor.",
    });
  } catch (error) {
    console.error("Update receipt error:", error);
    res
      .status(500)
      .json({ error: "Dekont yükleme sırasında hata oluştu" });
  }
};

// User Dashboard
export const getUserDashboard: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await mongoDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    // Get network statistics
    const directReferrals = await mongoDb.getDirectReferrals(userId);
    const totalTeamSize = await mongoDb.getTotalTeamSize(userId);
    const networkTree = await mongoDb.getNetworkTree(userId, 3); // 3 levels for dashboard

    // Update team statistics
    await mongoDb.updateUser(userId, {
      directReferrals: directReferrals.length,
      totalTeamSize,
    });

    res.json({
      user,
      networkStats: {
        directReferrals: directReferrals.length,
        totalTeamSize,
        networkTree,
        teamTurnoverUSD: user.teamTurnoverUSD || 0,
      },
      directReferralsList: directReferrals,
    });
  } catch (error) {
    console.error("Get user dashboard error:", error);
    res.status(500).json({ error: "Dashboard verileri alınırken hata oluştu" });
  }
};

export const getPendingPlacements: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const placements = await mongoDb.getPendingPlacements(userId);
    res.json({ success: true, placements });
  } catch (error) {
    console.error("Get pending placements error:", error);
    res.status(500).json({ error: "Bekleyen yerleştirmeler alınırken hata oluştu" });
  }
};

// Network Management
export const getGlobalMonoline: RequestHandler = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const users = await mongoDb.User.find({ globalRank: { $exists: true } })
      .sort({ globalRank: 1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .lean();
    
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Monoline zinciri alınırken hata oluştu" });
  }
};

export const getNetworkTree: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const { depth = 7 } = req.query;

    const networkTree = await mongoDb.getNetworkTree(
      userId,
      parseInt(depth as string),
    );

    res.json({ networkTree });
  } catch (error) {
    console.error("Get network tree error:", error);
    res.status(500).json({ error: "Network ağacı alınırken hata oluştu" });
  }
};

export const getMonolineDownline: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const { depth = 7 } = req.query;
    const result = await mongoDb.getMonolineDownline(userId, parseInt(depth as string));
    res.json(result);
  } catch (error) {
    console.error("Get monoline downline error:", error);
    res.status(500).json({ error: "Monoline zinciri alınırken hata oluştu" });
  }
};

// Financial Operations
export const createWithdrawalRequest: RequestHandler = async (req, res) => {
  try {
    const { userId, amount, bankDetails } = req.body;

    const user = await mongoDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    if (user.wallet.balance < amount) {
      return res.status(400).json({ error: "Yetersiz bakiye" });
    }

    const withdrawalRequest = await mongoDb.createPaymentRequest({
      userId,
      type: "withdrawal",
      amount,
      method: "stripe",
      status: "pending",
      bankDetails,
    });

    res.json({
      success: true,
      message: "Para çekme talebi oluşturuldu",
      withdrawalRequest,
    });
  } catch (error) {
    console.error("Withdrawal request error:", error);
    res.status(500).json({ error: "Para çekme talebi sırasında hata oluştu" });
  }
};

export const transferFunds: RequestHandler = async (req, res) => {
  try {
    const { fromUserId, toUserEmail, amount, note } = req.body;

    const fromUser = await mongoDb.getUserById(fromUserId);
    const toUser = await mongoDb.getUserByEmail(toUserEmail);

    if (!fromUser || !toUser) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    if (fromUser.wallet.balance < amount) {
      return res.status(400).json({ error: "Yetersiz bakiye" });
    }

    // Create transactions
    await mongoDb.createTransaction({
      userId: fromUserId,
      type: "transfer",
      amount: -amount,
      description: `Transfer to ${toUser.fullName}: ${note}`,
      status: "completed",
    });

    await mongoDb.createTransaction({
      userId: toUser.id,
      type: "transfer",
      amount: amount,
      description: `Transfer from ${fromUser.fullName}: ${note}`,
      status: "completed",
    });

    res.json({
      success: true,
      message: "Transfer başarıyla tamamlandı",
    });
  } catch (error) {
    console.error("Transfer funds error:", error);
    res.status(500).json({ error: "Transfer sırasında hata oluştu" });
  }
};

// Spiritual Calculations
export const calculateSpiritual: RequestHandler = async (req, res) => {
  try {
    const { name, motherName, birthDate } = req.body;

    const calculation = calculateSpiritualNumber(name, birthDate);

    res.json({
      success: true,
      calculation,
    });
  } catch (error) {
    console.error("Spiritual calculation error:", error);
    res.status(500).json({ error: "Manevi hesaplama sırasında hata oluştu" });
  }
};

// Clone Page Management
export const getClonePage: RequestHandler = async (req, res) => {
  try {
    const { slug } = req.params;

    const clonePage = await mongoDb.getClonePageBySlug(slug);
    if (!clonePage) {
      return res.status(404).json({ error: "Sayfa bulunamadı" });
    }

    const user = await mongoDb.getUserById(clonePage.userId);
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    // Increment visit count and save to database
    await mongoDb.ClonePage.updateOne(
      { slug },
      { $inc: { visitCount: 1 } }
    );

    // Return updated data
    const updatedPage = await mongoDb.ClonePage.findOne({ slug });
    if (updatedPage) {
      clonePage.visitCount = updatedPage.visitCount;
    }

    res.json({
      clonePage,
      user: {
        fullName: user.fullName,
        memberId: user.memberId,
        referralCode: user.referralCode,
        careerLevel: user.careerLevel,
      },
    });
  } catch (error) {
    console.error("Get clone page error:", error);
    res.status(500).json({ error: "Sayfa yüklenirken hata oluştu" });
  }
};

// Admin Operations
export const getAdminDashboard: RequestHandler = async (req, res) => {
  try {
    const users = await mongoDb.getAllUsers();
    const settings = await mongoDb.getSettings();

    // Yeni sistemden (MongoDB) istatistikleri çek
    const heldEarningsCount = await WalletTransaction.countDocuments({ status: 'HELD' }).exec().catch(() => 0);

    const heldEarningsTotal = await WalletTransaction.aggregate([
      { $match: { status: 'HELD' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).catch(() => []);

    const totalCommissions = await CommissionLog.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).catch(() => []);

    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      totalRevenue: users.reduce((sum, u) => sum + u.totalInvestment, 0),
      pendingPayments: 0, // Will be calculated from payment requests
      // Yeni eklenen istatistikler
      heldEarnings: {
        count: heldEarningsCount,
        amount: heldEarningsTotal[0]?.total || 0
      },
      totalDistributedCommissions: totalCommissions[0]?.total || 0,
      systemHealth: "active"
    };

    res.json({
      stats,
      recentUsers: users.slice(-10),
      settings,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    // Return fallback data instead of error
    res.json({
      stats: {
        totalUsers: 0,
        activeUsers: 0,
        totalRevenue: 0,
        pendingPayments: 0,
        heldEarnings: { count: 0, amount: 0 },
        totalDistributedCommissions: 0,
        systemHealth: "error"
      },
      recentUsers: [],
      settings: {
        systemSettings: {
          maxCapacity: 1000000,
          autoPlacement: true,
          registrationEnabled: true,
          maintenanceMode: false,
        },
        commissionSettings: {
          sponsorBonusRate: 10,
          careerBonusRate: 25,
          passiveIncomeRate: 5,
          systemFundRate: 60,
        },
      },
    });
  }
};

export const getAllUsers: RequestHandler = async (req, res) => {
  try {
    const users = await mongoDb.getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error("Get all users error:", error);
    // Return empty array instead of error
    res.json({ users: [] });
  }
};

export const updateUserByAdmin: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Fix careerLevel if it's sent as a number or string ID instead of an object
    if (updates.careerLevel) {
      updates.careerLevel = normalizeCareerLevel(updates.careerLevel);
    }

    const updatedUser = await mongoDb.updateUser(userId, updates);
    if (!updatedUser) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    res.json({
      success: true,
      message: "Kullanıcı güncellendi",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res
      .status(500)
      .json({ error: "Kullanıcı güncelleme sırasında hata oluştu" });
  }
};

export const deleteUserByAdmin: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    const deleted = await mongoDb.deleteUser(userId);
    if (!deleted) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    res.json({
      success: true,
      message: "Kullanıcı silindi",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Kullanıcı silme sırasında hata oluştu" });
  }
};

export const getNextId: RequestHandler = async (req, res) => {
  try {
    const nextId = await mongoDb.getNextMemberId();
    res.json({ nextId });
  } catch (error) {
    res.status(500).json({ error: "ID üretilirken hata oluştu" });
  }
};

export const moveUserByAdmin: RequestHandler = async (req, res: any) => {
  try {
    const { userId } = req.params;
    const { newSponsorId } = req.body;
    const adminId = (req as any).user?.id || "admin";

    if (!newSponsorId) {
      return res.status(400).json({ error: "Yeni sponsor ID'si gereklidir" });
    }

    const result = await mongoDb.adminMoveUser(userId, newSponsorId, adminId);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Move user error:", error);
    res.status(500).json({ error: "Kullanıcı taşıma sırasında hata oluştu" });
  }
};

export const placeUserByAdmin: RequestHandler = async (req, res: any) => {
  try {
    const { placementId } = req.params;
    const { sponsorId, position } = req.body;

    const placement = await (mongoDb as any).PendingPlacement.findOne({ id: placementId });
    if (!placement) {
      return res.status(404).json({ error: "Yerleştirme kaydı bulunamadı" });
    }

    // Process placement
    // 1. Create the actual user if not exists or update status
    const result = await mongoDb.adminCreateUser({
      ...placement.newUserData,
      sponsorId: sponsorId,
      isActive: true,
      password: "Generated123!", // Should be handled better
    });

    if (result.success) {
      await mongoDb.updatePlacementStatus(placementId, "placed");
    }

    res.json(result);
  } catch (error) {
    console.error("Place user error:", error);
    res.status(500).json({ error: "Yerleştirme sırasında hata oluştu" });
  }
};

export const updateSystemSettings: RequestHandler = async (req, res) => {
  try {
    const settings = req.body;

    await mongoDb.updateSettings(settings);

    res.json({
      success: true,
      message: "Sistem ayarları güncellendi",
    });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ error: "Ayarlar güncellenirken hata oluştu" });
  }
};

// Binary Network Endpoints
export const getBinaryNetworkStats: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    const stats = await mongoDb.getBinaryNetworkStats(userId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Get binary stats error:", error);
    res
      .status(500)
      .json({ error: "Binary istatistikleri alınırken hata oluştu" });
  }
};

export const getDetailedNetworkTree: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    const { depth = 7 } = req.query;

    const networkTree = await mongoDb.getNetworkTree(
      userId,
      parseInt(depth as string),
    );

    // Enhanced network tree with binary-specific data
    const enhancedTree = await enhanceNetworkTreeData(networkTree);

    res.json({
      success: true,
      networkTree: enhancedTree,
    });
  } catch (error) {
    console.error("Get detailed network tree error:", error);
    res
      .status(500)
      .json({ error: "Detaylı network ağacı alınırken hata oluştu" });
  }
};

// Helper function to enhance network tree with binary data
async function enhanceNetworkTreeData(tree: any): Promise<any> {
  if (!tree || !tree.user) return null;

  const user = tree.user;
  const binaryStats = await mongoDb.getBinaryNetworkStats(user.id);

  return {
    id: user.id,
    name: user.fullName,
    memberId: user.memberId,
    careerLevel: user.careerLevel.name,
    totalInvestment: user.totalInvestment,
    isActive: user.isActive,
    teamSize: tree.totalTeamSize || 0,
    teamVolume: binaryStats.leftVolume + binaryStats.rightVolume,
    leftChild:
      tree.children && tree.children[0]
        ? await enhanceNetworkTreeData(tree.children[0])
        : null,
    rightChild:
      tree.children && tree.children[1]
        ? await enhanceNetworkTreeData(tree.children[1])
        : null,
  };
}

export const activateBinarySystem: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.body;

    // Activate binary system for user
    const user = await mongoDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    // Update system settings to activate binary features
    const currentSettings = await mongoDb.getSettings();
    await mongoDb.updateSettings({
      ...currentSettings,
      systemSettings: {
        ...currentSettings.systemSettings,
        autoPlacement: true,
        maxCapacity: 100000,
      },
    });

    res.json({
      success: true,
      message: "Binary sistem aktifleştirildi",
      features: {
        autoPlacement: true,
        maxLevels: 7,
        maxCapacity: 1000000,
        commissionLevels: 7,
      },
    });
  } catch (error) {
    console.error("Activate binary system error:", error);
    res
      .status(500)
      .json({ error: "Binary sistem aktifleştirme sırasında hata oluştu" });
  }
};

export const calculateBinaryBonus: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await mongoDb.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }

    const stats = await mongoDb.getBinaryNetworkStats(userId);

    // Calculate binary bonus based on weaker leg
    const weakerLegVolume = Math.min(stats.leftVolume, stats.rightVolume);
    const binaryBonus = weakerLegVolume * 0.1; // 10% of weaker leg

    // Apply binary bonus if significant
    if (binaryBonus >= 10) {
      // Minimum $10 threshold
      await mongoDb.createTransaction({
        userId: user.id,
        type: "bonus",
        amount: binaryBonus,
        description: `Binary bonus - Zayıf bacak: $${weakerLegVolume}`,
        status: "completed",
      });

      // Update user wallet
      user.wallet.leadershipBonus += binaryBonus;
      user.wallet.balance += binaryBonus;
      await mongoDb.updateUser(user.id, { wallet: user.wallet });
    }

    res.json({
      success: true,
      binaryBonus,
      applied: binaryBonus >= 10,
      stats,
    });
  } catch (error) {
    console.error("Calculate binary bonus error:", error);
    res
      .status(500)
      .json({ error: "Binary bonus hesaplama sırasında hata oluştu" });
  }
};

// Performance Monitoring
export const getPerformanceStatus: RequestHandler = async (req, res) => {
  const results: any = {
    test: 'Full System Health Check (via existing route)',
    timestamp: new Date(),
    database: { lowdb: false, mongodb: false },
    admin: { exists: false, details: null },
    clonePages: { count: 0, sample: null },
    walletSystem: { working: false },
    monolineSystem: { synced: false, simulation: null },
    errors: []
  };

  try {
    // 1. Database Checks
    try {
      const { default: mongoose } = await import('mongoose');
      if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        results.database.mongodb = true;
        results.database.lowdb = false; // Deprecated
      } else {
        results.errors.push(`MongoDB not connected (State: ${mongoose.connection.readyState})`);
      }
    } catch (e: any) { results.errors.push(`Mongo Error: ${e.message}`); }

    // 2. Admin Check
    try {
      const users = await mongoDb.getAllUsers();
      const admin = users.find((u: any) => u.role === 'admin' || u.email?.includes('admin'));
      if (admin) {
        results.admin.exists = true;
        results.admin.details = { id: admin.id, email: admin.email, role: admin.role };
        // Auto-sync admin to Mongo if needed
        await mongoDb.syncUserToMongo(admin);
      } else {
        results.errors.push("No admin user found in LowDB");
      }
    } catch (e: any) { results.errors.push(`Admin Check Error: ${e.message}`); }

    // 3. Clone Pages Check
    try {
      // Access LowDB data directly
      const pages = (mongoDb as any).db.data.clonePages || [];
      results.clonePages.count = pages.length;
      if (pages.length > 0) {
        results.clonePages.sample = { slug: pages[0].slug, userId: pages[0].userId };
      } else {
        results.clonePages.message = "No clone pages found (acceptable if fresh setup)";
      }
    } catch (e: any) { results.errors.push(`Clone Pages Error: ${e.message}`); }

    // 4. Wallet & Monoline Simulation
    try {
      // Create a temporary test user flow
      const testBuyerId = `test-health-${Date.now()}`;
      const testSponsorId = results.admin.exists ? results.admin.details.id : null;

      if (testSponsorId) {
        // Create dummy buyer
        const buyer = await mongoDb.createUser({
          id: testBuyerId,
          email: `test-${Date.now()}@healthcheck.com`,
          fullName: 'Health Check User',
          sponsorId: testSponsorId,
          isActive: true
        });

        // Sync both to Mongo
        await mongoDb.syncUserToMongo(buyer);
        const sponsor = await mongoDb.getUserById(testSponsorId);
        await mongoDb.syncUserToMongo(sponsor);

        // Simulate Sale
        const { MonolineCommissionService } = await import('../lib/monoline-commission-service');
        const commissionResult = await MonolineCommissionService.calculateMonolineCommissions(
          buyer.id,
          100 // $100 sale
        );

        results.monolineSystem.simulation = {
          success: true,
          distributed: commissionResult.totalDistributed,
          transactions: commissionResult.transactions.length,
          passivePool: commissionResult.passivePoolAmount
        };

        // Cleanup test user
        await mongoDb.deleteUser(testBuyerId);
      } else {
        results.monolineSystem.simulation = "Skipped: No Sponsor/Admin found";
      }

      results.monolineSystem.synced = true;
      results.walletSystem.working = true;

    } catch (e: any) {
      results.errors.push(`Monoline/Wallet Error: ${e.message}`);
    }

    res.json(results);

  } catch (error: any) {
    console.error("Health Check Error:", error);
    results.errors.push("Fatal: " + error.message);
    res.status(500).json(results);
  }
};

export const optimizeSystem: RequestHandler = async (req, res) => {
  try {
    await mongoDb.optimizeForScale();

    res.json({
      success: true,
      message: "Sistem optimizasyonu tamamlandı",
    });
  } catch (error) {
    console.error("System optimization error:", error);
    res
      .status(500)
      .json({ error: "Sistem optimizasyonu sırasında hata oluştu" });
  }
};

export const checkCapacity: RequestHandler = async (req, res) => {
  try {
    const capacityStatus = await mongoDb.checkSystemCapacity();

    res.json({
      success: true,
      ...capacityStatus,
    });
  } catch (error) {
    console.error("Check capacity error:", error);
    res.status(500).json({ error: "Kapasite kontrolü sırasında hata oluştu" });
  }
};

// Batch Operations for Large Scale
export const batchProcessUsers: RequestHandler = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: "Güncelleme listesi gerekli" });
    }

    const results = await mongoDb.batchUpdateUsers(updates);
    const successCount = results.filter((r) => r).length;

    res.json({
      success: true,
      message: `${successCount}/${updates.length} kullanıcı başarıyla güncellendi`,
      results,
    });
  } catch (error) {
    console.error("Batch process users error:", error);
    res.status(500).json({ error: "Toplu işlem sırasında hata oluştu" });
  }
};

// User Product Purchases
export const getUserProductPurchases: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "Kullanıcı ID gerekli" });
    }

    const purchases = await mongoDb.getUserProductPurchases(userId);
    const products = await mongoDb.getAllProducts();

    // Enrich purchases with product details
    const enrichedPurchases = purchases.map(purchase => {
      const product = products.find(p => p.id === purchase.productId);
      return {
        ...purchase,
        product: product || null
      };
    });

    res.json({
      success: true,
      purchases: enrichedPurchases
    });
  } catch (error) {
    console.error("Get user product purchases error:", error);
    res.status(500).json({ error: "Ürün alışverişleri yüklenemedi" });
  }
};
