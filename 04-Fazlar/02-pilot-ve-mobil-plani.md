# İlk Gerçek Pilot ve Mobil Yol

Durum: Kullanıcı konuşmasından kaydedilen yön; uygulama, canlı inceleme veya geçiş yapılmadı.

## İlk kullanıcı biziz

Kullanıcı, mevcut HubStag panelini 10'dan fazla uygulamasını yönetmek için kullandığını belirtti. İlk gerçek pilot bu ekip ve mevcut işleridir. Uygulama sayısı ve çalışma biçimi henüz kaynak/API incelemesiyle doğrulanmadı. Canlı adres yalnızca yerel pilot notunda tutulur.

Geliştirmede sentetik örnekler ve iki workspace izolasyon testleri korunur. Gerçek pilot için önce mevcut paneldeki uygulamalar, en sık yapılan işler, veri/servis sahipleri ve API olanakları çıkarılır. Ardından düşük riskli bir uygulama ve günlük bir iş seçilir. Bu envanterin eksikliği yerel proje iskeletini engellemez; gerçek entegrasyon ayrıntısı uydurulmaz.

## Kademeli geçiş

1. Yerel çekirdek ve örnek connector testlerini tamamla.
2. Seçilen gerçek uygulamanın veri sözleşmesini belgeli ve salt okunur incelemeyle çıkar; üretim sırlarını repoya taşıma.
3. Ayrı test ortamında/sentetik veride aynı işin okuma ve yazmasını doğrula.
4. Dağıtım hedefi, yedek, yetki kapsamı ve geri dönüş planı somutlaşınca canlı pilot için kullanıcı onayı al.
5. Önce okuma, sonra seçilen sınırlı yazma işlemini aç. Mevcut panel geçiş boyunca çalışır; tüm uygulamalar bir kerede taşınmaz.
6. Aynı kaynağın iki panelden düzenlenmesi sürüm/çakışma kontrolüyle ele alınır; sessiz üzerine yazma kabul edilmez.
7. Gerçek günlük kullanımda bulunan sorunları, yeniden üretim adımlarını ve kabul sonuçlarını kaydet. İlk pilot kararlı olmadan sonraki uygulamayı taşıma.

Pilot başarılı sayılmak için ekip seçilen işi eski panele dönmeden tamamlayabilmeli; yetkisiz erişim, yanlış audit, veri kaybı veya belirsiz yazma sonucu açık kalmamalıdır. Kaç günlük gözlem ve kaç işlem gerektiği pilot işinin sıklığına göre başlamadan kararlaştırılır; şu an başarı ölçülmüş değildir.

Topluluk yayını öncesinde projeyi tanımayan bir geliştiriciyle temiz kurulum ve ilk bağlantı denenir. Kendi ekibimizin ürünü kullanabilmesi, dış geliştiricinin dokümanla kurabildiğini tek başına kanıtlamaz.

## Mobil sıra

- **P0:** Telefonda kullanılabilir responsive web; giriş/TOTP, müşteri ve uygulama seçimi, izinli temel işlemler gerçek mobil tarayıcıda doğrulanır.
- **P1 adayı:** Ana ekrana eklenebilen PWA. Kimlik/özel API yanıtları service worker önbelleğine alınmaz; çevrimdışı yönetim yazması yoktur. Çıkış ve workspace geçişinde veri temizliği test edilir. Push bildirim ayrıca ihtiyaç, izin ve platform desteğiyle değerlendirilir; varsayılan özellik sözü değildir.
- **Sonraki ürün kararı:** Gerçek kullanım ihtiyacı doğrulanırsa iOS/Android uygulaması. İlk odak durum görme, bildirimden işe ulaşma ve yetkili hızlı işlem; mevcut panelin her ekranını taşımak zorunlu değildir. Mağaza yayını ayrı kapsamdır.

Kullanıcı mobil uygulama için HubStag adını önerdi; HubPanel ile ad tutarlılığı önerisi de konuşuldu. Nihai mobil marka adı kararlaştırılmadı; AI bunu kesinleşmiş saymamalıdır. Mobil mağaza uygulaması P0 web teslimatını bloke etmez.
