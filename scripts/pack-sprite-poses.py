"""Pack generated pose layers. Requires Pillow; no image generation happens here.

Feature islands are registered independently, at the original pose's landmarks.
This deterministic step removes atlas layout drift without repainting features.
Raw image edits and prompts remain in assets/sprite-sources/ and docs/.
"""
from pathlib import Path
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/sprite-sources'
OUT = ROOT / 'public/sprites'
ALPHA_FLOOR = 8

# Original-canvas positions, not shared face geometry. Each eye's width is fixed;
# the generated closed eyelid keeps its natural aspect ratio and common center.
SPECS = {
    'wave': dict(rect=[320, 240, 340, 270], grid=[3, 2], frames=['smile','happy','talk','blink','wink'],
        eyes=[[409,379,94],[568,337,91]], brows=[[398,330,72],[550,287,66]], mouth=[516,438,42],
        regions=[[25,125,200,232],[297,64,483,127],[22,220,220,332],[302,131,502,260],[255,342,367,414]]),
    'paws': dict(rect=[320, 255, 350, 280], grid=[3, 2], frames=['content','coax','shy','happy','talk','blink'],
        eyes=[[412,397,96],[571,349,98]], brows=[[405,347,72],[550,307,67]], mouth=[520,455,44],
        regions=[[35,165,211,252],[290,99,475,146],[35,255,230,349],[308,165,504,280],[255,358,366,434]]),
    'cheer': dict(rect=[330, 285, 325, 260], grid=[2, 2], frames=['happy','talk','surprised','blink'],
        eyes=[[413,418,90],[557,372,91]], brows=[[405,366,72],[540,327,69]], mouth=[512,471,48],
        regions=[[38,175,203,266],[295,111,446,168],[34,250,243,352],[293,168,497,282],[241,353,369,438]]),
    'tail': dict(rect=[340, 295, 325, 265], grid=[2, 2], frames=['sulky','coax','talk','blink'],
        eyes=[[425,421,98],[585,376,95]], brows=[[412,374,76],[571,330,69]], mouth=[528,482,35],
        regions=[[33,164,212,248],[292,125,453,166],[35,247,232,343],[294,174,478,270],[259,363,343,421]]),
}

def clean(image):
    image = image.convert('RGBA')
    alpha = image.getchannel('A').point(lambda a: 0 if a < ALPHA_FLOOR else a)
    image.putalpha(alpha)
    # Zero RGB in discarded pixels too, so the encoder doesn't spend bytes on it.
    result = Image.new('RGBA', image.size)
    result.paste(image, (0, 0))
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            if pixels[x, y][3] == 0:
                pixels[x, y] = (0, 0, 0, 0)
    return result

def save(image, path):
    # Never expose a truncated WebP to Vite/the browser during re-encoding.
    temporary = path.with_suffix('.webp.tmp')
    clean(image).save(temporary, 'WEBP', quality=90, method=6, exact=True)
    temporary.replace(path)

def pack(pose, spec):
    source, dest = SOURCE / pose, OUT / pose
    dest.mkdir(parents=True, exist_ok=True)
    save(Image.open(source / 'original.png'), dest / 'hair_front.webp')
    save(Image.open(source / 'base.png'), dest / 'base.webp')
    atlas = Image.open(source / 'atlas.png').convert('RGBA')
    cols, rows = spec['grid']
    x, y, w, h = spec['rect']
    packed = Image.new('RGBA', (cols * w, rows * h))
    cell_w, cell_h = atlas.width / cols, atlas.height / rows
    for i, frame in enumerate(spec['frames']):
        tile = atlas.crop((round(i % cols * cell_w), round(i // cols * cell_h),
                           round((i % cols + 1) * cell_w), round((i // cols + 1) * cell_h)))
        targets = spec['brows'] + spec['eyes'] + [spec['mouth']]
        regions = [r[:] for r in spec['regions']]
        if pose == 'cheer':
            regions[0][3] = 255
            if frame == 'surprised':
                regions[:4] = [[38,156,203,238],[290,90,450,142],[34,238,243,350],[293,150,497,280]]
        for part, (region, target) in enumerate(zip(regions, targets)):
            crop = tile.crop(tuple(round(v * (tile.width if j % 2 == 0 else tile.height) / 512) for j, v in enumerate(region)))
            bbox = crop.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
            if not bbox:
                raise ValueError(f'{pose}/{frame} missing feature {part}')
            island = crop.crop(bbox)
            cx, cy, width = target
            # Preserve the larger happy mouth, keep speech subtly smaller.
            if part == 4 and frame == 'talk': width *= .55 if pose == 'wave' else .82
            if part == 4 and frame == 'surprised': width *= .55
            height = round(width * island.height / island.width)
            island = island.resize((round(width), height), Image.Resampling.LANCZOS)
            packed.alpha_composite(island, (round(i % cols * w + cx - x - width / 2),
                                           round(i // cols * h + cy - y - height / 2)))
    save(packed, dest / 'face_atlas.webp')
    sizes = {p.name: p.stat().st_size for p in dest.glob('*.webp')}
    if sum(sizes.values()) > 800_000:
        raise ValueError(f'{pose} exceeds 800 KB: {sizes}')
    print(pose, sizes, 'total', sum(sizes.values()))

if __name__ == '__main__':
    # Keep the old compressed masters outside public; only remove alpha specks
    # from the two legacy full-size layers. Its atlas is already clean.
    idle = OUT / 'idle'
    idle.mkdir(exist_ok=True)
    for name in ['base', 'hair_front']:
        save(Image.open(SOURCE / 'idle' / f'{name}.webp'), idle / f'{name}.webp')
    shutil.copyfile(SOURCE / 'idle/face_atlas.webp', idle / 'face_atlas.webp')
    for pose, spec in SPECS.items(): pack(pose, spec)
    (SOURCE / 'registration.json').write_text(json.dumps(SPECS, ensure_ascii=False, indent=2) + '\n')
