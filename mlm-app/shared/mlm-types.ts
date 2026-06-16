export type CareerLevelName =
  | 'Mülhime'
  | 'Mutmainne'
  | 'Radiye'
  | 'Mardiyye'
  | 'Safiyye'
  | 'Mürşid'
  | 'Pir'
  | 'Kutub'
  | 'Gavs'
  | 'İnsan-ı Kamil';

export interface CareerLevel {
  id: string;
  name: CareerLevelName;
  displayName: string;
  description: string;
  minInvestment: number;
  minDirectReferrals: number;
  personalSalesPoints: number;
  teamSalesPoints: number;
  commissionRate: number;
  order: number;
  isActive: boolean;
  level: number;
  passiveIncomeRate: number;
  bonus: number;
  requirements: {
    personalSalesPoints: number;
    teamSalesPoints: number;
    directReferrals: number;
    minimumMonthlyPoints: number;
  };
  benefits: {
    directSalesCommission: number;
    teamBonusRate: number;
    monthlyBonus: number;
    rankBonus: number;
  };
}

export interface PointsSystem {
  personalSalesPoints: number;
  teamSalesPoints: number;
  directReferrals: number;
  minimumMonthlyPoints: number;
  registrationPoints: number;
  totalPoints: number;
  monthlyPoints: number;
  lastPointUpdate?: Date;
}

export interface Wallet {
  balance: number;
  totalEarnings: number;
  sponsorBonus: number;
  careerBonus: number;
  passiveIncome: number;
  leadershipBonus: number;
}

export type WalletTxType = 'deposit' | 'withdrawal' | 'transfer' | 'commission' | 'bonus' | 'fee' | 'refund';

export interface User {
  id: string;
  name: string;
  fullName: string;
  email: string;
  password: string;
  referralCode: string;
  sponsorId?: string;
  isActive: boolean;

  // Standard membership field
  membershipType: string;

  // Extended fields for compatibility
  phone: string;
  role: string;
  membershipStartDate?: Date;
  registrationDate?: Date;

  // Deprecated: use membershipType instead
  package?: string;
  pointsSystem: PointsSystem;
  careerLevel: CareerLevel;
  cloneStoreEnabled?: boolean;
  cloneStoreName?: string;
  cloneStoreDescription?: string;
  cloneStoreTheme?: string;
  daysSinceLastActivity?: number;
  wallet: Wallet;
  kycStatus?: string;
  twoFactorEnabled?: boolean;
  memberId?: string;
  lastActivityDate?: Date;
  monthlyActivityStreak?: number;
  yearlyRenewalDate?: Date;
  nextRenewalWarning?: Date;
  monthlyActivityStatus?: string;
  totalInvestment: number;
  directReferrals: number;
  totalTeamSize: number;
  monthlySalesVolume?: number;
  annualSalesVolume?: number;
  lastLoginDate?: Date;
  lastPaymentDate?: Date;
  receiptFile?: string;
  receiptUploadedAt?: Date;
  receiptVerified?: boolean;
  membershipEndDate?: Date;
  previousUserId?: string;
  globalRank?: number;
  stripeAccountId?: string;
  stripeOnboardingComplete?: boolean;
  leftChild?: string;
  rightChild?: string;
}

export interface MembershipPackage {
  id: string;
  name: string;
  price: number;
  description: string;
  duration: number;
  durationDays: number;
  type: string;
  features?: string[];
  currency: string;
  bonusPercentage: number;
  commissionRate: number;
}

export interface Transaction {
    id: string;
    userId: string;
    type: string;
    amount: number;
    description: string;
    status: string;
    date: Date;
    referenceId?: string;
}

export interface PendingPlacement {
  id: string;
  sponsorId: string;
  newUserId: string;
  registrationDate: Date | string;
  status: 'pending' | 'placed' | 'expired';
  newUserData: {
    fullName: string;
    email: string;
    phone?: string;
    membershipType?: string;
  };
  updatedAt?: Date | string;
}

// Monoline types
export interface MonolineCommissionStructure {
  productPrice: number;
  directSponsorBonus: { percentage: number; amount: number };
  depthCommissions: {
    level1: { percentage: number; amount: number };
    level2: { percentage: number; amount: number };
    level3: { percentage: number; amount: number };
    level4: { percentage: number; amount: number };
    level5: { percentage: number; amount: number };
    level6: { percentage: number; amount: number };
    level7: { percentage: number; amount: number };
    totalPercentage: number;
    totalAmount: number;
  };
  passiveIncomePool: { percentage: number; amount: number; distribution: string };
  companyFund: { percentage: number; amount: number };
}

export interface MonolineMLMSettings {
  isEnabled: boolean;
  productPrice: number;
  commissionStructure: MonolineCommissionStructure;
  membershipRequirements: any;
  passiveIncomeSettings: any;
  activityRequirements: any;
  levelRequirements: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MonolineCommissionTransaction {
  id?: string;
  userId: string;
  amount: number;
  type: string;
  reference?: string;
  description?: string;
  recipientId?: string;
  createdAt: Date;
  status?: 'pending' | 'processed' | 'inactive' | 'failed';
  processedAt?: Date;
  saleId?: string;
  commissionType?: string;
  level?: number;
}

export interface PassiveIncomeDistribution {
    id: string;
    totalPool: number;
    activeMembers: number;
    amountPerMember: number;
    distributionDate: Date;
    recipients: any[];
    method?: 'equal' | 'weighted_by_career' | 'weighted_by_activity';
}

export const MEMBERSHIP_PACKAGES: MembershipPackage[] = [
  {
    id: "entry",
    name: "Nefis Mertebesi Katılım Paketi",
    price: 100,
    description: "Sisteme giriş ve tek hat (monoline) pozisyonu",
    duration: 0,
    durationDays: 0,
    type: "entry",
    currency: "USD",
    bonusPercentage: 0,
    commissionRate: 0
  },
  {
    id: "monthly",
    name: "Aylık Aktivasyon",
    price: 20,
    description: "Sürekli kazanç için aylık aktivasyon",
    duration: 30,
    durationDays: 30,
    type: "monthly",
    currency: "USD",
    bonusPercentage: 0,
    commissionRate: 0
  },
  {
    id: "yearly",
    name: "Yıllık Premium Aktivasyon",
    price: 200,
    description: "1 yıllık tam aktivasyon ve avantajlı paket",
    duration: 365,
    durationDays: 365,
    type: "yearly",
    currency: "USD",
    bonusPercentage: 0,
    commissionRate: 0
  }
];

export function getCareerLevel(input: number | { totalInvestment?: number; teamTurnoverUSD?: number; teamSize?: number; directReferrals?: number }): CareerLevel {
  const teamTurnoverUSD = typeof input === 'number' ? input : input.teamTurnoverUSD || input.totalInvestment || 0;
  const directReferrals = typeof input === 'number' ? 0 : input.directReferrals || 0;

  let levelName: CareerLevelName = 'Mülhime';
  let level = 1;

  if (teamTurnoverUSD >= 500000 && directReferrals >= 20) {
    levelName = 'İnsan-ı Kamil';
    level = 10;
  } else if (teamTurnoverUSD >= 250000 && directReferrals >= 15) {
    levelName = 'Gavs';
    level = 9;
  } else if (teamTurnoverUSD >= 120000 && directReferrals >= 12) {
    levelName = 'Kutub';
    level = 8;
  } else if (teamTurnoverUSD >= 60000 && directReferrals >= 10) {
    levelName = 'Pir';
    level = 7;
  } else if (teamTurnoverUSD >= 30000 && directReferrals >= 8) {
    levelName = 'Mürşid';
    level = 6;
  } else if (teamTurnoverUSD >= 15000 && directReferrals >= 6) {
    levelName = 'Safiyye';
    level = 5;
  } else if (teamTurnoverUSD >= 7500 && directReferrals >= 5) {
    levelName = 'Mardiyye';
    level = 4;
  } else if (teamTurnoverUSD >= 3500 && directReferrals >= 4) {
    levelName = 'Radiye';
    level = 3;
  } else if (teamTurnoverUSD >= 1500 && directReferrals >= 3) {
    levelName = 'Mutmainne';
    level = 2;
  } else if (teamTurnoverUSD >= 500 && directReferrals >= 2) {
    levelName = 'Mülhime';
    level = 1;
  }

  const normalizedName = levelName;
  const commissionRates: Record<CareerLevelName, number> = {
    'Mülhime': 3,
    'Mutmainne': 4,
    'Radiye': 5,
    'Mardiyye': 6,
    'Safiyye': 7,
    'Mürşid': 8,
    'Pir': 10,
    'Kutub': 12,
    'Gavs': 15,
    'İnsan-ı Kamil': 20
  };

  const monolineDepths: Record<CareerLevelName, number> = {
    'Mülhime': 10,
    'Mutmainne': 20,
    'Radiye': 40,
    'Mardiyye': 60,
    'Safiyye': 80,
    'Mürşid': 100,
    'Pir': 150,
    'Kutub': 200,
    'Gavs': 300,
    'İnsan-ı Kamil': 999999
  };

  return {
    id: String(level),
    name: normalizedName,
    displayName: normalizedName,
    description: `${normalizedName} mertebesi`,
    minInvestment: 100, 
    minDirectReferrals: directReferrals,
    personalSalesPoints: teamTurnoverUSD,
    teamSalesPoints: teamTurnoverUSD,
    commissionRate: commissionRates[normalizedName],
    order: level,
    isActive: true,
    level,
    passiveIncomeRate: level, // This might be used elsewhere
    bonus: 0,
    requirements: {
      personalSalesPoints: 0,
      teamSalesPoints: 0,
      directReferrals: 0,
      minimumMonthlyPoints: 0,
    },
    benefits: {
      directSalesCommission: commissionRates[normalizedName],
      teamBonusRate: 0,
      monthlyBonus: 0,
      rankBonus: 0,
    },
  };
}

export type Role = 'admin' | 'member' | 'leader' | 'visitor' | 'user';

export interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  originalPrice?: number;
  category?: string;
  rating?: number;
  reviews?: number;
  inStock?: boolean;
}

export interface ProductPurchase {
  id: string;
  productId: string;
  userId?: string;
  buyerId?: string;
  buyerEmail?: string;
  amount: number;
  purchaseAmount?: number;
  referralCode?: string;
  sponsorId?: string;
  status?: string;
  paymentMethod?: string;
  shippingAddress?: ShippingAddress | any;
  purchaseDate?: Date;
  commissionDistributed?: boolean;
}

export interface ShippingAddress {
  fullName: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  addressType?: 'home' | 'work' | 'other';
}

export interface ProductCommission {
  id: string;
  purchaseId: string;
  amount: number;
  recipientId: string;
}

export interface LiveBroadcast {
  id: string;
  title: string;
  startAt?: Date;
  endAt?: Date | null;
  endTime?: Date | null;
  isActive?: boolean;
  status?: 'active' | 'inactive' | 'scheduled';
  streamUrl?: string;
  adminId?: string;
  startTime?: Date;
  description?: string;
  platform?: string;
  viewerCount?: number;
  createdAt?: Date;
  lastUpdated?: Date;
}

export type CurrencyType = 'TRY' | 'USD' | 'EUR' | 'BTC' | 'ETH';
export type WalletTransactionType = 'deposit' | 'withdrawal' | 'commission' | 'transfer';
export type PaymentMethodType = 'bank' | 'crypto' | 'pos' | 'manual';

// small helper exported to satisfy some imports; real implementation belongs to service layer
export function calculateCommissions(amount: number) {
  return { total: amount, breakdown: [] };
}
