# HubPanel Teknik Mimarisi

## Temel karar

HubPanel, ilk sürümde **modüler monolit** olarak kurulacaktır. Tek uygulama içinde net modül sınırları olacak; erken aşamada mikroservis karmaşıklığı oluşturulmayacaktır.

Bu yapı hızlı geliştirme, kolay dağıtım ve güçlü test imkânı sağlar. Trafik veya ekip büyüdüğünde modüller ayrı servise çıkarılabilir.

## Önerilen teknoloji tabanı

- Paket yöneticisi: `pnpm`
- Dil: TypeScript, `strict` mod
- Web: Next.js App Router
- Veritabanı: PostgreSQL
- ORM ve migration: Drizzle ORM / Drizzle Kit
- Önbellek, oran sınırlama ve iş kuyruğu: Redis + BullMQ
- Dosya deposu: S3 uyumlu servis veya mevcut VPS için yalıtılmış volume
- UI ilkeleri: Base UI veya Radix primitifleri üzerine kendi bileşenlerimiz
- Stil: kendi tasarım tokenlarımız; gerekirse Tailwind kullanılabilir
- Test: Vitest + Playwright
- Lint/format: Biome
- Log: yapılandırılmış JSON
- İzleme: OpenTelemetry uyumlu yapı
- Paketleme: Docker

Framework ve kütüphane sürümleri uygulama başlarken sabitlenecek ve kilit dosyası repoya alınacaktır.

## Monorepo yapısı

```text
hubpanel/
  apps/
    web/                 # Yönetim arayüzü ve server route'ları
    worker/              # E-posta, SMS, temizlik ve arka plan işleri
  packages/
    db/                  # Şema, migration ve repository katmanı
    security/            # Oturum, MFA, kriptografi adaptörleri
    contracts/           # API ve modül sözleşmeleri, Zod şemaları
    ui/                  # HubPanel tasarım sistemi
    config/              # Ortak TypeScript, lint ve test ayarları
    observability/       # Log, metrik ve trace yardımcıları
  modules/
    http-connector/      # Genel HTTP sözleşmesi ve güvenli adapter
  examples/
    content-service/     # Sentetik içerik API'si; ilk yönetim işlemi
    second-service/      # Bağımsız salt okunur uyumluluk örneği
  infra/
    docker/
    reverse-proxy/
    backup/
  docs/
```

## Modül modeli

Her uygulama HubPanel'e bir manifest ile bağlanır:

```json
{
  "id": "hubstag",
  "name": "HubStag",
  "version": "1.0.0",
  "permissions": ["hubstag.read", "hubstag.manage"],
  "navigation": [],
  "healthcheck": "/health",
  "capabilities": []
}
```

Manifest yalnızca tanım taşır. Yetki kontrolü server tarafında doğrulanır. Navigation ve capability listeleri kullanıcı izinlerine göre filtrelenir.

P0 manifesti incelenen ve şemayla doğrulanan statik veridir; panelden rastgele URL veya çalıştırılabilir plugin eklenmez. API kök adresi kurulum işletmecisinin izin verdiği hedeflerden seçilir; tarayıcıya servis sırrı verilmez. Bir kurulum birden fazla müşteri workspace'i barındırabilir; izolasyon Faz 1'den itibaren tasarlanır, Faz 8'de gerçek testlerle doğrulanmadan üretim garantisi verilmez. [Workspace ve connector sözleşmesi](04-entegrasyon-ve-calisma-alanlari.md) uygulanır.

### Servis güven sınırı

- HTTP adapteri izinli protokol + host + port + yol sınırını uygular; kullanıcıdan URL alınmaz. Sağlık kontrolü ve medya indirme de bu kurala tabidir.
- Redirect kapalıdır; DNS çözümü ve bağlantı hedefi kontrol edilir. Loopback/link-local/metadata adresleri reddedilir; gerekli özel ağ servislerine yalnızca açıkça tanımlı hedeflerle erişilir. Ağ çıkış kuralı uygulama kontrolünü destekler.
- Servis başına ayrı, en az yetkili kimlik; okuma ve yazma kapsamları ayrıdır. TLS doğrulaması kapatılmaz.
- Timeout, yanıt boyutu, eşzamanlı çağrı ve retry sınırı vardır. Bilinmeyen hata sonsuz retry veya diğer modüllerin çökmesine yol açmaz.
- Modülün kayıtları ve arama sonuçları aktörün kaynak kapsamına göre filtrelenir; yalnızca menü izni yeterli değildir.

Bu SSRF sınırının dayanağı [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html); somut servis allowlist'i adapter geliştirilirken belgelenir.

## Katman sınırları

- `app`: route, layout ve kullanıcı etkileşimi.
- `domain`: iş kuralları ve izin kararları.
- `application`: use-case ve transaction akışları.
- `infrastructure`: veritabanı, e-posta, SMS, HTTP ve dosya adaptörleri.

Bir route doğrudan SQL yazmayacak. Bir ekran doğrudan harici servis çağırmayacak. Harici servisler adapter arkasında olacak.

## Veri modelinin çekirdeği

- `users`
- `workspaces`
- `workspace_memberships`
- `connections` / `connection_credentials` (şifreli ve workspace/uygulama kapsamlı)
- `user_credentials`
- `mfa_factors`
- `recovery_codes`
- `sessions`
- `devices`
- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `applications`
- `application_permissions`
- `notifications`
- `audit_events`
- `security_events`
- `auth_challenges` / `invitations` (amaç, süre, deneme ve tek kullanım durumu)
- `idempotency_records` (Faz 3–4 kritik işlem retry'ları için)
- `outbox_events` (Faz 6B uzak yazma başlamadan önce)
- `settings`
- `feature_flags`

Tüm tablolarda oluşturma/güncelleme zamanı UTC tutulacak. Kullanıcıya gösterimde yerel saat dilimi uygulanacak.

Tenant'a ait kayıtlar `workspace_id` taşır; rol/atama ve ilişkiler aynı kapsama bağlanır. Kullanıcı kimliği ile workspace üyeliği ayrıdır. Sunucu yetki kontrolüne PostgreSQL RLS eklenir; cache, worker ve idempotency kapsamı da workspace içerir. Tenant bağlamı olmayan işlem varsayılan reddedilir.

## API ve veri sözleşmesi

- API yolları `/api/v1` ile sürümlenecek.
- Girdi ve çıktılar Zod ile doğrulanacak.
- Hata yanıtları tek standart modelde olacak.
- Idempotency anahtarı gereken işlemler açıkça belirtilecek.
- Sayfalama cursor tabanlı olacak.
- Yetki kontrolü her server işleminde tekrar yapılacak.

## Okuma ve yazma akışı

- Liste ekranları server tarafında filtrelenip sayfalanacak.
- Formlar server action veya API üzerinden doğrulanacak.
- Kritik değişiklikler transaction içinde yapılacak.
- Audit kaydı işlemle aynı transaction içinde yazılacak.
- Arka plan işleri worker üzerinden çalışacak.

Yerel transaction uzak servise atomiklik sağlamaz. Faz 6B'de yerel işlem niyeti + audit + outbox aynı transaction'a yazılır; worker idempotency anahtarıyla uzak işi dener, sonucu ayrı olayla kaydeder. Timeout sonrası sonuç bilinmiyorsa kullanıcıya “tamamlandı” denmez; durum sorgusu/uzlaştırma gerekir. Uzak servis idempotency sağlamıyorsa otomatik yazma retry'ı açılmaz. Geciken kullanıcı işi çalıştırılmadan önce güncel yetki tekrar denetlenir.

## Tarayıcı güvenliği

- Güçlü CSP başlığı.
- `HttpOnly`, `Secure`, uygun `SameSite` çerezler.
- Origin ve CSRF kontrolü.
- Güvenli dosya yükleme sınırları.
- Kullanıcı verisini HTML'e doğrudan basmama.
- Dış URL yönlendirmelerinde allowlist.

## Kalite kapıları

- TypeScript hata sayısı: sıfır.
- Lint hatası: sıfır.
- Yeni kritik akışta test zorunlu.
- Migration geri alma planı zorunlu.
- Secret taraması zorunlu; staged dosyalar ve ilk public yayın öncesinde tüm Git geçmişi kontrol edilir.
- Bağımlılık güvenlik taraması zorunlu.
- Üretim build'i PR sırasında doğrulanmalı.
- Bağımlılık lisans envanteri ve kilitli sürümler zorunlu. CI workflow'ları en az token izniyle çalışır; dış PR'lara sır verilmez, kullanılan action sürümleri commit SHA ile sabitlenir.
- Auth bağımlılığı seçimi Faz 1 çıktısıdır: bakım durumu, güvenlik duyuruları, lisans, sunucu oturumu/MFA desteği belgelenir. Sıfırdan ürün kodu, sıfırdan kriptografi/protokol uygulaması anlamına gelmez.

## Dağıtım

İlk hedef tek VPS üzerinde Docker Compose:

- `web`
- `worker`
- `postgres`
- `redis`
- `nginx`

PostgreSQL ve Redis dışarı açılmayacak. Yönetim paneli yalnızca HTTPS üzerinden çalışacak. Yedekler şifreli ve ayrı konumda tutulacak. Web/worker DB rolleri migration ve audit bakım rollerinden ayrılır; uygulama superuser ile çalışmaz. Healthcheck'in herkese açık yanıtı sır, bağlantı adresi veya hata stack'i içermez; ayrıntılı readiness iç ağdadır. Docker bağlamında yerel referanslar ve secret dosyaları `.dockerignore` ile dışlanır.

## Bilinçli olarak yapılmayacaklar

- İlk sürümde mikroservis.
- SwzHub dosyalarının parça parça kopyalanması.
- İhtiyaç duyulmayan demo dashboardlar.
- Aynı işi yapan iki farklı state yönetim sistemi.
- Kimlik doğrulama akışını dağınık route'lara yazmak.
