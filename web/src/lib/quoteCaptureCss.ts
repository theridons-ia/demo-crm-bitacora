/**
 * CSS aislado para rasterizar la OV/cotización.
 * html2canvas 1.4 no entiende color-mix/color() ni letter-spacing de DM Sans
 * (se come los espacios). Arial + hex, como la captura de SPT Desk.
 */
export const QUOTE_CAPTURE_CSS = `
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
}
.quote-doc, .quote-doc * {
  font-family: Arial, Helvetica, sans-serif !important;
  letter-spacing: 0 !important;
  word-spacing: normal !important;
  box-sizing: border-box;
}
.quote-doc {
  width: 794px;
  min-height: 1123px;
  margin: 0;
  background: #ffffff;
  color: #1a2b2e;
  border: 0;
  border-radius: 0;
  padding: 22px 28px 28px;
  font-size: 12px;
  line-height: 1.35;
  overflow: hidden;
}
.quote-doc-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 2px solid #18312f;
}
.quote-doc-brand {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
  flex: 1;
}
.quote-doc-logo {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f4f8f6;
  border: 1px solid #c5d0ce;
}
.quote-doc-logo img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.quote-doc-company { min-width: 0; }
.quote-doc-company h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.15;
  color: #18312f;
  text-transform: uppercase;
}
.quote-doc-rif {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 800;
  color: #112233;
}
.quote-doc-slogan,
.quote-doc-addr {
  margin: 2px 0 0;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  color: #71807b;
}
.quote-doc-meta {
  text-align: right;
  min-width: 0;
}
.quote-doc-title {
  display: block;
  font-weight: 800;
  color: #18312f;
  font-size: 16px;
}
.quote-doc-meta p {
  margin: 3px 0 0;
  color: #445555;
  font-size: 12px;
}
.quote-doc-parties {
  display: grid;
  gap: 5px;
  margin: 14px 0 16px;
}
.quote-doc-party-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px 20px;
  align-items: baseline;
}
.quote-doc-parties p {
  margin: 0;
  min-width: 0;
  font-size: 12px;
  color: #112233;
}
.quote-doc-parties p.is-end {
  text-align: right;
  white-space: nowrap;
  justify-self: end;
}
.quote-doc-parties span {
  display: inline;
  font-weight: 800;
  color: #112233;
}
.quote-doc-table-wrap {
  position: relative;
  overflow: visible;
}
.quote-doc-watermark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 180px;
  height: 180px;
  transform: translate(-50%, -50%);
  opacity: 0.06;
  pointer-events: none;
}
.quote-doc-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 11px;
  position: relative;
}
.quote-doc-table col.col-sku { width: 16%; }
.quote-doc-table col.col-desc { width: 38%; }
.quote-doc-table col.col-qty { width: 10%; }
.quote-doc-table col.col-unit,
.quote-doc-table col.col-sub { width: 18%; }
.quote-doc-table th {
  background: #2f3f45;
  color: #ffffff;
  text-align: left;
  padding: 8px 6px;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
}
.quote-doc-table td {
  padding: 7px 6px;
  border-bottom: 1px solid #e4eaec;
  vertical-align: top;
  color: #112233;
}
.quote-doc-table tbody tr:nth-child(even) { background: #f4f8f9; }
.quote-doc-desc {
  text-transform: uppercase;
  font-weight: 600;
}
.quote-doc-table th.is-num,
.quote-doc-table .is-num {
  text-align: right;
  white-space: nowrap;
}
.quote-doc-table tfoot td {
  border-bottom: 0;
  padding: 6px;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 11px;
  color: #71807b;
  background: transparent;
}
.quote-doc-table tfoot tr:first-child td { padding-top: 11px; }
.quote-doc-table tfoot td.is-num {
  color: #112233;
  font-size: 12px;
  text-transform: none;
}
.quote-doc-table tfoot td:nth-child(2) { text-align: right; }
.quote-doc-table tfoot tr.is-total td:nth-child(2),
.quote-doc-table tfoot tr.is-total td:nth-child(3) {
  background: #18312f;
  color: #ffffff;
  padding-top: 8px;
  padding-bottom: 8px;
}
.quote-doc-table tfoot tr.is-total td:nth-child(2) {
  border-radius: 8px 0 0 8px;
}
.quote-doc-table tfoot tr.is-total td:nth-child(3) {
  border-radius: 0 8px 8px 0;
}
.quote-doc-rate {
  margin: 8px 0 0;
  font-size: 11px;
  font-style: italic;
  color: #71807b;
  text-align: right;
}
.quote-doc-notes {
  margin: 12px 0 0;
  color: #445555;
  font-size: 12px;
}
.quote-doc-notes span {
  font-weight: 700;
  color: #112233;
}
.quote-doc-foot {
  display: grid;
  grid-template-columns: 1.4fr 1fr 0.9fr;
  gap: 16px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e4eaec;
}
.quote-doc-foot strong {
  display: block;
  margin-bottom: 6px;
  color: #18312f;
  font-size: 12px;
}
.quote-doc-foot ul {
  margin: 0;
  padding-left: 18px;
  color: #555566;
  font-size: 11px;
  line-height: 1.35;
}
.quote-doc-foot p {
  margin: 0 0 4px;
  color: #555566;
  font-size: 12px;
}
.quote-doc-sign {
  margin-top: 28px;
  border-bottom: 1px solid #8899aa;
  height: 1px;
}
`;
