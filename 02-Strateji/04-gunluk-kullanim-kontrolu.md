# Günlük Kullanımda Eksik Kalan Kurallar

Durum: Planlama kontrolü; uygulama henüz yok. Bu maddeler mevcut ekip/entegrasyon kapsamının kabul ayrıntılarıdır.

## Ekip davetinin tamamı

Üyeler ekranı aktif üyeler ile bekleyen davetleri ayırır. Davet yeniden gönderilebilir veya iptal edilebilir; yeniden gönderim eski token'ı geçersiz kılar. Davet kabulünde oturumdaki doğrulanmış e-posta alıcıyla eşleşir. Mevcut hesabın parolası veya TOTP'si yeniden kurulmaz; yeni hesap ilk kurulumdan geçer. Daveti oluşturan kişinin güncel yetkisi ve verilecek rol kabul anında tekrar denetlenir. Artık yetkili olmayan kişinin eski daveti erişim açamaz. Üyelik kaldırıldığında o üyeye ait aynı alandaki bekleyen davetler de iptal edilir.

Kabul: Yanlış hesap, eski/iptal edilmiş token veya yetkisi kaldırılmış davetçi ile üyelik oluşmaz. Aynı daveti eşzamanlı kabul etmek çift üyelik oluşturmaz. E-posta gönderilemediyse arayüz daveti teslim edilmiş gibi göstermez.

## Müşteriye veya yeni sorumluya devir

Geliştirici işi teslim ettiğinde aynı çalışma alanının yönetimini müşteriye devredebilir. Mevcut sahip step-up ile devri başlatır; alıcı doğrulanmış, MFA kurulmuş mevcut üye olmalı ve devri kabul etmelidir. Kabulde iki tarafın üyelik ve yetkileri yeniden denetlenir; yeni sahip ataması, eski sahibin kararlaştırılan rol değişikliği ve audit atomiktir. Son sahip koruması devam eder. Altyapı/root sahipliği bu işlemle devredilmiş olmaz.

Ajansın erişimi ancak yeni sahip kabul ettikten sonra kaldırılır. Ajansın bildiği servis kimlikleri yenilenir; işlem sırasında kalan erişimler açıkça gösterilir. Başka bir HubPanel kurulumuna taşıma için güvenli işletmeci prosedürü gerekir; P0 tek tıkla kurulumlar arası taşıma vaat etmez.

Kabul: Tamamlanmamış devir müşteriyi sahipsiz bırakmaz; iptal edilmiş üyelik devri tamamlayamaz; eski sahip kaldırıldığında sonraki istekte erişemez.

## HubPanel kapanırsa veya bağlantı kesilirse

P0 connector entegrasyonu uygulamanın yönetim API'sine bağlanır. Bağlı sitenin normal ziyaretçi akışı ve backend'i HubPanel'in çalışmasına bağımlı tasarlanmaz. HubPanel kesildiğinde merkezden yönetim durabilir; uygulamanın kendisine kapatma/silme komutu gönderilmez. P1 ortak kimlik sağlayıcısı kesintisinin etkisi ayrıca değerlendirilir.

Ekranda verinin son güncellenme zamanı ve bağlantı durumu görünür. Sonucu belirsiz uzak yazma “kaydedildi” sayılmaz; aynı işi tekrar çalıştırmadan durum uzlaştırılır. Bağlantı kaldırmak uzak uygulamayı veya müşteri kayıtlarını silmek anlamına gelmez.

Kabul: Örnek uygulama HubPanel durdurulduğunda normal işini sürdürebilir. Bağlantı kesintisi veriyi boş/silinmiş gibi göstermez; kullanıcıya güvenli yeniden deneme yolu sunar.

## Veri, yedek ve çıkış yolu

İçerik için asıl kaynak bağlı uygulamanın veritabanıdır; HubPanel üyelik, bağlantı, izin, audit ve gerekli sınırlı önbelleği tutar. HubPanel yedeği dış uygulamanın veritabanını veya dosyalarını otomatik yedeklemiş sayılmaz. Her ikisinin yedek sorumlusu ayrı belirtilir.

P0 yayın prosedürü, müşteriye ait izinli yapılandırma ve kayıtların dışa aktarılmasını, sırların ayrı ve güvenli ele alınmasını ve saklama süresi sonunda yerel verinin silinmesini kapsar. Dış uygulamanın içerik export'u connector desteğine bağlıdır. Başka müşterinin verisi veya anahtarı export'a giremez. Gelişmiş export/silme ekranı sonraki aşamadır.

## Kurulumu ve güncellemeyi gerçekten kullanılabilir yapmak

Faz 8'de temiz kurulumun yanında mevcut sürümden yükseltme, migration hatası ve geri dönüş de denenir. Minimum CPU/RAM/disk ve desteklenen sürümler ölçülerek dokümante edilir; henüz sayısal kapasite iddiası verilmez. Güncelleme öncesi yedek ve schema uyumluluğu gösterilir; eski uygulama imajına dönmenin her migration'ı geri almadığı açıklanır.

İlk dış kullanıcı denemesinde bir geliştirici örnek uygulamayı bağlar, bir müşteri daveti kabul edip kendi içeriğini değiştirir. Ekibin sözlü yönlendirmesiyle çözülen noktalar doküman/ürün eksikliği olarak kaydedilir.

## En büyük ürün riski: her şeyi aynı anda yapmak

Başlık güncelleme ilk teknik kanıttır; bütün yönetim ihtiyacını çözdüğümüz iddiası değildir. İlk gerçek pilot için kullanıcıyla tek bir günlük iş seçilir; örneğin içerik düzenleme veya destek talebi yönetimi. Gerekli kaynak/alan/işlemler açıkça listelenir, pilot kullanıcı işini baştan sona tamamlayınca o entegrasyon hazır sayılır. Yeni connector ve otomasyonlar bu işin çalışmasını geciktirmemelidir.
