#!/usr/bin/env python3
"""Gộp index.html + js/*.js thành một file HTML duy nhất.
dist/squared-off.html : bản đầy đủ, mở trực tiếp được
dist/artifact.html    : bản không có thẻ html/head/body (để đăng lên claude.ai)"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

    def inline(m):
        code = open(os.path.join(ROOT, m.group(1)), encoding='utf-8').read().replace('</script', '<\\/script')
        return '<script>/* %s */\n%s\n</script>' % (m.group(1), code)

    out = re.sub(r'<script src="([^"]+)"></script>', inline, html)
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    open(os.path.join(ROOT, 'dist', 'squared-off.html'), 'w', encoding='utf-8').write(out)
    art = out
    for pat in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'</html>\s*', r'<head>\s*', r'</head>\s*', r'<body>\s*', r'</body>\s*', r'<meta charset="utf-8">\s*', r'<meta name="viewport"[^>]*>\s*']:
        art = re.sub(pat, '', art, flags=re.I)
    art = art.replace('<title>Squared Off</title>', '<title>Squared Off</title>\n<meta name="claude:viewport-fit-sides" content="cover">', 1)
    art = art.replace('html, body { margin: 0; height: 100%; background: var(--bg); overflow: hidden; }',
                      'html, body { margin: 0; height: 100%; background: var(--bg); overflow: hidden; color-scheme: dark; }\n  body { box-sizing: border-box; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 8px; color: #ddd; }')
    open(os.path.join(ROOT, 'dist', 'artifact.html'), 'w', encoding='utf-8').write(art)
    print('ok', len(out) // 1024, 'KB')


if __name__ == '__main__':
    main()
