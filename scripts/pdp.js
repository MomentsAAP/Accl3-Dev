/*
* Shared PDP link helpers, used by the PLP (products), Product Cards and the PDP.
* Change PDP_PATH / PDP_PARAM here only.
*/
 
export const PDP_PATH = '/prod-details';
export const PDP_PARAM = 'sku';
 
/** "/prod-details?sku=ts01" from a skuID, or '' when there is no skuID */
export function pdpUrl(sku) {
  const value = `${sku ?? ''}`.trim();
  return value ? `${PDP_PATH}?${PDP_PARAM}=${encodeURIComponent(value)}` : '';
}
 
/** the skuID on the current PDP page, e.g. "ts01" (for the PDP block) */
export function currentSku() {
  return new URLSearchParams(window.location.search).get(PDP_PARAM) || '';
}
 
/** skuID from a PIM row, whatever the column's upper/lower case */
export function rowSku(row) {
  const key = Object.keys(row).find((k) => ['skuid', 'sku'].includes(k.trim().toLowerCase()));
  return key ? `${row[key] ?? ''}`.trim() : '';
}