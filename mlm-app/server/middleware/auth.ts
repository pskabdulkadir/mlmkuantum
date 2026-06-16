import { Request, Response, NextFunction } from "express";
import { mongoDb } from "../lib/mongo-database";
import { verifyAccessToken } from "../lib/utils";

export const requireAuth = async (req: any, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: "Yetkilendirme başlığı gereklidir.",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Token gereklidir.",
      });
    }

    const decoded: any = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        error: "Geçersiz veya süresi dolmuş token.",
      });
    }

    const user = await mongoDb.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Geçersiz kullanıcı.",
      });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Geçersiz token.",
    });
  }
};

export const requireAdmin = async (req: any, res: Response, next: NextFunction) => {
  await requireAuth(req, res, () => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Bu işlem için admin yetkileri gereklidir.",
      });
    }
    next();
  });
};
