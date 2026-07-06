#!/usr/bin/env python3
# Extracts the main HTML resource from a Safari .webarchive (a binary plist)
# so it can be parsed like any other saved page. Safari's "Save As -> Web
# Archive" is a good source for a store's e-handel offer page: it captures
# the fully server-rendered HTML (incl. schema.org Product microdata for
# many sites), unlike a print-to-PDF export which only has the visible text
# layer stripped of that structure.
#
# Usage:
#   python3 scripts/erbjudanden-webarchive-extract.py input.webarchive output.html

import plistlib
import sys

if len(sys.argv) != 3:
    print('Usage: erbjudanden-webarchive-extract.py <input.webarchive> <output.html>', file=sys.stderr)
    sys.exit(1)

with open(sys.argv[1], 'rb') as f:
    archive = plistlib.load(f)

html = archive['WebMainResource']['WebResourceData']
with open(sys.argv[2], 'wb') as f:
    f.write(html)

print(f'Wrote {len(html)} bytes to {sys.argv[2]}', file=sys.stderr)
