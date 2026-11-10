#!/usr/bin/env python3
"""Dependency-free checks for the splash source and reference exports."""

from pathlib import Path
import re
import struct
import unittest
import xml.etree.ElementTree as ET
import zlib

HERE = Path(__file__).resolve().parent
SVG = '{http://www.w3.org/2000/svg}'


class SplashTests(unittest.TestCase):
    def test_portrait_svg_dimensions(self):
        for name in ('source', 'splash-colour', 'splash-greyscale'):
            with self.subTest(name=name):
                root = ET.parse(HERE / f'{name}.svg').getroot()
                self.assertEqual(root.tag, SVG + 'svg')
                self.assertEqual(root.get('width'), '800')
                self.assertEqual(root.get('height'), '1280')
                self.assertEqual(root.get('viewBox'), '0 0 800 1280')

    def test_exports_are_standalone_vectors_without_fonts_or_animation(self):
        for variant in ('colour', 'greyscale'):
            with self.subTest(variant=variant):
                root = ET.parse(HERE / f'splash-{variant}.svg').getroot()
                self.assertGreater(len(root.findall(SVG + 'path')), 0)
                for element in root.iter():
                    self.assertIn(element.tag, {SVG + tag for tag in ('svg', 'rect', 'path')})
                    for attribute in element.attrib:
                        self.assertNotIn('href', attribute)
                        self.assertNotIn('font', attribute)

    def test_stage_geometry_is_identical(self):
        colour = (HERE / 'splash-colour.svg').read_text()
        grey = (HERE / 'splash-greyscale.svg').read_text()
        for original, neutral in (
            ('#293c31', '#373737'), ('#dce777', '#dddddd'), ('#f5f3e9', '#f3f3f3')
        ):
            self.assertIn(original, colour)
            self.assertIn(neutral, grey)
            colour = colour.replace(original, neutral)
        self.assertEqual(colour, grey)

    def test_greyscale_svg_uses_only_neutral_colours(self):
        grey = (HERE / 'splash-greyscale.svg').read_text()
        for r, g, b in re.findall(r'#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})', grey):
            self.assertEqual(r, g)
            self.assertEqual(g, b)

    def test_png_dimensions_encoding_and_integrity(self):
        for variant, expected_type in (('colour', 2), ('greyscale', 0)):
            with self.subTest(variant=variant):
                data = (HERE / f'splash-{variant}.png').read_bytes()
                self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
                width, height, depth, kind, compression, filtering, interlace = struct.unpack(
                    '>IIBBBBB', data[16:29])
                self.assertEqual((width, height, depth, kind), (800, 1280, 8, expected_type))
                self.assertEqual((compression, filtering, interlace), (0, 0, 0))
                offset = 8
                chunks = []
                while offset < len(data):
                    size = struct.unpack('>I', data[offset:offset + 4])[0]
                    chunk = data[offset + 4:offset + 8 + size]
                    crc = struct.unpack('>I', data[offset + 8 + size:offset + 12 + size])[0]
                    self.assertEqual(zlib.crc32(chunk), crc)
                    chunks.append(chunk[:4])
                    offset += size + 12
                self.assertEqual(offset, len(data))
                self.assertEqual(chunks[0], b'IHDR')
                self.assertEqual(chunks[-1], b'IEND')
                self.assertIn(b'IDAT', chunks)
                self.assertNotIn(b'tRNS', chunks)  # No transparency at either stage.


if __name__ == '__main__':
    unittest.main(verbosity=2)
