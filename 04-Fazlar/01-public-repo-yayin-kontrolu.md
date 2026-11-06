# Public Repo Yayın Kontrolü

Durum: Yerel hazırlık; depo oluşturulmadı, commit/push veya yayın yapılmadı. Plan deposu ve üretim uygulaması ayrı teslimatlardır.

## Yayın kapsamı

Kök `.gitignore`, tüm `BundanOrnekAlacaz/` kopyalarını, mevcut sisteme ait `01-Arastirma/02-swzhub-degerlendirmesi.md` incelemesini ve `*.local.md` notlarını dışlar. Bu yerel dosyalar lisanslarıyla korunur; public kullanıcıya gerekli mimari ve genel raporlar depoda kalır. `.dockerignore` ilerideki build bağlamı için benzer sınır koyar.

`.gitignore` daha önce takip edilmiş dosyayı veya geçmişteki sırrı temizlemez. Klasörü ZIP yapıp paylaşmak da ignore kurallarını uygulamaz. Yayın arşivi yalnızca incelenmiş Git içeriğinden üretilmelidir. Bir sır geçmişe girdiyse dosyayı silmek yeterli değildir; önce sır iptal edilir/yenilenir, ardından geçmiş ve yayın artefaktları incelenir.

## İlk public yayından önce

- [ ] Nihai depo adı/adresi belirlenmiş ve depo oluşturulmuş. Sahip hesap `gokhangozukara`, proje adı HubPanel; henüz uzak repo oluşturulmadı.
- [x] Ticari kullanım ve serbest dağıtım hedefi için köke MIT `LICENSE` eklendi; telif satırı `2026 Gokhan Gozukara`.
- [x] Güvenlik sorumlusu Gokhan Gozukara; özel e-posta kanalı `gokhangozukara@gmail.com`, `SECURITY.md` içinde tanımlı. E-posta gönderimi/teslim testi yapılmadı.
- [ ] Repo oluşturulduktan sonra GitHub private vulnerability reporting ayrıca etkinleştirilip doğrulanmış; şu an etkin olduğu iddia edilmiyor.
- [ ] README açıkça araştırma aşamasını ve henüz üretime hazır olmadığını söylüyor.
- [ ] Gerçek IP, sunucu yolu, kullanıcı bilgisi, müşteri içeriği, upload ve yedekler yayın kapsamının dışında.
- [ ] `git ls-files` ve `git diff --cached` ile tam yayın listesi ve içerik incelenmiş; referans/yerel rapor zorla eklenmemiş.
- [ ] Staged içerik ve tüm geçmiş, sürümü kayıtlı secret scanner ile taranmış; bulgular değerleri açığa çıkarmadan sınıflandırılmış. Bu incelemedeki regex kontrolü bunun yerine geçmez.
- [ ] Doküman bağlantıları yalnızca yayınlanan dosyalara gidiyor; yerel okuma adımları açıkça isteğe bağlı belirtiliyor.
- [ ] Bağımlılık lisansları ve üçüncü taraf bildirimleri kayıtlı; yayın görselleri sentetik veriler içeriyor.
- [ ] Repo korumaları ve CI en az izin ilkesiyle kurulmuş; dış PR'lar sır veya yayın yetkisi alamıyor.

## Uygulama yayını için ek kapı

Faz 8 kabulü, güvenlik testleri, bağımlılık/container taraması, anahtar yönetimi, yedekten geri dönüş ve rollback kanıtı gerekir. Dokümanın yayınlanabilmesi uygulamanın güvenli olduğu anlamına gelmez.

## Açık ürün kararları

1. Ürün yönü kesinleşti: topluluğun kendi sunucusuna kurabileceği, müşteri çalışma alanlarını ve dış uygulamaları birleştiren admin hub. Merkezi barındırılan hizmet işletimi sonraki kapsamdır; P0 workspace izolasyonu zorunludur.
2. Nihai repo adresi ve GitHub ayarları. Lisans MIT, kurucu/proje sorumlusu Gokhan Gozukara, hesap `gokhangozukara` ve güvenlik e-postası belirlendi.
3. İlk örnekler: sentetik içerik servisi ve bağımsız ikinci API; dil/uygulama ayrıntısı geliştirme başında seçilir. HubStag/SwzHub erişimi ürünün başlamasına bağımlılık değildir.
4. E-posta sağlayıcısı, alan adı ve işletim sorumlusu; saklama süreleri ve geri dönüş hedeflerinin kabulü.

Bu kararlar seçilmeden plan incelenebilir; eksik kararlar tamamlanmış gibi gösterilmez. Faz 1 iskeletinin ilk teknik işi, auth kütüphanesi seçimi ve sır içermeyen yerel kurulum/CI sözleşmesidir.

Kaynak: [GitHub özel güvenlik bildirimi yapılandırması](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
