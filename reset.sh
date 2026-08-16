# 1. Hent dine keys fra config.js
URL=$(grep SUPABASE_URL config.js | cut -d"'" -f2)
KEY=$(grep SUPABASE_KEY config.js | cut -d"'" -f2)

echo "🔄 Nulstiller Padel-appen..."

# 2. Sæt status til registration
curl -X PATCH "${URL}/rest/v1/config?id=eq.1" \
  -H "apikey: ${KEY}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"tournament_status": "registration"}'

# 3. Fjern alle spillere fra alle hold
curl -X PATCH "${URL}/rest/v1/teams?id=gt.0" \
  -H "apikey: ${KEY}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"player1": null, "player2": null}'

# 4. Nulstil alle kampe (bevarer runderne men fjerner hold og score)
curl -X PATCH "${URL}/rest/v1/matches?id=gt.0" \
  -H "apikey: ${KEY}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"team_a": null, "team_b": null, "score_a": 0, "score_b": 0, "status": "waiting", "winner_id": null}'

echo "✅ Databasen er nu helt ren og klar til en ny test!"