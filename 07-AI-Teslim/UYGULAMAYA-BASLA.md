# HubPanel Uygulamasına Başlangıç Görevi

Bu dosya sonraki geliştirme ajanına verilecek görevdir. Dosyanın hazırlanması üretim kodunun başlatıldığı anlamına gelmez.

## Kopyalanabilecek görev

> Çalışma klasörü: `C:\Users\Asus\Desktop\HubPanel`.
>
> HubPanel — All in one panel projesinin belgelenmiş P0 sürümünü yerelde geliştir. Önce AGENTS.md, README.md okuma sırası, PROJE-DURUMU.md, ADR-005, güvenlik/entegrasyon belgeleri ve `04-Fazlar/02-pilot-ve-mobil-plani.md` dosyasını oku. Eski incelemedeki tek kuruluş/salt okunur MVP sınırını güncel kapsam sanma.
>
> Yalnızca yeniden plan yazıp durma: kısa bir yürütme sırası çıkar, Faz 1'i uygula, kabul ölçütlerini doğrula ve bağımlılıkları geçen sıradaki P0 işine devam et. Mevcut kullanıcı değişikliklerini koru. Rutin, geri alınabilir yerel tercihlerde gerekçeli karar ver; gerçek eksik bilgi veya dış işlem sınırı varsa somut engeli bildir, bağımsız yerel işi sürdür.
>
> Ürün; müşteri çalışma alanları, ekip daveti/rol/izin, parola+TOTP, oturum iptali, audit ve genel HTTP connector üzerinden uygulama yönetimi içermeli. İlk uçtan uca kanıt: iki workspace, iki bağımsız örnek uygulama, ilkinde güvenli başlık güncelleme, ikincisinde salt okunur bağlantı. Sunucuda izin/tenant kontrolü, RLS, CSRF, hız sınırı, step-up ve uzak yazma idempotency'si test edilmeden tamamlandı deme.
>
> Referans panellerden kod veya tema kopyalama. MIT lisansını ve sahiplik/katkıcı bildirimlerini koru. Mobil responsive web P0; PWA, native uygulama, geniş connector kataloğu ve harici panel SSO'su sonraki kapsamdır. Tek başına URL eklemeyi SSO olarak sunma.
>
> İlk gerçek pilot, kullanıcının mevcut HubStag ekibidir. Yerel testler için canlı sır veya veri gerekmez. Henüz incelenmemiş API'leri uydurma. Canlı sisteme yazma, dağıtım, veri taşıma, eski paneli kapatma ve public yayın için ayrı somut kullanıcı onayı gerekir. Bu işlemlere ihtiyaç doğmadan önce ilgili yerel kodu, testleri ve geri dönüş planını hazırla.
>
> Her teslimatta typecheck, lint, ilgili birim/entegrasyon testleri ve build'i çalıştır; kritik tarayıcı akışlarını ve gerçek PostgreSQL üzerinde iki müşteri izolasyonunu doğrula. Çalıştırılamayan kontrolü geçti sayma. Testler hazır olmadan ekran görüntüsünü güvenlik kanıtı sayma.
>
> Her çalışma sonunda PROJE-DURUMU.md dosyasını yapılan iş, gerçek komut/sonuç, kalan hata ve tam sonraki adımla güncelle. Yerel P0, gerçek pilot ve public üretim yayınının durumlarını ayrı bildir. Zaman/oturum sınırında eksikleri açıkça kaydet; bütün proje bitti iddiasında bulunma.

## Başlamaya hazır olanlar

Ürün yönü, P0/P1 kapsamı, MIT, veri/kimlik/entegrasyon yaklaşımı ve negatif kabul senaryoları mevcut. İlk uygulama için yeterli yön var; her uygulama ayrıntısı önceden çözülmüş değildir.

## Uygulama sırasında kesinleşecekler

- Desteklenen güncel sürümler ve auth kütüphanesi: resmi kaynak, lisans ve güvenlik durumuyla karar kaydı.
- İlk gerçek pilot uygulama/API/servis kimliği: mevcut sistem envanteri sonrası; yerel örnekler bunu beklemez.
- E-posta sağlayıcısı: geliştirmede yerel yakalama/sahte adapter; gerçek teslim için sağlayıcı ve alan adı gerekir.
- Dağıtım donanımı, secret sağlama, ölçülen kapasite ve gerçek yedek hedefi.
- PWA/push ihtiyacı, native uygulama kapsamı ve nihai mobil adı.

## Gerçekçi bitiş tanımı

Birinci teslimat çalışan yerel P0 ve tekrar çalıştırılabilir testlerdir. İkinci teslimat onaylı gerçek pilot ve giderilmiş kullanım sorunlarıdır. Üçüncü teslimat yayın kontrolleri geçmiş dağıtılabilir sürümdür. Tüm yol haritasını tek yanıtla üretmek veya yalnızca test dosyaları yazmak bu üç teslimatı tamamlamaz.
