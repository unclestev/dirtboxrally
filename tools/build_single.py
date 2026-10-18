#!/usr/bin/env python3
"""Bundle classic/ into one self-contained HTML file (CSS and JS inlined).

Usage:
  python3 tools/build_single.py              -> dist/dirtbox-rally-classic.html
  python3 tools/build_single.py --fragment   -> also writes a version without <html>/<head>/<body>
                                                wrappers, for hosts that supply their own skeleton
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'classic')
DIST = os.path.join(ROOT, 'dist')


def build():
    html = open(os.path.join(SRC, 'index.html'), encoding='utf-8').read()

    def inline_css(m):
        css = open(os.path.join(SRC, m.group(1)), encoding='utf-8').read()
        return '<style>\n' + css + '\n</style>'

    def inline_js(m):
        js = open(os.path.join(SRC, m.group(1)), encoding='utf-8').read()
        return '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>'

    html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', inline_css, html)
    html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_js, html)
    return html


def fragment(html):
    head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
    body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)
    head = re.sub(r'<meta charset="utf-8">\s*', '', head)
    head = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head)
    title = re.search(r'<title>.*?</title>', head).group(0)
    head = head.replace(title, '')
    return title + '\n' + head.strip() + '\n' + body.strip() + '\n'


if __name__ == '__main__':
    os.makedirs(DIST, exist_ok=True)
    html = build()
    out = os.path.join(DIST, 'dirtbox-rally-classic.html')
    open(out, 'w', encoding='utf-8').write(html)
    print('wrote', out, len(html) // 1024, 'KB')
    if '--fragment' in sys.argv:
        out2 = os.path.join(DIST, 'dirtbox-rally-classic.fragment.html')
        open(out2, 'w', encoding='utf-8').write(fragment(html))
        print('wrote', out2)
