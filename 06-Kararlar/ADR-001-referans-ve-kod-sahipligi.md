# ADR-001: Referans Kod ve Kod Sahipliği

Durum: Kabul edildi  
Tarih: 2026-11-06

## Karar

Studio Admin ve SwzHub kaynakları yalnızca inceleme amacıyla `BundanOrnekAlacaz` altında tutulacaktır. HubPanel üretim kodu bu kaynaklardan kopyalanmayacaktır.

## Gerekçe

- Ürünün ayrıştırıcı ve özgün olması gerekiyor.
- Mevcut panelde kullanım ve güvenlik eksikleri bulunuyor.
- Kod tabanının bakımı ve sahipliği açık olmalı.
- MIT lisansı kopyalamaya izin verse de ürün tasarımı ve kodu özgün olacak.

## Sonuç

- Referans dizinleri üretim build'ine alınmayacak.
- Bileşenler ve stil sistemi sıfırdan yazılacak.
- Açık kaynak kütüphaneler yalnızca bağımlılık olarak kullanılabilecek.
- Lisans bildirimleri ve bağımlılık listesi kayıt altında tutulacak.
