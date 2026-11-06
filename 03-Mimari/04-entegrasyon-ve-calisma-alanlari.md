# Entegrasyon, Çalışma Alanları ve Tek Giriş

Durum: ADR-005 kapsamındaki uygulama sözleşmesi taslağı. Henüz connector veya çalışan SSO yoktur.

## Ortak kavramlar

| Kavram                      | Anlamı                                                                   |
| --------------------------- | ------------------------------------------------------------------------ |
| Kurulum                     | İşletmecinin çalıştırdığı HubPanel örneği                                |
| Workspace / çalışma alanı   | Bir müşteri veya ekibin veri ve yetki sınırı                             |
| Uygulama                    | Çalışma alanına kaydedilmiş bir site, servis veya mevcut panel           |
| Connector                   | Harici API'yi HubPanel sözleşmesine uyarlayan bağlantı türü              |
| Bağlantı                    | Connector'un belirli uygulama için adres, kapsam ve servis kimliği ayarı |
| Resource / kaynak           | Ürün, yazı veya destek talebi gibi yönetilen kayıt türü                  |
| Capability / işlem yeteneği | Okuma, oluşturma, güncelleme gibi açıkça ilan edilmiş işlem              |

Bir kullanıcı birden çok alana üye olabilir; rol ve uygulama izinleri her alanda ayrı belirlenir. Kurulum işletmecisi altyapı üzerinde ayrıcalıklıdır; workspace sahibi rolü başka müşterinin verisine erişim vermez. İşletmeci/root'a karşı kriptografik müşteri gizliliği vaat edilmez.

## Üç bağlantı düzeyi

| Düzey                 | Kullanıcıya sağlanan iş                                        | Tek giriş davranışı                                                                     |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Bağlantı kartı        | Mevcut paneli güvenli dış bağlantıyla açar                     | Dış panel yeniden giriş isteyebilir; arayüz bunu belirtir                               |
| API entegrasyonu (P0) | Veriyi ve işlemleri HubPanel'in kendi ekranlarında yönetir     | Kullanıcı yalnızca HubPanel'e giriş yapar; dış API'ye sunucu servis kimliğiyle erişilir |
| OIDC SSO (P1)         | Destekleyen harici panelin kendi ekranına ortak kimlikle geçer | Uygulamaların aynı güvenilir kimlik sağlayıcısına bağlanması gerekir                    |

Kullanıcıların başka panellerdeki parolaları toplanmaz; otomatik parola doldurma veya ortak domain çereziyle giriş taklidi yapılmaz. Bir iframe ile paneli göstermek kimlik/yetki entegrasyonu sayılmaz.

OIDC'de HubPanel ve bağlı panel, bakım gören ortak sağlayıcının istemcileri olur. Sağlayıcı kimliği yerel workspace üyeliği ve MFA politikasıyla eşleştirilir; sadece e-posta benzerliği yetki vermez. Sağlayıcının ikinci faktör güvencesi doğrulanamıyorsa HubPanel yerel TOTP ister. Tek giriş ve tüm uygulamalardan çıkış ayrı kabul senaryolarıdır; iptal/yetki kaybının bağlı uygulamalara nasıl yansıyacağı belgelenir. [OpenID Foundation](https://openid.net/developers/how-connect-works/)

## İlk connector sözleşmesi: HTTP + JSON

Belge taslağı sürümü `0.1`; yayın API sürümüyle aynı kavram değildir. PHP, Python, Node.js veya başka bir backend aynı HTTP sözleşmesini uygulayabilir. P0 için dil bağımlı SDK kurmak zorunlu değildir.

Connector tanımı; kimlik, sözleşme sürümü, kaynak şemaları, desteklenen işlemler ve gerekli izinleri taşır. Uygulama kaydı ise çalışma alanına ait bağlantı örneğidir. Manifestte çalıştırılabilir JavaScript, SQL, şablon kodu, token veya rastgele tam URL bulunmaz.

İlk örnek kaynak `articles` olacaktır: `id`, `title`, `status`, `version`. P0 akışı liste → detay → başlık güncelleme ile sınırlıdır; keyfi tabloya CRUD açılmaz. İkinci örnek uygulama aynı sözleşmeyle bağımsız bir kaynağı salt okunur sunar.

| İşlem             | Örnek göreli uç                        | Beklenen sözleşme                                              |
| ----------------- | -------------------------------------- | -------------------------------------------------------------- |
| Sağlık            | `GET /hubpanel/v1/health`              | Genel durum ve desteklenen sözleşme sürümü; iç hata/secret yok |
| Liste             | `GET /hubpanel/v1/articles?cursor=...` | İzinli alanlar, sınırlı sayfa boyutu, opaque sonraki cursor    |
| Detay             | `GET /hubpanel/v1/articles/{id}`       | Kaynak kapsamı ve sürüm/ETag                                   |
| Başlık güncelleme | `PATCH /hubpanel/v1/articles/{id}`     | İzinli alanlar, beklenen sürüm ve idempotency anahtarı         |

JSON Schema/OpenAPI şeması, sentetik istek/yanıt örnekleri ve çalışan örnek sunucu Faz 6A çıktısıdır. Hata modeli kod + güvenli mesaj + request ID içerir; 401, 403, 404, 409, 429 ve servis kesintisi ayrı ele alınır. Uyumsuz ana sözleşme sürümü bağlantıyı açık hata ile durdurur.

P0 arayüzü HubPanel'e ait sınırlı liste/detay/form bileşenleriyle oluşturulur. Connector verisi HTML/kod olarak çalıştırılmaz. Desteklenmeyen işlem gizlenir; capability beyanı yetki yerine geçmez. HubPanel güncel üyelik ve kaynak iznini doğrular, hedef API de servis kimliğinin izinli müşteri/kaynak kapsamını uygular. Kullanıcıdan gelen `workspace_id` veya `actor_id` başlığına güvenilmez.

## Bağlantı yaşam döngüsü

1. Workspace sahibi, kurulum işletmecisinin izin verdiği connector türü ve servis hedefini seçer.
2. API adresi/kimliği sunucuda doğrulanır; bağlantı testi yalnızca sağlık ve yetki kapsamını okur, veri değiştirmez.
3. Gerekli izinler kullanıcıya gösterilir; ilk bağlantı salt okunur açılır.
4. Yazma ayrı yetki, bağlantı kapsamı ve step-up ile etkinleşir. Uzak yazma outbox/idempotency kontrolleri geçmeden açılamaz.
5. Durum; bağlı, yetki hatası, ulaşılamıyor veya uyumsuz olarak anlaşılır biçimde gösterilir. Geçici kesintide son başarılı kontrol zamanı görünür.
6. Bağlantı kaldırmada önce yerel bağlantı devre dışı bırakılır; yeni işler durur, bekleyen işler iptal/uzlaştırmaya alınır. Hedef servis anahtarı iptal edildikten sonra yerel sır silinir. İptal başarısızsa bağlantı kapalı kalır ve “uzak anahtar iptali bekliyor” durumu gösterilir; gerekiyorsa hedef panelde manuel iptal yapılır. Sır yalnızca sınırlı iptal süreci için korunur, normal çağrılarda kullanılamaz. Başlamış uzak işlemler geri alınmış gibi gösterilmez; audit korunur. Kayıt kaldırmak uzak müşteri verisini silmez.

P0'da kurulum işletmecisi hedef allowlist'ini dağıtım yapılandırmasından yönetir; workspace kullanıcısı yeni ağ hedefi açamaz. Özel ağ servisleri ancak belirli host/port izniyle kabul edilir. SSRF, DNS ve redirect kontrolleri sağlık testi dahil tüm HTTP çağrılarında uygulanır.

Servis kimliği her bağlantı/müşteri için ayrı, dar kapsamlı ve iptal edilebilir olmalıdır. Sırlar sunucuda şifreli saklanır, tarayıcıya geri verilmez ve loglanmaz. Harici API müşteri kapsamını ayıramıyorsa farklı müşteriler için ortak geniş yetkili anahtar kullanılamaz; ayrı servis örneği veya ayrı kimlik gerekir.

## Workspace izolasyonu: Faz 1'den itibaren

- `workspaces`, `workspace_memberships`, `applications`, `connections` çekirdek modele girer. Roller ve atamalar workspace kapsamındadır; kullanıcı kimliği ve kişisel oturum global olabilir.
- Kaynağa ait satırlar `workspace_id` taşır. İlişkiler bileşik anahtar/foreign key ile aynı workspace'e bağlanır. Üyelik sunucuda doğrulanmadan header, URL veya formdan gelen alan seçimi kabul edilmez.
- PostgreSQL RLS ikinci savunma katmanıdır. Uygulama/worker rolleri tablo sahibi veya `BYPASSRLS` değildir; kapsamlı tablolarda `FORCE ROW LEVEL SECURITY` kullanılır. Tenant bağlamı transaction içinde yerel tutulur, havuz bağlantısında başka isteğe sızmaz. Migration/işletmeci rolleri ayrı tutulur.
- Cache, cursor, dosya erişimi, rate limit, audit, idempotency ve kuyruk işleri workspace + uygulama kapsamını taşır. Worker güncel üyelik/bağlantı iznini tekrar denetler. Workspace başına kota ve eşzamanlı iş sınırı vardır.
- Workspace değişince önceki alanın liste/form/önbelleği temizlenir; URL'de alan belirgindir. Geç gelen önceki isteğin yanıtı yeni alanın ekranına yazılmaz.
- Workspace daveti yalnızca o alana üyelik verir. Üyelik kaldırılması başka alanlardaki üyeliği değiştirmez; kaldırılan alana sonraki istek reddedilir.
- Her workspace'te son etkin sahip korunur; kurulumun son işletmeci yöneticisi de ayrıca korunur. Alan silme ilk sürümde arayüzden açılmaz; veri dışa aktarma/silme runbook'u yayın kapısında belgelenir.

Kontrol kapsamı [OWASP Multi-Tenant Security](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) ile karşılaştırılmıştır. RLS, uygulama yetki kontrolünün yerine geçmez; gerçek PostgreSQL ile çapraz alan testleri zorunludur. RLS rol/owner davranışı için [PostgreSQL belgesi](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) esas alınır.

## Geliştirici kabulü

Verinin asıl kaynağı hedef uygulamadır; HubPanel birincil içerik deposu değildir. P0 bağlantıları hedef uygulamanın ziyaretçi akışına zorunlu runtime bağımlılık eklemez. HubPanel yedeği hedef servisin veri/dosya yedeği yerine geçmez. Devir, kesinti ve veri çıkışının kabul ayrıntıları [günlük kullanım kontrolünde](../02-Strateji/04-gunluk-kullanim-kontrolu.md) tanımlıdır.

Çekirdeğe özel müşteri kodu eklemeden bağlantı kurulmalı; yalnızca dış uygulama sözleşmesi/adapteri ve izinli bağlantı yapılandırması değişmelidir. Kurulum, minimal örnek, izin tablosu, hata giderme ve uyumluluk testi aynı dokümantasyonda bulunmalıdır. Temiz ortamda bir dış geliştiriciyle ölçülecek hedef: ilk örnek salt okunur bağlantı 30 dakika içinde; henüz ölçülmüş sonuç değildir.
