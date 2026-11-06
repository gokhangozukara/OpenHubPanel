# OpenHubPanel Proje Durumu

Son güncelleme: 2026-11-06

Depo: https://github.com/gokhangozukara/OpenHubPanel  
Yerel çalışma klasörü: `C:\Users\Asus\Desktop\HubPanel`

## Mevcut teslimat

İlk kod sürümü: pnpm monorepo, Next.js web uygulaması, yerel sentetik veri önizlemesi, PostgreSQL RLS temeli, güvenlik sözleşmeleri ve otomatik kontroller. Tam P0 veya üretim sistemi tamamlanmadı.

| Alan                        | Durum                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public GitHub repo          | OpenHubPanel oluşturuldu; ilk commit/CI sonucu aşağıda takip edilir                                                                                                   |
| Lisans ve sahiplik          | MIT; Gokhan Gozukara, GitHub gokhangozukara                                                                                                                           |
| Özel güvenlik bildirimi     | GitHub private vulnerability reporting etkin ve API ile doğrulandı; SECURITY.md güncel                                                                                |
| Faz 1 / monorepo            | Node 24, pnpm 12.18.0, TypeScript strict, 6 uygulama/paket ve lockfile hazır                                                                                          |
| Faz 1 / veri sınırı         | Ayrı uygulama DB rolü, FORCE RLS, workspace üyeliği ve eklemeli audit temeli; gerçek PostgreSQL testleri geçti                                                        |
| Faz 1 / altyapı             | Digest ile sabit Dockerfile ve PostgreSQL/Redis Compose yazıldı; yerelde Docker bulunmadığından container kontrolü CI'ya bırakıldı                                    |
| Faz 1 / runtime             | Güvenli genel health, token korumalı DB/Redis readiness, redaksiyonlu log ve başlangıç worker'ı hazır; readiness'in gerçek Redis ile başarılı yolu henüz doğrulanmadı |
| Faz 1 / CI                  | Typecheck, lint, birim/DB/tarayıcı testleri, build, secret/bağımlılık taraması ve container işleri tanımlı                                                            |
| Faz 2 / panel kabuğu        | Genel bakış, uygulamalar/arama, ekip, örnek işlem kaydı, güvenlik durumu ve tema ayarları; mobil navigasyon ve dialog etkileşimi çalışır                              |
| Önizleme sınırı             | Yalnızca local development; örnek veriler. Production /preview kapalı, yönetim API'si 503                                                                             |
| Faz 3 / gerçek auth         | Başlamadı; Better Auth aday değerlendirmesi ADR-006'da, Argon2id/TOTP/kurtarma kabulü henüz yapılmadı                                                                 |
| Faz 4 / gerçek yönetim      | Bekliyor; önizleme üyeleri/davet formu gerçek backend işlemi değildir                                                                                                 |
| Faz 6 / connector ve outbox | Bekliyor; şema/girdi doğrulamasının ilk testleri yazıldı, dış API bağlantısı yok                                                                                      |
| Faz 8 / yayın güvenliği     | Tamamlanmadı; bu sürüm müşteri verisi için kullanılmamalı                                                                                                             |
| İlk gerçek pilot            | Mevcut HubStag ekibi; 10+ uygulama kullanıcı beyanı, envanter henüz incelenmedi                                                                                       |
| Mobil sıra                  | P0 responsive web; PWA sonraki aday, native/mağaza ve nihai mobil isim daha sonra                                                                                     |

## Çalıştırma

```sh
npx --yes pnpm@12.18.0 install --frozen-lockfile
npx --yes pnpm@12.18.0 dev
```

http://127.0.0.1:3000/preview — yalnızca örnek arayüz. Yerel kullanım üretim anahtarı veya Docker gerektirmez. Ayrıntılar [geliştirme rehberindedir](docs/DEVELOPMENT.md).

## Doğrulama kanıtı

- TypeScript tüm workspace paketleri ve test araçlarında geçti.
- Vitest: 22 test geçti; varsayılan ret, rol devri sınırı, origin, yapılandırma, manifest/girdi ve log redaksiyonu.
- Ayrı PostgreSQL 18.6 süreci: 10 entegrasyon kontrolü geçti; uygulama rolü, RLS, başka alanı taklit etme, havuz bağlamı, audit aktörü/foreign key/rollback ve üyelik iptali.
- Chromium Playwright: 6 test geçti; alan değiştirme, arama/boş durum, dialog/Escape, yerel-only yazma, açık/koyu tema ve otomatik WCAG AA taraması, mobil taşma ve health.
- Next.js üretim build'i geçti. Son kaynak değişiklikleri için birleşik kontroller commit öncesi tekrar çalıştırılır.
- Kurulu bağımlılık lisans envanteri: 119 paket/sürüm. Üretim bağımlılık taramasında kontrol anında bilinen açık raporlanmadı; bu güvenlik garantisi değildir.
- Gitleaks 8.30.0 Windows aracı resmi release checksum'u doğrulanarak yerel .local/tools altında hazırlandı; commit ve geçmiş taraması yayın öncesinde yapılır.
- Referans kopyaları ve yerel pilot/güvenlik notları Git/Docker dışında; bunlar üretim koduna kopyalanmadı.

## Tamamlanmış sayılmayanlar

38 geçen test, tehdit modelindeki 24 uçtan uca senaryonun tümünün uygulandığı anlamına gelmez. Giriş/MFA, kaynak kapsamlı gerçek yönetim, davet/devir, connector, outbox, email teslimi, yedek geri dönüşü ve canlı pilot henüz yapılmadı. Sıkı nonce CSP ve auth'ın web runtime sır doğrulaması Faz 3'te bağlanmalı. Container çalışması ve Compose başlangıcı yerelde denenmedi.

## Sıradaki somut işler

1. CI ve container sonuçlarını doğrula; ilk teslimat hatalarını kapat.
2. Faz 1'deki altyapı/readiness doğrulamasını tamamla; Faz 2 bileşen kataloğu ve diğer kabul ölçütlerini ayrı takip et.
3. Better Auth adayını zorunlu TOTP, atomik replay ve kısıtlı kurtarma koşullarıyla doğrula; auth kütüphanesi kararını kesinleştir.
4. İlk uçtan uca auth dilimini kur: CLI bootstrap → parola/TOTP → opak sunucu oturumu → workspace okuma → iptal/audit. Gerçek kullanıcı verisini bundan önce bağlama.
5. Sonraki P0 fazlarını [yol haritası](04-Fazlar/00-yol-haritasi.md) ve [başlangıç görevi](07-AI-Teslim/UYGULAMAYA-BASLA.md) ile sürdür.

## Tasarım ve karar kayıtları

- [İlk uygulama kararı](06-Kararlar/ADR-006-ilk-uygulama-temeli.md)
- [Genel admin hub vizyonu](06-Kararlar/ADR-005-admin-panellerinin-hubu.md)
- [Entegrasyon/çalışma alanları](03-Mimari/04-entegrasyon-ve-calisma-alanlari.md)
- [Tehdit modeli](03-Mimari/03-tehdit-modeli-ve-kabul-testleri.md)
- [Pilot ve mobil planı](04-Fazlar/02-pilot-ve-mobil-plani.md)

Canlı sisteme yazma/dağıtım, veri taşıma ve mevcut paneli kapatma yapılmadı. Kullanıcının bu turdaki açık repo oluşturma/yayın talimatı kapsamında kaynak kod GitHub'a hazırlanır; bu talimat canlı VPS değişikliği değildir.
