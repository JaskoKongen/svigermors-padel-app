# Hent dine keys fra config.js automatisk (hvis de står på formen const KEY = '...';)
URL=$(grep SUPABASE_URL config.js | cut -d"'" -f2)
KEY=$(grep SUPABASE_KEY config.js | cut -d"'" -f2)

for i in {2..8}
do
  curl -X PATCH "${URL}/rest/v1/teams?id=eq.${i}" \
  -H "apikey: ${KEY}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"player1\": \"Test-spiller ${i}A\", \"player2\": \"Test-spiller ${i}B\"}"
done

echo "BUM! Hold 2-8 er nu fyldt ud."