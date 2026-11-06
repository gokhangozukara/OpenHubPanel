# HubPanel Çalışma Kuralları

Bu proje üzerinde çalışan her ajan önce `README.md` dosyasını ve oradaki okuma sırasını uygulamalıdır.

## Zorunlu kurallar

- `BundanOrnekAlacaz` altındaki kodları üretim uygulamasına kopyalama.
- Referans panellerden ekran, bileşen veya tema birebir çıkarma.
- Her üretim dosyası HubPanel için sıfırdan yazılmalı.
- Açık kaynak kütüphane kullanılabilir; lisans ve sürüm kaydı tutulmalı.
- Kimlik bilgisi, token, özel anahtar ve `.env` içeriği repoya yazılmamalı.
- Güvenlik kararlarında `03-Mimari/02-guvenlik-ve-2fa.md` esas alınmalı.
- Kullanıcı, rol ve yönetim işlemleri denetim kaydı üretmeden tamamlanmış sayılmamalı.
- Değişikliklerde tip kontrolü, lint ve ilgili testler çalıştırılmalı.
- Faz dışına çıkmadan önce fazın kabul ölçütleri kontrol edilmeli.
- Mevcut SwzHub veya canlı VPS üzerinde onaysız değişiklik yapılmamalı.
- `BundanOrnekAlacaz`, mevcut sisteme ait yerel değerlendirme ve `*.local.md` dosyaları public depoya zorla eklenmemeli.
- Güvenlik kararlarının güncel yorumu için `06-Kararlar/ADR-004-guvenlik-incelemesi.md` ve negatif kabul testleri okunmalı.
- Ürün kapsamı için ADR-005 esas alınır: genel admin hub, P0 workspace izolasyonu ve dış geliştirici entegrasyonu. Çekirdek HubStag/SwzHub'a bağımlı olamaz; yalnızca link eklemek SSO olarak sunulamaz.
- Yalnızca doküman/ignore değişikliğinde dosya bağlantıları, çelişkiler ve dışlama davranışı doğrulanır; üretim paketi yokken typecheck/lint/build çalıştırılmış gibi gösterilmez.

## Kaynak önceliği

1. `03-Mimari`
2. `02-Strateji`
3. `04-Fazlar`
4. `05-Tasarim`
5. Referans kopyalar yalnızca karşılaştırma için
