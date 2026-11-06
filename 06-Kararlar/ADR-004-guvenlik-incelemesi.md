# ADR-004: İlk İnceleme Sonrası Güvenlik Düzeltmeleri

Durum: Plan belgelerine uygulandı; uygulama ve kabul testleri bekliyor.  
Tarih: 2026-11-06

Sonraki karar: Tek kuruluş ve ilk entegrasyon kapsamı [ADR-005](ADR-005-admin-panellerinin-hubu.md) ile güncellendi. Aşağıdaki P0 kapsam ifadeleri ilk inceleme kararının tarihçesidir; diğer güvenlik düzeltmeleri geçerlidir.

## Bağlam

ADR-003'te e-posta OTP ile kurtarma kodları aynı yedek kategorisindeydi. Faz planı riskli işlem doğrulamasını çekirdek yönetimden sonraya bırakıyordu. İlk yönetici kurulumu, hesap kurtarma ve modül servislerine güven sınırı yeterince tanımlanmamıştı.

## Karar

- E-posta/SMS, zorunlu TOTP politikasını karşılamaz. E-posta OTP adres doğrulama ve kurtarma talebi için kullanılabilir; yönetim oturumu veya faktör sıfırlama yetkisi vermez.
- Kurtarma kodu ve parola yalnızca kısıtlı kurtarma oturumu açar. Yeni TOTP doğrulanmadan yönetim erişimi verilmez. Tüm faktörler kayıpsa ayrı, belgeli işletmeci kurtarması gerekir.
- P0 hesapları için TOTP zorunludur. MFA'yı isteğe bağlı yapan operatör politikası P1'de ayrı kararla değerlendirilir.
- Step-up temeli Faz 3'te; rol, kullanıcı ve güvenlik ayarı değişikliklerinde uygulanması Faz 4'tedir.
- Nesne/modül kapsamı ve izin devri sınırı her sunucu işleminde kontrol edilir. Son etkin süper yönetici eşzamanlı isteklerle dahi kaldırılamaz.
- Yerel değişiklik ve audit aynı transaction içindedir. Harici yazmalarda transactional outbox ve idempotency kullanılır; uzaktaki işlemle yerel DB'nin atomik olduğu varsayılmaz.
- İlk sürüm tek kuruluş kurulumu içindir. Çok kiracılı güvenlik garantisi verilmez. Modül manifestleri incelenen kod/yapılandırmadır; uzaktan çalıştırılabilir eklenti değildir.
- Referans kopyaları ve mevcut sisteme ait ayrıntılı güvenlik bulguları public Git deposuna ve Docker bağlamına alınmaz.

## Önceki kararlarla ilişki

ADR-003'ün e-posta/SMS yedek girişi ve genel 2FA ifadelerini bu karar daraltır; parola ve oturum teknolojileri korunur. ADR-001'in referansları build dışında tutma kuralı public depo kapsamına da uygulanır. Eski ADR'ler tarihçe olarak tutulur.

## Sonuç ve sınır

Kurtarma kolaylığı uğruna yönetici faktörünü atlatan bir giriş yolu oluşmaz. Bunun bedeli, tüm faktörleri kaybeden kullanıcının manuel kurtarma beklemesidir. Süreler ve deneme limitleri güvenlik belgesindeki başlangıç politikasıdır; kabul testleri ve yük ölçümü ile doğrulanacaktır.

Dayanak: [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html). Bu karar bir standart uygunluk veya sertifikasyon iddiası değildir.
