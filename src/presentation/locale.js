export const messages = {
  id: {
    understand: 'Pahami', explore: 'Jelajahi', verify: 'Verifikasi', skip: 'Lewati ke isi utama',
    language: 'Bahasa', navigation: 'Tampilan utama', caseLabel: 'Kajian awal · Yogyakarta',
    caseQuestion: 'Apakah titik model dekat Yogyakarta menghangat?',
    researchQuestion: 'Perlukah meminta data stasiun untuk menyelidiki pemanasan di Yogyakarta?',
    archive: 'Arsip NASA bertanggal', fresh: 'Diambil dari NASA POWER', imported: 'Impor pengguna · asal belum terverifikasi',
    snapshotNote: 'Arsip historis. NASA dapat merevisi catatan ini.',
    grid: 'Titik grid model', area: 'Rata-rata wilayah', unknown: 'Cakupan spasial belum diketahui',
    perDecade: 'per dekade', fittedTrend: 'Tren perkiraan', annual: 'Rata-rata tahunan', fit: 'Garis tren',
    chartSummary: 'Grafik rata-rata tahunan dari titik model NASA POWER dan garis tren. Nilai persis tersedia di Verifikasi.',
    caseScope: 'Estimasi ini mewakili satu titik grid model. Pengamatan setempat diperlukan untuk menilai suhu seluruh kota, pulau panas perkotaan, atau risiko panas.',
    moreLimits: 'Data ini juga belum menjelaskan kondisi per kelurahan, penyakit terkait panas, penyebab, prakiraan, atau dampak intervensi.',
    scope: 'Batas bukti', next: 'Langkah berikutnya', strength: 'Seberapa kuat buktinya?',
    verifyNext: 'Minta pengamatan suhu stasiun BMKG untuk periode yang sama. Periksa riwayat stasiun dan data yang hilang.',
    localVerification: 'Cari pengamatan independen yang mengukur besaran yang sama, pada wilayah dan periode yang relevan. Periksa mutu data sebelum mengambil kesimpulan setempat.',
    verifyMore: 'Untuk kajian lanjutan, periksa tata guna lahan, data suhu permukaan yang lolos kendali mutu, paparan penduduk, dan kerentanan. Validasi lokal belum dilakukan.',
    sources: 'Sumber dan metode', methods: 'Metode dan asumsi', brief: 'Buka ringkasan riset',
    archiveView: 'Buka kajian Yogyakarta', currentView: 'Lihat hasil penelusuran', exploreChart: 'Jelajahi data NASA',
    report: 'Ringkasan bukti iklim Yogyakarta', print: 'Cetak / simpan PDF', html: 'Unduh ringkasan HTML',
    generated: 'Tanggal laporan', archivedAt: 'Tanggal arsip (UTC)', retrievedAt: 'Waktu pengambilan (UTC)',
    screening: 'Hanya untuk kajian awal riset. Bukan keputusan kebijakan resmi atau peringatan bahaya.',
    recorded: 'bulan valid', complete: 'tahun lengkap', missing: 'bulan hilang', rawMonths: 'Data bulanan',
    annualValues: 'Rata-rata tahunan', date: 'Waktu', value: 'Nilai', original: 'Kueri asli NASA',
    reproduction: 'Verifikasi independen arsip', compare: 'Perbandingan titik', csv: 'Unduh CSV', json: 'Unduh bukti JSON',
    variability: 'Uji memakai deret yang sama. Jika tahun-tahun yang berdekatan saling berkaitan, bukti statistik bisa tampak lebih kuat.',
    methodShort: 'Rata-rata tahunan dibobot menurut jumlah hari per bulan. Hanya tahun dengan 12 bulan valid yang digunakan.',
    sharing: 'Salin tautan penelusuran', shareNote: 'Tautan membuka pilihan yang sama dan meminta data NASA lagi. Berkas impor dan hasil tersimpan tidak ikut dibagikan.',
    copied: 'Tautan disalin.', retry: 'Coba lagi', goExplore: 'Periksa pengaturan',
    partial: 'Sebagian titik gagal dimuat. Coba lagi untuk mendapatkan perbandingan lengkap.',
    inputError: 'Periksa koordinat, variabel, dan rentang minimal 10 tahun kalender.',
    classicInterval: 'Rentang 95% dari model garis lurus', sameData: 'Uji garis lurus dan uji berbasis urutan memakai data yang sama.',
    why: 'Dari bukti awal ke pengamatan lokal', sourceDate: 'Tanggal sumber', currentQuestion: 'Apa yang ditunjukkan riwayat data ini?',
    noFuture: 'Hasil historis tidak menetapkan penyebab atau kondisi di masa depan.',
    noPair: 'Rentang perkiraan selisih mencakup nol. Urutan laju kedua titik belum dapat ditetapkan.',
    sampling: 'Frekuensi bulanan', missingYears: 'Tahun tidak lengkap',
    requested: 'Koordinat permintaan', returned: 'Koordinat dari respons NASA', localFile: 'Berkas setempat',
    moreSourceData: 'Metadata sumber', authentication: 'Status sumber', utc: 'Waktu UTC', noNumbers: 'Belum ada data yang dapat diekspor untuk permintaan ini.',
    statuses: {
      'supported-trend': 'Dua uji mendukung arah tren yang sama, dengan asumsi masing-masing.',
      'mixed-evidence': 'Kedua uji belum sepakat tentang tren.',
      'not-detected': 'Kedua uji belum mendeteksi tren pada ambang yang dipakai. Perubahan masih mungkin terjadi.',
      'difference-not-established': 'Perbedaan laju antara kedua titik belum terbukti.',
      'difference-supported': 'Rentang perkiraan selisih berada di satu sisi nol, dengan asumsi metode berpasangan.',
      'exploratory-selected': 'Pasangan dipilih setelah meninjau banyak titik. Selisih ini hanya hasil penjajakan.',
      insufficient: 'Perlu minimal 10 tahun kalender lengkap. Untuk uji selisih, tahun lengkap harus sama pada kedua deret.',
      incompatible: 'Uji selisih memerlukan besaran, satuan, sumber, dan cakupan spasial yang sepadan.',
      'unavailable-inference': 'Uji yang sesuai belum tersedia. Jeda pada tahun bersama dapat membatasi uji selisih.',
      'request-failed': 'Data NASA untuk permintaan ini belum tersedia. Periksa pengaturan atau coba lagi.',
      'stale-query': 'Pengaturan berubah. Jalankan penelusuran untuk memperoleh hasil baru.',
      'dated-snapshot': 'Ini arsip bertanggal. Versi NASA yang lebih baru mungkin berbeda.',
      loading: 'Sedang mengambil catatan bulanan NASA POWER…'
    }
  },
  en: {
    understand: 'Understand', explore: 'Explore', verify: 'Verify', skip: 'Skip to main content',
    language: 'Language', navigation: 'Main views', caseLabel: 'Research screening · Yogyakarta',
    caseQuestion: 'Did the model grid point near Yogyakarta warm?',
    researchQuestion: 'Should we request station records to investigate warming near Yogyakarta?',
    archive: 'Dated NASA archive', fresh: 'Fetched from NASA POWER', imported: 'User import · origin unverified',
    snapshotNote: 'Historical archive. NASA may revise these records.',
    grid: 'Model grid point', area: 'Area average', unknown: 'Spatial coverage unknown',
    perDecade: 'per decade', fittedTrend: 'Fitted trend', annual: 'Annual average', fit: 'Fitted line',
    chartSummary: 'Annual averages and the fitted line for the NASA POWER model grid point. Exact values are available in Verify.',
    caseScope: 'This estimate covers one model grid point. Citywide temperatures, urban heat islands and heat risk require independent local evidence.',
    moreLimits: 'The records also cannot establish neighborhood conditions, heat illness, causes, forecasts or the effects of an intervention.',
    scope: 'Limits of the evidence', next: 'What to check next', strength: 'How strong is the evidence?',
    verifyNext: 'Request BMKG station temperature records for the same years. Check station history and gaps.',
    localVerification: 'Look for independent observations of the same quantity near the selected point and over the same period. Check their quality before drawing local conclusions.',
    verifyMore: 'For a follow-up study, check local land use, quality-checked land-surface temperature, population exposure and vulnerability. Local validation is pending.',
    sources: 'Sources and methods', methods: 'Methods and assumptions', brief: 'Open research brief',
    archiveView: 'Open Yogyakarta case', currentView: 'View investigation result', exploreChart: 'Explore NASA data',
    report: 'Yogyakarta climate evidence brief', print: 'Print / save PDF', html: 'Download HTML brief',
    generated: 'Report date', archivedAt: 'Archive run date (UTC)', retrievedAt: 'Retrieval time (UTC)',
    screening: 'Research screening only. Not an official policy decision or hazard warning.',
    recorded: 'valid months', complete: 'complete years', missing: 'missing months', rawMonths: 'Monthly records',
    annualValues: 'Annual averages', date: 'Date', value: 'Value', original: 'Original NASA query',
    reproduction: 'Independent archive verification', compare: 'Point comparison', csv: 'Download CSV', json: 'Download Evidence JSON',
    variability: 'The tests use the same series. Dependence between nearby years can overstate the strength of the evidence.',
    methodShort: 'Annual averages weight months by their number of days. Years need all 12 valid months to enter the fit.',
    sharing: 'Copy investigation link', shareNote: 'The link reopens these selections and requests NASA data again. Imported files and saved results travel separately.',
    copied: 'Link copied.', retry: 'Retry', goExplore: 'Check settings',
    partial: 'Some points failed to load. Retry to complete the comparison.',
    inputError: 'Check the coordinates, variable and range of at least 10 calendar years.',
    classicInterval: '95% interval from the straight-line fit', sameData: 'Both tests use the same data.',
    why: 'From a model result to local evidence', sourceDate: 'Source date', currentQuestion: 'What do these historical records show?',
    noFuture: 'Historical fits cannot establish causes or future conditions.',
    noPair: 'The estimated difference interval includes zero. It leaves open which point warmed faster.',
    sampling: 'Monthly cadence', missingYears: 'Incomplete years',
    requested: 'Requested coordinates', returned: 'Coordinates from the NASA response', localFile: 'Local file',
    moreSourceData: 'Source metadata', authentication: 'Source status', utc: 'UTC time', noNumbers: 'This request has no data to export yet.',
    statuses: {
      'supported-trend': 'Two tests support the same trend direction under their assumptions.',
      'mixed-evidence': 'The two tests give mixed evidence of a trend.',
      'not-detected': 'Neither test detected a trend at the selected threshold. Change is still possible.',
      'difference-not-established': 'The evidence does not establish a difference between the two fitted rates.',
      'difference-supported': 'The estimated difference interval lies on one side of zero under the paired method’s assumptions.',
      'exploratory-selected': 'This pair was selected after screening many points. The difference is exploratory.',
      insufficient: 'At least 10 complete calendar years are needed. A paired test requires years complete at both points.',
      incompatible: 'A paired test needs matching quantities, units, source and spatial coverage.',
      'unavailable-inference': 'A suitable test is unavailable. Gaps in shared years can prevent paired inference.',
      'request-failed': 'NASA data for this request are unavailable. Check the settings or retry.',
      'stale-query': 'Settings have changed. Run the investigation to get a new result.',
      'dated-snapshot': 'This is a dated archive. Newer NASA revisions may differ.',
      loading: 'Retrieving NASA POWER monthly records…'
    }
  }
};

const quantityID = {
  T2M: 'suhu udara 2 m', T2M_MAX: 'nilai maksimum bulanan suhu udara 2 m',
  T2M_MIN: 'nilai minimum bulanan suhu udara 2 m', T2MDEW: 'titik embun 2 m',
  RH2M: 'kelembapan relatif 2 m', QV2M: 'kelembapan spesifik 2 m',
  WS2M: 'kecepatan angin 2 m', PS: 'tekanan permukaan', PRECTOTCORR: 'laju curah hujan rata-rata harian'
};

export function signedNumber(value, locale, digits = 3) {
  return new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    maximumFractionDigits: digits, signDisplay: 'exceptZero', useGrouping: false
  }).format(value);
}

export function trendSentence(finding, variableLabel, locale) {
  const t = messages[locale];
  if (finding.value === null) return t.statuses[finding.findingStatus];
  const id = locale === 'id';
  const period = `${finding.period.fittedStart}–${finding.period.fittedEnd}`;
  const quantity = id ? (quantityID[finding.variable?.split(':').at(-1)] || variableLabel) : variableLabel.toLowerCase();
  const rate = `${signedNumber(finding.value, locale)} ${finding.unit} ${t.perDecade}`;
  return id
    ? `Selama ${period}, data NASA POWER memperkirakan tren ${quantity} sebesar ${rate} pada titik grid model yang dipilih.`
    : `For ${period}, NASA POWER estimates a trend of ${rate} in ${quantity} at the selected model grid point.`;
}
