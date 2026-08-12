# Yarış Çip Kayıt ve Doğrulama MVP

Bu proje; organizatörden alınan Excel katılımcı listesini içe aktarma, otomatik göğüs numarası ve UHF RFID/NFC çip kodu atama, teslim öncesi doğrulama ve yarış sonuçlarını sınıflandırmayı tek operasyon akışında birleştiren çalışan bir MVP'dir.

## En önemli tasarım kararı

Katılımcının adı, telefonu veya e-postası çipin içine yazılmaz. Çipten yalnızca benzersiz bir `EPC/UID/TID` okunur. Uygulama bu kodu veritabanındaki katılımcıyla eşleştirir. Böylece:

- kişisel veriler çip üzerinde taşınmaz,
- aynı çipin iki kişiye atanması engellenir,
- çip değişimi ve yeniden atama yönetilebilir,
- okuyucu değişse bile ana kayıt sistemi korunur,
- teslim ve doğrulama işlemleri denetlenebilir.

## İş akışı

1. Organizatör mevcut kayıt platformundan katılımcı listesini Excel olarak iletir.
2. Excel dosyası sisteme yüklenir ve sütunlar kontrol edilir.
3. Sistem her yeni katılımcıya benzersiz kayıt kodu, göğüs numarası ve çip kodu atar.
4. Atama listesi operatör tarafından kontrol edilir.
5. Teslim masasında çip okutulur.
6. Ekranda ad-soyad, göğüs numarası, kategori ve cinsiyet görünür.
7. Başarılı veya başarısız doğrulama denetim kaydına yazılır.
8. Yarış sonunda 10KM ve 21KM ara geçişleri, finiş dereceleri ve pace değerleri sıralanır.
9. Sonuçlar genel, erkek ve kadın klasmanlarında filtrelenir.

## İçerik

- `app/page.tsx`: Excel yükleme, atama listesi, doğrulama ve operasyon ekranları
- `app/results.tsx`: 10KM/21KM ara geçişleri, pace hesapları ve klasman sıralamaları
- `app/api/import`: toplu Excel verisi, göğüs numarası ve çip kodu atama API'si
- `app/api/participants`: katılımcı liste API'si
- `app/api/chips/verify`: okutulan çipi doğrulama API'si
- `db/schema.ts`: katılımcı ve doğrulama logu veri modeli
- `drizzle/`: veritabanı migration dosyaları
- `hardware-bridge/`: USB/seri okuyucuyu web uygulamasına bağlayan yerel servis
- `docs/architecture.md`: üretim mimarisi ve geliştirme planı

## Uygulamayı çalıştırma

Gereksinim: Node.js 22 veya üzeri.

```bash
npm install
npm run db:generate
npm run dev
```

Tarayıcıda gösterilen yerel adrese gidin. Uygulama; kategori için `10K`/`21K`, cinsiyet için `Erkek`/`Kadın` değerlerini kabul eder.

## Kalite kontrolleri

```bash
npm run lint
npm test
```

`npm test`, üretim derlemesini ve temel HTML kontrolünü birlikte çalıştırır. `.github/workflows/ci.yml` aynı kontrolleri GitHub üzerindeki her push ve pull request işleminde otomatik yürütür.

## ChatGPT Sites bağlantısı

`.openai/hosting.json` dosyası mevcut Sites projesinin kimliğini ve D1 bağlantı adını korur. GitHub'a gönderirken bu dosyayı silmeyin veya içindeki `project_id` değerini değiştirmeyin. Dosyada parola ya da erişim anahtarı bulunmaz.

## GitHub'a gönderme

İndirilen proje klasöründe aşağıdaki adımları izleyin:

```bash
git init
git add .
git commit -m "İlk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADI/DEPO_ADI.git
git push -u origin main
```

GitHub deposunu önceden boş olarak oluşturun; `KULLANICI_ADI` ve `DEPO_ADI` alanlarını kendi bilgilerinizle değiştirin. Proje paketinde bağımlılıklar, derleme çıktıları, geçici dosyalar ve mevcut uzak depo geçmişi yer almaz.

## Okuyucu köprüsünü çalıştırma

Simülatör:

```bash
cd hardware-bridge
npm install
npm run start:simulator
```

Seri port üzerinden satır bazlı EPC/UID gönderen okuyucu:

```bash
READER_MODE=serial READER_PORT=/dev/ttyUSB0 READER_BAUD=115200 npm start
```

Windows örneği:

```powershell
$env:READER_MODE="serial"
$env:READER_PORT="COM4"
$env:READER_BAUD="115200"
npm start
```

`hardware-bridge` servisi `http://127.0.0.1:8787` üzerinde çalışır. Gerçek okuyucunun çıktı protokolü satır bazlı değilse `hardware-bridge/adapters/serial-line.mjs` dosyası üretici protokolüne göre değiştirilmelidir.

## Önemli donanım notu

Bir UHF RFID çipinde mevcut EPC/TID kodunu **okumak** ile çipe yeni EPC **yazmak** farklı işlemlerdir. EPC yazma komutları ve erişim şifreleri okuyucu üreticisine göre değişir. Bu MVP güvenli ve daha yaygın olan “çip kimliğini oku ve veritabanında katılımcıyla eşleştir” yöntemini uygular. Çipe fiziksel EPC yazılması zorunluysa okuyucu markası, modeli ve SDK/protokol dokümanı kesinleşmeden üretim kodu yazılmamalıdır.

## Üretim öncesi kontrol listesi

- Okuyucu marka/modeli ve bağlantısı (USB HID, seri port, TCP/IP veya SDK)
- Çip standardı (UHF EPC Gen2 / RAIN RFID, NFC vb.)
- Çipte okunacak alan (EPC, TID veya UID)
- Aynı anda okunabilecek çip sayısı ve anten gücü
- İnternet kesintisinde çevrimdışı çalışma gereksinimi
- Kayıt platformuyla veri aktarım biçimi (REST API, CSV, Excel)
- Yarış başına beklenen katılımcı ve teslim masası sayısı
- Yetkilendirme rolleri ve KVKK saklama süresi
- Yedek cihaz, yedek veritabanı ve yarış günü geri dönüş planı

## Sonraki teknik adım

Okuyucu marka/modeli belli olduğunda şu üç nokta uyarlanır:

1. `serial-line.mjs` yerine üretici SDK adaptörü yazılır.
2. Okuma olayı tarayıcıdaki çip alanına otomatik aktarılır.
3. Anten gücü, tekrar okuma süresi ve tek-çip kontrolü gerçek saha testleriyle kalibre edilir.
