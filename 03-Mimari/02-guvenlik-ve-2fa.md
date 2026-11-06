# HubPanel Güvenlik ve 2FA Mimarisi

## Güvenlik hedefi

HubPanel yönetici erişimi, tek parola ile korunan bir panel olmayacaktır. Kimlik doğrulama, oturum güvenliği, yetki kontrolü ve denetim birlikte tasarlanacaktır.

Bu belge uygulama sözleşmesidir; kontroller henüz uygulanmış değildir. 2026-11-06 düzeltmeleri [ADR-004](../06-Kararlar/ADR-004-guvenlik-incelemesi.md) ile kayıtlıdır. Saldırı senaryoları ve kabul testleri [tehdit modelindedir](03-tehdit-modeli-ve-kabul-testleri.md).

## 2FA yöntemleri

### Zorunlu temel

- TOTP authenticator uygulaması
- Tek kullanımlık kurtarma kodları
- E-posta adres doğrulama ve kurtarma talebi akışı; yönetici ikinci faktörü yerine geçmez

### İsteğe bağlı

- SMS adapteri; ilk kapsam telefon doğrulama/bildirim
- Google ile giriş; OIDC üzerinden
- Passkey/WebAuthn

Google Authenticator, standart TOTP uygulamasıdır. “Google ile giriş” ile aynı şey değildir; iki özellik ayrı yönetilir.

## Rol bazlı güvenlik politikası

- P0'da süper yönetici, uygulama yöneticisi, operatör ve denetçi için TOTP zorunlu.
- Passkey eklendiğinde doğrulanmış WebAuthn politikası ayrı kararla kabul edilebilir. TOTP phishing'e dayanıklı değildir.
- E-posta ve SMS, zorunlu TOTP'yi karşılamaz; hata veya sağlayıcı kesintisi daha zayıf giriş yöntemini açmaz.
- Google OIDC ile giriş yapılsa bile politika gerektiriyorsa TOTP istenecektir.

## Giriş akışı

1. Kullanıcı parolasını doğrular.
2. Sistem risk kontrolü yapar.
3. Kullanıcı kayıtlı TOTP faktörünü doğrular; kurtarma kodu ayrı ve kısıtlı kurtarma akışına gider.
4. İkinci faktör doğrulanınca kısa ömürlü MFA challenge tamamlanır.
5. Sunucu tarafı oturum oluşturulur.
6. Opak oturum token'ı yalnızca HttpOnly güvenli çerezde tutulur.
7. Başarılı ve başarısız adımlar denetim kaydına yazılır.

Parola doğrulaması başarılı olsa bile ikinci faktör tamamlanmadan panel oturumu açılmaz.

MFA challenge, kullanıcı + tarayıcıdaki opak ön-oturum + amaç ile bağlanır; sunucuda süre, deneme ve tüketim durumu tutulur. Ön-oturum hiçbir yönetim API'sine erişemez. Başarılı MFA'da ön-oturum tüketilir ve yeni, bağımsız oturum token'ı üretilir.

## Parola güvenliği

- Argon2id ile hashleme.
- Her parola için benzersiz salt.
- Başlangıç politikası en az 15 karakter; en az 64 karaktere izin verilir, sessiz kesme yapılmaz. Parola yöneticisi ve yapıştırma desteklenir; zorunlu periyodik değişim/karakter karışımı yoktur.
- Yaygın/ele geçmiş parola kontrolü.
- Parola sıfırlama bağlantısı tek kullanımlık ve kısa ömürlü.
- Parola değişiminde mevcut güçlü faktörle yeniden doğrulama.
- Kullanıcıların parolasını log veya hata mesajında göstermeme.

Argon2id başlangıç alt sınırı `m=19456 KiB, t=2, p=1`; gerçek sunucuda bellek ve eşzamanlı giriş yükü ölçülerek artırılır. Parametreler hash ile saklanır, politika yükselince başarılı girişte yeniden hashlenir. Dayanak: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Parola uzunluğu ve kullanım ilkeleri için [NIST parola bölümü](https://pages.nist.gov/800-63-4/sp800-63b.html#passwordver).

SHA-256 yalnızca parola saklamak için kullanılmayacaktır.

## TOTP güvenliği

- Standart 30 saniyelik TOTP.
- Saat kayması için en fazla bir komşu pencere.
- Faktörün son kabul edilen zaman adımı transaction/koşullu güncelleme ile tutulur; aynı adımı kullanan eşzamanlı isteklerden en fazla biri başarılı olur.
- MFA sırrı veritabanında düz metin tutulmama.
- Sırlar uygulama anahtarıyla AES-GCM gibi kimliği doğrulanmış şifreleme ile saklanacak.
- Anahtar repoda değil, ortam sırrı veya harici secret manager'da olacak.
- TOTP kurulumunda QR ve manuel anahtar gösterilecek.
- İlk kurulumdan önce parola ve davet/bootstrap yetkisi doğrulanır; henüz kurulmamış faktörden kod istenmez. Yeni sırla üretilen TOTP doğrulanınca faktör etkinleşir. Faktör değiştirmede mevcut TOTP veya kısıtlı kurtarma akışı gerekir.
- AES-GCM için her şifrelemede benzersiz nonce, anahtar sürümü ve kullanıcı/faktöre bağlı ek doğrulama verisi tutulur. Anahtarlar DB yedeklerinden ayrı korunur; anahtar rotasyonu ve şifreli yedeğin geri dönüşü test edilir.

## E-posta OTP

- 6-8 haneli kod; başlangıç süresi 5 dakika, challenge başına en fazla 5 yanlış deneme.
- Kod kriptografik rastgelelikle üretilir; düşük entropili kod için DB dışında saklanan ayrı anahtarla HMAC özeti tutulur. Düz SHA-256 kısa kodu çevrimdışı tahmine karşı korumaz.
- Deneme sayısı sınırlı olacak.
- Aynı kod tekrar kullanılamayacak.
- Yeni kod isteme aralığı en az 60 saniye; hesap başına saatte 5, IP başına saatte 30 gönderim başlangıç sınırıdır. Sağlayıcı maliyet kotası ayrıca uygulanır.
- E-posta hesabı değişikliği ayrıca doğrulanacak.
- Kod kullanıcı + amaç + challenge ile bağlıdır; tekrar gönderimde eski kod geçersizleşir ve toplam başarısız deneme sayısı sıfırlanmaz.
- E-posta doğrulaması yönetim oturumu, MFA sıfırlama veya step-up yetkisi vermez. NIST, e-postayı out-of-band kimlik doğrulama yöntemi kabul etmez; burada adres doğrulama/bildirim amaçlıdır. [NIST](https://pages.nist.gov/800-63-4/sp800-63b.html#ooba)

## SMS OTP

- Sağlayıcı bağımsız adapter ile eklenecek.
- Telefon numarası maskeli gösterilecek.
- Kod e-posta OTP ile aynı HMAC, süre, amaç ve atomik tüketim kurallarına tabi olacak.
- Numara değişikliğinde mevcut güçlü faktör istenecek.
- SMS ve e-posta birbirinden farklı risklere sahiptir; hiçbiri zorunlu TOTP veya step-up yerine kullanılamaz. P1 SMS kapsamı bildirim/telefon doğrulamayla başlar; giriş desteği için ayrı karar gerekir.
- Sağlayıcı hataları kullanıcıya iç sistem detayı sızdırmadan gösterilecek.

## Kurtarma kodları

- Her kod tek kullanımlık.
- Her kod en az 128 bit kriptografik rastgelelik taşır; kısa OTP gibi üretilmez. Tüketim atomiktir.
- Hashli saklanacak.
- Kullanıcıya yalnızca oluşturulduğu anda gösterilecek.
- Kullanıldığında olay kaydı oluşturulacak.
- Yeni set yalnızca mevcut TOTP ile step-up veya tamamlanmış kurtarma sonrasında üretilir; eski set bütünüyle iptal edilir.
- Parola + kurtarma kodu yalnızca yeni faktör kurabilen kısa ömürlü kurtarma oturumu verir. Yeni TOTP doğrulanmadan yönetim erişimi açılmaz; faktör değişince eski oturumlar ve bekleyen challenge'lar iptal edilir, kullanıcıya bildirim gider.

## İlk yönetici, davet ve tüm faktörlerin kaybı

- İlk yönetici, sadece güvenilir sunucu işletmecisinin çalıştırdığı tek seferlik kurulum komutuyla başlatılır. Ortak varsayılan parola veya internete açık kurulum endpoint'i yoktur.
- Kurulum token'ı en az 256 bit rastgeledir, yalnızca özeti saklanır, en fazla 15 dakika geçerlidir ve bir kez kullanılabilir. İlk yönetici oluşturulduğunda bootstrap atomik olarak kapanır; iki eşzamanlı kurulum iki yönetici oluşturamaz.
- Kullanıcı daveti alıcı + workspace + amaç + izin kapsamına bağlı, tek kullanımlıktır (başlangıç süresi 24 saat). Yeni hesapta parola ve TOTP kurulur; mevcut hesap kendi kimliğiyle doğrulanır, faktörleri değiştirilmez. Doğrulanmış e-posta davet alıcısıyla eşleşmeli; davetçinin güncel yetkisi ve rol devri sınırı kabul anında tekrar denetlenmelidir. Rol istemci verisinden alınmaz. Yeniden gönderim eski token'ı geçersiz kılar; iptal edilen davet/üyelik eski linkle canlanamaz.
- Parola sıfırlama token'ı en az 256 bit rastgeledir, özeti saklanır, 15 dakikada biter ve tek kullanımlıdır. Yanıt hesap varlığını açıklamaz. Sıfırlama mevcut MFA'yı kaldırmaz; oturumları ve diğer sıfırlama token'larını iptal eder.
- Tüm faktörler ve kurtarma kodları kayıpsa e-posta/SMS ile anında MFA kapatma yapılmaz. Sunucu işletmecisi için kimlik doğrulama, gerekçe, bildirim, audit ve yeniden kayıt adımlarını içeren manuel kurtarma runbook'u Faz 3 teslimatıdır; hazır olmadan gerçek kullanıcı alınmaz.
- Son etkin süper yöneticinin silinmesi, devre dışı bırakılması veya rolünün alınması kilit/transaction ile engellenir.

## Google ve OIDC

- Yetkili redirect URI listesi.
- Authorization Code + PKCE S256; tek kullanımlık `state` ve `nonce`, başlatan tarayıcı oturumuna bağlı doğrulama.
- ID token için imza, izinli algoritma, `iss`, `aud`, gerekiyorsa `azp`, `exp` ve `nonce` doğrulanır; sağlayıcı/JWKS adresi kullanıcı girdisinden alınmaz.
- Dış kimlik `(issuer, subject)` ile tanınır. Doğrulanmış e-posta eşleşmesi bile mevcut hesabı otomatik bağlamaz; kullanıcı mevcut hesabında step-up yaparak açıkça bağlar. Yeni hesapta davet/kayıt politikası uygulanır.
- Domain kısıtlaması desteklenecek.
- İlk bağlantıdan sonra 2FA politikası uygulanmaya devam edecek.
- OAuth hesabı kaldırılırsa kullanıcıya alternatif giriş yöntemi kalması zorunlu olacak.

Dayanak: [OpenID Connect Core ID Token Validation](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation), [OWASP OAuth2](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html).

## Oturum güvenliği

- Sunucu tarafı oturum kaydı.
- Token en az 256 bit kriptografik rastgelelikle üretilecek; veritabanında yalnızca hash saklanacak.
- Çerez: `__Host-hubpanel_session`, `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax` veya daha sıkı; `Domain` verilmez.
- Boşta kalma süresi ve toplam oturum süresi ayrı ayarlanacak.
- Parola değişimi/sıfırlama, MFA değişimi, hesap kurtarma ve kullanıcı devre dışı bırakmada mevcut oturumlar zorunlu iptal edilir. Zorunlu MFA'yı devre dışı bırakma seçeneği yoktur.
- Cihaz adı, tarayıcı, son IP ve son görülme bilgisi tutulacak.
- IP adresi mümkünse maskeli veya kısa süreli saklanacak.
- Kullanıcı tüm cihazlardan çıkış yapabilecek.
- Yetki değişikliğinde aktif oturum yeniden değerlendirilecek.
- Her korumalı istekte hesap durumu, oturum süresi/iptali ve güncel izinler yetkili kaynaktan denetlenir. Redis kopyası veya çerezdeki eski rol tek başına yetki vermez. Kritik yazmada kontrol transaction içinde tekrarlanır.
- Başlangıç sınırları: boşta 15 dakika, toplam 8 saat; sunucuda uygulanır. MFA challenge 5 dakika/5 deneme; step-up en fazla 5 dakika ve tek işlem içindir.

## Brute force ve kötüye kullanım

- IP, hesap ve cihaz bazında hız sınırı.
- Artan bekleme süresi.
- Geçici hesap kilitleme.
- CAPTCHA yalnızca risk oluştuğunda.
- Dağıtık denemelerde Redis tabanlı sayaç.
- Şüpheli girişte e-posta bildirimi.
- Giriş hata mesajı hesabın var olup olmadığını açıklamayacak.
- MFA/OTP limitleri challenge'a ek olarak hesap ve IP üzerinde birikir. Yeni challenge, tekrar gönderim veya cihaz kimliği değişimi hesabın toplam limitini sıfırlamaz.
- İlk parola politikası: hesap başına 15 dakikada 10 başarısız denemede artan gecikme; IP başına dakikada 30 giriş isteği üst sınırı. Sayılar NAT ve yük testleriyle doğrulanır. Kalıcı hesap kilidi saldırganın kullanıcıyı hizmetten mahrum bırakmasına yol açmamalıdır.
- Redis/sayaç doğrulaması çalışmıyorsa yeni giriş, OTP gönderimi ve kurtarma kapalı kalır; sınırsız denemeye düşülmez. Güvenilir reverse proxy haricinden gelen forwarded IP başlıklarına güvenilmez.

## CSRF ve origin

- Form ve state değiştiren isteklerde CSRF token.
- `Origin` ve gerekli durumlarda `Referer` doğrulaması.
- GET istekleri veri değiştirmeyecek.
- Dış yönlendirmelerde allowlist.
- Çerez kullanan tarayıcı değişikliklerinde origin tam eşleşme ile doğrulanır; eksik `Origin` durumunda güvenilir `Referer` ve CSRF doğrulaması zorunludur, kanıt yoksa istek reddedilir. Suffix/substring eşleşmesi yapılmaz.
- CORS kimlik doğrulama değildir. Makine çağrıları ayrı servis kimliği ve kapsam ile doğrulanır; webhook varsa imza, süre ve replay kontrolü kullanır.

## Yetkilendirme

- [ADR-005](../06-Kararlar/ADR-005-admin-panellerinin-hubu.md) ile müşteri çalışma alanları P0'a alınmıştır. Her workspace işleminde güncel üyelik + rol + uygulama/kaynak kapsamı doğrulanır; global kullanıcı oturumu tek başına tenant yetkisi vermez.
- Workspace sahibi yalnızca kendi alanını yönetir; global kullanıcı hesabını veya başka alan üyeliklerini devre dışı bırakamaz. İlgili alan üyeliğini kaldırır. Global hesap/kurulum yönetimi ayrı işletmeci yetkisidir.
- Her workspace'in son etkin sahibi ile kurulumun son yöneticisi ayrı ayrı korunur. Workspace rolü başka alanda veya kurulum seviyesinde yetki yükseltemez.
- Workspace sahipliği devri mevcut sahibin step-up'ı ve MFA kurulu alıcının açık kabulüyle yapılır; kabul anında yetkiler yeniden denetlenir. Sahip ataması, eski rol değişikliği ve audit aynı transaction içindedir. Bekleyen devir eski sahibin erişimini kendiliğinden kaldırmaz.
- Step-up kanıtı ve idempotency anahtarı workspace + uygulama kapsamına da bağlıdır. Bağlantı/servis anahtarı oluşturma, kapsam genişletme ve iptal etme step-up ve audit ister.
- RBAC başlangıç modeli.
- Kaynak + eylem izinleri: `users.read`, `users.manage`, `roles.manage`, `audit.read`.
- Arayüzde menü gizlemek güvenlik sayılmayacak.
- Her API ve server action yetki kontrolü yapacak.
- İzin devri kendi yetki ve modül kapsamını aşamaz; dolaylı rol düzenlemesiyle yükseltme de engellenir. Süper yönetici ataması yalnızca mevcut süper yönetici + step-up + audit ile yapılır.
- Rol değişiklikleri step-up ve audit gerektirir; iki kişi onayı P1'dir.
- Uygulama erişimleri ayrıca modül izinleriyle sınırlanacak.
- Varsayılan karar reddetmektir. Kaynak kimliğini bilmek erişim vermez: kayıt, dosya, arama sonucu, export ve kuyruk işi için nesne/modül kapsamı doğrulanır. Layout veya middleware kontrolü server action kontrolünün yerini tutmaz.

## Yüksek riskli işlemlerde yeniden doğrulama

Step-up doğrulama istenecek işlemler:

- Kullanıcı silme veya devre dışı bırakma
- Rol ve izin değişikliği
- 2FA yöntemi değiştirme veya güvenli kurtarmayla yeniden kurma (P0'da zorunlu MFA kapatılamaz)
- Ortam anahtarı gösterme/yenileme
- Toplu veri dışa aktarma
- Yedek indirme
- Kritik sistem ayarı değiştirme

Normal oturumdaki P0 step-up, mevcut TOTP ile doğrulanır; kullanıcı + oturum + işlem türü + hedef + kritik payload özeti ile bağlanır. İzin ve hedef işlem anında tekrar denetlenir. Kanıt, en fazla 5 dakika geçerli ve tek kullanımlıdır; aynı transaction içinde tüketilir. Retry aynı idempotency anahtarıyla önceki sonucu döndürür, ikinci yan etki oluşturmaz. İşlem/rol değişirse yeni doğrulama gerekir. MFA yönetimi Faz 3'te, çekirdek yönetim uygulaması Faz 4'tedir.

Faktör kaybındaki kısıtlı kurtarma, yukarıdaki kurtarma kodu veya manuel işletmeci prosedürüyle yalnızca yeni faktör kurabilir; kayıp TOTP'den doğrulama beklemez. Bu istisna rol değişikliği, export veya diğer yönetim işlemlerine step-up yetkisi vermez.

## Denetim kayıtları

- Kim, ne, ne zaman, hangi IP, hangi cihaz, hangi hedef ve sonuç.
- Eski/yeni değer farkı seçili alanlarda tutulacak.
- Parola, token, TOTP sırrı ve kurtarma kodu loglanmayacak.
- Uygulama yazma rolünün audit üzerinde yalnızca INSERT yetkisi olur; okuma ayrı yetkiyle, saklama/arşiv ayrı işletmeci rolüyle yapılır. DB yöneticisine karşı mutlak değiştirilemezlik iddia edilmez.
- Yerel yönetim değişikliği ve audit aynı transaction içinde yazılır; audit yazılamazsa değişiklik geri alınır. Harici işlemler outbox sözleşmesine uyar.
- Başarısız giriş/izin olayları iş transaction'ı geri alındığında kaybolmayacak ayrı güvenlik olayı olarak yazılır. Güvenlik olayı kaydı başarısızsa giriş/kurtarma başarıyla tamamlanmaz; alarm üretilir.
- Log bütünlüğü için hash zinciri veya periyodik imza P1 olarak değerlendirilecek.

## Uygulama ve altyapı güvenliği

- Güvenlik başlıkları: HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`.
- Secret'lar repoda tutulmayacak.
- `.env.example` dışındaki env dosyaları Git dışında kalacak.
- Bağımlılık ve container taraması.
- Şifreli yedek ve düzenli geri yükleme testi.
- Veritabanı portu dışarı açılmayacak.
- Yönetici paneli için gerekiyorsa IP allowlist.
- Yükleme dosyalarında boyut, MIME ve güvenli dosya adı kontrolü.
- Hata ayrıntıları kullanıcıya değil loga gidecek.
- Üretimde zorunlu sır eksik/geçersizse uygulama başlangıcı durur; geliştirme varsayılanı üretimde kullanılamaz. Hata logları da sır ve kişisel veri redaksiyonundan geçer.
- Dosyada uzantı/MIME yanında içerik imzası kontrol edilir; MVP'de SVG/HTML yüklemesi kapalıdır. Boyut proxy ve stream katmanında sınırlanır, UUID depolama adı ve kullanıcı kotası uygulanır. Dosya web kökü dışında tutulur ve indirmede yetki kontrolü yapılır.
- Auth ve özel veri yanıtları paylaşılan cache'e alınmaz; sır içeren kurulum sayfaları `no-store` ve uygun referrer politikası kullanır. Genel healthcheck yalnızca genel durum döndürür.

## Veri saklama ve işletim

- Başlangıç politikası: audit 180 gün, güvenlik olayları 90 gün, ham IP en fazla 7 gün; sonrasında maskeleme/silme. Bu süreler ürün önerisidir, hukuk veya uyumluluk beyanı değildir; işletmeci kendi gereksinimini belgelemelidir.
- Audit farkları alan allowlist'iyle üretilir; tüm request/response kaydedilmez. Denetçi görünümünde kişisel alanlar maskelenir.
- Şifreli yedek başlangıç hedefi: günlük, 30 gün saklama; RPO 24 saat ve RTO 4 saat ancak geri yükleme tatbikatıyla kabul edilir. Anahtarların ayrı yedeği ve felaket kurtarma sorumlusu belirlenir.
- Geri yükleme eski oturumları canlandırmamalı; oturumlar, davetler, sıfırlama/MFA challenge'ları iptal edilir. Eski kurtarma kodu/TOTP durumu geri gelebileceğinden güvenilir güncel iptal kaydı yoksa faktör yeniden kaydı gerekir.

## Kabul edilmemesi gereken anti-pattern'ler

- Sabit varsayılan oturum sırrı.
- Parolayı SHA-256 ile hashleme.
- 2FA'yı yalnızca arayüzde göstermek.
- JWT'yi tarayıcı localStorage'da tutmak.
- Rol kontrolünü sadece menü gizleyerek yapmak.
- Aynı OTP'yi tekrar kabul etmek.
- TOTP sırrını düz metin saklamak.
- Denetim kaydını işlemden bağımsız ve başarısız olabilir bırakmak.
