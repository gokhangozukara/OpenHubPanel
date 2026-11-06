# HubPanel Ürün Gereksinimleri

## P0: İlk sürümde zorunlu

### Kimlik ve oturum

- Kullanıcı adı/e-posta ve parola ile giriş.
- Parolaların Argon2id ile saklanması.
- TOTP tabanlı authenticator uygulaması desteği.
- Tüm P0 rollerinde zorunlu TOTP; daha düşük güvence politikası ayrı değerlendirilir.
- E-posta adres doğrulaması ve kurtarma talebi; TOTP yerine giriş vermez.
- Kurtarma kodları.
- İlk yönetici bootstrap'i, davet kabulü ve tüm faktörlerin kaybı için kurtarma prosedürü.
- Riskli işlemlerde işlem ve hedefe bağlı, tek kullanımlık step-up doğrulama.
- Oturum listesi, son kullanma ve uzaktan iptal.
- Başarılı/başarısız giriş ve 2FA olaylarının denetim kaydı.

### Yönetim

- Müşteri/ekip çalışma alanı oluşturma, alan değiştirme ve alan bazlı davet/üyelik.
- Workspace sahibi ile kurulum işletmecisinin yetkilerini ayırma; alanlar arası veri izolasyonu.
- Bekleyen davetleri görme, yeniden gönderme/iptal ve müşteriye workspace sahipliği devri; [yaşam döngüsü kuralları](04-gunluk-kullanim-kontrolu.md) uygulanır.
- Kullanıcı oluşturma, devre dışı bırakma ve şifre sıfırlama.
- Rol ve izin yönetimi.
- Uygulama/modül kayıt defteri.
- Modül bazlı erişim yetkisi.
- Sistem ayarları ve güvenlik politikaları.
- Güvenlik bildirimi ve işlem sonucu mesajları.

### Kullanım

- Sade modül listesi ve ekran içi arama/filtre.
- Responsive tasarım.
- Açık/koyu tema.

### Denetim

- Kullanıcı, rol, oturum, modül ve ayar değişikliklerinin kaydı.
- Aktör, zaman, IP, hedef ve değişiklik özeti.
- Kayıt listeleme ve filtreleme.
- Hassas değerlerin loglanmaması.
- Audit yazılamadığında yerel yönetim değişikliğinin geri alınması.
- Başlangıç veri saklama, IP maskeleme ve yedekten geri dönüş politikası.

### İlk entegrasyon

- Dil bağımsız HTTP/JSON connector sözleşmesi, şemalar ve çalışan örnek uygulama.
- Faz 6A: sağlık, liste ve detay; çekirdeği değiştirmeden ikinci bağımsız örnek uygulamayı salt okunur bağlama.
- Faz 6B: ilk örnekte tek bir izinli güncelleme; optimistic concurrency, outbox, idempotency ve audit.
- Bağlantı testi, izin kapsamı gösterimi, anlaşılır hata, kimlik yenileme ve bağlantıyı kaldırma.
- P0'da iki müşteri alanıyla üyelik, kaynak, cache, kuyruk ve dosya izolasyonu doğrulanır.
- Müşteri dış panel parolasını paylaşmadan API işlemlerini tek HubPanel oturumuyla yapar.
- HubStag ve SwzHub ilk örneklerden sonra aynı sözleşmeyle bağlanabilecek adaylardır.

## P1: Güçlendirme

- SMS adapteri (önce bildirim/telefon doğrulama; yedek giriş için ayrı güvenlik kararı).
- Google ile giriş.
- Destekleyen harici paneller için ortak sağlayıcı üzerinden OIDC SSO; oturum/üyelik iptali kabul testleri.
- Ek ürün connector'ları ve daha geniş kaynak/işlem desteği (Faz 6C).
- WebAuthn/passkey desteği.
- Global arama, komut paleti, favoriler, son kullanılanlar ve hızlı işlemler.
- Kalıcı bildirim merkezi.
- Cihaz güveni ve şüpheli giriş uyarıları.
- Yedekleme ve geri yükleme ekranı.
- Bakım modu ve özellik bayrakları.
- Onay akışları.
- Toplu kullanıcı/rol işlemleri.
- Gerçek zamanlı servis sağlığı.

## P2: Büyüme

- Gelişmiş kuruluş hiyerarşisi ve merkezi barındırılan hizmet işletimi (temel workspace P0).
- Çok dilli SDK'lar ve incelenmiş connector kataloğu (minimal sözleşme ve uygulama kaydı P0).
- Görev ve onay otomasyonları.
- Gelişmiş analitik.
- API anahtarı yönetimi.
- Veri saklama ve silme politikalarının gelişmiş yönetim arayüzü (temel işletim politikası P0).

## İlk sürümde kapsam dışı

- E-ticaret, akademi, hasta takibi, kişisel finans gibi demo dashboardlar.
- Studio Admin'in birebir kopyası olan tema ve layoutlar.
- SwzHub'ın tüm eski ekranlarının taşınması.
- Mikroservis mimarisi.
- Gereksiz süs animasyonları ve ağır grafikler.

## 2FA ürün kararı

Authenticator uygulaması (TOTP) P0 için zorunlu ikinci faktördür. Parola + kurtarma kodu yalnızca yeni TOTP kurulumu için kısıtlı kurtarma oturumu verir. E-posta ve SMS yönetim oturumu veya MFA sıfırlama yetkisi vermez. Google Authenticator standart TOTP uygulaması olarak desteklenir; Google ile giriş ayrı bir OIDC seçeneğidir. Ayrıntılar [ADR-004](../06-Kararlar/ADR-004-guvenlik-incelemesi.md) ve [güvenlik belgesindedir](../03-Mimari/02-guvenlik-ve-2fa.md).

## P0 kapsamının sınırı

İlk kullanılabilir sürüm; güvenli giriş, müşteri çalışma alanları, kullanıcı/rol/oturum yönetimi, audit ve genel connector üzerinden gerçek örnek yönetim işlemidir. İkinci bağımsız uygulama salt okunur bağlanır. Keyfi plugin çalıştırma, sınırsız otomatik CRUD, tüm harici panellere SSO ve kapsamlı connector pazarı P0 dışındadır. P0 üretim yayını Faz 8'in izolasyon, güvenlik, yedek ve rollback kontrollerinden geçer. Public plan deposu yayınlamak, uygulamayı üretime almakla aynı teslimat değildir.
