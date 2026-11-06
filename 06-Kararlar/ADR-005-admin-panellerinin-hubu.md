# ADR-005: Admin Panellerinin Hub'ı

Durum: Kullanıcının ürün yönlendirmesiyle kabul edildi; uygulama bekliyor.  
Tarih: 2026-11-06

## Problem ve karar

Her site ve uygulama için ayrı yönetim ekranı, giriş ve kullanıcı yönetimi kurulması geliştirici ve işletmeciye tekrar iş çıkarıyor. HubPanel; geliştiricilerin, ajansların ve işletmelerin kendi projelerini bağlayabildiği MIT lisanslı ortak yönetim merkezi olacaktır.

Slogan: **All in one panel.**

Ürün iki kullanım biçimini birlikte destekler:

1. **Admin paneli olarak:** Yönetim arayüzü olmayan bir uygulamanın API'sini liste, detay, form ve izinli işlemlerle yönetir.
2. **Panellerin hub'ı olarak:** Birden fazla uygulamayı çalışma alanları, kullanıcı yetkileri, ortak giriş ve denetim üzerinden bir araya getirir.

HubStag ve SwzHub örnek entegrasyon adaylarıdır; çekirdeğin çalışması bu ürünlerin koduna, alan adına veya veritabanına bağımlı olamaz.

## Kapsam değişiklikleri

- ADR-004'ün tek kuruluş ve tek salt okunur adapterle sınırlı P0 kararı bu ADR ile güncellenir. Diğer güvenlik kuralları korunur.
- Müşteri çalışma alanları ve üyelik/izin izolasyonu P0 temelidir. İlk kurulum kendi sunucusuna kurulabilir; merkezi ticari SaaS işletmek P0 şartı değildir.
- Minimal, dilden bağımsız connector sözleşmesi ve örnek uygulama P0'dır. Tam SDK, eklenti pazarı ve otomatik connector kurulumu sonraki aşamadır.
- İlk kullanılabilir sürümde bir örnek uygulamada gerçek ve sınırlı bir yazma işlemi gerekir. Salt okunur bağlantı ara teslimattır; nihai yönetim paneli kabulü değildir.
- Genel sözleşmenin taşınabilirliği ikinci bağımsız uygulamada salt okunur bağlantıyla doğrulanır. Bu ikinci örnek yerel ve sentetik olabilir; HubStag/SwzHub erişimi beklenmez.
- HubPanel içindeki entegre işlemler tek HubPanel oturumuyla yürür. Harici panelin kendi ekranına tek giriş ancak o uygulamanın SSO desteğiyle sağlanabilir; URL eklemek tek başına SSO değildir.
- İlk P0 yerel parola/TOTP kimliği korunur. Harici paneller arası OIDC SSO P1'de bakım gören bir kimlik sağlayıcısıyla uygulanır; yeni OAuth/OIDC sunucusu icat edilmez.

## Ticari ve topluluk yönü

MIT lisansı korunur. Ücretsiz çekirdeğin temel entegrasyon, yetki veya güvenlik özelliklerine gelir sınırı konmaz. Katkı gönüllüdür. Kurulum, destek veya barındırma ileride sunulabilir; topluluğun kendi kurulumunu çalıştırmasına engel değildir.

## Kabul

Bir geliştirici, HubPanel çekirdeğini değiştirmeden örnek sözleşmeye uyan uygulamasını bağlayabilmeli. Bir ajans iki müşteriyi ayrı alanlarda yönetebilmeli; müşteri yalnızca kendi alanını görmeli. Kullanıcı tek HubPanel oturumuyla bağlı uygulamadan veri okuyup izinli örnek işlemi tamamlayabilmeli. Bağlantı iptalinde servis erişimi durmalı; yapılan işlem doğru müşteri/uygulama altında audit üretmeli.

Ayrıntılar: [entegrasyon sözleşmesi](../03-Mimari/04-entegrasyon-ve-calisma-alanlari.md), [kullanıcı yolculukları](../02-Strateji/03-kullanici-yolculuklari.md).
