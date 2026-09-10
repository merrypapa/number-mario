#!/usr/bin/env python3
"""레벨 그리드 생성기.

문자를 손으로 정렬하면 실수가 잦으므로 드로잉 명령으로 격자를 만들고
src/game/levels/data.ts 를 생성한다.

레벨 설계 규칙(끼임/막힘 방지):
  * 플레이어 히트박스 최대 3칸 폭 × 4칸 높이 (src/game/shapes.ts)
  * 지면(13행) 위 공중 블록은 8행 이상 → 어떤 형태로도 아래를 지나갈 수 있다
  * 구덩이 폭 ≤ 3칸, 단차 ≤ 3칸 (튜토리얼인 1-1 은 어린이도 넘도록 2칸)
  * 통과를 막는 벽 바로 앞에는 반드시 해당 숫자 패드를 둔다
  * 천장이 막힌 공간에 큰 몸으로 떨어질 수 있는 구조를 만들지 않는다
"""
from pathlib import Path

H = 16
GROUND_ROW = 13


class Grid:
    def __init__(self, w, h=H):
        self.w, self.h = w, h
        self.g = [[' '] * w for _ in range(h)]

    def put(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = ch

    def rect(self, x, y, w, h, ch):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.put(i, j, ch)

    def hline(self, x, y, w, ch):
        self.rect(x, y, w, 1, ch)

    def vline(self, x, y, h, ch):
        self.rect(x, y, 1, h, ch)

    def clear(self, x, y, w, h):
        self.rect(x, y, w, h, ' ')

    def row_of(self, x, y, s):
        for i, ch in enumerate(s):
            self.put(x + i, y, ch)

    def coins(self, x, y, n):
        self.row_of(x, y, 'o' * n)

    def stairs(self, x, y, steps, w=2, ch='#'):
        """왼쪽에서 오른쪽으로 한 칸씩 올라가는 계단."""
        for i in range(steps):
            self.rect(x + i * w, y - i, w, GROUND_ROW - (y - i), ch)

    def pipe(self, x, y, h, kind='w'):
        """2칸 폭 초록 파이프. kind='w' 입구, 'e' 출구, None 이면 그냥 장식."""
        self.rect(x, y, 2, h, 'n')
        if kind:
            self.put(x, y, kind)

    def rows(self):
        return [''.join(r).rstrip() for r in self.g]


def ground(g, x=0, w=None, y=GROUND_ROW):
    g.rect(x, y, w if w is not None else g.w - x, H - y, '#')


# ─────────────────────────────────────────────────────────────
# 1-1 카운트 초원 : 기본 조작 / 1→4 성장
# ─────────────────────────────────────────────────────────────
def level_1_1():
    g = Grid(190)
    ground(g)
    g.put(3, 12, 'P')

    g.coins(7, 11, 3)
    g.put(13, 8, '!')          # 첫 플러스 오브
    g.put(16, 8, '?')
    g.put(19, 8, '?')
    g.put(17, 11, 'o')
    g.put(23, 12, 'm')

    g.clear(27, 13, 2, 3)      # 첫 구덩이(2칸) — 튜토리얼이라 넉넉하게
    g.coins(27, 10, 2)

    g.rect(33, 12, 2, 1, '#')
    g.rect(35, 11, 2, 2, '#')
    g.coins(35, 10, 2)

    g.row_of(40, 8, 'BB?BB')   # 벽돌 캐노피
    g.put(42, 10, 'o')
    g.put(46, 12, 'm')
    g.put(50, 12, 'm')

    g.rect(54, 12, 3, 1, '#')  # 세 단 언덕
    g.rect(57, 11, 3, 2, '#')
    g.rect(60, 10, 3, 3, '#')
    g.coins(57, 10, 2)
    g.put(61, 9, 'o')

    g.clear(66, 13, 2, 3)
    g.row_of(66, 11, '==')
    g.coins(66, 10, 2)

    g.row_of(72, 10, '====')   # 한방향 발판
    g.coins(73, 9, 2)
    g.put(77, 7, 'b')

    g.put(82, 12, 'C')         # 체크포인트

    g.row_of(86, 8, 'BB!BBB')
    g.put(88, 10, 'o')
    g.clear(94, 13, 2, 3)
    g.row_of(94, 11, '==')
    g.coins(94, 10, 2)

    g.put(101, 12, 'm')
    g.put(105, 12, 'm')
    g.rect(109, 12, 4, 1, '#')
    g.coins(109, 11, 2)
    g.put(114, 7, 'b')

    g.rect(118, 12, 2, 1, '#')
    g.rect(120, 11, 2, 2, '#')
    g.rect(122, 10, 2, 3, '#')
    g.put(122, 9, 'o')
    g.clear(126, 13, 2, 3)

    g.row_of(132, 8, '?B!B?')
    g.put(134, 10, 'H')
    g.put(139, 12, 'm')
    g.put(143, 12, 'm')

    g.clear(147, 13, 2, 3)
    g.row_of(147, 10, '==')
    g.coins(147, 9, 2)
    g.put(153, 7, 'b')

    g.rect(157, 12, 3, 1, '#')
    g.rect(160, 11, 3, 2, '#')
    g.coins(160, 10, 2)
    g.put(166, 12, 'm')

    g.pipe(112, 11, 2)           # 하수구 → 보너스 방
    g.rect(172, 11, 12, 2, '#')  # 골 언덕(단차 2칸)
    g.coins(173, 10, 2)
    g.put(177, 10, 'F')
    return dict(id='1-1', name='카운트 초원', theme='field', time=300,
                rows=g.rows(), bonus=bonus_room('coins'))


# ─────────────────────────────────────────────────────────────
# 1-2 벽돌 언덕 : 6의 롤링 어택 / 나눗셈박쥐
# ─────────────────────────────────────────────────────────────
def level_1_2():
    g = Grid(200)
    ground(g)
    g.put(3, 12, 'P')
    g.coins(6, 11, 2)
    g.put(9, 8, '!')
    g.put(12, 8, '!')
    g.put(15, 12, 'm')

    # 롤링 튜토리얼: 6 패드 → 낮은 벽돌 벽(못 부숴도 넘어갈 수 있음)
    g.put(18, 12, '6')
    g.vline(22, 10, 3, 'B')
    g.vline(23, 10, 3, 'B')
    g.coins(24, 11, 2)
    g.put(27, 12, 'm')

    g.row_of(31, 8, '=====')   # 위쪽 보너스 루트
    g.coins(31, 7, 5)
    g.put(36, 7, '!')

    g.clear(40, 13, 3, 3)
    g.put(45, 12, 'm')
    g.row_of(48, 8, 'BB!BB')
    g.put(50, 10, 'o')
    g.put(54, 6, 'b')

    # 필수 롤링 구간: 5칸 높이 벽돌 벽 (뛰어넘을 수 없다)
    g.put(58, 12, '6')
    g.coins(60, 11, 2)
    g.vline(64, 8, 5, 'B')
    g.vline(65, 8, 5, 'B')
    g.rect(63, 7, 5, 1, '#')

    g.put(70, 12, 'm')
    g.put(74, 12, 'm')
    g.coins(72, 11, 2)
    g.put(78, 12, 'C')

    g.rect(82, 12, 3, 1, '#')
    g.rect(85, 11, 3, 2, '#')
    g.rect(88, 10, 3, 3, '#')
    g.coins(85, 10, 2)
    g.put(89, 9, 'o')
    g.put(94, 6, 'b')
    g.put(99, 7, 'b')

    g.clear(96, 13, 3, 3)
    g.row_of(96, 11, '===')
    g.coins(96, 10, 3)

    g.row_of(104, 8, 'BBB!BBB?BBB')
    g.put(106, 10, 'o')
    g.put(110, 12, 'm')
    g.put(114, 12, 'z')

    # 벽돌 기둥 3개: 굴러서 관통(또는 넘어가기)
    g.put(120, 12, '6')
    for x in (125, 129, 133):
        g.vline(x, 10, 3, 'B')
        g.vline(x + 1, 10, 3, 'B')
    g.put(126, 9, 'o')
    g.put(130, 9, 'o')
    g.put(137, 12, 'H')

    g.clear(141, 13, 3, 3)
    g.row_of(141, 10, '===')
    g.coins(141, 9, 3)
    g.put(147, 12, 'm')
    g.put(151, 6, 'b')

    g.rect(155, 12, 4, 1, '#')
    g.coins(155, 11, 3)
    g.put(161, 8, '!')
    g.put(165, 12, 'z')

    g.clear(170, 13, 3, 3)
    g.row_of(170, 11, '===')
    g.put(175, 12, 'm')
    g.row_of(178, 8, 'BB?BB')

    g.pipe(155, 11, 2)
    g.rect(186, 12, 3, 1, '#')
    g.rect(189, 11, 11, 2, '#')
    g.coins(190, 10, 2)
    g.put(194, 10, 'F')
    return dict(id='1-2', name='벽돌 언덕', theme='hill', time=320,
                rows=g.rows(), bonus=bonus_room('orb'))


# ─────────────────────────────────────────────────────────────
# 1-3 무지개 협곡 : 7의 레인보우 브리지 / 이동 발판
# ─────────────────────────────────────────────────────────────
def level_1_3():
    g = Grid(150)
    ground(g, 0, 26)
    g.put(3, 12, 'P')
    g.coins(6, 11, 3)
    g.put(10, 8, '!')
    g.put(13, 8, '!')
    g.put(17, 12, 'm')
    g.put(21, 11, 'o')

    # 징검다리
    g.row_of(28, 11, '===')
    g.coins(28, 10, 3)
    g.row_of(33, 10, '===')
    g.coins(33, 9, 3)

    ground(g, 38, 10)
    g.put(41, 12, 'm')
    g.put(44, 11, 'H')
    g.put(45, 7, 'b')

    # 좌우로 움직이는 발판
    g.put(53, 11, 'D')

    ground(g, 60, 13)
    g.put(63, 12, 'C')
    g.coins(64, 11, 2)
    g.put(67, 12, '7')          # 7 패드
    g.put(70, 11, 'o')

    # 무지개 협곡 1 (12칸)
    g.coins(76, 8, 4)
    g.put(80, 6, 'b')

    ground(g, 85, 16)
    g.put(88, 12, 'm')
    g.coins(90, 11, 3)
    g.put(94, 8, '!')
    g.put(97, 12, '7')

    # 무지개 협곡 2 (12칸)
    g.coins(103, 9, 4)
    g.put(107, 7, 'b')

    ground(g, 113, 37)
    g.put(116, 12, 'm')
    g.coins(118, 11, 2)
    g.rect(122, 12, 3, 1, '#')
    g.rect(125, 11, 3, 2, '#')
    g.coins(125, 10, 2)
    g.put(129, 7, 'b')
    g.row_of(132, 8, 'BB?BB')
    g.put(138, 12, 'm')
    g.pipe(122, 11, 2)
    g.rect(142, 11, 8, 2, '#')
    g.put(145, 10, 'F')
    return dict(id='1-3', name='무지개 협곡', theme='canyon', time=340,
                rows=g.rows(), bonus=bonus_room('heart'))


# ─────────────────────────────────────────────────────────────
# 1-4 제로 동굴 : 용암·가시 / 8 갈고리 / 9 슬램 / 1 좁은 길
# ─────────────────────────────────────────────────────────────
def level_1_4():
    g = Grid(200)
    ground(g)
    g.rect(0, 0, 200, 2, 'S')   # 동굴 천장
    g.put(3, 12, 'P')
    g.coins(6, 11, 2)
    g.put(9, 8, '!')
    g.put(12, 8, '!')
    g.put(16, 12, 'z')

    # 가시 지대
    g.row_of(21, 12, '^^')
    g.coins(20, 10, 3)
    g.put(26, 12, 'm')
    g.row_of(29, 12, '^^^')
    g.row_of(28, 10, '=====')
    g.coins(29, 9, 3)

    # 첫 용암(가운데 돌섬)
    g.rect(36, 13, 6, 3, 'L')
    g.rect(38, 12, 2, 1, 'S')
    g.put(38, 11, 'o')
    g.put(45, 12, 'z')
    g.put(49, 12, 'C')

    # 8 갈고리 보너스 (위쪽 코인)
    g.put(53, 12, '8')
    g.rect(57, 13, 6, 3, 'L')
    g.rect(59, 12, 2, 1, 'S')
    g.rect(58, 7, 2, 1, 'S')
    g.rect(63, 6, 2, 1, 'S')
    g.put(58, 6, 'o')
    g.put(63, 5, 'o')
    g.put(59, 6, 'o')
    g.put(67, 12, 'm')
    g.coins(69, 11, 2)

    # 9 슬램: 벽돌 바닥을 뚫고 지하 코인방으로
    g.put(74, 12, '9')
    g.clear(79, 13, 9, 2)
    g.rect(79, 12, 9, 1, 'B')
    g.coins(80, 14, 3)
    g.put(84, 14, 'H')
    g.put(86, 14, 'o')

    g.put(91, 12, 'z')
    g.row_of(94, 12, '^^')
    g.row_of(98, 8, 'BB!BB?BB')
    g.put(100, 10, 'o')
    g.put(103, 12, 'm')

    # 두 번째 용암 + 이동 발판
    g.rect(110, 13, 8, 3, 'L')
    g.put(112, 11, 'D')
    g.put(121, 12, 'C')
    g.coins(123, 11, 2)
    g.put(126, 12, 'z')

    # 좁은 통로 (2칸 높이 → 1·2·4만 통과)
    g.put(131, 12, '2')
    g.rect(135, 9, 9, 2, 'S')
    g.coins(136, 12, 4)
    g.put(141, 12, 'o')

    # 두 번째 갈고리 구간
    g.put(148, 12, '8')
    g.rect(152, 13, 7, 3, 'L')
    g.rect(154, 12, 2, 1, 'S')
    g.rect(153, 7, 2, 1, 'S')
    g.rect(157, 6, 2, 1, 'S')
    g.put(153, 6, 'o')
    g.put(157, 5, 'o')
    g.put(162, 12, 'z')
    g.put(166, 12, 'm')

    # 두 번째 슬램 방
    g.put(170, 12, '9')
    g.clear(175, 13, 8, 2)
    g.rect(175, 12, 8, 1, 'B')
    g.coins(176, 14, 4)
    g.put(180, 14, '!')

    g.row_of(186, 12, '^^^')
    g.row_of(185, 10, '=====')
    g.put(187, 9, 'o')
    g.put(191, 12, 'm')

    g.pipe(166, 11, 2)
    g.rect(194, 11, 6, 2, '#')
    g.put(197, 10, 'F')
    return dict(id='1-4', name='제로 동굴', theme='cave', time=360,
                rows=g.rows(), bonus=bonus_room('coins'))


# ─────────────────────────────────────────────────────────────
# 1-5 제로의 탑 : 보스전
# ─────────────────────────────────────────────────────────────
def level_1_5():
    g = Grid(52)
    ground(g)
    g.rect(0, 0, 52, 2, 'S')
    g.vline(0, 2, 11, 'S')
    g.vline(1, 2, 11, 'S')
    g.vline(50, 2, 11, 'S')
    g.vline(51, 2, 11, 'S')

    g.put(4, 12, 'P')
    g.put(6, 12, '+')
    g.put(45, 12, '+')
    g.put(8, 12, 'H')
    g.row_of(10, 10, '====')
    g.row_of(38, 10, '====')
    g.row_of(22, 8, '======')
    g.put(24, 7, 'o')
    g.put(27, 7, 'o')
    g.put(25, 11, 'Z')
    return dict(id='1-5', name='제로의 탑', theme='tower', time=400, rows=g.rows(), bonus=None)


def bonus_room(kind):
    """파이프로 들어가는 작은 보너스 방. 왼쪽에 출구 파이프가 있다."""
    # 화면(27칸)을 꽉 채우는 크기라야 벽 너머가 보이지 않는다
    g = Grid(27)
    g.rect(0, 0, 27, 3, 'S')       # 천장
    ground(g)
    g.vline(0, 3, 10, 'S')
    g.vline(1, 3, 10, 'S')
    g.vline(25, 3, 10, 'S')
    g.vline(26, 3, 10, 'S')
    g.pipe(3, 11, 2, 'e')          # 나가는 파이프
    if kind == 'coins':
        g.coins(8, 11, 5)
        g.coins(9, 9, 4)
        g.put(16, 11, 'o')
        g.put(19, 11, 'o')
        g.put(22, 11, 'o')
    elif kind == 'orb':
        g.coins(8, 11, 4)
        g.put(14, 11, '+')
        g.put(18, 11, 'o')
        g.put(21, 11, 'o')
    else:  # heart
        g.coins(8, 11, 4)
        g.put(14, 11, 'H')
        g.put(18, 11, 'o')
        g.put(21, 11, 'o')
    return g.rows()


LEVELS = [level_1_1(), level_1_2(), level_1_3(), level_1_4(), level_1_5()]

SOLID = set('#BS?!nwe')


def validate(lv):
    """생성 직후 기본 규칙을 검사한다."""
    rows = lv['rows']
    w = max(len(r) for r in rows)
    grid = [r.ljust(w) for r in rows]
    problems = []
    flat = ''.join(grid)
    if flat.count('P') != 1:
        problems.append(f"시작점 개수 {flat.count('P')}")
    if flat.count('F') + flat.count('Z') == 0:
        problems.append('골/보스 없음')
    # 아이템이 solid 안에 박혀 있는지
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch in 'o+HCFmbzZDV' and grid[y][x] in SOLID:
                problems.append(f'{ch} @ {x},{y} 가 벽 속')
    # 공중 아이템/적이 놓인 칸이 solid 인지 (동일 칸 중복은 위에서 검사됨)
    return problems


def emit():
    lines = [
        '// 이 파일은 tools/gen_levels.py 로 생성됩니다. 직접 수정하지 마세요.',
        '// 레벨을 바꾸려면 tools/gen_levels.py 수정 후 `python3 tools/gen_levels.py` 실행.',
        '',
        'export interface LevelDef {',
        '  id: string;',
        '  name: string;',
        '  theme: string;',
        '  time: number;',
        '  rows: string[];',
        '  /** 파이프로 들어가는 보너스 방 (없을 수도 있다) */',
        '  bonus?: string[];',
        '}',
        '',
        'export const LEVELS: LevelDef[] = [',
    ]
    for lv in LEVELS:
        lines.append('  {')
        lines.append(f"    id: '{lv['id']}',")
        lines.append(f"    name: '{lv['name']}',")
        lines.append(f"    theme: '{lv['theme']}',")
        lines.append(f"    time: {lv['time']},")
        lines.append('    rows: [')
        for r in lv['rows']:
            esc = r.replace('\\', '\\\\').replace("'", "\\'")
            lines.append(f"      '{esc}',")
        lines.append('    ],')
        if lv.get('bonus'):
            lines.append('    bonus: [')
            for r in lv['bonus']:
                esc = r.replace('\\', '\\\\').replace("'", "\\'")
                lines.append(f"      '{esc}',")
            lines.append('    ],')
        lines.append('  },')
    lines.append('];')
    lines.append('')
    out = Path('src/game/levels/data.ts')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('\n'.join(lines), encoding='utf-8')
    print(f'wrote {out}')
    ok = True
    for lv in LEVELS:
        w = max(len(r) for r in lv['rows'])
        probs = validate(lv)
        status = 'OK' if not probs else 'FAIL ' + '; '.join(probs)
        ok = ok and not probs
        print(f"  {lv['id']} {lv['name']:12s} {w:3d}x{len(lv['rows'])}  {status}")
    if not ok:
        raise SystemExit(1)


if __name__ == '__main__':
    emit()
