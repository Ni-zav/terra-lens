import React from 'react';
import csv from '../../data/source-snapshots/nasa-giovanni-hwf-jja-tutorial.csv?raw';
import {analyzeGiovanniTutorial} from '../science/giovanni-tutorial.js';

const analysis = analyzeGiovanniTutorial(csv);
const source = 'https://github.com/nasa/gesdisc-tutorials/blob/f81701924c0336811ef3b90e659ffeb83c28de1b/news_%26_dia/data/g4.ints.M2SMNXEDI_2_HWF.19800101-20231231.JJA.csv';
const tutorial = 'https://github.com/nasa/gesdisc-tutorials/blob/f81701924c0336811ef3b90e659ffeb83c28de1b/news_%26_dia/Giovanni_MERRA2_Extreme_Monthly.ipynb';

function exportEvidence() {
  const evidence={
    source, tutorial, dataset:'M2SMNXEDI version 2', doi:'10.5067/O8AX56DO60MI',
    sha256:'34193c502c6417eb1163967a33dc2b19a87ea8be5518142f6196cb77b0a2b8fd',
    variable:'HWF', season:'June–August', period:'1980–2023',
    support:'NASA tutorial describes country means; geographic mask and weighting not documented in CSV',
    units:'NASA tutorial describes counts per month; HWF counts qualifying days',
    limitations:'Original Giovanni job URL, precise area weighting, rounding and quality flags are unavailable; descriptive, selected example, not an eligibility determination.',
    rows:analysis.rows,
    slopesPerDecade:{canada:analysis.canada.slopePerDecade,unitedStates:analysis.unitedStates.slopePerDecade}
  };
  const url=URL.createObjectURL(new Blob([JSON.stringify(evidence,null,2)+'\n'],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download='giovanni-tutorial-evidence.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function GiovanniTutorial() {
  return <section className="giovanni-card giovanni-tutorial" aria-labelledby="giovanni-example-heading">
    <h3 id="giovanni-example-heading">NASA Giovanni tutorial: summer heatwave index</h3>
    <p>NASA published a Giovanni-generated table for Canada and the United States, one value per June–August season from 1980 to 2023. The index counts days meeting a heatwave criterion in MERRA-2 model data; it is not a count of separate heatwave events.</p>
    <p>Fitting a straight line to the published values gives <strong>+{analysis.canada.slopePerDecade.toFixed(2)}</strong> for Canada and <strong>+{analysis.unitedStates.slopePerDecade.toFixed(2)}</strong> for the United States per decade, in the tutorial’s HWF count units. These are descriptive fits, not a test of which country changed faster.</p>
    <p className="giovanni-note">The collection uses a 1991–2020 baseline. NASA labels these country means and the HWF unit as counts per month. The table contains whole numbers; its rounding, precise area weighting, original Giovanni job URL and quality flags are not documented in the published file. We cannot quantify those uncertainties or independently reconstruct the export. Do not use these estimates for decisions or treat this example as an eligibility determination.</p>
    <p className="giovanni-note"><a href={source} target="_blank" rel="noreferrer">NASA-published original CSV</a> · <a href={tutorial} target="_blank" rel="noreferrer">NASA tutorial</a> · <a href="https://doi.org/10.5067/O8AX56DO60MI" target="_blank" rel="noreferrer">M2SMNXEDI version 2 DOI</a> · <a href="./docs/GIOVANNI_TUTORIAL_CASE.md" target="_blank" rel="noreferrer">Methods and limitations</a></p>
    <button type="button" onClick={exportEvidence}>Download tutorial evidence JSON</button>
    <details><summary>Inspect all 44 published values</summary><div className="sc-table-wrap" tabIndex="0"><table className="discovery-table"><thead><tr><th scope="col">Year</th><th scope="col">Canada</th><th scope="col">United States</th></tr></thead><tbody>{analysis.rows.map(row=><tr key={row.year}><th scope="row">{row.year}</th><td>{row.canada}</td><td>{row.unitedStates}</td></tr>)}</tbody></table></div></details>
  </section>;
}
