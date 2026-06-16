import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, Download, X, ChevronDown, ChevronUp } from "lucide-react";

const sections = [
  {
    id: "giris",
    title: "1. Sisteme Giriş & Kayıt",
    icon: "🚀",
    content: `
AKN Group MLM sistemine kayıt olmak için aşağıdaki adımları izleyin:

📌 KAYIT ADIMLARI:
• Sponsorunuzun klon sayfasına gidin: yourdomain.com/clone/SPONSOR_ID
• "Üye Ol" butonuna tıklayın
• Ad-soyad, e-posta, telefon ve şifrenizi girin
• Kayıt tamamlandığında sisteme "Mülhime" kariyer seviyesiyle giriş yapmış olursunuz
• Otomatik olarak bir klon sayfa oluşturulur: yourdomain.com/clone/SİZİN_ÜYE_ID

📋 ÜYE PANELİ'ne erişim:
• Sağ üst köşeden "Giriş Yap" → E-posta ve şifrenizi girin
• Otomatik olarak Üye Paneline yönlendirilirsiniz

💡 ÖNEMLİ: Sisteme kayıt olmak sizi "Mülhime" seviyesiyle başlatır. Komisyon kazanmaya hemen başlayabilirsiniz!
    `,
  },
  {
    id: "aktivasyon",
    title: "2. Üyelik Aktivasyonu",
    icon: "✅",
    content: `
Komisyon kazanmak için üyeliğinizi aktif etmeniz gerekir.

💳 AKTİVASYON SEÇENEKLERİ:
• Giriş Paketi: $100 (Tek seferlik — Monoline pozisyonu + klon sayfa + tüm komisyon hakları)
• Aylık Aktivasyon: $20/ay
• Yıllık Premium: $200/yıl (%5 ekstra havuz bonusu)

📄 DEKONT YÜKLEMELİ AKTİVASYON:
1. Üye Paneli → "📄 Dekont" sekmesine gidin
2. Banka hesabına ödeme yapın (TRY/USD/EUR/BTC)
3. Dekontu yükleyin → Admin onayladığında aktivasyon gerçekleşir

🏦 BANKA HESAPLARI:
• TRY: QNB Finans Bank — IBAN: TR86 0011 1000 0000 0091 7751 22
• USD: Silicon Valley Bank — IBAN: US64 SVBK US6S 3300 9673 8637
• EUR: Commerzbank AG — IBAN: DE89 3704 0044 0532 0130 00
• BTC: Bitcoin adresini admin panelinden öğrenin

✅ Aktif üyeler tüm komisyon, bonus ve pasif gelir haklarına sahip olur.
    `,
  },
  {
    id: "kariyer",
    title: "3. Kariyer Seviyeleri (10 Basamak)",
    icon: "🏆",
    content: `
AKN Group, manevi değerlere dayalı 10 kariyer seviyesine sahiptir.

🌟 KARİYER SEVİYELERİ VE GEREKSİNİMLER:

1️⃣  Mülhime (Başlangıç) — Tüm yeni üyeler bu seviyeden başlar
2️⃣  Levvame — Ekip cirosu büyüdükçe otomatik yükselme
3️⃣  Mülheme — Daha fazla direktüye ve ciro hedefi
4️⃣  Mutmaine — Orta seviye liderlik
5️⃣  Radiye — Güçlü ekip ve yüksek ciro
6️⃣  Mardiye — Üst liderlik kademesi
7️⃣  Kâmile — Deneyimli lider
8️⃣  Münevvere — Seçkin lider
9️⃣  Vâsıla — Zirveye yakın
🔟 İnsan-ı Kamil — En yüksek kariyer seviyesi

📊 KARİYER YÜKSELTME KRİTERLERİ:
• Ekip cirosu (teamTurnoverUSD) belirleyici faktördür
• Direkt sponsor sayısı önemlidir
• Her satın alma işlemi sonrası otomatik kontrol yapılır
• Kariyer seviyeniz Üye Paneli → Dashboard'da görünür

🎯 HEDEF: İnsan-ı Kamil seviyesine ulaşmak için güçlü bir ekip kurmalı ve sürdürülebilir ciro yaratmalısınız.
    `,
  },
  {
    id: "komisyon",
    title: "4. Komisyon & Kazanç Sistemi",
    icon: "💰",
    content: `
Her ürün satışından ($100 baz fiyat) aşağıdaki dağılım yapılır:

💵 GELİR DAĞILIMI ($100 üzerinden):
• %60 → Şirket Fonu (işletme giderleri)
• %25 → Direkt Sponsor Bonusu ($25)
• %10 → Unilevel (7 seviye derinlik) ($10)
• %5  → Monoline Pasif Gelir Havuzu ($5)

🔗 UNİLEVEL KOMİSYON ORANLARI (7 Seviye):
• Seviye 1: %3 → $3.00
• Seviye 2: %2 → $2.00
• Seviye 3: %1.5 → $1.50
• Seviye 4: %1.5 → $1.50
• Seviye 5: %1 → $1.00
• Seviye 6: %0.5 → $0.50
• Seviye 7: %0.5 → $0.50

💎 KOMİSYON TÜRLERİ:
• Sponsor Bonusu: Direkt altınızdan yapılan satışın %25'i
• Kariyer Bonusu: Ekibinizin derinliklerinden komisyon
• Pasif Gelir: Monoline havuzundan paylaştırılan gelir
• Liderlik Bonusu: Üst kariyer seviyelerine özgü ekstra bonus

📌 KOMİSYON KURALları:
• Aktif üye olmanız gerekir (pasif üyeler komisyon alamaz)
• Komisyonlar anında cüzdanınıza eklenir
• Kazançlarınızı Üye Paneli → Kazançlar sekmesinden görün
    `,
  },
  {
    id: "monoline",
    title: "5. Monoline (Tek Hat) Sistemi",
    icon: "🌳",
    content: `
Monoline sistemi, tüm üyelerin tek bir sıra halinde sıralandığı benzersiz bir ağ yapısıdır.

🔗 MONOLİNE NASIL ÇALIŞIR?
• Sisteme katılan her üye, mevcut son üyenin altına yerleşir
• Sistem tamamen otomatik ve şeffaftır
• Kim önce girerse önce yerleşir — sıraya göre avantaj

📊 MONOLİNE AVANTAJLARI:
• Sponsorunuzdan bağımsız gelir fırsatı
• Havuz geliri: Her satışın %5'i tüm ağa dağıtılır
• Derinlik komisyonları: Altınızdakilerin satışlarından kazanırsınız

💡 MONOLİNE POZİSYONUNUZ:
• Üye Paneli → "🌳 Monoline Hattım" sekmesini açın
• Ağaç görünümünde pozisyonunuzu ve ekibinizi görün
• Kaç kişinin sizin altınızda olduğunu takip edin

🎯 STRATEJİ:
• Erkenden katılanlar daha iyi pozisyon alır
• Aktif pazarlama yaparak üst sıraya çıkabilirsiniz
• Sponsorunuzun altındaki herkes sizin dolaylı gelirinizi artırır
    `,
  },
  {
    id: "uye-paneli",
    title: "6. Üye Paneli — Tüm Sekmeler",
    icon: "📱",
    content: `
Üye Panelindeki tüm sekme ve butonların açıklaması:

🏠 DASHBOARD:
• Kazanç özeti (Sponsor, Kariyer, Pasif, Liderlik bonusları)
• Hızlı paylaşım linki (WhatsApp, E-posta, Kopyala, QR Kod)
• Son eklenen ekip üyeleri

📄 DEKONT:
• Ödeme dekontu yükleme
• Üyelik aktivasyon talebi gönderme

👥 EKİBİM:
• Direkt referanslarınızın listesi
• Her üyenin seviyesi, yatırımı ve durumu

🌳 MONOLİNE HATTIM:
• Ağ ağacı görsel harita
• Pozisyonunuz ve altınızdaki üyeler

📍 YERLEŞTİRME:
• Yeni üyeleri belirli pozisyonlara yerleştirme

🔗 PAYLAŞIM:
• WhatsApp ile referans linki paylaşımı
• QR kod oluşturma
• Sosyal medya paylaşım seçenekleri

➕ YENİ ÜYE KAYDI:
• Üyeleri direkt kayıt ettirme formu
• Kendi sponsorluğunuzla yeni üye ekleme

🛍️ ÜRÜN MAĞAZAM:
• Kişisel klon mağaza linki
• Ziyaret, satış ve komisyon istatistikleri

💰 KAZANÇLAR:
• Detaylı bonus dökümanı
• Sponsor, Kariyer, Pasif, Liderlik gelir geçmişi

📊 İŞLEMLER:
• Tüm finansal hareket geçmişi
• Cüzdan bakiyesi detayı

📁 DÖKÜMANLAR:
• Admin tarafından paylaşılan sistem dosyaları
• Eğitim materyalleri

👤 PROFİL:
• Kişisel bilgi güncelleme
• Şifre değiştirme

🕌 MANEVİ PANEL:
• Hatim takibi, günün hadisi, nefis analizi

✨ ZAHİRİ PANEL:
• Hızlı arınma, manevi korumalar, ilham verici sözler

💎 BATINİ PANEL:
• İlm-i Ledün dersleri, rüya analizi

🎥 EĞİTİMLER:
• Canlı Zoom eğitim oturumları
• Yaklaşan etkinlik bildirimleri
    `,
  },
  {
    id: "kazanc",
    title: "7. Kazanç Hesaplama Örnekleri",
    icon: "📊",
    content: `
Gerçek senaryolarla kazanç hesaplama örnekleri:

📌 ÖRNEK 1 — Yeni Üye ($100 ürün satışı):
• Siz (sponsor): $25.00 direkt komisyon
• Üst sponsorunuz (L1): $3.00
• Üst üst sponsorunuz (L2): $2.00
• Diğer üst seviyeler: kademeli azalan komisyon

📌 ÖRNEK 2 — Ayda 10 Direkt Satış:
• 10 × $25 = $250 direkt sponsor komisyonu
• Unilevel derinlik komisyonları ek gelir
• Monoline havuz payı ayrıca eklenir

📌 ÖRNEK 3 — Güçlü Ekip (100 Aktif Üye):
• Ekibiniz ayda 100 satış yaparsa:
• Unilevel L1'den: 100 × $3 = $300
• Unilevel L2'den: Ekip derinliğine göre değişir
• Monoline havuz: Toplam satışların %5'inden pay

📌 ÖRNEK 4 — İnsan-ı Kamil Hedefi:
• Güçlü bir ekip: 1000+ aktif üye
• Aylık ekip cirosu: $50,000+
• Liderlik bonusu: Ek gelir kapısı

🧮 HESAP MAKİNESİ:
• Üye Paneli'nde "Hesaplayıcı" aracını kullanın
• Farklı senaryoları simüle edin

💡 İPUCU: En büyük kazanç, ekibinizin ekibinin satışlarından (derinlik komisyonları) gelir!
    `,
  },
  {
    id: "clone",
    title: "8. Klon Sayfa Yönetimi",
    icon: "🔗",
    content: `
Her üyenin kendine özel bir pazarlama sayfası (klon sayfa) bulunur.

🌐 KLON SAYFANIZ:
• URL: yourdomain.com/clone/ÜYE_ID (örn: /clone/ak000001)
• Bu linki paylaşarak yeni üye kazanabilirsiniz
• Ziyaretçiler direkt sizin sponsorluğunuzla kayıt olur

📲 KLON SAYFA'YI PAYLAŞMA:
• Üye Paneli → "Paylaşım" sekmesi
• WhatsApp: Otomatik mesaj şablonu
• E-posta: Hazır davet metni
• QR Kod: Yüz yüze paylaşım için

🛍️ KLON MAĞAZA:
• Ürün Mağazam sekmesinden klon mağaza linkini alın
• Ziyaretçiler satın aldığında komisyon kazanırsınız
• Mağaza linki: yourdomain.com/clone-products/ÜYE_ID

📊 KLON SAYFA İSTATİSTİKLERİ:
• Toplam ziyaret sayısı
• Dönüşüm oranı
• Klon üzerinden yapılan satışlar

✅ İPUCU: Klon sayfanızı sosyal medyada, WhatsApp gruplarında ve e-posta imzanızda kullanın!
    `,
  },
  {
    id: "cuzdanim",
    title: "9. Cüzdan & Çekim İşlemleri",
    icon: "💳",
    content: `
Kazandığınız tüm komisyonlar sistem cüzdanınıza eklenir.

💰 CÜZDAN DURUMU:
• Üye Paneli → Dashboard'da anlık bakiyenizi görün
• İşlemler sekmesinde tüm hareketleri takip edin

💵 CÜZDAN KALEMLERI:
• Sponsor Bonusu: Direkt referans satışlarından
• Kariyer Bonusu: Ekip derinlik komisyonları
• Pasif Gelir: Monoline havuz payı
• Liderlik Bonusu: Üst kariyer avantajı

🏧 ÇEKİM TALEBİ:
1. Üye Paneli → "İşlemler" sekmesine gidin
2. "Çekim Talebi" butonuna tıklayın
3. Miktar ve ödeme yönteminizi seçin
4. Admin onayladıktan sonra ödeme yapılır

📋 ÖDEME YÖNTEMLERİ:
• Banka havalesi (TRY/USD/EUR)
• Bitcoin (BTC)

⏱️ ÇEKIM SÜRESİ:
• Onaylı çekimler 1-3 iş günü içinde ödenir
• Çekim talebinizi admin panelinden takip edebilirsiniz

🔒 GÜVENLİK: Tüm finansal işlemler şifrelenmiş ve güvende tutulur.
    `,
  },
  {
    id: "iletisim",
    title: "10. Destek & İletişim",
    icon: "📞",
    content: `
Herhangi bir konuda destek almak için aşağıdaki kanalları kullanabilirsiniz:

👤 ADMİN İLETİŞİM:
• Admin: Abdulkadir Kan
• E-posta: psikologabdulkadirkan@gmail.com
• Üye ID: ak000001

📱 DESTEK KANALLARI:
• WhatsApp: Klon sayfasındaki iletişim butonu
• E-posta: Sistem üzerinden mesaj
• Üye Paneli → Profil sekmesinden mesaj

🆘 SIK KARŞILAŞILAN SORUNLAR:
• Giriş yapamıyorum → Şifre sıfırlama talebi gönderin
• Komisyon görünmüyor → Aktif üyelik durumunuzu kontrol edin
• Klon sayfa açılmıyor → Admin ile iletişime geçin
• Ödeme onaylanmadı → Dekontu tekrar yükleyin

📚 EĞİTİM KAYNAKLARI:
• Üye Paneli → "🎥 Eğitimler" sekmesinde canlı eğitimler
• "📁 Dökümanlar" sekmesinde sistem materyalleri
• "Sistem Sunumu" modal'ından kapsamlı anlatım

✅ HATIRLATMA: Herhangi bir sorunuzda önce FAQ ve dökümanlara bakın, ardından admin ile iletişime geçin.
    `,
  },
];

interface UserGuideModalProps {
  trigger?: React.ReactNode;
}

export function UserGuideModal({ trigger }: UserGuideModalProps) {
  const [open, setOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    giris: true,
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    sections.forEach((s) => (all[s.id] = true));
    setOpenSections(all);
  };

  const handlePrint = () => {
    expandAll();
    setTimeout(() => window.print(), 300);
  };

  const handleDownload = () => {
    expandAll();
    setTimeout(() => {
      const content = document.getElementById("guide-content");
      if (!content) return;

      const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>AKN Group — Kullanma Kılavuzu</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #1a1a1a; margin: 20px; }
  h1 { color: #7c3aed; border-bottom: 3px solid #7c3aed; padding-bottom: 8px; }
  h2 { color: #5b21b6; margin-top: 24px; font-size: 16px; border-left: 4px solid #7c3aed; padding-left: 10px; }
  pre, p { white-space: pre-wrap; word-break: break-word; }
  .section { page-break-inside: avoid; margin-bottom: 20px; }
  @media print { body { margin: 10px; } h1 { font-size: 18px; } }
</style>
</head>
<body>
<h1>🌟 AKN Group MLM Sistemi — Kullanma Kılavuzu</h1>
<p><strong>Tarih:</strong> ${new Date().toLocaleDateString("tr-TR")}</p>
${sections
  .map(
    (s) => `
<div class="section">
  <h2>${s.icon} ${s.title}</h2>
  <pre>${s.content.trim()}</pre>
</div>`
  )
  .join("\n")}
</body>
</html>`;

      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "AKN_Group_Kullanma_Kilavuzu.html";
      a.click();
      URL.revokeObjectURL(url);
    }, 350);
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #guide-print-area, #guide-print-area * { visibility: visible !important; }
          #guide-print-area { position: fixed; top: 0; left: 0; width: 100%; padding: 20px; background: white; }
          .no-print { display: none !important; }
        }
      `}</style>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-800 font-semibold"
            >
              <BookOpen className="w-4 h-4" />
              Kullanma Kılavuzu
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 bg-gradient-to-r from-purple-700 to-indigo-700 p-6 text-white no-print rounded-t-lg">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <BookOpen className="w-7 h-7" />
              AKN Group — Kullanma Kılavuzu
            </DialogTitle>
            <p className="text-purple-200 text-sm mt-1">
              Kayıttan İnsan-ı Kamil'e — Tam sistem rehberi
            </p>
            <div className="flex gap-3 mt-4 no-print">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleDownload}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Download className="w-4 h-4" />
                HTML Olarak İndir
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handlePrint}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                📄 PDF Olarak Kaydet
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={expandAll}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                Tümünü Aç
              </Button>
            </div>
          </DialogHeader>

          <div id="guide-print-area" className="p-6 space-y-4">
            <div id="guide-content">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                >
                  <button
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-purple-50 hover:from-purple-50 hover:to-indigo-50 transition-all text-left no-print"
                    onClick={() => toggleSection(section.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{section.icon}</span>
                      <h3 className="font-bold text-gray-900 text-base">
                        {section.title}
                      </h3>
                    </div>
                    {openSections[section.id] ? (
                      <ChevronUp className="w-5 h-5 text-purple-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {openSections[section.id] && (
                    <div className="p-5 bg-white border-t border-gray-100">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                        {section.content.trim()}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center text-xs text-gray-400 pt-4 border-t no-print">
              AKN Group MLM Sistemi — Tüm hakları saklıdır •{" "}
              {new Date().getFullYear()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
