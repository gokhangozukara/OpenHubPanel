# HubPanel Faz Planı

Her faz çıktı üretmeden ve kabul ölçütlerini karşılamadan tamamlanmış sayılmaz. Faz atlamak yasak değil ancak bağımlılıklar korunmalı.

Güncel yön: **All in one panel**; [ADR-005](../06-Kararlar/ADR-005-admin-panellerinin-hubu.md) ile workspace izolasyonu, genel entegrasyon sözleşmesi ve bir gerçek örnek yazma işlemi P0'a alındı.

## Faz 0: Araştırma ve hazırlık

Durum: Araştırma taslağı ve bağımsız yerel inceleme tamamlandı. Faz 1 kapsam kararı ve public yayın hazırlığı açık.

Teslimatlar:

- Mevcut SwzHub kaynağının incelenmesi
- Güncel Studio Admin kaynağının alınması
- Sürüm ve güncelleme karşılaştırması
- Ürün stratejisi
- Teknik mimari
- 2FA ve güvenlik modeli
- Faz planı
- Sonraki AI için çalışma talimatları

Kabul:

- İki kaynak masaüstündeki HubPanel klasöründe.
- Kaynak ve güncelleme farkı belgeli.
- Kod sahipliği ve referans kullanım sınırı açık.
- Bağımsız bulgular ve düzeltmeler [inceleme raporunda](../01-Arastirma/03-bagimsiz-inceleme.md) kayıtlı.
- Public depo için [yayın kontrol listesi](01-public-repo-yayin-kontrolu.md) ayrı değerlendirilir; kaynak kopyasının bulunması yayın onayı değildir.

## Faz 1: Proje temeli

Amaç: Üretim kodunun güvenli ve ölçülebilir başlangıcını kurmak.

Görevler:

- `pnpm` monorepo oluştur.
- `apps/web`, `apps/worker` ve paket iskeletlerini kur.
- TypeScript strict, Biome, Vitest ve Playwright ayarları.
- Docker geliştirme ortamı.
- PostgreSQL ve Redis servisleri.
- Ortam değişkeni doğrulaması.
- CI: typecheck, lint, test, build, secret scan.
- Temel hata, log ve healthcheck altyapısı.
- `.env.example` ve secret kuralları.
- Auth kütüphanesi seçim kaydı; güncel destek/güvenlik durumu ve lisans envanteri.
- PostgreSQL/Redis ağ sınırları, en az yetkili DB rolleri ve migration denemesi.
- Workspace/üyelik şeması, tenant veri sınırı, RLS ve transaction bağlamı temeli; global kimlikten ayrı kapsam modeli.

Kabul:

- Temiz kurulum tek komutla çalışır.
- CI yeşil.
- İç readiness kontrolü veritabanı ve Redis durumunu gösterir; genel healthcheck yalnızca genel durum döndürür.
- Üretim imajı oluşur.
- Zorunlu sır eksikken üretim başlangıcı reddedilir; örnek env sır içermez.

## Faz 2: Tasarım sistemi ve uygulama kabuğu

Amaç: HubPanel'e özgü arayüzün temelini atmak.

Görevler:

- Renk, tipografi, boşluk ve durum tokenları.
- Button, input, form, dialog, table, toast, menu ve badge bileşenleri.
- Responsive sidebar ve üst bar.
- Workspace seçici, uygulamalar listesi ve bağlantı kurma akışının arayüzü.
- Açık/koyu/sistem teması.
- Empty, loading ve error durumları.
- Erişilebilirlik temel kontrolleri.
- Storybook veya eşdeğer bileşen kataloğu.

Kabul:

- Bileşenler referans panelden kopyalanmamış.
- Klavye ile temel gezinme çalışır.
- Mobil ve masaüstünde shell kullanılabilir.
- WCAG kontrast testlerinde kritik hata yok.

## Faz 3: Kimlik, oturum ve TOTP

Amaç: Güvenli yönetici girişinin ilk çalışan sürümü.

Görevler:

- Kullanıcı ve kimlik şeması.
- Argon2id parola akışı.
- Sunucu tarafı oturum ve güvenli çerez.
- TOTP kurulum ve doğrulama.
- Kurtarma kodları.
- E-posta OTP adapteri.
- İlk yönetici bootstrap'i ve davet/parola sıfırlama akışı.
- Kısıtlı kurtarma oturumu, faktör değiştirme ve manuel kurtarma runbook'u.
- İşlem/oturuma bağlı step-up kanıtı ve temel izin doğrulama servisi.
- Giriş hız sınırı ve kilitleme.
- CSRF/origin kontrolü.
- Audit ve security event tabloları.

Kabul:

- Parola doğru olsa bile 2FA olmadan oturum açılamaz.
- TOTP tekrar kullanılamaz.
- Yanlış kod denemeleri sınırlanır.
- Kurtarma kodu tek kullanımlıdır.
- Oturum iptali sonraki istekte çalışır.
- Auth akışının kritik testleri vardır.
- Aynı OTP/kurtarma kodu için eşzamanlı iki denemeden en fazla biri başarılı olur.
- E-posta/SMS, kurtarma oturumu veya OIDC callback'i zorunlu TOTP'yi atlatamaz (OIDC eklendiğinde tekrar test edilir).
- İlk yönetici kurulumu yalnızca bir kez yapılır; parola sıfırlama MFA'yı kaldırmaz.
- Redis/DB/audit kesintisinde giriş güvenlik kontrolünü atlayamaz.

## Faz 4: Çekirdek yönetim

Amaç: Panelin yönetim işlevlerini gerçek veriyle çalıştırmak.

Görevler:

- Kullanıcı listeleme, oluşturma, düzenleme ve devre dışı bırakma.
- Rol ve izin yönetimi.
- Uygulama kayıt defteri.
- Ayarlar.
- Denetim kaydı ekranı.
- Güvenlik bildirimi ve işlem sonuçları.
- Server tarafı yetki kontrolü.
- Riskli yönetim işlemlerinde Faz 3 step-up kontrolü.
- Nesne/modül kapsamı, izin devri sınırı ve son süper yönetici koruması.
- Workspace sahibi, üyelik/davet yönetimi ve müşteri alanları arasında izinli geçiş.
- Bekleyen davet iptali/yeniden gönderimi ve alıcının kabulüyle workspace sahipliği devri.
- Uygulama/bağlantı kaydı, dar kapsamlı servis kimliği saklama/yenileme/iptali.

Kabul:

- Menü ve API aynı izin kurallarını uygular.
- Yetkisiz kullanıcı doğrudan URL ile erişemez.
- Tüm yönetim değişiklikleri audit üretir.
- Kullanıcı kendini süper yönetici yapamaz.
- Başka rolü düzenleyerek dolaylı yetki yükseltme ve başka modüle ID ile erişme reddedilir.
- Audit yazımı başarısızken yerel değişiklik commit olmaz.
- Devre dışı bırakılan kullanıcı veya kaldırılan izin sonraki korumalı istekte reddedilir.
- İki müşteri workspace'i arasında kayıt, cache, kuyruk, audit ve dosya verisi sızmaz; alan rolü kurulum yetkisi vermez.
- Yanlış hesapla, iptal edilmiş token'la veya artık yetkisi olmayan davetçiyle davet kabul edilemez. Devir tamamlanmadan son sahip kaldırılmaz.

## Faz 5: Hızlı kullanım ve ayrıştırıcı deneyim

Öncelik: P1. P0 yayınını bloke etmez.

Amaç: Birden fazla uygulamayı günlük yönetme süresini azaltmak.

Görevler:

- Global arama.
- Komut paleti.
- Favoriler.
- Son kullanılanlar.
- Hızlı işlemler.
- Rol bazlı ana ekran widgetları.
- Uygulama sağlık kartları.
- Tutarlı tablo ve form standardı.

Kabul:

- Kullanıcı temel işleme iki adımda ulaşır.
- Arama yetkisiz sonuç döndürmez.
- Klavye kısayolları belgelenmiş.
- Mobilde kritik akışlar tamamlanır.

## Faz 6: Genel entegrasyon ve ilk gerçek yönetim işi

Faz 6A (P0 ara teslimat): HTTP/JSON sözleşmesi, şemalar, ilk örnekte sağlık/liste/detay ve ikinci bağımsız örnekte salt okunur bağlantı. Faz 6B (P0): ilk örnekte izinli başlık güncelleme ve uçtan uca güvenli yazma. Faz 6C (P1): HubStag, SwzHub ve topluluk ürünleri için ek connector'lar.

Amaç: HubPanel'i gerçek uygulamaların yönetim merkezi yapmak.

Görevler:

- Şema ile doğrulanan manifest ve sürümlü connector sözleşmesi.
- Sentetik içerik servisi ve ikinci bağımsız örnek uygulama.
- Geliştirici hızlı başlangıcı, API örnekleri, izin tablosu ve uyumluluk testleri.
- Servis sağlığı.
- Ortak bildirim ve hata modeli.
- Modül bazlı yetkiler.
- Salt okunur başlangıç ve sonra kontrollü yazma işlemleri.
- 6A: servis kimliği, kaynak yetkisi, SSRF allowlist'i, timeout ve yanıt boyutu sınırları.
- 6B: transactional outbox, idempotency, hata uzlaştırma ve güncel yetki denetimi.

Kabul:

- 6A'da iki bağımsız örnek uygulama çekirdek değişmeden bağlanır; 6B'de ilk örneğin başlığı gerçekten güncellenir.
- Sağlık durumu güncellenir.
- Modül erişimi rol ile sınırlanır.
- Bir uygulama çökünce HubPanel çökmez.
- Redirect veya DNS değişimi izinli servis sınırını aşamaz.
- 6B: timeout ve yeniden deneme aynı uzak işlemi iki kez uygulamaz; sonucu bilinmeyen iş başarılı gösterilmez.
- 6B: stale sürüm/ETag ile yazma 409 benzeri güvenli çakışma döndürür; başka kullanıcının değişikliği sessizce ezilmez.
- Bağlantı kaldırıldığında yeni işler durur; uzak kimlik iptali doğrulanmadan yerel sır silinmez. İptal kesintisi ayrı durumla takip edilir; kullanıcıların dış panel parolaları toplanmaz.
- İki müşteri hesabı yalnızca kendi kaynaklarını yönetebilir; yapılan iş doğru workspace/uygulama altında audit üretir.
- Dış geliştiriciyle dokümandan ilk bağlantı denemesi yapılır; 30 dakika hedefi ölçülür ve sonuç kaydedilir.

## Faz 7: Gelişmiş güvenlik

Öncelik: P1. P0'nun zorunlu TOTP, kurtarma, step-up ve oturum iptali bu faza bırakılmaz.

Amaç: P1 güvenlik özelliklerini kontrollü eklemek.

Görevler:

- SMS OTP adapteri.
- Google OIDC girişi.
- Bakım gören ortak kimlik sağlayıcısı üzerinden destekleyen harici panellere OIDC SSO.
- Passkey/WebAuthn.
- Cihaz yönetimi.
- Step-up için ek faktör desteği (temel doğrulama Faz 3–4'te).
- Şüpheli giriş bildirimi.
- IP/cihaz risk kuralları.
- Yedekleme ve geri yükleme ekranı.

Kabul:

- Her yöntem rol politikasına bağlı.
- Google girişi tek başına yönetici 2FA politikasını atlatmaz.
- Riskli işlemler kısa süreli yeniden doğrulama ister.
- SMS/e-posta sağlayıcı kesintisi zorunlu TOTP'yi düşürmez; kayıtlı faktör veya belgeli kurtarma kullanılır.
- SSO kimliği doğru yerel üyeliğe bağlanır; giriş, çıkış ve yetki iptali senaryoları ayrı doğrulanır. Desteklenmeyen uygulamada tek giriş çalışıyor iddiası yoktur.

## Faz 8: Sertleştirme ve yayın

Bu bir yayın kapısıdır: ilk P0 sürümünde ve sonraki P1 sürümlerinde tekrarlanır. Özelliklerin bu fazda ilk kez güvenli hale getirilmesi beklenmez.

Amaç: Üretim güvenliği ve güvenilirliği.

Görevler:

- Yük, erişilebilirlik ve güvenlik testleri.
- Bağımlılık ve container taraması.
- Yedek geri yükleme tatbikatı.
- Log ve alarm kuralları.
- Dokümantasyon.
- Sürüm notları.
- Kademeli yayın planı.

Kabul:

- Kritik testler yeşil.
- Güvenlik taramasında kritik açık yok.
- Yedekten geri dönüş test edildi.
- Rollback planı hazır.
- Sürüm yükseltme ve migration hatası denendi; ölçülen minimum kaynaklar belgeli. HubPanel yedeği ile dış uygulama yedeğinin sınırı açık.
- HubPanel kapalıyken örnek uygulamanın ziyaretçi akışı çalışır. İlk gerçek pilot kendi HubStag ekibimizle yürür; topluluk yayını öncesinde ayrıca dış geliştiriciyle kurulum denenir. [Pilot planı](02-pilot-ve-mobil-plani.md) uygulanır; yalnızca başlık güncelleme demosu ürünün tümü için yeterlilik iddiası değildir.
- Workspace veri export/silme ve kurulumlar arası teslim prosedürü hazır; sırlar ve başka müşteri verileri dışa aktarılmaz.
- [Tehdit modelindeki](../03-Mimari/03-tehdit-modeli-ve-kabul-testleri.md) ilgili olumsuz senaryolar ve yarış durumları test edildi.
- Güvenlik bildirimi kanalı, lisans ve yayın kapsamı netleşti.

## Bağımlılık sırası

```text
Faz 1 -> Faz 2
Faz 1 -> Faz 3
Faz 2 + Faz 3 -> Faz 4
Faz 4 -> Faz 6A
Faz 6A -> Faz 6B (P0)
Faz 4 + Faz 6B -> Faz 8 (P0 yayını)
Faz 4 -> Faz 5 (P1)
Faz 6B -> Faz 6C (P1)
Faz 3 + Faz 4 -> Faz 7 (P1)
Seçilen P1 teslimatı -> Faz 8 (ilgili kontroller tekrar)
```

Faz 2 ile Faz 3 kısmen paralel ilerleyebilir. Faz 7, çekirdek auth testleri tamamlanmadan başlamamalı. P1 özelliklerinin tamamı ilk yayının ön koşulu değildir.
