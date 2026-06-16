// ============================================================
//  AKN GROUP — MLM RULES (v2 — 10 Kariyer / Dinamik Fiyat)
// ============================================================

// ── Kariyer tipi ──────────────────────────────────────────
export type CareerLevel =
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

// Eski seviye adları geriye dönük uyumluluk için
export type LegacyCareerLevel = 'Emmare' | 'Levvame' | 'Raziye' | 'Mardiye' | 'Safiye';

// Geriye dönük uyumluluk: eski isimleri yeni isimlere eşle
export const LEGACY_CAREER_MAP: Record<string, CareerLevel> = {
  Emmare:    'Mülhime',
  Levvame:   'Mülhime',
  Raziye:    'Radiye',
  Mardiye:   'Mardiyye',
  Safiye:    'Safiyye',
};

// ── Genel sabitler ────────────────────────────────────────
export const BASE_EXCHANGE_RATE = 34.5;        // 1 USD ≈ 34.5 TL
export const ENTRY_PACKAGE_PRICE_TL = 3450;
export const ENTRY_PACKAGE_PRICE_USD = 100;
export const PV_PER_TL = 0.1;
export const BV_PER_TL = 0.029;

export const ACTIVE_FEES = {
  monthly: 1000,   // TL
  yearly:  10000,  // TL
};

// ── DİNAMİK KOMİSYON DAĞILIM ORANLARI (%100 = ürün fiyatı)
export const COMMISSION_RATES = {
  companyFund:     60,   // Sistem fonu — kullanıcı cüzdanına dağıtılmaz
  directSponsor:   25,   // Direkt sponsor primi
  unilevel:        10,   // 7 derinlik unilevel (aşağı toplamı = %10)
  monolinePool:     5,   // Monoline havuzu / liderlik bonusu
} as const;

// ── 7 Derinlik Unilevel oranları (toplam = %10) ──────────
export const UNILEVEL_RATES: Record<number, number> = {
  1: 3,    // L1 — %3
  2: 2,    // L2 — %2
  3: 1.5,  // L3 — %1.5
  4: 1.5,  // L4 — %1.5
  5: 1,    // L5 — %1
  6: 0.5,  // L6 — %0.5
  7: 0.5,  // L7 — %0.5
};

export const MAX_UNILEVEL_DEPTH = 7;

// ── 10 Kariyer seviyesi ve Monoline pasif gelir derinlik limitleri
export const CAREER_LEVELS_CONFIG: Array<{
  name: CareerLevel;
  displayName: string;
  order: number;
  monolineDepthLimit: number;        // Kaç sıra aşağıdan pasif gelir alabilir (∞ = 999999)
  requiredUSD: number;               // Gerekli toplam unilevel ekip cirosu (USD)
  requiredDirectReferrals: number;   // Direkt Referans Şartı (Aktif Üye)
  bonusPercent: number;
}> = [
  {
    name: 'Mülhime',      displayName: 'Nefs-i Mülhime',      order: 1,
    monolineDepthLimit: 10,
    requiredUSD: 500,        requiredDirectReferrals: 2,
    bonusPercent: 3,
  },
  {
    name: 'Mutmainne',    displayName: 'Nefs-i Mutmainne',    order: 2,
    monolineDepthLimit: 20,
    requiredUSD: 1500,       requiredDirectReferrals: 3,
    bonusPercent: 4,
  },
  {
    name: 'Radiye',       displayName: 'Nefs-i Radiye',       order: 3,
    monolineDepthLimit: 40,
    requiredUSD: 3500,       requiredDirectReferrals: 4,
    bonusPercent: 5,
  },
  {
    name: 'Mardiyye',     displayName: 'Nefs-i Mardiyye',     order: 4,
    monolineDepthLimit: 60,
    requiredUSD: 7500,       requiredDirectReferrals: 5,
    bonusPercent: 6,
  },
  {
    name: 'Safiyye',      displayName: 'Nefs-i Safiyye',      order: 5,
    monolineDepthLimit: 80,
    requiredUSD: 15000,      requiredDirectReferrals: 6,
    bonusPercent: 7,
  },
  {
    name: 'Mürşid',       displayName: 'Mürşid',               order: 6,
    monolineDepthLimit: 100,
    requiredUSD: 30000,      requiredDirectReferrals: 8,
    bonusPercent: 8,
  },
  {
    name: 'Pir',           displayName: 'Pir',                  order: 7,
    monolineDepthLimit: 150,
    requiredUSD: 60000,      requiredDirectReferrals: 10,
    bonusPercent: 10,
  },
  {
    name: 'Kutub',         displayName: 'Kutub',                order: 8,
    monolineDepthLimit: 200,
    requiredUSD: 120000,     requiredDirectReferrals: 12,
    bonusPercent: 12,
  },
  {
    name: 'Gavs',          displayName: 'Gavs',                 order: 9,
    monolineDepthLimit: 300,
    requiredUSD: 250000,     requiredDirectReferrals: 15,
    bonusPercent: 15,
  },
  {
    name: 'İnsan-ı Kamil', displayName: 'İnsan-ı Kamil',       order: 10,
    monolineDepthLimit: 999999, // Sonsuz
    requiredUSD: 500000,     requiredDirectReferrals: 20,
    bonusPercent: 20,
  },
];

// Kariyer adına göre config'i hızlı bulmak için lookup map
export const CAREER_CONFIG_MAP = Object.fromEntries(
  CAREER_LEVELS_CONFIG.map(c => [c.name, c])
) as Record<CareerLevel, typeof CAREER_LEVELS_CONFIG[0]>;

// Geriye dönük uyumluluk için Record tipi (eski kod careerLevels'ı kullanıyor)
export const careerLevels = CAREER_CONFIG_MAP;

// ── Kariyer tespiti ───────────────────────────────────────
export function getCareerLevel(user: {
  teamTurnoverUSD?: number;   // Toplam ekip cirosu (Unilevel)
  directReferrals?: number;   // Direkt Referans Sayısı
}): CareerLevel {
  const sorted = [...CAREER_LEVELS_CONFIG].sort((a, b) => b.order - a.order);

  for (const cfg of sorted) {
    if (
      (user.teamTurnoverUSD || 0) >= cfg.requiredUSD &&
      (user.directReferrals || 0) >= cfg.requiredDirectReferrals
    ) {
      return cfg.name;
    }
  }

  return 'Mülhime'; // Minimum kariyer
}

// ── Monoline derinlik limiti ──────────────────────────────
export function getMonolineDepthLimit(careerName: string): number {
  const normalized = LEGACY_CAREER_MAP[careerName] || careerName;
  return CAREER_CONFIG_MAP[normalized as CareerLevel]?.monolineDepthLimit ?? 10;
}

// ── Dinamik komisyon hesaplama (herhangi bir fiyat için) ──

/** Şirket fonu — loglanır, dağıtılmaz */
export function calculateCompanyFund(productPrice: number): number {
  return round2(productPrice * (COMMISSION_RATES.companyFund / 100));
}

/** Direkt sponsor primi — %25 */
export function calculateSponsorBonus(productPrice: number): number {
  return round2(productPrice * (COMMISSION_RATES.directSponsor / 100));
}

/** Belirli bir unilevel seviyesi için prim */
export function calculateUnilevelCommission(productPrice: number, level: number): number {
  const rate = UNILEVEL_RATES[level] ?? 0;
  return round2(productPrice * (rate / 100));
}

/** Monoline havuzu / liderlik bonusu — %5 */
export function calculateMonolinePoolContribution(productPrice: number): number {
  return round2(productPrice * (COMMISSION_RATES.monolinePool / 100));
}

/** Geriye dönük uyumluluk için — artık %25 */
export function calculatePassivePoolContribution(productPrice: number): number {
  return calculateSponsorBonus(productPrice);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Kariyer bazlı pasif oranları (monoline derinlik dışı) ─
export const passiveRates: Partial<Record<CareerLevel, number>> = {
  Mülhime:       0.5,
  Mutmainne:     1,
  Radiye:        1.5,
  Mardiyye:      2,
  Safiyye:       2.5,
  Mürşid:        3,
  Pir:           4,
  Kutub:         5,
  Gavs:          7,
  'İnsan-ı Kamil': 10,
};

export function calculatePassiveIncome(upline: { career: CareerLevel }, downlineInvestment: number): number {
  const rate = passiveRates[upline.career] ?? 0;
  return round2(downlineInvestment * (rate / 100));
}

// ── Yardımcı fonksiyonlar (eski arayüz uyumluluğu) ────────
export function isActiveMember(activeUntil: Date): boolean {
  return !!activeUntil && activeUntil > new Date();
}

export function calculateMonthlyActiveRequirement(): number {
  return ACTIVE_FEES.monthly;
}

export function calculateYearlyActiveRequirement(): number {
  return ACTIVE_FEES.yearly;
}

export function isQualifiedForPassiveIncome(careerLevel: CareerLevel): boolean {
  return (passiveRates[careerLevel] ?? 0) > 0;
}

export function calculateCommissionFromInvestment(investment: number, careerLevel: CareerLevel): number {
  const bonusPercent = CAREER_CONFIG_MAP[careerLevel]?.bonusPercent ?? 0;
  return round2(investment * (bonusPercent / 100));
}

export function getNextCareerLevelRequirements(currentLevel: CareerLevel): {
  requiredUSD: number;
  bonusPercent: number;
  requiredDirectReferrals: number;
} | null {
  const currentCfg = CAREER_CONFIG_MAP[currentLevel];
  if (!currentCfg) return null;
  const next = CAREER_LEVELS_CONFIG.find(c => c.order === currentCfg.order + 1);
  if (!next) return null;
  return {
    requiredUSD: next.requiredUSD,
    bonusPercent: next.bonusPercent,
    requiredDirectReferrals: next.requiredDirectReferrals,
  };
}

export function shouldUpdateCareerLevel(user: {
  teamTurnoverUSD?: number;
  directReferrals?: number;
  currentCareer: CareerLevel;
}): boolean {
  const newLevel = getCareerLevel({
    teamTurnoverUSD: user.teamTurnoverUSD || 0,
    directReferrals: user.directReferrals || 0,
  });
  return newLevel !== user.currentCareer;
}

// Eski CareerLevel tipi uyumluluğu için re-export
export type { CareerLevel as CareerLevelName };
export type { CareerLevel as CareerLevelType };
