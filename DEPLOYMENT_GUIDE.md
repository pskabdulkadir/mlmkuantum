# MLM Uygulaması - Dağıtım Kılavuzu

## Proje Yapısı

Bu proje **full-stack Node.js + React Vite** uygulamasıdır:

```
mlm-app/
├── client/          → React frontend uygulaması
├── server/          → Express.js backend
├── shared/          → Frontend ve backend arasında paylaşılan türler
├── server.ts        → Ana server dosyası
├── vite.config.ts   → Frontend build yapılandırması
├── index.html       → SPA entry point
└── package.json     → Bağımlılıklar
```

## Dağıtım Seçenekleri

### Seçenek 1: Netlify (Sadece Frontend - Statik)
**Kullanıldığı durum:** Backend'iniz başka bir sunucuda çalışıyorsa

```bash
# Build komutu
cd mlm-app && pnpm run build:client

# Publish klasörü
mlm-app/dist/spa
```

**Konfigürasyon:** `netlify.toml` dosyası kullanılıyor

### Seçenek 2: Heroku / Railway / DigitalOcean (Full Stack)
**Kullanıldığı durum:** Backend ve frontend'in aynı sunucuda çalışması

```bash
# Build komutu
pnpm run build

# Start komutu
NODE_ENV=production node dist/server.cjs
```

### Seçenek 3: Docker (Önerilen - Production)
Dockerfile zaten oluşturuldu.

```bash
docker build -t mlm-app .
docker run -p 3000:3000 \
  -e MONGODB_URI="mongodb+srv://..." \
  -e JWT_SECRET="your-secret" \
  mlm-app
```

## SPA Yönlendirmesi

React Router sayfalarında "boş beyaz sayfa" problemi olursa:

1. `_redirects` dosyası proje kökünde olduğundan emin ol
2. Netlify'de settings > Build & Deploy > Context (production vs. staging) kontrol et
3. Cache'i temizle (Ctrl+Shift+R)

## MongoDB Bağlantısı

Ortam değişkenleri:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT token şifresi
- `NODE_ENV` - production/development
- `RUN_SEED` - Başlangıç verisi yükle (false=hayır)

## API Endpoints

Backend API'si `/api/` altında:
- `POST /api/auth/register` - Kayıt
- `POST /api/auth/login` - Giriş
- `GET /api/dashboard` - Dashboard verileri
- Diğer MLM işlemleri...

## Sorun Giderme

### Boş Beyaz Sayfa
1. `_redirects` dosyası var mı? → `/* /index.html 200`
2. Build başarılı mı? → Netlify build logs kontrol et
3. API çağrıları çalışıyor mu? → Tarayıcı Network tab'ında kontrol et

### API Bağlantı Hatası
1. Backend adresini kontrol et (client/constants.ts)
2. MongoDB bağlantı string'i doğru mu?
3. CORS ayarları var mı?

### Database Hatası
1. MONGODB_URI ortam değişkeni ayarlanmış mı?
2. Şifre karakterleri URL-encoded mi? (@ işareti %40)
3. Network erişimi açık mı?

## Netlify Deploy Adımları

1. GitHub repo'yu Netlify'e bağla
2. Build command: `cd mlm-app && pnpm run build:client`
3. Publish directory: `mlm-app/dist/spa`
4. Environment variables:
   - MONGODB_URI
   - NODE_ENV=production
   - RUN_SEED=false

5. `_redirects` dosyasını repo'ya commit et
6. Deploy!
