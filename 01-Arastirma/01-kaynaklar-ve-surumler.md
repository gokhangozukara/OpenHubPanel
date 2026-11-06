# Kaynaklar ve Sürümler

Araştırma tarihi: 2026-11-06

İnceleme notu: Aşağıdaki paket sürümleri yerel `package.json` ve `package-lock.json` dosyalarından okunmuştur; güvenli veya en güncel sürüm tavsiyesi değildir. Uzak dalın en güncel olduğu ve kayıtlı commit'in kopyayla birebir eşleştiği bu incelemede yeniden doğrulanmadı. Uygulama başlangıcında resmi sürüm ve güvenlik duyuruları ayrıca kontrol edilecek.

## 1. Mevcut SwzHub paneli

- Canlı adres ve sunucu yolu public araştırma kaydına dahil edilmez; yerel referans notunda tutulur.
- Yerel inceleme kopyası: `BundanOrnekAlacaz/SwzHub-Panel-Mevcut`
- Paket adı: `swzhub-admin`
- Paket sürümü: `2.2.0`
- Framework: Next.js `16.3.5`
- React: `19.3.0`
- Shadcn paketi: `4.21.0`
- Tailwind: manifest aralığı `^4.1.5`; kilit dosyası `4.3.3`
- Çalışma portu: `3230`
- Kaynakta Git geçmişi bulunmuyor.

Mevcut kaynak, açık kaynak Studio Admin şablonunun özelleştirilmiş bir türevi. SwzHub'a özgü sosyal medya, meeting monitor, QR kodları, işlem kaydı, Almanca çeviri ve bazı API bağlantıları eklenmiş.

## 2. Güncel Studio Admin kaynağı

- GitHub: `arhamkhnz/next-shadcn-admin-dashboard`
- Varsayılan dal: `main`
- İlk araştırmada kaydedilen commit: `05b2b927f556e0dce18c9023afa23f8219f39c93`
- Commit tarihi: `2026-11-06T10:36:05+05:30`
- Lisans: MIT
- Paket sürümü: `2.2.0`
- Next.js: `16.4.5`
- React: `19.3.1`
- Shadcn paketi: `4.23.0`
- Tailwind: manifest aralığı `^4.1.5`; kilit dosyası `4.3.4`
- İlk araştırma notunda GitHub release etiketi bulunmadığı belirtilmiş; bu incelemede uzak depo durumu yeniden kontrol edilmedi.

İlk araştırmada `main` dalından alındığı kaydedilen kopya ayrı klasördedir. Paket sürümü aynı görünse de iki yerel kopyanın bağımlılık sürümleri ve içerikleri farklıdır.

## 3. Güncelleme sonucu

- Yerel upstream kopyası SwzHub kopyasından farklı sürümler içeriyor.
- İlk araştırmada kaydedilen commit başlığı `feat: add upcoming dashboards to sidebar`.
- Next.js `16.3.5` seviyesinden `16.4.5` seviyesine,
- React `19.3.0` seviyesinden `19.3.1` seviyesine,
- Shadcn `4.21.0` seviyesinden `4.23.0` seviyesine yükselmiş.
- Studio Admin tarafında yeni dashboard ve sidebar değişiklikleri eklenmiş.

Bu güncellemeler HubPanel'e taşınmayacak. Yalnızca mevcut yapının nereden geldiğini ve neyin değiştiğini anlamak için referans olarak tutulacak.

## 4. Karşılaştırma notu

2026-11-06 yerel yeniden sayımında SwzHub kopyasında 403, upstream kopyasında 391 dosya bulundu (gizli dosyalar dahil, tüm normal dosyalar). Aynı göreli yola sahip 334 dosyanın 329'u bayt düzeyinde farklı. Önceki 362 sayısının sayım kapsamı belgelenmediği için güncellendi. Bu sayı tek başına “tamamen değiştirildi” anlamına gelmez.

SwzHub'a özgü başlıca ekler:

- `social-media`
- `meeting-monitor`
- `qr-codes`
- `protokoll`
- `einstellungen`
- Auth API ve session katmanı
- MySQL bağlantısı
- Yerelleştirme dosyaları
- TV yapılandırma ve medya yükleme API'leri
