# Sonraki AI için Çalışma Talimatları

## Başlangıç

Uygulama görevi için [UYGULAMAYA-BASLA.md](UYGULAMAYA-BASLA.md) kullanılır. Pilot/mobil sırası [pilot planındadır](../04-Fazlar/02-pilot-ve-mobil-plani.md).

1. Kök `AGENTS.md` dosyasını oku.
2. `README.md` içindeki okuma sırasını uygula.
3. Referans kodları yalnızca karşılaştırma için aç.
4. Üretim kodu yazmadan önce mevcut kararlarla çelişki olup olmadığını kontrol et.
5. `01-Arastirma/03-bagimsiz-inceleme.md`, ADR-004 ve tehdit modelini oku. İlk inceleme tamamlandı; sonraki görev Faz 1'in kararlaştırılmış kapsamıyla başlamaktır.
6. ADR-005, kullanıcı yolculukları ve `03-Mimari/04-entegrasyon-ve-calisma-alanlari.md` güncel ürün kapsamıdır. İlk incelemenin tek kuruluş/salt okunur MVP sınırı artık geçerli değildir.

## Değişmez kurallar

- `BundanOrnekAlacaz` altından üretim koduna parça taşıma.
- SwzHub veya Studio Admin görsel kimliğini taklit etme.
- 2FA'yı yalnızca ön yüz özelliği gibi ele alma.
- Parola, TOTP sırrı, token veya kurtarma kodunu loglama.
- Yetki kontrolünü yalnızca menüde yapma.
- Audit üretmeyen yönetim işlemi bırakma.
- Canlı VPS veya SwzHub üzerinde onaysız değişiklik yapma.
- `.env` ve gerçek secret dosyaları oluşturup repoya koyma.
- E-posta/SMS ile zorunlu TOTP'yi atlatan fallback ekleme; kurtarma oturumuna yönetim yetkisi verme.
- Step-up, audit atomikliği ve kaynak yetkisini P1'e erteleme.
- Yerel referansları veya `*.local.md` bulgularını public commit/artefakta taşıma.

## İnceleme sırasında cevapla

- Ürün kararlarında çelişki var mı?
- Güvenlik modelinde atlanmış saldırı veya kurtarma durumu var mı?
- Faz sırası yanlış mı?
- İlk sürüm gereğinden fazla mı büyük?
- Kullanım kolaylığını artıracak daha iyi bir akış var mı?
- Hangi kararlar kullanıcı onayı gerektiriyor?

## Değişiklik yaparken

- Önce küçük ve geri alınabilir diff üret.
- Tip, lint ve test sonuçlarını yaz.
- Üretim paketi bulunmayan doküman değişikliğinde bağlantı/ignore/tutarlılık kontrolü yap; uygulanamayan komutları açıkça belirt.
- Güvenlik kararı değişecekse yeni ADR ekle; eski kararı sessizce bozma.
- Faz dışı özellik ekleme.
- Yeni bağımlılık için gerekçe ve lisans bilgisi ekle.
- Kullanıcıya yapılan işi kısa Türkçe özetle.

## Tamamlanmış sayılma ölçütü

- İlgili fazın kabul ölçütleri karşılanmış.
- Testler geçiyor.
- Güvenlik ve yetki kontrolü server tarafında doğrulanmış.
- Doküman güncel.
- Geri alma veya düzeltme yolu açık.
