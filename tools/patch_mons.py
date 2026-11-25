# Usage: edits m(...) lines in js/data.js. Each entry: id -> dict(cd=, dmg=, fx='{...}', pas='{...}')
import re, sys, json
def patch(changes):
    p='js/data.js'; s=open(p).read()
    for mid, ch in changes.items():
        pat = re.compile(r"m\('%s', '([^']*)', '(\w+)', (\d), ([\d.]+), ([\d.]+), (\{[^}]*\}), (\{(?:[^{}]|\{[^}]*\})*\}), " % mid)
        mm = pat.search(s)
        if not mm: print('MISSING', mid); continue
        name, typ, tier, cd, dmg, fx, pas = mm.groups()
        cd = str(ch.get('cd', cd)); dmg = str(ch.get('dmg', dmg)); fx = ch.get('fx', fx); pas = ch.get('pas', pas)
        s = s[:mm.start()] + f"m('{mid}', '{name}', '{typ}', {tier}, {cd}, {dmg}, {fx}, {pas}, " + s[mm.end():]
    open(p,'w').write(s)
if __name__ == '__main__':
    patch(json.load(open(sys.argv[1])))
