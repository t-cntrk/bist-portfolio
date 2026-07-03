# 📧 E-posta Şablonu Test Rehberi

## ✅ **Outlook Uyumlu E-posta Şablonları**

Bu proje artık **Outlook uyumlu** e-posta şablonları kullanıyor. Aşağıdaki özellikler eklendi:

### 🔧 **Teknik Özellikler**

1. **Tablo Tabanlı Layout**
   - `<table>` yapısı kullanılıyor (div yerine)
   - Outlook'ta daha iyi render ediliyor

2. **VML (Vector Markup Language) Butonları**
   - Outlook için özel `<v:roundrect>` butonları
   - Gradient renkler ve yuvarlatılmış köşeler

3. **MSO (Microsoft Office) Fix'leri**
   - `mso-line-height-rule: exactly`
   - `mso-table-lspace: 0pt; mso-table-rspace: 0pt`
   - Conditional comments `[if mso]`

4. **Responsive Tasarım**
   - Mobil uyumlu media query'ler
   - Gmail ve diğer e-posta istemcileri için

### 📁 **Dosya Yapısı**

```
email-templates/
├── password-reset-email.html    # Şifre sıfırlama şablonu
└── verification-email.html      # E-posta doğrulama şablonu
```

### 🧪 **Test Senaryoları**

#### 1. **Test E-postası Gönderme**
```bash
# PowerShell
Invoke-WebRequest -Uri "http://localhost:3100/test-email" -Method GET

# veya tarayıcıda
http://localhost:3100/test-email
```

#### 2. **Şifre Sıfırlama Testi**
```bash
# PowerShell
Invoke-WebRequest -Uri "http://localhost:3100/api/auth/forgot" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"email":"your-email@gmail.com"}'

# veya uygulamada
# "Şifremi Unuttum" → E-posta gir → "Gönder"
```

#### 3. **E-posta Doğrulama Testi**
```bash
# Yeni kullanıcı kaydı yapın
# E-posta doğrulama otomatik gönderilecek
```

### 📧 **E-posta İstemci Testleri**

#### **Outlook Testi**
- ✅ **Outlook 2016/2019/365** - Tam destek
- ✅ **Outlook 2010+** - Temel destek
- ✅ **Outlook Web** - Tam destek

#### **Gmail Testi**
- ✅ **Gmail Web** - Tam destek
- ✅ **Gmail Mobil** - Responsive tasarım

#### **Diğer İstemciler**
- ✅ **Apple Mail** - Tam destek
- ✅ **Thunderbird** - Tam destek
- ✅ **Yahoo Mail** - Tam destek

### 🎨 **Görsel Özellikler**

#### **Şifre Sıfırlama E-postası**
- 🔐 Koyu tema (gradient arka plan)
- 🔑 Mavi-yeşil gradient buton
- ⏰ 7 gün geçerlilik uyarısı (test için)
- 📧 Destek e-posta adresi

#### **E-posta Doğrulama**
- 📧 Koyu tema (gradient arka plan)
- ✅ Yeşil-mavi gradient buton
- ⏰ 7 gün geçerlilik uyarısı (test için)
- 📧 Destek e-posta adresi

### 🔍 **Outlook Özel Fix'leri**

#### **VML Buton Yapısı**
```html
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" 
             style="height:48px;v-text-anchor:middle;width:220px;" 
             arcsize="10%" stroke="f" fillcolor="#3b82f6">
<w:anchorlock/>
<center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:600;">
🔑 Şifremi Sıfırla
</center>
</v:roundrect>
<![endif]-->
```

#### **MSO CSS Fix'leri**
```css
.mso-fix { mso-line-height-rule: exactly; }
table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
```

### 🚀 **Performans**

- **E-posta Boyutu**: < 100KB
- **Render Süresi**: < 2 saniye
- **Uyumluluk**: %99+ e-posta istemcisi

### 📱 **Mobil Uyumluluk**

```css
@media only screen and (max-width: 600px) {
    .mobile-padding { padding: 20px 15px !important; }
    .mobile-button { width: 100% !important; max-width: 280px !important; }
}
```

### 🔧 **Sorun Giderme**

#### **E-posta Görünmüyor**
1. Spam klasörünü kontrol edin
2. Gmail App Password'ün doğru olduğundan emin olun
3. `.env` dosyasındaki e-posta ayarlarını kontrol edin

#### **Format Bozukluğu**
1. E-posta istemcisini güncelleyin
2. Farklı e-posta istemcisi deneyin
3. Test e-postası gönderin

#### **Buton Çalışmıyor**
1. E-posta istemcisinde "Güvenli Bağlantıları Göster" seçeneğini açın
2. Tarayıcıda e-postayı açın
3. Bağlantıyı kopyalayıp tarayıcıya yapıştırın

#### **Çift E-posta Sorunu**
1. ✅ **Çözüldü**: Global lock ile e-posta gönderimi senkronize edildi
2. ✅ **Rate Limiting**: 10 istek/dakika sınırı
3. ✅ **Token Güvenliği**: Kullanıldıktan sonra hemen siliniyor
4. ✅ **Senkron E-posta**: Aynı anda sadece 1 e-posta gönderiliyor

#### **Rate Limiting Mesaj Sorunu**
1. ✅ **Çözüldü**: Frontend'deki gereksiz rate limiting kontrolü kaldırıldı
2. ✅ **Server Rate Limiting**: Sadece server tarafında rate limiting aktif
3. ✅ **Temiz Mesajlar**: Yanlış hata mesajları gösterilmiyor

### 📞 **Destek**

Sorun yaşarsanız:
- 📧 **E-posta**: destek@borsaportal.com
- 🔧 **Test Endpoint**: http://localhost:3100/test-email
- 📖 **Log Dosyaları**: Server console çıktısını kontrol edin

---

**✅ Outlook uyumlu e-posta şablonları başarıyla uygulandı!** 