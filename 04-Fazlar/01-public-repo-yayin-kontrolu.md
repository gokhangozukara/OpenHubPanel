# Public Repo Yayın Kontrolü

Durum: Public kaynak deposu https://github.com/gokhangozukara/OpenHubPanel adresinde oluşturuldu ve ilk kaynak kod gönderildi. Bu, üretim uygulamasının dağıtıldığı anlamına gelmez; canlı sistem kurulumu yapılmadı.

## Yayın kapsamı

Kök `.gitignore`, tüm `BundanOrnekAlacaz/` kopyalarını, mevcut sisteme ait `01-Arastirma/02-swzhub-degerlendirmesi.md` incelemesini ve `*.local.md` notlarını dışlar. Bu yerel dosyalar lisanslarıyla korunur; public kullanıcıya gerekli mimari ve genel raporlar depoda kalır. `.dockerignore` ilerideki build bağlamı için benzer sınır koyar.

`.gitignore` daha önce takip edilmiş dosyayı veya geçmişteki sırrı temizlemez. Klasörü ZIP yapıp paylaşmak da ignore kurallarını uygulamaz. Yayın arşivi yalnızca incelenmiş Git içeriğinden üretilmelidir. Bir sır geçmişe girdiyse dosyayı silmek yeterli değildir; önce sır iptal edilir/yenilenir, ardından geçmiş ve yayın artefaktları incelenir.

## İlk public yayından önce

- [x] Repo: `gokhangozukara/OpenHubPanel`; public olarak oluşturuldu.
- [x] Ticari kullanım ve serbest dağıtım hedefi için köke MIT `LICENSE` eklendi; telif satırı `2026 Gokhan Gozukara`.
- [x] Güvenlik sorumlusu Gokhan Gozukara; özel e-posta kanalı `gokhangozukara@gmail.com`, `SECURITY.md` içinde tanımlı. E-posta gönderimi/teslim testi yapılmadı.
- [x] GitHub private vulnerability reporting etkinleştirildi ve API ile doğrulandı.
- [x] README erken geliştirme/yerel örnek önizleme aşamasını ve üretime hazır olmadığını açıklar.
- [x] Mevcut kurulumun özel bilgileri ve referans kopyalar Git dışında; görünen hesaplar sentetiktir. Kullanıcının açıkça verdiği proje sahibi/e-posta bilgisi iletişim için yayımlanır.
- [x] Takip edilen kaynaklar ve staged içerik incelendi; referans/yerel rapor zorla eklenmedi.
- [x] Gitleaks 8.30.0 ile staged kaynak ve geçmiş tarandı; tek bilinçli yanlış CI token fingerprint'i gerekçeli istisnadır. Sır değerleri loglanmadı.
- [x] Public Markdown bağlantıları takip edilen dosyalar üzerinden doğrulandı; yerel notlar kod biçiminde ve isteğe bağlı belirtilir.
- [x] Kilitli bağımlılıklar ve lisans metadata envanteri mevcut; paketlerin kendi LICENSE/NOTICE dosyaları korunur. README ekranı sentetik veri içerir.
- [x] CI contents:read ile çalışır; dış PR'lara sır veya yayın yetkisi verilmez, action'lar commit SHA ile sabittir.
- [ ] Ana dal PR/onay korumaları ve sürüm yayın politikası yapılandırılacak.

## Uygulama yayını için ek kapı

Faz 8 kabulü, güvenlik testleri, bağımlılık/container taraması, anahtar yönetimi, yedekten geri dönüş ve rollback kanıtı gerekir. Dokümanın yayınlanabilmesi uygulamanın güvenli olduğu anlamına gelmez.

## Açık ürün kararları

1. Ürün yönü kesinleşti: topluluğun kendi sunucusuna kurabileceği, müşteri çalışma alanlarını ve dış uygulamaları birleştiren admin hub. Merkezi barındırılan hizmet işletimi sonraki kapsamdır; P0 workspace izolasyonu zorunludur.
2. Repo adresi, MIT, kurucu ve güvenlik kanalı belirlendi. Branch korumaları ve yayın yönetişimi ayrıca takip edilir.
3. İlk örnekler: sentetik içerik servisi ve bağımsız ikinci API; dil/uygulama ayrıntısı geliştirme başında seçilir. HubStag/SwzHub erişimi ürünün başlamasına bağımlılık değildir.
4. E-posta sağlayıcısı, alan adı ve işletim sorumlusu; saklama süreleri ve geri dönüş hedeflerinin kabulü.

Bu kararlar seçilmeden plan incelenebilir; eksik kararlar tamamlanmış gibi gösterilmez. Faz 1 iskeletinin ilk teknik işi, auth kütüphanesi seçimi ve sır içermeyen yerel kurulum/CI sözleşmesidir.

Kaynak: [GitHub özel güvenlik bildirimi yapılandırması](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
