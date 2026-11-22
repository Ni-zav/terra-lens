# Terra-Lens 2.0 walkthrough

Terra-Lens helps analysts, educators and readers turn a NASA historical climate result into a question they can verify. The first case asks whether the evidence near Yogyakarta warrants requesting local station records.

Run `npm ci && npm run dev` and open the URL printed by Vite. The path works with the bundled NASA archive and requires no coordinate entry.

| Time | Show | Say |
| --- | --- | --- |
| 0–12 s | Pahami / Understand, Yogyakarta | “You are preparing a local climate note and want to know whether warming merits a station-data request.” |
| 12–27 s | Finding and annual chart | “NASA POWER estimates about +0.18 °C per decade at the selected model grid point over 2001–2024. This archive has 24 complete years.” |
| 27–40 s | Scope and next step | “The model describes one point. To assess temperatures across the city, heat exposure, or an intervention, look for independent local evidence. Start with BMKG station observations and check station history and gaps.” |
| 40–56 s | Open research brief | “This one-page brief records the research question, the evidence, what it cannot establish, and the source for the next check.” Download the HTML or open print preview. |
| 56–75 s | Verify | “Here are both original NASA queries and the complete coverage. The paired interval still leaves it open which grid point warmed faster.” Download the Evidence JSON. |

For an Indonesian demonstration, leave the app in ID and use **Pahami → Buka ringkasan riset → Unduh ringkasan HTML → Verifikasi → Unduh bukti JSON**. For English, select EN before starting. Leave a fresh NASA fetch for the Explore follow-up if connectivity is uncertain.

## What changed after the competition

2.0 foregrounds a bilingual result and research brief. It separates expert tools from the first view, keeps a dated example available during source outages, makes the source limitations of the cross-source cases visible before their plots, and checks actual downloads in Chromium. The archival 2026 seven-slide presentation represents the competition-era work.

## Independent comprehension pilot

Recruit five or more people who do not routinely interpret climate statistics, ideally including Indonesian-first readers. Ask them to use the starting view with no coaching. Time to first correct description, time to find the source, and successful opening of a downloaded file are useful observations. Ask them to think aloud and keep their phrasing verbatim with consent.

1. Describe the Yogyakarta result in your own words.
2. Can the evidence identify the hottest neighborhood? Explain why.
3. Does the comparison establish that Jakarta warmed faster?
4. What evidence would you seek before making a local decision?
5. Find the NASA query and open the downloaded file.

Record task, locale, completion, elapsed time, exact wording and any misconception. Review recurring misunderstandings and retest revised wording with new participants. This is an exploratory pilot. No participants or agency partners were recruited in the implementation audit.
