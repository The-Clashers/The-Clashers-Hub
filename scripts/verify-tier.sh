#!/usr/bin/env bash
# End-to-end verification of the local tier against the mock upstream.
# Every route and every branch of the error contract gets one check.
# Usage: bash scripts/verify-tier.sh   (mock + tier must be running)

BASE="http://localhost:8788"
PASS=0
FAIL=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    PASS=$((PASS + 1))
    printf 'ok    %-52s %s\n' "$label" "$actual"
  else
    FAIL=$((FAIL + 1))
    printf 'FAIL  %-52s expected=%s actual=%s\n' "$label" "$expected" "$actual"
  fi
}

status() { curl -s -o /tmp/v.json -w '%{http_code}' "$@"; }
hdr() { curl -s -D - -o /dev/null "$@" | tr -d '\r' | grep -i "^$2:" | awk '{print $2}'; }
body_field() { python3 -c "import json;d=json.load(open('/tmp/v.json'));print(d.get('$1','<missing>'))" 2>/dev/null || echo '<not-json>'; }

# --- search ---
check "search 200"                    200 "$(status "$BASE/api/search?name=mock&limit=5")"
check "search fresh name x-cache MISS" MISS "$(hdr "$BASE/api/search?name=freshcheck" x-cache)"
sleep 2
check "search x-cache HIT second"     HIT  "$(hdr "$BASE/api/search?name=mock&limit=5" x-cache)"
check "search age grows on hit"       2    "$(curl -s "$BASE/api/search?name=mock&limit=5" | python3 -c 'import json,sys;print(json.load(sys.stdin)["age"])')"
check "search two names never alias"  MISS "$(hdr "$BASE/api/search?name=other" x-cache)"
check "search missing name -> 400"    400  "$(status "$BASE/api/search")"
check "search bad minMembers -> 400"  400  "$(status "$BASE/api/search?name=x&minMembers=999")"
check "search bad frequency -> 400"   400  "$(status "$BASE/api/search?name=x&warFrequency=sometimes")"

# --- clan ---
check "clan 200 with roster"          200  "$(status "$BASE/api/clan/%23MOCKCLAN")"
check "clan roster came along"        2    "$(curl -s "$BASE/api/clan/%23MOCKCLAN" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["memberList"]))')"
check "clan unencoded tag resolves"   200  "$(status "$BASE/api/clan/MOCKCLAN")"
check "clan cache HIT"                HIT  "$(hdr "$BASE/api/clan/%23MOCKCLAN" x-cache)"

# --- player ---
check "player 200"                    200  "$(status "$BASE/api/player/%23MOCKPLAY")"
check "player carries troops"         2    "$(curl -s "$BASE/api/player/%23MOCKPLAY" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["troops"]))')"

# --- war ---
check "war 200"                       200  "$(status "$BASE/api/clan/%23MOCKCLAN/war")"

# --- warlog private ---
check "warlog private -> 200"         200  "$(status "$BASE/api/clan/%23MOCKCLAN/warlog")"
check "warlog private body flag"      True "$(curl -s "$BASE/api/clan/%23MOCKCLAN/warlog" | python3 -c 'import json,sys;print(json.load(sys.stdin)["private"])')"
check "warlog private has age"        0    "$(curl -s "$BASE/api/clan/%23MOCKCLAN/warlog" | python3 -c 'import json,sys;print(json.load(sys.stdin)["age"])')"

# --- warlog public ---
check "warlog public -> 200 items"    200  "$(status "$BASE/api/clan/%23PUBLICLO/warlog")"
check "warlog public entries"         2    "$(curl -s "$BASE/api/clan/%23PUBLICLO/warlog" | python3 -c 'import json,sys;print(len(json.load(sys.stdin)["items"]))')"

# --- warlog allowlist 403 with an unknown reason is not a private log ---
check "warlog unknown 403 -> 502"     502  "$(status "$BASE/api/clan/%23DENIED/warlog")"
check "warlog unknown 403 code"       upstream_unreachable "$(curl -s "$BASE/api/clan/%23DENIED/warlog" | python3 -c 'import json,sys;print(json.load(sys.stdin)["error"])')"

# --- contract paths ---
status "$BASE/api/clan/%23NOTFOUND" > /dev/null
check "not_found status"              404  "$(status "$BASE/api/clan/%23NOTFOUND")"
check "not_found tag echoed"          '#NOTFOUND' "$(curl -s "$BASE/api/clan/%23NOTFOUND" | python3 -c 'import json,sys;print(json.load(sys.stdin)["tag"])')"
check "not_found negatively cached"   HIT  "$(hdr "$BASE/api/clan/%23NOTFOUND" x-cache)"

check "upstream 400 -> bad_request"   400  "$(status "$BASE/api/clan/%23BADREQ")"
check "upstream 400 reason in detail" badName "$(curl -s "$BASE/api/clan/%23BADREQ" | python3 -c 'import json,sys;print(json.load(sys.stdin)["detail"])')"

check "upstream fail -> 502"          502  "$(status "$BASE/api/search?name=fail")"
check "502 error code"                upstream_unreachable "$(curl -s "$BASE/api/search?name=fail" | python3 -c 'import json,sys;print(json.load(sys.stdin)["error"])')"

check "invalid tag -> 400"            400  "$(status "$BASE/api/clan/%ZZ%%")"

check "non-GET -> 405"                405  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/search?name=x")"

check "unknown route -> 404"          404  "$(status "$BASE/api/nothing")"

# --- slow paths last: busy (retry budget ~2s) and timeout (4s) ---
check "429 after retries -> 503"      503  "$(status "$BASE/api/clan/%23BUSY")"
check "busy retryAfter from header"   2    "$(curl -s "$BASE/api/clan/%23BUSY" | python3 -c 'import json,sys;print(json.load(sys.stdin)["retryAfter"])')"
check "busy error code"               upstream_busy "$(curl -s "$BASE/api/clan/%23BUSY" | python3 -c 'import json,sys;print(json.load(sys.stdin)["error"])')"

check "hanging upstream -> 502"       502  "$(status "$BASE/api/clan/%23HANG/war")"

echo
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ]
