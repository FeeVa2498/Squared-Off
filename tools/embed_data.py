#!/usr/bin/env python3
"""Nhúng data/moves.csv và data/characters.csv vào js/data.js để game chạy được khi mở
trực tiếp index.html (trình duyệt chặn đọc file CSV bên ngoài qua file://).
Chạy lại script này sau khi chỉnh CSV:  python3 tools/embed_data.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    with open(os.path.join(ROOT, 'data', 'moves.csv'), encoding='utf-8') as f:
        moves = f.read()
    with open(os.path.join(ROOT, 'data', 'characters.csv'), encoding='utf-8') as f:
        chars = f.read()
    js = ('// Tự sinh bởi tools/embed_data.py từ data/*.csv - đừng sửa tay file này.\n'
          'window.SO_DATA = {\n  moves: %s,\n  characters: %s\n};\n') % (json.dumps(moves, ensure_ascii=False), json.dumps(chars, ensure_ascii=False))
    os.makedirs(os.path.join(ROOT, 'js'), exist_ok=True)
    with open(os.path.join(ROOT, 'js', 'data.js'), 'w', encoding='utf-8') as f:
        f.write(js)
    print('js/data.js updated')


if __name__ == '__main__':
    main()
