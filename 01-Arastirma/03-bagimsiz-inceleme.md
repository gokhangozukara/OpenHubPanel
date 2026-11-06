# HubPanel Bağımsız İnceleme

Tarih: 2026-11-06. Kapsam: yerel planlar, mimari kararlar, referansların seçili güvenlik akışları ve public depo hazırlığı.

Ürün yönü güncellemesi: Bu rapor ilk incelemenin kaydıdır. Tek kuruluş, tek salt okunur adapter ve P1 yazma sırası [ADR-005](../06-Kararlar/ADR-005-admin-panellerinin-hubu.md) ile değiştirildi. Güncel P0 müşteri workspace'leri, genel connector sözleşmesi ve bir örnek yazma işlemini içerir; güncel faz sırası [yol haritasındadır](../04-Fazlar/00-yol-haritasi.md).

## Değerlendirme

Modüler monolit, sunucu tarafı oturum, özgün uygulama kodu ve işlemle birlikte audit yaklaşımı doğru bir başlangıç oluşturuyor. Ancak önceki belgelerde güvenlik davranışını değiştirebilecek çelişkiler vardı. Bunlar dokümanlarda düzeltildi; henüz çalışan HubPanel uygulaması olmadığı için uygulama güvenliği doğrulanmış değildir.

## Öncelikli bulgular ve uygulanan düzeltmeler

| Öncelik | Bulgu                                                                                                                 | Yapılan düzeltme                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Yüksek  | E-posta/SMS yedek girişi zorunlu TOTP'nin daha zayıf bir yoldan aşılmasına izin verebiliyordu                         | Doğrulama/bildirim ile giriş ayrıldı; kurtarma koduna yalnızca kısıtlı kurulum oturumu tanımlandı                                                |
| Yüksek  | Step-up P1/Faz 7'de, riskli yönetim işlemleri Faz 4'teydi                                                             | Step-up temeli Faz 3'e, yönetim işlemlerinde kullanımı Faz 4'e alındı                                                                            |
| Yüksek  | İlk yönetici, davet, tüm faktörleri kaybetme ve son yönetici koruması tanımlı değildi                                 | Bootstrap, kısıtlı kurtarma, manuel runbook ve atomik son yönetici koruması eklendi                                                              |
| Yüksek  | İzin adı kontrolü nesne/modül kapsamı ve dolaylı rol yükseltmesini yeterince açıklamıyordu                            | Kaynak kapsamı, izin devri sınırı, güncel yetki ve negatif testler eklendi                                                                       |
| Yüksek  | Modül API/sağlık adresleri için servis güven sınırı eksikti                                                           | Statik manifest, dar servis allowlist'i, SSRF/redirect/DNS sınırları ve servis kimliği eklendi                                                   |
| Yüksek  | Harici işlem ve yerel audit aynı transaction'a alınabilir gibi okunabiliyordu                                         | Uzak yazmalar için outbox, idempotency ve belirsiz sonucu uzlaştırma sözleşmesi eklendi                                                          |
| Yüksek  | Kök yayın dışlama kuralları yoktu; referanslar, eski dosyalar ve yerel işletim bilgileri yanlışlıkla paylaşılabilirdi | `.gitignore` ve `.dockerignore` eklendi; mevcut sisteme ilişkin detaylar yerel tutuldu, public kaynak notundan canlı adres/sunucu yolu çıkarıldı |
| Orta    | OIDC hesap eşleme, OTP yarışları, ön-oturum ve oturum iptali eksik tanımlıydı                                         | Hesap bağlama kanıtı, atomik tüketim, ön-oturum ayrımı ve zorunlu iptal kuralları eklendi                                                        |
| Orta    | Audit için mutlak değiştirilemezlik iddiası ve P2'ye ertelenen saklama politikası vardı                               | Uygulama/DB işletmecisi sınırı, P0 saklama ve yedek geri dönüş politikası açıklandı                                                              |
| Orta    | İlk sürüm iki entegrasyon ve birçok kullanım hızlandırıcısına bağımlıydı                                              | Tek salt okunur adapter P0; global arama, favoriler ve ikinci adapter P1 oldu                                                                    |
| Düşük   | Tailwind sürümü ile manifest aralığı karıştırılmış, upstream dosya sayımı tutarsızdı                                  | Manifest/kilit ayrımı yapıldı; 403 ve 391 dosya yeniden sayıldı                                                                                  |

Öncelikler bir tasarım incelemesinin sıralamasıdır; çalışan uygulama için CVSS puanı veya sömürü kanıtı değildir. Güvenlik kararlarının gerekçesi [ADR-004](../06-Kararlar/ADR-004-guvenlik-incelemesi.md) ile korunur.

## Referans kod incelemesinin sınırı

İki yerel referansta toplam 794 dosya sayıldı. Kimlik/oturum, giriş, bazı veri değiştiren işlemler, audit, yükleme ve paket/kilit dosyaları seçilerek okundu. Bütün dosyaların satır satır denetlendiği iddia edilmez. Referans kodlar değiştirilmedi veya HubPanel'e kopyalanmadı.

Mevcut sisteme ait somut kaynak konumları ve güvenlik bulguları `01-Arastirma/04-referans-kod-incelemesi.local.md` içindedir; public depoya dahil edilmez. Canlı sisteme bağlanılmadı, saldırı testi veya dağıtım yapılmadı. Kaynak koddaki eksik kontrol, canlı ortamın kesinlikle sömürülebildiği anlamına gelmez; ağ/proxy ve dağıtım durumu ayrıca doğrulanmalıdır.

## Secret ve veri incelemesi

Yerel metin dosyalarında özel anahtar başlığı, yaygın sağlayıcı token biçimleri, kimlik bilgili URL ve doğrudan secret ataması için örüntü kontrolü yapıldı. İncelenen örüntülerde gerçek bir özel anahtar/sağlayıcı token'ı/kimlik bilgili URL eşleşmesi görülmedi. Secret adı eşleşmelerinin ikisi çeviri etiketi çıktı. Bu kontrol genel amaçlı secret scanner veya manuel tam veri incelemesi yerine geçmez.

Adres benzeri eşleşmelerde demo verileri ve yerel işletim bilgileri de vardı; bunların tümünün gerçek kişiye ait olup olmadığı belirlenmedi. Referans klasörü bütünüyle yayın dışında tutuldu. Görsel dosyalar OCR/görsel mahremiyet incelemesinden geçirilmedi. Public yayın öncesinde gerçek Git içeriği ve geçmişi ayrıca taranmalıdır.

## Kesinleşmesi gereken kararlar

1. Güncelleme: Kullanıcının serbest ticari kullanım hedefiyle MIT lisansı eklendi; Gokhan Gozukara, `gokhangozukara` hesabı ve verilen e-posta iletişim kanalı olarak belgelendi. Nihai uzak repo adresi ve GitHub ayarları açık.
2. Güncelleme: ADR-005 ile kendi sunucusuna kurulan çok workspace'li admin hub kararı alındı; izolasyon ilk sürüme dahil edildi.
3. İlk genel connector'un şema ayrıntıları ve örnek uygulamalar; ürün vizyonu ve sözleşme taslağı ADR-005 kapsamında belgelendi.
4. Auth kütüphanesi ve e-posta sağlayıcısı; bakım/güvenlik durumu ve lisans incelemesi Faz 1 çıktısı.
5. Saklama süreleri, yedek hedefleri ve manuel kurtarma sorumlusu. Belgelerdeki süreler başlangıç politikasıdır.

## Revize faz sırası

`Faz 1 → Faz 2 + Faz 3 → Faz 4 → Faz 6A → Faz 8 (P0)`

Faz 5, 6B ve 7 seçilen P1 özellikleri olarak ilerler; her yayın ilgili Faz 8 kontrollerini tekrarlar. Public plan deposu için ayrıca [yayın kontrol listesi](../04-Fazlar/01-public-repo-yayin-kontrolu.md) kullanılır.

## İlk uygulama adımı

Faz 1'de sır içermeyen bir monorepo ve kurulum/CI sözleşmesi oluşturulur. İlk çalışan dikey akış; tek yönetici kurulumu → parola/TOTP → sunucu oturumu → yetkili bir okuma → çıkış/iptal → audit olacaktır. Böylece kapsamlı ekranlardan önce güvenlik altyapısı gerçek bir uçtan uca akışla doğrulanır. Bu incelemede üretim uygulaması başlatılmadı.

## Doğrulama

Doküman bağlantıları, yayın dışlama davranışı, referans dosyalarının değişmediği ve eski kararlarla çelişkiler kontrol edilir; nihai sonuç [proje durumunda](../PROJE-DURUMU.md) kaydedilir. Kök uygulama paketi olmadığı için HubPanel typecheck/lint/build ve runtime güvenlik testleri bu aşamada uygulanamaz. İlk incelemenin 18 senaryosu, ADR-005 ile 24'e çıkarıldı; güncel liste [tehdit modelindedir](../03-Mimari/03-tehdit-modeli-ve-kabul-testleri.md).

Güvenlik davranışı düzeltmeleri [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) ve [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation) ile karşılaştırıldı. Bu bir sertifikasyon veya tam sızma testi raporu değildir.
