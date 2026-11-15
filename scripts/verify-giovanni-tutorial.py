"""Independently check the NASA-published seasonal CSV against JS, not source authenticity."""
import csv
import hashlib
import json
import pathlib
import subprocess
import numpy as np
from scipy.stats import linregress

root = pathlib.Path(__file__).resolve().parents[1]
path = root / 'data/source-snapshots/nasa-giovanni-hwf-jja-tutorial.csv'
raw = path.read_bytes()
assert hashlib.sha256(raw).hexdigest() == '34193c502c6417eb1163967a33dc2b19a87ea8be5518142f6196cb77b0a2b8fd'
rows = list(csv.DictReader(raw.decode('utf-8-sig').splitlines()))
years = np.array([int(r['Year']) for r in rows])
assert np.array_equal(years, np.arange(1980, 2024))
code = """import {readFileSync} from 'node:fs';
import {analyzeGiovanniTutorial} from './src/science/giovanni-tutorial.js';
const a=analyzeGiovanniTutorial(readFileSync(process.argv[1],'utf8'));
console.log(JSON.stringify({canada:a.canada.slopePerDecade,usa:a.unitedStates.slopePerDecade}));"""
js = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', code, str(path)], cwd=root, text=True))
for field, key in [('Canada', 'canada'), ('United_States', 'usa')]:
    result = linregress(years, [float(r[field]) for r in rows])
    assert np.isclose(result.slope * 10, js[key], rtol=0, atol=1e-10)
    print(f'{field}: n={len(rows)}, SciPy/JS slope={result.slope*10:+.9f} tutorial counts/decade; PASS')
print('Original CSV SHA-256 and descriptive slopes match; provenance, aggregation and quality are not validated by this calculation.')
