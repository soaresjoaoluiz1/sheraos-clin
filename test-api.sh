#!/bin/bash
BASE="http://127.0.0.1:3005"
PASS=0; FAIL=0

test_it() {
  local name="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  OK $name"; PASS=$((PASS+1))
  else
    echo "  FAIL $name (got: $(echo $actual | head -c 120))"; FAIL=$((FAIL+1))
  fi
}

echo "=== 1. LOGIN ADMIN ==="
RES=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@gestaoclin.com.br","password":"admin2026"}')
test_it "Admin login" "token" "$RES"
TOKEN=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
AUTH="Authorization: Bearer $TOKEN"

echo "=== 2. CRIAR CONTA ==="
RES=$(curl -s -X POST "$BASE/api/accounts" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Clinica Teste","slug":"clinica-teste"}')
test_it "Criar conta" "id" "$RES"
AID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('account',{}).get('id','1'))" 2>/dev/null)

echo "=== 3. CRIAR USUARIOS ==="
RES=$(curl -s -X POST "$BASE/api/users?account_id=$AID" -H "$AUTH" -H "Content-Type: application/json" -d "{\"name\":\"Gerente Test\",\"email\":\"ger@t.com\",\"password\":\"t123\",\"role\":\"gerente\",\"account_id\":$AID}")
test_it "Criar gerente" "id" "$RES"

RES=$(curl -s -X POST "$BASE/api/users?account_id=$AID" -H "$AUTH" -H "Content-Type: application/json" -d "{\"name\":\"Prof Maria\",\"email\":\"prof@t.com\",\"password\":\"t123\",\"role\":\"profissional\",\"account_id\":$AID}")
test_it "Criar profissional" "id" "$RES"
PID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id','3'))" 2>/dev/null)

RES=$(curl -s -X POST "$BASE/api/users?account_id=$AID" -H "$AUTH" -H "Content-Type: application/json" -d "{\"name\":\"Atend Ana\",\"email\":\"at@t.com\",\"password\":\"t123\",\"role\":\"atendente\",\"account_id\":$AID}")
test_it "Criar atendente" "id" "$RES"

echo "=== 4. LOGIN PROFISSIONAL ==="
RES=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"prof@t.com","password":"t123"}')
test_it "Prof login" "token" "$RES"
PT=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
PA="Authorization: Bearer $PT"

echo "=== 5. HORARIOS PROFISSIONAL ==="
RES=$(curl -s -X PUT "$BASE/api/appointments/schedules/$PID?account_id=$AID" -H "$PA" -H "Content-Type: application/json" -d '{"schedules":[{"day_of_week":1,"time_start":"08:00","time_end":"18:00","slot_duration":60},{"day_of_week":3,"time_start":"09:00","time_end":"17:00","slot_duration":45},{"day_of_week":5,"time_start":"08:00","time_end":"12:00","slot_duration":60}]}')
test_it "Salvar horarios" "schedules" "$RES"

RES=$(curl -s "$BASE/api/appointments/schedules/$PID?account_id=$AID" -H "$PA")
test_it "Ler horarios" "schedules" "$RES"

echo "=== 6. SLOTS ==="
NMON=$(python3 -c "from datetime import date,timedelta; d=date.today(); d+=timedelta((7-d.weekday())%7 or 7); print(d)")
RES=$(curl -s "$BASE/api/appointments/slots?account_id=$AID&professional_id=$PID&date=$NMON" -H "$AUTH")
test_it "Slots segunda" "available" "$RES"
echo "    Slots: $(echo "$RES" | python3 -c "import sys,json; s=json.load(sys.stdin).get('slots',[]); print(len(s),'total,',sum(1 for x in s if x['available']),'livres')" 2>/dev/null)"

echo "=== 7. CRIAR PACIENTE ==="
RES=$(curl -s -X POST "$BASE/api/leads?account_id=$AID" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Joao Silva","phone":"11999887766","source":"indicacao"}')
test_it "Criar paciente" "id" "$RES"
LID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('lead',{}).get('id','1'))" 2>/dev/null)

echo "=== 8. AGENDAR CONSULTA ==="
RES=$(curl -s -X POST "$BASE/api/appointments?account_id=$AID" -H "$AUTH" -H "Content-Type: application/json" -d "{\"lead_id\":$LID,\"professional_id\":$PID,\"date\":\"$NMON\",\"time_start\":\"09:00\",\"time_end\":\"10:00\",\"notes\":\"Dor lombar\"}")
test_it "Criar consulta" "appointment" "$RES"
APTID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('appointment',{}).get('id','1'))" 2>/dev/null)

echo "=== 9. AGENDAR COM PATIENT_NAME ==="
RES=$(curl -s -X POST "$BASE/api/appointments?account_id=$AID" -H "$AUTH" -H "Content-Type: application/json" -d "{\"patient_name\":\"Maria Nova\",\"professional_id\":$PID,\"date\":\"$NMON\",\"time_start\":\"10:00\",\"time_end\":\"11:00\"}")
test_it "Auto-create paciente" "appointment" "$RES"

echo "=== 10. CONFLITO ==="
RES=$(curl -s -X POST "$BASE/api/appointments?account_id=$AID" -H "$AUTH" -H "Content-Type: application/json" -d "{\"lead_id\":$LID,\"professional_id\":$PID,\"date\":\"$NMON\",\"time_start\":\"09:30\",\"time_end\":\"10:30\"}")
test_it "Conflito detectado" "ocupado" "$RES"

echo "=== 11. LISTAR CONSULTAS ==="
NSUN=$(python3 -c "from datetime import date,timedelta; d=date.today(); d+=timedelta((7-d.weekday())%7 or 7); print(d+timedelta(6))")
RES=$(curl -s "$BASE/api/appointments?account_id=$AID&date_from=$NMON&date_to=$NSUN" -H "$AUTH")
test_it "Listar semana" "appointments" "$RES"

echo "=== 12. STATUS CONSULTA ==="
RES=$(curl -s -X PUT "$BASE/api/appointments/$APTID?account_id=$AID" -H "$AUTH" -H "Content-Type: application/json" -d '{"status":"confirmed"}')
test_it "Confirmar" "confirmed" "$RES"
RES=$(curl -s -X PUT "$BASE/api/appointments/$APTID?account_id=$AID" -H "$AUTH" -H "Content-Type: application/json" -d '{"status":"completed"}')
test_it "Concluir" "completed" "$RES"

echo "=== 13. CRIAR ANAMNESE ==="
RES=$(curl -s -X POST "$BASE/api/anamneses?account_id=$AID" -H "$PA" -H "Content-Type: application/json" -d "{\"lead_id\":$LID,\"chief_complaint\":\"Dor lombar cronica\",\"history\":\"Sedentario\",\"medications\":\"Nenhum\",\"allergies\":\"Nenhuma\",\"notes\":\"1a consulta\"}")
test_it "Criar anamnese" "anamnese" "$RES"
ANID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('anamnese',{}).get('id','1'))" 2>/dev/null)

echo "=== 14. LISTAR ANAMNESES ==="
RES=$(curl -s "$BASE/api/anamneses?account_id=$AID" -H "$PA")
test_it "Listar anamneses" "anamneses" "$RES"

echo "=== 15. EDITAR ANAMNESE ==="
RES=$(curl -s -X PUT "$BASE/api/anamneses/$ANID?account_id=$AID" -H "$PA" -H "Content-Type: application/json" -d '{"notes":"Encaminhado RPG"}')
test_it "Editar anamnese" "RPG" "$RES"

echo "=== 16. ANAMNESE POR LEAD ==="
RES=$(curl -s "$BASE/api/anamneses/lead/$LID?account_id=$AID" -H "$AUTH")
test_it "Anamnese do paciente" "anamneses" "$RES"

echo "=== 17. PROFISSIONAIS ==="
RES=$(curl -s "$BASE/api/appointments/professionals?account_id=$AID" -H "$AUTH")
test_it "Listar profissionais" "Prof Maria" "$RES"

echo "=== 18. SLOTS APOS AGENDAMENTOS ==="
RES=$(curl -s "$BASE/api/appointments/slots?account_id=$AID&professional_id=$PID&date=$NMON" -H "$AUTH")
test_it "Slots atualizados" "available" "$RES"
echo "    $(echo "$RES" | python3 -c "import sys,json; s=json.load(sys.stdin).get('slots',[]); print(sum(1 for x in s if x['available']),'/',len(s),'livres (2 ocupados)')" 2>/dev/null)"

echo "=== 19. DELETAR ANAMNESE ==="
RES=$(curl -s -X DELETE "$BASE/api/anamneses/$ANID?account_id=$AID" -H "$PA")
test_it "Deletar anamnese" "ok" "$RES"

echo "=== 20. DELETAR CONSULTA ==="
RES=$(curl -s -X DELETE "$BASE/api/appointments/$APTID?account_id=$AID" -H "$AUTH")
test_it "Deletar consulta" "ok" "$RES"

echo ""
echo "================================"
echo "  RESULTADO: $PASS ok / $FAIL falhas"
echo "================================"
