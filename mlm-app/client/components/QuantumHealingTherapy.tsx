import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

export default function QuantumHealingTherapy() {
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center">

      {/* ── DISCLAIMER MODAL ── */}
      <AnimatePresence>
        {showDisclaimer && !accepted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Yasal Uyarı & Sorumluluk Reddi</h3>
                  <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-wider">Lütfen okuyun ve onaylayın</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Bu uygulama <strong>tıbbi bir tanı veya tedavi aracı değildir.</strong> Sunulan içerik manevi rehberlik,
                spiritüel farkındalık ve kişisel gelişim amacıyla tasarlanmış sembolik bir platformdur.
                Frekans analizi simülasyon esaslıdır; gerçek biyometrik ölçüm içermez.
                Sağlık sorunlarınız için mutlaka bir doktora danışın.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowDisclaimer(false)}
                  variant="outline"
                  className="flex-1 rounded-xl"
                >
                  İptal
                </Button>
                <Button
                  onClick={() => { setShowDisclaimer(false); setAccepted(true); }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white"
                >
                  Anladım, Devam Et
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PLACEHOLDER — yeni uygulama buraya entegre edilecek ── */}
      {accepted && (
        <div className="text-center text-slate-400 py-24">
          {/* İçerik yakında */}
        </div>
      )}

      {/* İptal edildiğinde tekrar aç butonu */}
      {!showDisclaimer && !accepted && (
        <div className="text-center space-y-4">
          <p className="text-slate-500 text-sm">Devam etmek için uyarıyı onaylayın.</p>
          <Button
            onClick={() => setShowDisclaimer(true)}
            className="bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded-xl px-8"
          >
            Tekrar Göster
          </Button>
        </div>
      )}

    </div>
  );
}
