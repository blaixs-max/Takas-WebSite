/**
 * Türkiye il ve ilçe listesi — 81 il, 973 ilçe.
 *
 * Kaynak: PTT posta kodu veri kümesi (npm `turkey-city-regions@1.0.3`,
 * `pk_20210512`). Mahalle satırlarından benzersiz il/ilçe çiftleri çıkarıldı,
 * BÜYÜK HARF gösterimi Türkçe kurallarıyla ("I"→"ı", "İ"→"i") başlık biçimine
 * çevrildi ve Türk alfabesi sırasına dizildi. Sayılar resmî idari bölünüşle
 * uyuşuyor: 81 il, 973 ilçe; İstanbul 39, Ankara 25.
 *
 * ## Neden gömülü bir liste, servis değil
 *
 * Konum seçimi ilan akışının ortasında ve çevrimdışı da çalışmalı; bir ağ
 * çağrısına bağlamak, kullanıcının ilanını kapatabilecek yeni bir hata yolu
 * açardı. Liste yılda bir değişir; değiştiğinde bu dosya elle güncellenir.
 *
 * ## Neden serbest metin değil
 *
 * Önceden konum tek satırlık bir metin kutusuydu ve "kadıköy", "Kadikoy",
 * "İstanbul/Kadıköy", "kadıköy istanbul" hepsi ayrı değer olarak yazılıyordu.
 * Konum bir süzgeç girdisi; süzgeç ancak değerler tekilse çalışır. Artık
 * arama kutusu bu listeyi süzüyor ve yazılan metin değil **seçilen kayıt**
 * saklanıyor.
 *
 * ## Gizlilik
 *
 * Saklanan en ince ayrıntı ilçedir; mahalle bu dosyaya hiç girmiyor. Site
 * açık web ve indeksleniyor — bir ilanın mahallesini yayınlamak satıcının
 * evini sokak düzeyinde daraltırdı. Aynı sebeple mesafe de hiçbir yerde
 * yayınlanmıyor (karşı repodaki `CLAUDE.md`, "Kişisel veri sınırı").
 */
export const IL_ILCE: Readonly<Record<string, readonly string[]>> = {
  'Adana': [
    'Aladağ', 'Ceyhan', 'Çukurova', 'Feke', 'İmamoğlu', 'Karaisalı', 'Karataş', 'Kozan',
    'Pozantı', 'Saimbeyli', 'Sarıçam', 'Seyhan', 'Tufanbeyli', 'Yumurtalık', 'Yüreğir',
  ],
  'Adıyaman': [
    'Besni', 'Çelikhan', 'Gerger', 'Gölbaşı', 'Kahta', 'Merkez', 'Samsat', 'Sincik', 'Tut',
  ],
  'Afyonkarahisar': [
    'Başmakçı', 'Bayat', 'Bolvadin', 'Çay', 'Çobanlar', 'Dazkırı', 'Dinar', 'Emirdağ',
    'Evciler', 'Hocalar', 'İhsaniye', 'İscehisar', 'Kızılören', 'Merkez', 'Sandıklı',
    'Sinanpaşa', 'Sultandağı', 'Şuhut',
  ],
  'Ağrı': [
    'Diyadin', 'Doğubayazıt', 'Eleşkirt', 'Hamur', 'Merkez', 'Patnos', 'Taşlıçay', 'Tutak',
  ],
  'Aksaray': [
    'Ağaçören', 'Eskil', 'Gülağaç', 'Güzelyurt', 'Merkez', 'Ortaköy', 'Sarıyahşi', 'Sultanhanı',
  ],
  'Amasya': ['Göynücek', 'Gümüşhacıköy', 'Hamamözü', 'Merkez', 'Merzifon', 'Suluova', 'Taşova'],
  'Ankara': [
    'Akyurt', 'Altındağ', 'Ayaş', 'Bala', 'Beypazarı', 'Çamlıdere', 'Çankaya', 'Çubuk',
    'Elmadağ', 'Etimesgut', 'Evren', 'Gölbaşı', 'Güdül', 'Haymana', 'Kahramankazan', 'Kalecik',
    'Keçiören', 'Kızılcahamam', 'Mamak', 'Nallıhan', 'Polatlı', 'Pursaklar', 'Sincan',
    'Şereflikoçhisar', 'Yenimahalle',
  ],
  'Antalya': [
    'Akseki', 'Aksu', 'Alanya', 'Demre', 'Döşemealtı', 'Elmalı', 'Finike', 'Gazipaşa',
    'Gündoğmuş', 'İbradı', 'Kaş', 'Kemer', 'Kepez', 'Konyaaltı', 'Korkuteli', 'Kumluca',
    'Manavgat', 'Muratpaşa', 'Serik',
  ],
  'Ardahan': ['Çıldır', 'Damal', 'Göle', 'Hanak', 'Merkez', 'Posof'],
  'Artvin': [
    'Ardanuç', 'Arhavi', 'Borçka', 'Hopa', 'Kemalpaşa', 'Merkez', 'Murgul', 'Şavşat',
    'Yusufeli',
  ],
  'Aydın': [
    'Bozdoğan', 'Buharkent', 'Çine', 'Didim', 'Efeler', 'Germencik', 'İncirliova', 'Karacasu',
    'Karpuzlu', 'Koçarlı', 'Köşk', 'Kuşadası', 'Kuyucak', 'Nazilli', 'Söke', 'Sultanhisar',
    'Yenipazar',
  ],
  'Balıkesir': [
    'Altıeylül', 'Ayvalık', 'Balya', 'Bandırma', 'Bigadiç', 'Burhaniye', 'Dursunbey', 'Edremit',
    'Erdek', 'Gömeç', 'Gönen', 'Havran', 'İvrindi', 'Karesi', 'Kepsut', 'Manyas', 'Marmara',
    'Savaştepe', 'Sındırgı', 'Susurluk',
  ],
  'Bartın': ['Amasra', 'Kurucaşile', 'Merkez', 'Ulus'],
  'Batman': ['Beşiri', 'Gercüş', 'Hasankeyf', 'Kozluk', 'Merkez', 'Sason'],
  'Bayburt': ['Aydıntepe', 'Demirözü', 'Merkez'],
  'Bilecik': [
    'Bozüyük', 'Gölpazarı', 'İnhisar', 'Merkez', 'Osmaneli', 'Pazaryeri', 'Söğüt', 'Yenipazar',
  ],
  'Bingöl': ['Adaklı', 'Genç', 'Karlıova', 'Kiğı', 'Merkez', 'Solhan', 'Yayladere', 'Yedisu'],
  'Bitlis': ['Adilcevaz', 'Ahlat', 'Güroymak', 'Hizan', 'Merkez', 'Mutki', 'Tatvan'],
  'Bolu': [
    'Dörtdivan', 'Gerede', 'Göynük', 'Kıbrıscık', 'Mengen', 'Merkez', 'Mudurnu', 'Seben',
    'Yeniçağa',
  ],
  'Burdur': [
    'Ağlasun', 'Altınyayla', 'Bucak', 'Çavdır', 'Çeltikçi', 'Gölhisar', 'Karamanlı', 'Kemer',
    'Merkez', 'Tefenni', 'Yeşilova',
  ],
  'Bursa': [
    'Büyükorhan', 'Gemlik', 'Gürsu', 'Harmancık', 'İnegöl', 'İznik', 'Karacabey', 'Keles',
    'Kestel', 'Mudanya', 'Mustafakemalpaşa', 'Nilüfer', 'Orhaneli', 'Orhangazi', 'Osmangazi',
    'Yenişehir', 'Yıldırım',
  ],
  'Çanakkale': [
    'Ayvacık', 'Bayramiç', 'Biga', 'Bozcaada', 'Çan', 'Eceabat', 'Ezine', 'Gelibolu',
    'Gökçeada', 'Lapseki', 'Merkez', 'Yenice',
  ],
  'Çankırı': [
    'Atkaracalar', 'Bayramören', 'Çerkeş', 'Eldivan', 'Ilgaz', 'Kızılırmak', 'Korgun',
    'Kurşunlu', 'Merkez', 'Orta', 'Şabanözü', 'Yapraklı',
  ],
  'Çorum': [
    'Alaca', 'Bayat', 'Boğazkale', 'Dodurga', 'İskilip', 'Kargı', 'Laçin', 'Mecitözü', 'Merkez',
    'Oğuzlar', 'Ortaköy', 'Osmancık', 'Sungurlu', 'Uğurludağ',
  ],
  'Denizli': [
    'Acıpayam', 'Babadağ', 'Baklan', 'Bekilli', 'Beyağaç', 'Bozkurt', 'Buldan', 'Çal', 'Çameli',
    'Çardak', 'Çivril', 'Güney', 'Honaz', 'Kale', 'Merkezefendi', 'Pamukkale', 'Sarayköy',
    'Serinhisar', 'Tavas',
  ],
  'Diyarbakır': [
    'Bağlar', 'Bismil', 'Çermik', 'Çınar', 'Çüngüş', 'Dicle', 'Eğil', 'Ergani', 'Hani', 'Hazro',
    'Kayapınar', 'Kocaköy', 'Kulp', 'Lice', 'Silvan', 'Sur', 'Yenişehir',
  ],
  'Düzce': [
    'Akçakoca', 'Cumayeri', 'Çilimli', 'Gölyaka', 'Gümüşova', 'Kaynaşlı', 'Merkez', 'Yığılca',
  ],
  'Edirne': [
    'Enez', 'Havsa', 'İpsala', 'Keşan', 'Lalapaşa', 'Meriç', 'Merkez', 'Süloğlu', 'Uzunköprü',
  ],
  'Elazığ': [
    'Ağın', 'Alacakaya', 'Arıcak', 'Baskil', 'Karakoçan', 'Keban', 'Kovancılar', 'Maden',
    'Merkez', 'Palu', 'Sivrice',
  ],
  'Erzincan': [
    'Çayırlı', 'İliç', 'Kemah', 'Kemaliye', 'Merkez', 'Otlukbeli', 'Refahiye', 'Tercan',
    'Üzümlü',
  ],
  'Erzurum': [
    'Aşkale', 'Aziziye', 'Çat', 'Hınıs', 'Horasan', 'İspir', 'Karaçoban', 'Karayazı',
    'Köprüköy', 'Narman', 'Oltu', 'Olur', 'Palandöken', 'Pasinler', 'Pazaryolu', 'Şenkaya',
    'Tekman', 'Tortum', 'Uzundere', 'Yakutiye',
  ],
  'Eskişehir': [
    'Alpu', 'Beylikova', 'Çifteler', 'Günyüzü', 'Han', 'İnönü', 'Mahmudiye', 'Mihalgazi',
    'Mihalıççık', 'Odunpazarı', 'Sarıcakaya', 'Seyitgazi', 'Sivrihisar', 'Tepebaşı',
  ],
  'Gaziantep': [
    'Araban', 'İslahiye', 'Karkamış', 'Nizip', 'Nurdağı', 'Oğuzeli', 'Şahinbey', 'Şehitkamil',
    'Yavuzeli',
  ],
  'Giresun': [
    'Alucra', 'Bulancak', 'Çamoluk', 'Çanakçı', 'Dereli', 'Doğankent', 'Espiye', 'Eynesil',
    'Görele', 'Güce', 'Keşap', 'Merkez', 'Piraziz', 'Şebinkarahisar', 'Tirebolu', 'Yağlıdere',
  ],
  'Gümüşhane': ['Kelkit', 'Köse', 'Kürtün', 'Merkez', 'Şiran', 'Torul'],
  'Hakkari': ['Çukurca', 'Derecik', 'Merkez', 'Şemdinli', 'Yüksekova'],
  'Hatay': [
    'Altınözü', 'Antakya', 'Arsuz', 'Belen', 'Defne', 'Dörtyol', 'Erzin', 'Hassa', 'İskenderun',
    'Kırıkhan', 'Kumlu', 'Payas', 'Reyhanlı', 'Samandağ', 'Yayladağı',
  ],
  'Iğdır': ['Aralık', 'Karakoyunlu', 'Merkez', 'Tuzluca'],
  'Isparta': [
    'Aksu', 'Atabey', 'Eğirdir', 'Gelendost', 'Gönen', 'Keçiborlu', 'Merkez', 'Senirkent',
    'Sütçüler', 'Şarkikaraağaç', 'Uluborlu', 'Yalvaç', 'Yenişarbademli',
  ],
  'İstanbul': [
    'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler', 'Bakırköy',
    'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü', 'Beyoğlu', 'Büyükçekmece',
    'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt', 'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa',
    'Güngören', 'Kadıköy', 'Kağıthane', 'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik',
    'Sancaktepe', 'Sarıyer', 'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
    'Ümraniye', 'Üsküdar', 'Zeytinburnu',
  ],
  'İzmir': [
    'Aliağa', 'Balçova', 'Bayındır', 'Bayraklı', 'Bergama', 'Beydağ', 'Bornova', 'Buca',
    'Çeşme', 'Çiğli', 'Dikili', 'Foça', 'Gaziemir', 'Güzelbahçe', 'Karabağlar', 'Karaburun',
    'Karşıyaka', 'Kemalpaşa', 'Kınık', 'Kiraz', 'Konak', 'Menderes', 'Menemen', 'Narlıdere',
    'Ödemiş', 'Seferihisar', 'Selçuk', 'Tire', 'Torbalı', 'Urla',
  ],
  'Kahramanmaraş': [
    'Afşin', 'Andırın', 'Çağlayancerit', 'Dulkadiroğlu', 'Ekinözü', 'Elbistan', 'Göksun',
    'Nurhak', 'Onikişubat', 'Pazarcık', 'Türkoğlu',
  ],
  'Karabük': ['Eflani', 'Eskipazar', 'Merkez', 'Ovacık', 'Safranbolu', 'Yenice'],
  'Karaman': ['Ayrancı', 'Başyayla', 'Ermenek', 'Kazımkarabekir', 'Merkez', 'Sarıveliler'],
  'Kars': ['Akyaka', 'Arpaçay', 'Digor', 'Kağızman', 'Merkez', 'Sarıkamış', 'Selim', 'Susuz'],
  'Kastamonu': [
    'Abana', 'Ağlı', 'Araç', 'Azdavay', 'Bozkurt', 'Cide', 'Çatalzeytin', 'Daday', 'Devrekani',
    'Doğanyurt', 'Hanönü', 'İhsangazi', 'İnebolu', 'Küre', 'Merkez', 'Pınarbaşı', 'Seydiler',
    'Şenpazar', 'Taşköprü', 'Tosya',
  ],
  'Kayseri': [
    'Akkışla', 'Bünyan', 'Develi', 'Felahiye', 'Hacılar', 'İncesu', 'Kocasinan', 'Melikgazi',
    'Özvatan', 'Pınarbaşı', 'Sarıoğlan', 'Sarız', 'Talas', 'Tomarza', 'Yahyalı', 'Yeşilhisar',
  ],
  'Kırıkkale': [
    'Bahşılı', 'Balışeyh', 'Çelebi', 'Delice', 'Karakeçili', 'Keskin', 'Merkez', 'Sulakyurt',
    'Yahşihan',
  ],
  'Kırklareli': [
    'Babaeski', 'Demirköy', 'Kofçaz', 'Lüleburgaz', 'Merkez', 'Pehlivanköy', 'Pınarhisar',
    'Vize',
  ],
  'Kırşehir': ['Akçakent', 'Akpınar', 'Boztepe', 'Çiçekdağı', 'Kaman', 'Merkez', 'Mucur'],
  'Kilis': ['Elbeyli', 'Merkez', 'Musabeyli', 'Polateli'],
  'Kocaeli': [
    'Başiskele', 'Çayırova', 'Darıca', 'Derince', 'Dilovası', 'Gebze', 'Gölcük', 'İzmit',
    'Kandıra', 'Karamürsel', 'Kartepe', 'Körfez',
  ],
  'Konya': [
    'Ahırlı', 'Akören', 'Akşehir', 'Altınekin', 'Beyşehir', 'Bozkır', 'Cihanbeyli', 'Çeltik',
    'Çumra', 'Derbent', 'Derebucak', 'Doğanhisar', 'Emirgazi', 'Ereğli', 'Güneysınır', 'Hadim',
    'Halkapınar', 'Hüyük', 'Ilgın', 'Kadınhanı', 'Karapınar', 'Karatay', 'Kulu', 'Meram',
    'Sarayönü', 'Selçuklu', 'Seydişehir', 'Taşkent', 'Tuzlukçu', 'Yalıhüyük', 'Yunak',
  ],
  'Kütahya': [
    'Altıntaş', 'Aslanapa', 'Çavdarhisar', 'Domaniç', 'Dumlupınar', 'Emet', 'Gediz', 'Hisarcık',
    'Merkez', 'Pazarlar', 'Simav', 'Şaphane', 'Tavşanlı',
  ],
  'Malatya': [
    'Akçadağ', 'Arapgir', 'Arguvan', 'Battalgazi', 'Darende', 'Doğanşehir', 'Doğanyol',
    'Hekimhan', 'Kale', 'Kuluncak', 'Pütürge', 'Yazıhan', 'Yeşilyurt',
  ],
  'Manisa': [
    'Ahmetli', 'Akhisar', 'Alaşehir', 'Demirci', 'Gölmarmara', 'Gördes', 'Kırkağaç',
    'Köprübaşı', 'Kula', 'Salihli', 'Sarıgöl', 'Saruhanlı', 'Selendi', 'Soma', 'Şehzadeler',
    'Turgutlu', 'Yunusemre',
  ],
  'Mardin': [
    'Artuklu', 'Dargeçit', 'Derik', 'Kızıltepe', 'Mazıdağı', 'Midyat', 'Nusaybin', 'Ömerli',
    'Savur', 'Yeşilli',
  ],
  'Mersin': [
    'Akdeniz', 'Anamur', 'Aydıncık', 'Bozyazı', 'Çamlıyayla', 'Erdemli', 'Gülnar', 'Mezitli',
    'Mut', 'Silifke', 'Tarsus', 'Toroslar', 'Yenişehir',
  ],
  'Muğla': [
    'Bodrum', 'Dalaman', 'Datça', 'Fethiye', 'Kavaklıdere', 'Köyceğiz', 'Marmaris', 'Menteşe',
    'Milas', 'Ortaca', 'Seydikemer', 'Ula', 'Yatağan',
  ],
  'Muş': ['Bulanık', 'Hasköy', 'Korkut', 'Malazgirt', 'Merkez', 'Varto'],
  'Nevşehir': [
    'Acıgöl', 'Avanos', 'Derinkuyu', 'Gülşehir', 'Hacıbektaş', 'Kozaklı', 'Merkez', 'Ürgüp',
  ],
  'Niğde': ['Altunhisar', 'Bor', 'Çamardı', 'Çiftlik', 'Merkez', 'Ulukışla'],
  'Ordu': [
    'Akkuş', 'Altınordu', 'Aybastı', 'Çamaş', 'Çatalpınar', 'Çaybaşı', 'Fatsa', 'Gölköy',
    'Gülyalı', 'Gürgentepe', 'İkizce', 'Kabadüz', 'Kabataş', 'Korgan', 'Kumru', 'Mesudiye',
    'Perşembe', 'Ulubey', 'Ünye',
  ],
  'Osmaniye': ['Bahçe', 'Düziçi', 'Hasanbeyli', 'Kadirli', 'Merkez', 'Sumbas', 'Toprakkale'],
  'Rize': [
    'Ardeşen', 'Çamlıhemşin', 'Çayeli', 'Derepazarı', 'Fındıklı', 'Güneysu', 'Hemşin',
    'İkizdere', 'İyidere', 'Kalkandere', 'Merkez', 'Pazar',
  ],
  'Sakarya': [
    'Adapazarı', 'Akyazı', 'Arifiye', 'Erenler', 'Ferizli', 'Geyve', 'Hendek', 'Karapürçek',
    'Karasu', 'Kaynarca', 'Kocaali', 'Pamukova', 'Sapanca', 'Serdivan', 'Söğütlü', 'Taraklı',
  ],
  'Samsun': [
    'Alaçam', 'Asarcık', 'Atakum', 'Ayvacık', 'Bafra', 'Canik', 'Çarşamba', 'Havza', 'İlkadım',
    'Kavak', 'Ladik', 'Salıpazarı', 'Tekkeköy', 'Terme', 'Vezirköprü', 'Yakakent', '19 Mayıs',
  ],
  'Siirt': ['Baykan', 'Eruh', 'Kurtalan', 'Merkez', 'Pervari', 'Şirvan', 'Tillo'],
  'Sinop': [
    'Ayancık', 'Boyabat', 'Dikmen', 'Durağan', 'Erfelek', 'Gerze', 'Merkez', 'Saraydüzü',
    'Türkeli',
  ],
  'Sivas': [
    'Akıncılar', 'Altınyayla', 'Divriği', 'Doğanşar', 'Gemerek', 'Gölova', 'Gürün', 'Hafik',
    'İmranlı', 'Kangal', 'Koyulhisar', 'Merkez', 'Suşehri', 'Şarkışla', 'Ulaş', 'Yıldızeli',
    'Zara',
  ],
  'Şanlıurfa': [
    'Akçakale', 'Birecik', 'Bozova', 'Ceylanpınar', 'Eyyübiye', 'Halfeti', 'Haliliye', 'Harran',
    'Hilvan', 'Karaköprü', 'Siverek', 'Suruç', 'Viranşehir',
  ],
  'Şırnak': ['Beytüşşebap', 'Cizre', 'Güçlükonak', 'İdil', 'Merkez', 'Silopi', 'Uludere'],
  'Tekirdağ': [
    'Çerkezköy', 'Çorlu', 'Ergene', 'Hayrabolu', 'Kapaklı', 'Malkara', 'Marmaraereğlisi',
    'Muratlı', 'Saray', 'Süleymanpaşa', 'Şarköy',
  ],
  'Tokat': [
    'Almus', 'Artova', 'Başçiftlik', 'Erbaa', 'Merkez', 'Niksar', 'Pazar', 'Reşadiye',
    'Sulusaray', 'Turhal', 'Yeşilyurt', 'Zile',
  ],
  'Trabzon': [
    'Akçaabat', 'Araklı', 'Arsin', 'Beşikdüzü', 'Çarşıbaşı', 'Çaykara', 'Dernekpazarı',
    'Düzköy', 'Hayrat', 'Köprübaşı', 'Maçka', 'Of', 'Ortahisar', 'Sürmene', 'Şalpazarı',
    'Tonya', 'Vakfıkebir', 'Yomra',
  ],
  'Tunceli': [
    'Çemişgezek', 'Hozat', 'Mazgirt', 'Merkez', 'Nazımiye', 'Ovacık', 'Pertek', 'Pülümür',
  ],
  'Uşak': ['Banaz', 'Eşme', 'Karahallı', 'Merkez', 'Sivaslı', 'Ulubey'],
  'Van': [
    'Bahçesaray', 'Başkale', 'Çaldıran', 'Çatak', 'Edremit', 'Erciş', 'Gevaş', 'Gürpınar',
    'İpekyolu', 'Muradiye', 'Özalp', 'Saray', 'Tuşba',
  ],
  'Yalova': ['Altınova', 'Armutlu', 'Çınarcık', 'Çiftlikköy', 'Merkez', 'Termal'],
  'Yozgat': [
    'Akdağmadeni', 'Aydıncık', 'Boğazlıyan', 'Çandır', 'Çayıralan', 'Çekerek', 'Kadışehri',
    'Merkez', 'Saraykent', 'Sarıkaya', 'Sorgun', 'Şefaatli', 'Yenifakılı', 'Yerköy',
  ],
  'Zonguldak': [
    'Alaplı', 'Çaycuma', 'Devrek', 'Ereğli', 'Gökçebey', 'Kilimli', 'Kozlu', 'Merkez',
  ],
};

export interface Konum {
  il: string;
  ilce: string;
  /** Saklanan ve gösterilen biçim: "Kadıköy, İstanbul". */
  etiket: string;
}

/**
 * Düzleştirilmiş liste — modül yüklenirken bir kez kuruluyor.
 *
 * Etiket ilçeyle başlıyor çünkü kullanıcı ilçesini arıyor, ilini değil; ve
 * 51 ilde "Merkez" adında bir ilçe var — tek başına "Merkez" bir bilgi
 * değil. İl adı yanına yazılınca hem ayırt ediyor hem de kartta okunur
 * kalıyor.
 */
export const KONUMLAR: readonly Konum[] = Object.entries(IL_ILCE).flatMap(([il, ilceler]) =>
  ilceler.map((ilce) => ({ il, ilce, etiket: `${ilce}, ${il}` })),
);

/**
 * Türkçeye duyarsız arama anahtarı: "kadikoy" ile "Kadıköy" eşleşmeli.
 *
 * Sıra önemli. `toLowerCase()` önce çalışıyor çünkü JavaScript'te
 * `'İ'.toLowerCase()` "i" değil, "i" + birleşen nokta (U+0307) veriyor;
 * o noktayı sonraki NFD ayıklaması siliyor. Türkçe harf tablosu tek başına
 * yetmez — şapkalı harfler (`â`) yalnızca NFD ile düşüyor. Sitedeki
 * `kategoriSlug` aynı iki aşamalı yolu izliyor ve aynı sebeple.
 */
function anahtar(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Arama anahtarları önceden hesaplanıyor: her tuş vuruşunda 973 kez
    normalize etmek, listeyi süzmekten pahalı. */
const ANAHTARLAR = KONUMLAR.map((k) => ({
  ilce: anahtar(k.ilce),
  il: anahtar(k.il),
}));

/**
 * Bir aramada gösterilen en fazla sonuç.
 *
 * Dışa açık, çünkü **sessiz kırpma yalan söyler**: "merkez" yazan kullanıcı 51
 * ilçeden 40'ını görür ve kendi ilçesi listede yokmuş gibi durur. Ekran bu
 * sayıya bakıp "daralt" uyarısı çiziyor; iki yerde iki ayrı sabit olsaydı
 * biri değişince uyarı yanlış eşikte çıkardı.
 */
export const KONUM_LIMIT = 40;

/**
 * Konum arar. Boş sorguda en kalabalık illerin ilçeleri değil, **hiçbir şey**
 * dönmüyor: hazır bir liste göstermek, kullanıcının kendi ilçesini aramak
 * yerine ilk gördüğünü seçmesine yol açardı.
 *
 * Sıralama üç kademeli — ilçe adının başına uyanlar, ilin başına uyanlar,
 * sonra içinde geçenler. "kadi" yazınca Kadıköy ilk sırada olmalı; aynı
 * harfleri içinde barındıran uzak bir ilçe önüne geçmemeli. İl önekinin de
 * sayması şart: 51 ilde "Merkez" adında bir ilçe var ve o kullanıcıların tek
 * makul araması kendi illerinin adı.
 */
export function konumAra(sorgu: string, limit = KONUM_LIMIT): Konum[] {
  const q = anahtar(sorgu.trim());
  if (q.length < 2) return [];

  const bulunan: { k: Konum; puan: number }[] = [];
  for (let i = 0; i < KONUMLAR.length; i++) {
    const a = ANAHTARLAR[i];
    let puan = -1;
    if (a.ilce.startsWith(q)) puan = 0;
    else if (a.il.startsWith(q)) puan = 1;
    else if (a.ilce.includes(q)) puan = 2;
    else if (a.il.includes(q)) puan = 3;
    if (puan >= 0) bulunan.push({ k: KONUMLAR[i], puan });
  }

  bulunan.sort((x, y) => x.puan - y.puan || x.k.etiket.localeCompare(y.k.etiket, 'tr'));
  return bulunan.slice(0, limit).map((b) => b.k);
}

/**
 * Saklanan etiketi listedeki kayda geri çevirir.
 *
 * Taslak düzenlemede gerekiyor: veri tabanında konum "Kadıköy, İstanbul" gibi
 * bir dizge olarak duruyor ve ekranın onu seçili göstermesi için kaydın
 * kendisi lazım. Bulunamazsa `null` — eski serbest metin konumu taşıyan ya da
 * "Belirtilmedi" olan taslaklar seçimsiz açılıyor ve kullanıcı yeniden seçiyor.
 */
export function konumBul(etiket: string | null | undefined): Konum | null {
  if (!etiket) return null;
  return KONUMLAR.find((k) => k.etiket === etiket) ?? null;
}
