#!/usr/bin/env python3
"""Signatur für den TestFlight-Bau (läuft nur auf dem GitHub-Mac).

  signatur.py einrichten   legt über die App-Store-Connect-API ein Vertriebszertifikat
                           und ein App-Store-Profil für Mirella an, legt beides in einen
                           eigenen Schlüsselbund und trägt es ins Xcode-Projekt ein.
  signatur.py aufraeumen   löscht Zertifikat und Profil wieder (Apple erlaubt nur wenige).

Braucht ASC_KEY_ID, ASC_ISSUER_ID, APPLE_TEAM_ID und die Schlüsseldatei
~/private_keys/AuthKey_<ASC_KEY_ID>.p8. Nur Python-Standardbibliothek + openssl.
"""
import base64, json, os, re, subprocess, sys, time, urllib.error, urllib.request

BUNDLE = "de.brenzinger.mirella"
# Erweiterungen der App (eigene App-ID und eigenes Profil je Erweiterung)
EXTENSIONS = {"de.brenzinger.mirella.live": "Mirella Live-Anzeige"}
API = "https://api.appstoreconnect.apple.com/v1"
HOME = os.path.expanduser("~")
TMP = os.environ.get("RUNNER_TEMP", "/tmp")
KEY_ID = os.environ["ASC_KEY_ID"]
P8 = f"{HOME}/private_keys/AuthKey_{KEY_ID}.p8"
KC = f"{TMP}/mirella.keychain-db"
KCPW = "mirella-ci"
STATE = f"{TMP}/signatur.json"
PREFIX = "Mirella CI"


def sh(*a, **k):
    return subprocess.run(a, check=True, capture_output=True, **k).stdout


def b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=")


def der_to_raw(der):
    # ECDSA-Signatur von openssl (DER: SEQUENCE{INTEGER r, INTEGER s}) -> r||s je 32 Byte
    i = 2 if der[1] < 0x80 else 2 + (der[1] & 0x7F)
    out = b""
    for _ in range(2):
        assert der[i] == 2
        n = der[i + 1]
        v = der[i + 2:i + 2 + n].lstrip(b"\x00")
        out += v.rjust(32, b"\x00")
        i += 2 + n
    return out


def token():
    head = b64u(json.dumps({"alg": "ES256", "kid": KEY_ID, "typ": "JWT"}).encode())
    now = int(time.time())
    body = b64u(json.dumps({"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 900,
                            "aud": "appstoreconnect-v1"}).encode())
    msg = head + b"." + body
    sig = sh("openssl", "dgst", "-sha256", "-sign", P8, input=msg)
    return (msg + b"." + b64u(der_to_raw(sig))).decode()


def api(method, path, data=None, ok404=False):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(data).encode() if data else None,
                                 headers={"Authorization": "Bearer " + token(),
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if ok404 and e.code == 404:
            return {}
        txt = e.read().decode(errors="replace")
        try:
            errs = "; ".join(f"{x.get('title')}: {x.get('detail')}" for x in json.loads(txt)["errors"])
        except Exception:
            errs = txt[:500]
        print(f"::error::Apple-Antwort {e.code} bei {method} {path.split('?')[0]}: {errs}")
        sys.exit(1)


def bundle_id(ident, name):
    """App-ID suchen; die Erweiterungen legt das Skript bei Bedarf selbst an."""
    ids = api("GET", f"/bundleIds?filter[identifier]={ident}&limit=200")["data"]
    ids = [b for b in ids if b["attributes"]["identifier"] == ident]
    if ids:
        return ids[0]["id"]
    if ident == BUNDLE:
        print(f"::error::Die App-ID {BUNDLE} gibt es im Apple-Entwicklerkonto nicht.")
        sys.exit(1)
    new = api("POST", "/bundleIds", {"data": {"type": "bundleIds", "attributes": {
        "identifier": ident, "name": name, "platform": "IOS"}}})["data"]
    print(f"App-ID {ident} angelegt.")
    return new["id"]


def einrichten():
    # 1. App-IDs suchen (Erweiterungen bei Bedarf anlegen), Push-Berechtigung sicherstellen
    bid = bundle_id(BUNDLE, "Mirella")
    ext_ids = {ident: bundle_id(ident, name) for ident, name in EXTENSIONS.items()}
    caps = api("GET", f"/bundleIds/{bid}/bundleIdCapabilities")["data"]
    if not any(c["attributes"]["capabilityType"] == "PUSH_NOTIFICATIONS" for c in caps):
        api("POST", "/bundleIdCapabilities", {"data": {
            "type": "bundleIdCapabilities", "attributes": {"capabilityType": "PUSH_NOTIFICATIONS"},
            "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bid}}}}})
        print("Push-Berechtigung an der App-ID eingeschaltet.")

    # 2. Alte Profile aus früheren Läufen wegräumen (nur unsere eigenen, am Namen erkannt)
    for p in api("GET", "/profiles?limit=200")["data"]:
        if p["attributes"]["name"].startswith(PREFIX):
            api("DELETE", f"/profiles/{p['id']}", ok404=True)

    # 3. Schlüssel + Zertifikatsanfrage, Vertriebszertifikat von Apple holen
    key, csr, cer = f"{TMP}/dist.key", f"{TMP}/dist.csr", f"{TMP}/dist.cer"
    sh("/usr/bin/openssl", "genrsa", "-out", key, "2048")
    sh("/usr/bin/openssl", "req", "-new", "-key", key, "-out", csr, "-subj", "/CN=Mirella CI/C=DE")
    cert = api("POST", "/certificates", {"data": {"type": "certificates", "attributes": {
        "certificateType": "DISTRIBUTION", "csrContent": open(csr).read()}}})["data"]
    json.dump({"cert": cert["id"]}, open(STATE, "w"))
    open(cer, "wb").write(base64.b64decode(cert["attributes"]["certificateContent"]))

    # 4. Eigener Schlüsselbund nur für diesen Lauf
    sh("security", "create-keychain", "-p", KCPW, KC)
    sh("security", "set-keychain-settings", "-lut", "21600", KC)
    sh("security", "unlock-keychain", "-p", KCPW, KC)
    sh("security", "import", key, "-k", KC, "-T", "/usr/bin/codesign", "-T", "/usr/bin/security")
    sh("security", "import", cer, "-k", KC, "-T", "/usr/bin/codesign")
    sh("security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", KCPW, KC)
    old = [l.strip().strip('"') for l in sh("security", "list-keychains", "-d", "user").decode().splitlines() if l.strip()]
    sh("security", "list-keychains", "-d", "user", "-s", KC, *old)
    print(sh("security", "find-identity", "-v", "-p", "codesigning", KC).decode())

    # 5. App-Store-Profile: eines für die App, eines je Erweiterung
    base = f"{PREFIX} {os.environ.get('GITHUB_RUN_ID', int(time.time()))}-{os.environ.get('GITHUB_RUN_ATTEMPT', 1)}"
    names, made = {}, []
    for i, (ident, b) in enumerate([(BUNDLE, bid)] + list(ext_ids.items())):
        name = base if i == 0 else f"{base} {ident.split('.')[-1]}"
        prof = api("POST", "/profiles", {"data": {"type": "profiles",
            "attributes": {"name": name, "profileType": "IOS_APP_STORE"},
            "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": b}},
                              "certificates": {"data": [{"type": "certificates", "id": cert["id"]}]}}}})["data"]
        made.append(prof["id"])
        json.dump({"cert": cert["id"], "profiles": made}, open(STATE, "w"))
        blob = base64.b64decode(prof["attributes"]["profileContent"])
        for d in (f"{HOME}/Library/MobileDevice/Provisioning Profiles",
                  f"{HOME}/Library/Developer/Xcode/UserData/Provisioning Profiles"):
            os.makedirs(d, exist_ok=True)
            open(f"{d}/{prof['attributes']['uuid']}.mobileprovision", "wb").write(blob)
        names[ident] = name
    name = base

    # 6. Xcode-Projekt (App und Erweiterungen) auf feste Signatur stellen: je Ziel das eigene Profil
    here = os.path.dirname(os.path.abspath(__file__))
    pbx = f"{here}/ios/App/App.xcodeproj/project.pbxproj"
    s = open(pbx).read()
    count = 0

    def fest(m):
        nonlocal count
        block = m.group(0)
        b = re.search(r"PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);", block)
        ident = b.group(1).strip().strip('"') if b else ""
        if ident not in names or "CODE_SIGN_STYLE = Automatic;" not in block:
            return block
        count += 1
        neu = ('CODE_SIGN_STYLE = Manual;\n\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";\n'
               '\t\t\t\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";\n'
               f'\t\t\t\tDEVELOPMENT_TEAM = {os.environ["APPLE_TEAM_ID"]};\n'
               f'\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "{names[ident]}";')
        return block.replace("CODE_SIGN_STYLE = Automatic;", neu)

    s = re.sub(r"buildSettings = \{.*?\n\t\t\t\};", fest, s, flags=re.S)
    assert count == 2 * len(names), f"erwartet {2 * len(names)} Stellen im Projekt, gefunden {count}"
    open(pbx, "w").write(s)

    # 7. Export-Einstellungen
    plist = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>{os.environ["APPLE_TEAM_ID"]}</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key><dict>{"".join(f"<key>{k}</key><string>{v}</string>" for k, v in names.items())}</dict>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
"""
    open(f"{TMP}/ExportOptions.plist", "w").write(plist)
    print("Signatur eingerichtet:", name)


def aufraeumen():
    try:
        st = json.load(open(STATE))
    except Exception:
        return
    for pid in st.get("profiles", []) + ([st["profile"]] if st.get("profile") else []):
        api("DELETE", f"/profiles/{pid}", ok404=True)
    if st.get("cert"):
        api("DELETE", f"/certificates/{st['cert']}", ok404=True)
    subprocess.run(["security", "delete-keychain", KC], capture_output=True)
    print("Zertifikat und Profil wieder gelöscht.")


if __name__ == "__main__":
    {"einrichten": einrichten, "aufraeumen": aufraeumen}[sys.argv[1]]()
