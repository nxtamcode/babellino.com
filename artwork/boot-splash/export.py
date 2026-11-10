#!/usr/bin/env python3
"""Render reference PNGs from the font-independent splash SVGs.

Requires rsvg-convert and ImageMagick. --outline-source additionally requires
the Helvetica Neue Bold font used to author the editable source.
"""

import argparse
from pathlib import Path
import re
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
PALETTE = {
    '#293c31': '#373737',
    '#dce777': '#dddddd',
    '#f5f3e9': '#f3f3f3',
}


def run(*args):
    return subprocess.check_output(args)


def outline_source():
    font = run('fc-match', '-f', '%{family}\n%{style}',
               'Helvetica Neue:style=Bold').decode()
    family, styles = font.split('\n', 1)
    if 'Helvetica Neue' not in family.split(',') or 'Bold' not in styles.split(','):
        raise SystemExit('Install Helvetica Neue Bold before re-outlining source.svg.')
    outlined = run('rsvg-convert', '--format=svg', str(HERE / 'source.svg')).decode()

    def hex_colour(match):
        channels = [round(float(value) * 255 / 100) for value in match.groups()]
        colour = '#' + ''.join(f'{channel:02x}' for channel in channels)
        if colour not in PALETTE:
            raise ValueError(f'Unexpected source colour: {colour}')
        return colour

    outlined = re.sub(
        r'rgb\(([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)%\)', hex_colour, outlined)
    if '<text' in outlined:
        raise ValueError('Renderer left live text in the outlined SVG.')
    (HERE / 'splash-colour.svg').write_text(outlined)


def export():
    colour = (HERE / 'splash-colour.svg').read_text()
    greyscale = colour
    for original, neutral in PALETTE.items():
        if original not in colour:
            raise ValueError(f'Missing colour in outlined master: {original}')
        greyscale = greyscale.replace(original, neutral)
    (HERE / 'splash-greyscale.svg').write_text(greyscale)

    # Temporary renderer output stays in this checkout, never in a system cache.
    with tempfile.TemporaryDirectory(prefix='.render-', dir=HERE) as temporary:
        for variant in ('colour', 'greyscale'):
            rendered = Path(temporary) / f'{variant}.png'
            run('rsvg-convert', '--output', str(rendered),
                str(HERE / f'splash-{variant}.svg'))
            # Reference encodings only; actual firmware formats are unconfirmed.
            png_type = '2' if variant == 'colour' else '0'
            run('magick', str(rendered), '-alpha', 'off', '-depth', '8',
                '-strip', '-define', f'png:color-type={png_type}',
                '-define', 'png:bit-depth=8',
                str(HERE / f'splash-{variant}.png'))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--outline-source', action='store_true')
    args = parser.parse_args()
    if args.outline_source:
        outline_source()
    export()
    print('Exported matching 800 × 1280 colour and greyscale reference artwork.')
