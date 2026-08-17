#!/usr/bin/env bash
# ============================================================================
# Bütün göçleri temiz bir veri tabanına uygular, sonra test paketini koşar.
#
#   supabase/tests/kosu.sh                  # yerel varsayılan
#   PGHOST=localhost PGPORT=5433 supabase/tests/kosu.sh
#
# Neden var: göçler canlıya panelden/MCP'den uygulanıyor, yani **dosyaların
# kendisi hiç çalıştırılmıyor.** Bu turda tam olarak o yüzden bozuk bir dosya
# fark edilmeden kaldı: veri tabanı doğruydu, repodaki dosya sözdizimi hatası
# taşıyordu. Bu betik dosyaları çalıştırır — depo ile veri tabanının
# ayrışmasını yakalayan tek şey budur.
# ============================================================================
set -uo pipefail

KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB="${TEST_DB:-kt_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q)

echo "▸ veri tabanı yeniden kuruluyor: $DB"
psql -tAc "drop database if exists $DB" >/dev/null
psql -tAc "create database $DB" >/dev/null

echo "▸ iskele"
"${PSQL[@]}" -d "$DB" -f "$KOK/supabase/tests/00_yerel_kurulum.sql" >/dev/null || exit 1

echo "▸ göçler"
goc_ok=0; goc_hata=0
for f in "$KOK"/supabase/migrations/*.sql; do
  if "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null 2>&1; then
    goc_ok=$((goc_ok + 1))
  else
    goc_hata=$((goc_hata + 1))
    echo "  ✗ $(basename "$f")"
    "${PSQL[@]}" -d "$DB" -f "$f" 2>&1 | grep -m1 ERROR | sed 's/^/     /'
  fi
done
echo "  göç: $goc_ok başarılı, $goc_hata hatalı"

# Test yardımcıları göçlerden SONRA: `rpc_grants_final` bütün fonksiyonlardan
# EXECUTE'u geri alıyor, önce uygulansaydı yardımcının yetkisi silinirdi.
echo "▸ test yardımcıları"
"${PSQL[@]}" -d "$DB" -f "$KOK/supabase/tests/01_test_yardimcilari.sql" >/dev/null || exit 1

# İddia kapsaması. `bekle`/`bekle_esit` çağrısı makine denetimli bir iddiadır;
# `BEKLENEN:` satırı ise yalnızca ekrana yazılıp insana bırakılmıştır.
#
# Bu ayrım 2026-08-17'de pahalıya patladı: bir tetikleyici yanlışlıkla
# `security definer` yazıldı, kontrol hiç çalışmadı, kullanıcı kendi karesini
# onaylayabilir hâle geldi — ve paket yine "24 test geçti" dedi. Bu satır o
# boşluğun büyüklüğünü her koşuda görünür tutuyor; sessizce unutulmasın.
denetimli=$(grep -ho "bekle_esit\?(" "$KOK"/supabase/tests/*_test.sql | wc -l)
elle=$(grep -h "BEKLENEN" "$KOK"/supabase/tests/*_test.sql | wc -l)
echo "▸ iddialar: $denetimli makine denetimli, $elle hâlâ göz kontrolünde"

echo "▸ testler"
t_ok=0; t_hata=0
for f in "$KOK"/supabase/tests/*_test.sql; do
  if out=$("${PSQL[@]}" -d "$DB" -f "$f" 2>&1); then
    t_ok=$((t_ok + 1))
  else
    t_hata=$((t_hata + 1))
    echo "  ✗ $(basename "$f")"
    echo "$out" | grep -m1 ERROR | sed 's/^/     /'
  fi
done
echo "  test: $t_ok geçti, $t_hata başarısız"

echo
if [ "$goc_hata" -eq 0 ] && [ "$t_hata" -eq 0 ]; then
  echo "TEMİZ — $goc_ok göç, $t_ok test"
  exit 0
fi
echo "BAŞARISIZ — $goc_hata göç, $t_hata test"
exit 1
