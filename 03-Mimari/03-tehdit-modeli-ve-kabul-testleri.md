# Tehdit Modeli ve Güvenlik Kabul Testleri

Tarih: 2026-11-06. Durum: uygulama öncesi test sözleşmesi; aşağıdaki testler henüz çalıştırılmış değildir.

## Varlıklar ve sınırlar

Korunan varlıklar: yönetici yetkisi, oturum/MFA sırları, modül servis kimlikleri, kullanıcı verisi, denetim kayıtları ve yedekler.

Güven sınırları: tarayıcı → web; web/worker → PostgreSQL/Redis; adapter → harici servis; uygulama → e-posta/SMS sağlayıcısı; CI → paket/container deposu. Modülün bozulması diğer modüllere yetki vermemelidir. ADR-005 gereği P0 müşteri workspace izolasyonunu içerir; SEC-19–24 ve mevcut kaynak yetkisi testleri geçmeden bu güvenceyle üretime alınamaz.

Saldırgan modelleri: anonim internet kullanıcısı, düşük yetkili hesap, başka müşteri workspace'inin üyesi/sahibi, çalınmış parola/oturum, kötü niyetli dosya veya servis yanıtı, ele geçirilmiş bağımlılık. Sunucuda root/DB superuser erişiminin ele geçirilmesi ayrı felaket kurtarma sınırıdır; yalnızca uygulama koduyla engellendiği iddia edilmez.

## Negatif kabul matrisi

| Kimlik | Senaryo                                                                                          | Beklenen sonuç                                                                      | Faz                |
| ------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------ |
| SEC-01 | İki eşzamanlı ilk yönetici kurulumu; süresi dolmuş/tekrar kullanılan davet                       | Tek kurulum; diğerleri reddedilir; istemci rol seçemez                              | 3                  |
| SEC-02 | Doğru parola, tamamlanmamış MFA ile API/server action                                            | Yönetim verisi ve yan etki yok; yalnızca ön-oturum                                  | 3                  |
| SEC-03 | Aynı TOTP zaman adımı veya kurtarma koduyla eşzamanlı iki istek                                  | En fazla bir başarı; tüketim DB'de atomik                                           | 3                  |
| SEC-04 | Yeni challenge, OTP tekrar gönderme veya cihaz değişimiyle limit aşma                            | Hesap limiti korunur; Redis kesilince doğrulama kapalı                              | 3                  |
| SEC-05 | E-posta/SMS veya parola sıfırlamayla TOTP'yi kaldırma                                            | MFA korunur; kurtarma oturumu yönetim API'sine erişemez                             | 3                  |
| SEC-06 | Çalınmış eski çerez; çıkış, iptal, parola/faktör değişimi sonrası istek                          | Sonraki korumalı istekte reddedilir; eski token yeniden kullanılamaz                | 3–4                |
| SEC-07 | Başka kullanıcı/işlem/hedef/payload için step-up kanıtı; replay                                  | Reddedilir; yalnızca bağlı işlem bir kez uygulanır                                  | 3–4                |
| SEC-08 | Başka modülün kayıt/dosya ID'si; doğrudan action; arama/export                                   | Kaynak kapsamı sunucuda reddedilir; veri sızıntısı yok                              | 4, 6               |
| SEC-09 | Yetkisinin üstünde rol verme; dolaylı rol düzenleme; eşzamanlı son yönetici kaldırma             | Yetki yükselmez; en az bir etkin süper yönetici kalır                               | 4                  |
| SEC-10 | Sahte origin, eksik CSRF, kötü yönlendirme, sahte forwarded IP                                   | State değişmez; proxy dışı IP başlığı kabul edilmez                                 | 3–4                |
| SEC-11 | DB/audit yazımı başarısız; iş transaction'ı rollback                                             | Yerel değişiklik ve başarı bildirimi yok; başarısız güvenlik olayı kaybolmaz        | 3–4                |
| SEC-12 | Harici yazma timeout'u, worker tekrar teslimi, izin iptali                                       | İdempotent sonuç/uzlaştırma; ikinci yan etki yok; iptal edilen yetkiyle yeni iş yok | 6B                 |
| SEC-13 | Metadata/loopback URL, özel IP, DNS değişimi veya redirect                                       | Allowlist dışına bağlantı yok; izinli özel servis istisnası açık ve dar             | 6A                 |
| SEC-14 | Sahte MIME/uzantı, SVG/HTML, büyük veya kotayı aşan dosya                                        | Depolamadan önce reddedilir; yetkisiz indirme yok                                   | Yükleme eklenmeden |
| SEC-15 | Yanlış OIDC issuer/audience/nonce; tekrar callback; aynı e-postalı başka kimlik                  | Callback reddi veya açık hesap bağlama; otomatik hesap birleşmesi yok               | 7                  |
| SEC-16 | Log, trace, kuyruk hata ekranı ve cache içinde sır/cross-user veri                               | Sır yok; özel yanıt başka kullanıcıya veya genel cache'e verilmez                   | 1–8                |
| SEC-17 | Eski yedek geri yüklenince eski oturum/kurtarma kodu yeniden etkinleşmesi                        | İptal/yeniden kayıt runbook'u uygulanır; kayıp anahtar durumu test edilir           | 8                  |
| SEC-18 | Public Git veya container bağlamında referans, env, backup                                       | Yayın engellenir; istisna yalnızca sahte değerli `.env.example` için                | 0–8                |
| SEC-19 | Başka workspace ID'si, cross-tenant foreign key, RLS sahibi/bypass rolü veya havuzda eski bağlam | Erişim reddedilir; uygulama rolü RLS atlayamaz; transaction bağlamı sızmaz          | 1–4                |
| SEC-20 | Workspace değişiminde geç gelen yanıt, cache/cursor/idempotency çakışması                        | Eski alan verisi gösterilmez; anahtarlar alan/uygulama kapsamında                   | 2–6                |
| SEC-21 | Üyelik/bağlantı iptali sonrası kuyruk işi ve servis anahtarı kullanımı                           | Yeni iş reddi; hedef anahtar iptali; başlamış iş sonucu uzlaştırılır                | 4–6B               |
| SEC-22 | Workspace sahibinin global hesabı veya diğer alan üyeliğini değiştirmesi                         | İşletmeci ayrıcalığı kazanamaz; yalnızca kendi alanını yönetir                      | 4                  |
| SEC-23 | Connector manifestinde kod/HTML, uyumsuz sürüm, izinli olmayan capability                        | Çalıştırma/veri değişikliği yok; anlaşılır uyumluluk/izin hatası                    | 6A–6B              |
| SEC-24 | Aynı kaynağa eski sürümle eşzamanlı yazma; başka alana step-up taşıma                            | Çakışma veya yetki reddi; ikinci yan etki ve kapsam atlama yok                      | 6B                 |

Her senaryo başarı yoluyla birlikte test edilir; yalnızca 401/403 almak yeterli değildir, veritabanı/uzak servis yan etkisinin oluşmadığı da doğrulanır. Yarış testleri gerçek PostgreSQL üzerinde paralel isteklerle; zaman aşımı testleri kontrollü saatle yapılır. Test verisi sentetiktir.

## Gözlem ve kabul kaydı

- Faz 1: test komutları, CI ve bağımlılık/lisans kaydı oluşturulur.
- Faz 3–4: auth, yetki, audit ve iptal testleri PR kapısı olur.
- Faz 6: servis sınırı testleri kontrollü sahte servis üzerinde çalışır; canlı sisteme saldırı testi yapılmaz.
- Faz 8: test raporu, tarama zamanı, geri yükleme sonucu ve rollback kanıtı sürüm kaydına eklenir. Açık kritik/yüksek bulgular kapanmadan yayın yapılmaz.

Dayanak: [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). Matristeki faz ve limitler HubPanel tasarım kararlarıdır.
