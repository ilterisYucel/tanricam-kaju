# Tanrıçam & Kaju — Hastane Nöbeti

**Oyun Tasarım Dokümanı (GDD) / Teknik Özet**

- **Sürüm:** 1.0 (Android release; 39 bölüm, R1/R2 uygulandı)
- **Tarih:** 15 Kasım 2026
- **Platformlar:** Web (Vite), Android (Capacitor), iOS (macOS'ta derlenecek)
- **Motor:** Phaser 3.90 + TypeScript
- **Kabuk:** Ionic 9 + React 19 + Capacitor 8
- **Tasarım çözünürlüğü:** 1280 × 720, 16:9, yatay
- **Kayıt:** `localStorage` (`tanricam-kaju-save-v1`)

> Bu sürümde R1 (floor tile'ı kesmeden tam yerleştirme) ve R2
> (yükseltilmiş platformların `high_floor.png` ile geri gelmesi) uygulandı.
> 39 bölümün tamamı `assets/levels/*.txt` matrislerinden üretilir ve
> `helpless.png` içindeki 39 hayvanın her biri bir bölümde kurtarılır.

## 0. Uygulanan plan — 15 Kasım 2026 düzeltme turu

### Oransal `U` modeli (sabit 720 referansı)

- [x] `U = 720 / 10 = 72 px`; `layout.ts` tek kaynak. Ground `8U = 576`,
  step `1.5U = 108`, üst katlar `5U = 360` ve `3.5U = 252`.
- [x] Gap `2.8U = 202 px`; floor tile 1942 px tam kalır, bölümler
  `4 tile + gap` sınırında (~8.200 px).
- [x] Suşi ölçeği `0.95`; karakter/atribut ölçekleri `U`'dan türetilir.

### Havada asılı high-floor

- [x] `high_floor` sprite'ları kırpılmaz; bütün olarak ölçeklenir
  (RAISED1 a 0.38 / b 0.48 / e 0.42; RAISED2 b 0.39 / e 0.35).
- [x] Platformlar gap'lerin ortasında, havada asılı; gövdeleri zemine
  değmez (RAISED1 en az 24 px, RAISED2 RAISED1'in 4 px üstünde biter).
  RAISED2, RAISED1'in yanına basamak olarak konur; doğrudan üstüne değil.
- [x] Üst katlar tek yönlü; alttan geçip üstüne konulur.
- [x] Tekerlekli `c` gap'te zemine, O2 rack `d` zemine dekor olarak konur.
- [x] 39 matris seeded varyasyonla yeniden üretildi: farklı ground
  pattern'i, farklı gap, sprite, kat ve dekor; her bölüm farklı.
- [x] Doktor ×1.5, hemşire ×1.55 (elit ×1.7/×1.75); Yağmur'un boyuna yakın.
- [x] Ayrı can/temas hasarı: doktor 6/2, hemşire 5/1, mikrop 4–5/1,
      iltihap 3/1, boss 20/2.
- [x] Otomatik zorluk: her 10 bölümde +%20 can, +%10 hız; boss dahil.
- [x] Düşman üstü can barı, isabet sayıları.
- [x] Suşi 0.95 ölçek; saldırı maksimumdayken +1 kalp.
- [x] Mobil düzen: sağda hareket, solda dikey ZIPLA + DOMESTOS/SARMA ikon
      kartları; `?touch=1` masaüstü önizleme.
- [x] 39 matris yeniden üretildi; validator, preview, web testi, APK.

**Kabul:** `pnpm run check`, `pnpm run build`, `validate:levels`,
`preview:levels`; web CDP testleri; Android debug APK.

---

## 1. Vizyon

Küçük, sıcak ve biraz tuhaf bir hastane rüyasında geçen 2D platformer.
Oyuncu, nişanlısı ("Tanrıçam") ve köpeği Kaju ile birlikte hastane
yataklarından oluşan koridorlarda ilerler; mikroplara domestos, insan
düşmanlara sarma atar; suşi toplayarak saldırısını güçlendirir ve her
bölümde bir minik dostu kurtarır.

### Tasarım sütunları

1. **Birlikte oynamak:** Tanrıçam ve Kaju her zaman birlikte; Kaju takip eder,
   kurtarmalarda sevinir ve ileride düşmana dalabilecek.
2. **Doğru silah, doğru düşman:** Mikroplara domestos, insanlara sarma.
   Yanlış silah işe yaramaz; oyuncu hedefe göre silah değiştirir.
3. **Kurtarma:** Her bölümde tam 1 hayvan; 39 bölümde 39 benzersiz dost.
4. **Mobil öncelikli:** 16:9 yatay, büyük dokunmatik alanlar, kısa oturumlar.
5. **Elle tasarlanmış bölümler:** ASCII matris verisi, doğrulanabilir, 39 bölüm.
6. **Sevimli ama gerilimli:** Hastane korkusu yerine oyuncak hastane
   estetiği; kan yok, temizlik ve iyileşme var.

---

## 2. Zemin ve platform modeli (R1/R2 — uygulandı)

### R1 — Floor tile tam yerleşim

- `zemin.png` / `floor-strip.png`: **1942 × 302 px**, tek doğrusal tile.
- Tile **asla kesilmez, kırpılmaz, sıkıştırılmaz**. Her zemin parçası
  `n × 1942 px`; görsel `n` tam tile'ın yan yana konmasıyla oluşur.
- `TileSprite` ile keyfi genişlik, `setCrop`, `setDisplaySize` ile sıkıştırma
  yok.
- Platformun başlangıcı/bitişi tile sınırıdır. Boşluklar (gap) yalnızca tam
  tile'lar arasında açılır.
- Görsel: `x = runStart + k × 1942`, `y = surfaceY − 150`.
- Çarpışma: her ground run için statik gövde; üst `surfaceY = 576`
  (`8U`), yükseklik 24 px. Serum askıları, monitörler ve yatak başlıkları
  dekoratif; çarpışmaz. Ayaklar battaniye hizasına basar.
- Seviye toplamı = ground run'lar + gap'ler. Level matrisinde `#` = bir tam
  tile, `.` = 202 px gap (`2.8U`).

### R2 — Yükseltilmiş platformlar `high_floor.png` ile

- Zemin tile'ı doğrusal olduğu için yükseltilmiş platformlar ayrı
  `high_floor.png` sprite'larından yapılır; `floor-strip` yukarı kat olarak
  kullanılmaz.
- `surfaceY = 360` (RAISED1, `5U`) ve `252` (RAISED2, `3.5U`).
- Platformlar zemine engel olarak konmaz; **gap'lerin üstünde, havada asılı**
  üst kat rotası olarak durur. Gövdeleri zemine değmez: RAISED1 en az 24 px
  yukarıda biter; RAISED2, RAISED1 yüzeyinin en az 4 px üstünde biter.
- RAISED2 doğrudan RAISED1'in üstüne değil, **yanına basamak** olarak konur
  (gap kenarından yandaki zemine taşar); böylece oyuncu alt platformdayken
  üst sprite'ın içine girmez.
- Erişilebilirlik: bitişik platforma yatay kenar mesafesi ≤180 px ve
  yükselme ≤245 px. Ground→RAISED1 216 px; RAISED1→RAISED2 108 px.
- Üst katlar **tek yönlüdür**: oyuncu alttan geçip üstüne konar; yan/alt
  çarpışma yoktur.
- Sprite'lar **kırpılmaz**, bütün olarak ölçeklenir; bir platform run'ı tek
  statik gövdeyle desteklenir. Askı/kol kısımları gap içinde dekoratif kalır.

| Tile | Kaynak sprite | Ham boyut | RAISED1 ölçek | RAISED2 ölçek | Yürüme yüzeyi offset |
|---|---|---|---|---|---|
| `high-floor-a` | sprite 1 | 501×441 | 0.38 | — | 0 (en üst) |
| `high-floor-b` | sprite 2 | 419×266 | 0.48 | 0.39 | 0 (en üst) |
| `high-floor-e` | sprite 5 | 326×410 | 0.42 | 0.35 | 125 (ölçeklenir) |
| `high-floor-c` | sprite 3 | 270×371 | — | — | gap'te tekerlekli araba, 0.72, çarpışmasız |
| `high-floor-decor` | sprite 4 | 260×296 | — | — | zeminde O2 rack, 0.85, çarpışmasız |

- Eski `floor-ledge.png` kaldırıldı; `floor` çıktısı yalnızca full
  `floor-strip.png`.
- Zıplama yüksekliği ~250 px; ground→360 (216 px) ve 360→252 (108 px)
  erişilebilir. RAISED2 yalnızca bir RAISED1'in yanına basamak olarak konur.
- Üst katlarda en az bir suşi bonusu bulunur; ana yol zorunlu değildir.

### `assets/levels/*.txt` matris formatı

Her bölüm bir ASCII matrisidir; parser `src/game/data/levelParser.ts`.

```text
# 01 — İlk Nöbet
name: İlk Nöbet
theme: day
animal: 0
hint: ...

GROUND : #.#
RAISED1: ......................................................b
RAISED2:
DECOR  : ................................................................................d
E0     : ..........m...................................u...t..........k..
E1     : ................................s...............................
E2     : ................................................................
```

- `GROUND`: `#` tam 1942 px tile; `.` 202 px gap.
- `RAISED1`/`RAISED2`: `a/b/e` = tam high-floor sprite, ölçekli
  genişlik; `.` = 36 px boş. RAISED1 y=360, RAISED2 y=252. Gap'in ortasına
  konur; zemine engel değildir. Üst kata suşi koy.
- `DECOR`: `c` = gap'te tekerlekli araba, `d` = zeminde O2 rack;
  ikisi de çarpışmasız. `.` = 36 px.
- `E0` = zemin (y=576), `E1` = RAISED1 (y=360), `E2` = RAISED2 (y=252).
- `E0/E1/E2`: 96 oransal slot; `x = levelWidth × (i+0.5)/96`.
  Harfler: `m` mikrop, `M` güçlü mikrop, `f` uçan, `p` iltihap, `d` doktor,
  `n` hemşire, `b` boss, `s/t/u/v` suşi 2–5, `g` yeşil garnitür, `k` hayvan.
- Ayrıntılı legend: `assets/levels/README.md`.

### Doğrulama

`pnpm run validate:levels`:

- 39 dosya, 39 benzersiz hayvan (0–38), boss yalnızca 39. bölümde.
- İlk ground run x=0; her ground run `n × 1942`.
- Gap 202 px.
- Raised tile'lar geçerli ve ölçekli; gövdeleri zemine/alt kata değmez.
  Her RAISED1 bir gap'in ortasında; RAISED2 bir RAISED1'in yanında basamak.
  Aynı yükseklikteki platformlar en az 120 px ayrık. Erişim: bitişik
  platforma ≤180 px yatay mesafe ve ≤245 px yükselme.
- Suşi 35–210 px yükseklikte; düşmanlar doğru yüzeyde.
- Hayvan ground run üzerinde.

`pnpm run preview:levels` → `work/level-previews/01.png … 39.png`
(gerçek tile'lar + renkli entity işaretleri).

---

## 3. Oyun döngüsü

1. Menüden bölüm seçilir veya **DEVAM** ilk tamamlanmamış bölümü açar.
2. Bölüm başında isim + kısa ipucu gösterilir (~5 sn).
3. Oyuncu tam tile zeminlerde ilerler; gap'lerden atlar, raised platformlara
   çıkar.
4. Doğru silahı seçer:
   - Mikrop / iltihap → **domestos**
   - Doktor / hemşire → **sarma**
5. Suşi toplar (XP) ve yeşil garnitürle (kalp) iyileşir.
6. Bölüm sonundaki hayvana ulaşır; kurtarma animasyonu + bölüm tamam ekranı.
7. Kayıt: bölüm tamamlandı, XP/saldırı seviyesi, ses tercihi.
8. Sonraki bölüm açılır; 39. bölüm sonunda final ekranı.

Ölüm: 3 kalp biter veya boşluğa düşülürse son güvenli noktaya dönülür;
kalp biterse bölüm baştan. Kalpler her bölümde 3'e döner; saldırı seviyesi
kalıcıdır.

---

## 4. Kontroller

| Eylem | Klavye | Mobil (mevcut) |
|---|---|---|
| Yürüme | A/D veya ←/→ | **Sağ altta** ◀ / ▶ |
| Zıplama | Boşluk / W / ↑ | Sol tarafta dikey ZIPLA kartı |
| Domestos | J | Sol tarafta dikey DOMESTOS SALDIRISI kartı (şişe ikonu) |
| Sarma | K | Sol tarafta dikey SARMA SALDIRISI kartı (sarma ikonu) |
| Duraklat | Esc | Sağ üst II |

**Planlanan:** sağ alttaki ◀/▶ yerine mobil analog joystick; solda dikey
ZIPLA + iki saldırı ikon kartı kalacak. Ölü bölge ~%15, çoklu dokunma,
overlay'lerde gizleme. Klavye aynı kalacak. Masaüstü tarayıcıda kontrolleri
görmek için URL'ye `?touch=1` eklenir.

---

## 5. Oyuncu — Tanrıçam

| Özellik | Değer |
|---|---|
| Kalp | 3 |
| Dokunulmazlık | 1.1 sn |
| Yatay hız | 300 px/s (maks. 340) |
| Hızlanma / sürtünme | 2500 / 2600 |
| Zıplama hızı | −1000 px/s |
| Zıplama yüksekliği | ~250 px |
| Coyote time | 110 ms |
| Jump buffer | 120 ms |
| Gövde | 46 × 160 px |
| Sprite hücresi | 134 × 201 px |

- Animasyonlar: yürüme 7 frame, idle 5 frame, koşu 2 frame (şu an
  kullanılmıyor), zıplama/düşüş için idle frame'i.
- Ateş: 70 ms eğilme + namlu partikülü + kamera sarsıntısı.
- Hasar: düşman teması türüne göre 1–2 (doktor/boss 2), boşluğa düşme
  1 kalp; geri tepme + blink.
- Boşluğa düşünce son güvenli noktaya döner; `lastSafe` ground/raised
  yüzeyine göre güncellenir.

---

## 6. Kaju — yol arkadaşı

**Mevcut:**

- Fiziksiz takipçi; oyuncunun arkasında lerp ile ilerler.
- 10 frame koşu; durunca frame 0; 420 px'den fazla uzaklaşırsa ışınlanır.
- Kurtarmada zıplayıp sevinir, havlama sesi çalar.
- Saldırmaz; oyuncuya engel olmaz.

**Planlanan:** aktif "pati" butonu/tuşu + cooldown; Kaju yakındaki düşmana
kısa lunge yapar, ısırır ve döner. Hasar/sersemletme dengesi açık karar;
öneri 1 hasar + kısa stun, asıl elemek doğru silahla.

---

## 7. Silah sistemi

| Silah | Hedef | Mermi | Hız | Not |
|---|---|---|---|---|
| Domestos | Mikrop, iltihap | Yeşil şişe + köpük patlaması | 720 px/s | Düz, otomatik nişan |
| Sarma (dolma) | Doktor, hemşire | Dolma | 540 px/s | Hafif yay, otomatik nişan |

- Ateş cooldown: **340 ms**; cephane sınırsız.
- Auto-aim: en yakın doğru tür düşman, 540 px yatay / 190 px dikey,
  baktığı yönde. Diz hizasındaki iltihap da vurulur.
- Yanlış silah: 0 hasar, "ETKİSİZ!" yazısı.
- Saldırı seviyesi 1–5; XP eşikleri **0 / 6 / 15 / 28 / 45**.
- Hasar = saldırı seviyesi; mermi ölçeği seviye başına ~%5.5 büyür.
- Mermi havuzu 18; ömür 1.7 sn; ekran dışında kapanır.
- Domestos isabetinde `domestos-burst`; sarma isabetinde partikül.

---

## 8. Düşmanlar

| Düşman | Tür | Can | Temas hasarı | Davranış | Silah |
|---|---|---|---|---|---|
| Doktor | human | 6 (elit 8) | 2 | Devriye; yakında hücum | Sarma |
| Hemşire | human | 5 (elit 7) | 1 | Devriye; yakında iğne hamlesi | Sarma |
| Mikrop (5 görünüm) | microbe | 4–5 | 1 | Devriye / uçan hover / hücum | Domestos |
| İltihap (5 evre) | microbe | 3 | 1 | Zıplayarak yaklaşma; can azaldıkça frame küçülür | Domestos |
| Dev mutant mikrop (boss) | microbe | 20 | 2 | Zıplama, yaklaşma, 3 küçük mikrop çağırma | Domestos |

- Güç sırası: doktor > hemşire > mikrop > iltihap.
- Doktor/hemşire sprite'ları Yağmur'un boyuna yakın büyütüldü
  (×1.5 / ×1.55; elit ×1.7 / ×1.75).
- **Otomatik zorluk:** her 10 bölümde düşman canı +%20, hızı +%10
  (1–10 ×1.0, 11–20 ×1.2, 21–30 ×1.4, 31–39 ×1.6). Boss da ölçeklenir.
- Vuruşta beyaz flash, geri tepme, 180 ms stun; hasar alan düşmanın üstünde
  küçük can barı; isabet sayıları.
- Ölümde partikül + kamera sarsıntısı; boss 900 ms sönüm.
- Boss HP barı oyuncu ~950 px yaklaşınca görünür.
- Boss (39. bölüm) ölmeden hayvan kurtarılamaz; "ÖNCE ONU DURDUR!".

---

## 9. Suşi ve ekonomi

| Kind | Görsel | Etki |
|---|---|---|
| 0 | Yeşil garnitür 1 | +1 kalp; doluysa +1 XP |
| 1 | Yeşil garnitür 2 | +1 kalp; doluysa +1 XP |
| 2 | Maki | +1 XP |
| 3 | Nigiri 1 | +1 XP |
| 4 | Nigiri 2 | +1 XP |
| 5 | Nigiri 3 | +2 XP |

- XP eşikleri: **6 / 15 / 28 / 45** → saldırı Sv. 2 / 3 / 4 / 5.
- Seviye atlayınca "SALDIRI GÜÇLENDİ!" ve ses.
- Suşiler **0.95 ölçekte** (suşi olduğu net okunur), hafif bob + büyük
  glow; toplanınca partikül; glow yok olur.
- Saldırı Sv.5 (maks) iken suşi +1 kalp verir; can doluysa "CAN DOLU".

---

## 10. Kurtarma ve ilerleme

- Her bölümde 1 hayvan; **39 bölümde 39 benzersiz dost**.
- `helpless.png` hayvanları **connected-component** ile çıkarılır; sabit grid
  yok, hiçbir hayvan ortadan kesilmez. Sıra: satır 0 → 00–12, satır 1 →
  13–25, satır 2 → 26–38.
- Hayvan son ground run'ın sonunda; altın glow + "!" işareti.
- Kurtarma: hayvan yukarı süzülür, kalp partikülleri, Kaju zıplar, havlama +
  kurtarma arpeji.
- `completeLevel(id)`; aynı bölüm tekrar oynansa da çift sayılmaz.
- Bölüm tamam overlay'i: hayvan görseli, kurtarılan sayısı, "SONRAKİ BÖLÜM"
  / "MENÜ".
- 39. bölüm sonunda final overlay'i: **13×3 = 39 hayvan** grid'i + "TÜM
  DOSTLAR KURTARILDI!" + menü.
- Bölüm seç: **8×5 grid** (39 bölüm); kilit sırayla açılır; tamamlanan
  bölümde hayvan minyatürü.

---

## 11. 39 bölüm

| # | Bölüm | Tema | Hayvan |
|---|---|---|---|
| 1 | İlk Nöbet | Gündüz | 0 |
| 2 | Koridor | Gündüz | 1 |
| 3 | Yanlış İlaç | Gündüz | 2 |
| 4 | Hemşire Nöbeti | Gündüz | 3 |
| 5 | Ziyaret Saati | Gündüz | 4 |
| 6 | Serum Ormanı | Gündüz | 5 |
| 7 | Acil Servis | Akşam | 6 |
| 8 | Ameliyathane | Akşam | 7 |
| 9 | Yoğun Bakım | Akşam | 8 |
| 10 | Mikrop Yuvası | Akşam | 9 |
| 11 | Doktorlar Konseyi | Akşam | 10 |
| 12 | İltihap | Akşam | 11 |
| 13 | Başhemşire | Gece | 12 |
| 14 | Karantina | Gece | 13 |
| 15 | Gece Nöbeti | Gece | 14 |
| 16 | Eczane | Gece | 15 |
| 17 | Kritik | Gece | 16 |
| 18 | Kayıp Koridor | Gece | 17 |
| 19 | Kaju’nun Kabusu | Gece | 18 |
| 20 | Gece Vardiyası | Gece | 19 |
| 21 | Koridorun Sonu | Gece | 20 |
| 22 | İzolasyon | Gece | 21 |
| 23 | Ziyaretçi Salonu | Gece | 22 |
| 24 | Serum Yolu | Gece | 23 |
| 25 | Röntgen | Gece | 24 |
| 26 | Laboratuvar | Gece | 25 |
| 27 | Ameliyat Öncesi | Gece | 26 |
| 28 | Narkoz | Gece | 27 |
| 29 | Kan Bankası | Gece | 28 |
| 30 | Radyoloji | Gece | 29 |
| 31 | Yeni Doğan | Gece | 30 |
| 32 | Hastane Mutfağı | Gece | 31 |
| 33 | Çamaşırhane | Gece | 32 |
| 34 | Kafeterya | Gece | 33 |
| 35 | Çatı Nöbeti | Gece | 34 |
| 36 | Bodrum Katı | Gece | 35 |
| 37 | Karanlık Koridor | Gece | 36 |
| 38 | Kaju’nun Nöbeti | Gece | 37 |
| 39 | Son Nöbet | Gece | 38 (boss) |

Genişlikler matristen gelir; erken bölümler ~4–6k px, geç bölümler
~12–14k px. Her bölümde en az bir raised `high_floor` platformu, 1–11 düşman,
3–8 suşi ve 2–3 ground run bulunur.

---

## 12. UI / UX

### Menü

- Başlık: **TANRIÇAM & KAJU — HASTANE NÖBETİ**.
- Tanrıçam büyük idle sprite; Kaju koşu; yüzen suşi/kalpler.
- Sağ panelde: DEVAM/BAŞLA, BÖLÜM SEÇ, SES: AÇIK/KAPALI, SIFIRLA.
- Alt bilgi: kurtarılan dost sayısı, "Senin için ♥".
- Programatik hastane koridoru arka planı (pencereler, ECG, saat).
- Panel ve overlay'ler CanvasTexture (Android WebView Graphics çatlaklarını
  önlemek için).

### Bölüm seç

- **8×5 grid**; 39 bölüm tek ekrana sığar; scroll yok.
- Kilitli/açık/tamamlanmış durumları; tamamlananda hayvan minyatürü.

### HUD

- Sol üst: 3 kalp, saldırı XP barı, "SALDIRI Sv. X", XP metni.
- Üst orta: bölüm numarası + adı.
- Boss yaklaşınca: "MUTANT MİKROP" HP barı.
- Sağ üst: pause.
- Mobil: **sağda** hareket (◀/▶; ileride joystick), **solda** zıplama + iki
  saldırı butonu; overlay'lerde gizlenir. Masaüstü denetim için `?touch=1`.

### Overlay'ler

- **Pause:** DEVAM / YENİDEN BAŞLAT / MENÜ.
- **Bölüm tamam:** hayvan görseli, kurtarılan sayısı, SONRAKİ BÖLÜM / MENÜ.
- **Hata:** TEKRAR / MENÜ.
- **Final:** 39 hayvan grid'i (13×3), "TÜM DOSTLAR KURTARILDI!", MENÜ.
- Tüm paneller CanvasTexture; arka plan dim'i.

### Yönlendirme

- Yatay 16:9; native orientation lock.
- Web portrait: "Telefonu yan çevir" DOM overlay'i.
- Android: status bar gizli; geri tuşu oyunu duraklatır; arka plana geçince
  otomatik pause.

---

## 13. Sanat yönü

- **Paletler:** gündüz (mint/teal + sıcak sarı), akşam (turuncu/teal),
  gece (koyu mavi + neon yeşil).
- **Karakterler:** AI üretimi pixel-art; arka planlar temizlenmiş.
- **Zemin:** hastane yatakları; tam 1942 px tile; serum askıları/monitörler
  dekor.
- **Yükseltilmiş platformlar:** `high_floor.png` (5 sprite); 4 dekor/çıkıntı.
- **Arka plan:** programatik hastane koridoru; pencereler, ECG, saat,
  yumuşak parallax.
- **UI:** koyu teal panel, mint accent, yuvarlak köşeler, beyaz metin.
- **Font:** sistem (Trebuchet/Verdana); Türkçe karakterler sorunsuz.
- **VFX:** partikül, hafif kamera sarsıntısı, domestos köpük patlaması,
  suşi glow, kalp partikülleri.

---

## 14. Ses

- Tüm SFX WebAudio ile sentezleniyor: zıplama, atış, isabet, immunity,
  pickup, seviye atlama, hasar, kurtarma, havlama, boss.
- Müzik: WebAudio ile üretilmiş 64 adımlı yumuşak macera döngüsü (~16 sn);
  aralarda Kaju havlama esintisi.
- Ses aç/kapat menüde; master gain ile susturuluyor.
- Bu müzik placeholder; gerçek/üretilmiş track ile değiştirilebilir
  (`src/game/audio.ts`).

---

## 15. Kayıt ve ilerleme

`localStorage`: `tanricam-kaju-save-v1`

```json
{
  "version": 1,
  "completed": [1, 2],
  "xp": 6,
  "attackLevel": 2,
  "sound": true
}
```

- `completed`: 1–39 arası bölüm ID'leri; kurtarılan dost = uzunluk.
- `xp`: 0–45; saldırı seviyesi XP'den türetilir.
- `sound`: ses tercihi.
- Reset: menüde SIFIRLA → onay → kayıt silinir, menü yeniden başlar.
- Bölüm kilidi: `id === 1 || completed.includes(id-1)`.
- Bölüm tamamlanınca ve XP pickup'ta hemen yazılır.

---

## 16. Teknik mimari

```text
src/
  pages/GamePage.tsx              Ionic sayfası; Phaser mount/unmount, native lifecycle
  theme/variables.css             Ionic tema + portrait uyarısı
  game/
    config.ts                     Phaser config, 1280×720, FIT, gravity
    types.ts                      LevelDef, PlatformDef, EnemyDef, HudState
    save.ts                       save/XP/kilit/ses (39 bölüm)
    audio.ts                      WebAudio SFX + müzik döngüsü
    scenes/
      BootScene.ts
      PreloadScene.ts              manifest + animasyonlar
      MenuScene.ts                 ana menü + 8×5 bölüm seç + reset
      GameScene.ts                 level builder, combat, rescue, camera
      UIScene.ts                   HUD, touch, overlay'ler
    entities/
      Player.ts
      Kaju.ts
      Enemy.ts
      Projectile.ts
    data/
      levelParser.ts              ASCII matrix -> LevelDef
      levels.ts                   assets/levels/*.txt glob + parse
      manifest.json               asset pipeline çıktısı
    ui/
      background.ts               programatik hastane + parallax
      widgets.ts                  buton, panel (CanvasTexture), kalp
tools/
  build-assets.mjs                checkerboard temizleme + frame çıkarma
  validate-assets.mjs
  validate-levels.ts              matrix validator
  preview-levels.ts               PNG level preview
assets/
  *.png                           orijinal AI çıktıları (read-only)
  levels/*.txt                    düzenlenebilir 39 level matrix
public/assets/game/               işlenmiş sprite'lar
android/                          Capacitor Android projesi
```

### Fizik ve zemin

- Arcade Physics; statik gövde grubu.
- Ground: her run için bir statik gövde; üst `y=576`.
- Görsel `y = 576 − 150`.
- Oyuncu gövdesi 46×160; sprite alt hizalı.
- Raised: platform run'ı için bir gövde; üst `y=360/252`; görseller
  ölçekli, `y = surfaceY − surfaceOffset × scale`. Üst katlar tek yönlü.
- Düşmanlar aynı zemine/raised yüzeyine oturur; uçanlar gravity kapalı.
- Kamera X takip; Y sabit; deadzone 240×720.

### Combat akışı

- `requestAttack(weapon)` → `attackQueue` → cooldown → `Projectile.fire`.
- Auto-aim doğru tür düşmanı seçer; yoksa düz atış.
- `overlap(projectiles, enemies)` → species kontrolü → hasar/immunity.
- `overlap(player, enemies)` → temas hasarı + i-frames.
- `overlap(player, pickups)` → heal/XP.
- Hayvan kontrolü mesafe ile; boss aktifse engel.

---

## 17. Asset hattı

### Kaynak ve çıktı

- Orijinaller: `assets/*.png` (salt-okunur pipeline girdisi).
- Level verisi: `assets/levels/*.txt` (düzenlenebilir).
- İşlenmiş: `public/assets/game/`.
- Debug: `work/clean/`, `work/contact/`, `work/level-previews/`.
- Manifest: `src/game/data/manifest.json` (+ public kopyası).

### Arka plan temizliği

- Kenardan flood-fill; checkerboard açık/az doygun pikseller.
- Sadece kenara bağlı arka plan silinir; sprite içindeki beyazlar korunur.
- 1–2 px açık renk fringe temizliği; koyu outline korunur.
- FAL kullanılmadı; tamamen yerel ve deterministik.

### Frame çıkarma

- Connected-component + satır gruplama; sabit grid varsayılmıyor.
- Animasyonlar alt-merkez hizalı, eşit hücreli yatay strip'e normalize.
- Ortak hücre: hero 134×201, doktor 77×115, hemşire 71×114.

| Sheet | Frame |
|---|---|
| hero-walk | 7 |
| hero-idle | 5 |
| hero-run | 2 (kullanılmıyor) |
| kaju-run | 10 |
| doctor-walk | 7 |
| doctor-charge | 3 |
| nurse-walk | 7 |
| nurse-attack | 2 |
| microbe-skins | 5 |
| pus-stages | 5 |

- Tekil görseller: 6 suşi, dolma, domestos şişe A/B, domestos patlama.
- Hayvanlar: **39** `animal-00…38`; component extraction, grid cut yok.
- Zemin: `floor-strip.png` 1942×302 (`surfaceOffset=150`).
- Yükseltilmiş: 5 `high-floor-*` görseli (surfaceOffset manifestte).
- `floor-ledge.png` kaldırıldı.

### Yeniden üretme

```bash
pnpm run assets
pnpm run validate:assets
pnpm run validate:levels
pnpm run preview:levels
```

`FRAME_CONFIG` / `MANUAL_CROPS` tabloları yeni sheet'ler için güncellenir.

---

## 18. Build ve dağıtım

### Web

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run preview
```

- Vite `base: './'`; çıktı `dist/`.

### Android

Gereksinim: Android SDK + **JDK 21** (Capacitor 8).

```bash
pnpm run build
pnpm exec cap sync android
cd android
JAVA_HOME=/yol/jdk-21 ./gradlew assembleDebug
```

- Paket: `com.tanricam.kaju`.
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Test AVD: `Medium_Phone_API_36.0`.
- Native: landscape lock, status bar gizli, geri tuşu pause, arka planda pause.

### iOS

Linux'ta derlenmez; macOS'ta:

```bash
pnpm exec cap add ios
pnpm exec cap sync ios
pnpm exec cap open ios
```

---

## 19. Test ve doğrulama

```bash
pnpm run check          # assets + levels + tsc
pnpm run validate:levels
pnpm run preview:levels
```

- Asset: 10 sheet, 15 image, 39 hayvan, zemin alpha + manifest boyutları.
- Level: 39 matrix, 39 benzersiz hayvan, tam 1942 floor run, gap, raised
  desteği, suşi yüksekliği, boss 39.
- TypeScript derlemesi.
- Manuel: web/Android; menü, bölüm 1/20/39, zıplama, üst kat, dokunmatik.

---

## 20. Mevcut durum

### Tamamlanan

- [x] Ionic React + Vite + Capacitor iskeleti.
- [x] Arka plan temizliği; alpha manifest; 39 hayvan component extraction.
- [x] `high_floor.png` 5 sprite çıkarımı + surface offset.
- [x] R1: tam 1942 floor tile, kesme yok.
- [x] R2: raised platformlar `high_floor` ile gap'lerin üstünde, havada
      asılı y=360/252; gövdeleri zemine değmez; tek yönlü; üst katlarda suşi.
- [x] 39 bölüm ASCII matris + parser + validator + PNG preview.
- [x] Oyuncu hareketi, zıplama, coyote/jump buffer, can/i-frames.
- [x] Kaju takip + kurtarma sevinci.
- [x] Domestos/sarma, auto-aim, immunity, pooled mermi, saldırı seviyeleri.
- [x] Mikrop, iltihap, doktor, hemşire, boss; türe göre can/temas hasarı,
      can barları, isabet sayıları ve otomatik zorluk çarpanı.
- [x] Suşi XP + yeşil garnitür heal; 0.95 ölçek; maks seviyede +1 kalp;
      XP 0/6/15/28/45.
- [x] 39 bölümde 39 benzersiz hayvan kurtarma + final.
- [x] Menü 8×5 bölüm seç, HUD, pause/tamam/hata/final (13×3).
- [x] Save/XP/kilit/ses; 39 bölüm clamp.
- [x] WebAudio SFX + üretilmiş müzik + havlama.
- [x] Mobil dokunmatik butonlar: sağda hareket, solda dikey ZIPLA +
      DOMESTOS/SARMA ikon kartları (joystick değil); `?touch=1` ile
      masaüstünde önizleme; landscape, Android lifecycle.
- [x] Android debug APK build + emülatör testi.
- [x] `assets/logo.png` temiz logo; loading/menü ekranında ve Android
      splash/launcher ikonlarında kullanılır (`pnpm run mobile:art`).
- [x] İmzalı Android release APK + AAB (`versionName 1.0.0`); keystore
      `android/keystore.properties` altında, git dışında.
- [x] Web build, README, GDD, AGENTS.

### Planlanan / yapılmayan

- [ ] Mobil analog joystick (şu an ◀/▶).
- [ ] Kaju saldırısı (şu an sadece takip/celebrate).
- [ ] Checkpoint + bölüm ilerleme çubuğu (geniş bölümler için).
- [ ] FAL ile boyalı arka planlar (şu an programatik).
- [ ] Gerçek/üretilmiş müzik kaydı (şu an synth placeholder).
- [ ] iOS build ve fiziksel cihaz testi.

---

## 21. Sonraki işler

1. **Mobil joystick**
   - Sağ alttaki ◀/▶ yerine joystick; sol altta zıplama + skiller kalacak.
   - `GameScene.setVirtualAxis`; dead zone; multi-touch; overlay gizleme.
2. **Kaju saldırısı**
   - Pati butonu/tuş + cooldown; lunge/ısırık; hasar/sersemletme kararı.
3. **Checkpoint + ilerleme barı**
   - Geniş bölümlerde her ~2500 px; kalp monitörü görseli; HUD çizgisi.
4. **Cila**
   - FAL arka planları; gerçek müzik; nav bar gizleme; iOS.

---

## 22. Açık kararlar

- **Kaju saldırısı:** Aktif buton mu, otomatik mi? 1 hasar + stun mı,
  sadece stun mı? Cooldown? Silah kuralını delmeli mi?
- **Joystick:** Sağ altta sabit mi, dokunulan yerde yüzen mi?
- **Checkpoint:** Hangi sıklıkta, kaç can?
- **FAL:** Menü/parallax arka planı üretmek için kullanılsın mı?
- **Müzik:** Üretilmiş loop kalsın mı, gerçek/telifsiz track mi?
- **iOS:** Hangi macOS makinesinde build alınacak?

---

## 23. Riskler / notlar

- Capacitor 8 Android tarafı **JDK 21** ister; JDK 17 ile Gradle
  `invalid source release: 21` verir.
- Android emülatörde WebGL context/GPU kayıpları görülebildi; fiziksel
  cihaz testi yapılmalı.
- FAL anahtarı sadece `.env`'de; `.gitignore`'da. İstemciye ve APK'ya
  girmiyor.
- Level matrislerinde `E*` satırları 96 slotluk oransal eşleme kullanır;
  bir karakterlik kayma `levelWidth/96` px kaydırır. Preview ile kontrol et.
- `assets/*.png` orijinallerine dokunulmaz; yeni asset pipeline üzerinden
  işlenir.
