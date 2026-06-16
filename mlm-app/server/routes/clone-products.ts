import express, { Router, Request, Response } from "express";
import { Product } from "../../shared/mlm-types";
import { mlmDb } from "../lib/mlm-database";
// Dynamic imports required for services to avoid circular dependencies if any, or just keeping pattern
// But we can import types normally.

const router = Router();

// Clone products sayfası verilerini getir
router.get("/:memberId", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;

    // Üye bilgilerini bul
    const member = await mlmDb.getUserByMemberId(memberId);
    if (!member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Admin tarafından eklenen aktif ürünleri getir
    const allProducts = await mlmDb.getAllProducts();
    const products: Product[] = (allProducts || []).filter((p: any) => p && p.isActive !== false);

    // Clone sayfa istatistiklerini getir
    // Not: Gerçek istatistikler veritabanından çekilebilir, şimdilik basit tutuyoruz
    const cloneStats = {
      visits: 0, // Implement real visit tracking if needed
      purchases: 0,
      totalCommissions: 0,
    };

    res.json({
      member: {
        id: member.id,
        memberId: member.memberId,
        fullName: member.fullName,
        referralCode: member.referralCode,
        careerLevel: member.careerLevel,
      },
      products,
      cloneStats,
    });

  } catch (error) {
    console.error("Error fetching clone product data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Clone sayfa ziyareti kaydet
router.post("/:memberId/visit", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    // Buraya gerçek ziyaret kaydı eklenebilir (LowDb clonePages veya Redis)
    console.log(`Clone page visit tracked for member: ${memberId}`);
    res.json({ success: true, message: "Visit tracked" });
  } catch (error) {
    console.error("Error tracking visit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Clone sayfa üzerinden ürün satın alma
router.post("/purchase", async (req: Request, res: Response) => {
  try {
    const {
      productId,
      buyerEmail,
      referralCode,
      sponsorId,
      purchaseAmount,
      shippingAddress,
      // cloneCommissionRate, // Use backend logic, trust source less
    } = req.body;

    // 1. Validate Product
    const product = await mlmDb.getProductById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // 2. Validate Sponsor/Seller
    const sponsor = await mlmDb.getUserById(sponsorId);
    if (!sponsor) return res.status(404).json({ error: "Sponsor not found" });

    // 3. Create Purchase Record (Pending)
    const result = await mlmDb.createProductPurchase({
      productId,
      buyerId: "guest", // Or create a temp user logic if needed
      buyerEmail,
      referralCode: sponsor.referralCode,
      shippingAddress,
      paymentMethod: "credit_card"
    });

    if (!result.success) return res.status(400).json(result);

    const amount = Number(purchaseAmount) || product.price;

    // 4. Distribute Commissions & Points
    // Important: For "guest" purchases, the sponsor usually gets the 'Personal Volume' points 
    // OR we treat it as a direct sale commission.

    // A. Direct Commission (Clone Page Owner Reward)
    const commissionRate = 0.25; // 25% Standard Clone Page Commission
    const commissionAmount = amount * commissionRate;

    // We use a specialized service to apply wallet transactions safely
    const { applyWalletTransactions } = await import('../lib/wallet-transaction.service');
    
    await applyWalletTransactions([{
      userId: sponsor.id,
      amount: commissionAmount,
      type: 'SPONSOR',
      reference: `CLONE-${result.purchase?.id || Date.now()}`,
      description: `Clone Mağaza Satış Komisyonu (%25) - ${product.name}`
    } as any]);

    // B. Monoline Global Distribution
    try {
      const { MonolineCommissionService } = await import('../lib/monoline-commission-service');
      const saleRef = `SALE-${result.purchase?.id || Date.now()}`;
      
      // Calculate and distribute Monoline commissions
      const commissionResult = await MonolineCommissionService.calculateMonolineCommissions(
        sponsor.id,
        amount,
        saleRef
      );

      // Distributions
      if (commissionResult.transactions.length > 0) {
        const walletTxs = commissionResult.transactions.map(t => ({
          userId: t.userId,
          amount: t.amount,
          type: 'CAREER',
          reference: t.reference || `${saleRef}-${t.userId}`,
          description: t.description || `Ürün satış network komisyonu`
        }));
        await applyWalletTransactions(walletTxs as any);
      }

      // System Pool & Company Fund
      if (commissionResult.passivePoolAmount > 0 || commissionResult.companyFundAmount > 0) {
        await MonolineCommissionService.addToSystemPools(
          commissionResult.passivePoolAmount,
          commissionResult.companyFundAmount,
          saleRef
        );
      }
    } catch (monolineErr) {
      console.error("Monoline distribution failed for product sale:", monolineErr);
    }

    // C. Points & Career (Sponsor gets points for selling)
    try {
      const PointsCareerService = (await import('../lib/points-career-service')).default;
      const allUsers = await mlmDb.getAllUsers();

      // Award turnover points
      const pointResult = await PointsCareerService.awardSalePoints(
        sponsor.id,
        amount,
        'product',
        allUsers as any
      );

      // Persist updated users (turnover/career changes)
      for (const updatedUser of pointResult.updatedUsers) {
        const originalUser = allUsers.find(u => u.id === updatedUser.id);
        if (!originalUser) continue;

        const turnoverChanged = updatedUser.teamTurnoverUSD !== originalUser.teamTurnoverUSD;
        const careerChanged = JSON.stringify(updatedUser.careerLevel) !== JSON.stringify(originalUser.careerLevel);

        if (turnoverChanged || careerChanged) {
          await mlmDb.updateUser(updatedUser.id, {
            teamTurnoverUSD: updatedUser.teamTurnoverUSD,
            careerLevel: updatedUser.careerLevel,
            pointsSystem: updatedUser.pointsSystem
          });
        }
      }
    } catch (e) {
      console.error("Points distribution failed:", e);
    }

    // Sipariş başarılı response
    res.json({
      success: true,
      message: "Purchase completed successfully",
      commission: {
        sponsorId,
        amount: commissionAmount,
        rate: commissionRate,
      },
    });

  } catch (error) {
    console.error("Error processing purchase:", error);
    res.status(500).json({ error: "Purchase failed" });
  }
});

// Üyenin clone sayfa istatistiklerini getir
router.get("/:memberId/stats", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const user = await mlmDb.getUserByMemberId(memberId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const stats = await mlmDb.getProductSalesStats(user.id); // Assuming we implement a user filter
    // If not implemented, return mock or aggregated

    // Quick implementation for now using transaction history + purchases
    const purchases = await mlmDb.getUserProductPurchases(user.id);

    res.json({
      totalVisits: 0,
      totalPurchases: purchases.length,
      totalCommissions: user.wallet.totalEarnings // Rough estimate, ideally filter by type 'commission'
    });

  } catch (error) {
    console.error("Error fetching clone stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
