# ADR-003: Kimlik Doğrulama ve 2FA

Durum: Kabul edildi  
Tarih: 2026-11-06

2026-11-06 inceleme notu: E-posta/SMS yedek girişi, kurtarma oturumu ve zorunlu MFA kapsamı [ADR-004](ADR-004-guvenlik-incelemesi.md) ile daraltılmıştır. Aşağıdaki metin ilk kararın tarihçesidir; uygulamada ADR-004 ve güncel güvenlik belgesi esas alınır.

## Karar

HubPanel kendi kimlik ve oturum akışını uygulayacak; güvenlik açısından kanıtlanmış kütüphaneleri kullanacaktır.

- Parola: Argon2id
- Oturum: sunucu tarafı opak token ve güvenli çerez
- Birincil 2FA: TOTP authenticator uygulaması
- Yedek: e-posta OTP ve kurtarma kodları
- İsteğe bağlı: SMS OTP, Google OIDC, passkey
- Riskli işlemlerde step-up doğrulama

## Gerekçe

- Mevcut SHA-256 parola karşılaştırması ve tek faktörlü giriş yeterli değil.
- Yönetici paneli için oturum iptali ve cihaz takibi gerekli.
- Kullanıcı TOTP, SMS, e-posta ve Google seçeneklerini istiyor.

## Sonuç

- Parola ve kriptografi algoritmaları kendi icadımız olmayacak.
- İş akışları, veri modeli ve kullanıcı deneyimi HubPanel'e ait olacak.
- 2FA tamamlanmadan yönetim oturumu verilmeyecek.
- TOTP sırları şifreli, kurtarma kodları hashli saklanacak.
- Tüm auth adımları audit ve güvenlik olayı üretecek.
