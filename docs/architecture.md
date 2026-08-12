# Sistem Mimarisi ve Yazılım Yol Haritası

## 1. Önerilen mimari

Sistem iki ayrı katmandan oluşur:

### Merkezi web uygulaması

- Excel katılımcı listesi içe aktarma
- Katılımcı ve yarış veritabanı
- Toplu göğüs numarası ve çip kodu atama API'si
- Çip doğrulama API'si
- Operasyon ve denetim kayıtları

### Yerel çip istasyonu

- USB/seri/TCP okuyucuyla haberleşir
- Okunan EPC/UID kodunu standart formata çevirir
- Kodun web uygulamasına iletilmesini sağlar
- İnternet kesintisinde geçici kuyruk tutabilir

Donanım entegrasyonunu merkezi uygulamadan ayırmak, okuyucu markası değiştiğinde yalnızca adaptörün değiştirilmesini sağlar.

## 2. Veri modeli

### participants

| Alan | Amaç |
| --- | --- |
| id | İç sistem anahtarı |
| registration_code | Benzersiz kayıt kodu |
| bib_number | Çip atamasında otomatik üretilen göğüs numarası |
| first_name / last_name | Ekranda gösterilecek isim |
| email / phone | Kayıt iletişim bilgileri |
| category | Yarış kategorisi |
| gender | Erkek/kadın klasman bilgisi |
| chip_id | Okuyucudan gelen EPC/UID/TID |
| status | REGISTERED, ASSIGNED veya VERIFIED |
| assigned_at / verified_at | Operasyon zaman damgaları |

### verification_logs

Her okutmayı `MATCH` veya `UNKNOWN` olarak kaydeder. Cihaz/masa kimliği ve zaman damgası, yarış sonrası denetim için saklanır.

## 3. API sözleşmesi

### Katılımcı listesini toplu aktarma

`POST /api/import`

```json
{ "fileName": "katilimcilar.xlsx", "rows": [{ "firstName": "Arif", "lastName": "Çetin", "email": "arif@example.com", "phone": "05xx xxx xx xx", "category": "10K", "gender": "ERKEK" }] }
```

Aktarım başarılı olduğunda sistem her satır için benzersiz göğüs numarası ve `E280-11A0-XXXXXXXX` biçiminde çip kodu üretir.

### Tekil çip değişikliği

`POST /api/chips/assign`

```json
{
  "participantId": 17,
  "chipId": "E280-11A0-00001042"
}
```

Çip başka bir yarışmacıya atanmışsa `409 Conflict` döner ve teslim engellenir.
Başarılı işlemde merkezi sayaçtan sıradaki göğüs numarası alınır. Böylece farklı masalardan eş zamanlı atama yapılırken numara çakışması engellenir.

### Çip doğrulama

`POST /api/chips/verify`

```json
{
  "chipId": "E280-11A0-00001042",
  "deviceId": "TESLIM-A1"
}
```

Başarılı sonuç:

```json
{
  "found": true,
  "participant": {
    "bibNumber": "1042",
    "firstName": "Arif",
    "lastName": "Çetin",
    "category": "10K",
    "gender": "ERKEK"
  }
}
```

## 4. Geliştirme aşamaları

### Faz 1 — İşleyen MVP

- Kayıt formu
- Katılımcı listesi
- Excel listesinden toplu çip kodu ve otomatik göğüs numarası atama
- Aynı çipi iki kişiye atamayı engelleme
- Büyük ekran doğrulama sonucu
- Okutma logu

### Faz 2 — Gerçek okuyucu entegrasyonu

- Üretici SDK/protokol adaptörü
- Bağlantı durumu ve cihaz kimliği
- Tek-çip okuma alanı ve anten gücü kalibrasyonu
- Otomatik okutma ve sesli/renkli uyarı
- Yeniden deneme ve zaman aşımı

### Faz 3 — Yarış günü dayanıklılığı

- Çevrimdışı yerel veri kopyası
- Bağlantı geri geldiğinde senkronizasyon
- İdempotent API istekleri
- Operatör oturumu ve rol yetkileri
- CSV/API toplu içe aktarma
- Günlük yedekleme ve geri dönüş senaryosu

### Faz 4 — Zamanlama sistemine bağlantı

- Yarış ve start listesi aktarımı
- Zamanlama platformunun istediği CSV/XML/JSON çıktısı
- EPC/UID ile göğüs numarası eşleştirme tablosu
- Sonuç sistemine veri doğrulama raporu

## 5. Yarış günü hata kontrolleri

- Aynı çip başka bir katılımcıda: atama engellenir.
- Çip sistemde yok: kırmızı uyarı ve `UNKNOWN` logu.
- Birden fazla çip aynı anda okunuyor: operatör işlemi durdurur.
- Katılımcının daha önce doğrulanmış çipi değiştiriliyor: amir onayı gerekir.
- İnternet yok: yerel kuyruk ve son senkronizasyon zamanı gösterilir.
- Okuyucu yok: manuel EPC girişi yalnızca yetkili role açılır.

## 6. Güvenlik ve KVKK

- Çip üzerinde kişisel veri tutulmaz.
- İnternet trafiği TLS ile şifrelenir.
- Kayıt, atama, doğrulama ve yönetici rolleri ayrılır.
- Her atama/değişiklik kullanıcı, cihaz ve zaman bilgisiyle loglanır.
- Kişisel veriler yarışın saklama politikasına göre silinir veya anonimleştirilir.
- CSV dışa aktarımları erişim kontrollü ve süreli olmalıdır.

## 7. Kabul testleri

| Test | Beklenen sonuç |
| --- | --- |
| Yeni katılımcı kaydı | Benzersiz kayıt kodu oluşur |
| İki masadan eş zamanlı atama | Her katılımcıya farklı göğüs numarası verilir |
| 100 kişilik Excel aktarımı | 100 benzersiz göğüs numarası ve çip kodu oluşur |
| Aynı çipi ikinci kişiye atama | İşlem 409 ile durur |
| Doğru çipi okutma | Ad, göğüs no. ve kategori görünür |
| Tanımsız çipi okutma | Kırmızı uyarı oluşur |
| Doğrulama tamamlanması | Durum VERIFIED olur ve log oluşur |
