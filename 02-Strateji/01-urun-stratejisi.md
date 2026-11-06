# HubPanel Ürün Stratejisi

## Ürün tanımı

**HubPanel — All in one panel.**

HubPanel, geliştiricilerin ve ajansların müşteri sitelerini, uygulamalarını ve mevcut panellerini ortak bir yönetim merkezine bağlamasını sağlayacak MIT lisanslı üründür. Hem uygulamalar için admin paneli hem de admin panellerinin hub'ıdır.

Çözülen problem: Her projede tekrar kurulan giriş, kullanıcı/rol yönetimi ve yönetim ekranları; kullanıcı için dağınık paneller ve ayrı girişler. Başarı, insanların projelerini daha az tekrar işle yönetebilmesidir.

Örnek entegrasyonlar:

- HubStag
- SwzHub
- Topluluğun kendi müşteri siteleri ve uygulamaları

HubStag/SwzHub çekirdek bağımlılığı değildir. İlk sözleşme sentetik bir içerik uygulaması ve ikinci bağımsız örnekle doğrulanır; üçüncü taraf geliştirici HubPanel çekirdeğine ürün özel kod eklemeden entegre olabilir.

## Konumlandırma

HubPanel yalnızca “güzel bir admin şablonu” olmayacak. Kullanıcıya şu soruların cevabını tek ekranda verecek:

- Hangi uygulama açık, hangisi sorunlu?
- Bugün hangi işlem bekliyor?
- Hangi kullanıcı neyi değiştirdi?
- Yetkim olan uygulamaya en hızlı nasıl ulaşırım?
- Riskli bir işlem yapılıyor mu?

## Ayrıştırıcılar

### 1. Modül sistemi

Her uygulama HubPanel'e bir modül manifesti ile bağlanır. Modül; adını, ikonunu, izinlerini, menü öğelerini, sağlık kontrolünü ve API adresini tanımlar.

Bu yapı sayesinde yeni uygulama eklemek panelin kodunu karıştırmaz.

### 2. Gerçek yönetim

Kullanıcı, rol, izin, oturum, cihaz ve denetim kayıtları demo veri değil gerçek veritabanı kayıtları olur.

### 3. Kullanım hızı

- Komut paleti
- Global arama
- Son kullanılanlar ve favoriler
- Hızlı işlemler
- Klavye kısayolları
- Tutarlı liste/filtre/detay/düzenleme akışı

### 4. Güvenlik

- Yönetici hesaplarında çok katmanlı doğrulama
- Cihaz ve oturum yönetimi
- Riskli işlemlerde yeniden doğrulama
- Yetki kontrolü hem arayüzde hem API'de
- Uygulama tarafından değiştirilemeyen denetim kayıtları; DB yöneticisine karşı bütünlük güvencesi ayrı tasarlanır

### 5. Sade ürün yüzeyi

İlk sürümde yalnızca kullanılan işlevler görünür. Demo e-ticaret, akademi, hasta takibi veya kişisel finans ekranları ürüne girmez.

## Hedef kullanıcılar

Birincil kullanıcılar: bağımsız geliştirici, ajans, uygulama ekibi ve müşterinin operasyon ekibi. Teknik rol modeli aşağıdadır; workspace üyeliği ve izinleri müşteriye göre ayrı tutulur.

- Kurulum işletmecisi: kurulum, altyapı ve izin verilen bağlantı türleri/hedefleri.
- Workspace sahibi: kendi müşteri alanının üyeleri, uygulamaları ve ayarları.
- Uygulama yöneticisi: yalnızca yetkili olduğu modül ve kullanıcılar.
- Operatör: günlük içerik, görev veya mesaj işlemleri.
- Denetçi: kişisel veriye erişmeden işlem kayıtlarını inceleme.

## Ürün kuralları

- Her ekran gerçek bir işi çözmelidir.
- İşlem ancak yetki ve denetim kaydı ile tamamlanmalıdır.
- Hata mesajları kullanıcıya ne olduğunu ve ne yapacağını anlatmalıdır.
- Yıkıcı işlemler geri alınabilir veya ek onaylı olmalıdır.
- Mobil kullanım ilk sürümden itibaren desteklenmelidir.
- Tema değişikliği temel kullanım akışını bozmamalıdır.
- Yeni özellik eklemek, mevcut akışı karmaşıklaştırma bedeliyle yapılmamalıdır.

## Kod sahipliği

- HubPanel uygulama kodu sıfırdan yazılacak.
- Studio Admin veya SwzHub dosyaları kopyalanmayacak.
- Açık kaynak kütüphaneler kullanılabilir.
- Erişilebilirlik, güvenlik ve tarih/para işlemleri için kanıtlanmış kütüphaneler tercih edilecek.
- Kendi yazdığımız kod için açık klasör sınırları, tipler, testler ve kod inceleme kuralı olacak.

## İlk sürüm başarı ölçütleri

- Kullanıcı girişten sonra en fazla iki işlemle ana görevine ulaşabilmeli.
- Her uygulamanın durumu ana ekranda görünmeli.
- Kullanıcı/rol değişikliği audit kaydı üretmeli.
- TOTP ile 2FA uçtan uca çalışmalı.
- E-posta doğrulama ve kısıtlı kurtarma akışı çalışmalı; zorunlu TOTP'yi atlatmamalı.
- Yetkisiz API çağrısı sunucu tarafında reddedilmeli.
- Oturum iptal edildiğinde eski çerez anında geçersiz olmalı.
- Masaüstü ve mobilde temel akışlar kullanılabilir olmalı.
- Kritik akışlarda otomatik test bulunmalı.

İlk teslimat workspace izolasyonu, genel connector sözleşmesi, örnek bir içerik güncellemesi ve ikinci uygulamada salt okunur bağlantıyı kapsar. Komut paleti, global arama, kapsamlı SDK ve ek ürün connector'ları sonraki teslimatlardır. [ADR-005](../06-Kararlar/ADR-005-admin-panellerinin-hubu.md), [gereksinimler](02-urun-gereksinimleri.md) ve [kullanıcı yolculukları](03-kullanici-yolculuklari.md) birlikte esas alınır.

## Topluluk ve ürün ilkeleri

- Temel entegrasyon ve güvenlik özellikleri MIT lisanslı çekirdekte kalır; gelir sınırı veya zorunlu katkı yoktur.
- Kendi sunucuna kurulum, taşınabilir HTTP sözleşmesi ve açık doküman önceliklidir.
- İlk kullanımda örnek uygulama ve anlaşılır bağlantı testi bulunur; canlı müşteri verisi gerekmez.
- SSO desteği olmayan uygulamaya tek giriş vaadi verilmez. HubPanel içi API işlemleri tek oturumla yapılır; harici panel SSO'su ayrıca entegre edilir.
- İlk entegrasyon süresi, tamamlanan kullanıcı işi ve hata giderme başarısı ölçülür; telemetri varsayılan kapalıdır.

## Riskler

- SwzHub'daki modüllerin gerçek veri sözleşmeleri henüz çıkarılmadı.
- SMS/e-posta sağlayıcı seçimi netleşmedi; sağlayıcı bağımsız adapter kullanılmalı.
- Google girişi için OAuth istemci ayarları ayrıca yapılandırılmalı.
- 2FA desteği yanlış uygulanırsa güvenlik yanılsaması oluşur; akışlar test edilmeden yayına alınmamalı.
- Tüm modülleri ilk sürüme alma isteği kapsamı büyütebilir; önce çekirdek panel tamamlanmalı.
