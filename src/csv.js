/** Quote CSV fields and neutralize spreadsheet formulas in text fields.
 * Numbers remain numbers, including negative observations and coordinates.
 */
export function csvCell(value) {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"','""') + '"';
}
