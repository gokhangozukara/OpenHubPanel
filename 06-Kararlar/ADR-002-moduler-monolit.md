# ADR-002: Modüler Monolit

Durum: Kabul edildi  
Tarih: 2026-11-06

## Karar

HubPanel'in ilk sürümü modüler monolit olarak geliştirilecektir.

## Gerekçe

- Tek ekip ve tek sunucu ile hızlı ilerlemek gerekiyor.
- Kullanıcı, rol, modül ve denetim akışları birbirine bağlı.
- Mikroservisler ilk sürümde gereksiz dağıtım ve hata karmaşıklığı yaratır.
- Modül sınırları doğru kurulursa ileride ayırma mümkündür.

## Sonuç

- `apps/web` ve `apps/worker` ayrı süreçler olabilir.
- İş mantığı domain ve application katmanlarında tutulur.
- Modüller doğrudan birbirinin veritabanı tablosuna erişmez.
- Harici uygulamalar adapter ve manifest üzerinden bağlanır.
