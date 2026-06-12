# Charla app icons — original parrot mascot on green rounded square
from PIL import Image, ImageDraw

GREEN = (88, 204, 2, 255)
GREEN_L = (215, 255, 184, 255)
WHITE = (255, 255, 255, 255)
DARK = (60, 60, 60, 255)
ORANGE = (255, 150, 0, 255)
RED = (255, 75, 75, 255)
BLUE = (28, 176, 246, 255)

def draw_parrot(d, cx, cy, s):
    """Parrot sized ~s, centered cx,cy. All shapes scaled from a 120-unit design."""
    def X(x): return cx + (x - 60) * s / 120.0
    def Y(y): return cy + (y - 60) * s / 120.0
    def R(r): return r * s / 120.0
    # wings
    d.polygon([(X(30), Y(70)), (X(14), Y(82)), (X(26), Y(96)), (X(40), Y(84))], fill=BLUE)
    d.polygon([(X(90), Y(70)), (X(106), Y(82)), (X(94), Y(96)), (X(80), Y(84))], fill=BLUE)
    # body
    d.ellipse([X(26), Y(36), X(94), Y(112)], fill=WHITE)
    d.ellipse([X(38), Y(58), X(82), Y(110)], fill=GREEN_L)
    # head
    d.ellipse([X(34), Y(12), X(86), Y(64)], fill=WHITE)
    # crest
    d.polygon([(X(48), Y(14)), (X(60), Y(2)), (X(66), Y(14)), (X(74), Y(8)), (X(76), Y(18)), (X(58), Y(22))], fill=RED)
    # eyes
    d.ellipse([X(40), Y(26), X(60), Y(46)], fill=WHITE, outline=DARK, width=max(1, int(R(2))))
    d.ellipse([X(60), Y(26), X(80), Y(46)], fill=WHITE, outline=DARK, width=max(1, int(R(2))))
    d.ellipse([X(48), Y(33), X(57), Y(42)], fill=DARK)
    d.ellipse([X(63), Y(33), X(72), Y(42)], fill=DARK)
    # beak
    d.polygon([(X(52), Y(48)), (X(68), Y(48)), (X(60), Y(62))], fill=ORANGE)
    # feet
    d.polygon([(X(50), Y(108)), (X(54), Y(116)), (X(58), Y(108))], fill=ORANGE)
    d.polygon([(X(62), Y(108)), (X(66), Y(116)), (X(70), Y(108))], fill=ORANGE)

def make(size, path, pad_ratio=0.0, radius_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=GREEN)
    parrot_size = size * (0.72 - pad_ratio)
    draw_parrot(d, size / 2, size / 2 + size * 0.02, parrot_size)
    img.convert("RGB" if path.endswith("-flat.png") else "RGBA").save(path)
    print("wrote", path)

import os
os.makedirs("icons", exist_ok=True)
make(512, "icons/icon-512.png")
make(512, "icons/icon-512-maskable.png", pad_ratio=0.18, radius_ratio=0.0)  # full-bleed for maskable
make(192, "icons/icon-192.png")
make(180, "icons/icon-180.png", radius_ratio=0.0)  # iOS rounds corners itself
make(32, "icons/icon-32.png")
print("done")
