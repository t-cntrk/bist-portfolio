# Proje Analiz Raporu

BIST Stocks Dashboard — Node.js/Express + vanilla JS ES-module frontend + SQLite + Yahoo Finance.
İlk hali salt-okunur bir incelemeydi; **2026-06-27 tarihinde bulguların bir kısmı için düzeltmeler uygulandı** ve aşağıda her satır durumuyla işaretlendi.

**Durum açıklamaları:**
- ✅ **Çözüldü** — düzeltme uygulandı (Jest 21/21 geçti, sözdizimi doğrulandı).
- 🟡 **Kısmen** — düzeltmenin bir parçası uygulandı, kalanı açık.
- ⏸️ **Ertelendi** — bilinçli olarak bu turda yapılmadı (gerekçe belirtildi).
- ⏳ **Açık** — henüz ele alınmadı.

> ⚠️ XSS düzeltmeleri (3.1 / 2.1) kod ve birim testi düzeyinde tamamlandı ancak **tarayıcıda manuel doğrulama bekliyor** — bkz. son bölüm "Doğrulama Bekleyenler".

---

## 1. Genel Mimari Özeti

**Katmanlı backend akışı:** `server.js` → `routes/` → `controllers/` → `services/`.

- **`server.js`** (giriş noktası): middleware kurulumu, CORS, CSP, güvenlik başlıkları, statik dosya servisi, route kaydı, DB başlatma, graceful shutdown. Opsiyonel route'lar (`stockRoutes`, `portfolioRoutes`) `try/catch require` ile yükleniyor.
- **`routes/`** (ince katman): `express-validator` doğrulayıcıları + rate limiter + CSRF middleware'i bağlayıp controller'a delege ediyor.
- **`controllers/`**: `authController` (kayıt/giriş, e-posta doğrulama, şifre sıfırlama/değiştirme, hesap silme), `portfolioController` (CRUD), `stockController` (hisse/FX/grafik verisi + mock fallback).
- **`services/`**: `yahooService` (v8 HTTP → yahoo-finance2 npm → mock üç katmanlı fallback), `stockCacheService` (node-cache 30 dk + disk fallback + in-flight promise paylaşımı), `databaseService` (tek paylaşılan SQLite bağlantısı), `emailService` (Nodemailer + OAuth2/SMTP/jsonTransport), `pageGenerator` (sunucu-render HTML sayfaları).
- **`middleware/securityMiddleware.js`**: CSRF (Map tabanlı, 24s TTL), JWT auth (HttpOnly cookie), rate limiter'lar, güvenlik başlıkları, CSP, HTTPS zorlaması.
- **Frontend** (`public/js/`): build adımı yok, native ES modülleri. `app.js` giriş noktası, event delegation tek noktadan, 60 sn auto-refresh.

**Veritabanı:** `users` (kimlik + doğrulama/aksiyon token kolonları + yeni `reset_token` kolonları) ve `portfolios` (`(user_id, symbol, type)` üzerinde UNIQUE).

---

## 2. Potansiyel Bug'lar ve Mantık Hataları

| # | Bulgu | Dosya:Satır | Önem | Durum |
|---|-------|-------------|------|-------|
| 2.1 | `addAsset` sembolü karakter kısıtlamasına tabi değildi → veri bütünlüğü + XSS kaynağı. | `routes/portfolioRoutes.js:7` | Yüksek | ✅ Çözüldü — `^[A-Za-z0-9.=^/&#;_-]+$` whitelist eklendi (`< > " '` engellendi). |
| 2.2 | `refreshStockCache` cooldown zaman damgasını `pendingStocksFetch` kontrolünden önce set ediyor; başarısız fetch'te sonraki refresh 29 dk gecikebilir. | `services/stockCacheService.js:114-117` | Orta | ⏳ Açık |
| 2.3 | `getStocks` cache-miss'te mock veriyi gerçek gibi gösteriyor (`source:'mock'` UI'da ayırt edilmiyor). | `controllers/stockController.js:27` | Orta | ⏳ Açık |
| 2.4 | Dev'de `JWT_SECRET` zorunlu değildi; set edilmezse login 500 veriyordu. | `server.js`, `middleware/securityMiddleware.js:24` | Orta | ✅ Çözüldü — dev'de güvenli olmayan varsayılan + uyarı; prod sert-fail. |
| 2.5 | `forgotPassword` `email_verified` kontrol etmiyordu **ve** `verification_token` kolonunu eziyordu. | `controllers/authController.js:173-215` | Orta | 🟡 Kısmen — token ezme giderildi (artık `reset_token` kullanıyor, bkz. 3.3); `email_verified` kontrolü hâlâ açık. |
| 2.6 | `enforceHTTPS` 301 redirect'i `req.headers.host` (kullanıcı-kontrollü) ile kuruyordu. | `middleware/securityMiddleware.js:154` | Orta | ✅ Çözüldü — redirect `getBaseUrl()` üzerinden. |
| 2.7 | `email` kolonu DB seviyesinde `NOT NULL` değil; UNIQUE index çoklu NULL'a izin verir. | `services/databaseService.js:52` | Düşük | ⏳ Açık |
| 2.8 | `verifyPasswordChange` içinde mükerrer `newPassword === currentPassword` kontrolü. | `controllers/authController.js` | Düşük | ⏳ Açık |
| 2.9 | `birthdate` `.toDate()` ile Date'e çevriliyor ama kolon `TEXT`; tam ISO datetime saklanıyor. | `routes/authRoutes.js:27` | Düşük | ⏳ Açık |
| 2.10 | `npm test` `test:regression`'ı çalıştırmıyor; script/dokümantasyon tutarsız. | `package.json:11` | Düşük | ⏳ Açık |

---

## 3. Güvenlik Riskleri

| # | Bulgu | Dosya:Satır | Önem | Durum |
|---|-------|-------------|------|-------|
| 3.1 | **Stored/Self-XSS:** Portföy sembolü escape edilmeden `innerHTML` + `onclick`'e basılıyordu. | `public/js/portfolio-render.js:45,56`, `public/js/fx-portfolio.js:75,86` | Yüksek | ✅ Çözüldü — `escapeHtml` + inline `onclick` kaldırılıp `data-*` + event delegation'a geçildi. **(Tarayıcı doğrulaması bekliyor.)** |
| 3.2 | **CSP `'unsafe-inline'` + `'unsafe-eval'`** script-src'de açık; XSS savunmasını zayıflatıyor. | `middleware/securityMiddleware.js:165` | Yüksek | ⏸️ **Ertelendi (bilinçli karar — "internete açılırsa" yapılacak)** — CSP, asıl açık kapansa bile devreye giren bir *yedek* koruma katmanıdır. Asıl XSS vektörü 3.1 + 2.1 ile kaynağında kapatıldığı için, tek kullanıcılı / canlıya alınmayan bu projede sertleştirmenin maliyet/faydası düşük. Tam sertleştirme pageGenerator'daki inline `<script>` bloklarını nonce'a taşımayı + tarayıcı testini gerektirir. **Yapılacağı an:** proje başkalarının kullanımına / internete açıldığında. |
| 3.3 | **Token kolon karışıklığı:** e-posta doğrulama ve şifre sıfırlama aynı `verification_token` kolonunu paylaşıyordu. | `controllers/authController.js:194,292,461` | Yüksek | ✅ Çözüldü — yeni `reset_token`/`reset_token_expires` kolonları; iki akış tamamen ayrıldı. |
| 3.4 | **CSRF token Map'i sınırsız büyüyebilir** (`/api/csrf-token` rate-limit'siz). | `server.js`, `middleware/securityMiddleware.js:30` | Orta | ✅ Çözüldü — `generalLimiter` (60/dk) eklendi; timer'a `.unref()`. |
| 3.5 | **`trust proxy = 1`** sabit; proxy yokken XFF ile IP spoof + rate-limit bypass. | `server.js:56` | Orta | ✅ Çözüldü — sadece production'da `1`, aksi halde `false`. |
| 3.6 | **`/api/error-log`** kimlik doğrulamasız ve rate-limit'siz; log injection/flooding. | `server.js:204` | Orta | ✅ Çözüldü — `generalLimiter` eklendi (+ body limit düşürüldü, bkz. 3.11). |
| 3.7 | **Prod'da `COOKIE_SECRET` zorunlu değildi;** `'dev-cookie-secret'` fallback'i tahmin edilebilir. | `server.js:104` | Orta | ✅ Çözüldü — prod'da ≥16 karakter zorunlu (yoksa exit). |
| 3.8 | **`POST /api/stocks/clear-cache`** durum değiştiren POST ama `validateCSRF` yoktu. | `routes/stockRoutes.js:29` | Düşük | ✅ Çözüldü — route'a `validateCSRF`; frontend `createApiRequest`'e geçti. |
| 3.9 | **`POST /api/auth/logout`** CSRF ve rate limit içermiyordu. | `routes/authRoutes.js:99` | Düşük | 🟡 Kısmen — `generalLimiter` eklendi; CSRF bilinçli olarak eklenmedi (token eksikse cookie temizlenemez, forced-logout riski düşük). |
| 3.10 | **Hesap kilitleme yok;** koruma yalnızca IP başına rate limit. | `middleware/securityMiddleware.js:89` | Düşük | ⏳ Açık |
| 3.11 | **Body limit `10mb`** tüm JSON route'larında. | `server.js:108` | Düşük | ✅ Çözüldü — `1mb`'a düşürüldü. |

---

## 4. Eksik Test Kapsamı

| # | Bulgu | Dosya:Satır | Önem | Durum |
|---|-------|-------------|------|-------|
| 4.1 | Jest yalnızca `envConfig` ve `pageGenerator`'ı kapsıyordu; auth/portfolio/yahoo/cache için test yoktu. | `tests/` | Yüksek | 🟡 Kısmen — `securityMiddleware` + `passwordPolicy` testleri eklendi (toplam 21 test); controller/portfolio/yahoo/cache hâlâ kapsamsız. |
| 4.2 | CSRF doğrulama ve JWT `authenticateToken` için test yoktu. | `middleware/securityMiddleware.js` | Yüksek | ✅ Çözüldü — `tests/securityMiddleware.test.js` (7 senaryo: eksik/yanlış/geçerli CSRF, eksik/geçersiz/süresi-dolmuş/geçerli JWT). |
| 4.3 | Portföy sahiplik kontrolü ve sembol validasyonu için test yok. | `controllers/portfolioController.js:46-61` | Orta | ⏳ Açık |
| 4.4 | `yahooService` fallback zinciri ve `stockCacheService` mantığı test edilmiyor. | `services/yahooService.js`, `services/stockCacheService.js` | Orta | ⏳ Açık |
| 4.5 | `supertest` kurulu ama HTTP entegrasyon testi yok. | `package.json` | Orta | ⏳ Açık |
| 4.6 | `test:regression` `npm test`'in tamamında koşmuyor. | `package.json:11` | Düşük | ⏳ Açık |

---

## 5. Teknik Borç ve Tekrar Eden Kod

| # | Bulgu | Dosya:Satır | Önem | Durum |
|---|-------|-------------|------|-------|
| 5.1 | **Şifre karmaşıklık regex'i 4 yerde kopyalanmıştı.** | `authController.js`, `authRoutes.js` ×2, `pageGenerator.js:222` | Orta | ✅ Çözüldü — `utils/passwordPolicy.js` tek kaynağı oluşturuldu; backend kullanımları bağlandı. (pageGenerator içindeki inline istemci-tarafı kopyası DOM script string'i olduğu için kapsam dışı.) |
| 5.2 | **Display-name/sembol listesi iki yerde** (backend + frontend). | `services/yahooService.js:39`, `public/js/stocks.js:52` | Orta | 🟡 Kısmen — Tam birleştirme build adımı gerektirdiğinden yapılmadı; bunun yerine iki listeyi karşılaştıran ve ayrışırlarsa hata veren **bekçi testi** eklendi (`tests/stockNamesSync.test.js`). Tekrar duruyor ama artık sessizce ayrışamaz. |
| 5.3 | **`pageGenerator` 5 neredeyse-aynı HTML şablonu** (~400 satır kopya boilerplate). | `services/pageGenerator.js` | Orta | ⏳ Açık |
| 5.4 | **İki ayrı escape fonksiyonu** (`escapeHTML` + `escapeHtml`) aynı dosyada. | `public/js/dom-helpers.js:143,149` | Düşük | ⏳ Açık |
| 5.5 | **`releaseConnection` artık no-op** ama tüm controller'larda çağrılıyor. | `services/databaseService.js` | Düşük | ✅ Çözüldü — 60 no-op çağrısı temizlendi, fonksiyon ve export'u kaldırıldı; davranış birebir aynı (Jest 21/21 geçti). |
| 5.6 | **`errorHandler.js` yardımcılarının çoğu kullanılmıyor** (ölü kod). | `utils/errorHandler.js` | Düşük | ✅ Çözüldü — kullanılmayan yardımcılar silindi; sadece kullanılan `errorMiddleware` + `CustomAPIError` kaldı. |
| 5.7 | **Çift/üçlü CORS reddi mantığı** üç katmana yayılmış. | `server.js:84-101` | Düşük | ⏳ Açık |
| 5.8 | **Yoğun emoji'li `console.log` izleri**; yapısal logger yok. | `services/*`, `emailService.js:7-10` | Düşük | ⏳ Açık |
| 5.9 | **`portfolio-render.js` aynı fonksiyonu 3 isimle export ediyor.** | `public/js/portfolio-render.js:199-204` | Düşük | ⏳ Açık |

---

## 6. Doğrulama Bekleyenler

Aşağıdaki kalemler kod ve/veya birim testi düzeyinde tamamlandı ancak **çalışma-zamanı / tarayıcı doğrulaması** yapılmadı:

| # | Kalem | Yapılması gereken doğrulama |
|---|-------|------------------------------|
| 3.1 / 2.1 | **Portföy XSS düzeltmesi** | Tarayıcıda manuel test: (a) sembolü `'><img src=x onerror=alert(1)>` gibi bir değerle eklemeye çalış → backend whitelist'i 400 ile reddetmeli; (b) DB'de zaten bozuk sembol varsa portföy tablosunda metin olarak (escape edilmiş) görünmeli, script çalışmamalı; (c) **sil butonunun** hâlâ çalıştığını (modal açılması + silme) ve ✕ ikonuna tıklamanın da tetiklediğini doğrula (delegation `closest()` değişikliği); (d) çift-tetikleme olmadığını gözlemle. |
| 3.3 | **Token kolon ayrımı** | Uçtan uca akış: şifre sıfırlama e-postası iste → linkten yeni şifre belirle → giriş yap. Ayrıca e-posta doğrulama linkinin hâlâ çalıştığını ve iki token'ın artık birbirinin yerine geçemediğini doğrula. Yeni `reset_token` kolonlarının mevcut DB'ye ALTER ile sorunsuz eklendiğini kontrol et (`node scripts/check-schema.js`). |
| 3.8 | **clear-cache CSRF** | "Force refresh" akışını tetikle → `/api/stocks/clear-cache` çağrısının `x-csrf-token` ile 200 döndüğünü, token'sız çağrının 403 olduğunu doğrula. |
| 2.4 / 3.7 | **Secret kontrolleri** | Prod modunda `COOKIE_SECRET` olmadan başlatmayı dene → sürecin exit etmesi beklenir. Dev modunda `JWT_SECRET` olmadan login'in artık 500 vermediğini doğrula. |

**Otomatik doğrulama durumu:** Jest 4 suite / 21 test geçti; tüm düzenlenen backend dosyaları `node -c`, frontend ES modülleri `node --input-type=module --check` ile doğrulandı. (ESLint repo'da v9 flat-config'e sahip olmadığından çalışmıyor — mevcut, bu değişikliklerden bağımsız bir tooling sorunu.)

---

## Öncelik Özeti (kalan işler)

**Açık yüksek/orta öncelik:**
- 3.2 (CSP sertleştirme — ertelendi, nonce refactor gerekiyor)
- 2.5 kalan parça (`email_verified` kontrolü forgotPassword'de)
- 4.1 kalan parça + 4.3/4.4/4.5 (controller/portfolio/yahoo/cache/entegrasyon testleri)

**Düşük öncelik / teknik borç:** 2.2, 2.3, 2.7–2.10, 3.10, 5.3, 5.4, 5.7–5.9.

> Not: Bu rapor hem ilk tespitleri hem de 2026-06-27 düzeltme turunun sonucunu yansıtır.
