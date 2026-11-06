# HubPanel Kullanıcı Yolculukları

**All in one panel.** İnsanların her proje için tekrar panel ve kullanıcı yönetimi kurma yükünü azaltmak temel başarı ölçütüdür.

## Müşterisine site yapan geliştirici

HubPanel'i kurar → müşteri çalışma alanını açar → sitenin connector API'sini bağlar → içerik listesini görür → müşteriyi editör olarak davet eder. Müşteri HubPanel'e girerek kendi sitesinin izinli içeriğini düzenler; geliştirici aynı kullanıcı/rol/form altyapısını yeniden yazmaz.

Kabul: örnek bir içerik başlığı gerçekten güncellenir, audit oluşur, müşteri başka sitenin kaydını okuyamaz veya değiştiremez.

## Birden fazla müşteri yöneten ajans

Müşteri A ve B için ayrı alanlar açar → kendi ekibine her alanda ayrı rol verir → müşterileri yalnızca kendi alanlarına davet eder → alan değiştirerek uygulama durumlarını ve işlemleri yönetir.

Kabul: aynı kullanıcı iki alanda farklı yetkiye sahip olabilir. Alan değiştirme, arama, dosya, kuyruk ve önbellek üzerinden müşteri verileri karışmaz. A'dan üyeliği kaldırılan kullanıcı B'deki yetkisini korur.

## Uygulama geliştiren ekip

Dil bağımsız sözleşmeyi okur → örnek connector'u çalıştırır → kendi API'sini şemaya uyarlar → kaynaklarını ve izinlerini tanımlar → bağlantı testi yapar → ekibini davet eder.

Kabul: HubPanel çekirdeğine müşteri/ürün özel koşul eklenmez; hata açıklaması bağlantı, kimlik ve sürüm sorunlarını ayırır. Uyumlu olmayan özellik sessizce çalışıyor gösterilmez.

## Zaten admin paneli olan işletme

Mevcut panelini uygulama kartı olarak ekler → desteklediği API işlemlerini HubPanel içinde kullanır → P1'de desteklenen OIDC entegrasyonu ile ortak giriş kurar.

Kabul: yalnızca dış bağlantı sunuluyorsa yeniden giriş gerekebileceği açıkça gösterilir. API entegrasyonunda kullanıcı dış panel parolasını paylaşmaz. SSO desteklenmeyen ürüne “tek giriş çalışıyor” etiketi verilmez.

## İlk sürümün uçtan uca kanıtı

İki müşteri alanı, iki bağımsız örnek uygulama, bir ajans kullanıcısı ve iki müşteri hesabı kullanılır. İlk uygulamada başlık güncelleme, ikinci uygulamada listeleme yapılır. Tek HubPanel oturumu, doğru yetki, audit, servis kesintisi, bağlantı iptali ve alanlar arası erişim reddi birlikte gösterilir. Demo sentetik veri kullanır.

## Kullanım hedefleri

- İlk örnek bağlantı: temiz ortamda dokümanla 30 dakika hedefi; dış geliştiriciyle ölçülecek.
- Günlük göreve ulaşma: workspace seçildikten sonra en fazla iki gezinme adımı; güvenlik doğrulamaları bu sayıya dahil edilmez.
- Her desteklenen işlemde başarı, hata, boş durum ve erişim reddi anlaşılır olmalı.
- Mobil ve klavye kullanımında aynı çekirdek iş tamamlanabilmeli.
- Başarı yalnızca yıldız sayısıyla ölçülmez; kurulumu tamamlayan geliştirici, çalışan bağlantı ve çözülen kullanıcı sorunu da takip edilir. Telemetri varsayılan kapalıdır; ölçümler gönüllü geri bildirim/kullanılabilirlik oturumlarından alınabilir.
