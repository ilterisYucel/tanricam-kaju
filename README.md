# Tanrıçam & Kaju — Hastane Nöbeti

39 bölümlük, yatay 2D platformer. Yağmur ve Kaju hastane yataklarından oluşan
zeminlerde ilerler; mikroplara **domestos**, insanlara **sarma** atar; suşi
toplayarak saldırısını güçlendirir ve her bölümde bir minik dostu kurtarır.
`helpless.png` içindeki 39 hayvanın tamamı birer bölümde kurtarılır.

- **Motor:** Phaser 3.90 + TypeScript
- **Kabuk:** Ionic 9 + React 19 + Vite
- **Mobil:** Capacitor 8 (Android hazır; iOS macOS'ta eklenir)
- **Tasarım çözünürlüğü:** 1280×720, 16:9 yatay
- **Kayıt:** `localStorage` (`tanricam-kaju-save-v1`)

## Monorepo (saru-nx)

Bu uygulama `~/Documents/saru-nx/apps/tanricam-kaju` altında bir **git
submodule**'dır. Monorepo kökünden:

```bash
pnpm install
pnpm nx run tanricam-kaju:serve
pnpm nx run tanricam-kaju:build
pnpm nx run tanricam-kaju:check
```

Submodule commit/push:

```bash
cd ~/Documents/saru-nx
git submodule update --init --recursive
cd apps/tanricam-kaju
git add -A && git commit -m "..." && git push
cd ../..
git add apps/tanricam-kaju
git commit -m "chore: update tanricam-kaju submodule"
git push
```

## Hızlı başlangıç

Submodule tek başına açıldıysa:

```bash
pnpm install
pnpm run dev
```

Monorepo içinde `pnpm install` monorepo kökünden çalıştırılır. Tarayıcıda
`http://localhost:5173` (port doluysa Vite bir sonrakini seçer).

### Kontroller

| Eylem | Klavye | Mobil |
|---|---|---|
| Yürüme | A/D veya ←/→ | **Sağ alttaki** ◀ / ▶ (ileride joystick) |
| Zıplama | Boşluk / W / ↑ | Sol tarafta dikey ZIPLA kartı |
| Domestos | J | Sol tarafta dikey DOMESTOS SALDIRISI kartı (şişe ikonu) |
| Sarma | K | Sol tarafta dikey SARMA SALDIRISI kartı (sarma ikonu) |
| Duraklat | Esc | Sağ üstteki II |

Dokunmatik kontroller normalde yalnızca touch cihazlarda görünür.
Masaüstü tarayıcıda denetlemek için `http://localhost:5173/?touch=1`
(port doluysa Vite'ın verdiği port) ile aç.

Suşi XP verir; yeşil garnitürler (wasabi/zencefil) 1 kalp iyileştirir.
Yanlış silah düşmana hasar vermez, “ETKİSİZ!” yazar.

## Asset hattı

Orijinal PNG'ler `assets/` altında tutulur ve pipeline tarafından salt-okunur
girdi olarak kullanılır. Pipeline bu klasörü değiştirmez; üretilen çıktılar
`public/assets/game/` altına yazılır.

```bash
pnpm run assets
pnpm run validate:assets
```

`tools/build-assets.mjs`:

1. Checkerboard arka planı **kenardan flood-fill** ile siler. Bu yöntem beyaz
   hastane önlüğü, suşi pirinci gibi sprite içindeki açık renkleri korur.
2. Frame'leri connected-component ile çıkarır (sheet'ler düzgün grid değil).
3. Her animasyonu alt-merkez hizalı, eşit hücreli yatay strip'e dönüştürür.
4. `src/game/data/manifest.json` ve `public/assets/game/` çıktısını üretir.
5. `assets/logo.png`'yi temizleyip `public/assets/game/logo.png` olarak yazar.
6. `work/contact/` altında magenta arka planlı kontrol görselleri ve zemin
   çarpışma çizgisi önizlemesi bırakır.

Logo/splash ve uygulama ikonları için:

```bash
pnpm run assets
pnpm run mobile:art
```

`pnpm run mobile:art`, aynı logoyu Android splash ekranlarına ve launcher
ikonlarına basar. Splash; koyu yeşil zemin + logo + “TANRIÇAM & KAJU”
yazısıdır; Android 12+ sistem splash'inde logo, web loading ekranında logo +
başlık görünür.

**Zemin çarpışması:** `zemin.png` görselinin üst sınırı kullanılmaz. Battaniye
yüzeyi (~y=150/302) ölçülür; görünmez statik collider tam bu çizgide durur.
Böylece serum askıları ve yatak başlıkları dekoratif kalır, oyuncu havada
yürümez. Zemin tile'ı **1942px tam genişlikte** yerleştirilir, kesilmez.

Yükseltilmiş platformlar `high_floor.png` sprite'larından üretilir
(`high-floor-a/b/e`; RAISED1 y=360, RAISED2 y=252). Sprite'lar kırpılmaz,
bütün olarak ölçeklenir; platformlar zemine engel olarak değil, **gap'lerin
üstünde havada asılı** bonus rotası olarak yerleştirilir. Oyuncu bitişik
zeminden zıplayarak çıkar; üst katlar tek yönlüdür. Tekerlekli
`high-floor-c` gap'te, O2 rack `high-floor-decor` zeminde çarpışmasız dekor
olarak durur. Eski `floor-ledge.png` kaldırıldı.

`helpless.png` 39 hayvanı **connected-component** ile tek tek çıkarır; sabit
grid kullanılmaz, böylece hiçbir hayvan ortadan kesilmez.

Yeni asset eklerken `tools/build-assets.mjs` içindeki `FRAME_CONFIG` ve
`MANUAL_CROPS` tablolarını güncelle, sonra `pnpm run assets` çalıştır.

## Bölüm doğrulama

```bash
pnpm run validate:levels
pnpm run preview:levels   # work/level-previews/01.png ... 39.png
```

Bölümler `assets/levels/01.txt … 39.txt` ASCII matrix'leridir; format için
`assets/levels/README.md`. Validator şunları denetler: 39 bölüm, 39 benzersiz
hayvan, zemin run'larının tam 1942px katı olması, 202px gap, havada asılı
raised platformların erişilebilirliği, düşman/suşi konumları, bölüm 39 boss'u.
Hata varsa exit code 1 döner.

Paket kontrolü:

```bash
pnpm run check
```

## Web build

```bash
pnpm run build
pnpm run preview
```

Çıktı `dist/` altındadır. Vite `base: './'` olduğu için statik sunucuda ve
Capacitor içinde relative asset yolları çalışır.

## Android

Gereksinimler: Android SDK, Android Studio (veya komut satırı araçları) ve
**JDK 21**. Capacitor 8'in Android kütüphanesi Java 21 ile derlenir. Bu
makinede sistemde JDK 17 vardı; build için geçici bir JDK 21 kullanıldı.
Android Studio'nun kendi JBR 21'i varsa onu gösterebilirsin:

```bash
pnpm run build
pnpm exec cap sync android
cd android
JAVA_HOME=/yol/jdk-21 ./gradlew assembleDebug
```

Debug APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Kurulum:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.tanricam.kaju/.MainActivity
```

### Release / paylaşım APK'sı

Release imzası `android/keystore.properties` + `android/keystore/` altındadır;
ikisi de `.gitignore`'da. **Bu iki dosyayı kaybetme**: sonraki güncellemeler
aynı anahtarla imzalanmazsa telefonda “uygulama güncellenemiyor” hatası çıkar.

```bash
pnpm run assets
pnpm run mobile:art
pnpm run build
pnpm exec cap sync android
cd android
JAVA_HOME=/yol/jdk-21 ./gradlew assembleRelease bundleRelease
```

Çıktılar:

```text
android/app/build/outputs/apk/release/app-release.apk
android/app/build/outputs/bundle/release/app-release.aab
```

APK doğrudan telefona kurulabilir; AAB Google Play içindir. Paylaşmak için
imzalı APK'yı kopyalayabilirsin:

```bash
mkdir -p work/release
cp android/app/build/outputs/apk/release/app-release.apk \
   work/release/Tanricam-Kaju-1.0.0.apk
```

Bu makinede `Medium_Phone_API_36.0` AVD'siyle release APK kuruldu; logo,
Android 12 splash ve menü görsel olarak kontrol edildi. Uygulama açılışta
yatay moda kilitlenir, status bar gizlenir, Android geri tuşu oyunu duraklatır.

### iOS

Linux'ta iOS build alınamaz. macOS'ta:

```bash
pnpm exec cap add ios
pnpm exec cap sync ios
pnpm exec cap open ios
```

## Proje yapısı

```text
src/
  pages/GamePage.tsx          Ionic sayfası, Phaser canvas'ı ve native yaşam döngüsü
  game/
    config.ts                 Phaser ayarları, 1280×720, FIT
    scenes/Boot/Preload/Menu/Game/UI
    entities/Player, Kaju, Enemy, Projectile
    data/levelParser.ts        ASCII matrix -> LevelDef
    data/levels.ts             matrix dosyalarını yükler
    data/manifest.json         üretilen asset manifestosu
    ui/background.ts           programatik hastane koridoru + parallax
    ui/widgets.ts              buton, kalp, panel
    audio.ts                   WebAudio SFX + üretilmiş macera döngüsü
    save.ts                    ilerleme, XP, ses
tools/
  build-assets.mjs             arka plan silme + frame çıkarma
  validate-assets.mjs
  validate-levels.ts
  preview-levels.ts
assets/                        orijinal PNG'ler + düzenlenebilir levels/*.txt
public/assets/game/           işlenmiş sprite'lar
android/                      Capacitor Android projesi
```

## Tasarım notları

- Bölüm verisi `assets/levels/*.txt` ASCII matrix'lerinde; parser
  `src/game/data/levelParser.ts`.
- 39 bölümde 39 kurtarılabilir hayvanın tamamı kullanılır.
- Bölüm 39'da dev mutant mikrop boss'u vardır; boss ölmeden hayvan
  kurtarılamaz.
- Zemin yalnızca tam 1942px `floor-strip` tile'larından; üst katlar
  `high_floor.png` sprite'larından oluşur ve gap'lerin üstünde havada durur.
- Düşmanların türüne göre canı ve temas hasarı vardır; her 10 bölümde can
  +%20, hız +%10 otomatik zorluk çarpanı uygulanır.
- Suşi ölçeği büyütüldü; saldırı maksimumdayken suşi +1 kalp verir.
- Oyuncu 3 kalplidir; boşluğa düşmek 1 kalp götürür ve son güvenli noktaya
  döndürür. Kalpler her bölümde dolar, saldırı seviyesi kalıcıdır.
- Menüdeki **DEVAM** ilk tamamlanmamış bölümü açar. Bölüm seç ekranında
  kilitler sırayla açılır.
- Müzik WebAudio ile üretilen yumuşak bir döngüdür; aralarda Kaju'nun havlama
  esintisi vardır. Gerçek bir kayıtla değiştirmek için `src/game/audio.ts`
  içindeki `startMusic`/`playMusicStep` bölümünü kaldırmak yeterli.

## Güvenlik / notlar

- `.env` git'e girmez (`.gitignore`). `FAL_KEY` istemci koduna hiç girmez;
  sprite arka plan temizliği tamamen yereldir ve FAL kredisi kullanmaz.
  Anahtar ileride menü/parallax görseli üretmek için `tools/` altında
  kullanılabilir.
- `part1.html`–`part10.html` Phaser tutorial referansıdır; oyun kodu bunlardan
  bağımsızdır.
- iOS build bu ortamda denenmedi. Android debug APK ve emülatör testi yapıldı.
