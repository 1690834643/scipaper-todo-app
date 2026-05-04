// Local-time YYYY-MM-DD helper. Replaces `new Date().toISOString().slice(0, 10)`
// which collapses to UTC date — non-UTC users near local midnight see the
// "today" / streak / heatmap shift by one day. Use this everywhere a calendar
// day is stored or compared against user-perceived dates.
function localIsoDate(date) {
  const d = date instanceof Date ? date : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { localIsoDate };
