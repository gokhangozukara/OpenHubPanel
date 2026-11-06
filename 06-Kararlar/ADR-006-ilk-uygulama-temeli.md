# ADR-006: İlk Uygulama Temeli ve Önizleme Sınırı

Durum: İlk kod teslimatında uygulandı; tam P0 tamamlanmadı.

## Karar

- Depo adı ve uygulama markası **OpenHubPanel**; önceki HubPanel belgeleri ürün geçmişidir. MIT ve mevcut sahiplik korunur.
- pnpm workspace, TypeScript strict, Next.js App Router, PostgreSQL, Biome, Vitest ve Playwright kullanılır. Tam sürümler package.json ve kilit dosyasında sabittir; dependency lisans metadatası `docs/dependency-licenses.json` içinde kaydedilir.
- Görsel kabuk ayrı `/preview` yolundadır. Yalnızca development + açık preview bayrağında sentetik fixture kullanır; production'da 404'tür. Önizleme gerçek kullanıcı oturumu, bağlantı, davet veya audit servisi sayılmaz.
- Veritabanı çekirdeği gerçek PostgreSQL üzerinde, superuser/BYPASSRLS olmayan ayrı login ile test edilir. İlk uygulama rolü tenant verisini okuyabilir, kendi adına audit ekleyebilir; yönetim yazmaları auth/audit use-case'leri tamamlanmadan açılmaz.
- Yerel bilgisayarda Docker bulunmadığı için RLS testleri pinned embedded-postgres geliştirme paketiyle ayrı PostgreSQL sürecinde çalışır. Bu üretim veritabanı seçimi değişikliği değildir. Docker/Redis tanımları CI ve sonraki entegrasyonlar için depodadır.

## Auth seçim kaydı

Faz 3 için ilk aday Better Auth'tur (incelemede npm sürümü 1.7.18, MIT). Sunucu oturumu, iki faktör ve Next.js entegrasyonu desteklenir. Varsayılan parola algoritması scrypt olduğundan Argon2id adapteri gerekir. Zorunlu MFA, ön-oturum sınırı, atomik TOTP replay engeli, kısıtlı kurtarma ve transaction'a bağlı audit koşulları varsayılan plugin davranışı kabul edilerek geçilemez; entegrasyon öncesi kaynak/test doğrulaması gerekir.

Bu nedenle kütüphane henüz üretim auth endpoint'i olarak bağlanmadı. Faz 3'ün ilk işi adayın bu şartları karşıladığını doğrulamak; karşılamıyorsa karar kaydını güncelleyerek başka bakım gören çözüm seçmektir. Bu kayıt auth'ın tamamlandığını ifade etmez.

Resmi kaynaklar: [Better Auth parola ayarları](https://better-auth.com/docs/authentication/email-password), [iki faktör plugin'i](https://better-auth.com/docs/plugins/2fa). Next.js geliştirmesinde kurulu paketin `dist/docs` belgeleri okundu.

## Mevcut sınırlamalar

Kurulum/bootstrap, giriş/TOTP, üyelik yönetimi, davet/devir, connector, outbox ve gerçek pilot henüz uygulanmadı. Önizleme, Faz 2'nin ilk arayüz kabuğudur; tam bileşen kataloğu ve tüm kabul ölçütleri tamamlanmış sayılmaz. Üretim için sıkı nonce tabanlı CSP ve gerçek sır/startup doğrulamasının web auth ile birlikte bağlanması gerekir; mevcut başlangıç CSP'si Next.js inline script'lerine izin verir.
