-- ELDENELE — Değerleme (sıfır fiyattan puana)
--
-- Kritik iddialar: 1 (gerçek çapa tutuyor), 3 (fiyat yoksa puan da yok —
-- uydurulmuyor), 5 (hasar beyanı puanı düşürüyor ve bilinmeyen şiddet
-- satıcının lehine yorumlanmıyor) ve 6 (ayarlar istemciye kapalı).

\echo ''
\echo '=== 1) GERÇEK ÇAPA: Süperman figürü ==='
-- İlk canlı ilan. Sıfırı ₺1599, sahibi "iyi durumda ₺1000 eder" dedi.
-- Merdiven bu tek veri noktasına oturtuldu; tutmazsa oranlar yanlış demektir.
select puan_hesapla(1599, 'İyi durumda') as puan,
       puan_hesapla(1599, 'İyi durumda') between 950 and 1030 as capa_tutuyor;
\echo 'BEKLENEN: ~990 puan, capa_tutuyor = t'

\echo ''
\echo '=== 2) Durum merdiveni monoton ==='
-- Daha iyi durum her zaman daha çok puan etmeli. Eşitlik bile kusurdur:
-- kullanıcı "yeni gibi" seçmenin karşılığını görmezse doğru beyan etmez.
select puan_hesapla(1599, 'Yeni gibi')      as yeni_gibi,
       puan_hesapla(1599, 'Az kullanılmış') as az_kullanilmis,
       puan_hesapla(1599, 'İyi durumda')    as iyi_durumda,
       puan_hesapla(1599, 'Yeni gibi') > puan_hesapla(1599, 'Az kullanılmış')
         and puan_hesapla(1599, 'Az kullanılmış') > puan_hesapla(1599, 'İyi durumda') as monoton;
\echo 'BEKLENEN: monoton = t'

\echo ''
\echo '=== 3) FİYAT YOKSA PUAN DA YOK ==='
-- Model ürünü bulamazsa uydurmuyoruz. null dönmeli ki çağıran ilanı insan
-- kuyruğuna atsın; sıfır ya da bir varsayılan dönseydi, bulunamayan her ürün
-- sessizce yanlış bir puanla yayına girerdi.
select puan_hesapla(null, 'İyi durumda') is null as fiyat_yok_null,
       puan_hesapla(0, 'İyi durumda') is null as sifir_null,
       puan_hesapla(-100, 'İyi durumda') is null as negatif_null;
\echo 'BEKLENEN: üçü de t'

\echo ''
\echo '=== 4) Tanınmayan durum en muhafazakâr banda düşüyor ==='
select puan_hesapla(1599, 'Kutusunda sıfır') = puan_hesapla(1599, 'İyi durumda') as muhafazakar;
\echo 'BEKLENEN: muhafazakar = t (yükseğe değil, düşüğe yuvarlanıyor)'

\echo ''
\echo '=== 5) HASAR PUANI DÜŞÜRÜYOR, BİLİNMEYEN ŞİDDET SATICI LEHİNE DEĞİL ==='
select puan_hesapla(1599, 'İyi durumda', false)          as hasarsiz,
       puan_hesapla(1599, 'İyi durumda', true, 1.0)      as tam_hasar,
       puan_hesapla(1599, 'İyi durumda', true, 0.3)      as hafif_hasar,
       puan_hesapla(1599, 'İyi durumda', true, null)     as siddet_bilinmiyor;
select puan_hesapla(1599, 'İyi durumda', true, 1.0) < puan_hesapla(1599, 'İyi durumda', false) as hasar_dusuruyor,
       puan_hesapla(1599, 'İyi durumda', true, null) = puan_hesapla(1599, 'İyi durumda', true, 1.0) as bilinmeyen_tam_indirim;
\echo 'BEKLENEN: hasar_dusuruyor = t, bilinmeyen_tam_indirim = t'
\echo '          (şiddet bilinmiyorsa TAM indirim — yoksa hasarı gizlemek kârlı olurdu)'

\echo ''
\echo '=== 6) Taban uygulanıyor, tavan KIRPILMIYOR ==='
-- Taban: çok ucuz ürün sıfır puana yuvarlanmasın.
-- Tavan: kırpmak, 50.000'lik bir hatayı sessizce 5.000 yapıp geçirmek olurdu.
-- Bant dışı değer olduğu gibi dönüyor ve çağıran onu insan onayına düşürüyor.
select puan_hesapla(10, 'İyi durumda') as ucuz,
       puan_hesapla(10, 'İyi durumda') >= 50 as taban_var,
       puan_hesapla(100000, 'Yeni gibi') as pahali,
       puan_bandi_disinda(puan_hesapla(100000, 'Yeni gibi')) as bant_disi_isaretlendi;
\echo 'BEKLENEN: taban_var = t, bant_disi_isaretlendi = t (kırpılmadı, işaretlendi)'

\echo ''
\echo '=== 7) AYARLAR VE FORMÜL İSTEMCİYE KAPALI ==='
-- Formülün girdilerini okumak, onu nasıl oynayacağını okumaktır.
select has_table_privilege('authenticated', 'public.valuation_settings', 'select') as auth_tablo,
       has_table_privilege('anon', 'public.valuation_settings', 'select') as anon_tablo;
\echo 'BEKLENEN: ikisi de f'

select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('anon', p.oid, 'execute') as anon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('puan_hesapla','puan_bandi_disinda','admin_degerleme_ayarla')
 order by p.proname;
\echo 'BEKLENEN: yalnızca admin_degerleme_ayarla authenticated = t; anon her yerde f'

\echo ''
\echo '=== 8) Ayar değişince puan değişiyor ==='
-- Katsayılar tabloda olmasının sebebi bu: bir oranı değiştirmek göç yazmayı
-- gerektirmemeli, çünkü değerleme ilk aylarda ayarlanacak.
update valuation_settings set oran_iyi_durumda = 0.50 where id = 1;
select puan_hesapla(1599, 'İyi durumda') as yeni_puan,
       puan_hesapla(1599, 'İyi durumda') between 780 and 820 as ayar_islendi;
update valuation_settings set oran_iyi_durumda = 0.62 where id = 1;
\echo 'BEKLENEN: ayar_islendi = t (~800), sonra eski değere döndü'

\echo ''
\echo '=== 9) HASARLI KONDİSYONU — ŞİDDETE GÖRE GEZİNİYOR ==='
-- 'Hasarlı' tek bir şey değil: köşesi çizilmiş kutu ile tekerleği kırık araba
-- aynı kelimeyle beyan ediliyor. Sabit oran ikisinden birine haksızlık ederdi.
select puan_hesapla(1599, 'Hasarlı', true, 0.0) as hafif,
       puan_hesapla(1599, 'Hasarlı', true, 0.5) as orta,
       puan_hesapla(1599, 'Hasarlı', true, 1.0) as agir;
select puan_hesapla(1599, 'Hasarlı', true, 0.0) > puan_hesapla(1599, 'Hasarlı', true, 1.0) as siddet_isliyor,
       puan_hesapla(1599, 'Hasarlı', true, 0.0) = puan_hesapla(1599, 'İyi durumda') as sifir_siddet_iyi_duruma_esit,
       puan_hesapla(1599, 'Hasarlı', true, 1.0) < puan_hesapla(1599, 'İyi durumda') as agir_daha_dusuk;
\echo 'BEKLENEN: üçü de t — şiddet 0 iyi duruma eşit, şiddet 1 hasarlı bandında'

\echo ''
\echo '=== 10) Hasar iki kez cezalandırılmıyor ==='
-- 'Hasarlı' oranı zaten hasarı fiyatlıyor; üstüne `hasar_indirimi` de
-- uygulansaydı aynı kusur iki kez düşülürdü.
select puan_hesapla(1599, 'Hasarlı', true, 1.0) as hasarli_puan,
       round(1599 * (select oran_hasarli from valuation_settings) / 10) * 10 as beklenen,
       puan_hesapla(1599, 'Hasarlı', true, 1.0)
         = (round(1599 * (select oran_hasarli from valuation_settings) / 10) * 10)::integer as cift_ceza_yok;
\echo 'BEKLENEN: cift_ceza_yok = t'
